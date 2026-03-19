# X1SAFU Specification

## 1. Token Design

### X1SAFE Token
- **Symbol**: X1SAFE
- **Type**: SPL Token (Fungible)
- **Decimals**: 6
- **Initial Supply**: 1,000,000,000 (pre-minted)
- **Mint Authority**: Program PDA (vault)
- **Freeze Authority**: None

### Economic Model
- **Deposit Rate**: Fixed 1:1 with USD value
- **Deflationary**: Supply decreases on Exit (burn)
- **No Inflation**: No new minting beyond initial supply
- **Target TVL**: $1,000,000

## 2. Actions Detailed

### 2.1 DEPOSIT
```
Input: User sends backing asset (USDC.X, XEN, XNT, XNM)
Process:
  1. Get current price from oracle
  2. Calculate USD value: amount * price
  3. Transfer asset from user to vault
  4. Mint X1SAFE to user (1:1 USD value)
  5. Create UserPosition with exit_rights=true
Output: X1SAFE tokens + exit rights
```

### 2.2 SELL
```
Note: SELL happens on xDEX, not in this contract
User sells X1SAFE on open market
Loses X1SAFE, receives tokens
No interaction with X1SAFU program
```

### 2.3 EXIT
```
Input: User calls exit() with X1SAFE tokens
Process:
  1. Verify user has exit_rights
  2. Verify X1SAFE balance >= deposit_value
  3. Burn X1SAFE to 11111111111111111111111111111111
  4. Transfer original backing asset to user
  5. Revoke exit_rights
  6. Close UserPosition
Output: Original backing asset, X1SAFE burned
```

### 2.4 WITHDRAW
```
Input: User calls withdraw(amount)
Process:
  1. Verify amount <= X1SAFE balance
  2. Revoke exit_rights
  3. (Token already in user wallet - no transfer needed)
Output: exit_rights revoked, can only SELL
```

## 3. Oracle Integration

### Price Feeds
Source: xDEX API or on-chain oracle

```rust
fn get_oracle_price(asset: &AssetType) -> Result<u64> {
    match asset {
        AssetType::USDC => Ok(1_000_000),      // $1.00
        AssetType::XEN  => Ok(1_000_000),      // $0.01
        AssetType::XNT  => Ok(50_000_000),   // $0.50
        AssetType::XNM  => Ok(10_000_000),   // $0.10
    }
}
```

### Price Precision
- All prices in USD cents * 10^6
- $1.00 = 100_000_000
- Allows 6 decimal precision

## 4. Account Structure

### VaultState
```rust
pub struct VaultState {
    pub authority: Pubkey,          // 32 bytes
    pub total_tvl: u64,             // 8 bytes
    pub x1safe_mint: Pubkey,        // 32 bytes
    pub usdc_mint: Pubkey,          // 32 bytes
    pub xen_mint: Pubkey,           // 32 bytes
    pub xnt_mint: Pubkey,           // 32 bytes
    pub xnm_mint: Pubkey,           // 32 bytes
}
// Total: 200 bytes
```

### UserPosition
```rust
pub struct UserPosition {
    pub owner: Pubkey,              // 32 bytes
    pub deposit_value_usd: u64,     // 8 bytes
    pub exit_rights: bool,          // 1 byte
    pub backing_asset: AssetType,   // 1 byte
    pub backing_amount: u64,        // 8 bytes
}
// Total: 50 bytes
```

## 5. Program Flow

### Initialization Flow
1. Deploy program
2. Call initialize()
3. Set up token mints
4. Fund vault with initial liquidity (if needed)

### User Flow
```
Deposit Flow:
User -> Select Asset -> Enter Amount -> Approve TX -> Receive X1SAFE
                                      |-> Asset Transferred to Vault
                                      |-> X1SAFE Minted
                                      |-> Position Created

Exit Flow:
User -> Click Exit -> Approve TX -> X1SAFE Burned -> Asset Returned
                                    |-> Position Closed

Withdraw Flow:
User -> Click Withdraw -> Enter Amount -> Approve TX -> Rights Revoked
```

## 6. Edge Cases

### Insufficient Liquidity
- Contract maintains 1:1 backing at all times
- Exit only fails if vault has no assets (shouldn't happen with proper backing)

### Price Oracle Failure
- Fallback to last known price
- Maximum 1% price deviation allowed
- Circuit breaker for >5% deviation

### Partial Exit
- Not supported (full position exit only)
- Users can deposit smaller amounts for flexibility

## 7. Integration Points

### xDEX
- X1SAFE tradable on xDEX pools
- Price discovery through AMM
- No direct contract integration (secondary market)

### Wallets
- Phantom
- Solflare
- X1 Wallet

### Block Explorers
- https://explorer.mainnet.x1.xyz

## 8. Future Improvements

- [ ] Multi-asset deposits (single TX)
- [ ] Partial exit support
- [ ] Yield generation on idle assets
- [ ] Governance token for protocol fees
- [ ] Insurance fund for black swan events

## 9. Changelog

### v0.1.0 (Initial)
- Basic deposit/exit/withdraw
- Single asset deposits
- Fixed oracle prices (placeholder)
- React frontend

---

Spec version: 1.0
Last updated: 2026-03-11