use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
pub struct ClaimUsdcFees<'info> {
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
    )]
    pub stake_account: Account<'info, StakeAccount>,
    
    /// USDC.X mint
    #[account(
        constraint = usdc_mint.key() == vault_state.usdc_mint,
    )]
    pub usdc_mint: Account<'info, Mint>,
    
    /// Fee pool USDC.X account
    #[account(
        mut,
        constraint = fee_pool_usdc.mint == usdc_mint.key(),
    )]
    pub fee_pool_usdc: Account<'info, TokenAccount>,
    
    /// User's USDC.X account
    #[account(
        mut,
        constraint = user_usdc_account.owner == user.key(),
        constraint = user_usdc_account.mint == usdc_mint.key(),
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    /// Vault state PDA for signing
    /// CHECK: This is the vault state PDA
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state_pda: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimUsdcFees>) -> Result<()> {
    let stake_account = &mut ctx.accounts.stake_account;
    let clock = Clock::get()?;
    
    // Calculate pending USDC.X rewards
    // In a real implementation, this would use a global reward index
    // For now, we use the pending rewards stored in the stake account
    let pending_usdc = stake_account.pending_usdc_rewards;
    
    require!(pending_usdc > 0, X1safeError::NoRewardsAvailable);
    
    // Transfer USDC.X from fee pool to user
    let vault_key = ctx.accounts.vault_state.key();
    let bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.fee_pool_usdc.to_account_info(),
        to: ctx.accounts.user_usdc_account.to_account_info(),
        authority: ctx.accounts.vault_state_pda.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, pending_usdc)?;
    
    // Update stake account
    stake_account.pending_usdc_rewards = 0;
    stake_account.total_usdc_claimed = stake_account.total_usdc_claimed
        .checked_add(pending_usdc)
        .ok_or(X1safeError::MathOverflow)?;
    stake_account.last_claim_timestamp = clock.unix_timestamp;
    
    // Update user position
    let user_position = &mut ctx.accounts.user_position;
    user_position.total_usdc_claimed = user_position.total_usdc_claimed
        .checked_add(pending_usdc)
        .ok_or(X1safeError::MathOverflow)?;
    
    msg!("USDC.X fees claimed: {}", pending_usdc);
    
    Ok(())
}