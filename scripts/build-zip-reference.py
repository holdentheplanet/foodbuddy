"""Build bundled ZIP-area points from the official downloaded Census ZIP archive.
Usage: python3 scripts/build-zip-reference.py /path/to/2025_Gaz_zcta_national.zip
No network or runtime geocoding is used. See stores/zip/README.md.
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import zipfile

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as source:
    rows = csv.DictReader(io.StringIO(source.read('2025_Gaz_zcta_national.txt').decode('utf-8-sig')), delimiter='|')
    points = {}
    for row in rows:
        code = row['GEOID'].strip()
        lat, lon = float(row['INTPTLAT']), float(row['INTPTLONG'])
        if not re.fullmatch(r'\d{5}', code) or code in points or not all(map(math.isfinite, (lat, lon))) or abs(lat) > 90 or abs(lon) > 180:
            raise ValueError('Invalid or duplicate Census point')
        points[code] = [lat, lon]
root = Path(__file__).resolve().parents[1] / 'stores' / 'zip'
(root / 'us-zcta-2025.json').write_text(json.dumps(dict(sorted(points.items())), separators=(',', ':')) + '\n')
(root / 'source.json').write_text(json.dumps({
    'publisher': 'U.S. Census Bureau', 'release': '2025 Gazetteer; 2020 Census ZCTA geography',
    'sourceUrl': 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip',
    'referenceUrl': 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html',
    'fields': ['GEOID', 'INTPTLAT', 'INTPTLONG'], 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'pointCount': len(points), 'coordinateMeaning': 'Approximate ZIP-area representative internal point, not a device or street address',
}, indent=2) + '\n')
print('Bundled Census ZIP-area points:', len(points))
