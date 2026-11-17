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
      return 'Localisation bloquée par le téléphone.'
    case err.POSITION_UNAVAILABLE:
      return 'Position GPS indisponible. Vérifiez que la localisation du téléphone est activée.'
    case err.TIMEOUT:
      return 'Le GPS met du temps à répondre… nouvelle tentative en cours.'
    default:
      return 'Erreur de géolocalisation.'
  }
}

export interface DirectionsApp {
  id: 'apple' | 'google' | 'waze'
  label: string
  emoji: string
  url: string
}

/** iPhone / iPad (iPadOS se présente comme un Mac tactile). */
export function isAppleDevice(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document)
}

/**
 * Applis de guidage proposées pour aller à un point (liens gratuits, sans clé :
 * ils ouvrent l'appli si elle est installée, sinon le site web).
 * Plans n'est proposé que sur iPhone / iPad.
 */
export function directionsApps(p: LatLng): DirectionsApp[] {
  const apps: DirectionsApp[] = [
    {
      id: 'google',
      label: 'Google Maps',
      emoji: '📍',
      url: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`,
    },
    { id: 'waze', label: 'Waze', emoji: '🚙', url: `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` },
  ]
  if (isAppleDevice()) {
    apps.unshift({ id: 'apple', label: 'Plans (Apple)', emoji: '🗺️', url: `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d` })
  }
  return apps
}

export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
}
