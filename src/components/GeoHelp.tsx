import { useEffect } from 'react'

type Platform = 'ios' | 'android' | 'other'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS se présente comme un Mac : on le repère par l'écran tactile.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isInstalledApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

interface Props {
  onRetry: () => void
  onClose: () => void
}

/** Aide affichée quand le téléphone refuse la localisation. */
export default function GeoHelp({ onRetry, onClose }: Props) {
  const platform = detectPlatform()
  const installed = isInstalledApp()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Autoriser la localisation" onClick={onClose}>
      <div className="modal-body geo-help" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>📍 Localisation bloquée</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {platform === 'ios' && (
          <>
            <p>
              Sur iPhone, accepter dans Safari ne suffit pas : <b>le réglage de l'iPhone</b> doit aussi
              autoriser Safari.
            </p>
            <h3>1. Réglages de l'iPhone</h3>
            <ol>
              <li>
                Ouvrez l'app <b>Réglages</b> ⚙️
              </li>
              <li>
                <b>Confidentialité et sécurité</b> → <b>Service de localisation</b>
              </li>
              <li>
                Vérifiez que <b>Service de localisation</b> est activé (en haut)
              </li>
              <li>
                Descendez jusqu'à <b>Sites web Safari</b> et choisissez{' '}
                <b>« Lorsque l'app est active »</b> (pas « Jamais »)
              </li>
              <li>
                Activez <b>Position exacte</b> pour une meilleure précision
              </li>
            </ol>
            <h3>2. Réglage du site dans Safari</h3>
            <ol>
              <li>
                Revenez dans Safari sur ce site et touchez <b>aA</b> (ou l'icône à gauche de l'adresse)
              </li>
              <li>
                <b>Réglages du site web</b> → <b>Localisation</b> → <b>Autoriser</b>
              </li>
            </ol>
            {installed && (
              <p className="alert info">
                Vous utilisez l'appli installée sur l'écran d'accueil : elle utilise aussi le réglage
                « Sites web Safari ». Si besoin, fermez complètement l'appli puis rouvrez-la.
              </p>
            )}
          </>
        )}

        {platform === 'android' && (
          <>
            <ol>
              <li>
                Touchez l'icône <b>⚙︎ / cadenas</b> à gauche de l'adresse dans Chrome
              </li>
              <li>
                <b>Autorisations</b> → <b>Position</b> → <b>Autoriser</b>
              </li>
              <li>
                Vérifiez aussi que la <b>localisation du téléphone</b> est activée (menu rapide en haut de
                l'écran)
              </li>
              <li>
                Dans <b>Paramètres</b> → <b>Applications</b> → <b>Chrome</b> → <b>Autorisations</b> →{' '}
                <b>Position</b> : « Autoriser seulement si l'appli est en cours d'utilisation »
              </li>
            </ol>
          </>
        )}

        {platform === 'other' && (
          <ol>
            <li>Cliquez sur l'icône à gauche de l'adresse du site</li>
            <li>
              Autorisez la <b>Position</b> pour ce site, puis réessayez
            </li>
          </ol>
        )}

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>
            Plus tard
          </button>
          <button className="btn primary" onClick={onRetry}>
            Réessayer
          </button>
        </div>
        <p className="muted small">
          Sans GPS, vous pouvez quand même ajouter un lieu en déplaçant le repère sur la carte.
        </p>
      </div>
    </div>
  )
}
