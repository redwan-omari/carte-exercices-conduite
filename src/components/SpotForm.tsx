import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CATEGORIES } from '../lib/categories'
import { createSpot, updateSpot, uploadPhotos } from '../lib/api'
import { formatCoords } from '../lib/geo'
import { frError } from '../lib/format'
import type { GeoPos, Spot } from '../lib/types'
import type { DraftPos } from './MainScreen'
import PhotoPicker from './PhotoPicker'

interface Props {
  mode: 'create' | 'edit'
  spot: Spot | null
  userId: string
  draftPos: DraftPos
  followGps: boolean
  gpsPos: GeoPos | null
  gpsError: string | null
  onUseGps: () => void
  onCancel: () => void
  onSaved: (spotId: string, message: string) => void
}

export default function SpotForm({ mode, spot, userId, draftPos, followGps, gpsPos, gpsError, onUseGps, onCancel, onSaved }: Props) {
  const [title, setTitle] = useState(spot?.title ?? '')
  const [category, setCategory] = useState(spot?.category ?? '')
  const [description, setDescription] = useState(spot?.description ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!category) {
      setError("Choisissez un type d'exercice.")
      return
    }
    setBusy(true)
    setError(null)
    const input = {
      title: title.trim(),
      category,
      description: description.trim() || null,
      lat: draftPos.lat,
      lng: draftPos.lng,
      accuracy_m: draftPos.accuracy,
    }
    try {
      if (mode === 'edit' && spot) {
        await updateSpot(spot.id, input)
        onSaved(spot.id, 'Lieu modifié')
      } else {
        const id = await createSpot(input, userId)
        let msg = 'Lieu ajouté — visible par tout le groupe'
        if (files.length) {
          setProgress(`Envoi des photos 0/${files.length}…`)
          const { failed } = await uploadPhotos(id, userId, files, (d, t) => setProgress(`Envoi des photos ${d}/${t}…`))
          if (failed) msg = `Lieu ajouté, mais ${failed} photo(s) n'ont pas pu être envoyées.`
        }
        onSaved(id, msg)
      }
    } catch (err) {
      setError(frError(err))
      setBusy(false)
      setProgress(null)
    }
  }

  const acc = draftPos.accuracy
  const accClass = acc == null ? '' : acc <= 15 ? 'good' : acc <= 50 ? 'medium' : 'bad'

  return (
    <section className="sheet" aria-label={mode === 'create' ? 'Nouveau lieu' : 'Modifier le lieu'}>
      <form onSubmit={submit}>
        <div className="sheet-head">
          <h2>{mode === 'create' ? 'Nouveau lieu' : 'Modifier le lieu'}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Annuler" disabled={busy}>
            ✕
          </button>
        </div>

        <div className={`gps-box ${accClass}`}>
          {followGps ? (
            gpsPos ? (
              <span>
                📡 Position GPS <strong>±{Math.round(gpsPos.accuracy)} m</strong>
                {gpsPos.accuracy > 50 && ' — précision faible, patientez ou ajustez le repère'}
              </span>
            ) : gpsError ? (
              <span>⚠️ {gpsError}</span>
            ) : (
              <span className="pulse">📡 Recherche du signal GPS…</span>
            )
          ) : (
            <span>
              📌 Position choisie sur la carte
              <button type="button" className="link" onClick={onUseGps}>
                Utiliser mon GPS
              </button>
            </span>
          )}
          <span className="muted small">
            {formatCoords(draftPos)} · Touchez la carte ou faites glisser le repère pour ajuster.
          </span>
        </div>

        <label>
          Nom du lieu
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="ex : Parking du stade, rue des Écoles…" />
        </label>

        <fieldset className="cat-grid">
          <legend>Type d'exercice</legend>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`cat ${category === c.id ? 'active' : ''}`}
              style={{ ['--c' as string]: c.color }}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </fieldset>

        <label>
          Description / conseils <span className="muted">(facultatif)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Horaires calmes, difficulté, points d'attention…"
          />
        </label>

        {mode === 'create' && (
          <div className="field">
            <span>
              Photos <span className="muted">(facultatif)</span>
            </span>
            <PhotoPicker disabled={busy} onFiles={(f) => setFiles((prev) => [...prev, ...f].slice(0, 10))} />
            {previews.length > 0 && (
              <div className="thumbs">
                {previews.map((u, i) => (
                  <div className="thumb" key={u}>
                    <img src={u} alt="" />
                    <button type="button" className="thumb-del" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Retirer">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="alert error">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy || (followGps && !gpsPos && !gpsError)}>
            {progress ?? (busy ? 'Enregistrement…' : 'Enregistrer')}
          </button>
        </div>
      </form>
    </section>
  )
}
