use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    
    /// User position (must be active)
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
    
    /// User's X1SAFE-PUT account
    #[account(
        mut,
        constraint = user_x1safe_put_account.owner == user.key(),
        constraint = user_x1safe_put_account.mint == vault_state.x1safe_put_mint,
    )]
    pub user_x1safe_put_account: Account<'info, TokenAccount>,
    
    /// Stake vault (holds staked X1SAFE-PUT)
    #[account(
        mut,
        constraint = stake_vault.mint == vault_state.x1safe_put_mint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    
    /// Stake account (PDA)
    #[account(
        init,
        payer = user,
        space = StakeAccount::LEN,
        seeds = [
            seeds::STAKE_ACCOUNT,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    
    /// Vesting schedule for X1SAFE rewards
    #[account(
        init,
        payer = user,
        space = VestingSchedule::LEN,
        seeds = [
            seeds::VESTING_SCHEDULE,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<Stake>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, X1safeError::InvalidAmount);
    require!(!ctx.accounts.vault_state.paused, X1safeError::Unauthorized);
    
    let user_position = &ctx.accounts.user_position;
    let clock = Clock::get()?;
    
    // Validate user has enough X1SAFE-PUT
    require!(
        ctx.accounts.user_x1safe_put_account.amount >= amount,
        X1safeError::InsufficientBalance
    );
    
    // Transfer X1SAFE-PUT to stake vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_x1safe_put_account.to_account_info(),
        to: ctx.accounts.stake_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    
    // Initialize stake account
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.owner = ctx.accounts.user.key();
    stake_account.amount_staked = amount;
    stake_account.entry_timestamp = clock.unix_timestamp;
    stake_account.last_claim_timestamp = clock.unix_timestamp;
    stake_account.reward_index_entry = 0; // Will be set based on global index
    stake_account.pending_usdc_rewards = 0;
    stake_account.pending_x1safe_rewards = 0;
    stake_account.total_usdc_claimed = 0;
    stake_account.total_x1safe_claimed = 0;
    stake_account.active = true;
    stake_account.bump = ctx.bumps.stake_account;
    stake_account.reserved = [0; 16];
    
    // Initialize vesting schedule (empty, will be populated when rewards accrue)
    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    vesting_schedule.owner = ctx.accounts.user.key();
    vesting_schedule.total_amount = 0;
    vesting_schedule.released_amount = 0;
    vesting_schedule.start_timestamp = 0; // Will be set on first reward
    vesting_schedule.current_phase = 0;
    vesting_schedule.phase_duration = 604800; // 7 days
    vesting_schedule.phases = [Default::default(); 6];
    vesting_schedule.active = true;
    vesting_schedule.bump = ctx.bumps.vesting_schedule;
    
    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_staked = vault_state.total_staked
        .checked_add(amount)
        .ok_or(X1safeError::MathOverflow)?;
    
    msg!("Stake successful: {} X1SAFE-PUT staked", amount);
    msg!("Entry time: {}", stake_account.entry_timestamp);
    
    Ok(())
}