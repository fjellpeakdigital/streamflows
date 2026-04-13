# StreamFlows Redesign — Handoff Document

## Branch
`claude/redesign-streamflows-ux-SgwHu`

## Status: ~40% complete
All changes are **unstaged/uncommitted** on the branch. Nothing has been pushed yet.

---

## What's Been Done (completed, working, uncommitted)

### 1. Light Theme — `app/globals.css` (REWRITTEN)
- Switched from dark navy theme to premium light theme
- New palette: warm off-white background (`40 20% 97%`), dark slate foreground (`220 30% 18%`)
- Primary color changed from BAF red (`0 55% 52%`) to river blue (`200 65% 38%`)
- Accent color: sage/olive green (`155 30% 42%`)
- Secondary: warm stone (`40 15% 93%`)
- Added extended brand tokens: `--river-blue`, `--sage`, `--stone-warm`, `--slate-navy`
- Status colors preserved (emerald/amber/red/blue/cyan)
- Removed the `.light` class override (light is now default)
- Removed dark-theme `select option` styling

### 2. Button Component — `components/ui/button.tsx` (UPDATED)
- Changed `rounded-md` to `rounded-lg` globally
- Changed `font-medium` to `font-semibold`
- Added `shadow-sm` to default and destructive variants
- Outline variant: `bg-white` instead of `bg-background`, hover uses `bg-secondary`
- Ghost variant: hover uses `bg-secondary`
- Size `sm` and `lg` both use `rounded-lg`

### 3. Card Component — `components/ui/card.tsx` (UPDATED)
- Changed `rounded-lg` to `rounded-xl` on the Card base

### 4. River Utils — `lib/river-utils.ts` (UPDATED)
- `getStatusColor()`: Changed from solid white-text badges to soft light-theme badges (e.g., `bg-emerald-100 text-emerald-800 border-emerald-200`)
- Added NEW function `getStatusColorSolid()` for hero/marketing contexts where solid badges are needed
- Default unknown status: `bg-zinc-100 text-zinc-600`

### 5. Navigation — `components/navigation.tsx` (REWRITTEN)
- Light theme: `bg-white/90 backdrop-blur-md` with `border-border/60`
- Logo wrapped in subtle `bg-primary/10` rounded box
- Added "How It Works" and "For Guides" anchor links (`/#how-it-works`, `/#for-guides`)
- Active state: `text-primary bg-primary/5` instead of filled primary button
- CTA changed from "Sign Up" to "Get Started"
- Mobile drawer: white background, lighter backdrop (`bg-black/20`)
- Active mobile link: `bg-primary/10 text-primary` instead of solid primary fill
- Hash links (`/#...`) excluded from `isActive()` matching

### 6. Footer — `components/footer.tsx` (NEW FILE)
- 4-column grid: Brand, Product, For You, Data
- Brand section: logo + "A product by Back Alley Fly" tagline
- Product links: Browse Rivers, How It Works, Features, Get Started
- For You links: For Guides, For Anglers, Favorites, Alerts
- Data section: USGS attribution, update frequency, coverage stats
- Bottom bar: copyright + USGS data attribution
- Light theme: `bg-white`, `border-t border-border`

---

## What Still Needs To Be Done

### 7. **Homepage Rewrite — `app/page.tsx`** (THE BIG ONE — NOT STARTED)
The current homepage has only 3 thin sections. Needs complete rewrite with 8 sections:

#### Section 1: Hero
- Strong headline about real-time river conditions + fast decision-making
- Subhead explaining value prop
- Primary CTA ("View Live Conditions") + Secondary CTA ("Get Started Free")
- Large product mockup/screenshot area showing a mocked StreamFlows river card UI
- The mockup should show: river name, status badge, trend arrow, flow stats, mini sparkline

#### Section 2: Proof/Trust Bar
- Stats strip: "50+ New England Rivers" / "6 States Covered" / "Updated Every 15 Min" / "Powered by USGS" / "River-Specific Tuned Ranges"
- Clean horizontal layout with dividers, icons optional

#### Section 3: Live River Snapshot
- 3-4 example river cards shown directly on homepage
- Mocked data is fine (Deerfield, Swift, Farmington, etc.)
- Each card: river name, state, flow CFS, status badge, trend indicator, mini sparkline
- Section title like "What's fishing right now"

#### Section 4: How It Works (`id="how-it-works"`)
- 3-4 step visual explanation:
  1. Live USGS gauge data pulled every 15 minutes
  2. River-specific thresholds tuned for fishing conditions
  3. Translated into clear status labels (Optimal, Elevated, etc.)
  4. Trend + historical context for decision-making
- Use numbered steps or icons, not just paragraphs

#### Section 5: Feature Deep-Dives (`id="features"`)
- 5 richer feature sections (not the old 4 tiny cards):
  1. **Know what's fishable now** — status badges, real-time conditions
  2. **See where conditions are headed** — trend arrows, 24-hour charts
  3. **Watch your home waters** — favorites dashboard
  4. **Get alerts when the river turns on** — smart notifications
  5. **Keep private notes on rivers** — guide notes
- Each should have: headline, 2-3 sentence description, visual/icon

#### Section 6: Audience Section (`id="for-guides"`)
- Split layout: "For Guides" / "For Serious Anglers"
- For Guides: quick client-day decisions, multi-river monitoring, private notes
- For Anglers: stop checking multiple USGS pages, track favorites, get alerts

#### Section 7: "Why Not Just Use USGS?" Comparison
- Two-column comparison:
  - **Without StreamFlows**: multiple tabs, raw CFS interpretation, guesswork, missed windows
  - **With StreamFlows**: one dashboard, clear status labels, trends, alerts, river-specific intelligence
- Visual contrast between the two sides

#### Section 8: Final CTA
- Strong closing section encouraging sign up or river browsing
- Primary + secondary CTAs
- Reinforce the value proposition

### 8. River Card — `components/river-card.tsx` (NOT STARTED)
- Update for light theme compatibility
- `hover:shadow-black/30` → lighter shadow
- `bg-secondary/40` stat boxes → needs light-theme appropriate bg
- Colors should work with new light palette

### 9. Login/Signup Pages (NOT STARTED)
- `app/login/page.tsx` and `app/signup/page.tsx`
- Update `bg-card` → light theme card
- Remove `shadow-black/20` dark shadows
- Droplets icon container should use new primary (river blue)
- Form cards need light-appropriate styling

### 10. Rivers List Page (NOT STARTED)
- `app/rivers/page.tsx` — status summary bar needs light theme tweaks
- `app/rivers/rivers-list.tsx` — filter bar `bg-card` will auto-adapt, but check shadows/borders

### 11. River Detail Page (NOT STARTED)
- `app/rivers/[slug]/river-detail.tsx`
- Chart colors hardcoded to dark HSL values — needs light theme colors:
  - CartesianGrid stroke: `hsl(215,23%,18%)` → lighter grid
  - XAxis/YAxis fill: `hsl(215,16%,55%)` → appropriate for light bg
  - Tooltip bg: `hsl(220,38%,11%)` → white with border
  - Line strokes: red primary → new river blue primary
- Toast colors should work as-is (solid green/red)

### 12. Root Layout — `app/layout.tsx` (NOT STARTED)
- Add Footer component import and render after `{children}`
- Consider updating metadata description to match new positioning

### 13. Build & Verify (NOT STARTED)
- `npm run build` to check for TypeScript/compilation errors
- Verify `getStatusColorSolid` export is used correctly if referenced in homepage

---

## Key Design Decisions Already Made

| Decision | Value |
|----------|-------|
| Primary color | River blue `hsl(200, 65%, 38%)` — teal-blue, not the old BAF red |
| Background | Warm off-white `hsl(40, 20%, 97%)` |
| Cards | Pure white `hsl(0, 0%, 100%)` |
| Text | Dark slate `hsl(220, 30%, 18%)` |
| Accent | Sage green `hsl(155, 30%, 42%)` |
| Border radius | `0.625rem` (slightly larger) |
| Status badges | Soft tinted backgrounds (light theme) via `getStatusColor()` |
| Solid status badges | Available via `getStatusColorSolid()` for marketing use |
| Nav style | White glass with backdrop blur |
| Buttons | `rounded-lg`, `font-semibold`, subtle shadows |

## File Map

```
MODIFIED (uncommitted):
  app/globals.css              — Light theme CSS variables
  components/navigation.tsx    — Redesigned nav
  components/ui/button.tsx     — Light theme button variants
  components/ui/card.tsx       — rounded-xl cards
  lib/river-utils.ts           — Light theme status colors + getStatusColorSolid()

NEW (uncommitted):
  components/footer.tsx        — Footer component

NOT YET TOUCHED:
  app/page.tsx                 — Homepage (needs full rewrite — 8 sections)
  app/layout.tsx               — Needs footer integration
  components/river-card.tsx    — Needs light theme update
  app/login/page.tsx           — Needs light theme update
  app/signup/page.tsx          — Needs light theme update
  app/rivers/page.tsx          — Minor light theme tweaks
  app/rivers/rivers-list.tsx   — Minor light theme tweaks
  app/rivers/[slug]/river-detail.tsx — Chart colors need light theme update
```

## How to Continue

1. Start with `app/page.tsx` — write the full 8-section homepage (this is the highest-impact change)
2. Then update `app/layout.tsx` to include the Footer
3. Update `components/river-card.tsx` for light theme
4. Update the remaining pages (login, signup, rivers, river detail) — mostly shadow/color tweaks
5. Run `npm run build` to verify everything compiles
6. Commit all changes and push to `claude/redesign-streamflows-ux-SgwHu`

## Copy/Tone Guidelines
- Clear, specific, confident
- Slightly rugged / outdoors-informed
- Not corporate or startup-y
- Focus on decision-making and usefulness
- "fishing intelligence" not "analytics platform"
- "river conditions" not "data visualization"
- Speak like people who understand fishing built this
