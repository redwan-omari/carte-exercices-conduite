import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSpots } from '../lib/api'
import { frError } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Spot } from '../lib/types'

export type LiveStatus = 'connecting' | 'live' | 'offline'

/**
 * Charge les lieux du groupe et les maintient à jour en temps réel
 * (Supabase Realtime : tout ajout / modification / suppression par un
 * collègue déclenche un rechargement léger).
 */
export function useSpots(enabled: boolean) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<LiveStatus>('connecting')
  const [online, setOnline] = useState(() => navigator.onLine)
  const timer = useRef<number | undefined>(undefined)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const my = ++seq.current
    try {
      const data = await fetchSpots()
      if (my !== seq.current) return // une requête plus récente est partie
      setSpots(data)
      setError(null)
    } catch (e) {
      if (my === seq.current) setError(frError(e))
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(refresh, 250)
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    refresh()

    const channel = supabase
      .channel('spots-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_photos' }, scheduleRefresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive('live')
          scheduleRefresh() // rattrape ce qui a pu être manqué pendant une coupure
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive('offline')
        }
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }
    const onOnline = () => {
      setOnline(true)
      scheduleRefresh()
    }
    const onOffline = () => {
      setOnline(false)
      setLive('offline')
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      supabase.removeChannel(channel)
    }
  }, [enabled, refresh, scheduleRefresh])

  return { spots, loading, error, live, online, refresh }
}
