# X1SAFE Protocol — White Paper v1.1

**Date:** March 2026 (updated March 20, 2026)  
**Author:** CMO XEN X1 🐾🐾🐾 (@Prxenx1)  
**Builder:** Theo (@xxen_bot) — Cyberdyne Unlimited LLC  
**Network:** X1 Mainnet / Testnet  
**Program ID:** `F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe`

---

## Abstract

X1SAFE is a multi-asset collateralized vault protocol native to the X1 blockchain. Users deposit supported tokens (USDC.X, XNT, XEN) into a smart contract vault and receive **X1SAFE-PUT** tokens — a synthetic USD-pegged representation of their collateral. PUT tokens can be staked for yield, redeemed 1:1 for X1SAFE tokens, or burned to exit and reclaim original collateral. X1SAFE creates a unified dollar-denominated layer of liquidity across the X1 ecosystem.

---

## 1. Introduction

The X1 blockchain hosts a growing ecosystem of DeFi protocols, validators, and native tokens. However, there is currently no unified stable-value instrument that allows users to hold cross-asset exposure in a single, dollar-denominated wrapper.

X1SAFE addresses this gap with:
- A **non-custodial vault** that accepts multiple collateral types
- A **synthetic USD token** (X1SAFE-PUT) priced at $0.01 per unit
- A **staking module** that generates yield from protocol fees
- A **two-exit system**: redeem for X1SAFE tokens, or exit back to original collateral

---

## 2. Tokens

### 2.1 X1SAFE-PUT
- **Ticker:** PUT  
- **Peg:** $0.01 USD per token  
- **Minted:** On deposit, proportional to USD value of collateral  
- **Burned:** On exit (reclaim collateral) or redeem (receive X1SAFE)  
- **Function:** Synthetic USD receipt token — proof of deposit

### 2.2 X1SAFE
- **Ticker:** X1SAFE  
- **Peg:** $0.01 USD per token  
- **Received:** Via `redeem_x1safe` — burn PUT to receive X1SAFE 1:1  
- **Function:** Liquid, transferable USD-equivalent token within X1 ecosystem

> **Ratio:** 1 X1SAFE-PUT = 1 X1SAFE = $0.01 USD

---

## 3. Supported Collateral

| Asset   | Decimals | Pricing         | Notes                        |
|---------|----------|-----------------|------------------------------|
| USDC.X  | 6        | Fixed $1.00 USD | Bridged USDC on X1           |
| XNT     | 9        | Oracle (xDEX)   | Native X1 token              |
| XEN     | 9        | Oracle (xDEX)   | XEN token on X1              |

Oracle prices sourced from **xDEX API** (`api.xdex.xyz`) with staleness checks and confidence thresholds.

---

## 4. Deposit Mechanics

```
deposit_amount_usd  = token_amount × oracle_price_usd
x1safe_put_minted   = deposit_amount_usd × 100
```

**Example:**
- Deposit 10 XNT @ $0.35/XNT
- USD value = $3.50
- PUT minted = 3.50 × 100 = **350 X1SAFE-PUT**

**Accounts involved:**
1. User wallet
2. Vault PDA (`seeds: ["vault"]`)
3. Asset config PDA (`seeds: ["asset", mint]`)
4. Reserve ATA (vault-controlled token account per asset)
5. User PUT token account
6. User position account (tracks deposit)

---

## 5. Exit Paths

Users have **two mutually exclusive** exit options:

### 5.1 Exit Vault (`exit_vault`)
> Burn PUT → receive original collateral token

- Available after lock period
- Returns proportional amount of deposited asset
- Position closed permanently

### 5.2 Redeem X1SAFE (`redeem_x1safe`)
> Burn PUT → receive X1SAFE 1:1

- Available anytime
- Converts deposit into liquid X1SAFE tokens
- Maintains USD-equivalent exposure in X1 ecosystem
- After redeem: `exit_vault` no longer available for that position

| Path | Input | Output | When to use |
|------|-------|--------|-------------|
| `exit_vault` | Burn PUT | Original token (USDC.X / XNT / XEN) | Cash out |
| `redeem_x1safe` | Burn PUT | X1SAFE (1:1) | Stay in ecosystem |

---

## 6. Staking Module

X1SAFE-PUT holders can stake PUT tokens to earn protocol yield, paid out in **X1SAFE tokens**.

**Staking token:** sX1SAFE (receipt token for staked position)  
**Yield source:** Protocol fee distribution  
**APY:** Configurable via `apy_bps` parameter (basis points)

**Fee distribution (on every deposit):**

| Recipient       | Share |
|-----------------|-------|
| Stakers pool    | Configurable (`staker_fee_share`) |
| Buyback & burn  | Configurable (`buyback_fee_share`) |
| Treasury        | Configurable (`treasury_fee_share`) |

All shares expressed in basis points (bps), total ≤ 10,000.

---

## 6.1 X1SAFE Reward Vesting — Linear Claim Schedule

Staking rewards are not instantly claimable at 100%. Instead, X1SAFE rewards vest **linearly over time** to incentivize long-term staking and prevent mercenary yield farming.

### Vesting Schedule

| Time Staked | % of Rewards Claimable |
|-------------|------------------------|
| Day 0       | 0%                     |
| Day 7       | ~23%                   |
| Day 15      | ~50%                   |
| Day 22      | ~73%                   |
| Day 30      | 100% ✅                |

> Full vesting period: **30 days** from the moment staking begins.  
> Rewards accrue immediately — but unlock gradually over the 30-day window.

### Formula

```
vested_pct     = min(elapsed_seconds / VESTING_PERIOD, 1.0)
claimable      = total_earned × vested_pct
locked_balance = total_earned − claimable
```

Where `VESTING_PERIOD = 30 × 24 × 3600 = 2,592,000 seconds`.

### Example

> Stake 10,000 PUT for 15 days. Total rewards earned = 500 X1SAFE.
>
> ```
> vested_pct  = 15 / 30 = 50%
> claimable   = 500 × 0.50 = 250 X1SAFE  ← can claim now
> locked      = 500 × 0.50 = 250 X1SAFE  ← unlocks over next 15 days
> ```

### Key Rules

- **Partial claims allowed** — user can claim any time; only the vested portion transfers
- **Vesting resets on re-stake** — adding new PUT to an existing position restarts the vesting clock on the new amount only (existing vested rewards are preserved)
- **Unstake forfeits unvested rewards** — early exit burns the locked portion (anti-gaming)
- **No cliff** — vesting is purely linear, no lock-up threshold required before claiming begins

### On-chain Implementation

Two new fields added to `UserStake`:

```rust
pub stake_start_ts:  i64,   // Unix timestamp when staking began
pub vesting_period:  u32,   // Configurable (default: 2,592,000 = 30 days)
```

`claim_rewards` checks elapsed time against `stake_start_ts` and applies `vested_pct` before transferring X1SAFE from the reward reserve to the user wallet.

### Why Vesting?

1. **Prevents mercenary farming** — bots can't stake → dump → exit in one block
2. **Rewards committed stakers** — 30-day holders earn full yield
3. **Stabilizes PUT supply** — reduces sell pressure from instant reward dumps
4. **Aligns incentives** — stakers benefit from protocol growth over time

---

## 7. Protocol Architecture

```
User
 │
 ├─ deposit(amount, asset) ──→ Vault PDA
 │                               ├─ checks AssetConfig (oracle price)
 │                               ├─ transfers tokens to Reserve ATA
 │                               ├─ mints X1SAFE-PUT to user
 │                               └─ creates UserPosition account
 │
 ├─ stake(put_amount) ──────→ StakePool
 │                               └─ mints sX1SAFE, tracks rewards
 │
 ├─ exit_vault() ───────────→ Vault PDA
 │                               ├─ burns PUT
 │                               └─ returns collateral from Reserve
 │
 └─ redeem_x1safe() ────────→ Vault PDA
                                 ├─ burns PUT
                                 └─ mints X1SAFE 1:1
```

**Program PDAs:**

| Account | Seeds | Purpose |
|---------|-------|---------|
| Vault | `["vault"]` | Global state, fee config, TVL |
| Asset Config | `["asset", mint]` | Per-token price + reserves |
| User Position | `["position", user, mint]` | Per-user deposit tracking |
| PUT Mint | `["put_mint"]` | X1SAFE-PUT mint authority |
| SAFE Mint | `["safe_mint"]` | X1SAFE mint authority |
| Stake Pool | `["stake_pool"]` | Staking reward state |
| sX1SAFE Mint | `["sx1safe_mint"]` | Staked receipt token |
| Reserve ATA | vault-owned token accounts | Collateral custody |

---

## 8. Security Model

- **Non-custodial:** Vault PDA is program-controlled; no admin can withdraw user funds
- **Oracle validation:** Price staleness checks prevent stale-price exploits
- **Pause mechanism:** `pause_vault` / `unpause_vault` for emergency response
- **Authority gating:** `add_asset`, `update_price`, `pause_vault` require vault authority signature
- **Bump-verified PDAs:** All accounts use canonical Anchor PDA derivation
- **Upgradeable program:** BPFLoaderUpgradeab1e — authority held by deployer wallet `B5gEjqV...`

---

## 9. Tokenomics Summary

| Parameter | Value |
|-----------|-------|
| 1 X1SAFE-PUT | $0.01 USD |
| 1 X1SAFE | $0.01 USD |
| Mint ratio | 100 PUT per $1 deposited |
| Redeem ratio | 1 PUT → 1 X1SAFE |
| Staking APY | Configurable (bps) |
| Fee split | Stakers / Buyback / Treasury |

---

## 10. Roadmap

| Phase | Milestone |
|-------|-----------|
| ✅ v1 | Vault deploy, USDC.X + XNT deposit, PUT minting, exit |
| ✅ v1 | Staking module (sX1SAFE, yield distribution) |
| ✅ v1 | Redeem X1SAFE instruction |
| 🔜 v2 | XEN collateral support |
| ✅ v1.1 | Linear vesting on staking rewards (30-day schedule) |
| 🔜 v2 | Time-locked positions with yield bonus |
| 🔜 v2 | On-chain oracle integration (RANDAO+VDF) |
| 🔜 v3 | Cross-protocol yield routing |
| 🔜 v3 | Governance via X1SAFE token |

---

## 11. Deployed Contracts

**X1 Testnet:**

| Contract | Program ID |
|----------|-----------|
| X1SAFE Vault | `F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe` |
| Staking | `(x1safe_put_staking)` |

**Key Accounts (Testnet):**
| Account | Address |
|---------|---------|
| Vault PDA | `A5HWWiKBmzM1wibshEoL4653qPrnHpnJ7yw74pW49ZNf` |
| PUT Mint | `2o9zhcEuzvW8uw9Bo4s72AsTkN8xk7aUaoSdRtkSQGcd` |
| USDC.X AssetConfig | `Bgz3Bpvusju6xgdVNQwaJUn265kbVi3uGKhWvxN8yd1c` |
| XNT AssetConfig | `H7q2TKsUHexUKoLNd3jWpUMYRMwzm2zNMUYHoGviygKx` |
| Treasury | `Hnp1JiTb8YfFuEiP8w6vYTd16khXCiQRbYmJcujNbQAi` |

**Frontend:** https://x1safu-cmo.vercel.app/  
**GitHub:** https://github.com/X1SAFE/x1safuCMO

---

## 12. Disclaimer

X1SAFE is experimental software deployed on X1 Testnet. Smart contracts have been developed and tested but have not undergone a formal third-party audit. Use at your own risk. This white paper describes v1 protocol mechanics and is subject to change as the protocol evolves.

---

*X1SAFE Protocol — Built on X1. Owned by the community.*
