import { useCallback, useEffect, useState } from 'react'

/** Un trait dessiné à la main : couleur + points [lat, lng] (collé à la carte). */
export interface Stroke {
  color: string
  points: [number, number][]
}

export const DRAW_COLORS = [
  { color: '#ef4444', label: 'Rouge' },
  { color: '#2563eb', label: 'Bleu' },
  { color: '#facc15', label: 'Jaune' },
  { color: '#ffffff', label: 'Blanc' },
]

// Dessins mémorisés sur l'appareil seulement (non partagés).
const KEY = 'carte-dessins-v1'

function load(): Stroke[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((s) => s && typeof s.color === 'string' && Array.isArray(s.points)) : []
  } catch {
    return []
  }
}

export function useDrawings() {
  const [strokes, setStrokes] = useState<Stroke[]>(load)
  const [color, setColor] = useState(DRAW_COLORS[0].color)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(strokes))
    } catch {
      /* stockage indisponible */
    }
  }, [strokes])

  const add = useCallback((points: [number, number][]) => setStrokes((s) => [...s, { color, points }]), [color])
  const undo = useCallback(() => setStrokes((s) => s.slice(0, -1)), [])
  const clear = useCallback(() => setStrokes([]), [])

  return { strokes, color, setColor, add, undo, clear }
}
