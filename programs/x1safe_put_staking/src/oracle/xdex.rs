use anchor_lang::prelude::*;

/// Oracle interface for xDEX price feeds
/// This is a mock interface - actual implementation would integrate with xDEX oracle
pub struct XdexOracle;

impl XdexOracle {
    /// Get token price in USD (scaled by 1e6)
    /// Returns price for 1 token unit
    pub fn get_price(
        _oracle_address: &Pubkey,
        token_mint: &Pubkey,
    ) -> Result<u64> {
        // TODO: Integrate with actual xDEX oracle
        // For now, return mock prices for known tokens
        
        // XNT mock price: $0.50
        if token_mint.to_string() == "xNTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {
            return Ok(500_000); // $0.50 * 1e6
        }
        
        // XEN mock price: $0.10
        if token_mint.to_string() == "xENxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {
            return Ok(100_000); // $0.10 * 1e6
        }
        
        // XNM mock price: $1.00
        if token_mint.to_string() == "xNMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {
            return Ok(1_000_000); // $1.00 * 1e6
        }
        
        // PURGE mock price: $0.05
        if token_mint.to_string() == "6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP" {
            return Ok(50_000); // $0.05 * 1e6
        }
        
        // THEO mock price: $0.25
        if token_mint.to_string() == "5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS" {
            return Ok(250_000); // $0.25 * 1e6
        }
        
        // AGI mock price: $0.15
        if token_mint.to_string() == "7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER" {
            return Ok(150_000); // $0.15 * 1e6
        }
        
        // PEPE mock price: $0.001
        if token_mint.to_string() == "81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ" {
            return Ok(1_000); // $0.001 * 1e6
        }
        
        // Default fallback price
        Ok(100_000) // $0.10 default
    }
    
    /// Calculate USD value of token amount
    pub fn calculate_usd_value(
        oracle_address: &Pubkey,
        token_mint: &Pubkey,
        token_amount: u64,
        token_decimals: u8,
    ) -> Option<u64> {
        let price = Self::get_price(oracle_address, token_mint).ok()?;
        
        // Adjust for decimals
        let adjusted_amount = if token_decimals <= 6 {
            token_amount.checked_mul(10u64.pow((6 - token_decimals) as u32))?
        } else {
            token_amount.checked_div(10u64.pow((token_decimals - 6) as u32))?
        };
        
        // Calculate USD value: amount * price / 1e6
        (adjusted_amount as u128)
            .checked_mul(price as u128)?
            .checked_div(1_000_000)?
            .try_into()
            .ok()
    }
    
    /// Verify oracle data is fresh (not stale)
    pub fn is_price_fresh(
        _last_update_timestamp: i64,
        _max_staleness: i64,
        _current_timestamp: i64,
    ) -> bool {
        // TODO: Implement actual staleness check
        // For now, always return true
        true
    }
}

/// Price data structure for oracle
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct PriceData {
    /// Price value (scaled by 1e6)
    pub price: u64,
    
    /// Confidence interval (scaled by 1e6)
    pub confidence: u64,
    
    /// Last update timestamp
    pub last_update: i64,
    
    /// Exponent (e.g., -6 for 1e6 scaling)
    pub exponent: i32,
}

impl PriceData {
    /// Get price with confidence check
    pub fn get_valid_price(
        &self,
        max_confidence_pct: u64,
    ) -> Option<u64> {
        let confidence_pct = (self.confidence as u128)
            .checked_mul(100)?
            .checked_div(self.price as u128)?;
        
        if confidence_pct > max_confidence_pct as u128 {
            return None;
        }
        
        Some(self.price)
    }
}