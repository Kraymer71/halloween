'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow });
(L.Marker.prototype as any).options.icon = DefaultIcon;

type Listing = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  scare_level: number;
  tags: string[];
  photo_url?: string;
  start_date?: string;
  end_date?: string;
  open_from?: string;
  open_to?: string;
  suburb?: string;
};

export default function Map({ listings, onBoundsChange, onClickSetPin }:{ listings: Listing[], onBoundsChange?:(bbox:[number,number,number,number])=>void, onClickSetPin?:(latlng:{lat:number,lng:number})=>void }) {
  const [lat, lng] = (process.env.NEXT_PUBLIC_DEFAULT_CENTER || '-31.9523,115.8613').split(',').map(Number);
  const zoom = Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM || 11);

  function BoundsReporter() {
    const map = useMapEvents({
      moveend: () => {
        const b = map.getBounds();
        onBoundsChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      },
      click: (e) => onClickSetPin?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    });
    useEffect(() => {
      const b = map.getBounds();
      onBoundsChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    }, []);
    return null;
  }

  const tiles = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <MapContainer style={{height: '60vh', width: '100%'}} center={[lat, lng]} zoom={zoom} scrollWheelZoom>
      <TileLayer url={tiles} />
      <BoundsReporter />
      {listings.map(l => (
        <Marker key={l.id} position={[l.lat, l.lng]}>
          <Popup>
            <strong>{l.title}</strong><br/>
            {l.suburb ? `${l.suburb} · ` : ''} {l.open_from && l.open_to ? `${l.open_from}-${l.open_to}` : ''}<br/>
            {l.photo_url ? <img src={l.photo_url} alt="" style={{maxWidth:'180px',borderRadius:6,marginTop:6}}/> : null}
            <div style={{marginTop:6}}>{l.tags?.join(' · ')}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
