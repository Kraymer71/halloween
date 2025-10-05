'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: iconUrl as unknown as string, shadowUrl: iconShadow as unknown as string });
(L.Marker.prototype as any).options.icon = DefaultIcon;

const pumpkinIcon = L.icon({
  iconUrl: '/pumpkin.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 30],
  popupAnchor: [0, -28]
});

type Listing = {
  id: string; title: string; lat: number; lng: number;
  scare_level: number; photo_url?: string;
  start_date?: string; end_date?: string;
  open_from?: string; open_to?: string; suburb?: string;
};

export default function Map({
  listings,
  onBoundsChange,
  onClickSetPin,
  center,
  zoom,
  myLocation,
  radiusKm
}:{
  listings: Listing[];
  onBoundsChange?:(bbox:[number,number,number,number])=>void;
  onClickSetPin?:(latlng:{lat:number,lng:number})=>void;
  center?: {lat:number,lng:number};
  zoom?: number;
  myLocation?: {lat:number,lng:number};
  radiusKm?: number;
}) {
  const [defLat, defLng] = (process.env.NEXT_PUBLIC_DEFAULT_CENTER || '-31.9523,115.8613').split(',').map(Number);
  const defZoom = Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM || 11);

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
  const c = center ?? { lat: defLat, lng: defLng };
  const z = zoom ?? defZoom;

  return (
    <MapContainer key={`${c.lat},${c.lng},${z}`} style={{height: '60vh', width: '100%'}} center={[c.lat, c.lng]} zoom={z} scrollWheelZoom>
      <TileLayer url={tiles} />
      <BoundsReporter />

      {myLocation && (
        <>
          <CircleMarker center={[myLocation.lat, myLocation.lng]} radius={6} />
          {radiusKm ? <Circle center={[myLocation.lat, myLocation.lng]} radius={radiusKm*1000} /> : null}
        </>
      )}

      {listings.map(l => (
        <Marker key={l.id} position={[l.lat, l.lng]} icon={pumpkinIcon}>
          <Popup>
            <strong>{l.title}</strong><br/>
            {l.suburb ? `${l.suburb} · ` : ''} {l.open_from && l.open_to ? `${l.open_from}-${l.open_to}` : ''}<br/>
            {l.photo_url ? <img src={l.photo_url} alt="" style={{maxWidth:'180px',borderRadius:6,marginTop:6}}/> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
