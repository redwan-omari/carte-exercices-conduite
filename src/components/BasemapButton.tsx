import { useEffect, useRef, useState } from 'react'
import { BASEMAPS, getBasemap, type BasemapId } from '../lib/basemaps'

interface Props {
  value: BasemapId
  onChange: (id: BasemapId) => void
}

/** Bouton de la carte (à côté de « Me localiser ») qui ouvre le choix de la vue. */
export default function BasemapButton({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getBasemap(value)

  // Fermer en touchant ailleurs ou avec Échap.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="basemap-ctl" ref={ref}>
      {open && (
        <div className="basemap-menu" role="menu" aria-label="Type de vue">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              role="menuitemradio"
              aria-checked={b.id === value}
              className={b.id === value ? 'active' : ''}
              onClick={() => {
                onChange(b.id)
                setOpen(false)
              }}
            >
              <span aria-hidden>{b.emoji}</span>
              {b.label}
            </button>
          ))}
        </div>
      )}
      <button
        className="fab basemap"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Type de vue : ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden>{current.emoji}</span>
        <small>Vue</small>
      </button>
    </div>
  )
}
