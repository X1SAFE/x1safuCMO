use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};

pub mod instructions;
pub mod state;
pub mod oracle;
pub mod error;
pub mod utils;

use instructions::*;
use state::*;
use error::*;

declare_id!("HRWXebJQHDFmKtYbgm9HzhPbEtDh6DhgfDZYght4eQdx");

#[program]
pub mod x1safe_put_staking {
    use super::*;

    /// Initialize the vault with supported tokens and configuration
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        x1safe_decimals: u8,
        x1safe_put_decimals: u8,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, x1safe_decimals, x1safe_put_decimals)
    }

    /// Deposit supported tokens and mint X1SAFE-PUT
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        lock_days: u16,
    ) -> Result<()> {
        instructions::deposit::handler(ctx, amount, lock_days)
    }

    /// Exit vault: burn X1SAFE-PUT, receive original asset, mint X1SAFE to reward pool
    pub fn exit_vault(
        ctx: Context<ExitVault>,
        x1safe_put_amount: u64,
    ) -> Result<()> {
        instructions::exit_vault::handler(ctx, x1safe_put_amount)
    }

    /// Stake X1SAFE-PUT to start earning rewards
    pub fn stake(
        ctx: Context<Stake>,
        amount: u64,
    ) -> Result<()> {
        instructions::stake::handler(ctx, amount)
    }

    /// Unstake X1SAFE-PUT (after lock period)
    pub fn unstake(
        ctx: Context<Unstake>,
        amount: u64,
    ) -> Result<()> {
        instructions::unstake::handler(ctx, amount)
    }

    /// Claim USDC.X fees immediately (no vesting)
    pub fn claim_usdc_fees(
        ctx: Context<ClaimUsdcFees>,
    ) -> Result<()> {
        instructions::claim_fees::handler(ctx)
    }

    /// Claim X1SAFE rewards (subject to vesting)
    pub fn claim_x1safe_rewards(
        ctx: Context<ClaimX1safeRewards>,
    ) -> Result<()> {
        instructions::claim_rewards::handler(ctx)
    }

    /// Process fee split: 60% to stakers, 20% buyback, 20% treasury
    pub fn process_fees(
        ctx: Context<ProcessFees>,
        amount: u64,
    ) -> Result<()> {
        instructions::process_fees::handler(ctx, amount)
    }

    /// Add supported token to vault
    pub fn add_supported_token(
        ctx: Context<AddSupportedToken>,
        token_mint: Pubkey,
        is_stable: bool,
        oracle: Pubkey,
    ) -> Result<()> {
        instructions::admin::add_supported_token(ctx, token_mint, is_stable, oracle)
    }

    /// Update oracle for a token
    pub fn update_oracle(
        ctx: Context<UpdateOracle>,
        new_oracle: Pubkey,
    ) -> Result<()> {
        instructions::admin::update_oracle(ctx, new_oracle)
    }
}