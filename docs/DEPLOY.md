# X1SAFE Protocol Deployment Guide

## 🚀 Quick Deploy to Vercel

### Option 1: One-click Deploy (Recommended)

```bash
cd ~/.openclaw/workspace/built/x1safu

# 1. Setup Vercel (first time only)
./scripts/setup-vercel.sh

# 2. Deploy preview
./scripts/deploy-vercel.sh preview

# 3. Deploy production
./scripts/deploy-vercel.sh prod
```

### Option 2: Manual Deploy

```bash
cd ~/.openclaw/workspace/built/x1safu/app

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## 📋 Pre-deployment Checklist

- [ ] Program ID updated in `app/src/App.tsx`
- [ ] RPC endpoint set to testnet/mainnet
- [ ] IDL file synced with deployed program
- [ ] Environment variables configured (if needed)

## 🔧 Environment Variables

Create `.env.local` in the `app/` directory:

```bash
# X1 Network
VITE_RPC_URL=https://rpc.testnet.x1.xyz
VITE_PROGRAM_ID=your_program_id_here
VITE_NETWORK=testnet

# Optional: Analytics
VITE_ANALYTICS_ID=your_analytics_id
```

## 🌐 Custom Domain (X1SAFE.x1)

1. Register domain at `https://x1ns.x1.xyz` (if available)
2. In Vercel Dashboard → Domains → Add Domain
3. Configure DNS to point to Vercel:
   - Type: CNAME
   - Name: X1SAFE
   - Value: cname.vercel-dns.com

## 🔄 CI/CD with GitHub Actions

The workflow in `.github/workflows/deploy.yml` auto-deploys on push to main.

**Required Secrets** (add in GitHub repo settings):
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Get these values:
```bash
vercel login
vercel env pull .env.local
```

## 📁 Build Output

```
app/dist/
├── index.html          # Entry point
├── assets/
│   ├── index-*.css     # Styles (12.94 kB)
│   └── index-*.js      # App bundle (610 kB)
```

## ⚠️ Important Notes

1. **Testnet vs Mainnet**: Update `PROGRAM_ID` and `RPC_URL` accordingly
2. **Wallet Support**: Currently Phantom + Solflare
3. **Program Deployment**: Must deploy program before frontend works
4. **XNS Domain**: Optional, requires separate registration

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm install` in app/ directory |
| Wallet not connecting | Check browser extensions |
| TX fails | Verify program deployed to correct network |
| CSS not loading | Check `vercel.json` routes config |

## 📞 Support

- X1 Discord: https://discord.gg/x1
- X1 Docs: https://docs.x1.xyz
- Vercel Docs: https://vercel.com/docs