import { useCallback, useEffect, useRef, useState } from 'react'
import { geoErrorMessage } from '../lib/geo'
import type { GeoPos } from '../lib/types'

/**
 * Suivi GPS haute précision. Démarre uniquement sur action de l'utilisateur
 * (obligatoire sur iPhone pour afficher la demande d'autorisation).
 */
export function useGeolocation() {
  const [pos, setPos] = useState<GeoPos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [denied, setDenied] = useState(false)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    setActive(false)
  }, [])

  const start = useCallback(() => {
    if (watchId.current != null) return
    if (!('geolocation' in navigator)) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setActive(true)
    setError(null)
    setDenied(false)
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ts: p.timestamp })
        setError(null)
      },
      (err) => {
        setError(geoErrorMessage(err))
        if (err.code === err.PERMISSION_DENIED) {
          setDenied(true)
          stop()
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    )
  }, [stop])

  useEffect(() => stop, [stop])

  return { pos, error, active, denied, start, clearError: () => setError(null), dismissDenied: () => setDenied(false) }
}
