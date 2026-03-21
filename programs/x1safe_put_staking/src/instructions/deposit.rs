use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use crate::state::*;
use crate::error::X1safeError;
use crate::oracle::XdexOracle;
use crate::utils::{seeds, time};

#[derive(Accounts)]
#[instruction(amount: u64, lock_days: u16)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [seeds::VAULT_STATE],
        bump = vault_state.bump,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    
    /// Supported token info
    #[account(
        seeds = [seeds::SUPPORTED_TOKEN, token_mint.key().as_ref()],
        bump = supported_token.bump,
        constraint = supported_token.active @ X1safeError::TokenNotSupported,
    )]
    pub supported_token: Box<Account<'info, SupportedToken>>,
    
    /// Token mint being deposited
    pub token_mint: Box<Account<'info, Mint>>,
    
    /// User's token account
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == token_mint.key(),
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,
    
    /// Vault token account (holds deposited tokens)
    #[account(
        mut,
        constraint = vault_token_account.mint == token_mint.key(),
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,
    
    /// X1SAFE-PUT mint
    #[account(
        mut,
        constraint = x1safe_put_mint.key() == vault_state.x1safe_put_mint,
    )]
    pub x1safe_put_mint: Box<Account<'info, Mint>>,
    
    /// User's X1SAFE-PUT account
    #[account(
        mut,
        constraint = user_x1safe_put_account.owner == user.key(),
        constraint = user_x1safe_put_account.mint == x1safe_put_mint.key(),
    )]
    pub user_x1safe_put_account: Box<Account<'info, TokenAccount>>,
    
    /// User position account (PDA)
    #[account(
        init,
        payer = user,
        space = UserPosition::LEN,
        seeds = [
            seeds::USER_POSITION,
            user.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump
    )]
    pub user_position: Box<Account<'info, UserPosition>>,
    
    /// Oracle account for price feed
    /// CHECK: Oracle validated in supported_token
    pub oracle: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<Deposit>,
    amount: u64,
    lock_days: u16,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, X1safeError::InvalidAmount);
    require!(lock_days >= 1 && lock_days <= 360, X1safeError::InvalidLockPeriod);
    require!(!ctx.accounts.vault_state.paused, X1safeError::Unauthorized);
    
    let vault_state = &ctx.accounts.vault_state;
    let supported_token = &ctx.accounts.supported_token;
    let clock = Clock::get()?;
    
    // Calculate USD value of deposit
    let usd_value = if supported_token.is_stable {
        // Stablecoin: 1:1 pricing (assuming 6 decimals)
        amount
    } else {
        // Get price from oracle
        let price = XdexOracle::get_price(
            &supported_token.oracle,
            &ctx.accounts.token_mint.key(),
        )?;
        
        // Calculate USD value
        let decimals = ctx.accounts.token_mint.decimals;
        let adjusted_amount = if decimals <= 6 {
            amount.checked_mul(10u64.pow((6 - decimals) as u32))
                .ok_or(X1safeError::MathOverflow)?
        } else {
            amount.checked_div(10u64.pow((decimals - 6) as u32))
                .ok_or(X1safeError::MathOverflow)?
        };
        
        (adjusted_amount as u128)
            .checked_mul(price as u128)
            .ok_or(X1safeError::MathOverflow)?
            .checked_div(1_000_000)
            .ok_or(X1safeError::MathOverflow)? as u64
    };
    
    // X1SAFE-PUT amount equals USD value (1:1)
    let x1safe_put_amount = usd_value;
    
    // Transfer tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    
    // Mint X1SAFE-PUT to user
    let vault_key = ctx.accounts.vault_state.key();
    let bump = ctx.accounts.vault_state.bump;
    let seeds = &[
        seeds::VAULT_STATE,
        &[bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = MintTo {
        mint: ctx.accounts.x1safe_put_mint.to_account_info(),
        to: ctx.accounts.user_x1safe_put_account.to_account_info(),
        authority: ctx.accounts.vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::mint_to(cpi_ctx, x1safe_put_amount)?;
    
    // Initialize user position
    let user_position = &mut ctx.accounts.user_position;
    user_position.owner = ctx.accounts.user.key();
    user_position.token_mint = ctx.accounts.token_mint.key();
    user_position.deposited_amount = amount;
    user_position.x1safe_put_amount = x1safe_put_amount;
    user_position.lock_start = clock.unix_timestamp;
    user_position.lock_end = clock.unix_timestamp
        .checked_add(time::days_to_seconds(lock_days))
        .ok_or(X1safeError::MathOverflow)?;
    user_position.lock_days = lock_days;
    user_position.is_locked = true;
    user_position.deposit_value_usd = usd_value;
    user_position.accrued_usdc_fees = 0;
    user_position.accrued_x1safe_rewards = 0;
    user_position.total_usdc_claimed = 0;
    user_position.total_x1safe_claimed = 0;
    user_position.active = true;
    user_position.bump = ctx.bumps.user_position;
    user_position.reserved = [0; 16];
    
    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_tvl_usd = vault_state.total_tvl_usd
        .checked_add(usd_value)
        .ok_or(X1safeError::MathOverflow)?;
    vault_state.total_x1safe_put_supply = vault_state.total_x1safe_put_supply
        .checked_add(x1safe_put_amount)
        .ok_or(X1safeError::MathOverflow)?;
    
    msg!("Deposit successful: {} tokens, {} X1SAFE-PUT minted", amount, x1safe_put_amount);
    msg!("Lock period: {} days, ends at {}", lock_days, user_position.lock_end);
    
    Ok(())
}