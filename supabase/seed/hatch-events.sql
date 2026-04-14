-- Seed hatch events for prominent Northeast rivers.
-- Safe to re-run: clears existing seed rows (user_id IS NULL) for these rivers first.

DELETE FROM hatch_events
WHERE user_id IS NULL
  AND river_id IN (
    SELECT id FROM rivers
    WHERE slug IN (
      'farmington-ct',
      'deerfield-ma',
      'battenkill-vt',
      'housatonic-ct',
      'westfield-ma',
      'connecticut-river-vt',
      'androscoggin-me',
      'penobscot-me'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Farmington River (CT) — tailwater, cold, long season
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 1, 10, 30, 4, 15, 5, 15, 'Reliable on overcast days, #18–20 BWO dry', NULL FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Quill Gordon', 4, 15, 5, 10, 4, 20, 5, 5, 'Early-season classic, fish in the afternoon, #14', 50 FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 4, 25, 5, 25, 5, 1, 5, 15, 'Prime hatch window, #12–14 dry or spinner fall at dusk', 52 FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 5, 20, 7, 15, 6, 1, 6, 20, 'Evening emergence, #16 Sulphur dun', 58 FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 5, 25, 7, 15, 6, 10, 6, 30, 'Afternoon through dusk, #14', NULL FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Trico', 7, 15, 9, 15, 8, 1, 8, 25, 'Morning spinner fall, #22–24', NULL FROM rivers WHERE slug = 'farmington-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 15, 7, 20, 9, 10, 'Ants, beetles, hoppers along banks, #14–18', NULL FROM rivers WHERE slug = 'farmington-ct';

-- ─────────────────────────────────────────────────────────────────────────────
-- Deerfield River (MA) — tailwater
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 1, 10, 30, 4, 20, 5, 20, 'Cloudy afternoons are best, #18', NULL FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 1, 5, 30, 5, 5, 5, 20, 'Mid-afternoon hatch, #12–14', 52 FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 15, 6, 20, 5, 25, 6, 10, 'Sporadic, fish the dun and emerger, #12', NULL FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 5, 25, 7, 5, 6, 5, 6, 25, 'Evening hatch, #16 Sulphur', 58 FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 1, 7, 20, 6, 15, 7, 5, 'Evening emergence, #14', NULL FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Isonychia', 6, 15, 9, 30, 8, 1, 9, 15, 'Fast water, fish a #10–12 dry or wet', NULL FROM rivers WHERE slug = 'deerfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 15, 7, 20, 9, 15, 'Hoppers and ants on sunny afternoons', NULL FROM rivers WHERE slug = 'deerfield-ma';

-- ─────────────────────────────────────────────────────────────────────────────
-- Battenkill (VT) — freestone, selective wild browns
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Quill Gordon', 4, 20, 5, 15, 4, 25, 5, 10, 'Warmer afternoons only, #14', 50 FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue Quill', 4, 25, 5, 20, 5, 1, 5, 15, 'Small, tricky rises, #18', NULL FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 1, 5, 28, 5, 8, 5, 22, 'The signature hatch — match the female spinner, #14', 52 FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 20, 6, 20, 6, 1, 6, 15, 'Fish emergers in riffles, #12', NULL FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 5, 25, 7, 10, 6, 5, 6, 25, 'Prolific evening hatch, #16', 58 FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 1, 7, 15, 6, 10, 6, 30, 'Evening dry, #14', NULL FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Trico', 7, 20, 9, 20, 8, 5, 8, 30, 'Early morning spinners, #24', NULL FROM rivers WHERE slug = 'battenkill-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 10, 8, 1, 9, 15, 'Ants are deadly on the Battenkill, #16–18', NULL FROM rivers WHERE slug = 'battenkill-vt';

-- ─────────────────────────────────────────────────────────────────────────────
-- Housatonic (CT) — warmer freestone
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 1, 6, 15, 4, 20, 5, 15, 'Spring BWOs best before water warms, #18', NULL FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 4, 25, 5, 20, 5, 1, 5, 12, 'Hot hatch in TMA sections, #14', 52 FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 10, 6, 15, 5, 20, 6, 5, 'Big meaty dry, #12', NULL FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Green Drake', 5, 25, 6, 20, 6, 1, 6, 12, 'Big bugs, big fish — evening only, #8–10', NULL FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 5, 25, 6, 30, 6, 1, 6, 20, 'Dusk hatch, #16', 58 FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 5, 7, 15, 6, 15, 7, 5, 'Evening, #12–14', NULL FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Isonychia', 6, 15, 9, 20, 8, 1, 9, 10, 'Drift a #10 bead-head or swing a wet', NULL FROM rivers WHERE slug = 'housatonic-ct';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 15, 7, 15, 9, 15, 'Hopper-dropper rig is king in summer', NULL FROM rivers WHERE slug = 'housatonic-ct';

-- ─────────────────────────────────────────────────────────────────────────────
-- Westfield (MA) — freestone
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue Quill', 4, 20, 5, 15, 5, 1, 5, 10, 'Cloudy afternoons, #18', NULL FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Quill Gordon', 4, 20, 5, 12, 4, 25, 5, 5, 'Afternoon, #14', 50 FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 1, 5, 25, 5, 5, 5, 18, 'Primary hatch — dun and spinner, #14', 52 FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 15, 6, 15, 5, 25, 6, 5, 'Riffles and pocket water, #12', NULL FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 5, 25, 7, 5, 6, 1, 6, 20, 'Best in afternoon, #16 Sulphur dry', 58 FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 1, 7, 15, 6, 10, 6, 30, 'Evening rises, #14', NULL FROM rivers WHERE slug = 'westfield-ma';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 15, 7, 20, 9, 10, 'Hoppers and beetles, #14', NULL FROM rivers WHERE slug = 'westfield-ma';

-- ─────────────────────────────────────────────────────────────────────────────
-- Connecticut River (VT) — large river
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 10, 10, 15, 5, 1, 5, 20, 'Multi-brood, #18 dry or emerger', NULL FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 5, 5, 30, 5, 10, 5, 22, 'Slower water pockets, #14', 52 FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 20, 6, 20, 6, 1, 6, 12, 'Fish the banks, #12', NULL FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 6, 1, 7, 10, 6, 10, 6, 28, 'Evening, #16', 58 FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 10, 7, 25, 6, 20, 7, 10, 'Dusk risers, #14', NULL FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Isonychia', 6, 20, 9, 30, 8, 5, 9, 15, 'Swing a wet fly through riffles, #10', NULL FROM rivers WHERE slug = 'connecticut-river-vt';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 1, 10, 10, 8, 1, 9, 15, 'Hoppers along grassy banks, #12–14', NULL FROM rivers WHERE slug = 'connecticut-river-vt';

-- ─────────────────────────────────────────────────────────────────────────────
-- Androscoggin (ME) — cool, northern
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 15, 10, 15, 5, 10, 5, 30, 'Gray afternoons, #18', NULL FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 10, 6, 5, 5, 15, 5, 28, 'Main spring hatch, #14', 52 FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 25, 6, 25, 6, 5, 6, 18, 'Sporadic, fish emergers, #12', NULL FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Green Drake', 6, 5, 6, 30, 6, 12, 6, 22, 'Big evening event, #8–10', NULL FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 6, 5, 7, 15, 6, 15, 7, 5, 'Evening, #16', 58 FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 15, 7, 30, 6, 25, 7, 15, 'Dusk, #14', NULL FROM rivers WHERE slug = 'androscoggin-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 10, 10, 5, 8, 1, 9, 10, 'Hoppers and ants, #14–16', NULL FROM rivers WHERE slug = 'androscoggin-me';

-- ─────────────────────────────────────────────────────────────────────────────
-- Penobscot (ME) — big northern water, salmon + trout
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Blue-Winged Olive', 4, 20, 10, 15, 5, 15, 6, 5, 'Reliable all season, #18', NULL FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Hendrickson', 5, 15, 6, 10, 5, 20, 6, 2, 'Slower water, #14', 52 FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'March Brown', 5, 30, 6, 30, 6, 8, 6, 22, 'Big dries work, #12', NULL FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Green Drake', 6, 10, 7, 5, 6, 15, 6, 28, 'Trophy hatch — fish at dusk, #8', NULL FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Sulphur', 6, 10, 7, 20, 6, 20, 7, 10, 'Evening, #16', 58 FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Light Cahill', 6, 20, 8, 5, 7, 1, 7, 20, 'Dusk, #14', NULL FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Isonychia', 6, 25, 9, 30, 8, 5, 9, 15, 'Swing wets or skate a dry, #10', NULL FROM rivers WHERE slug = 'penobscot-me';

INSERT INTO hatch_events (river_id, user_id, insect, start_month, start_day, end_month, end_day, peak_start_month, peak_start_day, peak_end_month, peak_end_day, notes, temp_trigger)
SELECT id, NULL, 'Terrestrials', 7, 10, 10, 5, 8, 5, 9, 15, 'Hoppers, ants, beetles, #14', NULL FROM rivers WHERE slug = 'penobscot-me';
