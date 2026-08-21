# API Reference

Base URL: `http://localhost:4000`

Auth: Better Auth **cookie sessions** (httpOnly, issued by `/api/auth/*`).
Roles: `CUSTOMER`, `AGENT`, `ADMIN`.

Errors are uniform JSON: `{ "error": "message" }` with status
`400` validation · `401` unauthenticated · `403` wrong role/ownership ·
`404` missing · `409` conflict (illegal transition, no agent, duplicate) ·
`422` pricing configuration error.

---

## Auth (Better Auth — base path `/api/auth`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/sign-up/email` | `{name, email, phone, password}` | Creates a CUSTOMER + session cookie; returns `{token, user}` |
| POST | `/api/auth/sign-in/email` | `{email, password}` | Sets session cookie; returns `{user}` |
| POST | `/api/auth/sign-out` | — | Clears session |
| GET | `/api/auth/get-session` | — | `{session, user}` or `null` |

There are no seeded demo accounts. Register via the UI; admins create agent
logins through `POST /admin/agents`.

## Orders

| Method | Path | Role | Body / Query | Notes |
|---|---|---|---|---|
| GET | `/orders/meta/areas` | any | — | Serviceable areas with zone names |
| POST | `/orders/quote` | CUSTOMER, ADMIN | `{pickupAreaId, dropAreaId, lengthCm, breadthCm, heightCm, actualWeightKg, orderType, paymentType, codAmount?}` | Full charge breakdown, nothing persisted |
| POST | `/orders` | CUSTOMER, ADMIN | quote fields + `pickup{contactName, contactPhone, line1, areaId}`, `drop{…}`, optional `customerId` (ADMIN only) | Server recomputes the charge; creates order + PLACED event |
| GET | `/orders` | any | `?status=` | Customers see own orders; admin sees all |
| GET | `/orders/:id` | owner / assigned agent / admin | — | Order + full timeline + agent info |
| POST | `/orders/:id/reschedule` | owner / admin | `{rescheduleFor, note?}` | FAILED → RESCHEDULED → auto re-assign |

### Quote response

```json
{
  "quote": {
    "volumetricWeightKg": 12.8,
    "billableWeightKg": 13,
    "appliedRateCardId": "…",
    "rateCardName": "Central Bengaluru → South Bengaluru · B2C",
    "basePrice": 120,
    "chargeableWeightKg": 12.5,
    "perKgRate": 42,
    "freightCharge": 645,
    "codSurcharge": 150,
    "totalCharge": 795,
    "currency": "INR",
    "intraZone": false
  }
}
```

## Agent console

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/agent/me` | — | Own profile |
| GET | `/agent/orders` | — | Active orders assigned to me |
| POST | `/agent/orders/:id/status` | `{status, note?, lat?, lng?}` | Allowed: `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED` (reason required). Location ping updates live position |
| POST | `/agent/location` | `{lat, lng}` | Position update |
| PATCH | `/agent/status` | `{status}` | `AVAILABLE` / `OFFLINE` duty toggle |

## Admin

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | Counts by status, booked revenue, fleet load |
| GET/POST | `/admin/zones` · PATCH/DELETE `/admin/zones/:id` | Zone CRUD (delete blocked while areas mapped) |
| GET/POST | `/admin/areas` · PATCH/DELETE `/admin/areas/:id` | Pincode → zone mapping (pincode unique) |
| GET/POST | `/admin/rate-cards` · PATCH/DELETE `/admin/rate-cards/:id` | Rate cards; activating supersedes the previous active card for that lane+type |
| GET | `/admin/cod-surcharges` · PUT `/admin/cod-surcharges/:orderType` | Upsert per-order-type COD config |
| GET/POST | `/admin/agents` · PATCH `/admin/agents/:id` | Fleet management; POST creates user + profile |
| GET | `/admin/users?role=` | Customer list (for on-behalf ordering) |
| GET | `/admin/orders?status=&zoneId=&agentId=` | All orders, filterable |
| PATCH | `/admin/orders/:id/status` | Override to any status — logged as override |
| POST | `/admin/orders/:id/assign` | `{auto:true}` or `{agentId}` manual |

## Status lifecycle

```
PLACED ──► ASSIGNED ──► PICKED_UP ──► IN_TRANSIT ──► OUT_FOR_DELIVERY ──► DELIVERED
   │            │            │             │                  │
   │            │            └─────────────┴──────────────────┴──► FAILED ──► RESCHEDULED ──► ASSIGNED
   └────────────┴────────────► CANCELLED (admin)
```

Illegal transitions are rejected with `409`. Every accepted change appends a row
to `tracking_events`; the table is append-only at the database level.
