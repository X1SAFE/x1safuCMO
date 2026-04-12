use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::{seeds, fees};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct ProcessFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
        constraint = vault_state.authority == authority.key() @ X1safeError::Unauthorized,
    )]
    pub vault_state: Account<'info, VaultState>,
    
    /// USDC.X mint
    pub usdc_mint: Account<'info, Mint>,
    
    /// Fee collection account (source)
    #[account(
        mut,
        constraint = fee_collection_account.mint == usdc_mint.key(),
    )]
    pub fee_collection_account: Account<'info, TokenAccount>,
    
    /// Staker fee pool (60%)
    #[account(
        mut,
        constraint = staker_fee_pool.mint == usdc_mint.key(),
    )]
    pub staker_fee_pool: Account<'info, TokenAccount>,
    
    /// Buyback pool (20%)
    #[account(
        mut,
        constraint = buyback_pool.mint == usdc_mint.key(),
    )]
    pub buyback_pool: Account<'info, TokenAccount>,
    
    /// Treasury account (20%)
    #[account(
        mut,
        constraint = treasury_account.mint == usdc_mint.key(),
        constraint = treasury_account.owner == vault_state.treasury,
    )]
    pub treasury_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<ProcessFees>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, X1safeError::InvalidAmount);
    
    let vault_state = &ctx.accounts.vault_state;
    
    // Validate fee split
    require!(vault_state.validate_fee_split(), X1safeError::InvalidFeeSplit);
    
    // Calculate fee split
    let (staker_amount, buyback_amount, treasury_amount) = fees::calculate_split(
        amount,
        vault_state.staker_fee_share,
        vault_state.buyback_fee_share,
        vault_state.treasury_fee_share,
    ).ok_or(X1safeError::MathOverflow)?;
    
    // Validate total
    let total = staker_amount
        .checked_add(buyback_amount)
        .and_then(|sum| sum.checked_add(treasury_amount))
        .ok_or(X1safeError::MathOverflow)?;
    require!(total <= amount, X1safeError::InvalidFeeSplit);
    
    // Transfer 60% to staker fee pool
    if staker_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.fee_collection_account.to_account_info(),
            to: ctx.accounts.staker_fee_pool.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, staker_amount)?;
    }
    
    // Transfer 20% to buyback pool
    if buyback_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.fee_collection_account.to_account_info(),
            to: ctx.accounts.buyback_pool.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, buyback_amount)?;
    }
    
    // Transfer 20% to treasury
    if treasury_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.fee_collection_account.to_account_info(),
            to: ctx.accounts.treasury_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, treasury_amount)?;
    }
    
    msg!("Fees processed: {} USDC.X", amount);
    msg!("  Staker pool (60%): {}", staker_amount);
    msg!("  Buyback pool (20%): {}", buyback_amount);
    msg!("  Treasury (20%): {}", treasury_amount);
    
    Ok(())
}