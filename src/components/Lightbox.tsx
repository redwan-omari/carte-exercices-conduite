import { useEffect } from 'react'

interface Props {
  urls: string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

export default function Lightbox({ urls, index, onIndex, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % urls.length)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, urls.length, onIndex, onClose])

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <img src={urls[index]} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="lb-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      {urls.length > 1 && (
        <>
          <button className="lb-nav prev" onClick={(e) => (e.stopPropagation(), onIndex((index - 1 + urls.length) % urls.length))} aria-label="Précédente">
            ‹
          </button>
          <button className="lb-nav next" onClick={(e) => (e.stopPropagation(), onIndex((index + 1) % urls.length))} aria-label="Suivante">
            ›
          </button>
          <div className="lb-count">
            {index + 1} / {urls.length}
          </div>
        </>
      )}
    </div>
  )
}
