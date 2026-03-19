use anchor_lang::prelude::*;

/// User position for a specific token
#[account]
pub struct UserPosition {
    /// Position owner
    pub owner: Pubkey,
    
    /// Token mint this position is for
    pub token_mint: Pubkey,
    
    /// Amount of original token deposited
    pub deposited_amount: u64,
    
    /// Amount of X1SAFE-PUT minted (represents USD value at deposit)
    pub x1safe_put_amount: u64,
    
    /// Lock start timestamp
    pub lock_start: i64,
    
    /// Lock end timestamp
    pub lock_end: i64,
    
    /// Lock duration in days
    pub lock_days: u16,
    
    /// Whether position is still locked
    pub is_locked: bool,
    
    /// USD value at deposit time (scaled by 1e6)
    pub deposit_value_usd: u64,
    
    /// Accumulated USDC.X fees (claimable immediately)
    pub accrued_usdc_fees: u64,
    
    /// Accumulated X1SAFE rewards (subject to vesting)
    pub accrued_x1safe_rewards: u64,
    
    /// Total USDC.X fees claimed
    pub total_usdc_claimed: u64,
    
    /// Total X1SAFE rewards claimed
    pub total_x1safe_claimed: u64,
    
    /// Whether position is active
    pub active: bool,
    
    /// Bump seed
    pub bump: u8,
    
    /// Reserved
    pub reserved: [u8; 16],
}

impl UserPosition {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        32 + // token_mint
        8 +  // deposited_amount
        8 +  // x1safe_put_amount
        8 +  // lock_start
        8 +  // lock_end
        2 +  // lock_days
        1 +  // is_locked
        8 +  // deposit_value_usd
        8 +  // accrued_usdc_fees
        8 +  // accrued_x1safe_rewards
        8 +  // total_usdc_claimed
        8 +  // total_x1safe_claimed
        1 +  // active
        1 +  // bump
        16;  // reserved
    
    /// Check if lock period has ended
    pub fn is_lock_ended(&self, current_time: i64) -> bool {
        current_time >= self.lock_end
    }
    
    /// Calculate remaining lock time
    pub fn remaining_lock_time(&self, current_time: i64) -> i64 {
        if current_time >= self.lock_end {
            0
        } else {
            self.lock_end - current_time
        }
    }
    
    /// Calculate lock progress percentage (0-100)
    pub fn lock_progress(&self, current_time: i64) -> u8 {
        if current_time >= self.lock_end {
            100
        } else if current_time <= self.lock_start {
            0
        } else {
            let total_duration = self.lock_end - self.lock_start;
            let elapsed = current_time - self.lock_start;
            ((elapsed as u128 * 100) / total_duration as u128) as u8
        }
    }
    
    /// Accrue USDC.X fees
    pub fn accrue_usdc_fees(&mut self, amount: u64) -> Option<()> {
        self.accrued_usdc_fees = self.accrued_usdc_fees.checked_add(amount)?;
        Some(())
    }
    
    /// Accrue X1SAFE rewards
    pub fn accrue_x1safe_rewards(&mut self, amount: u64) -> Option<()> {
        self.accrued_x1safe_rewards = self.accrued_x1safe_rewards.checked_add(amount)?;
        Some(())
    }
    
    /// Claim USDC.X fees
    pub fn claim_usdc_fees(&mut self) -> Option<u64> {
        let amount = self.accrued_usdc_fees;
        if amount == 0 {
            return None;
        }
        self.accrued_usdc_fees = 0;
        self.total_usdc_claimed = self.total_usdc_claimed.checked_add(amount)?;
        Some(amount)
    }
    
    /// Get claimable USDC.X fees
    pub fn get_claimable_usdc(&self) -> u64 {
        self.accrued_usdc_fees
    }
}