# LastMile — Last-Mile Delivery Tracker

A delivery management platform where customers and admins place orders with
**auto-calculated charges**, agents are assigned **intelligently**, and customers
are notified at every step of the journey.

Built as a TypeScript monorepo on **Bun**:

| App | Stack | Port |
|---|---|---|
| `apps/api` | Bun + Hono + Drizzle ORM + PostgreSQL | 4000 |
| `apps/web` | Next.js 15 (App Router) + Tailwind CSS v4 + SWR | 3000 |
| `packages/shared` | Domain model, status state machine, zod contracts | — |

---

## Quick start

### 1. Prerequisites
- [Bun](https://bun.sh) ≥ 1.1
- Docker (for Postgres) — or any PostgreSQL 14+ instance

### 2. Setup

```bash
bun install

# start postgres (docker compose) — or point DATABASE_URL at your own instance
bun run db:up

# configure environment
cp .env.example .env        # defaults work out of the box for local dev

# create schema + append-only trigger, then seed demo data
bun run db:migrate
bun run db:seed
```

### 3. Run

```bash
# terminal 1 — API on :4000
bun run dev:api

# terminal 2 — web on :3000
bun run dev:web
```

Open **http://localhost:3000**.

### Demo accounts (password `Password@123`)

| Role | Email |
|---|---|
| Admin | `admin@lastmile.dev` |
| Customer | `customer@lastmile.dev` |
| Agent | `vikram@lastmile.dev` |

The seed ships a Bengaluru network: 4 zones, 12 pincode-mapped areas, a full
B2B/B2C rate matrix (intra + inter zone), COD surcharges, 4 agents and sample
orders across every lifecycle stage.

---

## Feature map

- **Rate calculation engine** — pincode → zone detection, volumetric weight
  (L×B×H ÷ 5000), billable = max(actual, volumetric) rounded up to a 0.5 kg slab,
  B2B/B2C rate-card lookup per zone pair, COD surcharge (% of COD value + flat
  fee). Everything is admin-configurable; nothing is hardcoded. Customers see the
  full breakdown **before confirming**; the server recomputes on submit.
- **Auto-assignment** — scores available agents by live distance to the pickup
  area centroid with a zone-affinity bonus and load penalty; respects a hard
  radius and per-agent capacity. Admins can always pin a rider manually.
- **Order lifecycle** — `PLACED → ASSIGNED → PICKED_UP → IN_TRANSIT →
  OUT_FOR_DELIVERY → DELIVERED | FAILED`, plus `RESCHEDULED` recovery and admin
  `CANCELLED`. Every change appends an immutable tracking event (actor, role,
  timestamp, note) — enforced by a database trigger.
- **Failed-delivery flow** — failure reason captured → customer notified →
  customer picks a new date → order resets to `RESCHEDULED` → nearest agent
  auto-assigned for the retry.
- **Notifications** — email (Resend) + SMS (Twilio) on *every* status change;
  without provider keys everything is persisted to a `notifications` outbox and
  logged to console so local dev works offline.

## Environment variables

See [.env.example](.env.example). Only `DATABASE_URL` is required; email/SMS
keys are optional (console fallback).

## Documentation

- [API reference](docs/API.md)
- [Database schema](docs/SCHEMA.md)
- [System design write-up](docs/SYSTEM_DESIGN.md) — rate engine, zone detection,
  auto-assignment, failed-delivery handling

## Tests

```bash
bun test        # state machine, rate math (volumetric/billable slabs), geo distance
bun run typecheck
```

## Deployment notes

One-click options:

- **Render** — this repo ships a [`render.yaml`](render.yaml) blueprint
  (API + web + free Postgres). Render → New → Blueprint → pick the repo. Done.
- **Docker** — `docker build -f apps/api/Dockerfile -t lastmile-api .`
  (migrations run on boot).
- **Vercel** — import the repo, set root directory to `apps/web`, env
  `NEXT_PUBLIC_API_URL=https://<your-api-host>`.

Manual targets: API runs anywhere Bun does (`bun run start` in `apps/api`,
env: `DATABASE_URL`, `JWT_SECRET`, `WEB_URL`); DB is any Postgres 14+ — run
`bun run db:migrate && bun run db:seed` once.

