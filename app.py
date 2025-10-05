import os, math, hashlib, time
from datetime import date
from flask import Flask, render_template, request, jsonify
import requests
import boto3

app = Flask(__name__)

DIRECTUS_URL = os.getenv('DIRECTUS_URL', '').rstrip('/')
DIRECTUS_TOKEN = os.getenv('DIRECTUS_SUBMIT_TOKEN', '')
DEFAULT_CENTER = os.getenv('DEFAULT_CENTER', '-31.9523,115.8613')
DEFAULT_ZOOM = int(os.getenv('DEFAULT_ZOOM', '11'))
DEFAULT_RADIUS_KM = float(os.getenv('DEFAULT_RADIUS_KM', '5'))
HALLOWEEN_START = os.getenv('HALLOWEEN_START', '')
HALLOWEEN_END = os.getenv('HALLOWEEN_END', '')
REVERSE_GEOCODE = os.getenv('REVERSE_GEOCODE', 'false').lower() == 'true'

SPACES_ENDPOINT = os.getenv('SPACES_ENDPOINT', '')
SPACES_BUCKET = os.getenv('SPACES_BUCKET', '')
SPACES_KEY = os.getenv('SPACES_KEY', '')
SPACES_SECRET = os.getenv('SPACES_SECRET', '')

FIELDS = {
    'id': 'id',
    'status': 'status',
    'title': 'title',
    'description': 'description',
    'lat': 'lat',
    'lng': 'lng',
    'street': 'street',
    'suburb': 'suburb',
    'state': 'state',
    'postcode': 'postcode',
    'start_date': 'start_date',
    'end_date': 'end_date',
    'open_from': 'open_from',
    'open_to': 'open_to',
    'tags': 'tags',
    'scare_level': 'scare_level',
    'photo_url': 'photo_url',
}

def jitter_latlng(seed: str, lat: float, lng: float, radius_m: float = 40.0):
    h = hashlib.sha256(seed.encode()).digest()
    angle = (h[0] / 255.0) * math.pi * 2.0
    dist = (h[1] / 255.0) * radius_m * 0.9 + radius_m * 0.1
    R = 6378137.0
    d = dist / R
    lat_rad = math.radians(lat)
    new_lat = math.asin(math.sin(lat_rad) + math.cos(lat_rad) * d * math.cos(angle))
    new_lng = math.atan2(math.sin(angle) * d, math.cos(lat_rad) - math.sin(lat_rad) * d * math.cos(angle))
    return (lat + math.degrees(new_lat - lat_rad), lng + math.degrees(new_lng))

def deg_bounds(lat: float, radius_km: float):
    dlat = radius_km / 111.32
    dlng = radius_km / (111.32 * math.cos(math.radians(lat)) or 1e-6)
    return dlat, dlng

def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float):
    R = 6371.0
    dlat = math.radians(b_lat - a_lat)
    dlng = math.radians(b_lng - a_lng)
    la1 = math.radians(a_lat)
    la2 = math.radians(b_lat)
    h = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlng/2)**2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))

def reverse_geocode(lat: float, lng: float):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}&zoom=14&addressdetails=1"
        r = requests.get(url, headers={'User-Agent': 'halloween-map/1.0'}, timeout=10)
        if not r.ok:
            return {}
        a = r.json().get('address', {}) or {}
        return {
            'suburb': a.get('suburb') or a.get('neighbourhood') or a.get('hamlet') or a.get('village') or a.get('town') or a.get('city') or '',
            'state': a.get('state') or '',
            'postcode': a.get('postcode') or ''
        }
    except Exception:
        return {}

@app.route('/')
def index():
    return render_template('index.html',
                           default_center=DEFAULT_CENTER,
                           default_zoom=DEFAULT_ZOOM,
                           today=date.today().isoformat(),
                           year=date.today().year)

@app.route('/new')
def new_listing():
    return render_template('new.html', default_center=DEFAULT_CENTER, year=date.today().year)

@app.get('/api/listings')
def api_listings():
    if not DIRECTUS_URL:
        return jsonify([])

    date_q = request.args.get('date') or date.today().isoformat()
    near = request.args.get('near')  # "lat,lng"
    radius_km = float(request.args.get('radius_km') or DEFAULT_RADIUS_KM)
    bbox = request.args.get('bbox')

    qs = []
    # status approved
    qs.append(f"filter[{FIELDS['status']}][_eq]=approved")
    qs.append(f"filter[{FIELDS['start_date']}][_lte]={date_q}")
    qs.append(f"filter[{FIELDS['end_date']}][_gte]={date_q}")

    if near:
        lat_s, lng_s = near.split(',')
        lat, lng = float(lat_s), float(lng_s)
        dlat, dlng = deg_bounds(lat, radius_km)
        qs.append(f"filter[{FIELDS['lat']}][_between]=[{lat-dlat},{lat+dlat}]")
        qs.append(f"filter[{FIELDS['lng']}][_between]=[{lng-dlng},{lng+dlng}]")
    elif bbox:
        w,s,e,n = [float(x) for x in bbox.split(',')]
        qs.append(f"filter[{FIELDS['lat']}][_between]=[{s},{n}]")
        qs.append(f"filter[{FIELDS['lng']}][_between]=[{w},{e}]")

    for k in [FIELDS['id'],FIELDS['title'],FIELDS['lat'],FIELDS['lng'],FIELDS['scare_level'],FIELDS['photo_url'],FIELDS['start_date'],FIELDS['end_date'],FIELDS['open_from'],FIELDS['open_to'],FIELDS['suburb']]:
        qs.append(f"fields[]={k}")
    qs.append("sort[]=-created_at")
    qs.append("limit=500")
    url = f"{DIRECTUS_URL}/items/houses?{'&'.join(qs)}"

    r = requests.get(url, timeout=15)
    if not r.ok:
        return (r.text, r.status_code)

    data = r.json().get('data', [])

    out = []
    for row in data:
        jlat, jlng = jitter_latlng(str(row.get(FIELDS['id'])), float(row.get(FIELDS['lat'])), float(row.get(FIELDS['lng'])), 40.0)
        out.append({
            'id': row.get(FIELDS['id']),
            'title': row.get(FIELDS['title']),
            'lat': jlat, 'lng': jlng,
            'rawLat': float(row.get(FIELDS['lat'])),
            'rawLng': float(row.get(FIELDS['lng'])),
            'scare_level': row.get(FIELDS['scare_level']),
            'photo_url': row.get(FIELDS['photo_url']),
            'start_date': row.get(FIELDS['start_date']),
            'end_date': row.get(FIELDS['end_date']),
            'open_from': row.get(FIELDS['open_from']),
            'open_to': row.get(FIELDS['open_to']),
            'suburb': row.get(FIELDS['suburb']),
        })

    if near:
        lat_s, lng_s = near.split(',')
        nlat, nlng = float(lat_s), float(lng_s)
        with_dist = []
        for o in out:
            d = haversine_km(nlat, nlng, o['rawLat'], o['rawLng'])
            if d <= radius_km:
                o['distance_km'] = d
                with_dist.append(o)
        with_dist.sort(key=lambda x: x.get('distance_km', 1e9))
        out = with_dist

    final = [{k:v for k,v in o.items() if k not in ('rawLat','rawLng')} for o in out]
    return jsonify(final)

@app.post('/api/submit')
def api_submit():
    if not DIRECTUS_URL or not DIRECTUS_TOKEN:
        return ("Directus not configured", 500)
    p = request.get_json(force=True) or {}
    title = p.get('title')
    lat = p.get('lat')
    lng = p.get('lng')
    if not title or lat is None or lng is None:
        return ("Missing title/lat/lng", 400)

    y = date.today().year
    start_date = p.get('start_date') or HALLOWEEN_START or f"{y}-10-20"
    end_date   = p.get('end_date') or HALLOWEEN_END   or f"{y}-11-01"

    suburb = p.get('suburb') or ''
    state = p.get('state') or ''
    postcode = p.get('postcode') or ''
    if REVERSE_GEOCODE and (not suburb or not state or not postcode):
        g = reverse_geocode(float(lat), float(lng))
        suburb = g.get('suburb', suburb)
        state = g.get('state', state)
        postcode = g.get('postcode', postcode)

    body = {
        FIELDS['title']: title,
        FIELDS['description']: p.get('description',''),
        FIELDS['lat']: float(lat), FIELDS['lng']: float(lng),
        FIELDS['suburb']: suburb, FIELDS['state']: state, FIELDS['postcode']: postcode,
        FIELDS['start_date']: start_date, FIELDS['end_date']: end_date,
        FIELDS['open_from']: p.get('open_from') or None,
        FIELDS['open_to']: p.get('open_to') or None,
        FIELDS['tags']: [],
        FIELDS['scare_level']: int(p.get('scare_level', 2)),
        FIELDS['photo_url']: p.get('photo_url',''),
        FIELDS['status']: 'pending'
    }

    url = f"{DIRECTUS_URL}/items/houses"
    r = requests.post(url, json=body, headers={'authorization': f"Bearer {DIRECTUS_TOKEN}"}, timeout=20)
    if r.status_code == 204:
        return jsonify({'status':'pending'})
    if not r.ok:
        return (r.text, r.status_code)
    data = r.json().get('data', {})
    return jsonify({'id': data.get('id'), 'status':'pending'})

@app.post('/api/presign')
def api_presign():
    filename = (request.json or {}).get('filename')
    content_type = (request.json or {}).get('contentType')
    if not (SPACES_ENDPOINT and SPACES_BUCKET and SPACES_KEY and SPACES_SECRET):
        return ("Spaces not configured", 500)
    if not filename or not content_type:
        return ("Bad request", 400)

    key = f"uploads/{int(time.time()*1000)}-{''.join([c if c.isalnum() or c in '._-' else '_' for c in filename])}"

    s3 = boto3.client('s3',
                      region_name='auto',
                      endpoint_url=SPACES_ENDPOINT,
                      aws_access_key_id=SPACES_KEY,
                      aws_secret_access_key=SPACES_SECRET)
    url = s3.generate_presigned_url('put_object',
                                    Params={'Bucket': SPACES_BUCKET, 'Key': key, 'ContentType': content_type},
                                    ExpiresIn=60,
                                    HttpMethod='PUT')
    public_url = f"{SPACES_ENDPOINT.replace('https://', 'https://'+SPACES_BUCKET+'.')}/{key}"
    return jsonify({'url': url, 'publicUrl': public_url})

if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    app.run(host='0.0.0.0', port=port)
