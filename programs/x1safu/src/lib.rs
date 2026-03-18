use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe");

pub const X1SAFE_PER_USD: u64 = 100;      // 1 USD = 100 X1SAFE_PUT
pub const PRICE_SCALE:    u128 = 1_000_000; // prices stored × 10^6
pub const REWARD_SCALE:   u128 = 1_000_000_000_000; // 10^12

// ── Helpers ───────────────────────────────────────────────────────────────────

fn update_reward_per_token(pool: &mut StakePool) -> Result<()> {
    if pool.total_staked == 0 || pool.undistributed_rewards == 0 {
        return Ok(());
    }
    let delta = (pool.undistributed_rewards as u128)
        .checked_mul(REWARD_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(pool.total_staked as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    pool.reward_per_token_stored = pool.reward_per_token_stored
        .checked_add(delta)
        .ok_or(ErrorCode::MathOverflow)?;
    pool.undistributed_rewards = 0;
    Ok(())
}

fn calc_earned(user: &UserStake, pool: &StakePool) -> Result<u64> {
    let rpt_diff = pool.reward_per_token_stored.saturating_sub(user.reward_per_token_paid);
    let new_rewards = (user.staked_amount as u128)
        .checked_mul(rpt_diff)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(REWARD_SCALE)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    Ok(user.rewards_pending.checked_add(new_rewards).ok_or(ErrorCode::MathOverflow)?)
}

// ── Program ───────────────────────────────────────────────────────────────────

#[program]
pub mod x1safu {
    use super::*;

    // 1. Initialize vault state
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let v = &mut ctx.accounts.vault;
        v.authority         = ctx.accounts.authority.key();
        v.bump              = ctx.bumps.vault;
        v.paused            = false;
        v.keeper            = ctx.accounts.authority.key();
        v.total_put_supply  = 0;
        v.total_free_supply = 0;
        Ok(())
    }

    // 2. Create X1SAFE_PUT and X1SAFE_SAFE mints
    pub fn create_mints(ctx: Context<CreateMints>) -> Result<()> {
        let v = &mut ctx.accounts.vault;
        v.x1safe_put_mint  = ctx.accounts.put_mint.key();
        v.put_mint_bump    = ctx.bumps.put_mint;
        v.x1safe_safe_mint = ctx.accounts.safe_mint.key();
        v.safe_mint_bump   = ctx.bumps.safe_mint;
        Ok(())
    }

    // 3. Init staking pool + sX1SAFE mint + reserves
    pub fn init_stake_pool(ctx: Context<InitStakePool>, apy_bps: u16) -> Result<()> {
        let p = &mut ctx.accounts.stake_pool;
        p.authority            = ctx.accounts.authority.key();
        p.bump                 = ctx.bumps.stake_pool;
        p.sx1safe_mint         = ctx.accounts.sx1safe_mint.key();
        p.sx1safe_mint_bump    = ctx.bumps.sx1safe_mint;
        p.total_staked         = 0;
        p.reward_per_token_stored = 0;
        p.undistributed_rewards   = 0;
        p.apy_bps              = apy_bps;
        Ok(())
    }

    // 4. Register collateral asset
    pub fn add_asset(
        ctx: Context<AddAsset>,
        decimals: u8,
        is_fixed_price: bool,
        price_usd: u64,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.asset_config;
        cfg.mint           = ctx.accounts.asset_mint.key();
        cfg.decimals       = decimals;
        cfg.is_fixed_price = is_fixed_price;
        cfg.price_usd      = price_usd;
        cfg.reserve_balance = 0;
        Ok(())
    }

    // 5. Keeper updates oracle price
    pub fn update_price(ctx: Context<UpdatePrice>, price_usd: u64) -> Result<()> {
        let caller = ctx.accounts.caller.key();
        let vault  = &ctx.accounts.vault;
        require!(
            caller == vault.authority || caller == vault.keeper,
            ErrorCode::Unauthorized
        );
        let cfg = &mut ctx.accounts.asset_config;
        require!(!cfg.is_fixed_price, ErrorCode::FixedPriceAsset);
        require!(price_usd > 0, ErrorCode::InvalidAmount);
        cfg.price_usd = price_usd;
        Ok(())
    }

    // 6. Deposit collateral → mint X1SAFE_PUT
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let price_usd  = ctx.accounts.asset_config.price_usd;
        let decimals   = ctx.accounts.asset_config.decimals;
        let vault_bump = ctx.accounts.vault.bump;
        let put_bump   = ctx.accounts.vault.put_mint_bump;

        require!(!ctx.accounts.vault.paused, ErrorCode::VaultPaused);
        require!(price_usd > 0, ErrorCode::InvalidOraclePrice);

        // put_amount = amount × price_usd × 100 / (10^decimals × 1_000_000)
        let base = 10u128.pow(decimals as u32);
        let put_amount = (amount as u128)
            .checked_mul(price_usd as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_mul(X1SAFE_PER_USD as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_div(base.checked_mul(PRICE_SCALE).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        require!(put_amount > 0, ErrorCode::InvalidAmount);

        // Snapshot account infos before state mutations
        let vault_ai    = ctx.accounts.vault.to_account_info();
        let tok_prog_ai = ctx.accounts.token_program.to_account_info();
        let reserve_ai  = ctx.accounts.reserve_account.to_account_info();
        let user_ast_ai = ctx.accounts.user_asset_account.to_account_info();
        let user_ai     = ctx.accounts.user.to_account_info();
        let put_mint_ai = ctx.accounts.put_mint.to_account_info();
        let user_put_ai = ctx.accounts.user_put_ata.to_account_info();

        // CEI: state first
        ctx.accounts.vault.total_put_supply = ctx.accounts.vault.total_put_supply
            .checked_add(put_amount).ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.asset_config.reserve_balance = ctx.accounts.asset_config.reserve_balance
            .checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        if ctx.accounts.user_position.user == Pubkey::default() {
            ctx.accounts.user_position.user = ctx.accounts.user.key();
            ctx.accounts.user_position.bump = ctx.bumps.user_position;
        }
        ctx.accounts.user_position.put_balance = ctx.accounts.user_position.put_balance
            .checked_add(put_amount).ok_or(ErrorCode::MathOverflow)?;

        // Transfer collateral user → reserve
        token::transfer(
            CpiContext::new(tok_prog_ai.clone(), Transfer {
                from: user_ast_ai, to: reserve_ai, authority: user_ai,
            }),
            amount,
        )?;

        // Mint X1SAFE_PUT to user
        let seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        token::mint_to(
            CpiContext::new_with_signer(tok_prog_ai, MintTo {
                mint: put_mint_ai, to: user_put_ai, authority: vault_ai,
            }, &[seeds]),
            put_amount,
        )?;

        msg!("Deposit: {} → {} X1SAFE_PUT (price={})", amount, put_amount, price_usd);
        Ok(())
    }

    // 7. Burn X1SAFE_PUT → mint X1SAFE_FREE (1:1)
    pub fn withdraw(ctx: Context<Withdraw>, put_amount: u64) -> Result<()> {
        require!(put_amount > 0, ErrorCode::InvalidAmount);

        let vault_bump = ctx.accounts.vault.bump;
        let safe_bump  = ctx.accounts.vault.safe_mint_bump;
        let _ = safe_bump; // used via seeds

        require!(!ctx.accounts.vault.paused, ErrorCode::VaultPaused);

        let vault_ai    = ctx.accounts.vault.to_account_info();
        let tok_prog_ai = ctx.accounts.token_program.to_account_info();
        let put_mint_ai = ctx.accounts.put_mint.to_account_info();
        let safe_mint_ai = ctx.accounts.safe_mint.to_account_info();
        let user_put_ai  = ctx.accounts.user_put_account.to_account_info();
        let user_safe_ai = ctx.accounts.user_safe_account.to_account_info();
        let user_ai      = ctx.accounts.user.to_account_info();

        // Burn X1SAFE_PUT from user
        token::burn(
            CpiContext::new(tok_prog_ai.clone(), Burn {
                mint: put_mint_ai, from: user_put_ai, authority: user_ai,
            }),
            put_amount,
        )?;

        // Mint X1SAFE (free) 1:1
        let seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        token::mint_to(
            CpiContext::new_with_signer(tok_prog_ai, MintTo {
                mint: safe_mint_ai, to: user_safe_ai, authority: vault_ai,
            }, &[seeds]),
            put_amount,
        )?;

        ctx.accounts.vault.total_put_supply = ctx.accounts.vault.total_put_supply
            .checked_sub(put_amount).ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.vault.total_free_supply = ctx.accounts.vault.total_free_supply
            .checked_add(put_amount).ok_or(ErrorCode::MathOverflow)?;

        ctx.accounts.user_position.put_balance = ctx.accounts.user_position.put_balance
            .saturating_sub(put_amount);

        msg!("Withdraw: {} X1SAFE_PUT → {} X1SAFE", put_amount, put_amount);
        Ok(())
    }

    // 8. Burn X1SAFE_FREE → proportional collateral
    // remaining_accounts: [reserve_0, user_ata_0, reserve_1, user_ata_1, ...]
    pub fn exit<'info>(
        ctx: Context<'_, '_, '_, 'info, Exit<'info>>,
        safe_burn_amount: u64,
    ) -> Result<()> {
        require!(safe_burn_amount > 0, ErrorCode::InvalidAmount);

        let total_free = ctx.accounts.vault.total_free_supply;
        let vault_bump = ctx.accounts.vault.bump;

        require!(!ctx.accounts.vault.paused, ErrorCode::VaultPaused);
        require!(total_free > 0, ErrorCode::InsufficientFunds);
        require!(safe_burn_amount <= total_free, ErrorCode::InsufficientFunds);

        let vault_ai     = ctx.accounts.vault.to_account_info();
        let tok_prog_ai  = ctx.accounts.token_program.to_account_info();
        let safe_mint_ai = ctx.accounts.safe_mint.to_account_info();
        let user_safe_ai = ctx.accounts.user_safe_account.to_account_info();
        let user_ai      = ctx.accounts.user.to_account_info();

        // Burn X1SAFE
        token::burn(
            CpiContext::new(tok_prog_ai.clone(), Burn {
                mint: safe_mint_ai, from: user_safe_ai, authority: user_ai,
            }),
            safe_burn_amount,
        )?;

        ctx.accounts.vault.total_free_supply = total_free
            .checked_sub(safe_burn_amount).ok_or(ErrorCode::MathOverflow)?;

        // Release proportional collateral from each reserve
        let seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        let remaining = ctx.remaining_accounts;
        require!(remaining.len() % 2 == 0, ErrorCode::InvalidAmount);

        for i in 0..(remaining.len() / 2) {
            let reserve_ai  = &remaining[i * 2];
            let user_ata_ai = &remaining[i * 2 + 1];

            // Read reserve balance from raw data (SPL layout: 64..72 = amount)
            let data = reserve_ai.try_borrow_data()?;
            if data.len() < 72 { continue; }
            let reserve_balance = u64::from_le_bytes(data[64..72].try_into().unwrap());
            drop(data);

            if reserve_balance == 0 { continue; }

            let amount_out = (safe_burn_amount as u128)
                .checked_mul(reserve_balance as u128).ok_or(ErrorCode::MathOverflow)?
                .checked_div(total_free as u128).ok_or(ErrorCode::MathOverflow)? as u64;

            if amount_out == 0 { continue; }

            token::transfer(
                CpiContext::new_with_signer(tok_prog_ai.clone(), Transfer {
                    from: reserve_ai.clone(), to: user_ata_ai.clone(), authority: vault_ai.clone(),
                }, &[seeds]),
                amount_out,
            )?;
        }

        msg!("Exit: burned {} X1SAFE", safe_burn_amount);
        Ok(())
    }

    // 9. Burn X1SAFE_FREE → mint X1SAFE_PUT (re-lock, 1:1)
    pub fn redeposit(ctx: Context<Redeposit>, safe_amount: u64) -> Result<()> {
        require!(safe_amount > 0, ErrorCode::InvalidAmount);

        let vault_bump = ctx.accounts.vault.bump;

        require!(!ctx.accounts.vault.paused, ErrorCode::VaultPaused);

        let vault_ai     = ctx.accounts.vault.to_account_info();
        let tok_prog_ai  = ctx.accounts.token_program.to_account_info();
        let safe_mint_ai = ctx.accounts.safe_mint.to_account_info();
        let put_mint_ai  = ctx.accounts.put_mint.to_account_info();
        let user_safe_ai = ctx.accounts.user_safe_account.to_account_info();
        let user_put_ai  = ctx.accounts.user_put_ata.to_account_info();
        let user_ai      = ctx.accounts.user.to_account_info();

        token::burn(
            CpiContext::new(tok_prog_ai.clone(), Burn {
                mint: safe_mint_ai, from: user_safe_ai, authority: user_ai,
            }),
            safe_amount,
        )?;

        let seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
        token::mint_to(
            CpiContext::new_with_signer(tok_prog_ai, MintTo {
                mint: put_mint_ai, to: user_put_ai, authority: vault_ai,
            }, &[seeds]),
            safe_amount,
        )?;

        ctx.accounts.vault.total_free_supply = ctx.accounts.vault.total_free_supply
            .checked_sub(safe_amount).ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.vault.total_put_supply = ctx.accounts.vault.total_put_supply
            .checked_add(safe_amount).ok_or(ErrorCode::MathOverflow)?;

        msg!("Redeposit: {} X1SAFE → {} X1SAFE_PUT", safe_amount, safe_amount);
        Ok(())
    }

    // 10. Stake X1SAFE_FREE → receive sX1SAFE (1:1)
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        update_reward_per_token(&mut ctx.accounts.stake_pool)?;

        let earned    = calc_earned(&ctx.accounts.user_stake, &ctx.accounts.stake_pool)?;
        let pool_bump = ctx.accounts.stake_pool.bump;
        let pool_sx_bump = ctx.accounts.stake_pool.sx1safe_mint_bump;
        let _ = pool_sx_bump;

        if ctx.accounts.user_stake.user == Pubkey::default() {
            ctx.accounts.user_stake.user = ctx.accounts.user.key();
            ctx.accounts.user_stake.bump = ctx.bumps.user_stake;
        }
        ctx.accounts.user_stake.rewards_pending       = earned;
        ctx.accounts.user_stake.reward_per_token_paid = ctx.accounts.stake_pool.reward_per_token_stored;
        ctx.accounts.user_stake.staked_amount = ctx.accounts.user_stake.staked_amount
            .checked_add(amount).ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.stake_pool.total_staked = ctx.accounts.stake_pool.total_staked
            .checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        let pool_ai      = ctx.accounts.stake_pool.to_account_info();
        let tok_prog_ai  = ctx.accounts.token_program.to_account_info();
        let user_xs_ai   = ctx.accounts.user_x1safe.to_account_info();
        let stake_res_ai = ctx.accounts.stake_reserve.to_account_info();
        let user_ai      = ctx.accounts.user.to_account_info();
        let sx_mint_ai   = ctx.accounts.sx1safe_mint.to_account_info();
        let user_sx_ai   = ctx.accounts.user_sx1safe.to_account_info();

        token::transfer(
            CpiContext::new(tok_prog_ai.clone(), Transfer {
                from: user_xs_ai, to: stake_res_ai, authority: user_ai,
            }),
            amount,
        )?;

        let seeds: &[&[u8]] = &[b"stake_pool", &[pool_bump]];
        token::mint_to(
            CpiContext::new_with_signer(tok_prog_ai, MintTo {
                mint: sx_mint_ai, to: user_sx_ai, authority: pool_ai,
            }, &[seeds]),
            amount,
        )?;

        msg!("Staked {} X1SAFE", amount);
        Ok(())
    }

    // 11. Unstake: burn sX1SAFE → return X1SAFE + rewards
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            ctx.accounts.user_stake.staked_amount >= amount,
            ErrorCode::InsufficientFunds
        );

        update_reward_per_token(&mut ctx.accounts.stake_pool)?;

        let earned    = calc_earned(&ctx.accounts.user_stake, &ctx.accounts.stake_pool)?;
        let pool_bump = ctx.accounts.stake_pool.bump;

        ctx.accounts.user_stake.reward_per_token_paid = ctx.accounts.stake_pool.reward_per_token_stored;
        ctx.accounts.user_stake.rewards_pending = earned;
        ctx.accounts.user_stake.staked_amount = ctx.accounts.user_stake.staked_amount
            .checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;

        let rewards_to_pay = ctx.accounts.user_stake.rewards_pending;
        ctx.accounts.user_stake.rewards_pending = 0;
        ctx.accounts.user_stake.rewards_claimed = ctx.accounts.user_stake.rewards_claimed
            .checked_add(rewards_to_pay).ok_or(ErrorCode::MathOverflow)?;

        ctx.accounts.stake_pool.total_staked = ctx.accounts.stake_pool.total_staked
            .checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;

        let pool_ai       = ctx.accounts.stake_pool.to_account_info();
        let tok_prog_ai   = ctx.accounts.token_program.to_account_info();
        let sx_mint_ai    = ctx.accounts.sx1safe_mint.to_account_info();
        let user_sx_ai    = ctx.accounts.user_sx1safe.to_account_info();
        let stake_res_ai  = ctx.accounts.stake_reserve.to_account_info();
        let reward_res_ai = ctx.accounts.reward_reserve.to_account_info();
        let user_xs_ai    = ctx.accounts.user_x1safe.to_account_info();
        let user_ai       = ctx.accounts.user.to_account_info();

        let seeds: &[&[u8]] = &[b"stake_pool", &[pool_bump]];

        // Burn sX1SAFE
        token::burn(
            CpiContext::new(tok_prog_ai.clone(), Burn {
                mint: sx_mint_ai, from: user_sx_ai, authority: user_ai,
            }),
            amount,
        )?;

        // Return principal
        token::transfer(
            CpiContext::new_with_signer(tok_prog_ai.clone(), Transfer {
                from: stake_res_ai, to: user_xs_ai.clone(), authority: pool_ai.clone(),
            }, &[seeds]),
            amount,
        )?;

        // Pay rewards
        if rewards_to_pay > 0 {
            let reward_bal = ctx.accounts.reward_reserve.amount;
            let actual_pay = rewards_to_pay.min(reward_bal);
            if actual_pay > 0 {
                token::transfer(
                    CpiContext::new_with_signer(tok_prog_ai, Transfer {
                        from: reward_res_ai, to: user_xs_ai, authority: pool_ai,
                    }, &[seeds]),
                    actual_pay,
                )?;
            }
        }

        msg!("Unstaked {} X1SAFE + {} rewards", amount, rewards_to_pay);
        Ok(())
    }

    // 12. Claim rewards without unstaking
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        update_reward_per_token(&mut ctx.accounts.stake_pool)?;

        let earned    = calc_earned(&ctx.accounts.user_stake, &ctx.accounts.stake_pool)?;
        let pool_bump = ctx.accounts.stake_pool.bump;

        require!(earned > 0, ErrorCode::InsufficientFunds);

        ctx.accounts.user_stake.rewards_pending       = 0;
        ctx.accounts.user_stake.reward_per_token_paid = ctx.accounts.stake_pool.reward_per_token_stored;
        ctx.accounts.user_stake.rewards_claimed = ctx.accounts.user_stake.rewards_claimed
            .checked_add(earned).ok_or(ErrorCode::MathOverflow)?;

        let pool_ai       = ctx.accounts.stake_pool.to_account_info();
        let tok_prog_ai   = ctx.accounts.token_program.to_account_info();
        let reward_res_ai = ctx.accounts.reward_reserve.to_account_info();
        let user_xs_ai    = ctx.accounts.user_x1safe.to_account_info();

        let reserve_bal = ctx.accounts.reward_reserve.amount;
        let actual_pay  = earned.min(reserve_bal);
        require!(actual_pay > 0, ErrorCode::InsufficientFunds);

        let seeds: &[&[u8]] = &[b"stake_pool", &[pool_bump]];
        token::transfer(
            CpiContext::new_with_signer(tok_prog_ai, Transfer {
                from: reward_res_ai, to: user_xs_ai, authority: pool_ai,
            }, &[seeds]),
            actual_pay,
        )?;

        msg!("Claimed {} X1SAFE rewards", actual_pay);
        Ok(())
    }

    // 13. Keeper deposits yield into reward_reserve
    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let caller = ctx.accounts.caller.key();
        require!(
            caller == ctx.accounts.vault.authority || caller == ctx.accounts.vault.keeper,
            ErrorCode::Unauthorized
        );

        let tok_prog_ai   = ctx.accounts.token_program.to_account_info();
        let source_ai     = ctx.accounts.source.to_account_info();
        let reward_res_ai = ctx.accounts.reward_reserve.to_account_info();
        let caller_ai     = ctx.accounts.caller.to_account_info();

        token::transfer(
            CpiContext::new(tok_prog_ai, Transfer {
                from: source_ai, to: reward_res_ai, authority: caller_ai,
            }),
            amount,
        )?;

        ctx.accounts.stake_pool.undistributed_rewards = ctx.accounts.stake_pool.undistributed_rewards
            .checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        msg!("Deposited {} rewards", amount);
        Ok(())
    }

    // 14/15. Pause / unpause
    pub fn pause_vault(ctx: Context<AdminVault>) -> Result<()> {
        ctx.accounts.vault.paused = true;
        Ok(())
    }

    pub fn unpause_vault(ctx: Context<AdminVault>) -> Result<()> {
        ctx.accounts.vault.paused = false;
        Ok(())
    }
}

// ── Contexts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultState::SIZE,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMints<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        init, payer = authority,
        seeds = [b"put_mint"], bump,
        mint::decimals = 6,
        mint::authority = vault,
    )]
    pub put_mint: Account<'info, Mint>,

    #[account(
        init, payer = authority,
        seeds = [b"safe_mint"], bump,
        mint::decimals = 6,
        mint::authority = vault,
    )]
    pub safe_mint: Account<'info, Mint>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitStakePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"vault"], bump = vault.bump,
        constraint = vault.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        init, payer = authority,
        space = 8 + StakePool::SIZE,
        seeds = [b"stake_pool"], bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    #[account(seeds = [b"safe_mint"], bump = vault.safe_mint_bump)]
    pub safe_mint: Account<'info, Mint>,

    #[account(
        init, payer = authority,
        seeds = [b"sx1safe_mint"], bump,
        mint::decimals = 6,
        mint::authority = stake_pool,
    )]
    pub sx1safe_mint: Account<'info, Mint>,

    #[account(
        init, payer = authority,
        seeds = [b"stake_reserve"], bump,
        token::mint = safe_mint,
        token::authority = stake_pool,
    )]
    pub stake_reserve: Account<'info, TokenAccount>,

    #[account(
        init, payer = authority,
        seeds = [b"reward_reserve"], bump,
        token::mint = safe_mint,
        token::authority = stake_pool,
    )]
    pub reward_reserve: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddAsset<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"vault"], bump = vault.bump,
        constraint = vault.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,

    pub asset_mint: Account<'info, Mint>,

    #[account(
        init, payer = authority,
        space = 8 + AssetConfig::SIZE,
        seeds = [b"asset", asset_mint.key().as_ref()], bump,
    )]
    pub asset_config: Account<'info, AssetConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub caller: Signer<'info>,

    #[account(seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"asset", asset_config.mint.as_ref()], bump,
    )]
    pub asset_config: Account<'info, AssetConfig>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"asset", asset_config.mint.as_ref()], bump,
    )]
    pub asset_config: Account<'info, AssetConfig>,

    /// Reserve ATA: ATA(assetMint, vault) — created by client before first deposit
    #[account(
        mut,
        token::mint = asset_config.mint,
        token::authority = vault,
    )]
    pub reserve_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = asset_config.mint,
        token::authority = user,
    )]
    pub user_asset_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"put_mint"], bump = vault.put_mint_bump)]
    pub put_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = put_mint,
        token::authority = user,
    )]
    pub user_put_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::SIZE,
        seeds = [b"position", user.key().as_ref()], bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(mut, seeds = [b"put_mint"], bump = vault.put_mint_bump)]
    pub put_mint: Account<'info, Mint>,

    #[account(mut, seeds = [b"safe_mint"], bump = vault.safe_mint_bump)]
    pub safe_mint: Account<'info, Mint>,

    #[account(mut, token::mint = put_mint, token::authority = user)]
    pub user_put_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = safe_mint, token::authority = user)]
    pub user_safe_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", user.key().as_ref()], bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Exit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(mut, seeds = [b"safe_mint"], bump = vault.safe_mint_bump)]
    pub safe_mint: Account<'info, Mint>,

    #[account(mut, token::mint = safe_mint, token::authority = user)]
    pub user_safe_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Redeposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(mut, seeds = [b"safe_mint"], bump = vault.safe_mint_bump)]
    pub safe_mint: Account<'info, Mint>,

    #[account(mut, seeds = [b"put_mint"], bump = vault.put_mint_bump)]
    pub put_mint: Account<'info, Mint>,

    #[account(mut, token::mint = safe_mint, token::authority = user)]
    pub user_safe_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = put_mint, token::authority = user)]
    pub user_put_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"stake_pool"], bump = stake_pool.bump)]
    pub stake_pool: Account<'info, StakePool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStake::SIZE,
        seeds = [b"user_stake", user.key().as_ref()], bump,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(mut, seeds = [b"sx1safe_mint"], bump = stake_pool.sx1safe_mint_bump)]
    pub sx1safe_mint: Account<'info, Mint>,

    /// User's X1SAFE (free) token account — tokens being staked
    #[account(mut, token::authority = user)]
    pub user_x1safe: Account<'info, TokenAccount>,

    /// User's sX1SAFE ATA — receives receipt tokens
    #[account(mut, token::mint = sx1safe_mint, token::authority = user)]
    pub user_sx1safe: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"stake_reserve"], bump, token::authority = stake_pool)]
    pub stake_reserve: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"stake_pool"], bump = stake_pool.bump)]
    pub stake_pool: Account<'info, StakePool>,

    #[account(mut, seeds = [b"user_stake", user.key().as_ref()], bump = user_stake.bump)]
    pub user_stake: Account<'info, UserStake>,

    #[account(mut, seeds = [b"sx1safe_mint"], bump = stake_pool.sx1safe_mint_bump)]
    pub sx1safe_mint: Account<'info, Mint>,

    /// User's X1SAFE (free) — receives returned principal + rewards
    #[account(mut, token::authority = user)]
    pub user_x1safe: Account<'info, TokenAccount>,

    #[account(mut, token::mint = sx1safe_mint, token::authority = user)]
    pub user_sx1safe: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"stake_reserve"], bump, token::authority = stake_pool)]
    pub stake_reserve: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"reward_reserve"], bump, token::authority = stake_pool)]
    pub reward_reserve: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"stake_pool"], bump = stake_pool.bump)]
    pub stake_pool: Account<'info, StakePool>,

    #[account(mut, seeds = [b"user_stake", user.key().as_ref()], bump = user_stake.bump)]
    pub user_stake: Account<'info, UserStake>,

    #[account(mut, token::authority = user)]
    pub user_x1safe: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"reward_reserve"], bump, token::authority = stake_pool)]
    pub reward_reserve: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    pub caller: Signer<'info>,

    #[account(seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,

    #[account(mut, seeds = [b"stake_pool"], bump = stake_pool.bump)]
    pub stake_pool: Account<'info, StakePool>,

    #[account(mut, token::authority = caller)]
    pub source: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"reward_reserve"], bump, token::authority = stake_pool)]
    pub reward_reserve: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminVault<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"vault"], bump = vault.bump)]
    pub vault: Account<'info, VaultState>,
}

// ── State ─────────────────────────────────────────────────────────────────────

#[account]
pub struct VaultState {
    pub authority:         Pubkey, // 32
    pub bump:              u8,     // 1
    pub paused:            bool,   // 1
    pub x1safe_put_mint:   Pubkey, // 32
    pub put_mint_bump:     u8,     // 1
    pub x1safe_safe_mint:  Pubkey, // 32
    pub safe_mint_bump:    u8,     // 1
    pub total_put_supply:  u64,    // 8
    pub total_free_supply: u64,    // 8
    pub keeper:            Pubkey, // 32
}

impl VaultState {
    pub const SIZE: usize = 32 + 1 + 1 + 32 + 1 + 32 + 1 + 8 + 8 + 32; // 148
}

#[account]
pub struct AssetConfig {
    pub mint:            Pubkey, // 32
    pub decimals:        u8,     // 1
    pub is_fixed_price:  bool,   // 1
    pub price_usd:       u64,    // 8  (× 10^6)
    pub reserve_balance: u64,    // 8
}

impl AssetConfig {
    pub const SIZE: usize = 32 + 1 + 1 + 8 + 8; // 50
}

#[account]
pub struct UserPosition {
    pub user:        Pubkey, // 32
    pub bump:        u8,     // 1
    pub put_balance: u64,    // 8
}

impl UserPosition {
    pub const SIZE: usize = 32 + 1 + 8; // 41
}

#[account]
pub struct StakePool {
    pub authority:               Pubkey, // 32
    pub bump:                    u8,     // 1
    pub sx1safe_mint:            Pubkey, // 32
    pub sx1safe_mint_bump:       u8,     // 1
    pub total_staked:            u64,    // 8
    pub reward_per_token_stored: u128,   // 16
    pub undistributed_rewards:   u64,    // 8
    pub apy_bps:                 u16,    // 2
}

impl StakePool {
    pub const SIZE: usize = 32 + 1 + 32 + 1 + 8 + 16 + 8 + 2; // 100
}

#[account]
pub struct UserStake {
    pub user:                  Pubkey, // 32
    pub bump:                  u8,     // 1
    pub staked_amount:         u64,    // 8
    pub reward_per_token_paid: u128,   // 16
    pub rewards_pending:       u64,    // 8
    pub rewards_claimed:       u64,    // 8
}

impl UserStake {
    pub const SIZE: usize = 32 + 1 + 8 + 16 + 8 + 8; // 73
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Invalid oracle price")]
    InvalidOraclePrice,
    #[msg("Asset uses fixed price")]
    FixedPriceAsset,
}
