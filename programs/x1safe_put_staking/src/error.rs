use anchor_lang::prelude::*;

#[error_code]
pub enum X1safeError {
    #[msg("Invalid lock period: must be between 1 and 360 days")]
    InvalidLockPeriod,
    
    #[msg("Lock period not ended yet")]
    LockNotEnded,
    
    #[msg("Token not supported")]
    TokenNotSupported,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("No rewards available")]
    NoRewardsAvailable,
    
    #[msg("Vesting not started")]
    VestingNotStarted,
    
    #[msg("Vesting incomplete")]
    VestingIncomplete,
    
    #[msg("Invalid oracle data")]
    InvalidOracleData,
    
    #[msg("Oracle price stale")]
    OraclePriceStale,
    
    #[msg("Math overflow")]
    MathOverflow,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Vault already initialized")]
    VaultAlreadyInitialized,
    
    #[msg("No stake found")]
    NoStakeFound,
    
    #[msg("Stake still locked")]
    StakeStillLocked,
    
    #[msg("Invalid fee split")]
    InvalidFeeSplit,
    
    #[msg("Treasury not set")]
    TreasuryNotSet,
    
    #[msg("Reward pool not set")]
    RewardPoolNotSet,
    
    #[msg("Position not found")]
    PositionNotFound,
    
    #[msg("Vesting schedule not found")]
    VestingNotFound,
    
    #[msg("All phases claimed")]
    AllPhasesClaimed,
    
    #[msg("Phase not yet available")]
    PhaseNotAvailable,
}