"""Development-only: extract grocery candidates from downloaded OSM PBF files.
Requires osmium 4.3.2 in a separate Python environment, never a mobile dependency.
Usage: python scripts/extract-osm-stores.py /directory/of/PBFs /output/candidates.json
No network calls; incomplete addresses and non-node/non-closed-way features are skipped.
"""
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import osmium

ROOT = Path(__file__).resolve().parents[1]
POINTS = json.loads((ROOT / 'stores/zip/us-zcta-2025.json').read_text())
REGIONS = {
    'NewYork': ('New York City', '10001', (40.49, -74.30, 40.95, -73.65), 'https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf'),
    'Atlanta': ('Atlanta', '30303', (33.5, -84.65, 34.0, -84.05), 'https://download.geofabrik.de/north-america/us/georgia-latest.osm.pbf'),
    'Chicago': ('Chicago', '60601', (41.6, -88.1, 42.15, -87.45), 'https://download.bbbike.org/osm/bbbike/Chicago/Chicago.osm.pbf'),
    'Dallas': ('Dallas–Fort Worth', '75201', (32.5, -97.6, 33.1, -96.4), 'https://download.bbbike.org/osm/bbbike/Dallas/Dallas.osm.pbf'),
    'Denver': ('Denver', '80202', (39.5, -105.2, 40.0, -104.65), 'https://download.bbbike.org/osm/bbbike/Denver/Denver.osm.pbf'),
    'LosAngeles': ('Los Angeles', '90012', (33.7, -118.6, 34.3, -117.8), 'https://download.bbbike.org/osm/bbbike/LosAngeles/LosAngeles.osm.pbf'),
}

def miles(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 3958.7613 * 2 * math.asin(math.sqrt(min(1, h)))

class Groceries(osmium.SimpleHandler):
    def __init__(self, metro, bounds, metadata):
        super().__init__()
        self.metro, self.bounds, self.metadata = metro, bounds, metadata
        self.candidates = []
        self.incomplete = 0

    def tags(self, obj):
        tags = dict(obj.tags)
        if tags.get('shop') != 'supermarket': return None
        required = ['name','addr:housenumber','addr:street','addr:city','addr:state','addr:postcode']
        if any(not tags.get(key, '').strip() for key in required) or not re.fullmatch(r'[A-Z]{2}', tags['addr:state']) or not re.fullmatch(r'\d{5}(-\d{4})?', tags['addr:postcode']):
            self.incomplete += 1
            return None
        if any(key in tags for key in ['disused:shop','abandoned:shop','construction']): return None
        return {key: value for key,value in tags.items() if key in required + ['shop','brand','operator','ref','website']}

    def add(self, obj, kind, tags, lat, lon):
        south, west, north, east = self.bounds
        if not (south <= lat <= north and west <= lon <= east): return
        street = tags['addr:housenumber'] + ' ' + tags['addr:street']
        self.candidates.append({
            'id': f'osm-{kind}-{obj.id}', 'name': tags['name'], 'chain': tags.get('brand') or 'Unknown chain',
            'streetAddress': street, 'city': tags['addr:city'], 'state': tags['addr:state'], 'zipCode': tags['addr:postcode'],
            'latitude': lat, 'longitude': lon, 'verificationStatus': 'unverified',
            'checkedAt': datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
            'sources': [{'url': f'https://www.openstreetmap.org/{kind}/{obj.id}', 'kind': 'openstreetmap',
                         'evidence': f'OSM dataset tags: {street}, {tags["addr:city"]}, {tags["addr:state"]} {tags["addr:postcode"]}; latitude {lat}, longitude {lon}. Original tags retained; no independent location verification.'}],
            'notes': 'Dataset-sourced, not independently verified. ' + ('Mapped point, not a surveyed entrance.' if kind == 'node' else 'Approximate bounding-box center of the closed mapped shop outline, not a surveyed entrance.'),
            'attribution': 'Store data © OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright',
            'dataset': {**self.metadata, 'osmType': kind, 'osmId': str(obj.id), 'metro': self.metro,
                        'coordinateMethod': 'osm_node' if kind == 'node' else 'osm_bbox_center', 'originalTags': tags},
        })

    def node(self, obj):
        tags = self.tags(obj)
        if tags and obj.location.valid(): self.add(obj, 'node', tags, obj.location.lat, obj.location.lon)

    def way(self, obj):
        tags = self.tags(obj)
        if not tags or not obj.is_closed() or any(not node.location.valid() for node in obj.nodes): return
        points = [(node.location.lat, node.location.lon) for node in obj.nodes]
        self.add(obj, 'way', tags, (min(p[0] for p in points)+max(p[0] for p in points))/2,
                 (min(p[1] for p in points)+max(p[1] for p in points))/2)

base, output = Path(sys.argv[1]), Path(sys.argv[2])
all_candidates = []
reports = []
for name, (metro, zip_code, bounds, url) in REGIONS.items():
    file = base / (name + '.osm.pbf')
    if not file.exists():
        reports.append({'metro':metro, 'error':'dataset not downloaded'})
        continue
    reader = osmium.io.Reader(str(file)); header = reader.header()
    timestamp = header.get('osmosis_replication_timestamp') or header.get('timestamp'); reader.close()
    if not timestamp: raise ValueError(f'{name}: no documented dataset timestamp')
    meta = {'datasetUrl': url, 'datasetTimestamp': timestamp, 'snapshotSha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    handler = Groceries(metro, bounds, meta)
    # Cache node locations before the C++ tag filter; Python sees only groceries.
    for obj in osmium.FileProcessor(str(file)).with_locations('sparse_mem_array').with_filter(osmium.filter.TagFilter(('shop', 'supermarket'))):
        if isinstance(obj, osmium.osm.Node): handler.node(obj)
        elif isinstance(obj, osmium.osm.Way): handler.way(obj)
    handler.candidates.sort(key=lambda s: (miles(POINTS[zip_code], (s['latitude'],s['longitude'])), s['id']))
    accepted = [s for s in handler.candidates if miles(POINTS[zip_code], (s['latitude'],s['longitude'])) <= 25]
    all_candidates.extend(accepted)
    reports.append({'metro':metro, 'completeWithin25Miles':len(accepted), 'missingRequiredTagsInExtract':handler.incomplete, **meta})
    print(metro, len(accepted), flush=True)
output.write_text(json.dumps({'reports':reports, 'candidates':all_candidates}, indent=2)+'\n')
