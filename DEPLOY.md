# X1SAFE-PUT Staking v2.0 — Deployment Package

## 📋 Thông tin Deploy

**Ngày tạo:** 2026-03-18  
**Người tạo:** Theo (@xxen_bot)  
**Chủ sở hữu:** CMO XEN X1 🐾🐾🐾 (@Prxenx1)

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

## 🚀 Hướng dẫn Deploy

### Bước 1: Build

```bash
cd /home/jack/.openclaw/workspace-cyberdyne/x1safe-put-staking-v2/
anchor build
```

### Bước 2: Deploy lên X1 Testnet

```bash
# Set cluster
solana config set --url https://rpc.testnet.x1.xyz

# Deploy
anchor deploy --provider.cluster testnet
```

### Bước 3: Lưu thông tin

Sau khi deploy thành công, ghi lại:
- Program ID
- Transaction signature
- Deploy time

---

## 📊 Thông tin Smart Contract

| Field | Value |
|-------|-------|
| **Program Name** | x1safe_put_staking |
| **Program ID** | `F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe` |
| **Anchor Version** | 0.30.1 |
| **Solana Version** | 1.18.15 |
| **Network** | X1 Testnet |
| **Cluster RPC** | https://rpc.testnet.x1.xyz |

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
├── programs/
│   └── x1safe_put_staking/
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

---

## 📝 Deployment Log

| Step | Status | Time | Tx/Note |
|------|--------|------|---------|
| Build | ⏳ Pending | - | Chạy `anchor build` |
| Deploy | ⏳ Pending | - | Chạy `anchor deploy` |
| Verify | ⏳ Pending | - | Kiểm tra on-chain |
| Initialize | ⏳ Pending | - | Gọi `initialize_vault` |

---

**Lưu ý:** File này sẽ được cập nhật sau khi deploy thành công.
