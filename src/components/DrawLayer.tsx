import { useEffect, useRef, useState } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import type L from 'leaflet'
import type { Stroke } from '../hooks/useDrawings'

interface Props {
  /** Mode stylo : la carte est bloquée et le doigt dessine. */
  active: boolean
  strokes: Stroke[]
  color: string
  onStroke: (points: [number, number][]) => void
}

const line = (color: string): L.PathOptions => ({ color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' })
const halo: L.PathOptions = { color: '#0f172a', weight: 8, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }

/**
 * Dessins à main levée sur la carte. Les traits sont enregistrés en
 * coordonnées GPS : ils restent au bon endroit quand on déplace ou zoome.
 */
export default function DrawLayer({ active, strokes, color, onStroke }: Props) {
  const map = useMap()
  const [current, setCurrent] = useState<[number, number][] | null>(null)
  const onStrokeRef = useRef(onStroke)
  onStrokeRef.current = onStroke

  useEffect(() => {
    if (!active) return
    const box = map.getContainer()

    // Carte bloquée : plus de déplacement ni de zoom au doigt.
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard]
    const wasOn = handlers.map((h) => h?.enabled() ?? false)
    handlers.forEach((h) => h?.disable())
    box.classList.add('drawing')

    let pts: [number, number][] | null = null
    let last: L.Point | null = null
    let pointer: number | null = null

    const down = (e: PointerEvent) => {
      if (pointer !== null || (e.target as HTMLElement).closest('.leaflet-control')) return
      pointer = e.pointerId
      box.setPointerCapture?.(e.pointerId)
      last = map.mouseEventToContainerPoint(e)
      const ll = map.containerPointToLatLng(last)
      pts = [[ll.lat, ll.lng]]
      setCurrent(pts.slice())
      e.preventDefault()
      e.stopPropagation()
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer || !pts) return
      e.preventDefault()
      const p = map.mouseEventToContainerPoint(e)
      if (last && p.distanceTo(last) < 3) return
      last = p
      const ll = map.containerPointToLatLng(p)
      pts.push([ll.lat, ll.lng])
      setCurrent(pts.slice())
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return
      pointer = null
      // Un simple toucher laisse un point.
      if (pts) onStrokeRef.current(pts.length === 1 ? [pts[0], pts[0]] : pts)
      pts = null
      setCurrent(null)
    }
    // Pas de « clic sur la carte » (ni sélection, ni déplacement du repère) pendant le dessin.
    const swallowClick = (e: MouseEvent) => e.stopPropagation()

    box.addEventListener('pointerdown', down, true)
    box.addEventListener('pointermove', move, true)
    box.addEventListener('pointerup', up, true)
    box.addEventListener('pointercancel', up, true)
    box.addEventListener('click', swallowClick, true)
    return () => {
      box.removeEventListener('pointerdown', down, true)
      box.removeEventListener('pointermove', move, true)
      box.removeEventListener('pointerup', up, true)
      box.removeEventListener('pointercancel', up, true)
      box.removeEventListener('click', swallowClick, true)
      box.classList.remove('drawing')
      handlers.forEach((h, i) => wasOn[i] && h?.enable())
      setCurrent(null)
    }
  }, [active, map])

  return (
    <>
      {strokes.map((s, i) => (
        <Polyline key={`h${i}`} positions={s.points} pathOptions={halo} interactive={false} />
      ))}
      {strokes.map((s, i) => (
        <Polyline key={`s${i}`} positions={s.points} pathOptions={line(s.color)} interactive={false} />
      ))}
      {current && (
        <>
          <Polyline positions={current} pathOptions={halo} interactive={false} />
          <Polyline positions={current} pathOptions={line(color)} interactive={false} />
        </>
      )}
    </>
  )
}
