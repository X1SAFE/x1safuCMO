use anchor_lang::prelude::*;

/// Vesting schedule for X1SAFE rewards
/// 6 phases × 7 days = 42 days total
/// Each phase unlocks 16.67%
#[account]
pub struct VestingSchedule {
    /// Schedule owner
    pub owner: Pubkey,
    
    /// Total X1SAFE amount to be vested
    pub total_amount: u64,
    
    /// Amount already released/claimed
    pub released_amount: u64,
    
    /// Vesting start timestamp
    pub start_timestamp: i64,
    
    /// Current phase (0-5, 6 means fully vested)
    pub current_phase: u8,
    
    /// Phase duration in seconds (7 days = 604800)
    pub phase_duration: i64,
    
    /// Phase details
    pub phases: [VestingPhase; 6],
    
    /// Whether schedule is active
    pub active: bool,
    
    /// Bump seed
    pub bump: u8,
}

impl VestingSchedule {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        8 +  // total_amount
        8 +  // released_amount
        8 +  // start_timestamp
        1 +  // current_phase
        8 +  // phase_duration
        6 * VestingPhase::LEN + // phases
        1 +  // active
        1;   // bump
    
    /// Initialize vesting schedule
    pub fn initialize(
        &mut self,
        owner: Pubkey,
        total_amount: u64,
        start_timestamp: i64,
    ) -> Option<()> {
        self.owner = owner;
        self.total_amount = total_amount;
        self.released_amount = 0;
        self.start_timestamp = start_timestamp;
        self.current_phase = 0;
        self.phase_duration = 604800; // 7 days in seconds
        self.active = true;
        
        // Calculate amount per phase (16.67% = 1/6)
        let phase_amount = total_amount.checked_div(6)?;
        
        for i in 0..6 {
            let phase_start = start_timestamp.checked_add(
                (i as i64).checked_mul(self.phase_duration)?
            )?;
            let phase_end = phase_start.checked_add(self.phase_duration)?;
            
            self.phases[i] = VestingPhase {
                phase_index: i as u8,
                start_time: phase_start,
                end_time: phase_end,
                amount: phase_amount,
                claimed: false,
            };
        }
        
        Some(())
    }
    
    /// Calculate claimable amount at current time
    pub fn calculate_claimable(
        &self,
        current_time: i64,
    ) -> Option<u64> {
        if !self.active || current_time < self.start_timestamp {
            return Some(0);
        }
        
        let mut claimable: u64 = 0;
        
        for phase in &self.phases {
            if phase.claimed {
                continue;
            }
            
            // Phase unlocks linearly over its duration
            if current_time >= phase.end_time {
                // Full phase amount available
                claimable = claimable.checked_add(phase.amount)?;
            } else if current_time >= phase.start_time {
                // Partial phase amount (linear vesting)
                let phase_elapsed = current_time.checked_sub(phase.start_time)? as u64;
                let phase_progress = (phase_elapsed as u128)
                    .checked_mul(phase.amount as u128)?
                    .checked_div(self.phase_duration as u128)?;
                claimable = claimable.checked_add(phase_progress as u64)?;
            }
        }
        
        Some(claimable)
    }
    
    /// Claim available amount
    pub fn claim(
        &mut self,
        current_time: i64,
    ) -> Option<u64> {
        let claimable = self.calculate_claimable(current_time)?;
        
        if claimable == 0 {
            return Some(0);
        }
        
        // Mark phases as claimed
        for phase in &mut self.phases.iter_mut() {
            if phase.claimed {
                continue;
            }
            
            if current_time >= phase.end_time {
                phase.claimed = true;
            }
        }
        
        self.released_amount = self.released_amount.checked_add(claimable)?;
        
        // Update current phase
        self.update_current_phase(current_time);
        
        Some(claimable)
    }
    
    /// Update current phase based on time
    fn update_current_phase(&mut self,
        current_time: i64,
    ) {
        for (i, phase) in self.phases.iter().enumerate() {
            if current_time >= phase.start_time {
                self.current_phase = i as u8 + 1;
            }
        }
    }
    
    /// Check if fully vested
    pub fn is_fully_vested(
        &self,
        current_time: i64,
    ) -> bool {
        if let Some(last_phase) = self.phases.last() {
            current_time >= last_phase.end_time
        } else {
            false
        }
    }
    
    /// Get vesting progress percentage
    pub fn vesting_progress(
        &self,
        current_time: i64,
    ) -> u8 {
        if current_time <= self.start_timestamp {
            return 0;
        }
        
        let total_duration = self.phase_duration * 6;
        let elapsed = current_time - self.start_timestamp;
        
        if elapsed >= total_duration {
            100
        } else {
            ((elapsed as u128 * 100) / total_duration as u128) as u8
        }
    }
}

/// Individual vesting phase
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct VestingPhase {
    /// Phase index (0-5)
    pub phase_index: u8,
    
    /// Phase start timestamp
    pub start_time: i64,
    
    /// Phase end timestamp
    pub end_time: i64,
    
    /// Amount allocated to this phase
    pub amount: u64,
    
    /// Whether this phase has been claimed
    pub claimed: bool,
}

impl VestingPhase {
    pub const LEN: usize = 1 + 8 + 8 + 8 + 1; // 26 bytes
}