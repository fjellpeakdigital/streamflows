-- Seed data for New England rivers

-- Connecticut Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Farmington River - West Branch', 'farmington-river-west-branch', '01186500', 'Connecticut', 'Premier trout fishing destination in Connecticut, known for wild browns and rainbows.', 200, 600, 41.9234, -72.9953),
('Housatonic River', 'housatonic-river', '01197500', 'Connecticut', 'Large freestone river with excellent brown trout fishing.', 400, 1200, 41.9645, -73.3468),
('Naugatuck River', 'naugatuck-river', '01208500', 'Connecticut', 'Improving trout fishery in northwestern Connecticut.', 150, 500, 41.5565, -73.0515),
('Salmon River', 'salmon-river-ct', '01193500', 'Connecticut', 'Popular salmon and trout river in eastern Connecticut.', 100, 400, 41.4890, -72.4168);

-- Maine Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Kennebec River', 'kennebec-river', '01046500', 'Maine', 'World-class landlocked salmon and brook trout fishing.', 2000, 6000, 45.2544, -69.7194),
('Penobscot River', 'penobscot-river', '01034500', 'Maine', 'Historic Atlantic salmon river with excellent fishing opportunities.', 3000, 8000, 44.8014, -68.7778),
('Rapid River', 'rapid-river', '01054200', 'Maine', 'Famous brook trout and landlocked salmon waters.', 200, 600, 44.6678, -70.7536),
('Androscoggin River', 'androscoggin-river', '01054200', 'Maine', 'Large river with diverse fishing for trout and salmon.', 1500, 4000, 44.4925, -70.4533);

-- Massachusetts Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Deerfield River', 'deerfield-river', '01170000', 'Massachusetts', 'Excellent tailwater fishery with year-round trout fishing.', 300, 900, 42.5409, -72.7995),
('Westfield River - West Branch', 'westfield-river-west-branch', '01181000', 'Massachusetts', 'Wild trout stream in the Berkshires.', 100, 400, 42.3126, -72.8759),
('Swift River', 'swift-river-ma', '01175500', 'Massachusetts', 'Cold tailwater with excellent trout fishing below Quabbin Reservoir.', 80, 250, 42.3667, -72.3000),
('Quaboag River', 'quaboag-river', '01176000', 'Massachusetts', 'Underrated trout fishery in central Massachusetts.', 100, 300, 42.1834, -72.1453);

-- New Hampshire Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Connecticut River - Upper', 'connecticut-river-upper', '01144000', 'New Hampshire', 'Large river with diverse species including trout and bass.', 1000, 3000, 44.0059, -72.0887),
('Androscoggin River - Upper', 'androscoggin-river-upper-nh', '01054200', 'New Hampshire', 'Brook trout and salmon waters in northern NH.', 500, 1500, 44.6342, -71.1689),
('Swift River - NH', 'swift-river-nh', '01144500', 'New Hampshire', 'Beautiful mountain stream with native brook trout.', 80, 250, 43.9667, -71.2500),
('Pemigewasset River', 'pemigewasset-river', '01077000', 'New Hampshire', 'Popular White Mountains trout stream.', 200, 800, 43.6778, -71.7034);

-- Vermont Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Battenkill River', 'battenkill-river', '01332500', 'Vermont', 'Legendary wild trout river straddling VT/NY border.', 150, 500, 43.1667, -73.2167),
('White River', 'white-river-vt', '01141500', 'Vermont', 'Excellent wild brown trout fishery.', 200, 800, 43.8167, -72.4167),
('Lamoille River', 'lamoille-river', '04292500', 'Vermont', 'Quality trout and smallmouth bass fishing.', 300, 1000, 44.5611, -72.8126),
('Winooski River', 'winooski-river', '04290500', 'Vermont', 'Urban trout fishery with good access.', 400, 1200, 44.4759, -73.2121),
('Otter Creek', 'otter-creek', '04282650', 'Vermont', 'Warmwater species and trout in upper reaches.', 300, 1000, 43.9167, -73.1667),
('Mad River', 'mad-river-vt', '04288000', 'Vermont', 'Classic Vermont mountain stream with wild trout.', 100, 400, 44.2000, -72.8333);

-- Rhode Island Rivers
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Pawcatuck River', 'pawcatuck-river', '01118500', 'Rhode Island', 'Diverse fishery with trout and warmwater species.', 150, 500, 41.4333, -71.6833),
('Wood River', 'wood-river-ri', '01117800', 'Rhode Island', 'Wild brook trout and stocked trout fishery.', 50, 200, 41.4833, -71.6833);

-- New Hampshire - Additional
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Saco River', 'saco-river', '01064500', 'New Hampshire', 'Scenic river with trout and smallmouth bass.', 400, 1200, 43.9667, -71.0000),
('Merrimack River', 'merrimack-river', '01092000', 'New Hampshire', 'Large river system with diverse fishing opportunities.', 2000, 6000, 42.7654, -71.4676);

-- Maine - Additional
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Roach River', 'roach-river', '01030000', 'Maine', 'Remote brook trout and salmon stream.', 100, 400, 45.7000, -69.6667),
('Carrabassett River', 'carrabassett-river', '01047000', 'Maine', 'Mountain stream with native brook trout.', 150, 500, 45.0333, -70.2500);

-- Massachusetts - Additional
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Millers River', 'millers-river', '01166500', 'Massachusetts', 'Large freestone stream with wild and stocked trout.', 200, 700, 42.5833, -72.1833),
('Squannacook River', 'squannacook-river', '01096000', 'Massachusetts', 'Small stream with excellent wild trout.', 50, 200, 42.6167, -71.6667);

-- Connecticut - Additional
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Shetucket River', 'shetucket-river', '01122500', 'Connecticut', 'Warmwater fishery with some trout in tributaries.', 300, 1000, 41.5667, -72.0833),
('Natchaug River', 'natchaug-river', '01122000', 'Connecticut', 'Wild trout stream in eastern Connecticut.', 80, 300, 41.8167, -72.0167);

-- Vermont - Additional
INSERT INTO rivers (name, slug, usgs_station_id, region, description, optimal_flow_min, optimal_flow_max, latitude, longitude) VALUES
('Missisquoi River', 'missisquoi-river', '04294500', 'Vermont', 'Northern Vermont river with diverse fishing.', 400, 1200, 44.9667, -72.8333),
('Dog River', 'dog-river', '04287000', 'Vermont', 'Small stream with wild brook trout.', 50, 200, 44.2333, -72.6167);

-- Seed river species
INSERT INTO river_species (river_id, species)
SELECT id, 'trout' FROM rivers WHERE name LIKE '%Farmington%' OR name LIKE '%Deerfield%' OR name LIKE '%Battenkill%';

INSERT INTO river_species (river_id, species)
SELECT id, 'salmon' FROM rivers WHERE name LIKE '%Kennebec%' OR name LIKE '%Penobscot%' OR name LIKE '%Salmon%';

INSERT INTO river_species (river_id, species)
SELECT id, 'bass' FROM rivers WHERE name LIKE '%Housatonic%' OR name LIKE '%Connecticut%';

INSERT INTO river_species (river_id, species)
SELECT id, 'trout' FROM rivers WHERE region IN ('Maine', 'New Hampshire', 'Vermont');
