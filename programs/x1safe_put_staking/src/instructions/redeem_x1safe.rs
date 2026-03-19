use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Token, TokenAccount, Mint};
use crate::state::*;
use crate::error::X1safeError;

/// Redeem X1SAFE-PUT for X1SAFE (1:1)
/// User burns PUT and receives X1SAFE free tokens
/// This keeps value in the X1SAFE ecosystem instead of exiting to collateral
#[derive(Accounts)]
pub struct RedeemX1safe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"x1safe_put_mint"],
        bump,
    )]
    pub x1safe_put_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"x1safe_mint"],
        bump,
    )]
    pub x1safe_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = x1safe_put_mint,
        associated_token::authority = user,
    )]
    pub user_put_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = x1safe_mint,
        associated_token::authority = user,
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref(), token_mint.key().as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// CHECK: Token mint for this position
    pub token_mint: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RedeemX1safe>, put_amount: u64) -> Result<()> {
    require!(put_amount > 0, X1safeError::InvalidAmount);
    require!(!ctx.accounts.vault.paused, X1safeError::Unauthorized);
    require!(
        ctx.accounts.user_position.x1safe_put_amount >= put_amount,
        X1safeError::InsufficientBalance
    );
    require!(
        !ctx.accounts.user_position.is_locked,
        X1safeError::LockNotEnded
    );

    let vault_bump = ctx.accounts.vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

    // Burn X1SAFE-PUT from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
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
            MintTo {
                mint: ctx.accounts.x1safe_mint.to_account_info(),
                to: ctx.accounts.user_x1safe_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        put_amount,
    )?;

    // Update vault state
    ctx.accounts.vault.total_x1safe_put_supply = ctx
        .accounts
        .vault
        .total_x1safe_put_supply
        .checked_sub(put_amount)
        .ok_or(X1safeError::MathOverflow)?;

    // Update user position
    ctx.accounts.user_position.x1safe_put_amount = ctx
        .accounts
        .user_position
        .x1safe_put_amount
        .checked_sub(put_amount)
        .ok_or(X1safeError::MathOverflow)?;

    // Mark position as inactive if no more PUT
    if ctx.accounts.user_position.x1safe_put_amount == 0 {
        ctx.accounts.user_position.active = false;
    }

    msg!("RedeemX1safe: burned {} PUT → minted {} X1SAFE", put_amount, put_amount);
    Ok(())
}
