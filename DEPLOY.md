# X1SAFE-PUT Staking v2.0 — Deployment Package

## 📋 Thông tin Deploy

**Ngày deploy:** 2026-03-18  
**Người deploy:** Theo (@xxen_bot)  
**Chủ sở hữu:** CMO XEN X1 🐾🐾🐾 (@Prxenx1)  
**Network:** X1 Testnet

---

## ✅ Deployment Status

| Program | Status | Program ID | Deploy Tx |
|---------|--------|------------|-----------|
| **x1safu (v1)** | ✅ Deployed | `6eCAcBP3yM6emuochCcRMZ78Rz4xyPveoANH25HVpd4S` | `4kqtMAtf6cMjXAtqBbTaYGwhXdzD9hBKRYPASQYmAS6kRfF53wHrUwJf4dYQxXQkJB4p1XfM2szuWpAmodG5HUPe` |
| **x1safe_put_staking (v2)** | ✅ Deployed | `HRWXebJQHDFmKtYbgm9HzhPbEtDh6DhgfDZYght4eQdx` | `PXQhNLHwD9Vwv5t7Hb6ULJuk59psJQcpKZahyNkEokXUP2YeMPG5QdeEhYLspW9NSZv4FgeNnk1AhLj2XtKNTr4` |

---

## 🔧 Yêu cầu hệ thống

```bash
# Cài đặt Solana CLI
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

# Cài đặt Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1

# Verify
anchor --version  # 0.30.1
solana --version  # 1.18.x
```

---

## 📁 Vị trí source code

```
/home/jack/.openclaw/workspace-cyberdyne/x1safe-put-staking-v2/
```

---

## 🚀 Hướng dẫn Deploy (đã xong)

```bash
# Build
anchor build

# Deploy (đã thực hiện)
anchor deploy --provider.cluster https://rpc.testnet.x1.xyz
```

---

## 📊 Thông tin Smart Contract

| Field | Value |
|-------|-------|
| **Program Name** | x1safe_put_staking |
| **Program ID** | `HRWXebJQHDFmKtYbgm9HzhPbEtDh6DhgfDZYght4eQdx` |
| **Anchor Version** | 0.30.1 |
| **Solana Version** | 1.18.26 |
| **Network** | X1 Testnet |
| **Cluster RPC** | https://rpc.testnet.x1.xyz |
| **Deployer** | `2jchoLFVoxmJUcygc2cDfAqQb1yWUEjJihsw2ARbDRy3` (Theo) |

---

## 🏦 Treasury Wallet

```
2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R
```

---

## 🪙 Token Mints (Testnet)

| Token | Mint Address |
|-------|--------------|
| **PURGE** | `6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP` |
| **THEO** | `5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS` |
| **AGI** | `7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER` |
| **PEPE** | `81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ` |

---

## 📝 Instructions (10)

1. `initialize_vault` — Khởi tạo vault
2. `deposit` — Deposit token → nhận X1SAFE-PUT
3. `exit_vault` — Burn PUT → nhận lại token gốc + mint X1SAFE vào reward pool
4. `stake` — Stake X1SAFE-PUT
5. `unstake` — Unstake (sau khi hết lock)
6. `claim_usdc_fees` — Claim USDC.X ngay lập tức
7. `claim_x1safe_rewards` — Claim X1SAFE (theo vesting 6 phase)
8. `process_fees` — Chia fee 60/20/20
9. `add_supported_token` — Thêm token mới (admin)
10. `update_oracle` — Update oracle (admin)

---

## ⚙️ Config Spec

| Feature | Value |
|---------|-------|
| X1SAFE peg | $0.01 USD |
| Lock period | 1-360 days |
| USDC.X claim | Immediate |
| X1SAFE vesting | 6 phases × 7 days |
| Fee split | 60% stakers / 20% treasury / 20% reward pool |
| Supported tokens | 8 (USDC.X + 7 oracle tokens) |

---

## 📂 File Structure

```
x1safe-put-staking-v2/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
├── README.md
├── DEPLOY.md          # ← This file
├── programs/
│   ├── x1safu/        # v1 - Original vault
│   └── x1safe_put_staking/  # v2.0 - PUT staking
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Program entry
│           ├── error.rs        # Custom errors
│           ├── utils.rs        # Utilities
│           ├── state/
│           │   ├── vault.rs
│           │   ├── user_position.rs
│           │   ├── stake_account.rs
│           │   └── vesting.rs
│           ├── instructions/
│           │   ├── initialize.rs
│           │   ├── deposit.rs
│           │   ├── exit_vault.rs
│           │   ├── stake.rs
│           │   ├── unstake.rs
│           │   ├── claim_fees.rs
│           │   ├── claim_rewards.rs
│           │   ├── process_fees.rs
│           │   └── admin.rs
│           └── oracle/
│               └── xdex.rs
└── tests/
    └── x1safe_put_staking.ts
```

---

## 🔐 Security Notes

- Program sử dụng Anchor 0.30.1 (latest stable)
- Safe math cho tất cả phép tính
- PDA seeds có prefix để tránh collision
- Admin-only functions có constraint `has_one = authority`
- Oracle staleness check (max 1 hour)

---

## 📞 Support

- **Builder:** Theo (@xxen_bot)
- **Owner:** CMO XEN X1 🐾🐾🐾 (@Prxenx1)
- **Workspace:** /home/jack/.openclaw/workspace-cyberdyne/
- **GitHub:** https://github.com/X1SAFE/x1safuCMO

---

## 📝 Deployment Log

| Step | Status | Time | Tx/Note |
|------|--------|------|---------|
| Build | ✅ Success | 2026-03-18 | Both programs compiled |
| Deploy x1safu | ✅ Success | 2026-03-18 | `6eCAcBP3...` |
| Deploy x1safe_put_staking | ✅ Success | 2026-03-18 | `HRWXebJQ...` |
| Initialize Vault | ⏳ Pending | - | Cần gọi `initialize_vault` |
| Add Supported Tokens | ⏳ Pending | - | 8 tokens |

---

## 🚀 Next Steps

1. **Initialize Vault** — Gọi instruction `initialize_vault` để khởi tạo
2. **Add Supported Tokens** — Thêm 8 token vào vault
3. **Update UI** — Cập nhật Program ID trong frontend
4. **Test** — Chạy test trên testnet

---

**Deployed by:** Theo (@xxen_bot) for CMO XEN X1 🐾🐾🐾  
**Date:** 2026-03-18 HST
