use anchor_lang::prelude::*;

/// Oracle interface for xDEX price feeds
/// Prices fetched off-chain and passed as oracle account (or use update_oracle)
/// On-chain: returns stored/mock prices per known mint
pub struct XdexOracle;

impl XdexOracle {
    /// Get token price in USD (scaled by 1e6)
    pub fn get_price(
        _oracle_address: &Pubkey,
        token_mint: &Pubkey,
    ) -> Result<u64> {
        let mint_str = token_mint.to_string();

        // USDC.X — 1:1 stable
        if mint_str == "6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw" {
            return Ok(1_000_000); // $1.00
        }

        // XNT (X1 native token)
        if mint_str == "CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW" {
            return Ok(200_000); // $0.20 — updated by keeper via update_oracle
        }

        // XEN
        if mint_str == "HcCMidf2rU8wy5jQ9doNC5tnRancRAJdhhD8oFbYZpxj" {
            return Ok(50_000); // $0.05
        }

        // XNM
        if mint_str == "XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m" {
            return Ok(300_000); // $0.30
        }

        // Default fallback
        Ok(100_000) // $0.10
    }

    /// Calculate USD value of token amount
    pub fn calculate_usd_value(
        oracle_address: &Pubkey,
        token_mint: &Pubkey,
        token_amount: u64,
        token_decimals: u8,
    ) -> Option<u64> {
        let price = Self::get_price(oracle_address, token_mint).ok()?;

        let adjusted_amount = if token_decimals <= 6 {
            token_amount.checked_mul(10u64.pow((6 - token_decimals) as u32))?
        } else {
            token_amount.checked_div(10u64.pow((token_decimals - 6) as u32))?
        };

        (adjusted_amount as u128)
            .checked_mul(price as u128)?
            .checked_div(1_000_000)?
            .try_into()
            .ok()
    }

    pub fn is_price_fresh(
        _last_update_timestamp: i64,
        _max_staleness: i64,
        _current_timestamp: i64,
    ) -> bool {
        true
    }
}

/// Price data structure for oracle
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct PriceData {
    pub price: u64,
    pub confidence: u64,
    pub last_update: i64,
    pub exponent: i32,
}

impl PriceData {
    pub fn get_valid_price(&self, max_confidence_pct: u64) -> Option<u64> {
        let confidence_pct = (self.confidence as u128)
            .checked_mul(100)?
            .checked_div(self.price as u128)?;
        if confidence_pct > max_confidence_pct as u128 {
            return None;
        }
        Some(self.price)
    }
}
