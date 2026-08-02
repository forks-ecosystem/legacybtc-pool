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
| Deployment | Docker + docker-compose |

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
├── docker-compose.yml  Docker orchestration (postgres + app)
└── bin/                yespower-check binary
```

## Utility Scripts

The following helper scripts are located in the project root:

| Script | Description |
|--------|-------------|
| [`_git_LegacyCore.sh`](./_git_LegacyCore.sh) | Clone and build the LegacyCore (LBTC) node from source. Run this to get a fully compiled `legacoind` binary. |
| [`_set_all.sh`](./_set_all.sh) | Set file ownership and permissions for the pool directory. Useful when running the pool under a dedicated system user. |

## Quick Start

### Prerequisites

- Docker + Docker Compose
- [LegacyCore](https://github.com/forks-ecosystem/LegacyCore) node running on the host (the pool connects via `NODE_RPC_HOST` / `NODE_RPC_PORT`)

### Run via Docker (recommended)

The pool runs fully in Docker — PostgreSQL + the API/Stratum server. It uses `network_mode: host` so it can reach the LegacyCore node and the local postgres.

```bash
docker compose up -d --build
```

- API + dashboard: http://localhost:3001
- Stratum PPLNS: `stratum+tcp://127.0.0.1:3333`
- Stratum SOLO: `stratum+tcp://127.0.0.1:3331`

### Configure

Runtime settings are passed via environment variables in [`docker-compose.yml`](./docker-compose.yml):

| Variable | Description |
|----------|-------------|
| `PORT` | API/dashboard port |
| `DATABASE_URL` | PostgreSQL connection string |
| `DEV_WALLET` | Pool's dev/reward wallet (validated against the node on startup) |
| `DEV_FEE_ADDRESS` | Address receiving the 5% dev fee |
| `NODE_RPC_HOST` / `NODE_RPC_PORT` | LegacyCore node RPC endpoint |
| `NODE_RPC_USER` / `NODE_RPC_PASS` | Node RPC credentials |
| `PPLNS_WINDOW` | Sliding window of shares for PPLNS |
| `PAYOUT_THRESHOLD` | Minimum payout threshold (base units) |

An admin panel can also persist overrides to `config/pool.env` (mounted via `./config`).

### Common commands

```bash
docker compose up -d --build   # build & start
docker compose logs -f app     # follow logs
docker compose ps              # status
docker compose restart app     # restart the API
docker compose down            # stop (keeps postgres data)
```

PostgreSQL data lives in `/srv/legacybtc-pool/postgres` (outside the project, kept out of the Docker build context).

### Memory-friendly rebuild

```bash
sudo chmod -R o+rX /srv/legacybtc-pool/postgres   # one-time, if postgres files are 70:root
./_rebuild.sh                                     # stop → remove old image → rebuild → start
```

## Log Cleanup

The API writes JSON logs to stdout — collect them with Docker's logging driver (default: json-file, max-size configurable in `docker-compose.yml`).

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
