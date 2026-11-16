import { useMemo, useState } from 'react'
import { getCategory } from '../lib/categories'
import { distanceMeters, formatDistance } from '../lib/geo'
import { relativeDate } from '../lib/format'
import type { GeoPos, Spot } from '../lib/types'

interface Props {
  spots: Spot[]
  userPos: GeoPos | null
  loading: boolean
  onPick: (id: string) => void
  onLocate: () => void
  onBack: () => void
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SpotList({ spots, userPos, loading, onPick, onLocate, onBack }: Props) {
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const nq = norm(q.trim())
    const list = spots
      .filter((s) => !nq || norm(`${s.title} ${s.description ?? ''} ${getCategory(s.category).label} ${s.author?.display_name ?? ''}`).includes(nq))
      .map((s) => ({ s, d: userPos ? distanceMeters(userPos, s) : null }))
    if (userPos) list.sort((a, b) => a.d! - b.d!)
    return list
  }, [spots, q, userPos])

  return (
    <div className="list-view">
      <div className="list-head">
        <button className="btn small" onClick={onBack} aria-label="Revenir à la carte">
          🗺️ Carte
        </button>
        <input type="search" placeholder="Rechercher un lieu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        {!userPos && (
          <button className="btn small" onClick={onLocate}>
            Trier par distance
          </button>
        )}
      </div>
      {loading && <p className="muted pad">Chargement…</p>}
      {!loading && !rows.length && <p className="muted pad">Aucun lieu trouvé.</p>}
      <ul>
        {rows.map(({ s, d }) => {
          const c = getCategory(s.category)
          return (
            <li key={s.id}>
              <button onClick={() => onPick(s.id)}>
                <span className="badge-emoji" style={{ background: c.color }} aria-hidden>
                  {c.emoji}
                </span>
                <span className="row-main">
                  <strong>{s.title}</strong>
                  <span className="muted small">
                    {c.label} · {s.author?.display_name ?? 'Ancien membre'} · {relativeDate(s.created_at)}
                    {s.photos.length > 0 && ` · 📷 ${s.photos.length}`}
                  </span>
                </span>
                {d != null && <span className="dist">{formatDistance(d)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
