'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useState } from 'react';

const Map = dynamic(() => import('./../components/Map'), { ssr: false });

type Listing = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  scare_level: number;
  tags: string[];
  photo_url?: string;
  start_date: string;
  end_date: string;
  open_from?: string;
  open_to?: string;
  suburb?: string;
};

const todayISO = () => new Date().toISOString().slice(0,10);

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [date, setDate] = useState<string>(todayISO());
  const [tags, setTags] = useState<string[]>([]);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('date', date);
    if (tags.length) params.set('tags', tags.join(','));
    if (bbox) params.set('bbox', bbox.join(','));
    return `/api/listings?${params.toString()}`;
  }, [date, tags, bbox]);

  useEffect(() => {
    fetch(query).then(r => r.json()).then(setListings).catch(console.error);
  }, [query]);

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

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

          <div style={{marginTop:12}}>
            <div>Filters</div>
            <div className="list">
              {['decorated','trick-or-treat','haunted-yard','allergy-friendly','wheelchair'].map(t => (
                <button key={t} className="badge" onClick={() => toggleTag(t)}>
                  {tags.includes(t) ? '✓ ' : ''}{t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <p>Tap houses to see details. Drag/zoom the map to refresh results in view.</p>
          <Map listings={listings} onBoundsChange={(b)=>setBbox(b)} />
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h3>Houses on this date</h3>
          <div className="list">
            {listings.map(l => (
              <div key={l.id} className="badge">
                {l.title} {l.suburb ? `• ${l.suburb}`: ''} {l.open_from && l.open_to ? `• ${l.open_from}-${l.open_to}`: ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer>© {new Date().getFullYear()} Halloween House Map</footer>
    </div>
  );
}
