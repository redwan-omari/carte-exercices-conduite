import { useRef } from 'react'

/** Deux boutons : appareil photo (arrière) ou galerie. */
export default function PhotoPicker({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') || f.type === '')
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <div className="photo-picker">
      <button type="button" className="btn" disabled={disabled} onClick={() => camRef.current?.click()}>
        📷 Prendre une photo
      </button>
      <button type="button" className="btn" disabled={disabled} onClick={() => galRef.current?.click()}>
        🖼️ Galerie
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={handle} />
    </div>
  )
}
