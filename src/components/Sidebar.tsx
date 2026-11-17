import { useEffect, useMemo } from 'react'
import { CATEGORIES, getCategory } from '../lib/categories'
import type { BasemapId } from '../lib/basemaps'
import type { Spot } from '../lib/types'

export interface DisplayPrefs {
  /** Types d'exercice masqués (identifiants de catégorie). */
  hidden: Set<string>
  showCenter: boolean
  showMe: boolean
  basemap: BasemapId
}

interface Props {
  open: boolean
  onClose: () => void
  spots: Spot[]
  prefs: DisplayPrefs
  onChange: (p: DisplayPrefs) => void
  view: 'map' | 'list'
  onView: (v: 'map' | 'list') => void
}

/**
 * Panneau latéral gauche : choix de ce qui est affiché sur la carte.
 * Sur grand écran il reste ouvert à côté de la carte ; sur téléphone il
 * glisse par-dessus et se ferme en touchant la carte.
 */
export default function Sidebar({ open, onClose, spots, prefs, onChange, view, onView }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of spots) {
      const id = getCategory(s.category).id
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [spots])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggle = (id: string) => {
    const hidden = new Set(prefs.hidden)
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    onChange({ ...prefs, hidden })
  }
  const visibleCount = spots.filter((s) => !prefs.hidden.has(getCategory(s.category).id)).length

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Affichage de la carte" aria-hidden={!open}>
        <div className="sidebar-head">
          <h2>Affichage</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer le menu">
            ✕
          </button>
        </div>

        <div className="view-switch" role="tablist" aria-label="Mode d'affichage">
          <button role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'active' : ''} onClick={() => onView('map')}>
            🗺️ Carte
          </button>
          <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => onView('list')}>
            📋 Liste
          </button>
        </div>

        <section>
          <div className="sidebar-section-head">
            <h3>Lieux d'exercice</h3>
            <span className="muted small">
              {visibleCount}/{spots.length}
            </span>
          </div>
          <div className="sidebar-all">
            <button className="link" onClick={() => onChange({ ...prefs, hidden: new Set() })} disabled={prefs.hidden.size === 0}>
              Tout afficher
            </button>
            <button className="link" onClick={() => onChange({ ...prefs, hidden: new Set(CATEGORIES.map((c) => c.id)) })}>
              Tout masquer
            </button>
          </div>
          <ul className="check-list">
            {CATEGORIES.map((c) => {
              const n = counts.get(c.id) ?? 0
              return (
                <li key={c.id}>
                  <label className={n === 0 ? 'empty' : ''}>
                    <input type="checkbox" checked={!prefs.hidden.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="dot-emoji" style={{ background: c.color }} aria-hidden>
                      {c.emoji}
                    </span>
                    <span className="check-label">{c.label}</span>
                    <span className="check-count">{n}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <div className="sidebar-section-head">
            <h3>Repères</h3>
          </div>
          <ul className="check-list">
            <li>
              <label>
                <input type="checkbox" checked={prefs.showCenter} onChange={() => onChange({ ...prefs, showCenter: !prefs.showCenter })} />
                <span className="dot-emoji" style={{ background: '#0f172a' }} aria-hidden>
                  🏫
                </span>
                <span className="check-label">Centre de formation</span>
              </label>
            </li>
            <li>
              <label>
                <input type="checkbox" checked={prefs.showMe} onChange={() => onChange({ ...prefs, showMe: !prefs.showMe })} />
                <span className="dot-emoji" style={{ background: '#2563eb' }} aria-hidden>
                  ●
                </span>
                <span className="check-label">Ma position GPS</span>
              </label>
            </li>
          </ul>
        </section>

        <p className="muted small sidebar-note">Ces choix ne concernent que votre appareil.</p>
      </aside>
    </>
  )
}
