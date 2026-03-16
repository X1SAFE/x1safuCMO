use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe");

#[program]
pub mod x1safu {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_tvl = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer tokens from user → vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update user position
        let pos = &mut ctx.accounts.user_position;
        pos.owner = ctx.accounts.user.key();
        pos.amount = pos.amount.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        // Update vault TVL
        let vault = &mut ctx.accounts.vault;
        vault.total_tvl = vault.total_tvl.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            ctx.accounts.user_position.amount >= amount,
            ErrorCode::InsufficientFunds
        );

        let vault_bump = ctx.accounts.vault.bump;
        let seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        let signer_seeds = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let pos = &mut ctx.accounts.user_position;
        pos.amount = pos.amount.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;

        let vault = &mut ctx.accounts.vault;
        vault.total_tvl = vault.total_tvl.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }
}

// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultState::SIZE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VaultState>,

    // init_if_needed: create UserPosition PDA on first deposit
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::SIZE,
        seeds = [b"position", user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"position", user.key().as_ref()],
        bump,
        constraint = user_position.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct VaultState {
    pub authority: Pubkey,
    pub total_tvl: u64,
    pub bump: u8,
}

impl VaultState {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub amount: u64,
}

impl UserPosition {
    pub const SIZE: usize = 32 + 8;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient funds in position")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
}
