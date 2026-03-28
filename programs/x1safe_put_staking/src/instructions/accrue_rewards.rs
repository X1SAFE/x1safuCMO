use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

/// Accrue X1SAFE rewards for a staker based on APY + time elapsed.
/// Anyone can call this (permissionless crank) — typically called by the user
/// before claiming, or by a keeper bot.
#[derive(Accounts)]
pub struct AccrueRewards<'info> {
    /// CHECK: anyone can trigger accrual for any user
    pub user: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

    /// Stake account to update
    #[account(
        mut,
        seeds = [
            seeds::STAKE_ACCOUNT,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ X1safeError::Unauthorized,
        constraint = stake_account.active @ X1safeError::PositionNotFound,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    /// Token mint (identifies which position)
    pub token_mint: Box<Account<'info, Mint>>,

    /// X1SAFE mint (for minting new rewards)
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault_state.x1safe_mint,
    )]
    pub x1safe_mint: Box<Account<'info, Mint>>,

    /// Reward reserve — X1SAFE is minted here for later claim
    #[account(
        mut,
        constraint = reward_reserve.mint == x1safe_mint.key(),
    )]
    pub reward_reserve: Box<Account<'info, TokenAccount>>,

    /// Vault state PDA (mint authority)
    /// CHECK: verified via seeds
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state_pda: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<AccrueRewards>) -> Result<()> {
    let stake_account = &mut ctx.accounts.stake_account;
    let vault_state   = &ctx.accounts.vault_state;
    let clock         = Clock::get()?;

    let now       = clock.unix_timestamp;
    let last      = stake_account.last_claim_timestamp;

    // Nothing to accrue if called in same second
    if now <= last {
        msg!("AccrueRewards: nothing to accrue (same timestamp)");
        return Ok(());
    }

    let elapsed_secs = (now - last) as u64;

    // APY → per-second rate (basis points)
    // rate_per_second = apy_bps / (365 * 24 * 3600 * 10_000)
    // We keep full precision: rewards = amount * elapsed * apy_bps / SECONDS_PER_YEAR / 10_000
    const SECONDS_PER_YEAR: u128 = 365 * 24 * 3600;

    let apy_bps = vault_state.apy_bps as u128;
    let staked  = stake_account.amount_staked as u128;

    // x1safe_rewards (same 6-decimal units as staked X1SAFE-PUT)
    let x1safe_rewards = staked
        .checked_mul(elapsed_secs as u128)
        .and_then(|v| v.checked_mul(apy_bps))
        .and_then(|v| v.checked_div(SECONDS_PER_YEAR))
        .and_then(|v| v.checked_div(10_000))
        .ok_or(X1safeError::MathOverflow)? as u64;

    if x1safe_rewards == 0 {
        // Dust — update timestamp anyway to avoid re-entry loop
        stake_account.last_claim_timestamp = now;
        msg!("AccrueRewards: dust amount, timestamp updated");
        return Ok(());
    }

    // Mint X1SAFE into reward reserve
    let bump        = vault_state.bump;
    let bump_bytes  = [bump];
    let signer_seeds: &[&[u8]] = &[seeds::VAULT_STATE, &bump_bytes];
    let signer = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint:      ctx.accounts.x1safe_mint.to_account_info(),
            to:        ctx.accounts.reward_reserve.to_account_info(),
            authority: ctx.accounts.vault_state_pda.to_account_info(),
        },
        signer,
    );
    token::mint_to(cpi_ctx, x1safe_rewards)?;

    // Update stake account
    stake_account.pending_x1safe_rewards = stake_account.pending_x1safe_rewards
        .checked_add(x1safe_rewards)
        .ok_or(X1safeError::MathOverflow)?;
    stake_account.last_claim_timestamp = now;

    msg!(
        "AccrueRewards: +{} X1SAFE (staked={}, elapsed={}s, apy={}bps)",
        x1safe_rewards, staked, elapsed_secs, apy_bps
    );

    Ok(())
}
