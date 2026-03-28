use anchor_lang::prelude::*;

/// Main vault state account
#[account]
pub struct VaultState {
    /// Authority that can manage the vault
    pub authority: Pubkey,
    
    /// Treasury address for fee collection (20%)
    pub treasury: Pubkey,
    
    /// Fee pool for staker rewards (60%)
    pub fee_pool: Pubkey,
    
    /// X1SAFE mint address
    pub x1safe_mint: Pubkey,
    
    /// X1SAFE-PUT mint address
    pub x1safe_put_mint: Pubkey,
    
    /// USDC.X mint address for fee distribution
    pub usdc_mint: Pubkey,
    
    /// Number of supported tokens
    pub supported_tokens_count: u8,
    
    /// Total value locked in USD (scaled by 1e6)
    pub total_tvl_usd: u64,
    
    /// Total X1SAFE-PUT in circulation
    pub total_x1safe_put_supply: u64,
    
    /// Total X1SAFE staked
    pub total_staked: u64,
    
    /// Fee split percentages (basis points: 60% = 6000)
    pub staker_fee_share: u16,    // 6000 = 60%
    pub buyback_fee_share: u16,   // 2000 = 20%
    pub treasury_fee_share: u16,  // 2000 = 20%
    
    /// X1SAFE peg value: 1 X1SAFE = $0.01 (scaled by 1e6 = 10_000)
    pub x1safe_price_usd: u64,

    /// Annual Percentage Yield in basis points (e.g. 1000 = 10% APY)
    /// Used by accrue_rewards to compute per-second X1SAFE rewards
    pub apy_bps: u16,
    
    /// Bump seed for PDA
    pub bump: u8,
    
    /// Whether vault is paused
    pub paused: bool,
    
    /// Reserved for future use
    pub reserved: [u8; 30],
}

impl VaultState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // treasury
        32 + // fee_pool
        32 + // x1safe_mint
        32 + // x1safe_put_mint
        32 + // usdc_mint
        1 +  // supported_tokens_count
        8 +  // total_tvl_usd
        8 +  // total_x1safe_put_supply
        8 +  // total_staked
        2 +  // staker_fee_share
        2 +  // buyback_fee_share
        2 +  // treasury_fee_share
        8 +  // x1safe_price_usd
        2 +  // apy_bps
        1 +  // bump
        1 +  // paused
        30;  // reserved
    
    /// Validate fee split adds up to 100%
    pub fn validate_fee_split(&self) -> bool {
        self.staker_fee_share + self.buyback_fee_share + self.treasury_fee_share == 10000
    }
    
    /// Calculate X1SAFE amount from USD value
    /// 1 X1SAFE = $0.01, so $1 = 100 X1SAFE
    pub fn usd_to_x1safe(&self, usd_amount: u64) -> Option<u64> {
        // usd_amount is in 1e6 (micro USD)
        // x1safe_price_usd is 10_000 (0.01 * 1e6)
        // Result should be in X1SAFE token amount
        usd_amount.checked_mul(100) // $1 = 100 X1SAFE at $0.01 each
    }
    
    /// Calculate USD value from X1SAFE amount
    pub fn x1safe_to_usd(&self, x1safe_amount: u64) -> Option<u64> {
        // x1safe_amount * 0.01 USD
        x1safe_amount.checked_mul(self.x1safe_price_usd)?.checked_div(1_000_000)
    }
}

/// Supported token configuration
#[account]
pub struct SupportedToken {
    /// Token mint address
    pub mint: Pubkey,
    
    /// Whether this is a stablecoin (fixed 1:1 pricing)
    pub is_stable: bool,
    
    /// Oracle address for price feed (if not stable)
    pub oracle: Pubkey,
    
    /// Token vault (holds deposited tokens)
    pub token_vault: Pubkey,
    
    /// Total deposited amount
    pub total_deposited: u64,
    
    /// Decimals
    pub decimals: u8,
    
    /// Whether token is active
    pub active: bool,
    
    /// Bump
    pub bump: u8,
}

impl SupportedToken {
    pub const LEN: usize = 8 + // discriminator
        32 + // mint
        1 +  // is_stable
        32 + // oracle
        32 + // token_vault
        8 +  // total_deposited
        1 +  // decimals
        1 +  // active
        1;   // bump
}