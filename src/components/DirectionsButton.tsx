import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { directionsApps } from '../lib/geo'
import type { LatLng } from '../lib/types'

interface Props {
  to: LatLng
  /** Nom de la destination, affiché dans la fenêtre de choix. */
  name: string
  className?: string
}

/** Bouton « Itinéraire » : propose Plans (iPhone), Google Maps ou Waze. */
export default function DirectionsButton({ to, name, className = 'btn primary' }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        🧭 Itinéraire
      </button>
      {open &&
        // Portail : la fenêtre s'affiche aussi depuis une bulle de la carte.
        createPortal(
          <div className="modal" role="dialog" aria-modal="true" aria-label="Choisir une appli de guidage" onClick={() => setOpen(false)}>
            <div className="modal-body" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <div>
                  <h2>🧭 Itinéraire</h2>
                  <p className="muted small dir-dest">vers {name}</p>
                </div>
                <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer">
                  ✕
                </button>
              </div>
              <div className="dir-apps">
                {directionsApps(to).map((app) => (
                  <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                    <span aria-hidden>{app.emoji}</span>
                    {app.label}
                  </a>
                ))}
              </div>
              <button className="btn block" onClick={() => setOpen(false)}>
                Annuler
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
