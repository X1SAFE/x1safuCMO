#!/bin/bash
# X1SAFE Vercel Setup Script
# Initial setup for Vercel deployment

set -e

cd "$(dirname "$0")/../app"

echo "🛡️ X1SAFE Protocol - Vercel Setup"
echo "=================================="

# Install vercel CLI globally
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm i -g vercel
fi

# Login to Vercel
echo "🔐 Logging in to Vercel..."
vercel login

# Link project (or create new)
echo "🔗 Linking project..."
vercel link

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/deploy-vercel.sh preview"
echo "  2. Test the preview deployment"
echo "  3. Run: ./scripts/deploy-vercel.sh prod  # for production"
echo ""