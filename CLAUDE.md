# StreamFlows — Claude Code Project Brief

## What this app is

StreamFlows is a Next.js web app that surfaces real-time USGS water-flow data for ~1,500+ rivers across the northeastern US and Midwest. It is being redesigned from a generic river browser into a professional tool for fly fishing guides.

Full redesign scope is in `REDESIGN_PLAN.md` at the root of this repo.

---

## Tech stack (actual, not aspirational)

| Layer | Detail |
|---|---|
| Framework | Next.js 16.1.3, **App Router**, all data routes use `force-dynamic` |
| Language | TypeScript 5, strict mode |
| Auth + DB | Supabase (auth + Postgres). Client: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC/route handlers) |
| Styling | **Tailwind CSS v4** (not v3 — no `tailwind.config.ts`, config is in CSS). shadcn/ui primitives in `components/ui/`. CVA for variant logic. |
| Icons | `lucide-react` |
| Charts | `recharts` (already installed) |
| Date handling | `date-fns` (already installed) |
| State management | **React hooks only** — no Zustand, Redux, or Context. Keep it that way unless a feature genuinely requires it. |
| Cron jobs | Vercel crons defined in `vercel.json`. Hourly IV fetch, daily DV fetch. |

---

## Key file map

```
app/
  layout.tsx                  — Root layout. Fetches Supabase user, renders <Navigation> + <Footer>
  page.tsx                    — Marketing landing page (public)
  dashboard/
    page.tsx                  — Dashboard RSC. Auth-gated. Fetches favorites + 24h conditions + weather.
    dashboard-client.tsx      — Client component rendered by dashboard page.tsx
  rivers/
    page.tsx                  — River list page (public + authed)
    rivers-list.tsx           — Client-side list with filters
    [slug]/
      page.tsx                — River detail RSC
      river-detail.tsx        — Detail client component
  favorites/page.tsx          — Current favorites page (to be replaced by roster)
  alerts/
    page.tsx                  — Alerts page
    alerts-list.tsx           — Alerts client component
  account/
    page.tsx                  — Account RSC. Auth-gated server entry for settings/profile
    account-client.tsx        — Client component rendered by account page.tsx
  api/
    favorites/route.ts        — CRUD for user_favorites
    notes/route.ts            — CRUD for user_notes
    alerts/route.ts           — CRUD for user_alerts
    checkins/route.ts         — CRUD for river_checkins
    cron/
      fetch-data/route.ts     — Hourly IV data fetch (USGS → conditions table)
      fetch-daily/route.ts    — Daily DV data fetch
      calculate-ranges/route.ts
      detect-gauge-types/route.ts

components/
  navigation.tsx              — Top nav (to be replaced by sidebar for authed users)
  river-card.tsx              — River card component
  footer.tsx
  checkin-feed.tsx
  checkin-form.tsx
  weather-strip.tsx
  ui/                         — shadcn/ui primitives: badge, button, card, input, select, textarea

lib/
  types/database.ts           — All TypeScript interfaces: River, Condition, UserFavorite, UserNote, UserAlert, CheckIn, etc.
  river-utils.ts              — calculateStatus(), calculateTrend(), getStatusColor(), getStatusBorderColor(), getStatusDotColor(), formatFlow(), formatTemperature()
  flow-eta.ts                 — calculateFlowEta() — already works. Extends to 72h. Use this for Phase 3 forecasting.
  usgs.ts                     — fetchAllSites() — batches USGS IV/DV API calls in groups of 50
  auth.ts                     — shared server-side auth guard helpers (e.g. requireUser())
  weather.ts                  — fetchWeatherForRivers()
  supabase/client.ts
  supabase/server.ts
  utils.ts                    — cn() helper

supabase/
  functions/fetch-usgs-data/  — Edge function (not currently used in main cron path)
```

---

## Database tables (current schema)

```
rivers            — id, name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude, gauge_type, nwm_reach_id, action_stage, flood_stage, cwms_location_id, cwms_office, cwms_location_kind
conditions        — id, river_id, timestamp, flow, temperature, gage_height, status, trend
                    ← status CHECK constraint must include every value in RiverStatus type. Currently:
                       'optimal', 'elevated', 'high', 'low', 'ice_affected', 'no_data', 'unknown'
user_favorites    — id, user_id, river_id, created_at   ← legacy; new code uses user_roster
user_roster       — id, user_id, river_id, species, optimal_flow_min_override, optimal_flow_max_override,
                    access_notes, designation, sort_order, archived, created_at, updated_at
user_notes        — id, user_id, river_id, note, flow_at_save, temp_at_save, updated_at, created_at
user_alerts       — id, user_id, river_id, alert_type, threshold_value, is_active, created_at, updated_at
river_checkins    — id, river_id, user_id, flow_confirmed, conditions_rating, species_caught, flies_working, notes, is_public, fished_at, created_at
river_species     — id, river_id, species
trips             — id, user_id, trip_date, client_count, target_river_id, backup_river_id, status, ...
hatch_events      — id, river_id, insect, start_month, start_day, end_month, end_day, notes
```

User-level settings live in Supabase `auth.users.user_metadata` (a JSON blob), NOT in
a custom table:
- `home_region: string` (legacy, single-value) — written by beta signup
- `home_regions: string[]` (current) — written by beta signup + account page
- `full_name: string`

Always read home regions via `getUserHomeRegions()` in `lib/user-regions.ts`. It
normalizes both shapes to a string array and falls back to `[]` when neither is set.

All new migrations go in `supabase/migrations/` as timestamped SQL files. **Migrations
do not auto-apply on push to main** — Supabase's GitHub integration only runs them on
PR merges. For one-off main-branch pushes, run the SQL manually in Supabase Dashboard
→ SQL Editor.

---

## Known bugs (fix before anything else)

### 1. USGS -999,999 CFS sentinel — WRONG STATUS LABEL
**File:** `lib/river-utils.ts`, line 8
**Bug:** `if (flow === null || flow <= -999000) return 'ice_affected';`
**Fix:** Return `'no_data'` (a new status value), not `'ice_affected'`. Also update `getStatusLabel()` to return `'No Data'` for `'no_data'` and update `getStatusBorderColor()` / `getStatusDotColor()` / `getStatusColor()` to handle `'no_data'`.
**Also:** Add `'no_data'` to the `RiverStatus` type in `lib/types/database.ts`.
**Also:** `formatFlow()` in the same file returns `'N/A'` when flow is falsy, but `0` is falsy — fix the null check: `if (flow === null || flow === undefined)`.

### 2. Conditions table has no pruning cron
Records accumulate forever. Add a `/api/cron/prune-conditions` route that deletes conditions older than 72 hours, and register it in `vercel.json` as a daily cron (run at 3am UTC). The dashboard currently only queries 24h; extend that window to 72h to support forecasting (flow-eta.ts already supports this).

---

## Design conventions

- **Status colors:** Keep the existing green/amber/red system. `getStatusBorderColor()` returns left-border Tailwind classes — use these on river cards, not badge colors.
- **Left border pattern:** River cards use `border-l-4 ${getStatusBorderColor(status)}` as the primary status indicator. This is intentional — do not replace with badges.
- **Trend arrows:** Must be prominent text, not a secondary chip. Use `↑ Rising` / `→ Stable` / `↓ Falling` as labeled text alongside the trend arrow icon.
- **Typography:** Open Sans is the current font (`--font-sans`). River names should eventually use a serif/slab — do not change the font stack until Phase 4 unless the task specifically calls for it.
- **Mobile-first:** All new components must work at 390px without horizontal scroll. Sidebar collapses to a bottom drawer or icon rail on mobile (`md:` breakpoint as the expand point).
- **No marketing copy in the authed shell.** If a string sounds like a CTA or acquisition message, it does not belong inside the authenticated app layout.

---

## Auth pattern

The root layout (`app/layout.tsx`) fetches the Supabase user server-side and passes it to `<Navigation>`. Route-level auth guards use `redirect('/login')` in RSCs when `user` is null. Use `createClient()` from `lib/supabase/server.ts` in RSCs and route handlers; use `createClient()` from `lib/supabase/client.ts` in client components.

Cron routes are protected with `CRON_SECRET` env var checked against the `Authorization: Bearer` header or `?secret=` query param.

---

## Naming conventions

- **Rename "favorites" → "roster" / "My Rivers"** throughout as the redesign progresses. The DB table stays `user_favorites` until the migration in Phase 1 is applied; after that, use `user_roster` everywhere.
- API route files: `app/api/[resource]/route.ts`
- New page-level client components: `app/[route]/[route]-client.tsx`
- New utility libraries: `lib/[name].ts`
- New reusable UI components: `components/[name].tsx`
- New shadcn/ui primitives: `components/ui/[name].tsx`

---

## Environment variables (required, already set in Vercel + .env.local)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
OPEN_WEATHER_MAP_API_KEY   (used by lib/weather.ts)
```

---

## What already exists that you might not expect

- `lib/flow-eta.ts` — **Flow forecasting is already implemented.** `calculateFlowEta()` takes 24h of conditions and returns a plain-English ETA label ("Optimal in ~6h", "Leaving optimal in ~3h"). It caps at 72h. Phase 3 just needs to surface this on cards/detail pages — don't rewrite it.
- `getStatusBorderColor()` in `lib/river-utils.ts` — Left border color classes already exist.
- `recharts` — Already installed. Use it for any flow history charts.
- `date-fns` — Already installed. Use `format()`, `formatDistanceToNow()`, etc.
- `lucide-react` v0.562 — Already installed. All icons from here.

---

## Gotchas (read this before debugging "missing data" or "wrong status")

These are the operational landmines that have bitten us. Each one cost real time to
diagnose; future you will thank present you for skimming this list first.

### Conditions queries on the rivers page MUST be scoped to visible rivers
`app/rivers/page.tsx` once issued an unscoped `select('*').limit(10000)` against the
`conditions` table. With 1,500+ rivers updating hourly, 10k rows is only ~6 hours of
global data — home-region-scoped users would see most of their rivers as Unknown
because their conditions fell outside the slice. **Always pass the visible river IDs
through `.in('river_id', riverIds)` plus a time filter (currently 7d to accommodate
USGS DV publish lag).**

### `conditions.status` CHECK constraint must mirror the `RiverStatus` TS type
The TypeScript type and the Postgres CHECK constraint are two separate sources of
truth. Adding a new status value (e.g. `'no_data'`) requires both a TS edit *and* a
migration to drop+recreate `conditions_status_check`. Inserts that violate the
constraint fail silently inside the cron's per-row fallback and the affected rivers
appear permanently Unknown on the UI. If you ever see "Unknown" rivers that should
have data, check the cron's `errors[]` for `conditions_status_check` rejections
before anything else.

### Per-user optimal range overrides exist but are only honored on the river detail page
`user_roster.optimal_flow_min_override` and `_max_override` are real columns. The
detail page (`app/rivers/[slug]/page.tsx`) reads them and merges with the global
`rivers.optimal_flow_min/max` to produce an effective range that drives status calc,
ETA, NWM forecast, and chart shading. **The dashboard, rivers-list status counts, and
backup-river scorer all still use the global values only.** If you change roster
overrides anywhere, fix all three call sites or the user will see inconsistent
status across pages.

### `home_region` (singular) and `home_regions` (array) both exist
Legacy users have only `home_region: string` in `user_metadata`. Newer users get
`home_regions: string[]`. The account page writes both for backward compatibility.
**Never read either field directly.** Use `getUserHomeRegions(user)` from
`lib/user-regions.ts` — it normalizes both shapes and is the single source of truth.

### Supabase migrations don't auto-apply to prod from main pushes
The Supabase GitHub integration only runs migrations on PR merges (it creates a
preview branch per PR). When you push directly to main, **the migration file lands
in the repo but the prod database doesn't see it.** You have to run the SQL
manually in Supabase Dashboard → SQL Editor. This is a real footgun for "I'll just
push a quick migration" workflows.

### `detect-gauge-types` cron is too conservative
It probes USGS IV in default mode (latest sample only) with no P7D retry. Any
realtime gauge that briefly lapsed during the probe gets misclassified as `daily`,
which means the daily cron then can't get DV data for it (it's an IV-only gauge),
and the river ends up with no conditions at all. The `fetch-data` cron has the
correct retry-with-P7D logic; copy that pattern when you next touch detection.

### Empty USGS time series can create fake "fresh" no-data rows
USGS sometimes returns a `timeSeries` block for a station with zero observed values
inside `values[0].value`. If `lib/usgs.ts::parseUSGSResponse()` treats that as real
data and invents a "now" timestamp, the cron inserts a brand-new `conditions` row
with `flow=null`, `temperature=null`, `gage_height=null`, and `status='no_data'`.
The UI then prefers that newest row and masks the previous valid reading across the
rivers list, dashboard, sidebar, and river detail page. Skip series with no
observed values, and keep the page-level fallback that prefers the latest usable
condition over a newer empty placeholder row.

### Variable shadowing in long functions
`app/rivers/page.tsx::getRivers()` already has a `sevenDaysAgo` later in the
function for the check-ins query. If you add a second time-window const at the top,
**don't reuse the same name** — SWC rejects duplicate let-bindings in the same
scope and Next build fails. Use a distinct name like `conditionsCutoff`.

---

## Redesign phase tracker

Update this section after completing each task.

**Current phase:** Phase 4 — COMPLETE  
**Last completed task:** Multi-region home scoping + per-user optimal range overrides + conditions reliability fixes (2026-04-16)

### Phase 1 checklist — COMPLETE ✓
- [x] Fix -999,999 sentinel → `'no_data'` status (`lib/river-utils.ts`, `lib/types/database.ts`)
- [x] Fix `formatFlow()` null check (`lib/river-utils.ts`) — also fixed `formatTemperature()`
- [x] Add `/api/cron/prune-conditions` route + register in `vercel.json`
- [x] Extend dashboard conditions window from 24h → 72h (`app/dashboard/page.tsx`)
- [x] Write Supabase migration: `user_roster` table (`supabase/migrations/20260414000000_create_user_roster.sql`)
- [x] Write Supabase migration: add `flow_at_save` + `temp_at_save` to `user_notes`
- [x] Update `lib/types/database.ts` with new roster + note types
- [x] Create `/api/roster/route.ts` with GET/POST/PATCH/DELETE (`/api/favorites/route.ts` left in place)
- [x] Build `components/sidebar.tsx` — fixed 256px, status dots, nav links, last-synced timestamp
- [x] Update `app/layout.tsx` — sidebar for authed users, existing nav/footer for unauthed
- [x] Update `app/rivers/page.tsx` + `rivers-list.tsx` — My Rivers default, Discover toggle, no_data sorted to bottom
- [x] Simplify filter bar: region + species only for authed users
- [x] Deprioritize `no_data` / `unknown` rivers from default views

### Phase 2 checklist — COMPLETE ✓
- [x] Guide Dashboard — today's conditions panel (compact card row, left border color bar, CFS + temp + trend arrow, link to detail)
- [x] Guide Dashboard — next trip context bar (next trip date, forecasted condition, best backup river)
- [x] Guide Dashboard — alert feed (recent fired alerts as dismissible strip)
- [x] Guide Dashboard — quick notes chips (most recent note per river)
- [x] Trip Planner page (`app/trips/`) — list view of upcoming/past trips
- [x] Trip Planner — create/edit trip form (date, client count, target river, backup river, status)
- [x] Trip Planner — post-trip note with auto-filled conditions
- [x] Notes indexed to conditions — capture flow_at_save + temp_at_save when saving a note (`app/api/notes/route.ts`, note display on river detail)

### Phase 3 checklist — COMPLETE ✓
- [x] Backup river scoring — score roster rivers by status + trend + proximity, surface best backup with one-line rationale on dashboard and trip planner
- [x] Condition forecasting — surface calculateFlowEta() label on river cards and detail page
- [x] Trip window alerts — monitor upcoming trips, fire alert when conditions enter/leave optimal within 5 days of trip date
- [x] Alert history log — per river, show past fired alerts in addition to active ones
- [x] Sidebar alert badge count

### Phase 4 checklist — COMPLETE ✓
- [x] Hatch calendar — migration + API route + per-river editable hatch event list
- [x] Hatch calendar — seed data for Farmington CT, Deerfield MA, Battenkill VT and other prominent NE rivers
- [x] Hatch calendar — show current/upcoming hatches on dashboard card alongside live conditions
- [x] Condition history on river detail — "flows on this date last year / two years ago" via USGS historical API
- [x] Species and hatch panel on river detail page
- [x] "Set trip day" shortcut on river detail — opens trip planner pre-populated with that river

### Phase 3 checklist
*(unlock after Phase 2 is complete)*

### Phase 4 checklist
*(unlock after Phase 3 is complete)*

---

## Task session format

When starting a Claude Code session, use this format:

```
Working in StreamFlows repo. See CLAUDE.md for stack/conventions and REDESIGN_PLAN.md for full scope.

Task: [one specific thing]
Files to touch: [explicit list]
Files NOT to touch: [adjacent files to leave alone]
Done when: [specific verifiable outcome]
```

---

## Recent update — 2026-04-18

This repo just went through a QA hardening pass. Key outcomes:

- `/account` now follows the same server-side auth guard pattern as the rest of the protected app via `lib/auth.ts` and `app/account/account-client.tsx`.
- White-glove authenticated QA was run against production with a real test account; summary is captured in `QA_REPORT_2026-04-17.md`.
- `components/checkin-feed.tsx` was fixed to render from parent-owned state so newly logged trips/check-ins appear immediately without a reload.
- `lib/usgs.ts`, `app/api/cron/fetch-data/route.ts`, and `app/api/cron/fetch-daily/route.ts` now ignore empty USGS series instead of inserting fresh all-null `conditions` rows.
- `app/rivers/page.tsx`, `app/dashboard/page.tsx`, `app/layout.tsx`, and `app/rivers/[slug]/page.tsx` now prefer the latest usable condition so a newer placeholder row does not mask an older valid reading.
- Production data inspection during QA found that `Battenkill River` is currently mapped to USGS station `01332500`, which USGS identifies as `HOOSIC RIVER NEAR WILLIAMSTOWN, MA`; treat that station mapping as suspect until corrected.

### Additional missing-data gotcha

USGS can return a `timeSeries` block for a station with zero observed values in
`values[0].value`. If `lib/usgs.ts::parseUSGSResponse()` treats that as real data
and invents a "now" timestamp, the cron inserts a brand-new `conditions` row with
`flow=null`, `temperature=null`, `gage_height=null`, and `status='no_data'`. The
UI then prefers that newest row and masks the previous valid reading across the
rivers list, dashboard, sidebar, and river detail page. Skip series with no
observed values, and keep the page-level fallback that prefers the latest usable
condition over a newer empty placeholder row.
