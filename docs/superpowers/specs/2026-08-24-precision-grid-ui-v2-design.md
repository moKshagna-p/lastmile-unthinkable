# LastMile Precision Grid UI v2

## Summary

Redesign the existing LastMile web application on `redesign/ui-v2` with a single Precision Grid visual system adapted to three jobs:

- customer surfaces are spacious and reassuring;
- admin surfaces are dense and analytical;
- rider surfaces are dark, high-contrast, and touch-first.

The direction takes inspiration from [Newtwen](https://www.awwwards.com/sites/newtwen), an Awwwards Honorable Mention from March 28, 2025. The relevant ideas are its disciplined grid, near-monochrome palette, oversized type, and single fluorescent accent. LastMile will use those principles for an operations product rather than copy Newtwen's marketing layouts or interactions.

## Goals

- Remove the repetitive visual motifs that make the current interface feel generated: dotted paper texture, dashed borders on most containers, tiny uppercase labels everywhere, stamp-like chips, rotated cards, and repeated entrance animations.
- Give LastMile one recognizable visual identity across public, customer, admin, and rider routes.
- Improve hierarchy and scan speed without changing any workflow, API call, permission rule, or data model.
- Make each role feel purpose-built while keeping shared controls and status language consistent.
- Preserve accessibility, responsive behavior, and existing error and loading paths.

## Non-goals

- No API, database, authentication, pricing, dispatch, or order-lifecycle changes.
- No new dashboard metrics or map implementation.
- No dark-mode toggle; the rider console owns a dark role theme because it is used in the field.
- No new illustration library, charting package, animation package, or component framework.
- No custom logo asset. The brand mark is a typographic `LASTMILE` wordmark.

## Visual system

### Palette

- canvas: `#F0F1EC`;
- elevated surface: `#FAFBF7`;
- ink: `#0A0B0A`;
- secondary ink: `#626760`;
- structural rule: `#C7CBC3`;
- signal green: `#38FF62` for primary actions, live movement, active navigation, and the most important current metric;
- failure red: `#D64032`;
- warning/reschedule amber: `#B57700`.

Green is an operational signal, not decoration. Most surfaces remain neutral. Failed and warning states keep dedicated semantic colors and always include text or icons so color is never the only cue.

### Typography

- Replace Space Grotesk with Archivo Black for the wordmark and major display moments.
- Keep IBM Plex Sans for body copy and controls.
- Keep IBM Plex Mono for waybills, prices, measurements, timestamps, and other tabular data.
- Use sentence case for normal labels. Uppercase and tracking are reserved for short navigational or operational metadata.
- Use large numbers only where they summarize real operational state.

### Shape, depth, and spacing

- Use square or minimally rounded corners, one-pixel rules, and no decorative shadows.
- Use the grid itself to group information. Cards appear only when a contained object needs a boundary.
- Remove dot textures, fake paper effects, rotated surfaces, barcode decoration, marquee text, pulsing dots, and repeated dashed rules.
- Keep generous whitespace on customer and public pages. Admin pages use tighter row heights and grouped data. Rider actions use at least 44px touch targets.

### Motion

- Remove the global staggered `rise` treatment and decorative marquee/pulse animations.
- Use short CSS transitions for hover, focus, button press, disclosure, and progress changes.
- Keep one signature motion: the order-progress rail advances when tracking data changes.
- Honor `prefers-reduced-motion`.

## Shared structure

The existing `Shell` remains the single authenticated role and navigation boundary. Its presentation becomes role-aware:

- admin: persistent left rail on desktop, compact top bar on small screens;
- customer: slim top navigation and wider, more spacious page headers;
- rider: dark compact header, shift state kept visible, primary action always easy to reach.

`Shell` continues to own session restoration, role redirects, and logout. The redesign does not move or duplicate authentication logic.

Shared UI primitives remain in `components/ui.tsx`. Existing primitives are restyled and simplified before any page-specific component is added. The status indicator, field wrapper, error note, spinner, stat, empty state, stepper, load bar, and duty toggle keep their current public interfaces unless a visual requirement cannot be met without a small prop.

## Route treatment

### Public and authentication

- `/`: a spacious Precision Grid landing page with a typographic wordmark, one direct headline, a live shipment proof panel, compact product proof, and clear login/register actions. Remove the feature-card wall, marquee, technology footer, rotated waybill, and exposed demo credentials from the main hero.
- `/login` and `/register`: split layouts with a short brand statement and a focused form. Demo credentials remain available on login inside a low-emphasis disclosure.
- error, global error, not-found: use the same wordmark, rule system, and direct recovery actions.

### Customer

- `/app`: lead with the current shipment or an empty-state action, followed by a quiet order list. Do not present admin-style metric tiles.
- `/app/new`: preserve the existing form and live quote behavior. Use three clear sections with a sticky quote panel on desktop and a sticky total action on mobile. Reduce nested cards and instructional microcopy.
- `/app/orders/[id]`: make the live status and route the primary story, followed by progress, rider/contact information, history, and charges. Rescheduling behavior remains unchanged.

### Admin

- `/admin`: use a dense overview grid with one oversized active-order metric, secondary fleet metrics, and an order table.
- `/admin/network`, `/admin/pricing`, `/admin/agents`: use consistent page headers, compact tables/forms, strong column alignment, and inline primary actions. Configuration pages should feel like one system rather than separate card collections.
- `/admin/orders/[id]`: prioritize operational state, assignment controls, route, immutable event history, and pricing details in that order.

### Rider

- `/agent`: use an ink-dark canvas with signal-green live state and primary scan action. Keep the duty switch visible, show each run as a focused task block, and emphasize address, phone, COD collection, and the next valid lifecycle action.
- Failure remains a clearly separate destructive action with a required reason.
- Existing GPS behavior and graceful fallback remain unchanged.

## Data flow and behavior

All existing client behavior remains in place:

1. `Shell` restores the session and redirects by role.
2. Pages load data through the existing SWR keys and `api` helper.
3. Forms and scan actions call the same endpoints with the same payloads.
4. Successful mutations refresh through the existing `mutate` or router flow.
5. Pricing is still revalidated server-side, and GPS remains optional for rider scans.

The redesign changes rendering and information hierarchy only. It does not add client state, caching, polling, or derived business logic.

## Loading, empty, and error states

- Loading states use a small inline indicator or reserved skeleton-like block without shifting the surrounding grid.
- Empty states contain one clear explanation and, when available, one primary next action.
- Errors use a bordered red block with plain-language copy and the existing retry/back action where available.
- Destructive actions and failed delivery states remain visually distinct from signal green.
- Session restoration continues to use an accessible live region.

## Responsive behavior

- Desktop admin navigation becomes a left rail at `lg` and above; below that it becomes a horizontally scrollable or compact menu in the top bar.
- Dense tables may scroll horizontally on small screens rather than hide critical columns without replacement.
- Customer grids collapse to one column with the most important action first.
- Rider screens remain single-column and thumb-friendly at all widths.
- Fixed mobile actions must account for safe-area insets and may not cover form errors or content.

## Accessibility

- Preserve semantic headings, labels, tables, lists, landmarks, and ARIA attributes already present.
- Maintain visible keyboard focus with an ink-and-green ring.
- Meet WCAG AA text contrast; fluorescent green is paired with ink text, not white.
- Keep status text alongside color and icons.
- Keep form labels persistent; placeholders never replace labels.
- Keep touch targets at least 44px on rider and mobile primary actions.

## Implementation boundaries

Prefer the smallest shared changes that update all routes:

1. replace design tokens and global component classes in `globals.css`;
2. update font setup in `layout.tsx`;
3. make `Shell` role-aware visually while preserving its auth behavior;
4. simplify shared primitives in `components/ui.tsx`;
5. update page composition only where global styles cannot establish the approved hierarchy.

Do not introduce a second component layer, design-token library, CSS-in-JS system, or new dependency. Existing Tailwind utilities and CSS variables are sufficient.

## Verification

- Run `bun test`, `bun run typecheck`, and `bun run build`.
- Exercise public, customer, admin, and rider routes with the existing demo accounts.
- Visually verify desktop and mobile widths for landing, auth, customer list/new/detail, admin overview/config/detail, and rider run sheet.
- Verify loading, empty, error, failed-delivery, reschedule, COD, and destructive-action states where test data permits.
- Confirm keyboard focus, responsive navigation, table overflow, sticky mobile actions, and reduced-motion behavior.

## Success criteria

- Every existing route uses the approved Precision Grid language.
- The shared shell visibly adapts to customer, admin, and rider tasks without feeling like three unrelated products.
- Existing workflows and role redirects still work.
- The interface no longer relies on repeated decorative motifs for personality.
- No new runtime dependency is added.
