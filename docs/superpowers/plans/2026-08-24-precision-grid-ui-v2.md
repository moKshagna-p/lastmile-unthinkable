# Precision Grid UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing generated-looking visual layer with the approved Precision Grid system across every web route while preserving all current behavior.

**Architecture:** Keep the existing Next.js pages, SWR data flow, auth guard, and shared component boundaries. Establish the new look through global tokens and shared primitives first, make the existing `Shell` visually role-aware through a `data-role` attribute, then adjust page composition only where each role needs a different information density.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, CSS variables, `next/font`, Bun tests, existing Lucide icons.

**Spec:** `docs/superpowers/specs/2026-08-24-precision-grid-ui-v2-design.md`

## Global Constraints

- Preserve every API call, SWR key, mutation, auth redirect, role check, form payload, pricing calculation, scan transition, reschedule flow, and GPS fallback.
- Add no runtime dependency, component framework, chart library, animation library, or custom logo asset.
- Use `#F0F1EC` canvas, `#FAFBF7` surface, `#0A0B0A` ink, `#626760` secondary ink, `#C7CBC3` rules, `#38FF62` signal green, `#D64032` failure red, and `#B57700` warning amber.
- Use Archivo Black for major display moments, IBM Plex Sans for body and controls, and IBM Plex Mono for operational data.
- Signal green is reserved for primary actions, live movement, active navigation, and the most important current metric.
- Keep visible focus, persistent labels, text alongside semantic color, 44px mobile/rider actions, safe-area-aware fixed actions, and reduced-motion behavior.
- Prefer shared CSS and existing primitives over new components or abstractions.

## Spec Coverage

- Visual system, type, palette, shape, and motion: Task 1.
- Shared structure and public/authentication routes: Task 2.
- Customer routes: Task 3.
- Admin routes: Task 4.
- Rider route and role theme: Task 5.
- Loading, empty, error, responsive, accessibility, and final verification: Tasks 1–6, with complete route checks in Task 6.

---

### Task 1: Precision Grid foundation

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/ui.tsx`

**Interfaces:**
- Consumes: existing `Stamp`, `Micro`, `Field`, `ErrorNote`, `Spinner`, `Stat`, `EmptyState`, `Stepper`, `LoadBar`, and `DutyToggle` component signatures.
- Produces: CSS variables `--color-canvas`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-rule`, `--color-signal`, `--color-stop`, and `--color-hold`; role-neutral classes `.card`, `.btn`, `.field`, `.label`, `.status`, `.stat`, `.table-wrap`, and `.page-head`.

- [ ] **Step 1: Record the clean baseline**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS before the visual-only refactor.

- [ ] **Step 2: Replace the font setup**

```tsx
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-display-src",
  weight: "400",
});
```

Keep the current Plex font declarations and apply `archivoBlack.variable` to `<body>` instead of `spaceGrotesk.variable`.

- [ ] **Step 3: Replace the global tokens and shared classes**

Start `globals.css` with the approved tokens and a flat canvas:

```css
@theme {
  --color-canvas: #f0f1ec;
  --color-surface: #fafbf7;
  --color-ink: #0a0b0a;
  --color-muted: #626760;
  --color-rule: #c7cbc3;
  --color-signal: #38ff62;
  --color-stop: #d64032;
  --color-hold: #b57700;
  --font-display: var(--font-display-src), "Arial Black", sans-serif;
  --font-sans: var(--font-plex-sans), sans-serif;
  --font-mono: var(--font-plex-mono), monospace;
}

body { color: var(--color-ink); background: var(--color-canvas); }
.card { background: var(--color-surface); border: 1px solid var(--color-ink); }
.btn-primary { background: var(--color-signal); color: var(--color-ink); }
```

Delete paper texture, shadows, rotated decoration, marquee, global staggered reveals, pulsing dots, and pervasive dashed rules. Keep focus, reduced-motion, status, stepper, table, toggle, and load-bar behavior with the new tokens.

- [ ] **Step 4: Simplify shared primitives without changing their props**

Restyle existing JSX around `.status`, `.stat`, `.empty-state`, and `.progress-track`. Keep `Barcode` temporarily because the old landing page still imports it. Keep lifecycle index logic, capacity math, and duty-switch ARIA unchanged.

- [ ] **Step 5: Run the type check**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the foundation**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css apps/web/src/components/ui.tsx
git commit -m "refactor(ui): establish precision grid system"
```

### Task 2: Role-aware shell and public routes

**Files:**
- Modify: `apps/web/src/components/shell.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Modify: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/global-error.tsx`
- Modify: `apps/web/src/app/not-found.tsx`

**Interfaces:**
- Consumes: Task 1 tokens/classes and existing `Shell({ role, title, children })` props.
- Produces: `.app-shell[data-role="admin|customer|agent"]`, `.shell-rail`, `.shell-top`, `.public-nav`, `.public-hero`, and `.auth-layout` surfaces used by later tasks.

- [ ] **Step 1: Record the clean baseline**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS before the markup refactor.

- [ ] **Step 2: Make the existing shell visually role-aware**

Keep session and redirect code untouched. Change only the rendered structure:

```tsx
<div className="app-shell" data-role={user.role.toLowerCase()}>
  <aside className="shell-rail">...</aside>
  <div className="shell-stage">
    <header className="shell-top">...</header>
    <main className="shell-content">{children}</main>
  </div>
</div>
```

Render the rail only for admin desktop through CSS; customer and rider use the compact top header. Reuse the current `NavLinks` array and logout function.

- [ ] **Step 3: Rewrite the landing and auth composition**

Use one hero, one live-shipment proof panel, one concise product proof grid, and one role section. Remove the marquee, rotated waybill, barcode, technology footer, and hero demo-credential block. Delete the now-unused `Barcode` export from `components/ui.tsx`. Keep `/login` and `/register` links and retain demo accounts only inside login `<details>`.

Wrap auth pages in:

```tsx
<main className="auth-layout">
  <section className="auth-brand">...</section>
  <form className="auth-form">...</form>
</main>
```

Do not change submit handlers, field validation, or role routing.

- [ ] **Step 4: Align error routes**

Use the typographic wordmark, direct error heading, existing error details, and one recovery action. Preserve reset and navigation behavior.

- [ ] **Step 5: Run checks and commit**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS.

```bash
git add apps/web/src/components/shell.tsx apps/web/src/components/ui.tsx apps/web/src/app/page.tsx apps/web/src/app/login/page.tsx apps/web/src/app/register/page.tsx apps/web/src/app/error.tsx apps/web/src/app/global-error.tsx apps/web/src/app/not-found.tsx
git commit -m "feat(ui): redesign shell and public routes"
```

### Task 3: Customer experience

**Files:**
- Modify: `apps/web/src/app/app/page.tsx`
- Modify: `apps/web/src/app/app/new/page.tsx`
- Modify: `apps/web/src/app/app/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: customer `Shell`, shared status/field/error/stepper primitives, and all existing SWR/API behavior.
- Produces: spacious customer index, three-section order form with `.quote-panel`, and status-first tracking detail.

- [ ] **Step 1: Record the baseline type check**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS before customer markup changes.

- [ ] **Step 2: Recompose the customer order list**

Use `.page-head` for greeting and primary action, show the newest shipment as the dominant row, and render remaining orders as a restrained list. Keep the existing fetch, empty state, links, status labels, values, and loading/error branches.

- [ ] **Step 3: Recompose new-order sections**

Keep all form state, quote timing, validation, pricing explanation, and submit behavior. Change only layout to:

```tsx
<form id="new-order-form" className="order-builder" onSubmit={submit}>
  <div className="order-fields">...</div>
  <aside className="quote-panel">...</aside>
</form>
```

Use three numbered section headers, flat rule-separated field groups, sticky desktop quote, and existing mobile sticky total. Remove decorative route stamps, nested cards, and repeated microcopy.

- [ ] **Step 4: Recompose tracking detail**

Order the page as status/waybill, route, progress, assigned rider/failure recovery, history, and charges. Preserve reschedule modal state and submission unchanged. Use the progress rail as the only signature motion.

- [ ] **Step 5: Verify and commit customer routes**

Run: `bun run --filter='@lastmile/web' typecheck && bun test`

Expected: PASS.

```bash
git add apps/web/src/app/app/page.tsx apps/web/src/app/app/new/page.tsx apps/web/src/app/app/orders/[id]/page.tsx
git commit -m "feat(ui): redesign customer flows"
```

### Task 4: Admin operations

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/admin/network/page.tsx`
- Modify: `apps/web/src/app/admin/pricing/page.tsx`
- Modify: `apps/web/src/app/admin/agents/page.tsx`
- Modify: `apps/web/src/app/admin/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: admin rail from Task 2, shared stats/tables/statuses from Task 1, and existing admin endpoints.
- Produces: consistent dense admin headers, overview grid, configuration tables/forms, and operational order detail.

- [ ] **Step 1: Record the baseline admin type check**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS.

- [ ] **Step 2: Redesign the overview hierarchy**

Use one oversized active-order metric, compact secondary metrics, and a full-width order table. Keep every value, link, fetch branch, and status unchanged.

- [ ] **Step 3: Unify network, pricing, and agent configuration**

Use `.page-head`, `.table-wrap`, `.config-grid`, and `.inline-form` consistently. Keep all existing create/update handlers, validation, mutation, loading, and error behavior. Do not extract new form abstractions.

- [ ] **Step 4: Reorder admin order detail**

Present operational status and assignment controls first, then route, event history, and pricing. Preserve assignment/override actions and immutable-history messaging.

- [ ] **Step 5: Verify and commit admin routes**

Run: `bun run --filter='@lastmile/web' typecheck && bun test`

Expected: PASS.

```bash
git add apps/web/src/app/admin/page.tsx apps/web/src/app/admin/network/page.tsx apps/web/src/app/admin/pricing/page.tsx apps/web/src/app/admin/agents/page.tsx apps/web/src/app/admin/orders/[id]/page.tsx
git commit -m "feat(ui): redesign admin operations"
```

### Task 5: Rider console and application states

**Files:**
- Modify: `apps/web/src/app/agent/page.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `.app-shell[data-role="agent"]`, existing duty switch, load bar, status, errors, and unchanged scan/GPS functions.
- Produces: dark rider canvas, touch-first run cards, signal-green scan actions, and distinct red failure workflow.

- [ ] **Step 1: Record the rider baseline**

Run: `bun run --filter='@lastmile/web' typecheck`

Expected: PASS.

- [ ] **Step 2: Apply the rider role theme in CSS**

```css
.app-shell[data-role="agent"] {
  --role-canvas: #0a0b0a;
  --role-surface: #121512;
  --role-ink: #f0f1ec;
  color: var(--role-ink);
  background: var(--role-canvas);
}
```

Scope field, card, rule, muted text, and header overrides to the rider role rather than adding conditionals throughout JSX.

- [ ] **Step 3: Recompose each run as an action surface**

Keep duty toggle, capacity, COD calculation, valid next actions, failure reason, GPS lookup, endpoint calls, and mutate behavior unchanged. Emphasize in order: waybill/status, address, phone, COD amount, next valid scan, then failure.

- [ ] **Step 4: Verify and commit rider changes**

Run: `bun run --filter='@lastmile/web' typecheck && bun test`

Expected: PASS.

```bash
git add apps/web/src/app/agent/page.tsx apps/web/src/app/globals.css
git commit -m "feat(ui): redesign rider console"
```

### Task 6: Full verification and visual cleanup

**Files:**
- Modify only files with verified visual or responsive defects found in this task.

**Interfaces:**
- Consumes: completed public, customer, admin, and rider UI.
- Produces: a fully verified branch with no old visual motifs or broken responsive states.

- [ ] **Step 1: Run repository verification**

Run: `bun test && bun run typecheck && bun run build`

Expected: all commands exit 0.

- [ ] **Step 2: Search for stale motifs**

Run:

```bash
rg -n "rise-[1-5]|marquee|route-dash|stamp-|paper-2|fffdf8|e8500a|Space_Grotesk|Barcode" apps/web/src
```

Expected: no results except intentional compatibility names documented in shared primitive code; remove any decorative leftovers.

- [ ] **Step 3: Exercise all role flows in the running app**

At desktop and mobile widths, inspect:

- `/`, `/login`, `/register`, and error/not-found states;
- customer `/app`, `/app/new`, and one `/app/orders/[id]`;
- admin `/admin`, network, pricing, agents, and one order detail;
- rider `/agent`, including duty, COD, next scan, and failure form.

Confirm focus visibility, status readability, horizontal table overflow, sticky quote/action bars, reduced motion, loading, empty, error, and reschedule states.

- [ ] **Step 4: Fix only verified defects and rerun verification**

Run: `bun test && bun run typecheck && bun run build`

Expected: all commands exit 0 after cleanup.

- [ ] **Step 5: Commit verified cleanup if needed**

```bash
git add apps/web/src
git commit -m "fix(ui): polish responsive precision grid"
```

Skip this commit when Step 4 required no changes.
