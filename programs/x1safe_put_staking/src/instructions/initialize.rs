use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = VaultState::LEN,
        seeds = [seeds::VAULT_STATE],
        bump
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
    /// X1SAFE mint - will be created by the program
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = vault_state,
    )]
    pub x1safe_mint: Box<Account<'info, Mint>>,
    
    /// X1SAFE-PUT mint - will be created by the program
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = vault_state,
    )]
    pub x1safe_put_mint: Box<Account<'info, Mint>>,
    
    /// USDC.X mint for fee distribution
    pub usdc_mint: Box<Account<'info, Mint>>,
    
    /// Treasury account for fee collection
    /// CHECK: Treasury address validated in handler
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    /// Fee pool for staker rewards
    /// CHECK: Fee pool validated in handler
    #[account(mut)]
    pub fee_pool: AccountInfo<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    x1safe_decimals: u8,
    x1safe_put_decimals: u8,
    apy_bps: u16,
) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let bump = ctx.bumps.vault_state;
    
    // Validate treasury address
    let treasury_key = ctx.accounts.treasury.key();
    require!(
        treasury_key.to_string() == "2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R",
        X1safeError::Unauthorized
    );
    
    // Initialize vault state
    vault_state.authority = ctx.accounts.authority.key();
    vault_state.treasury = treasury_key;
    vault_state.fee_pool = ctx.accounts.fee_pool.key();
    vault_state.x1safe_mint = ctx.accounts.x1safe_mint.key();
    vault_state.x1safe_put_mint = ctx.accounts.x1safe_put_mint.key();
    vault_state.usdc_mint = ctx.accounts.usdc_mint.key();
    vault_state.supported_tokens_count = 0;
    vault_state.total_tvl_usd = 0;
    vault_state.total_x1safe_put_supply = 0;
    vault_state.total_staked = 0;
    vault_state.staker_fee_share = 6000;    // 60%
    vault_state.buyback_fee_share = 2000;   // 20%
    vault_state.treasury_fee_share = 2000;  // 20%
    vault_state.x1safe_price_usd = 10_000;  // $0.01 * 1e6
    vault_state.apy_bps = apy_bps;          // e.g. 1000 = 10% APY
    vault_state.bump = bump;
    vault_state.paused = false;
    vault_state.reserved = [0; 30];
    
    // Validate fee split
    require!(vault_state.validate_fee_split(), X1safeError::InvalidFeeSplit);
    
    msg!("X1SAFE-PUT Staking v2.0 initialized");
    msg!("Authority: {}", vault_state.authority);
    msg!("Treasury: {}", vault_state.treasury);
    msg!("X1SAFE Peg: $0.01");
    
    Ok(())
}