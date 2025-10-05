# Halloween House Map — Flask + Directus
**Version:** 2025-10-05

A lightweight Python/Flask app that replaces the Next.js frontend:
- Leaflet map with pumpkin pins
- "Use my location" + radius selection (default 5 km) and circle overlay
- Simplified `/new` form (title, description, optional hours, scare level, optional photo, drop-a-pin)
- Server auto-fills Halloween window (Oct 20 — Nov 1 by default)
- Directus used for storage/workflow (houses collection)
- DigitalOcean Spaces uploads via pre-signed PUT URL (boto3)

## Run locally
```bash
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
export FLASK_ENV=development
export PORT=5000
python app.py
```

Open http://localhost:5000

## Environment variables
```
DIRECTUS_URL=https://<your-directus-domain>
DIRECTUS_SUBMIT_TOKEN=<submitter-role-token>

DEFAULT_CENTER=-31.9523,115.8613
DEFAULT_ZOOM=11
DEFAULT_RADIUS_KM=5

HALLOWEEN_START=2025-10-20
HALLOWEEN_END=2025-11-01
REVERSE_GEOCODE=false

SPACES_ENDPOINT=https://<region>.digitaloceanspaces.com
SPACES_BUCKET=halloween-uploads
SPACES_KEY=<key>
SPACES_SECRET=<secret>
```

## Deploy on DigitalOcean App Platform
- Create a new service from this repo.
- Build command: (none needed)
- Run command: `gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT app:app`
- Add all env vars above.

## Directus fields (snake_case)
Recommended `houses` schema:
`title, description, lat, lng, street, suburb, state, postcode, start_date, end_date, open_from, open_to, tags, scare_level, photo_url, status`

- Status values: `pending`, `approved`, `rejected`
- The map reads **approved** items that overlap the selected date.
