import { useState } from 'react'
import { getCategory } from '../lib/categories'
import { deletePhoto, deleteSpot, uploadPhotos } from '../lib/api'
import { directionsUrl, distanceMeters, formatCoords, formatDistance } from '../lib/geo'
import { frError, relativeDate } from '../lib/format'
import { usePhotoUrls } from '../hooks/usePhotoUrls'
import type { GeoPos, Photo, Spot } from '../lib/types'
import PhotoPicker from './PhotoPicker'
import Lightbox from './Lightbox'
import type { ShowToast } from './Toast'

interface Props {
  spot: Spot
  userId: string
  isAdmin: boolean
  canEdit: boolean
  userPos: GeoPos | null
  onClose: () => void
  onEdit: () => void
  onChanged: () => void
  onDeleted: () => void
  toast: ShowToast
}

export default function SpotDetails({ spot, userId, isAdmin, canEdit, userPos, onClose, onEdit, onChanged, onDeleted, toast }: Props) {
  const c = getCategory(spot.category)
  const urls = usePhotoUrls(spot.photos.map((p) => p.path))
  const [uploading, setUploading] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const loadedPhotos = spot.photos.filter((p) => urls[p.path])
  const canDeletePhoto = (p: Photo) => isAdmin || p.created_by === userId || spot.created_by === userId

  async function addPhotos(files: File[]) {
    setUploading(`Envoi 0/${files.length}…`)
    try {
      const { failed } = await uploadPhotos(spot.id, userId, files, (d, t) => setUploading(`Envoi ${d}/${t}…`))
      toast(failed ? `${failed} photo(s) n'ont pas pu être envoyées.` : 'Photo(s) ajoutée(s)', failed ? 'error' : 'info')
      onChanged()
    } finally {
      setUploading(null)
    }
  }

  async function removePhoto(p: Photo) {
    if (!confirm('Supprimer cette photo ?')) return
    try {
      await deletePhoto(p)
      onChanged()
    } catch (e) {
      toast(frError(e), 'error')
    }
  }

  async function remove() {
    if (!confirm(`Supprimer « ${spot.title} » pour tout le groupe ?`)) return
    setBusy(true)
    try {
      await deleteSpot(spot)
      onDeleted()
    } catch (e) {
      toast(frError(e), 'error')
      setBusy(false)
    }
  }

  async function share() {
    const text = `${spot.title} (${c.label}) — ${formatCoords(spot)}`
    const url = `https://www.openstreetmap.org/?mlat=${spot.lat}&mlon=${spot.lng}#map=18/${spot.lat}/${spot.lng}`
    try {
      if (navigator.share) await navigator.share({ title: spot.title, text, url })
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        toast('Coordonnées copiées')
      }
    } catch {
      /* partage annulé */
    }
  }

  return (
    <section className="sheet" aria-label={spot.title}>
      <div className="sheet-head">
        <div className="spot-title">
          <span className="badge-emoji" style={{ background: c.color }} aria-hidden>
            {c.emoji}
          </span>
          <div>
            <h2>{spot.title}</h2>
            <span className="muted small">
              {c.label}
              {userPos && ` · à ${formatDistance(distanceMeters(userPos, spot))}`}
            </span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      {spot.description && <p className="desc">{spot.description}</p>}

      <p className="muted small">
        Ajouté par <strong>{spot.author?.display_name ?? 'un ancien membre'}</strong> {relativeDate(spot.created_at)}
        {spot.updated_at !== spot.created_at && ` · modifié ${relativeDate(spot.updated_at)}`}
        {spot.accuracy_m != null && ` · GPS ±${Math.round(spot.accuracy_m)} m`}
      </p>

      <div className="sheet-actions wrap">
        <a className="btn primary" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
          🧭 Itinéraire
        </a>
        <button className="btn" onClick={share}>
          📤 Partager
        </button>
        {canEdit && (
          <>
            <button className="btn" onClick={onEdit} disabled={busy}>
              ✏️ Modifier
            </button>
            <button className="btn danger" onClick={remove} disabled={busy}>
              🗑️ Supprimer
            </button>
          </>
        )}
      </div>

      <h3>Photos {spot.photos.length > 0 && <span className="muted">({spot.photos.length})</span>}</h3>
      {spot.photos.length > 0 && (
        <div className="thumbs">
          {spot.photos.map((p) => (
            <div className="thumb" key={p.id}>
              {urls[p.path] ? (
                <img
                  src={urls[p.path]}
                  alt=""
                  loading="lazy"
                  onClick={() => setLightbox(loadedPhotos.findIndex((x) => x.id === p.id))}
                />
              ) : (
                <div className="thumb-loading" />
              )}
              {canDeletePhoto(p) && (
                <button className="thumb-del" onClick={() => removePhoto(p)} aria-label="Supprimer la photo">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {uploading ? <p className="muted pulse">{uploading}</p> : <PhotoPicker onFiles={addPhotos} />}

      {lightbox != null && lightbox >= 0 && (
        <Lightbox urls={loadedPhotos.map((p) => urls[p.path])} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </section>
  )
}
