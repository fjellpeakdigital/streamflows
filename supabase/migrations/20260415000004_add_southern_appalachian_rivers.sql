-- Add Southern Appalachian rivers for the Charlotte NC / western NC / TN guide market
-- Five rivers: Green River NC, Catawba River NC (Lake James tailwater),
-- New River NC, Watauga River TN, South Holston River TN

INSERT INTO rivers (
  name, slug, region, usgs_station_id, description,
  optimal_flow_min, optimal_flow_max,
  latitude, longitude, gauge_type
) VALUES
  (
    'Green River',
    'green-river-nc',
    'North Carolina',
    '02149702',
    'Wild rainbow and brown trout tailwater below Lake Summit dam in Polk County. Section A between Lake Summit and Fishtop Falls holds wild fish. Duke Energy controls releases — base-flow wading windows offer the best dry-fly fishing. Flows above 800 CFS during active generation make wading dangerous.',
    100, 400,
    35.30567, -82.27512,
    'realtime'
  ),
  (
    'Catawba River',
    'catawba-river-nc',
    'North Carolina',
    '02138500',
    'Cold-water tailwater below Lake James dam near Bridgewater in Burke County. Duke Energy manages releases; the reach directly below the dam holds stocked rainbow and brown trout in reliably cold water. Approximately 1.5 hours from Charlotte.',
    200, 600,
    35.768, -81.882,
    'realtime'
  ),
  (
    'New River',
    'new-river-nc',
    'North Carolina',
    '03161000',
    'One of the oldest rivers in the world, flowing north through Ashe County near West Jefferson. Free-stone river with wild rainbow trout in upper reaches and world-class smallmouth bass throughout. No dam control — best fished at moderate levels.',
    200, 800,
    36.39333, -81.40694,
    'realtime'
  ),
  (
    'Watauga River',
    'watauga-river-tn',
    'Tennessee',
    '03483980',
    'TVA tailwater below Wilbur Dam near Elizabethton — 17.8 miles of clear, cold water with excellent rainbow and brown trout. TVA generation schedule creates defined wading windows; flow jumps from ~130 CFS to 3,300 CFS when generators run. Always check the TVA generation schedule before a trip.',
    80, 400,
    36.341, -82.123,
    'realtime'
  ),
  (
    'South Holston River',
    'south-holston-river-tn',
    'Tennessee',
    '03476500',
    'Blue-ribbon TVA tailwater below South Holston Dam near Bristol. Wild rainbow and brown trout with prolific sulfur hatches April through August. Water temperature holds 46–52°F year-round near the dam. Generation raises flow to 3,300 CFS rapidly — check TVA schedule before visiting.',
    10, 400,
    36.52356, -82.09726,
    'realtime'
  );

-- Add species for each river
DO $$
DECLARE
  green_id     UUID;
  catawba_id   UUID;
  new_river_id UUID;
  watauga_id   UUID;
  s_holston_id UUID;
BEGIN
  SELECT id INTO green_id     FROM rivers WHERE slug = 'green-river-nc';
  SELECT id INTO catawba_id   FROM rivers WHERE slug = 'catawba-river-nc';
  SELECT id INTO new_river_id FROM rivers WHERE slug = 'new-river-nc';
  SELECT id INTO watauga_id   FROM rivers WHERE slug = 'watauga-river-tn';
  SELECT id INTO s_holston_id FROM rivers WHERE slug = 'south-holston-river-tn';

  INSERT INTO river_species (river_id, species) VALUES
    -- Green River NC
    (green_id, 'rainbow trout'),
    (green_id, 'brown trout'),
    -- Catawba River NC
    (catawba_id, 'rainbow trout'),
    (catawba_id, 'brown trout'),
    -- New River NC
    (new_river_id, 'smallmouth bass'),
    (new_river_id, 'rainbow trout'),
    -- Watauga River TN
    (watauga_id, 'rainbow trout'),
    (watauga_id, 'brown trout'),
    -- South Holston River TN
    (s_holston_id, 'rainbow trout'),
    (s_holston_id, 'brown trout');
END $$;
