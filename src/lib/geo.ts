import type { LatLng } from './types'

/**
 * Centre de formation : repère fixe toujours affiché sur la carte,
 * et centre de la carte à l'ouverture.
 * Coordonnées issues de la Base Adresse Nationale.
 */
export const TRAINING_CENTER = {
  name: 'Centre de formation',
  address: '1625 route de Sandillon, 45560 Saint-Denis-en-Val',
  lat: 47.870292,
  lng: 1.9529,
}

export const DEFAULT_CENTER: LatLng = { lat: TRAINING_CENTER.lat, lng: TRAINING_CENTER.lng }
export const DEFAULT_ZOOM = 14

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return `${Math.round(m / 1000)} km`
}

export function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Localisation refusée. Autorisez-la dans les réglages du navigateur pour ce site.'
    case err.POSITION_UNAVAILABLE:
      return 'Position GPS indisponible. Vérifiez que la localisation du téléphone est activée.'
    case err.TIMEOUT:
      return 'Le GPS met du temps à répondre… nouvelle tentative en cours.'
    default:
      return 'Erreur de géolocalisation.'
  }
}

/** Lien d'itinéraire : Apple Plans sur iPhone/iPad, Google Maps ailleurs. */
export function directionsUrl(p: LatLng): string {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  return isApple
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
}

export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
}
