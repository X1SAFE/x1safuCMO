use anchor_lang::prelude::*;

/// Stake account for earning rewards
#[account]
pub struct StakeAccount {
    /// Stake owner
    pub owner: Pubkey,
    
    /// Amount of X1SAFE-PUT staked
    pub amount_staked: u64,
    
    /// Timestamp when stake was created
    pub entry_timestamp: i64,
    
    /// Last claim timestamp
    pub last_claim_timestamp: i64,
    
    /// Reward index at entry (for calculating rewards)
    pub reward_index_entry: u128,
    
    /// Accumulated but unclaimed USDC.X rewards
    pub pending_usdc_rewards: u64,
    
    /// Accumulated but unclaimed X1SAFE rewards
    pub pending_x1safe_rewards: u64,
    
    /// Total USDC.X rewards claimed
    pub total_usdc_claimed: u64,
    
    /// Total X1SAFE rewards claimed
    pub total_x1safe_claimed: u64,
    
    /// Whether stake is active
    pub active: bool,
    
    /// Bump seed
    pub bump: u8,
    
    /// Reserved
    pub reserved: [u8; 16],
}

impl StakeAccount {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        8 +  // amount_staked
        8 +  // entry_timestamp
        8 +  // last_claim_timestamp
        16 + // reward_index_entry
        8 +  // pending_usdc_rewards
        8 +  // pending_x1safe_rewards
        8 +  // total_usdc_claimed
        8 +  // total_x1safe_claimed
        1 +  // active
        1 +  // bump
        16;  // reserved
    
    /// Calculate rewards based on stake amount and time
    pub fn calculate_rewards(
        &self,
        current_time: i64,
        reward_rate_per_second: u64,
    ) -> Option<(u64, u64)> {
        let duration = current_time.checked_sub(self.last_claim_timestamp)?;
        if duration <= 0 {
            return Some((0, 0));
        }
        
        // Calculate share of rewards based on stake amount
        // This is simplified - actual implementation would use global reward index
        let total_rewards = (self.amount_staked as u128)
            .checked_mul(reward_rate_per_second as u128)?
            .checked_mul(duration as u128)?
            .checked_div(1_000_000)?; // Scale factor
            
        // Split: 50% USDC.X, 50% X1SAFE (simplified - actual split from fee pool)
        let usdc_rewards = (total_rewards / 2) as u64;
        let x1safe_rewards = (total_rewards / 2) as u64;
        
        Some((usdc_rewards, x1safe_rewards))
    }
    
    /// Update pending rewards
    pub fn update_pending_rewards(
        &mut self,
        usdc_amount: u64,
        x1safe_amount: u64,
    ) -> Option<()> {
        self.pending_usdc_rewards = self.pending_usdc_rewards.checked_add(usdc_amount)?;
        self.pending_x1safe_rewards = self.pending_x1safe_rewards.checked_add(x1safe_amount)?;
        Some(())
    }
    
    /// Claim pending USDC.X rewards
    pub fn claim_pending_usdc(&mut self) -> Option<u64> {
        let amount = self.pending_usdc_rewards;
        if amount == 0 {
            return None;
        }
        self.pending_usdc_rewards = 0;
        self.total_usdc_claimed = self.total_usdc_claimed.checked_add(amount)?;
        Some(amount)
    }
    
    /// Claim pending X1SAFE rewards
    pub fn claim_pending_x1safe(&mut self) -> Option<u64> {
        let amount = self.pending_x1safe_rewards;
        if amount == 0 {
            return None;
        }
        self.pending_x1safe_rewards = 0;
        self.total_x1safe_claimed = self.total_x1safe_claimed.checked_add(amount)?;
        Some(amount)
    }
    
    /// Get pending rewards
    pub fn get_pending_rewards(&self,
    ) -> (u64, u64) {
        (self.pending_usdc_rewards, self.pending_x1safe_rewards)
    }
}