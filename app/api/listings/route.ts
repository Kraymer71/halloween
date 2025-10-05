import { NextRequest, NextResponse } from 'next/server';
import { jitterLatLng } from '@/lib/jitter';
import { F } from '@/lib/fields';

const DIRECTUS = process.env.DIRECTUS_URL!;
const TOKEN = process.env.DIRECTUS_SUBMIT_TOKEN!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10);
  const bbox = searchParams.get('bbox')?.split(',').map(Number);
  const tags = (searchParams.get('tags') || '').split(',').filter(Boolean);

  const qs = new URLSearchParams();
  qs.set(`filter[${F.status}][_eq]`, 'approved');
  qs.set(`filter[${F.start_date}][_lte]`, date);
  qs.set(`filter[${F.end_date}][_gte]`, date);
  if (bbox && bbox.length === 4) {
    const [w,s,e,n] = bbox;
    qs.set(`filter[${F.lat}][_between]`, `[${s},${n}]`);
    qs.set(`filter[${F.lng}][_between]`, `[${w},${e}]`);
  }
  for (const t of tags) qs.append(`filter[${F.tags}][_contains]`, t);

  for (const k of [F.id,F.title,F.lat,F.lng,F.scare_level,F.tags,F.photo_url,F.start_date,F.end_date,F.open_from,F.open_to,F.suburb]) {
    qs.append('fields[]', k);
  }
  qs.append('sort[]', '-created_at');
  qs.set('limit','500');

  const res = await fetch(`${DIRECTUS}/items/houses?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
  const { data } = await res.json();

  const out = data.map((r:any) => {
    const j = jitterLatLng(r[F.id], r[F.lat], r[F.lng], 40);
    return {
      id: r[F.id],
      title: r[F.title],
      lat: j.lat,
      lng: j.lng,
      scare_level: r[F.scare_level],
      tags: r[F.tags],
      photo_url: r[F.photo_url],
      start_date: r[F.start_date],
      end_date: r[F.end_date],
      open_from: r[F.open_from],
      open_to: r[F.open_to],
      suburb: r[F.suburb],
    };
  });

  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  try {
    const p = await req.json();
    for (const k of ['title','lat','lng','start_date','end_date'] as const) {
      if (!p[k]) return new NextResponse(`Missing ${k}`, { status: 400 });
    }

    const body = {
      [F.title]: p.title,
      [F.description]: p.description || '',
      [F.lat]: p.lat,
      [F.lng]: p.lng,
      [F.street]: p.street || '',
      [F.suburb]: p.suburb || '',
      [F.state]: p.state || '',
      [F.postcode]: p.postcode || '',
      [F.start_date]: p.start_date,
      [F.end_date]: p.end_date,
      [F.open_from]: p.open_from || null,
      [F.open_to]: p.open_to || null,
      [F.tags]: p.tags || [],
      [F.scare_level]: p.scare_level ?? 2,
      [F.photo_url]: p.photo_url || '',
      [F.status]: 'pending',
    };

    const res = await fetch(`${DIRECTUS}/items/houses`, {
      method: 'POST',
      headers: { 'content-type':'application/json', authorization:`Bearer ${TOKEN}` },
      body: JSON.stringify(body)
    });

    if (res.status === 204) {
      return NextResponse.json({ status: 'pending' });
    }
    if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
    const { data } = await res.json();
    return NextResponse.json({ id: data?.id, status: 'pending' });
  } catch (e:any) {
    return new NextResponse(e?.message || 'Error', { status: 500 });
  }
}
