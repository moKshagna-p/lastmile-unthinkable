# System Design — LastMile Delivery Tracker

## Rate calculation engine

Pricing is a pure function over admin-owned configuration, never code. Given an
order request, the engine (`apps/api/src/lib/pricing.ts`) executes six steps.
First, **zone detection**: both pickup and drop pincodes resolve to rows in
`areas`, each hard-linked to exactly one zone — so a mapping is total and
deterministic by construction (unique pincode constraint). Second,
**volumetric weight** is computed as L×B×H ÷ 5000 (the industry divisor),
rounded to two decimals. Third, **billable weight** is the higher of actual and
volumetric weight, rounded *up* to the next 0.5 kg slab, because carriers never
bill fractional slabs downwards. Fourth, the engine looks up the **active rate
card** for the tuple (pickup zone → drop zone, order type). Intra-zone pricing
is simply a card whose from- and to-zones are equal; inter-zone lanes are
separate rows. B2B and B2C never share cards. If no card exists for a lane, the
API returns a 422 naming the missing lane — surfacing a configuration gap rather
than silently guessing a price. Fifth, **freight** = base price + chargeable
weight × per-kg rate, where chargeable weight is billable weight minus the
card's included base weight. Sixth, if payment type is COD, a **surcharge** of
`codAmount × percent ÷ 100 + flat fee` is read from the per-order-type COD
config and added. The response is a full breakdown — volumetric, billable, card
name, freight, surcharge, total — which the web app renders as a live quote that
recomputes (debounced) as the customer types. The same function runs again
server-side on order creation; client-supplied totals are never trusted, so the
charge on the persisted order is always engine-authoritative.

## Zone detection approach

Zones are operational partitions; areas are the join between the real world
(pincodes) and those partitions. Admins manage both from the Network screen:
create a zone, then map six-digit pincodes to it with a centroid lat/lng. The
centroid does double duty — it anchors auto-assignment distance math. Because
pincode uniqueness is enforced at the schema level, detection can never be
ambiguous: one pincode, one zone, one rate lane. Extending coverage is purely
data entry — new city, new zones, new cards — with zero deploys.

## Auto-assignment logic

Agents are users with a role-scoped profile: live coordinates (updated on every
status scan and via a dedicated location endpoint), a duty toggle
(AVAILABLE/OFFLINE), a home zone, and a capacity. Availability is *derived*, not
stored: an agent is assignable when on duty and their active load (orders in
ASSIGNED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY or RESCHEDULED) is below
capacity. This avoids BUSY-flag bookkeeping that drifts out of sync. The scorer
filters candidates by a hard radius (25 km default) from the pickup area's
centroid, applies a 30 % effective-distance discount to agents whose home zone
matches the pickup zone, adds a mild penalty per active parcel, and picks the
minimum. The result is behaviour that "just makes sense" — local, unburdened
riders win — while remaining explainable: every assignment event records whether
it was automatic and which agent was chosen. Admins can override with manual
pinning at any point before pickup.

## Order status lifecycle & immutable history

The lifecycle is a state machine in the shared package:
PLACED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED,
with FAILED branching from any in-flight state, RESCHEDULED as its recovery
successor, and CANCELLED available to admins pre-pickup. A single service
(`applyStatusChange`) validates transitions inside a database transaction,
appends a tracking event (actor id, role, name, note, metadata), updates the
order, and enqueues customer notifications — so state, ledger and comms can
never diverge. Immutability of history is not just an application convention: a
Postgres trigger raises on any UPDATE or DELETE against `tracking_events`,
making the ledger tamper-proof even for direct DB access.

## Failed-delivery handling

When a rider reports FAILED (reason mandatory), three things happen atomically:
the reason is stored, the customer receives email + SMS explaining the failure
and offering reschedule, and the order enters FAILED. The customer (or admin)
then picks a new date; `rescheduleOrder` moves the order to RESCHEDULED,
increments `reschedule_count`, clears the assignment, notifies the customer with
the confirmed date, and immediately re-runs the assignment scorer so a fresh
nearest agent is locked for the retry attempt. Each retry is a first-class
ledger entry, so the full attempt chain remains auditable end-to-end.

*(≈790 words)*
