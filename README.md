# X1SAFE-PUT Staking v2.0

Multi-asset staking vault with flexible lock periods and dual reward streams on X1 blockchain.

## Features

- **8 Supported Assets**: USDC.X (fixed 1:1), XNT, XEN, XNM, PURGE, THEO, AGI, PEPE (oracle pricing)
- **X1SAFE Peg**: 1 X1SAFE = $0.01 USD
- **Flexible Lock**: 1-360 days user-selectable
- **Dual Rewards**: USDC.X fees (immediate) + X1SAFE rewards (vested)
- **Vesting Schedule**: 6 phases × 7 days = 42 days total
- **Fee Split**: 60% stakers / 20% buyback / 20% treasury

## Architecture

### Core Flow

1. **Deposit** → Mint X1SAFE-PUT (represents USD value)
2. **Stake** X1SAFE-PUT → Earn rewards
3. **Exit Vault** → Burn X1SAFE-PUT, receive original asset, mint X1SAFE to reward pool
4. **Claim** → USDC.X (immediate) / X1SAFE (vested)

### Token Addresses

| Token | Mint |
|-------|------|
| PURGE | `6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP` |
| THEO | `5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS` |
| AGI | `7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER` |
| PEPE | `81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ` |

### Treasury

`2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R`

## Build Instructions

```bash
# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test

# Deploy to X1 Testnet
anchor deploy --provider.cluster testnet
```

## Program ID

`F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe`

## Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Initialize vault state, mints, supported tokens |
| `deposit` | Deposit tokens, mint X1SAFE-PUT |
| `exit_vault` | Burn X1SAFE-PUT, receive original asset, mint X1SAFE to reward pool |
| `stake` | Stake X1SAFE-PUT to earn rewards |
| `unstake` | Unstake X1SAFE-PUT (after lock period) |
| `claim_usdc_fees` | Claim USDC.X fees immediately |
| `claim_x1safe_rewards` | Claim X1SAFE rewards (subject to vesting) |
| `process_fees` | Split fees 60/20/20 |
| `add_supported_token` | Add new supported token (admin) |
| `update_oracle` | Update oracle for token (admin) |

## Accounts

| Account | Purpose |
|---------|---------|
| `VaultState` | Global vault configuration |
| `SupportedToken` | Token configuration (mint, oracle, vault) |
| `UserPosition` | User's deposit position per token |
| `StakeAccount` | Staking position for rewards |
| `VestingSchedule` | 6-phase vesting for X1SAFE rewards |

## Security

- PDA-based authority
- Lock period enforcement
- Oracle staleness checks (TODO)
- Reentrancy protection via account constraints
- Math overflow protection with checked arithmetic

## License

Private - Cyberdyne Unlimited LLC