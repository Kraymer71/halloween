'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

function useDefaultCenter() {
  const [lat, lng] = (process.env.NEXT_PUBLIC_DEFAULT_CENTER || '-31.9523,115.8613').split(',').map(Number);
  return { lat, lng };
}

export default function NewListingPage() {
  const center = useDefaultCenter();
  const [pin, setPin] = useState<{lat:number,lng:number}|null>(center);
  const [photo, setPhoto] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      err => { alert('Could not get your location: ' + err.message); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function uploadPhoto() {
    if (!photo) return '';
    const res = await fetch('/api/presign', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ filename: photo.name, contentType: photo.type })});
    if (!res.ok) { alert('Failed to presign'); return ''; }
    const { url, publicUrl } = await res.json();
    const putRes = await fetch(url, { method: 'PUT', headers: {'content-type': photo.type}, body: photo });
    if (!putRes.ok) { alert('Upload failed'); return ''; }
    return publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) { alert('Please drop a pin on the map'); return; }

    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    const photo_url = photo ? (await uploadPhoto()) : '';

    const payload = {
      title: data.title,
      description: data.description || '',
      lat: pin.lat, lng: pin.lng,
      open_from: data.open_from || '',
      open_to: data.open_to || '',
      scare_level: Number(data.scare_level || 2),
      photo_url
    };

    const res = await fetch('/api/listings', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) { const t = await res.text(); alert('Failed: '+t); return; }
    alert('Submitted! An admin will review your listing.');
    window.location.href = '/';
  }

  return (
    <div>
      <header>
        <h1>List your house</h1>
        <a className="btn secondary" href="/">Back to map</a>
      </header>

      <div className="container grid two">
        <div className="card">
          <form onSubmit={submit} className="grid">
            <div className="two">
              <div>
                <label>Title</label>
                <input className="input" name="title" placeholder="Spooky Manor" required/>
              </div>
              <div>
                <label>Scare level (1—5)</label>
                <input className="input" type="number" min={1} max={5} name="scare_level" defaultValue={2}/>
              </div>
            </div>

            <label>Description</label>
            <textarea className="input" name="description" placeholder="Fog machines, skeletons, teal pumpkin for allergy-friendly treats" />

            <div className="two">
              <div>
                <label>Open from (optional)</label>
                <input className="input" type="time" name="open_from"/>
              </div>
              <div>
                <label>Open to (optional)</label>
                <input className="input" type="time" name="open_to"/>
              </div>
            </div>

            <div>
              <label>Photo (optional)</label>
              <input className="input" type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
            </div>

            <div style={{display:'flex', gap:8}}>
              <button className="btn secondary" type="button" onClick={useMyLocation} disabled={locating}>
                {locating ? 'Locating…' : 'Use my location'}
              </button>
              <span style={{opacity:.7}}>Tap the map to move the pin.</span>
            </div>

            <button className="btn" type="submit">Submit for approval</button>
          </form>
        </div>

        <div className="card">
          <Map listings={pin? [{
            id: 'preview',
            title: 'Your pin',
            lat: pin.lat,
            lng: pin.lng,
            scare_level: 2,
            start_date: '',
            end_date: ''
          }] : []} onClickSetPin={(latlng)=>setPin(latlng)} />
        </div>
      </div>
    </div>
  );
}
