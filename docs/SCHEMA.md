# Database Schema

PostgreSQL, managed by Drizzle Kit (`apps/api/drizzle/`). Enums are native PG enums.

```
users ─┬─< agents >──────────┐
       │                     │
       ├─< orders >─┬─< tracking_events   (append-only, trigger-enforced)
       │            ├─< notifications      (outbox)
       │            │
zones ─┴─< areas ────┘   rate_cards, cod_surcharges
```

## users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name / email / phone | text | email unique |
| password_hash | text | argon2id (Bun.password) |
| role | role | CUSTOMER / AGENT / ADMIN |

## zones
`id`, `name`, `code` (unique), `description`. The service network's top-level partition.

## areas — pincode → zone mapping
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| pincode | text **unique** | one pincode ⇒ exactly one zone: the unit of zone detection |
| name / city | text | |
| zone_id | uuid → zones | |
| lat / lng | double | area centroid, used by auto-assignment |

## rate_cards — admin-configured freight pricing
| Column | Type | Notes |
|---|---|---|
| from_zone_id / to_zone_id | uuid → zones | intra-zone = same zone on both sides |
| order_type | order_type | B2B / B2C |
| base_weight_kg | double | weight included in base price (default 0.5) |
| base_price / per_kg_rate | double | freight formula inputs |
| active | boolean | only one active card per (from, to, type); activation supersedes |

## cod_surcharges
`order_type` (unique), `percent`, `flat_fee`, `active`. Surcharge =
`codAmount × percent/100 + flat_fee`, applied only to COD orders.

## agents
| Column | Type | Notes |
|---|---|---|
| user_id | uuid → users unique | login identity |
| code / vehicle | text | display callsign |
| status | agent_status | AVAILABLE / OFFLINE (duty toggle) |
| capacity | int | max concurrent active orders |
| current_lat / current_lng | double | live position for nearest-agent scoring |
| home_zone_id | uuid → zones nullable | zone-affinity bonus in assignment |

## orders
Identity & parties: `code` (unique human waybill `LM-YYYY-NNNNN`), `customer_id`,
`created_by_user_id`.

Route: pickup/drop `contact_name`, `contact_phone`, `line1`, `area_id` → areas.

Package: `length_cm`, `breadth_cm`, `height_cm`, `actual_weight_kg`.

Commercial: `order_type`, `payment_type`, `cod_amount`.

Engine output (snapshotted at creation): `volumetric_weight_kg`,
`billable_weight_kg`, `freight_charge`, `cod_surcharge`, `total_charge`,
`applied_rate_card_id`, `pickup_zone_id`, `drop_zone_id`.

Lifecycle: `status` (order_status), `assigned_agent_id`, `assigned_at`,
`failure_reason`, `reschedule_for`, `reschedule_count`, timestamps.

## tracking_events — immutable ledger
`order_id`, `status`, `note`, `actor_user_id`, `actor_role`, `actor_name`,
`meta` (jsonb), `created_at`.

**Immutability is enforced in the database**: a `BEFORE UPDATE OR DELETE`
trigger (`forbid_tracking_mutation`) raises an exception. Rows are only ever
INSERTed; history cannot be rewritten even with direct DB access.

## notifications — outbox
`order_id`, `user_id`, `channel` (EMAIL/SMS), `recipient`, `subject`, `body`,
`status` (QUEUED/SENT/FAILED), `provider` (resend/twilio/console), `error`.
Every notification attempt is persisted before delivery, giving a full audit
trail and a natural retry queue.

## Design notes

- **Money/weights as double precision** — acceptable for this scope; rounding is
  centralised in the pricing engine (`round2`). A production billing system would
  use integer paise.
- **Zone detection is data, not code** — adding a city means inserting zones +
  areas + rate cards via the admin UI/API. No deploys.
- **Agent availability is derived** (`status == AVAILABLE AND active_load <
  capacity`) rather than a mutable BUSY flag — no bookkeeping to drift out of
  sync.
