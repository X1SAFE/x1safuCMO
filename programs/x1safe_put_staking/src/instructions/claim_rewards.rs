use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
pub struct ClaimX1safeRewards<'info> {
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
    
    /// Vesting schedule
    #[account(
        mut,
        seeds = [
            seeds::VESTING_SCHEDULE,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump = vesting_schedule.bump,
        constraint = vesting_schedule.owner == user.key() @ X1safeError::Unauthorized,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,
    
    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault_state.x1safe_mint,
    )]
    pub x1safe_mint: Account<'info, Mint>,
    
    /// Reward pool X1SAFE account
    #[account(
        mut,
        constraint = reward_pool_x1safe.mint == x1safe_mint.key(),
    )]
    pub reward_pool_x1safe: Account<'info, TokenAccount>,
    
    /// User's X1SAFE account
    #[account(
        mut,
        constraint = user_x1safe_account.owner == user.key(),
        constraint = user_x1safe_account.mint == x1safe_mint.key(),
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,
    
    /// Vault state PDA for signing
    /// CHECK: This is the vault state PDA
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state_pda: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimX1safeRewards>) -> Result<()> {
    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    let stake_account = &mut ctx.accounts.stake_account;
    let clock = Clock::get()?;
    
    // Initialize vesting schedule if first time
    if vesting_schedule.start_timestamp == 0 {
        // Calculate total pending X1SAFE rewards
        let total_rewards = stake_account.pending_x1safe_rewards;
        require!(total_rewards > 0, X1safeError::NoRewardsAvailable);
        
        // Initialize vesting schedule
        vesting_schedule.initialize(
            ctx.accounts.user.key(),
            total_rewards,
            clock.unix_timestamp,
        ).ok_or(X1safeError::MathOverflow)?;
        
        // Clear pending rewards from stake account (now in vesting)
        stake_account.pending_x1safe_rewards = 0;
    }
    
    // Calculate claimable amount based on vesting schedule
    let claimable = vesting_schedule.calculate_claimable(clock.unix_timestamp)
        .ok_or(X1safeError::MathOverflow)?;
    
    require!(claimable > 0, X1safeError::VestingIncomplete);
    
    // Transfer X1SAFE from reward pool to user
    let vault_key = ctx.accounts.vault_state.key();
    let bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.reward_pool_x1safe.to_account_info(),
        to: ctx.accounts.user_x1safe_account.to_account_info(),
        authority: ctx.accounts.vault_state_pda.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, claimable)?;
    
    // Update vesting schedule
    vesting_schedule.claim(clock.unix_timestamp)
        .ok_or(X1safeError::MathOverflow)?;
    
    // Update stake account
    stake_account.total_x1safe_claimed = stake_account.total_x1safe_claimed
        .checked_add(claimable)
        .ok_or(X1safeError::MathOverflow)?;
    
    // Update user position
    let user_position = &mut ctx.accounts.user_position;
    user_position.total_x1safe_claimed = user_position.total_x1safe_claimed
        .checked_add(claimable)
        .ok_or(X1safeError::MathOverflow)?;
    
    msg!("X1SAFE rewards claimed: {}", claimable);
    msg!("Vesting progress: {}%", vesting_schedule.vesting_progress(clock.unix_timestamp));
    
    Ok(())
}