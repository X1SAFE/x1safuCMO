use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn, MintTo};
use crate::state::*;
use crate::error::X1safeError;
use crate::oracle::XdexOracle;
use crate::utils::seeds;

#[derive(Accounts)]
#[instruction(x1safe_put_amount: u64)]
pub struct ExitVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
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
    pub user_position: Box<Account<'info, UserPosition>>,
    
    /// Supported token info
    #[account(
        seeds = [seeds::SUPPORTED_TOKEN, token_mint.key().as_ref()],
        bump = supported_token.bump,
    )]
    pub supported_token: Box<Account<'info, SupportedToken>>,
    
    /// Token mint
    pub token_mint: Box<Account<'info, Mint>>,
    
    /// User's X1SAFE-PUT account
    #[account(
        mut,
        constraint = user_x1safe_put_account.owner == user.key(),
        constraint = user_x1safe_put_account.mint == x1safe_put_mint.key(),
    )]
    pub user_x1safe_put_account: Box<Account<'info, TokenAccount>>,
    
    /// X1SAFE-PUT mint
    #[account(
        mut,
        constraint = x1safe_put_mint.key() == vault_state.x1safe_put_mint,
    )]
    pub x1safe_put_mint: Box<Account<'info, Mint>>,
    
    /// Vault token account
    #[account(
        mut,
        constraint = vault_token_account.mint == token_mint.key(),
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,
    
    /// User's token account
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == token_mint.key(),
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,
    
    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault_state.x1safe_mint,
    )]
    pub x1safe_mint: Box<Account<'info, Mint>>,
    
    /// Reward pool X1SAFE account
    #[account(
        mut,
        constraint = reward_pool_x1safe.mint == x1safe_mint.key(),
    )]
    pub reward_pool_x1safe: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<ExitVault>,
    x1safe_put_amount: u64,
) -> Result<()> {
    require!(x1safe_put_amount > 0, X1safeError::InvalidAmount);
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
        ctx.accounts.user_x1safe_put_account.amount >= x1safe_put_amount,
        X1safeError::InsufficientBalance
    );
    
    // Calculate original token amount to return
    // This is proportional to the X1SAFE-PUT being burned
    let total_x1safe_put = user_position.x1safe_put_amount;
    let total_deposited = user_position.deposited_amount;
    
    let return_amount = (x1safe_put_amount as u128)
        .checked_mul(total_deposited as u128)
        .ok_or(X1safeError::MathOverflow)?
        .checked_div(total_x1safe_put as u128)
        .ok_or(X1safeError::MathOverflow)? as u64;
    
    // Calculate X1SAFE to mint to reward pool
    // 1 X1SAFE = $0.01, so USD value * 100 = X1SAFE amount
    let usd_value = x1safe_put_amount; // 1:1 with USD
    let x1safe_reward_amount = usd_value
        .checked_mul(100)
        .ok_or(X1safeError::MathOverflow)?;
    
    // Burn X1SAFE-PUT from user
    let cpi_accounts = Burn {
        mint: ctx.accounts.x1safe_put_mint.to_account_info(),
        from: ctx.accounts.user_x1safe_put_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::burn(cpi_ctx, x1safe_put_amount)?;
    
    // Transfer original tokens back to user
    let vault_key = ctx.accounts.vault_state.key();
    let bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, return_amount)?;
    
    // Mint X1SAFE to reward pool
    let cpi_accounts = MintTo {
        mint: ctx.accounts.x1safe_mint.to_account_info(),
        to: ctx.accounts.reward_pool_x1safe.to_account_info(),
        authority: ctx.accounts.vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::mint_to(cpi_ctx, x1safe_reward_amount)?;
    
    // Update user position
    let user_position = &mut ctx.accounts.user_position;
    user_position.x1safe_put_amount = user_position.x1safe_put_amount
        .checked_sub(x1safe_put_amount)
        .ok_or(X1safeError::MathOverflow)?;
    user_position.deposited_amount = user_position.deposited_amount
        .checked_sub(return_amount)
        .ok_or(X1safeError::MathOverflow)?;
    
    // If fully exited, mark position as inactive
    if user_position.x1safe_put_amount == 0 {
        user_position.active = false;
        user_position.is_locked = false;
    }
    
    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_tvl_usd = vault_state.total_tvl_usd
        .checked_sub(usd_value)
        .unwrap_or(0);
    vault_state.total_x1safe_put_supply = vault_state.total_x1safe_put_supply
        .checked_sub(x1safe_put_amount)
        .unwrap_or(0);
    
    msg!("Exit vault successful: {} X1SAFE-PUT burned", x1safe_put_amount);
    msg!("Returned: {} tokens, Minted to reward pool: {} X1SAFE", 
        return_amount, x1safe_reward_amount);
    
    Ok(())
}