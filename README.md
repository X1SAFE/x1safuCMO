# X1SAFE Protocol

Secure Savings Protocol on X1 Blockchain  
**1 X1SAFE = 1 USD equivalent at deposit time**

## 🏗️ Architecture

```
x1safu/
├── programs/x1safu/           # Original X1SAFE vault (v1)
├── programs/x1safe_put_staking/  # X1SAFE-PUT Staking v2.0
├── app/                       # React + Vite frontend
├── scripts/                   # Deployment & utility scripts
├── docs/                      # Documentation
└── tests/                     # Anchor tests
```

---

## 🆕 X1SAFE-PUT Staking v2.0

Multi-asset staking vault with flexible lock periods and dual reward streams.

### Features

- **8 Supported Assets**: USDC.X (fixed 1:1), XNT, XEN, XNM, PURGE, THEO, AGI, PEPE (oracle pricing)
- **X1SAFE Peg**: 1 X1SAFE = $0.01 USD
- **Flexible Lock**: 1-360 days user-selectable
- **Dual Rewards**: USDC.X fees (immediate) + X1SAFE rewards (vested)
- **Vesting Schedule**: 6 phases × 7 days = 42 days total
- **Fee Split**: 60% stakers / 20% buyback / 20% treasury

### Core Flow

1. **Deposit** → Mint X1SAFE-PUT (represents USD value)
2. **Stake** X1SAFE-PUT → Earn rewards
3. **Exit Vault** → Burn X1SAFE-PUT, receive original asset, mint X1SAFE to reward pool
4. **Claim** → USDC.X (immediate) / X1SAFE (vested)

### Token Addresses (Testnet)

| Token | Mint |
|-------|------|
| PURGE | `6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP` |
| THEO | `5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS` |
| AGI | `7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER` |
| PEPE | `81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ` |

### Treasury

`2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R`

### Program ID

`F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe`

### v2.0 Instructions

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

---

## 🚀 Quick Start

```bash
# Clone
git clone <repo>
cd x1safu

# Setup dependencies
npm install

# Build programs
anchor build

# Run tests
anchor test

# Deploy to X1 Testnet
anchor deploy --provider.cluster testnet

# Start dev server
cd app && npm run dev
```

## 🛡️ Original X1SAFE Features (v1)

- **Deposit**: Lock USDC.X, XEN, XNT, or XNM → Receive X1SAFE
- **Exit**: Burn X1SAFE → Get original deposit back
- **Sell**: Trade on xDEX
- **Withdraw**: Move X1SAFE to wallet (lose exit rights)

## 📝 Smart Contract

- **Language**: Rust + Anchor 0.30.1
- **Network**: X1 Testnet → Mainnet
- **Programs**: x1safu (v1), x1safe_put_staking (v2)

## 🎨 Frontend Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI**: Custom CSS
- **Wallet**: Solana Wallet Adapter
- **Deploy**: Vercel

## 🔗 Links

- **Live Site**: https://x1safu-cmo.vercel.app
- **Testnet RPC**: https://rpc.testnet.x1.xyz
- **X1 Explorer**: https://explorer.testnet.x1.xyz

## 👥 Credits

- Protocol: CMO XEN X1 🐾🐾🐾 (@Prxenx1)
- Smart Contract v2.0: Theo (@xxen_bot)
- Frontend: Theo (@xxen_bot)

## 📄 License

Private - Cyberdyne Unlimited LLC
