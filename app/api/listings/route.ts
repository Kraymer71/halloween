import { NextRequest, NextResponse } from 'next/server';
import { jitterLatLng } from '@/lib/jitter';
import { F } from '@/lib/fields';

const DIRECTUS = process.env.DIRECTUS_URL!;
const TOKEN = process.env.DIRECTUS_SUBMIT_TOKEN!;
const DEFAULT_RADIUS_KM = Number(process.env.DEFAULT_RADIUS_KM || 5);
const HALLOWEEN_START = process.env.HALLOWEEN_START;
const HALLOWEEN_END   = process.env.HALLOWEEN_END;
const REVERSE_GEOCODE = process.env.REVERSE_GEOCODE === 'true';

function degBounds(lat: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: -180, maxLng: 180, dLng };
}
function haversineKm(a:{lat:number,lng:number}, b:{lat:number,lng:number}) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const la1 = a.lat * Math.PI/180, la2 = b.lat * Math.PI/180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
async function revGeo(lat:number, lng:number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'halloween-map/1.0 (admin contact)' }});
  if (!res.ok) return null;
  const j:any = await res.json();
  const a = j?.address || {};
  return {
    suburb: a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || '',
    state: a.state || '',
    postcode: a.postcode || ''
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10);
  const nearParam = searchParams.get('near');
  const radiusKm = Number(searchParams.get('radius_km') || DEFAULT_RADIUS_KM);

  const qs = new URLSearchParams();
  qs.set(`filter[${F.status}][_eq]`, 'approved');
  qs.set(`filter[${F.start_date}][_lte]`, date);
  qs.set(`filter[${F.end_date}][_gte]`, date);

  if (nearParam) {
    const [latStr, lngStr] = nearParam.split(',');
    const lat = Number(latStr), lng = Number(lngStr);
    const { minLat, maxLat, dLng } = degBounds(lat, radiusKm);
    const minLng = lng - dLng, maxLng = lng + dLng;
    qs.set(`filter[${F.lat}][_between]`, `[${minLat},${maxLat}]`);
    qs.set(`filter[${F.lng}][_between]`, `[${minLng},${maxLng}]`);
  } else {
    const bbox = searchParams.get('bbox')?.split(',').map(Number);
    if (bbox && bbox.length === 4) {
      const [w,s,e,n] = bbox;
      qs.set(`filter[${F.lat}][_between]`, `[${s},${n}]`);
      qs.set(`filter[${F.lng}][_between]`, `[${w},${e}]`);
    }
  }

  for (const k of [F.id,F.title,F.lat,F.lng,F.scare_level,F.photo_url,F.start_date,F.end_date,F.open_from,F.open_to,F.suburb]) {
    qs.append('fields[]', k);
  }
  qs.append('sort[]', '-created_at');
  qs.set('limit','500');

  const res = await fetch(`${DIRECTUS}/items/houses?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
  const { data } = await res.json();

  let out = data.map((r:any) => {
    const j = jitterLatLng(r[F.id], r[F.lat], r[F.lng], 40);
    return {
      id: r[F.id],
      title: r[F.title],
      lat: j.lat, lng: j.lng,
      rawLat: r[F.lat], rawLng: r[F.lng],
      scare_level: r[F.scare_level],
      photo_url: r[F.photo_url],
      start_date: r[F.start_date],
      end_date: r[F.end_date],
      open_from: r[F.open_from],
      open_to: r[F.open_to],
      suburb: r[F.suburb],
    };
  });

  const near = nearParam ? { lat: Number(nearParam.split(',')[0]), lng: Number(nearParam.split(',')[1]) } : null;
  if (near) {
    out = out
      .map(o => ({ ...o, distance_km: haversineKm(near, { lat: o.rawLat, lng: o.rawLng }) }))
      .filter(o => o.distance_km <= radiusKm)
      .sort((a,b) => a.distance_km - b.distance_km);
  }

  const final = out.map(({rawLat,rawLng, ...rest}) => rest);
  return NextResponse.json(final);
}

export async function POST(req: NextRequest) {
  try {
    const p = await req.json();
    if (!p.title || !p.lat || !p.lng) return new NextResponse('Missing title/lat/lng', { status: 400 });

    const year = new Date().getFullYear();
    const start_date = p.start_date || HALLOWEEN_START || `${year}-10-20`;
    const end_date   = p.end_date   || HALLOWEEN_END   || `${year}-11-01`;

    let suburb = p.suburb || '', state = p.state || '', postcode = p.postcode || '';
    if (REVERSE_GEOCODE && (!suburb || !state || !postcode)) {
      const g = await revGeo(p.lat, p.lng).catch(()=>null);
      if (g) { suburb = g.suburb || suburb; state = g.state || state; postcode = g.postcode || postcode; }
    }

    const body = {
      [F.title]: p.title,
      [F.description]: p.description || '',
      [F.lat]: p.lat, [F.lng]: p.lng,
      [F.suburb]: suburb, [F.state]: state, [F.postcode]: postcode,
      [F.start_date]: start_date, [F.end_date]: end_date,
      [F.open_from]: p.open_from || null, [F.open_to]: p.open_to || null,
      [F.tags]: [], [F.scare_level]: p.scare_level ?? 2,
      [F.photo_url]: p.photo_url || '',
      [F.status]: 'pending',
    };

    const res = await fetch(`${DIRECTUS}/items/houses`, {
      method: 'POST',
      headers: { 'content-type':'application/json', authorization:`Bearer ${TOKEN}` },
      body: JSON.stringify(body)
    });

    if (res.status === 204) return NextResponse.json({ status: 'pending' });
    if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
    const { data } = await res.json();
    return NextResponse.json({ id: data?.id, status: 'pending' });
  } catch (e:any) {
    return new NextResponse(e?.message || 'Error', { status: 500 });
  }
}
