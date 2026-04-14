# StreamFlows Redesign Plan

**Project**: Redesign StreamFlows to enable professional river guides with trip planning, forecasting, and contextual alerts.

**Current Date**: April 14, 2026  
**Next.js Version**: 16.1.3 (App Router, force-dynamic mode for real-time data)  
**Auth**: Supabase (email/password)  
**DB**: Supabase PostgreSQL  
**Styling**: Tailwind CSS v4 with PostCSS

---

## AUDIT FINDINGS

### 1. Framework & Routing
- **Next.js 16.1.3** with App Router (`app/` directory)
- All routes marked `force-dynamic` to ensure real-time USGS data
- Key pages:
  - `/` — marketing landing page (unauthenticated)
  - `/login`, `/signup`, `/reset-password`, `/forgot-password` — auth
  - `/rivers` — list all ~1,500 rivers (full discovery mode)
  - `/rivers/[slug]` — river detail page with 24h history, angler check-ins, notes
  - `/dashboard` — authenticated user view of favorited rivers (currently minimal)
  - `/favorites` — alternate view of favorited rivers
  - `/alerts` — user alert management
  - `/admin/seed` — data seeding endpoint
  - `/share/[slug]` — public shareable river view

### 2. USGS Data Fetching & Normalization
- **Location**: `lib/usgs.ts`
- **Cron jobs**:
  - `app/api/cron/fetch-data/route.ts` — fetches real-time IV (instantaneous value) data every 15 min
  - `app/api/cron/fetch-daily/route.ts` — fetches DV (daily value) data
  - Fetches parameter codes: `00060` (flow/CFS), `00010` (temperature/Celsius → converted to °F), `00065` (gage height)
- **Data model**: 
  - `Condition` table stores: `river_id`, `timestamp`, `flow`, `temperature`, `gage_height`, `status` (computed), `trend` (computed)
  - Status computed at fetch time by `calculateStatus()` in `lib/river-utils.ts`
  - Trend computed by comparing current flow to flow 3 hours ago: `calculateTrend()`
- **Sentinel handling**:
  - USGS returns `-999,999` CFS (and similar) for missing/error data
  - Currently caught in `river-utils.ts` line 8: `if (flow === null || flow <= -999000) return 'ice_affected'`
  - **ISSUE**: Not explicitly caught at fetch stage; labeled as 'ice_affected' rather than displayed as "No data"
  - Historical retention: Only last 24–48h of conditions visible on detail page (`[slug]/page.tsx` fetches 24h range)
  - **No explicit 48–72h rolling window** — conditions table grows indefinitely; older data not pruned

### 3. User Data Persistence
- **Current state**: Supabase PostgreSQL + SSR with session cookies
- **Models**:
  - `user_favorites` — river_id + user_id (simple boolean "is favorite")
  - `user_notes` — per-river free-form text note + timestamps
  - `user_alerts` — alert_type (optimal_flow | flow_threshold | temperature), threshold_value, is_active
  - `river_checkins` — angler check-in data: conditions_rating (poor|fair|good|excellent), species_caught[], flies_working, notes, is_public, fished_at
- **No concept of**:
  - River roster metadata (target species, access notes, primary/backup designation)
  - Trip planning (dates, clients, expected conditions)
  - Hatch calendar
  - Condition history with timestamp (notes are not keyed to specific condition snapshots)
- **Cross-device**: Works via Supabase auth; session persists across devices

### 4. Auth Model
- **Supabase Auth** (email/password)
- Server-side session via cookies (`lib/supabase/server.ts`)
- Client-side session via `createClient()` in `lib/supabase/client.ts`
- Protected routes redirect to `/login` via `redirect()` in server components
- No role-based access control (no admin/guide distinction)
- All users are equal; favorites and alerts are per-user

### 5. Component Structure
- **UI Primitives** (`components/ui/`):
  - `button.tsx` — CVA-based button with variants (solid, outline, ghost, etc.)
  - `card.tsx` — basic Card + CardContent wrapper
  - `badge.tsx` — status/tag badges with color variants
  - `input.tsx`, `textarea.tsx`, `select.tsx` — form elements
- **Reusable Components**:
  - `river-card.tsx` — displays river name, region, status badge, flow, temp, species badges, trend icon, last updated time, favorite toggle
  - `navigation.tsx` — sticky top nav with logo, links (Rivers, Dashboard, Favorites, Alerts), auth area
  - `footer.tsx` — minimal footer
  - `checkin-form.tsx` — form for logging a trip (conditions rating, flow accuracy, species, flies, notes, visibility)
  - `checkin-feed.tsx` — displays recent check-ins on detail page
  - `weather-strip.tsx` — weather forecast for a river
- **Page-specific logic**: Most components are either server components (pages) or 'use client' with inline state (rivers-list.tsx, alerts-list.tsx)

### 6. Data Models (TypeScript Types)
- **River**
  ```ts
  interface River {
    id: string;
    name: string;
    slug: string;
    usgs_station_id: string;
    region: string; // e.g., "Connecticut", "Massachusetts"
    description?: string;
    optimal_flow_min?: number; // CFS
    optimal_flow_max?: number;
    latitude?: number;
    longitude?: number;
    created_at: string;
    updated_at: string;
  }
  ```
- **Condition**
  ```ts
  interface Condition {
    id: string;
    river_id: string;
    timestamp: string;
    flow?: number; // CFS, can be null or sentinel
    temperature?: number; // °F
    gage_height?: number; // feet
    status?: RiverStatus; // 'optimal' | 'elevated' | 'high' | 'low' | 'ice_affected' | 'unknown'
    trend?: FlowTrend; // 'rising' | 'falling' | 'stable' | 'unknown'
    created_at: string;
  }
  ```
- **RiverStatus**: `'optimal' | 'elevated' | 'high' | 'low' | 'ice_affected' | 'unknown'`
- **FlowTrend**: `'rising' | 'falling' | 'stable' | 'unknown'`

### 7. State Management
- **React hooks only**: `useState`, `useMemo` in client components
- **Supabase** for server-side data fetching and mutations
- No global state (Zustand, Redux, Context)
- Each page fetches its own data via server components or client-side API calls

### 8. Styling System
- **Tailwind CSS v4** with PostCSS
- **CVA** (class-variance-authority) for component variants
- **Color system**:
  - Primary: blue (emerald for "optimal" status; amber for "elevated"; red for "high"; blue for "low"; slate for "ice_affected")
  - Background/foreground/muted-foreground semantic tokens
  - Responsive classes: `sm:`, `md:`, `lg:` breakpoints
- **No dark mode** currently; light-only theme

### 9. The -999,999 CFS Sentinel
- **Handled in `lib/river-utils.ts` line 8**:
  ```ts
  if (flow === null || flow <= -999000) return 'ice_affected';
  ```
- **Issue**: Mislabeled as "ice_affected" (which maps to "Gauge Not Responding"); should be distinct
- **Current display**: Badge shows "Gauge Not Responding" on cards/detail
- **Recommendation**: Rename sentinel catch to explicit "no_data" status; update label to "No Data"

### 10. Existing Route Structure
- **Public routes**: `/`, `/rivers`, `/rivers/[slug]`, `/share/[slug]`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
- **Protected routes** (redirect to /login if no user): `/dashboard`, `/favorites`, `/alerts`, `/admin/seed`
- **API routes**: `/api/favorites`, `/api/notes`, `/api/alerts`, `/api/checkins`, `/api/cron/*`, `/api/seed`, `/auth/callback`, `/auth/signout`

### 11. Performance & Data Caching
- **No SWR or React Query**; all data fetched at request time
- **Cron jobs** run every 15 min (IV) and daily (DV) to populate conditions
- **No stale-while-revalidate or incremental static regeneration**
- **Client-side filtering** (rivers-list.tsx) re-computes on every render (useMemo mitigates, but no caching)

---

## ARCHITECTURAL DECISIONS REQUIRED BEFORE CODING

### Decision 1: User Data Persistence & Auth – Recommendation: Supabase (status quo)

**Current**: Supabase Auth + Supabase DB (PostrgreSQL)

**Options Evaluated**:
1. **Supabase (status quo)** — Auth, DB, realtime, storage in one platform
   - ✅ Already integrated; low switching cost
   - ✅ Edge functions for server-side tasks
   - ✅ Row-level security (RLS) for multi-tenant data
   - ✅ Realtime API (though not currently used)
   - ✅ Dashboard/CLI tooling mature
   - ✅ Free tier includes 500k rows + 2GB storage
   - ❌ Vendor lock-in (though extraction is possible via SQL backups)
   - ❌ No built-in task scheduling (uses Vercel/external cron)
   - **Cost**: Free tier, then ~$25–50/mo for pro (auth, DB, storage)

2. **Clerk + Neon/PlanetScale** — Managed auth + managed DB
   - ✅ Cleaner auth UX (social login, MFA, OIDC)
   - ✅ Neon: PostgreSQL on demand, cheap
   - ❌ Requires custom session handling
   - ❌ Separate vendors (more moving parts)
   - **Cost**: Clerk free tier + Neon $0.10/compute-hour

3. **NextAuth v5 + Prisma + Postgres** — Self-managed auth in Next.js
   - ✅ Full control; can self-host
   - ✅ Prisma ORM reduces boilerplate
   - ❌ More code to maintain
   - ❌ Self-hosting complexity (if desired)
   - ❌ Session / token management overhead
   - **Cost**: Self-host on Render/Railway ($7–20/mo) or Vercel ($0–20/mo for DB addon)

**Recommendation**: **Stay with Supabase**
- Least friction for a solo developer
- Auth + DB + realtime in one platform
- RLS policies enable multi-user safety
- Free tier sufficient for launch; scaling is straightforward
- Already working; switching costs outweigh benefits for launch phase

---

### Decision 2: 48–72h Rolling Readings per River

**Current**: All conditions stored indefinitely; only last 24h fetched on detail page

**Need**: Historical flow data for forecasting, "what were conditions on this date last year?" on detail page, trend calculation

**Options**:
1. **Client-side SWR cache with 72h retention**
   - ✅ Simple; no server changes
   - ✅ Lightweight
   - ❌ Lost on page reload; per-user cache duplicates data
   - ❌ Doesn't solve "historical USGS API on demand" problem
   - ❌ Insufficient for 7-day angler check-in aggregation (already working, so not an issue)

2. **Server-side cron + 72h conditions table with TTL**
   - ✅ Permanent record; scales to millions of readings
   - ✅ Enables forecasting and historical queries
   - ✅ Supabase can prune old rows via triggers or edge function cron
   - ✅ Detail page can query last 72h efficiently
   - ❌ Conditions table grows: ~1,500 rivers × 96 readings/day × 72 days = ~10M rows (manageable)
   - **Cost**: Supabase free tier is 500k rows; this exceeds it; requires pro ($25+/mo)

3. **Fetch historical data on-demand from USGS**
   - ✅ No local storage; authoritative source
   - ✅ Costs paid by USGS, not us
   - ❌ Adds latency to detail page load
   - ❌ Rate-limited by USGS (unknown limits; docs vague)
   - ❌ Historical API might be unavailable for some stations
   - ✅ Hybrid: store last 72h locally; fetch older data on-demand

**Recommendation**: **Hybrid approach**
1. **Server-side cron** (`fetch-data` job) continues writing conditions every 15 min
2. **Add a cron cleanup job** that deletes conditions older than 72 hours (once per day)
3. **Detail page** fetches last 72h of conditions (instead of current 24h) for forecasting
4. **Historical queries** (e.g., "conditions on this date last year") call USGS DV API on-demand
5. **Implementation**:
   - Update `app/api/cron/fetch-data/route.ts` line 27–33 to reduce fetch window
   - Create `app/api/cron/prune-conditions/route.ts` (call daily)
   - Update `app/rivers/[slug]/page.tsx` line 36 to fetch 72h instead of 24h
   - Create `lib/usgs-historical.ts` for on-demand historical queries

**Why not option 2 alone?** Because deleting old data might break retention; option 1 keeps Supabase costs reasonable.

---

### Decision 3: USGS Historical Data Access

**Endpoint**: USGS IV (instantaneous) and DV (daily value) APIs
- **IV**: `https://waterservices.usgs.gov/nwis/iv/` — real-time, 15-min intervals
- **DV**: `https://waterservices.usgs.gov/nwis/dv/` — daily aggregate (min/max/mean)
- **Documentation**: https://waterservices.usgs.gov/docs/

**For "What were flows on April 15, 2025?"**:
- Call DV API with `startDT=2025-04-15` and `endDT=2025-04-15` to get daily mean
- Or call IV API with date range to get all 15-min readings and aggregate client-side

**Implementation**:
1. Create `lib/usgs-historical.ts`:
   ```ts
   export async function fetchUSGSHistoricalDaily(
     stationId: string,
     date: Date // YYYY-MM-DD
   ): Promise<DailyFlowData | null>
   ```
2. Call from detail page (`[slug]/page.tsx`) **on-demand** when user clicks "Historical" or "Compare to last year"
3. Cache result in Supabase `condition_history` table (optional, for repeated queries)
4. Display in detail page: "On this date last year: 234 CFS (mean), 52°F"

**Rate limits**: USGS docs don't specify; assume friendly limits for non-commercial use. Add error handling.

---

### Decision 4: Hatch Calendar Evolution Path

**Goal**: User-editable per-river hatch events (insect type, seasonal window, water temp trigger, notes)

**Phase 4 Approach**: Static seed data → User edits via UI

**Data Model**:
```ts
interface HatchEvent {
  id: string;
  river_id: string;
  insect_name: string; // "BWO", "Hex", "Caddis", etc.
  category: string; // "mayfly" | "caddis" | "stonefly" | "midge" | "terrestrial"
  start_month: number; // 1–12
  start_day: number;
  end_month: number;
  end_day: number;
  peak_month: number; // optional
  peak_day: number; // optional
  water_temp_min?: number; // °F; optional trigger
  water_temp_max?: number;
  notes?: string;
  user_created?: boolean; // distinguishes seed from user edits
  created_at: string;
  updated_at: string;
}
```

**Implementation Path**:
1. **Phase 4 Start**: Add `hatch_events` table to Supabase schema
2. **Seed data**: Script populates ~5–10 hatches for Farmington CT, Deerfield MA, Battenkill VT, etc.
   - File: `supabase/seed-hatches.sql` or `scripts/seed-hatches.ts`
3. **Detail page** (`[slug]/page.tsx`): Query hatches; display current/upcoming on card
4. **User edits**: Create `app/rivers/[slug]/hatch-editor.tsx` component (Phase 4)
   - Add hatch: POST `/api/hatches` with river_id + details
   - Edit: PATCH `/api/hatches/:id`
   - Delete: DELETE `/api/hatches/:id`
   - RLS policy: users can only edit hatches marked `user_created=true` by them
5. **Conflict handling**: If seed hatch exists, user can override with a user_created hatch; display both with badge

**File**: `supabase/seed/hatch-events.json` (structured seed data for easy bulk import)

---

### Decision 5: Mobile-First at 390px

**Risk Areas**:
- Dashboard card row (Phase 2: "Today's conditions panel") with 5+ rivers
- Filter bar with 3 dropdowns side-by-side
- Trip planner form with date + client count + notes

**Strategy**:
1. **Card row**: Use CSS grid with `grid-auto-flow: col` and horizontal scroll on mobile (38 min width per card) OR stack vertically below `sm:` breakpoint
2. **Filter bar**: Stack all filters vertically on mobile; use `grid-cols-1` below `sm:`
3. **Forms**: Full width inputs; buttons stack or inline at `sm:`
4. **Sidebar nav** (Phase 1): Consider drawer on mobile (< 768px) or bottom navigation bar
5. **River roster**: List view on mobile (single column), grid on tablet/desktop

**Testing**: Add to CI: test at 390px, 640px (sm), 768px (md), 1024px (lg)

---

## PHASE 1 — FOUNDATION

**Goal**: Establish authenticated app shell, rename Favorites → Roster, sanitize sentinel values, and prepare guides for Phase 2.

**Duration**: 2–3 weeks

### 1a. Data Sanitization & Status Refactoring

**Files to Modify**:
- `lib/river-utils.ts`
- `app/api/cron/fetch-data/route.ts`

**Changes**:
1. **Update `calculateStatus()` in `lib/river-utils.ts`**:
   - Replace line 8 logic to distinguish "no data" from "ice affected"
   - New RiverStatus type value: add `'no_data'` (currently not in the enum)
   - ```ts
     if (flow === null) return 'no_data';
     if (flow <= -999000) return 'no_data'; // USGS sentinel
     if (optimalMin === null || optimalMax === null) return 'unknown';
     // ... rest of logic
     ```
2. **Update `lib/river-utils.ts` color/label functions**:
   - Add case for 'no_data': grey badge, label "No Data"
   - Keep 'ice_affected' for true gauge issues (separate concern)
3. **Update fetch-data cron** (`app/api/cron/fetch-data/route.ts`):
   - Line 97: Already handles sentinel with `siteData.flow > -999000`; good as-is
   - Ensure trend calculation skips sentinel values (line 97–102; ✅ already does)
4. **Update rivers-list.tsx filter**:
   - Line 98: Change 'ice_affected' option label to "Gauge Not Responding" OR split into two options
   - Line 99: Change 'unknown' option label to "No Data"

**Breaking Change**: Any code checking `status === 'ice_affected'` for "no data" will break. Search and fix:
   - `river-card.tsx` line 42: `const status = condition?.status || 'low';` — may need fallback
   - `river-utils.ts` getStatusColor/Label/DotColor — add 'no_data' case

---

### 1b. Sidebar Navigation (Authenticated Only)

**Files to Create**:
- `components/sidebar.tsx` — new persistent left sidebar
- `app/layout-authenticated.tsx` — server component wrapper

**Files to Modify**:
- `components/navigation.tsx`
- `app/layout.tsx`

**Details**:

1. **Sidebar Component** (`components/sidebar.tsx`):
   - Show only when `user \!== null`
   - Left side, fixed, 280px width (responsive: collapse to icon-only at sm:)
   - Content:
     ```
     StreamFlows Logo (mini)
     ─────────────────────────
     🏞️ My Rivers      (active indicator)
     📅 Trip Planner
     📊 Flow History
     📝 Client Notes
     🔔 Alert Manager
     📆 Hatch Calendar
     ─────────────────────────
     Last synced: 2 min ago
     ─────────────────────────
     [Settings] [Sign Out]
     ```
   - Live status dots (green/amber/red) beside each river in roster (lazy-load on client)
   - Roster shows up to ~12 rivers; scroll if more

2. **Update Navigation** (`components/navigation.tsx`):
   - When `user` is present: show sidebar button (hamburger → opens drawer on mobile)
   - When `user` is null: keep current top nav with marketing links
   - Remove "Dashboard", "Favorites", "Alerts" from top nav (moved to sidebar)
   - Top nav on authenticated pages: simplified to logo + user email + sign out

3. **Update Layout** (`app/layout.tsx`):
   - Add conditional check: if user, render `<Sidebar>` + content in flexbox; else traditional layout
   - OR: create separate authenticated layout at `app/(authenticated)/layout.tsx` and nest routes there

**UX Note**: Sidebar is a major visual change. On mobile, consider a bottom tab bar instead (easier thumb access).

---

### 1c. Rename Favorites → River Roster (Rename + Enhanced Metadata)

**Files to Modify**:
- `lib/types/database.ts`
- Database schema (add new columns to `user_favorites`)
- `app/rivers/page.tsx` (navigation link)
- `app/favorites/page.tsx` → `app/rivers/roster/page.tsx`
- Components: all references to "Favorites" → "Roster"
- `components/river-card.tsx`
- API routes

**Changes**:

1. **Extend `UserFavorite` model in `lib/types/database.ts`**:
   ```ts
   interface UserFavorite {
     id: string;
     user_id: string;
     river_id: string;
     // NEW:
     target_species: string[]; // ["trout", "salmon"], multi-select
     optimal_flow_override_min?: number; // guide's personal min, overrides river default
     optimal_flow_override_max?: number;
     access_notes?: string; // "Private put-in on Rt 2, ask landowner"
     is_primary: boolean; // guide's go-to; backup rivers are secondary
     is_archived: boolean; // soft-delete; don't show by default
     custom_name?: string; // "My Favorite Deerfield Run", optional
     created_at: string;
     updated_at: string;
   }
   ```

2. **Supabase Migration** (new file):
   ```sql
   -- supabase/migrations/20260414_extend_user_favorites.sql
   ALTER TABLE user_favorites ADD COLUMN target_species text[]; -- jsonb array
   ALTER TABLE user_favorites ADD COLUMN optimal_flow_override_min numeric;
   ALTER TABLE user_favorites ADD COLUMN optimal_flow_override_max numeric;
   ALTER TABLE user_favorites ADD COLUMN access_notes text;
   ALTER TABLE user_favorites ADD COLUMN is_primary boolean DEFAULT true;
   ALTER TABLE user_favorites ADD COLUMN is_archived boolean DEFAULT false;
   ALTER TABLE user_favorites ADD COLUMN custom_name text;
   ALTER TABLE user_favorites ADD COLUMN updated_at timestamptz DEFAULT now();
   ```

3. **Create Roster Page** (`app/rivers/roster/page.tsx`):
   - Show user's favorited rivers (max 12 non-archived)
   - Card layout with new metadata visible:
     - River name + custom name (if set)
     - Target species badges
     - Live flow + optimal range (with override indicator)
     - Primary/backup badge
     - Quick edit link (→ opens sidebar panel or modal)
   - "Archive" button to hide archived rivers
   - "Add River" button → opens Discover modal to add to roster
   - Sort by: primary first, then A-Z

4. **Update RiverCard** (`components/river-card.tsx`):
   - Add new optional fields: `showMetadata?: boolean`
   - If true, display custom_name, target_species, is_primary badge
   - Deprecate 'showFavorite' prop; replace with 'onToggleRoster' or remove entirely

5. **API Changes**:
   - `app/api/favorites/route.ts` → rename to `app/api/roster/route.ts`
   - Add POST/PATCH to update metadata (species, overrides, notes, primary flag)
   - Deprecate raw favorite toggle; upgrade to roster add/remove + metadata

6. **Navigation**:
   - `/favorites` → `/rivers/roster` (or keep `/roster` at root)
   - Update sidebar link: "Favorites" → "My Rivers"
   - Update page title in layout

---

### 1d. My Rivers as Default Authenticated View

**Files to Modify**:
- `app/rivers/page.tsx`
- `app/layout.tsx` (redirect logic)

**Changes**:

1. **Update `/rivers` page**:
   - Check if user is logged in (server-side)
   - If yes: redirect to `/rivers/roster` (or render roster as default)
   - If no: show "Discover rivers" full list (current behavior)
   - OR: render roster in a tab alongside Discover

2. **Discovery mode on authenticated view**:
   - Add a "Discover New Water" button on roster page that opens a modal/drawer with full filter bar
   - Simplified filters: region + species only (as per requirements)

3. **Optimize data fetching**:
   - `/rivers` (Discover): fetch all rivers + conditions (current)
   - `/rivers/roster`: fetch only user's favorited rivers + recent conditions (much lighter)

---

### 1e. Simplify /rivers Filter Bar (Guides-Focused)

**Files to Modify**:
- `app/rivers/rivers-list.tsx`

**Changes**:

1. **Remove filters** (current: Search, Region, Status, Species):
   - Keep: **Search** (by river name)
   - Keep: **Region** (dropdown)
   - Keep: **Species** (dropdown)
   - Remove: **Status** filter (guides care about current status, not filtering by it)
   - Rationale: Status is shown live on cards; filtering by it is edge case

2. **Update filter bar UI**:
   - Simpler layout: Search + Region + Species in horizontal row (stack on mobile)
   - Hide "Gauge Not Responding" and "No Data" rivers by default
   - Add toggle: **"Show unavailable gauges"** to include them
   - Fewer visual options = faster decision-making

3. **Component updates**:
   - Remove `statusFilter` state
   - Add `showUnavailable` boolean state
   - Update `filteredRivers` logic to exclude `ice_affected` and `no_data` unless toggled

---

### 1f. Guide Dashboard Shell (Empty, Layout Ready)

**Files to Modify**:
- `app/dashboard/page.tsx`
- `app/dashboard/dashboard-client.tsx`

**Changes**:

1. **Create placeholder sections** (Phase 2 will fill these):
   ```tsx
   <DashboardLayout>
     <div className="grid lg:grid-cols-3 gap-6">
       {/* Left column: Today's Conditions (empty for now) */}
       <div className="lg:col-span-2">
         <Card className="p-6">
           <h2>Today's Conditions</h2>
           <p className="text-muted-foreground">Coming soon...</p>
         </Card>
       </div>

       {/* Right sidebar: Next Trip Context + Alerts */}
       <div className="space-y-4">
         <Card className="p-4">
           <h3>Next Trip</h3>
           <p className="text-muted-foreground">No trips scheduled</p>
         </Card>
         <Card className="p-4">
           <h3>Alerts</h3>
           <p className="text-muted-foreground">None fired</p>
         </Card>
       </div>
     </div>
   </DashboardLayout>
   ```

2. **Layout structure**:
   - 3-column grid: main (2 cols) + sidebar (1 col) on desktop
   - Single column on mobile
   - Persistent header with guide name, last synced time

---

### 1g. Auth Layer Implementation (Supabase, Already In Place)

**Status**: ✅ Already complete (no changes needed)

- Supabase Auth via `lib/supabase/server.ts` and `lib/supabase/client.ts`
- Session cookies handled by `@supabase/ssr`
- Protected routes redirect to `/login`
- Confirmation: `app/layout.tsx` line 28–29 fetches user on every request

**Only action**: Verify RLS policies in Supabase are restrictive (users can only read/write their own data). Check console for policy warnings.

---

### 1h. Dependencies

**No new npm packages** needed for Phase 1. All work uses existing:
- Next.js 16.1.3
- Supabase auth (already in use)
- Tailwind CSS v4
- Lucide React (icons)

---

### 1i. Breaking Changes

1. Rename all routes `/favorites` → `/rivers/roster`
2. Rename API endpoint `/api/favorites` → `/api/roster` (or keep alias for backward compat)
3. Update database schema: add columns to `user_favorites` table
4. Update RiverStatus type: add 'no_data' (existing code checking for unknown might need review)

---

### 1j. Testing

- Manual: Sign in, check sidebar appears; create roster with multiple rivers; verify metadata CRUD
- Check mobile at 390px: sidebar collapses, filters stack
- Verify old `/favorites` route 404s (or redirects)

---

## PHASE 2 — CORE GUIDE WORKFLOW

**Goal**: Build the guide dashboard with live conditions, trip planner, and contextual notes.

**Duration**: 3–4 weeks

### 2a. Guide Dashboard – Today's Conditions Panel

**Files to Create**:
- `components/today-conditions-row.tsx` — displays compact cards for each roster river
- `app/dashboard/today-conditions-card.tsx`

**Files to Modify**:
- `app/dashboard/page.tsx`
- `app/dashboard/dashboard-client.tsx`

**UI Design**:
- Row of horizontal-scrolling cards (390px: 1 visible, 640px: 2, 1024px: 3+)
- Each card shows:
  - Left 3px border color bar (green/amber/red for status)
  - River name + region
  - Flow (large, bold) + optimal range
  - Water temp
  - Trend arrow (↑→↓)
  - Status badge (Optimal | Elevated | High | Low)
  - Link to detail page
- Card width: 280px (fits 1 on 390px with padding, 2 on 640px)

**Data**:
- Fetch last 24h of conditions for all roster rivers (already in dashboard/page.tsx)
- Pass to client component

**Implementation**:
```tsx
// components/today-conditions-row.tsx
export function TodayConditionsRow({
  rivers: Array<RiverWithCondition & { trend: FlowTrend; eta?: FlowEta }>
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 w-min">
        {rivers.map(river => (
          <ConditionCard key={river.id} river={river} />
        ))}
      </div>
    </div>
  );
}
```

---

### 2b. Trip Planner – New Section

**Files to Create**:
- `app/trips/page.tsx` — list user's trips
- `app/trips/trip-form.tsx` — create/edit trip
- `app/trips/trip-detail.tsx` — view single trip with post-trip notes
- `app/api/trips/route.ts` — CRUD
- `lib/types/database.ts` — extend with Trip types

**Data Model** (new Supabase table: `user_trips`):
```ts
interface Trip {
  id: string;
  user_id: string;
  trip_date: string; // YYYY-MM-DD
  client_count: number;
  client_names?: string[]; // optional private list
  client_notes?: string; // trip-specific prep notes
  river_id: string; // primary target
  backup_river_id?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string; // post-trip notes
  conditions_at_time?: { flow: number; temp: number; status: string }; // auto-filled after trip ends
  created_at: string;
  updated_at: string;
}
```

**UI**:
1. **Trip List** (`/trips`):
   - Two tabs: "Upcoming" and "Past"
   - Upcoming: date, client count, target river, forecasted condition (extrapolated from trend)
   - Past: date, river, actual conditions, user's notes
   - + Create trip button

2. **Trip Form** (modal or new page `/trips/new`):
   - Date picker (must be future for "upcoming")
   - Client count (number input)
   - Target river (dropdown from roster)
   - Backup river (optional, dropdown)
   - Client names & notes (textarea)
   - Save button
   - On save: show "Checking conditions..." and forecast

3. **Trip Detail** (after save or click existing trip):
   - Read-only display of trip info
   - Forecasted conditions for trip date (24–48h ahead)
   - "This date is 3 days away. Expected condition: Elevated, falling."
   - Post-trip (if trip_date has passed): prompt to save notes + auto-fill actual conditions from DB

**Forecast Logic**:
- Use `calculateFlowEta()` from Phase 0 to extrapolate trend
- For dates > 3 days out, show only "monitor" (uncertainty increases)
- For dates within 3 days, show ETA with confidence

**Implementation**:
- POST `/api/trips` with trip data
- GET `/api/trips` to list user's trips
- PATCH `/api/trips/:id` to update status or add post-trip notes

---

### 2c. Notes Indexed to Conditions

**Files to Modify**:
- `lib/types/database.ts` — extend UserNote
- `app/api/notes/route.ts` — update to capture condition snapshot
- `app/rivers/[slug]/river-detail.tsx` — display condition-indexed notes

**Data Model Update**:
```ts
interface UserNote {
  id: string;
  user_id: string;
  river_id: string;
  note: string;
  // NEW:
  flow_at_note?: number; // CFS at time of note
  temperature_at_note?: number; // °F
  status_at_note?: RiverStatus;
  timestamp_at_note?: string; // when the note was created (\!= created_at in case of back-fill)
  created_at: string;
  updated_at: string;
}
```

**Supabase Migration**:
```sql
ALTER TABLE user_notes ADD COLUMN flow_at_note numeric;
ALTER TABLE user_notes ADD COLUMN temperature_at_note numeric;
ALTER TABLE user_notes ADD COLUMN status_at_note text;
ALTER TABLE user_notes ADD COLUMN timestamp_at_note timestamptz;
```

**API Change** (`app/api/notes/route.ts` POST):
- When note is saved, fetch current river condition (most recent)
- Capture flow, temp, status at that moment
- Store alongside note

**Display** (on detail page):
```
Apr 3, 2:15 PM · 215 CFS · 51°F
Note: "BWO hatch started around 1pm, spin fishing upstream from the access point worked well"
```

---

### 2d. Alert Feed & Alert Improvements

**Files to Modify**:
- `app/dashboard/page.tsx` — add alert feed section
- `app/alerts/page.tsx` — show alert history + add alert
- `app/api/alerts/route.ts` — extend to log fired alerts

**Data Model** (new table: `alert_history`):
```ts
interface AlertFired {
  id: string;
  alert_id: string;
  user_id: string;
  river_id: string;
  fired_at: string;
  flow_at_fire: number;
  status_at_fire: RiverStatus;
  is_dismissed: boolean;
  dismissed_at?: string;
  created_at: string;
}
```

**Dashboard Changes**:
- Add "Recent Alerts" section: last 5 fired alerts as dismissible strips
- Show: "🔔 Battenkill reached Optimal - April 2, 11:23 AM" with dismiss button

**Alerts Page Changes**:
- Add "Alert History" tab below current alert manager
- Show all fired alerts for past 30 days (or all time if few)
- Search/filter by river

---

### 2e. Sidebar Alert Badge Count

**Files to Modify**:
- `components/sidebar.tsx`

**Change**:
- Query active alerts count + recently fired unfired alerts (past 24h)
- Show badge on "Alert Manager" link: "🔔 Alert Manager (3)"
- Real-time if possible (Supabase realtime subscription) or refresh on page load

---

### 2f. Dependencies

**New npm packages**:
- None strictly required, but consider:
  - `react-hot-toast` — for dismissible alert notifications (optional, can use native alerts)
  - `zod` — for form validation in trip planner (optional, can use HTML5)

**Recommendation**: No new deps; use HTML5 validation + inline error states.

---

### 2g. Breaking Changes

- Extend `UserNote` type; old queries without new fields will fail (add default null)
- UserAlert changes (hopefully backward compat)

---

## PHASE 3 — INTELLIGENCE LAYER

**Goal**: Add forecasting, backup river suggestions, and trip window alerts.

**Duration**: 2–3 weeks

### 3a. Backup River Scoring

**Files to Create**:
- `lib/backup-river-scorer.ts`

**Function**:
```ts
interface ScoredRiver {
  river: River;
  score: number;
  rationale: string; // "Optimal, stable, 25 mi from Deerfield"
}

export function scoreBackupRivers(
  primaryRiver: River,
  rosterRivers: Array<River & { current_condition: Condition }>,
  userLocation?: { lat: number; lng: number }
): ScoredRiver[]
```

**Scoring Logic**:
- `currentStatus` (0–100): Optimal = 100, Elevated = 70, High = 40, Low = 20, No Data = 0
- `trend` (+0–20): Stable = +0, Falling (when high) = +15, Rising (when low) = +15, Negative trend = -10
- `distance` (0–20): If location data, closer = higher score (bonus for < 30 mi)
- `totalScore` = status + trend + distance

**Implementation**:
```ts
export function scoreBackupRivers(...): ScoredRiver[] {
  return rosterRivers
    .filter(r => r.id \!== primaryRiver.id)
    .map(river => {
      const status = river.current_condition?.status ?? 'unknown';
      const statusScore = { optimal: 100, elevated: 70, high: 40, low: 20, unknown: 0 }[status] ?? 0;
      const trendBonus = river.current_condition?.trend === 'falling' ? 15 : 0;
      const score = statusScore + trendBonus;
      return {
        river,
        score,
        rationale: `${getStatusLabel(status)}, ${river.current_condition?.trend || 'unknown'}, ...`
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // top 3 suggestions
}
```

**Display** (on dashboard):
- "Next trip context bar" shows: "Best backup: Battenkill — Optimal, stable, 25 mi away"
- Link to backup river detail

---

### 3b. Lightweight Condition Forecasting

**Files to Modify**:
- `lib/flow-eta.ts` (already exists; extend)
- `app/dashboard/page.tsx`
- `app/rivers/[slug]/page.tsx`

**Changes to flow-eta.ts**:
- Add function `forecastCondition()` that projects 24–48h trend
- Return: `{ projectedStatus: RiverStatus; hours: number; confidence: 'high' | 'medium' | 'low' }`
- If current rate is consistent (rising/falling > 2 CFS/h for 3+ readings), confidence = high
- If unstable or few readings, confidence = low

**Display**:
- Detail page: "Estimated to reach Optimal in ~18 hours if current trend holds." (with "if" caveat)
- Dashboard card: Show small ETA label below current status

**Implementation**:
```ts
export function forecastCondition(
  conditions: Condition[],
  optimalMin: number,
  optimalMax: number,
  forecastHours: number = 24
): { projectedStatus: RiverStatus; eta: string; confidence: 'high' | 'medium' | 'low' } {
  const eta = calculateFlowEta(conditions, optimalMin, optimalMax);
  // Extend: if eta is available, confidence = high if >3 recent readings
  // Else confidence = low
  // ...
}
```

---

### 3c. Trip Window Alerts

**Files to Create**:
- `app/api/cron/check-trip-alerts/route.ts`

**Logic**:
- Cron job runs every 6 hours
- Fetch all upcoming trips (within next 5 days) for all users
- For each trip, get current river status and trend
- If status enters/exits "Optimal" window: fire alert
  - Alert stored in `alert_history` table
  - User notified (email, push if implemented later)
  - Show in dashboard alert feed

**Trigger Conditions**:
- Trip date is in next 5 days
- Status is Optimal, Elevated, or High (skipping Low / No Data)
- Status changed from previous check

---

### 3d. Alert History Log

**Files to Modify**:
- `app/alerts/page.tsx`

**Changes**:
- Add "History" tab (or new page `/alerts/history`)
- Show past fired alerts sorted by `fired_at` descending
- Include: river name, alert type, flow at fire time, when fired, dismissed status
- Pagination or virtual scroll if many (>100)

---

### 3e. Dependencies

**None**. All logic is DB queries + calculations on existing data.

---

## PHASE 4 — CONTENT LAYER

**Goal**: Add hatch calendar and historical condition queries.

**Duration**: 2 weeks

### 4a. Hatch Calendar – Per River

**Files to Create**:
- `supabase/seed/hatch-events.json` — seed data for prominent rivers
- `app/api/hatches/route.ts` — CRUD
- `components/hatch-calendar.tsx`
- `app/rivers/[slug]/hatch-panel.tsx`

**Data Model** (see Decision 4 above):
```ts
interface HatchEvent {
  id: string;
  river_id: string;
  insect_name: string; // "BWO", "Hex", etc.
  category: string; // "mayfly" | "caddis" | "stonefly" | "midge"
  start_month: number; // 1–12
  start_day: number;
  end_month: number;
  end_day: number;
  peak_month?: number;
  peak_day?: number;
  water_temp_min?: number;
  water_temp_max?: number;
  notes?: string;
  user_created: boolean;
  created_at: string;
  updated_at: string;
}
```

**Seed Data** (sample: `supabase/seed/hatch-events.json`):
```json
[
  {
    "river_name": "Farmington River CT",
    "hatches": [
      { "insect": "Blue-Winged Olive", "category": "mayfly", "months": "3-5,10-11", "notes": "Afternoon hatches" },
      { "insect": "Hex", "category": "mayfly", "months": "6-7", "notes": "Evening spinner fall" }
    ]
  }
]
```

**Display on Detail Page**:
- Section: "Hatches"
- Current/upcoming hatches (this month or next month)
- Display:
  ```
  🪰 Blue-Winged Olive (Mayfly)
  Peak: April 10–20 | Water: 50°F
  "Afternoon hatches, spin fishing works late"
  [Edit] [Delete] (if user-created)
  ```
- If user is logged in and it's their river: "Add Hatch" button

**User Edits** (Phase 4b, optional):
- Modal form: insect name, category, date range, peak, temp trigger, notes
- POST `/api/hatches` for new
- PATCH `/api/hatches/:id` for edit
- DELETE `/api/hatches/:id` for remove
- RLS: users can edit/delete only hatches marked `user_created=true`

---

### 4b. Condition History – Detail Page Query

**Files to Create**:
- `lib/usgs-historical.ts`

**Files to Modify**:
- `app/rivers/[slug]/page.tsx`
- `app/rivers/[slug]/river-detail.tsx`

**Feature**: "What were the conditions on this date last year?"

**UI**:
- Detail page footer: "Compare to last year" button or date picker
- Shows: "April 15, 2025: 234 CFS (mean), 52°F — one year ago"

**Implementation**:
```ts
// lib/usgs-historical.ts
export async function fetchDailyConditions(
  stationId: string,
  date: Date // specific date
): Promise<{ flow: number; temp: number } | null> {
  // Call USGS DV API with startDT=date, endDT=date
  // Return daily mean/min/max
}
```

**Detail page call**:
```tsx
// In RiverDetail component, add client action:
const handleCompareYear = async () => {
  const yearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const historical = await fetchDailyConditions(river.usgs_station_id, yearAgo);
  setComparison(historical);
};
```

---

### 4c. Species & Hatch Panel on Detail Page

**Files to Modify**:
- `app/rivers/[slug]/river-detail.tsx`

**Changes**:
- Add new panel: "Species & Hatches"
- Show:
  - Species tags from river_species table
  - Current/upcoming hatches (from hatch_events)
  - Angler-reported species from check-ins (past 30 days)
- Multi-column layout on desktop, single on mobile

---

### 4d. Set Trip Day Shortcut

**Files to Modify**:
- `app/rivers/[slug]/river-detail.tsx`

**Change**:
- Add button in action bar: "Schedule Trip"
- Clicking opens trip planner modal pre-filled with:
  - River: this river
  - Backup: top-scored alternative
  - Date: empty (user picks)
- Submit → saves trip, navigates to trip detail

---

### 4e. Dependencies

**None**. All using existing tech stack.

---

## CROSS-CUTTING CONCERNS

### Mobile-First Design (390px)

**Strategy**:
1. Sidebar: Collapse to icon-only below `md:` breakpoint; OR drawer that slides in
2. Dashboard card row: Horizontal scroll on mobile; grid on desktop
3. Filter bar: Stack all inputs vertically on mobile
4. Trip form: Full-width inputs; buttons stack
5. Hatch panel: List on mobile, grid on desktop

**Testing Checklist**:
- [ ] Sidebar accessible and navigable on 390px phone
- [ ] All cards readable without horizontal scroll on 390px (at most 1 card visible)
- [ ] Forms submittable on 390px (no hidden buttons)
- [ ] Images and icons scale appropriately

---

### Typography & Editorial Style

**Current**:
- Font: Open Sans (sans-serif)
- No serif used
- River names in regular weight

**Proposal** (future enhancement, not Phase 1):
- Consider **PT Serif** or **Lora** (variable) for river names on cards/detail page
- Makes rivers feel more editorial/literary
- Not critical for MVP; add if time permits

**Current palette**: Good contrast; no changes needed.

---

### Dark Mode Approach

**Current**: Light theme only.

**Recommendation for Future**:
1. Add `prefers-color-scheme` media query handler in tailwind.config
2. Add user toggle in sidebar settings
3. Test all color functions in `river-utils.ts` for dark equivalents
4. Not in MVP scope; defer to Phase 5 or later

---

## RISKS & OPEN QUESTIONS

### Risk 1: Supabase Row Count Limits
- **Issue**: 1,500 rivers × 96 readings/day × 72 days = ~10.3M rows in conditions table
- **Supabase free tier**: 500k rows max
- **Mitigation**: Implement cron job to prune conditions older than 72h (Phase 0 recommendation)
- **Cost impact**: Upgrade to Pro plan ($25+/mo) if pruning doesn't bring row count down

### Risk 2: USGS Historical API Rate Limiting
- **Issue**: Docs don't specify rate limits; could throttle if too many requests
- **Mitigation**: Cache historical queries in DB; don't call on every detail page load
- **Mitigation**: Implement client-side memoization (React.useMemo or SWR)

### Risk 3: Trip Forecasting Accuracy
- **Issue**: Extrapolating 24–48h flow from 24h trend may be inaccurate; user expectations high
- **Mitigation**: Always show "if current trend holds" caveat; highlight uncertainty
- **Mitigation**: Offer range, not point estimate (e.g., "Likely Optimal±1 status level")

### Risk 4: Mobile Sidebar Navigation
- **Issue**: Sidebar pattern is desktop-first; mobile users may struggle with drawer
- **Mitigation**: Consider bottom tab bar as alternative for mobile (< 640px)
- **Mitigation**: User testing required; may need iteration post-launch

### Risk 5: Hatch Event Data Quality
- **Issue**: Seed data may be outdated or incorrect; user-edited data may conflict
- **Mitigation**: Version seed data; allow user overrides without deleting seed
- **Mitigation**: Add "report error" link on hatch events

### Open Question 1: User Location Data
- **Issue**: "Distance to backup river" score requires user location
- **Status**: Not collected today
- **Decision**: Either ask user for zip code (onboarding) OR use river's location as proxy
- **Recommendation**: Skip for Phase 3; mock distance scores with river preference order

### Open Question 2: Notifications & Push Alerts
- **Issue**: Current design mentions "notified" but no email/push implemented
- **Status**: Supabase doesn't have built-in email/push; requires external service (SendGrid, Expo, etc.)
- **Decision**: Phase 1–3 fire alerts in-app only; add email/push in Phase 5 if needed
- **Recommendation**: Defer; in-app notifications (toast + feed) sufficient for MVP

### Open Question 3: Angler Checkins vs. Guide Notes
- **Issue**: `CheckIn` is angler feedback; `UserNote` is guide notes. Both used on detail page.
- **Status**: Currently shown together; could be confusing
- **Decision**: Keep separate but label clearly ("Angler reports" vs. "Your notes")
- **Recommendation**: Add visual distinction (badges or sections)

---

## IMPLEMENTATION SEQUENCE RECOMMENDATION

### Timeline
- **Week 1–2**: Phase 1 Foundation (sidebar, roster rename, data sanitization)
- **Week 3–5**: Phase 2 Guide Workflow (dashboard, trip planner, condition-indexed notes)
- **Week 6–7**: Phase 3 Intelligence (backup scoring, forecasting, trip alerts)
- **Week 8–9**: Phase 4 Content (hatch calendar, historical data, species panel)
- **Week 10+**: Testing, refinement, dark mode, additional features

### Parallel Work
- Supabase migrations can be prepared while UI is being built
- API routes can be stubbed early; UI development can proceed with mock data
- Mobile testing should happen continuously, not at the end

---

## CRITICAL FILES FOR IMPLEMENTATION

### Core Database & Types
- `/lib/types/database.ts` — extend with Trip, HatchEvent, AlertFired types
- `lib/river-utils.ts` — update status calculation and colors for 'no_data'

### Server-Side Data Fetching
- `app/layout.tsx` — add user detection; conditionally render sidebar
- `app/dashboard/page.tsx` — fetch roster + conditions + weather; pass to client
- `app/api/cron/fetch-data/route.ts` — improve sentinel handling; add pruning job
- `app/rivers/[slug]/page.tsx` — fetch 72h conditions (not 24h); add historical query support

### Client Components & UI
- `components/sidebar.tsx` — NEW; persistent navigation for authenticated users
- `components/river-card.tsx` — update for roster metadata display; add 3px border color bar
- `components/today-conditions-row.tsx` — NEW; horizontal-scroll card row for dashboard
- `app/rivers/rivers-list.tsx` — simplify filters; hide unavailable gauges by default
- `app/dashboard/dashboard-client.tsx` — add placeholder sections; fill in Phase 2–4

### API Routes
- `app/api/roster/route.ts` — RENAME from favorites; add PATCH for metadata
- `app/api/trips/route.ts` — NEW; CRUD for trips
- `app/api/hatches/route.ts` — NEW; CRUD for hatch events
- `app/api/cron/prune-conditions/route.ts` — NEW; daily cleanup of old conditions

### Utility Libraries
- `lib/flow-eta.ts` — extend with `forecastCondition()` function
- `lib/usgs-historical.ts` — NEW; fetch daily historical USGS data
- `lib/backup-river-scorer.ts` — NEW; score and rank backup rivers

---

## SUMMARY

This redesign transforms StreamFlows from a river discovery tool into a professional guide's operational dashboard. The phased approach allows for incremental delivery:

- **Phase 1** establishes the authenticated shell and renames Favorites to River Roster with enhanced metadata.
- **Phase 2** builds the core guide workflow: trip planning, condition monitoring, and contextual notes.
- **Phase 3** adds intelligence: backup river suggestions, flow forecasting, and trip-date alerts.
- **Phase 4** layers in editorial content: hatch calendars and historical condition comparisons.

Key architectural decisions:
1. **Stay with Supabase** for auth + DB (lowest friction).
2. **Implement 48–72h rolling conditions** with daily pruning (avoids row-limit issues).
3. **Fetch historical USGS data on-demand** for detail pages (cost-effective).
4. **Mobile-first at 390px** with careful attention to sidebar/navigation UX.

All recommendations prioritize user needs (guides want actionable, contextual river intelligence) and developer velocity (solo builder, existing tech stack, no new vendor lock-in).

