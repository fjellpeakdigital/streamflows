# StreamFlows — UI/UX Session Handoff

## Project Overview
**StreamFlows** — real-time river conditions for fly fishing guides in New England.  
Live at: **https://streamflow-ochre.vercel.app/**  
Repo: `fjellpeakdigital/streamflows` (GitHub, auto-deploys to Vercel on push to `main`)

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.3 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Backend | Supabase (Postgres + Auth + pg_cron) |
| Charts | Recharts |
| Icons | Lucide React |
| Hosting | Vercel (GitHub integration) |

---

## Current Pages & Routes

| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` | Hero/marketing landing page |
| `/rivers` | `app/rivers/page.tsx` | River list with status dashboard |
| `/rivers/[slug]` | `app/rivers/[slug]/page.tsx` | River detail with 24hr flow chart |
| `/favorites` | `app/favorites/page.tsx` | Auth-gated favorites list |
| `/alerts` | `app/alerts/page.tsx` | Auth-gated alert management |
| `/login` | `app/login/page.tsx` | Supabase Auth login |
| `/signup` | `app/signup/page.tsx` | Supabase Auth signup |

All pages use `export const dynamic = 'force-dynamic'` (server-rendered on demand).

---

## Key Components

### `components/navigation.tsx`
- Sticky top nav, white/blur background
- Logo left, nav links center (Rivers, Favorites, Alerts — auth-gated)
- Login/Signup or email + Sign Out right
- Mobile: nav links hidden on small screens (no mobile menu implemented yet)

### `components/river-card.tsx`
- Used in the rivers list and favorites
- Shows: river name, region, status badge, trend icon, flow, temp, optimal range, species badges
- Entire card is a link to the river detail page
- Optional favorite heart button

### `app/rivers/[slug]/river-detail.tsx` (Client Component)
- Header card: name, region, USGS ID, favorite heart, status badge, trend
- Current conditions card: flow, temperature, gage height, last updated
- 24-hour flow chart (Recharts LineChart)
- Guide notes (Textarea, auth-gated)
- Sidebar: species badges, lat/lng + Google Maps link, USGS link

---

## Current Design State

### What works but needs polish
- **Color scheme**: Uses Tailwind v4 CSS custom properties mapped in `globals.css`. Primary/secondary colors are defined but may look generic.
- **Status badges**: Hardcoded Tailwind color classes in `lib/river-utils.ts` (optimal=green, elevated=yellow, high=red, low=blue, ice_affected=sky, unknown=gray)
- **Trend icons**: Plain emoji arrows (↑ ↓ →) from `lib/river-utils.ts`
- **Hero page**: Basic gradient title, 4-feature card grid, stats row, CTA — functional but plain
- **Rivers list**: Status count dashboard at top (5 colored boxes), then grid of river cards
- **Mobile nav**: No hamburger menu — links just disappear on mobile

### Known UX gaps
1. No mobile navigation menu
2. `alert()` used for note save confirmation (river-detail.tsx:98) — needs a toast
3. No loading states on the river detail page
4. No empty states designed (no rivers, no favorites, no alerts)
5. The flow chart only shows flow — temperature is not displayed
6. No error states shown to users
7. Login/signup pages are unstyled (likely bare Supabase Auth UI)

---

## File Locations for UI Work

```
app/
  globals.css          — Tailwind v4 theme tokens (CSS vars mapped here)
  page.tsx             — Landing page
  layout.tsx           — Root layout with Navigation
components/
  navigation.tsx       — Top nav
  river-card.tsx       — River card used in lists
  ui/                  — shadcn/ui primitives (button, card, badge, input, select, textarea)
app/rivers/
  rivers-list.tsx      — Client component wrapping river cards
  [slug]/river-detail.tsx — Full river detail view
app/alerts/alerts-list.tsx — Alert management UI
```

---

## Deployment Notes
- Vercel project was recreated fresh (previous project had corrupted routing)
- No `middleware.ts` — was removed due to `__dirname` Edge runtime incompatibility with `@supabase/ssr`
- Layout has a try/catch around Supabase auth call (`app/layout.tsx`) — intentional
- `CRON_SECRET` env var is set but not wired to the pg_cron schedule (pg_cron calls the Supabase Edge Function directly using the service role key, not the Next.js API route)
