-- Seed data for New England rivers
-- Idempotent: deletes by slug before inserting so stale station IDs can't conflict.
-- Run `supabase db push` to apply migrations before seeding.

-- Remove any existing rows for the rivers we're about to seed (cascades to river_species).
-- Keyed on slug so this is safe even if station IDs were previously wrong.
DELETE FROM rivers WHERE slug IN (
  'pemigewasset-river','androscoggin-river','saco-river','ammonoosuc-river',
  'swift-river-nh','connecticut-river-nh','merrimack-river','contoocook-river',
  'lamprey-river','salmon-falls-river','kennebec-river','penobscot-river',
  'rapid-river','presumpscot-river','deerfield-river','westfield-river',
  'millers-river','farmington-river','housatonic-river','white-river-vt',
  'winooski-river','lamoille-river'
);

-- Also remove any leftover rows that share a station ID with our set
-- (catches old rows inserted under different slugs, e.g. the three rivers
--  that were incorrectly seeded with 01054200 in the previous session).
DELETE FROM rivers WHERE usgs_station_id IN (
  '01075000','01054500','01064500','01137500','01054200','01144000',
  '01100000','01138500','01073500','01069500','01049500','01034500',
  '01065500','01064300','01169000','01183500','01162500','01186500',
  '01199000','01141500','04288000','04292000'
);

-- Fresh inserts — no conflict handling needed, the DELETEs cleared the way.
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
-- New Hampshire
('Pemigewasset River',  'pemigewasset-river',   '01075000', 'NH', 'Popular White Mountains trout stream through Franconia Notch.', 200,  800,  43.6778, -71.7034),
('Androscoggin River',  'androscoggin-river',   '01054500', 'NH', 'Large border river with brown trout and landlocked salmon.',    500,  2000, 44.4925, -71.1689),
('Saco River',          'saco-river',           '01064500', 'NH', 'Scenic White Mountains river with brown trout and rainbow.',    300,  1200, 43.9667, -71.0000),
('Ammonoosuc River',    'ammonoosuc-river',     '01137500', 'NH', 'Mountain tributary with wild brook and brown trout.',           100,  500,  44.2667, -71.6833),
('Swift River',         'swift-river-nh',       '01054200', 'NH', 'Classic cold mountain stream with brown and rainbow trout.',    50,   250,  43.9500, -71.3000),
('Connecticut River',   'connecticut-river-nh', '01144000', 'NH', 'Large border river with trout, walleye, and bass.',             800,  3000, 44.0059, -72.0887),
('Merrimack River',     'merrimack-river',      '01100000', 'NH', 'Large NH river with bass and brown trout.',                     400,  1500, 42.7654, -71.4676),
('Contoocook River',    'contoocook-river',     '01138500', 'NH', 'Quality brown and rainbow trout fishery in central NH.',        150,  600,  43.0500, -71.9333),
('Lamprey River',       'lamprey-river',        '01073500', 'NH', 'Scenic SE New Hampshire trout river.',                          80,   400,  43.1000, -71.1333),
('Salmon Falls River',  'salmon-falls-river',   '01069500', 'NH', 'Border river with brown trout and rainbow.',                    100,  500,  43.3667, -70.9833),
-- Maine
('Kennebec River',      'kennebec-river',       '01049500', 'ME', 'World-class landlocked salmon and brown trout tailwater.',      1000, 4000, 45.2544, -69.7194),
('Penobscot River',     'penobscot-river',      '01034500', 'ME', 'Historic Atlantic salmon and rainbow trout river.',             800,  3500, 44.8014, -68.7778),
('Rapid River',         'rapid-river',          '01065500', 'ME', 'Remote wild brook trout and rainbow fishery.',                  200,  700,  44.6678, -70.7536),
('Presumpscot River',   'presumpscot-river',    '01064300', 'ME', 'Lower Maine river with stocked and wild brown trout.',          150,  600,  43.8667, -70.3167),
-- Massachusetts
('Deerfield River',     'deerfield-river',      '01169000', 'MA', 'Premier CT Valley tailwater with year-round trout fishing.',   200,  900,  42.5409, -72.7995),
('Westfield River',     'westfield-river',      '01183500', 'MA', 'Berkshire freestone stream with wild brook and brown trout.',   150,  600,  42.1167, -72.7667),
('Millers River',       'millers-river',        '01162500', 'MA', 'Large north-central MA river with wild and stocked trout.',     100,  500,  42.5833, -72.1833),
-- Connecticut
('Farmington River',    'farmington-river',     '01186500', 'CT', 'Premier wild trout river, TMA catch-and-release section.',     200,  800,  41.9234, -72.9953),
('Housatonic River',    'housatonic-river',     '01199000', 'CT', 'Large freestone with excellent wild brown trout.',              300,  1200, 41.9645, -73.3468),
-- Vermont
('White River',         'white-river-vt',       '01141500', 'VT', 'Classic Vermont wild brown trout fishery.',                    200,  700,  43.8167, -72.4167),
('Winooski River',      'winooski-river',       '04288000', 'VT', 'Central Vermont trout and smallmouth bass river.',              300,  1000, 44.4759, -73.2121),
('Lamoille River',      'lamoille-river',       '04292000', 'VT', 'Northern Vermont brown and rainbow trout river.',               200,  800,  44.5611, -72.8126);

-- Species (river_species rows were cascade-deleted above, so plain INSERTs are safe)
INSERT INTO river_species (river_id, species)
SELECT id, 'brown trout' FROM rivers WHERE slug IN (
  'pemigewasset-river','androscoggin-river','saco-river','ammonoosuc-river',
  'swift-river-nh','contoocook-river','lamprey-river','salmon-falls-river',
  'merrimack-river','kennebec-river','presumpscot-river','deerfield-river',
  'westfield-river','millers-river','farmington-river','housatonic-river',
  'white-river-vt','winooski-river','lamoille-river'
);

INSERT INTO river_species (river_id, species)
SELECT id, 'rainbow trout' FROM rivers WHERE slug IN (
  'pemigewasset-river','saco-river','swift-river-nh','salmon-falls-river',
  'penobscot-river','rapid-river','deerfield-river','westfield-river',
  'millers-river','farmington-river','housatonic-river','white-river-vt',
  'winooski-river','lamoille-river'
);

INSERT INTO river_species (river_id, species)
SELECT id, 'brook trout' FROM rivers WHERE slug IN (
  'ammonoosuc-river','swift-river-nh','rapid-river','westfield-river'
);

INSERT INTO river_species (river_id, species)
SELECT id, 'landlocked salmon' FROM rivers WHERE slug IN (
  'androscoggin-river','kennebec-river','penobscot-river'
);

INSERT INTO river_species (river_id, species)
SELECT id, 'bass' FROM rivers WHERE slug IN (
  'merrimack-river','connecticut-river-nh','winooski-river'
);

INSERT INTO river_species (river_id, species)
SELECT id, 'walleye' FROM rivers WHERE slug IN ('connecticut-river-nh');
