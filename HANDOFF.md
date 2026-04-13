# StreamFlows — Session Handoff Document

## Project Overview

StreamFlows is a real-time river conditions platform for fly fishing. It pulls live gauge data from USGS and translates raw flow numbers into actionable fishing intelligence (Optimal, Elevated, High, Low, Gauge Not Responding, No Data).

- **Live site**: https://streamflows.backalleyfly.com
- **Repo**: fjellpeakdigital/streamflows
- **Branch**: `main` (all work merged)
- **Stack**: Next.js 16 + Supabase + Vercel (Pro plan)
- **Database**: 1,552 rivers, ~2.6M condition rows (5 years seeded)

---

## What Was Completed This Session

### 1. Full UX Redesign (Light Theme)

Switched from dark navy theme to premium light theme with outdoorsy, fishing-forward feel.

**Files changed:**
- `app/globals.css` — Light theme CSS variables (warm off-white bg, river blue primary, sage accent)
- `components/ui/button.tsx` — rounded-lg, font-semibold, subtle shadows
- `components/ui/card.tsx` — rounded-xl cards
- `components/navigation.tsx` — White glass nav with How It Works + For Guides links
- `components/footer.tsx` — NEW: 4-column footer (Brand, Product, For You, Data)
- `components/river-card.tsx` — Light shadows, white bg, trend colors, "last updated" timestamp
- `app/layout.tsx` — Footer integration, updated metadata
- `app/login/page.tsx` — White cards, subtle shadows, light-theme errors
- `app/signup/page.tsx` — Same light theme treatment
- `app/rivers/[slug]/river-detail.tsx` — Chart colors updated for light theme (white tooltip, lighter grid, primary blue flow line, sage temp line)
- `lib/river-utils.ts` — Light theme status badge colors, getStatusColorSolid()

### 2. Homepage Rewrite (8 Sections)

`app/page.tsx` — Complete rewrite with:
1. **Hero** — headline, value prop, dual CTAs, mocked product screenshot with 4 river cards
2. **Trust Bar** — 50+ rivers, 6 states, update frequency, USGS powered, tuned ranges
3. **Live River Snapshot** — 4 mocked river cards (Deerfield, Farmington, Swift, Battenkill)
4. **How It Works** — 4-step data pipeline explanation
5. **Feature Deep-Dives** — 5 rich feature blocks with practical copy
6. **Audience** — For Guides / For Serious Anglers split with benefits
7. **USGS Comparison** — Without vs With StreamFlows
8. **Final CTA** — Closing conversion section

### 3. USGS Data Pipeline Overhaul

**Split cron architecture:**
- `/api/cron/fetch-data` — Hourly, IV (instantaneous values) for realtime gauges (~99 rivers, ~8s)
- `/api/cron/fetch-daily` — Daily at 6am UTC, DV (daily values) for daily-only gauges (~1,453 rivers, 300s timeout)
- `vercel.json` — Both schedules configured

**Shared USGS library:** `lib/usgs.ts`
- Batched API calls (50 sites per request, 3 concurrent)
- `fetchAllSites()`, `fetchUSGSBatch()`, `parseUSGSResponse()`, `chunk()`, `runWithConcurrency()`

**Gauge type detection:**
- `/api/cron/detect-gauge-types` — Tests all stations against IV endpoint, classifies as 'realtime' or 'daily'
- `rivers.gauge_type` column: 'realtime' (99) or 'daily' (1,453)

### 4. Historical Data Seeding

- `/api/seed` — Fetches USGS daily values by year/offset/batch, calculates status, bulk inserts
- `/admin/seed` — Browser-based runner with live progress log, stats dashboard, stop/resume
- **Seeded**: 2,608,832 rows across 5 years (2021-2025)

### 5. Optimal Range Calculation

- `/api/cron/calculate-ranges` — Fetches 1 year of USGS DV data, calculates P25/P75 as optimal range
- Also calculated ranges from stored conditions via SQL (PERCENTILE_CONT)
- **Coverage**: 1,477 of 1,552 rivers have optimal ranges (95%)
- Remaining 75 have no discharge data in USGS

### 6. Status Calculation Fixes

- Closed gap where flow between 0.5*optimalMin and optimalMin returned 'unknown'
- Rivers without ranges show 'unknown' status → "No Data" label (gray badge)
- Renamed 'ice_affected' display label from "Ice Affected" to "Gauge Not Responding" (slate gray styling)
- Added 'unknown' to DB check constraint, status summary bar, and filter dropdown

---

## Current Architecture

### Database Schema (Supabase)

```
rivers
  - id, name, slug, usgs_station_id, region
  - optimal_flow_min, optimal_flow_max
  - latitude, longitude, description
  - gauge_type ('realtime' | 'daily')

conditions
  - id, river_id, timestamp, flow, temperature, gage_height
  - status ('optimal'|'elevated'|'high'|'low'|'ice_affected'|'unknown')
  - trend ('rising'|'falling'|'stable'|'unknown')
  - UNIQUE(river_id, timestamp)
  - CHECK constraint on status

river_species  (river_id, species)
user_favorites (user_id, river_id)
user_notes     (user_id, river_id, note)
user_alerts    (user_id, river_id, alert_type, threshold_value, is_active)
```

### Supabase Settings
- **Max Rows** was increased from 1,000 to 5,000+ (Settings → API)
- All queries use `.limit(5000)` to avoid the default 1,000-row cap

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/cron/fetch-data` | Hourly realtime cron (IV data, gauge_type != 'daily') |
| `/api/cron/fetch-daily` | Daily cron at 6am UTC (DV data, gauge_type = 'daily') |
| `/api/cron/detect-gauge-types` | One-time: classify stations as realtime/daily |
| `/api/cron/calculate-ranges` | One-time: calculate optimal ranges from USGS history |
| `/api/cron/calculate-ranges-from-conditions` | Directory exists but logic was done via SQL instead |
| `/api/seed` | Historical data seeding endpoint |
| `/api/favorites` | POST/DELETE user favorites |
| `/api/notes` | POST/DELETE user notes |
| `/api/alerts` | POST/PATCH/DELETE user alerts |

### Vercel Cron Config (`vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/fetch-data", "schedule": "0 * * * *" },
    { "path": "/api/cron/fetch-daily", "schedule": "0 6 * * *" }
  ]
}
```

### Environment Variables (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

---

## Pending / Needs Attention

### 1. Recalculate Stored Statuses (SQL — not yet run)

The most recent condition row for each river still has the old status from before ranges were updated. Run this:

```sql
UPDATE conditions c
SET status = CASE
  WHEN c.flow IS NULL OR c.flow <= -999000 THEN 'ice_affected'
  WHEN r.optimal_flow_min IS NULL OR r.optimal_flow_max IS NULL THEN 'unknown'
  WHEN c.flow < r.optimal_flow_min THEN 'low'
  WHEN c.flow >= r.optimal_flow_min AND c.flow <= r.optimal_flow_max THEN 'optimal'
  WHEN c.flow > r.optimal_flow_max AND c.flow <= r.optimal_flow_max * 1.5 THEN 'elevated'
  WHEN c.flow > r.optimal_flow_max * 1.5 THEN 'high'
  ELSE 'unknown'
END
FROM rivers r
WHERE c.river_id = r.id
  AND c.id IN (
    SELECT DISTINCT ON (river_id) id
    FROM conditions
    ORDER BY river_id, timestamp DESC
  );
```

### 2. Region Normalization

Some rivers have full state names ("Maine", "Vermont") and some have abbreviations ("ME", "VT"). SQL to standardize was provided but not confirmed run:

```sql
UPDATE rivers SET region = 'New Hampshire' WHERE region = 'NH';
UPDATE rivers SET region = 'Vermont' WHERE region = 'VT';
UPDATE rivers SET region = 'Maine' WHERE region = 'ME';
UPDATE rivers SET region = 'Massachusetts' WHERE region = 'MA';
UPDATE rivers SET region = 'Connecticut' WHERE region = 'CT';
UPDATE rivers SET region = 'Rhode Island' WHERE region = 'RI';
```

### 3. Stale Gauge Cleanup

3 rivers consistently return stale data:
- Nezinscot River at Turner Center, Maine (2025 timestamp)
- Roach River (1991 timestamp)
- Rapid River (1996 timestamp)

These could be removed or flagged as inactive.

### 4. 75 Rivers Still Missing Optimal Ranges

These stations have no discharge data in either USGS IV or DV endpoints. They'll show "No Data" status.

### 5. Homepage Copy References "15 minutes"

The homepage hero eyebrow and trust bar say "Updated Every 15 Min" but the cron now runs hourly. Consider updating to "Updated Hourly" or "Updated regularly from live USGS data."

---

## Future Feature Ideas Discussed

### Weather Forecasting Integration
- Use NOAA/NWS or Open-Meteo for precipitation forecasts
- Predict flow changes: "Rain expected upstream — flows likely rising in 6-12 hours"
- Weekend outlook per river
- Needs watershed mapping (which weather station affects which river)
- Scoped as separate feature build

### Custom Domain
- `streamflows.backalleyfly.com` is configured via CNAME on SiteGround pointing to `cname.vercel-dns.com`
- SSL handled by Vercel

---

## Key Design Decisions

| Decision | Value |
|----------|-------|
| Primary color | River blue `hsl(200, 65%, 38%)` |
| Background | Warm off-white `hsl(40, 20%, 97%)` |
| Cards | Pure white |
| Text | Dark slate `hsl(220, 30%, 18%)` |
| Accent | Sage green `hsl(155, 30%, 42%)` |
| Status: Optimal | Emerald green (tinted badge) |
| Status: Elevated | Amber (tinted badge) |
| Status: High | Red (tinted badge) |
| Status: Low | Blue (tinted badge) |
| Status: Gauge Not Responding | Slate gray (tinted badge) |
| Status: No Data | Zinc gray (tinted badge) |
| Tone | Outdoorsy, confident, practical — not corporate SaaS |

---

## File Map (key files)

```
app/
  page.tsx                          — Homepage (8 sections)
  layout.tsx                        — Root layout with Nav + Footer
  globals.css                       — Light theme CSS variables
  login/page.tsx                    — Login page
  signup/page.tsx                   — Signup page
  rivers/
    page.tsx                        — Rivers list (server component)
    rivers-list.tsx                 — Client-side filtering
    [slug]/
      page.tsx                      — River detail (server)
      river-detail.tsx              — River detail (client, charts)
  favorites/page.tsx                — User favorites
  alerts/
    page.tsx                        — Alerts management
    alerts-list.tsx                 — Alerts client component
  admin/seed/page.tsx               — Seed runner UI
  api/
    cron/
      fetch-data/route.ts           — Hourly realtime cron
      fetch-daily/route.ts          — Daily DV cron
      detect-gauge-types/route.ts   — Gauge type classifier
      calculate-ranges/route.ts     — USGS historical range calculator
    seed/route.ts                   — Historical data seeder
    favorites/route.ts              — Favorites API
    notes/route.ts                  — Notes API
    alerts/route.ts                 — Alerts API

components/
  navigation.tsx                    — Sticky nav with light glass effect
  footer.tsx                        — 4-column footer
  river-card.tsx                    — River card with status, trend, timestamp
  ui/
    button.tsx, card.tsx, badge.tsx, input.tsx, select.tsx, textarea.tsx

lib/
  river-utils.ts                    — Status calculation, colors, labels, formatting
  usgs.ts                           — USGS API batching, parsing, concurrency
  types/database.ts                 — TypeScript types
  utils.ts                          — cn() helper
  supabase/
    server.ts                       — Server-side Supabase client
    client.ts                       — Browser-side Supabase client
```
