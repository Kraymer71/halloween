# Halloween Map — Next.js + Directus (snake_case fields)

This starter expects your Directus `houses` collection to use **lowercase snake_case** keys:

`title, description, lat, lng, street, suburb, state, postcode, start_date, end_date, open_from, open_to, tags, scare_level, photo_url, status`

## What it includes
- Public map (Leaflet) showing **approved** houses (with privacy jitter).
- Submit page that uploads a photo to **DigitalOcean Spaces** (presigned PUT) then creates a **pending** item in Directus.
- Minimal API that talks to **Directus REST** (no custom DB).

## Env vars (DigitalOcean App Platform → Web service)
```
NODE_ENV=production
DIRECTUS_URL=https://YOUR-DIRECTUS-DOMAIN           # no trailing slash
DIRECTUS_SUBMIT_TOKEN=PASTE_YOUR_PAT_OR_TOKEN       # Submitter role token (server-only)

SPACES_ENDPOINT=https://REGION.digitaloceanspaces.com
SPACES_BUCKET=halloween-uploads
SPACES_KEY=YOUR_SPACES_KEY
SPACES_SECRET=YOUR_SPACES_SECRET

NEXT_PUBLIC_DEFAULT_CENTER=-31.9523,115.8613        # change to your city
NEXT_PUBLIC_DEFAULT_ZOOM=11
# optional tiles:
NEXT_PUBLIC_MAP_TILE_URL=
```

## Directus permissions
- **Public role** → `houses`: **Read** with row filter `status = approved`; allow the fields used on the map.
- **Submitter role** → `houses`: **Create** (fields you accept). *(Optional)* **Read** with `created_by = $CURRENT_USER` if you want to get `{id}` back using `Prefer: return=representation`.

## Deploy on DigitalOcean App Platform
1) Push this folder to a GitHub repo.
2) Create App → From Source → Node.js.
3) Build: `npm ci && npm run build`  Run: `npm run start`
4) Add env vars. Save → deploy.
5) Visit `/new` to submit a test, approve it in Directus, then check `/`.
