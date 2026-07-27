# LegacyBTC Pool

A solo and PPLNS mining pool for [LegacyCoin](https://github.com/forks-ecosystem) (LBTC) — a yespower-powered cryptocurrency. Built with Node.js, TypeScript, Express, React, and PostgreSQL.

## Features

- **Stratum v1** — SOLO (port `3331`) and PPLNS (port `3333`) mining protocols
- **PPLNS** — Pay-per-last-N-shares with configurable sliding window (default 100,000 shares)
- **Block reconciler** — automatic confirmation tracking, orphan detection, and payout processing
- **Dev fee** — 5% of each block reward sent to dev address
- **Dashboard** — real-time hashrate, block finders, miner stats, payout history
- **Admin panel** — env config, service control, authentication
- **PostgreSQL** — workers, shares, blocks, payouts via Drizzle ORM
- **OpenAPI 3.1** — API contract as source of truth with Orval codegen

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| API | Express 5 |
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod 4 |
| Build | esbuild (api-server), Vite (pool-ui) |
| Package Manager | pnpm workspaces |
| Process Manager | systemd / PM2 |

## Architecture

```
legacybtc-pool/
├── artifacts/
│   ├── api-server/     Express API + Stratum TCP server
│   └── pool-ui/        React dashboard (Vite + shadcn)
├── lib/
│   ├── api-spec/       OpenAPI 3.1 contract
│   └── db/             Drizzle schema + migrations
├── packages/
│   ├── api-client-react/   React Query hooks (Orval-generated)
│   └── api-zod/            Zod schemas (Orval-generated)
├── config/
│   ├── admin.json      Admin credentials
│   └── pool.env        Pool runtime config
├── ecosystem.config.js PM2 config
└── bin/                yespower-check binary
```

## Utility Scripts

The following helper scripts are located in the project root:

| Script | Description |
|--------|-------------|
| [`_git_LegacyCore.sh`](./_git_LegacyCore.sh) | Clone and build the LegacyCore (LBTC) node from source. Run this to get a fully compiled `legacoind` binary. |
| [`_set_all.sh`](./_set_all.sh) | Set file ownership and permissions for the pool directory. Useful when running the pool under a dedicated system user or after a Docker rebuild. |

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL (or use Docker)
- [LegacyCore](https://github.com/forks-ecosystem/LegacyCore) node running with cookie auth

### Install & Build

```bash
pnpm install
pnpm run build
```

### Configure

Copy or symlink the environment config:

```bash
cp config/pool.env artifacts/api-server/.env
```

Edit `artifacts/api-server/.env` to match your node and database:

```env
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/btc_pool
DEV_WALLET=LfSbSV7WDgfTvFC9vY6s7J4UMircJ9UCFT
NODE_RPC_HOST=127.0.0.1
NODE_RPC_PORT=19556
NODE_RPC_COOKIE=/path/to/.cookie
PPLNS_WINDOW=100000
PAYOUT_THRESHOLD=100000000
STRATUM_SOLO_PORT=3331
STRATUM_PPLNS_PORT=3333
YESPOWER_CHECK_BIN=/path/to/yespower-check
```

### Run

```bash
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

Or via PM2:

```bash
pm2 start ecosystem.config.js
```

## Mining Modes

### SOLO (port 3331)

The finder receives 95% of the block reward minus the 5% dev fee. Best for miners with significant hashrate.

### PPLNS (port 3333)

Rewards are distributed proportionally based on shares within a sliding window of the last N accepted shares (default: 100,000). Each miner's payout = `(their shares / total shares in window) × (95% of block reward)`. Best for small miners seeking consistent payouts.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/pool/stats` | Pool statistics |
| GET | `/api/pool/dashboard` | Combined dashboard |
| GET | `/api/pool/config` | Pool connection settings |
| GET | `/api/pool/blocks` | Found blocks |
| GET | `/api/pool/payouts` | Payout history |
| GET | `/api/pool/miners` | Active miners |
| GET | `/api/pool/miners/:address` | Miner details |
| GET | `/api/pool/miners/:address/payouts` | Miner payouts |
| GET | `/api/pool/miners/:address/shares` | Miner shares |
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/dashboard` | Admin overview |
| GET | `/api/admin/services` | Service statuses |
| POST | `/api/admin/services/:name/:action` | Control services |
| GET | `/api/admin/config` | Get pool config |
| POST | `/api/admin/config` | Update pool config |

## Database Schema

- **workers** — miner addresses and stats
- **shares** — individual share submissions
- **blocks** — found blocks with confirmation status
- **payouts** — miner payout records

## License

MIT
