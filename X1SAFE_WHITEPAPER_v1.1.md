# X1SAFU — Secure Savings Protocol
### Whitepaper v1.1 | X1 Blockchain (SVM)

---

## 1. Tổng Quan

X1SAFU là giao thức tiết kiệm phi tập trung (DeFi Savings Protocol) xây dựng trên **X1 Blockchain** — blockchain SVM-compatible, tốc độ cao, chi phí giao dịch gần như bằng 0. X1SAFU cho phép người dùng gửi tài sản thực và nhận token đại diện giá trị USD, sau đó lưu thông, giao dịch, staking hoặc rút lại tài sản gốc bất kỳ lúc nào.

> *"1 X1SAFE = 1 USD tương đương tại thời điểm gửi."*

**Phiên bản hiện tại:**
- v1 (`x1safu`): Vault cơ bản — deposit / exit / sell
- **v2.0 (`x1safe_put_staking`): Multi-asset staking vault với dual reward streams** ← hiện tại

---

## 2. Hệ Thống Token

| Token | Ký hiệu | Peg | Mô tả |
|-------|---------|-----|-------|
| X1SAFE PUT | PUT | $0.01 USD | Chứng nhận giá trị USD khi gửi. Locked trong vault. |
| X1SAFE FREE | SAFE | $0.01 USD | Token tự do — giao dịch trên xDEX hoặc staking. |
| sX1SAFE | sX1SAFE | 1:1 với SAFE | Receipt token khi stake X1SAFE FREE. |

**Công thức tạo PUT:**
```
PUT minted = token_amount × oracle_price × 100 / PRICE_SCALE
```
→ Ví dụ: 5 XNT × $0.37 = $1.85 → mint **185 X1SAFE_PUT**

---

## 3. Tài Sản Được Hỗ Trợ

8 loại tài sản, lock linh hoạt **1–360 ngày**:

| Asset | Định giá | Testnet Mint |
|-------|----------|-------------|
| USDC.X | Fixed 1:1 | — |
| XNT | Oracle (xDEX) | `CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW` |
| XEN | Oracle | — |
| XNM | Oracle | — |
| PURGE | Oracle | `6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP` |
| THEO | Oracle | `5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS` |
| AGI | Oracle | `7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER` |
| PEPE | Oracle | `81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ` |

---

## 4. Cơ Chế Hoạt Động

### 4.1 Deposit → Nhận PUT
```
Gửi Asset vào Vault
→ Oracle định giá USD
→ Mint X1SAFE_PUT cho user
→ Asset được giữ trong reserve account
```

### 4.2 Withdraw → Tự do hóa
```
Đốt X1SAFE_PUT → Mint X1SAFE_FREE (1:1)
X1SAFE_FREE = token lưu thông, list trên xDEX
```

### 4.3 Exit → Lấy lại tài sản gốc
```
Đốt X1SAFE_FREE
→ Nhận lại tài sản thế chấp theo tỉ lệ
   (proportional từ tất cả các reserves)
```

### 4.4 Redeposit → Lock lại
```
Đốt X1SAFE_FREE → Mint X1SAFE_PUT (1:1)
= Vào lại vault để tiếp tục tích lũy phần thưởng
```

### 4.5 Stake → Kiếm lợi nhuận
```
Gửi X1SAFE_FREE → Nhận sX1SAFE (1:1)
→ Tích lũy X1SAFE_FREE từ reward pool
→ Claim bất kỳ lúc nào, không cần unstake
```

### 4.6 Unstake
```
Đốt sX1SAFE → Nhận X1SAFE_FREE gốc + Rewards tích lũy
```

---

## 5. Dual Reward Streams (Phần Thưởng Kép)

| Loại phần thưởng | Token | Vesting |
|-----------------|-------|---------|
| USDC.X Fees | USDC.X | **Ngay lập tức** |
| Staking Yield | X1SAFE FREE | **42 ngày** (6 giai đoạn × 7 ngày) |

**Phân phối phí giao dịch (Fee Split):**
```
60% → Stakers
20% → Buyback X1SAFE
20% → Treasury
```

**Treasury:** `2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R`

**Công thức phân phối reward:**
```
reward_per_token += undistributed_rewards × 10^12 / total_staked
earned = staked × (reward_per_token - reward_per_token_paid) / 10^12
```

---

## 6. Bảo Mật On-Chain

| Cơ chế | Mô tả |
|--------|-------|
| ✅ Vault Pause | Authority tạm dừng toàn vault trong khẩn cấp |
| ✅ Oracle gating | Chỉ authority/keeper cập nhật giá, không public |
| ✅ Math safety | Toàn bộ dùng `checked_*` & `saturating_*` — không overflow |
| ✅ CEI pattern | State changes trước CPI calls — chống re-entrancy |
| ✅ PDA authority | Vault authority là PDA, không phải ví cá nhân |
| ✅ Keeper role | Tách biệt keeper vs authority — keeper không rút được fund |
| ✅ Lock period | 1–360 ngày — unstake sau khi hết lock |

---

## 7. Thông Số Kỹ Thuật

| Tham số | Giá trị |
|---------|---------|
| Ngôn ngữ | Rust + Anchor 0.30.1 |
| Network | X1 Testnet → Mainnet |
| Program v1 | `3YqHMLwVVChoSAaN6SjVeKLwKNFN3WQMJ1tFGC2N7Upw` |
| Program v2 | `F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe` |
| Vault PDA | `SCZPFHUFCZf91GMVSkxQZahi7ueH8NodRoE8KaqW8Ny` |
| PUT/SAFE decimals | 6 |
| Lock range | 1–360 ngày |
| Vesting cycles | 6 giai đoạn × 7 ngày = 42 ngày |
| Fee split | 60/20/20 |
| Frontend | React 18 + TypeScript + Vite |
| Wallet | Solana Wallet Adapter (Backpack, Phantom, v.v.) |
| Deploy | Vercel |
| Testnet RPC | https://rpc.testnet.x1.xyz |

---

## 8. Lộ Trình Phát Triển (Roadmap)

| Giai đoạn | Mục tiêu | Trạng thái |
|----------|---------|-----------|
| Phase 1 | V1 vault: deposit / exit / sell | ✅ Hoàn thành |
| Phase 2 | V2 multi-asset staking + dual rewards | ✅ Hoàn thành |
| Phase 3 | Deploy mainnet X1 | 🔄 Đang triển khai |
| Phase 4 | Tích hợp oracle phi tập trung (Pyth/Switchboard on X1) | 🔲 Kế hoạch |
| Phase 5 | Governance token — cộng đồng vote phí & assets mới | 🔲 Kế hoạch |
| Phase 6 | Mobile app + xDEX deep liquidity | 🔲 Kế hoạch |

---

## 9. Links

| | |
|--|--|
| 🌐 App | https://x1safu-cmo.vercel.app |
| 📦 GitHub | https://github.com/X1SAFE/x1safuCMO |
| 🔍 Explorer | https://explorer.testnet.x1.xyz |
| 📡 RPC | https://rpc.testnet.x1.xyz |

---

## 10. Đội Ngũ

| Vai trò | Người |
|--------|-------|
| Protocol Design | CMO XEN X1 🐾🐾🐾 (@Prxenx1) |
| Smart Contract v2.0 | Theo (@xxen_bot) |
| Frontend | Theo (@xxen_bot) |
| Infrastructure | Cyberdyne Unlimited LLC |

---

*X1SAFU — Secure your value. Trust the chain.*  
`Private — Cyberdyne Unlimited LLC`
