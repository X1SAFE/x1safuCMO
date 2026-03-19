use anchor_lang::prelude::*;

/// Safe math operations
pub mod safe_math {
    use super::*;
    
    /// Safe multiplication with overflow check
    pub fn safe_mul(a: u64, b: u64) -> Result<u64> {
        a.checked_mul(b).ok_or_else(|| error!(super::super::error::X1safeError::MathOverflow))
    }
    
    /// Safe division with zero check
    pub fn safe_div(a: u64, b: u64) -> Result<u64> {
        if b == 0 {
            return Err(error!(super::super::error::X1safeError::MathOverflow));
        }
        a.checked_div(b).ok_or_else(|| error!(super::super::error::X1safeError::MathOverflow))
    }
    
    /// Safe addition with overflow check
    pub fn safe_add(a: u64, b: u64) -> Result<u64> {
        a.checked_add(b).ok_or_else(|| error!(super::super::error::X1safeError::MathOverflow))
    }
    
    /// Safe subtraction with underflow check
    pub fn safe_sub(a: u64, b: u64) -> Result<u64> {
        a.checked_sub(b).ok_or_else(|| error!(super::super::error::X1safeError::MathOverflow))
    }
}

/// Time utilities
pub mod time {
    /// Convert days to seconds
    pub fn days_to_seconds(days: u16) -> i64 {
        (days as i64).checked_mul(86400).unwrap_or(i64::MAX)
    }
    
    /// Convert seconds to days
    pub fn seconds_to_days(seconds: i64) -> u16 {
        (seconds / 86400).min(u16::MAX as i64) as u16
    }
    
    /// Calculate lock end timestamp
    pub fn calculate_lock_end(start_time: i64, lock_days: u16) -> Option<i64> {
        start_time.checked_add(days_to_seconds(lock_days))
    }
}

/// Fee calculation utilities
pub mod fees {
    /// Calculate fee split
    /// Returns (staker_amount, buyback_amount, treasury_amount)
    pub fn calculate_split(
        total_amount: u64,
        staker_bps: u16,
        buyback_bps: u16,
        treasury_bps: u16,
    ) -> Option<(u64, u64, u64)> {
        let staker_amount = (total_amount as u128)
            .checked_mul(staker_bps as u128)?
            .checked_div(10000)? as u64;
        
        let buyback_amount = (total_amount as u128)
            .checked_mul(buyback_bps as u128)?
            .checked_div(10000)? as u64;
        
        let treasury_amount = (total_amount as u128)
            .checked_mul(treasury_bps as u128)?
            .checked_div(10000)? as u64;
        
        Some((staker_amount, buyback_amount, treasury_amount))
    }
}

/// PDA seeds utilities
pub mod seeds {
    pub const VAULT_STATE: &[u8] = b"vault_state";
    pub const USER_POSITION: &[u8] = b"user_position";
    pub const STAKE_ACCOUNT: &[u8] = b"stake_account";
    pub const VESTING_SCHEDULE: &[u8] = b"vesting_schedule";
    pub const SUPPORTED_TOKEN: &[u8] = b"supported_token";
    pub const TOKEN_VAULT: &[u8] = b"token_vault";
    pub const REWARD_POOL: &[u8] = b"reward_pool";
}