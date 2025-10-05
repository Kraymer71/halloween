import crypto from 'crypto';

function metersToLatLngOffset(meters: number, lat: number, bearingRad: number) {
  const R = 6378137;
  const d = meters / R;
  const latRad = (lat * Math.PI) / 180;
  const newLat = Math.asin(Math.sin(latRad) + Math.cos(latRad) * d * Math.cos(bearingRad));
  const newLng = Math.atan2(Math.sin(bearingRad) * d, Math.cos(latRad) - Math.sin(latRad) * d * Math.cos(bearingRad));
  return { dLat: ((newLat - latRad) * 180) / Math.PI, dLng: (newLng * 180) / Math.PI };
}

export function jitterLatLng(id: string, lat: number, lng: number, radiusMeters = 40) {
  const h = crypto.createHash('sha256').update(id).digest();
  const angle = (h[0] / 255) * Math.PI * 2;
  const dist = (h[1] / 255) * radiusMeters * 0.9 + radiusMeters * 0.1;
  const { dLat, dLng } = metersToLatLngOffset(dist, lat, angle);
  return { lat: lat + dLat, lng: lng + dLng };
}
