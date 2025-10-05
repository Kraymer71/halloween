'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useState } from 'react';

const Map = dynamic(() => import('./../components/Map'), { ssr: false });

type Listing = {
  id: string;
  title: string;
  lat: number;  lng: number;
  scare_level: number;
  photo_url?: string;
  start_date: string; end_date: string;
  open_from?: string; open_to?: string;
  suburb?: string;
  distance_km?: number;
};

const todayISO = () => new Date().toISOString().slice(0,10);

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [date, setDate] = useState<string>(todayISO());
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  const [me, setMe] = useState<{lat:number,lng:number}|null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [locating, setLocating] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('date', date);
    if (me) {
      params.set('near', `${me.lat},${me.lng}`);
      params.set('radius_km', String(radiusKm));
    } else if (bbox) {
      params.set('bbox', bbox.join(','));
    }
    return `/api/listings?${params.toString()}`;
  }, [date, bbox, me, radiusKm]);

  useEffect(() => { fetch(query).then(r => r.json()).then(setListings).catch(console.error); }, [query]);

  function useMyLocation() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      err => { alert('Could not get your location: ' + err.message); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearLocation() { setMe(null); }

  return (
    <div>
      <header>
        <h1>Halloween House Map</h1>
        <a className="btn" href="/new">List your house</a>
      </header>

      <div className="container grid two">
        <div className="card">
          <label>Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />

          <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn" onClick={useMyLocation} disabled={locating}>{locating ? 'Locating…' : 'Use my location'}</button>
            {me && <>
              <select className="input" style={{maxWidth:140}} value={radiusKm} onChange={e=>setRadiusKm(Number(e.target.value))}>
                {[3,5,10,15,20].map(km => <option key={km} value={km}>{km} km</option>)}
              </select>
              <button className="btn secondary" onClick={clearLocation}>Clear</button>
            </>}
          </div>
          <small style={{opacity:.7}}>Shows houses within this radius around you.</small>
        </div>

        <div className="card">
          <p>Tap houses to see details. Drag/zoom the map to refresh results in view.</p>
          <Map
            listings={listings}
            onBoundsChange={(b)=>setBbox(b)}
            center={me ?? undefined}
            zoom={me ? 12 : undefined}
            myLocation={me ?? undefined}
            radiusKm={me ? radiusKm : undefined}
          />
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h3>Houses on this date {me ? '(near you)' : ''}</h3>
          <div className="list">
            {listings.map(l => (
              <div key={l.id} className="badge">
                {l.title}
                {l.suburb ? ` • ${l.suburb}`: ''}
                {typeof l.distance_km === 'number' ? ` • ${l.distance_km.toFixed(1)} km` : ''}
                {l.open_from && l.open_to ? ` • ${l.open_from}-${l.open_to}`: ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer>© {new Date().getFullYear()} Halloween House Map</footer>
    </div>
  );
}
