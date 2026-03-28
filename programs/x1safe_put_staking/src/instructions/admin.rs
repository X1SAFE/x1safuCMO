use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;
use crate::error::X1safeError;
use crate::utils::seeds;

#[derive(Accounts)]
#[instruction(token_mint: Pubkey, is_stable: bool, oracle: Pubkey)]
pub struct AddSupportedToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
        constraint = vault_state.authority == authority.key() @ X1safeError::Unauthorized,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
    /// Token mint to add
    pub token_mint: Box<Account<'info, Mint>>,
    
    /// Supported token account (PDA)
    #[account(
        init,
        payer = authority,
        space = SupportedToken::LEN,
        seeds = [seeds::SUPPORTED_TOKEN, token_mint.key().as_ref()],
        bump
    )]
    pub supported_token: Box<Account<'info, SupportedToken>>,
    
    /// Token vault (holds deposited tokens)
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = vault_state,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    
    /// Oracle account
    /// CHECK: Oracle address stored for reference
    pub oracle: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn add_supported_token(
    ctx: Context<AddSupportedToken>,
    _token_mint: Pubkey,
    is_stable: bool,
    oracle: Pubkey,
) -> Result<()> {
    let supported_token = &mut ctx.accounts.supported_token;
    let vault_state = &mut ctx.accounts.vault_state;
    
    // Initialize supported token
    supported_token.mint = ctx.accounts.token_mint.key();
    supported_token.is_stable = is_stable;
    supported_token.oracle = oracle;
    supported_token.token_vault = ctx.accounts.token_vault.key();
    supported_token.total_deposited = 0;
    supported_token.decimals = ctx.accounts.token_mint.decimals;
    supported_token.active = true;
    supported_token.bump = ctx.bumps.supported_token;
    
    // Update vault state
    vault_state.supported_tokens_count = vault_state.supported_tokens_count
        .checked_add(1)
        .ok_or(X1safeError::MathOverflow)?;
    
    msg!("Added supported token: {}", ctx.accounts.token_mint.key());
    msg!("  Is stable: {}", is_stable);
    msg!("  Oracle: {}", oracle);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(new_oracle: Pubkey)]
pub struct UpdateOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
        constraint = vault_state.authority == authority.key() @ X1safeError::Unauthorized,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
    /// Supported token to update
    #[account(
        mut,
        seeds = [seeds::SUPPORTED_TOKEN, token_mint.key().as_ref()],
        bump = supported_token.bump,
    )]
    pub supported_token: Box<Account<'info, SupportedToken>>,
    
    /// Token mint
    pub token_mint: Box<Account<'info, Mint>>,
    
    /// New oracle
    /// CHECK: New oracle address
    pub new_oracle: AccountInfo<'info>,
}

pub fn update_oracle(
    ctx: Context<UpdateOracle>,
    new_oracle: Pubkey,
) -> Result<()> {
    let supported_token = &mut ctx.accounts.supported_token;
    
    // Update oracle
    supported_token.oracle = new_oracle;
    
    msg!("Updated oracle for token: {}", ctx.accounts.token_mint.key());
    msg!("  New oracle: {}", new_oracle);
    
    Ok(())
}
/// Update token vault account for a supported token (admin only)
#[derive(Accounts)]
pub struct UpdateTokenVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
        constraint = vault_state.authority == authority.key() @ X1safeError::Unauthorized,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
    #[account(
        mut,
        seeds = [seeds::SUPPORTED_TOKEN, token_mint.key().as_ref()],
        bump = supported_token.bump,
    )]
    pub supported_token: Box<Account<'info, SupportedToken>>,
    
    pub token_mint: Box<Account<'info, Mint>>,
    
    /// New token vault account
    #[account(
        constraint = new_token_vault.mint == token_mint.key(),
    )]
    pub new_token_vault: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token>,
}

pub fn update_token_vault(ctx: Context<UpdateTokenVault>) -> Result<()> {
    let supported_token = &mut ctx.accounts.supported_token;
    supported_token.token_vault = ctx.accounts.new_token_vault.key();
    msg!("Updated token_vault for {}: {}", ctx.accounts.token_mint.key(), ctx.accounts.new_token_vault.key());
    Ok(())
}

/// Set APY basis points (admin only). e.g. 1000 = 10% APY
#[derive(Accounts)]
pub struct SetApy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
        constraint = vault_state.authority == authority.key() @ X1safeError::Unauthorized,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
}

pub fn set_apy(ctx: Context<SetApy>, apy_bps: u16) -> Result<()> {
    ctx.accounts.vault_state.apy_bps = apy_bps;
    msg!("APY updated to {}bps ({:.2}%)", apy_bps, apy_bps as f64 / 100.0);
    Ok(())
}
