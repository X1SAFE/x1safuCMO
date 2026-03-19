#!/bin/bash
# X1SAFE Vercel Deployment Script
# Usage: ./deploy-vercel.sh [prod|preview]

set -e

cd "$(dirname "$0")/../app"

echo "🛡️ X1SAFE Protocol - Vercel Deployment"
echo "========================================"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel:"
    vercel login
fi

# Determine environment
ENV="${1:-preview}"

if [ "$ENV" == "prod" ]; then
    echo "🚀 Deploying to PRODUCTION..."
    vercel --prod
else
    echo "🔧 Deploying to PREVIEW..."
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo "🔗 Check the URL above to view your deployment."