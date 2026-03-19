use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Unstake<'info> {
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
    )]
    pub user_position: Account<'info, UserPosition>,
    
    /// Token mint
    pub token_mint: Account<'info, Mint>,
    
    /// Stake account
    #[account(
        mut,
        seeds = [
            seeds::STAKE_ACCOUNT,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ X1safeError::Unauthorized,
        constraint = stake_account.active @ X1safeError::NoStakeFound,
    )]
    pub stake_account: Account<'info, StakeAccount>,
    
    /// Stake vault
    #[account(
        mut,
        constraint = stake_vault.mint == vault_state.x1safe_put_mint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    
    /// User's X1SAFE-PUT account
    #[account(
        mut,
        constraint = user_x1safe_put_account.owner == user.key(),
        constraint = user_x1safe_put_account.mint == vault_state.x1safe_put_mint,
    )]
    pub user_x1safe_put_account: Account<'info, TokenAccount>,
    
    /// Vault state PDA for signing
    /// CHECK: This is the vault state PDA
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state_pda: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Unstake>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, X1safeError::InvalidAmount);
    
    let stake_account = &ctx.accounts.stake_account;
    let user_position = &ctx.accounts.user_position;
    let clock = Clock::get()?;
    
    // Check if user position lock has ended
    require!(
        user_position.is_lock_ended(clock.unix_timestamp),
        X1safeError::StakeStillLocked
    );
    
    // Validate amount
    require!(
        amount <= stake_account.amount_staked,
        X1safeError::InsufficientBalance
    );
    
    // Transfer X1SAFE-PUT from stake vault back to user
    let vault_key = ctx.accounts.vault_state.key();
    let bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.stake_vault.to_account_info(),
        to: ctx.accounts.user_x1safe_put_account.to_account_info(),
        authority: ctx.accounts.vault_state_pda.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    
    // Update stake account
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.amount_staked = stake_account.amount_staked
        .checked_sub(amount)
        .ok_or(X1safeError::MathOverflow)?;
    
    // If fully unstaked, mark as inactive
    if stake_account.amount_staked == 0 {
        stake_account.active = false;
    }
    
    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_staked = vault_state.total_staked
        .checked_sub(amount)
        .unwrap_or(0);
    
    msg!("Unstake successful: {} X1SAFE-PUT returned", amount);
    
    Ok(())
}