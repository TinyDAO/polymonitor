# Polymonitor

Polymarket account monitor. Sign in with your Ethereum wallet, create kanbans, add Polymarket proxy addresses, and track total value (Polymarket positions + Polygon USDC).

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` - Neon PostgreSQL connection string
   - `SESSION_SECRET` - 32+ char secret for session encryption
   - `CRON_SECRET` - Secret for GitHub Action cron auth
   - `POLYGON_RPC_URL` - Polygon RPC (default: https://polygon-rpc.com)

2. Create database tables:
   ```bash
   npm run db:push
   ```

3. Run dev server:
   ```bash
   npm run dev
   ```

## GitHub Action (hourly sync)

Add these secrets to your GitHub repo:

- `API_URL` - Your Vercel deployment URL (e.g. https://polymonitor.vercel.app)
- `CRON_SECRET` - Same value as in Vercel env

The workflow runs every hour and calls `/api/cron/sync-balances` to fetch Polymarket positions and USDC balances for all monitored addresses.

## Deploy to Vercel

1. Connect repo to Vercel
2. Add env vars: `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `POLYGON_RPC_URL`
3. Deploy
