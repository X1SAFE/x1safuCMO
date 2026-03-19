use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Token, TokenAccount, Mint};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

/// Redeem X1SAFE-PUT for X1SAFE (1:1)
/// User burns PUT and receives X1SAFE free tokens
/// This keeps value in the X1SAFE ecosystem instead of exiting to collateral
#[derive(Accounts)]
pub struct RedeemX1safe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// User position
    #[account(
        mut,
        seeds = [
            seeds::USER_POSITION,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ X1safeError::Unauthorized,
        constraint = user_position.active @ X1safeError::PositionNotFound,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Token mint
    pub token_mint: Account<'info, Mint>,

    /// X1SAFE-PUT mint
    #[account(
        mut,
        constraint = x1safe_put_mint.key() == vault_state.x1safe_put_mint,
    )]
    pub x1safe_put_mint: Account<'info, Mint>,

    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault_state.x1safe_mint,
    )]
    pub x1safe_mint: Account<'info, Mint>,

    /// User's X1SAFE-PUT account
    #[account(
        mut,
        constraint = user_put_account.owner == user.key(),
        constraint = user_put_account.mint == x1safe_put_mint.key(),
    )]
    pub user_put_account: Account<'info, TokenAccount>,

    /// User's X1SAFE account
    #[account(
        mut,
        constraint = user_x1safe_account.owner == user.key(),
        constraint = user_x1safe_account.mint == x1safe_mint.key(),
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RedeemX1safe>, put_amount: u64) -> Result<()> {
    require!(put_amount > 0, X1safeError::InvalidAmount);
    require!(!ctx.accounts.vault_state.paused, X1safeError::Unauthorized);
    
    let user_position = &ctx.accounts.user_position;
    let clock = Clock::get()?;
    
    // Check if lock period has ended
    require!(
        user_position.is_lock_ended(clock.unix_timestamp),
        X1safeError::LockNotEnded
    );
    
    // Validate user has enough X1SAFE-PUT
    require!(
        ctx.accounts.user_put_account.amount >= put_amount,
        X1safeError::InsufficientBalance
    );

    let vault_bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[vault_bump],
    ];
    let signer = &[&seeds[..]];

    // Burn X1SAFE-PUT from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.x1safe_put_mint.to_account_info(),
                from: ctx.accounts.user_put_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        put_amount,
    )?;

    // Mint X1SAFE to user (1:1)
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.x1safe_mint.to_account_info(),
                to: ctx.accounts.user_x1safe_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        ),
        put_amount,
    )?;

    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_x1safe_put_supply = vault_state
        .total_x1safe_put_supply
        .checked_sub(put_amount)
        .ok_or(X1safeError::MathOverflow)?;

    // Update user position
    let user_position = &mut ctx.accounts.user_position;
    user_position.x1safe_put_amount = user_position
        .x1safe_put_amount
        .checked_sub(put_amount)
        .ok_or(X1safeError::MathOverflow)?;

    // Mark position as inactive if no more PUT
    if user_position.x1safe_put_amount == 0 {
        user_position.active = false;
    }

    msg!("RedeemX1safe: burned {} PUT → minted {} X1SAFE", put_amount, put_amount);
    Ok(())
}
