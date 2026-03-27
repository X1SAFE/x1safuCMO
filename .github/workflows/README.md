# X1SAFE Solana Deploy Workflow

GitHub Actions workflow để build và deploy X1SAFE smart contract lên X1 Testnet/Mainnet.

## 🚀 Cách sử dụng

### 1. Setup GitHub Secrets (chỉ cần làm 1 lần)

Vào **Settings → Secrets and variables → Actions** trong repo GitHub, thêm secret:

**`SOLANA_KEYPAIR`**
- Lấy private key từ ví Solana của bạn (file `~/.config/solana/id.json`)
- Encode base64: `cat ~/.config/solana/id.json | base64 -w 0`
- Paste kết quả vào secret

```bash
# Trên local
solana-keygen new --outfile ~/.config/solana/x1safe-deployer.json
solana config set --keypair ~/.config/solana/x1safe-deployer.json

# Airdrop XNT (testnet)
solana airdrop 5 --url https://rpc.testnet.x1.xyz

# Encode keypair để thêm vào GitHub Secrets
cat ~/.config/solana/x1safe-deployer.json | base64 -w 0
```

### 2. Chạy Deploy

1. Vào **Actions → Build and Deploy X1SAFE Contract**
2. Click **Run workflow**
3. Chọn cluster:
   - `https://rpc.testnet.x1.xyz` (mặc định)
   - `https://rpc.mainnet.x1.xyz` (production)
4. Click **Run workflow**

### 3. Kết quả

- Build artifacts được lưu trong workflow run
- Program ID hiển thị trong summary
- Deploy log được upload để debug nếu cần

## 📋 Yêu cầu

- Ví deployer cần có ít nhất **2 XNT** để deploy
- Keypair phải là base64 encoded
- Repo cần có quyền chạy GitHub Actions

## 🔧 Cấu trúc Workflow

```
Build Job:
├── Setup Rust + Solana CLI + Anchor
├── Install dependencies
├── Build program (.so file)
└── Upload artifacts

Deploy Job:
├── Restore build artifacts
├── Setup keypair
├── Check balance
├── Deploy to cluster
└── Output Program ID
```

## 🐛 Troubleshooting

| Lỗi | Cách fix |
|-----|----------|
| "Insufficient balance" | Airdrop thêm XNT vào deployer wallet |
| "Invalid keypair" | Kiểm tra base64 encoding, phải là file JSON gốc |
| "Program already deployed" | Dùng `anchor upgrade` thay vì `anchor deploy` |
| Build fail | Kiểm tra code compile được local trước |

## 📝 Lưu ý bảo mật

- **Không bao giờ** commit private key vào repo
- Secret `SOLANA_KEYPAIR` đã được GitHub mã hóa
- Nên dùng ví riêng chỉ để deploy, không dùng ví chứa tài sản
- Đối với mainnet, cân nhắc dùng multisig hoặc upgrade authority

## 🔗 Liên quan

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana CLI](https://docs.solana.com/cli)
- [X1 Network](https://x1.xyz/)
