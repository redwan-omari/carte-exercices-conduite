import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type L from 'leaflet'
import type { Session } from '@supabase/supabase-js'
import { useSpots } from '../hooks/useSpots'
import { useGeolocation } from '../hooks/useGeolocation'
import { getCategory } from '../lib/categories'
import { DEFAULT_BASEMAP, getBasemap } from '../lib/basemaps'
import type { LatLng, Role, Spot } from '../lib/types'
import MapView from './MapView'
import Sidebar, { type DisplayPrefs } from './Sidebar'
import SpotDetails from './SpotDetails'
import SpotForm from './SpotForm'
import SpotList from './SpotList'
import AccountPanel from './AccountPanel'
import MembersPage from './MembersPage'
import GeoHelp from './GeoHelp'
import BasemapButton from './BasemapButton'
import DrawToolbar from './DrawToolbar'
import { useDrawings } from '../hooks/useDrawings'
import { fetchPendingCount } from '../lib/api'
import { Toast, useToast } from './Toast'

type Draft = { mode: 'create' } | { mode: 'edit'; spot: Spot }
export interface DraftPos extends LatLng {
  accuracy: number | null
}

interface Props {
  session: Session
  role: Role
}

// Préférences d'affichage : mémorisées sur l'appareil (simple confort, non partagé).
const PREFS_KEY = 'carte-affichage-v1'
function loadPrefs(): DisplayPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    if (p)
      return {
        hidden: new Set<string>(p.hidden ?? []),
        showCenter: p.showCenter !== false,
        showMe: p.showMe !== false,
        basemap: getBasemap(p.basemap).id,
      }
  } catch {
    /* stockage indisponible */
  }
  return { hidden: new Set(), showCenter: true, showMe: true, basemap: DEFAULT_BASEMAP }
}
const isWide = () => window.matchMedia('(min-width: 900px)').matches

export default function MainScreen({ session, role }: Props) {
  const userId = session.user.id
  const isAdmin = role === 'admin'
  const { spots, loading, error, live, online, refresh } = useSpots(true)
  const geo = useGeolocation()
  const { toast, show: showToast } = useToast()

  const mapRef = useRef<L.Map | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadPrefs)
  const [sidebarOpen, setSidebarOpen] = useState(isWide)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'account' | 'members' | null>(null)
  const [membersFromAccount, setMembersFromAccount] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftPos, setDraftPos] = useState<DraftPos | null>(null)
  const [followGps, setFollowGps] = useState(false)

  // Mode stylo : carte bloquée, dessin au doigt (dessins gardés sur l'appareil).
  const [drawing, setDrawing] = useState(false)
  const drawings = useDrawings()

  const pendingLocate = useRef(false)
  const draftCentered = useRef(false)

  const visibleSpots = useMemo(
    () => (prefs.hidden.size ? spots.filter((s) => !prefs.hidden.has(getCategory(s.category).id)) : spots),
    [spots, prefs.hidden],
  )

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ hidden: [...prefs.hidden], showCenter: prefs.showCenter, showMe: prefs.showMe, basemap: prefs.basemap }))
    } catch {
      /* stockage indisponible */
    }
  }, [prefs])

  // Admin : nombre de comptes en attente d'autorisation (pastille sur le bouton Membres).
  const refreshPending = useCallback(() => {
    if (!isAdmin) return
    fetchPendingCount().then(setPendingCount).catch(() => {})
  }, [isAdmin])
  useEffect(() => {
    refreshPending()
    const onVisible = () => document.visibilityState === 'visible' && refreshPending()
    document.addEventListener('visibilitychange', onVisible)
    const t = window.setInterval(refreshPending, 120_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(t)
    }
  }, [refreshPending])

  const closeSidebarOnMobile = () => {
    if (!isWide()) setSidebarOpen(false)
  }
  const openMembers = (fromAccount: boolean) => {
    setMembersFromAccount(fromAccount)
    setPanel('members')
  }
  const selected = useMemo(() => spots.find((s) => s.id === selectedId) ?? null, [spots, selectedId])

  // Un lieu supprimé par un collègue : on ferme sa fiche.
  useEffect(() => {
    if (selectedId && !loading && !spots.some((s) => s.id === selectedId)) setSelectedId(null)
  }, [spots, selectedId, loading])

  const flyTo = useCallback((p: LatLng, zoom = 17) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([p.lat, p.lng], Math.max(zoom, map.getZoom()), { duration: 0.6 })
  }, [])

  // La carte s'ouvre toujours sur DEFAULT_CENTER (voir src/lib/geo.ts).

  // Recentrage demandé (bouton ◎) dès que le GPS répond.
  useEffect(() => {
    if (geo.pos && pendingLocate.current) {
      pendingLocate.current = false
      flyTo(geo.pos, 16)
    }
  }, [geo.pos, flyTo])

  // Pendant l'ajout : le repère suit le GPS tant que l'utilisateur ne l'a pas déplacé.
  useEffect(() => {
    if (!draft || !followGps || !geo.pos) return
    setDraftPos({ lat: geo.pos.lat, lng: geo.pos.lng, accuracy: Math.round(geo.pos.accuracy) })
    if (!draftCentered.current) {
      draftCentered.current = true
      flyTo(geo.pos, 17)
    }
  }, [draft, followGps, geo.pos, flyTo])

  useEffect(() => {
    // Refus d'autorisation : la fenêtre d'aide GeoHelp remplace le simple message.
    if (geo.error && !geo.denied) showToast(geo.error, 'error')
  }, [geo.error, geo.denied, showToast])

  function locate() {
    geo.start()
    if (geo.pos) flyTo(geo.pos, 16)
    else pendingLocate.current = true
  }

  function startCreate() {
    setDrawing(false)
    setSelectedId(null)
    setView('map')
    setPanel(null)
    geo.start()
    draftCentered.current = false
    const c = mapRef.current?.getCenter()
    setDraftPos(geo.pos ? { lat: geo.pos.lat, lng: geo.pos.lng, accuracy: Math.round(geo.pos.accuracy) } : c ? { lat: c.lat, lng: c.lng, accuracy: null } : null)
    setFollowGps(true)
    setDraft({ mode: 'create' })
  }

  function startEdit(spot: Spot) {
    setDrawing(false)
    setDraft({ mode: 'edit', spot })
    setDraftPos({ lat: spot.lat, lng: spot.lng, accuracy: spot.accuracy_m })
    setFollowGps(false)
    flyTo(spot, 17)
  }

  function closeDraft() {
    setDraft(null)
    setDraftPos(null)
    setFollowGps(false)
  }

  const moveDraft = useCallback((p: LatLng) => {
    setFollowGps(false)
    setDraftPos({ ...p, accuracy: null })
  }, [])

  function useGpsForDraft() {
    geo.start()
    draftCentered.current = false
    setFollowGps(true)
  }

  function selectSpot(id: string, fly = false) {
    setDrawing(false)
    if (draft) return
    setSelectedId(id)
    const s = spots.find((x) => x.id === id)
    if (!s) return
    if (fly) flyTo(s, 17)
    else
      // La fiche réduit la hauteur de la carte : on garde le repère visible.
      window.setTimeout(() => {
        const map = mapRef.current
        if (map && !map.getBounds().pad(-0.15).contains([s.lat, s.lng])) map.panTo([s.lat, s.lng])
      }, 250)
  }

  const canEdit = (s: Spot) => isAdmin || s.created_by === userId

  return (
    <div className="main">
      <header className="topbar">
        <button
          className={`icon-btn menu-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Fermer le menu' : "Ouvrir le menu d'affichage"}
          aria-expanded={sidebarOpen}
        >
          ☰
        </button>
        <div className="title">
          <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="" width={28} height={28} />
          <span>Exercices conduite</span>
          <span className={`live-dot ${live}`} title={live === 'live' ? 'Synchronisé en temps réel' : live === 'offline' ? 'Temps réel interrompu, reconnexion…' : 'Connexion…'} />
        </div>
        <div className="actions">
          {isAdmin && (
            <button
              className="admin-btn"
              onClick={() => openMembers(false)}
              aria-label={pendingCount ? `Gérer les membres (${pendingCount} en attente)` : 'Gérer les membres'}
              title="Gérer les membres"
            >
              <span aria-hidden>👥</span>
              <span className="admin-btn-label">Membres</span>
              {pendingCount > 0 && <span className="admin-badge">{pendingCount}</span>}
            </button>
          )}
          <button className="icon-btn avatar" onClick={() => setPanel('account')} aria-label="Mon compte">
            {(session.user.user_metadata?.display_name || session.user.email || '?').trim().charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {!online && <div className="banner">Hors connexion — les lieux des collègues apparaîtront au retour du réseau.</div>}
      {error && !spots.length && (
        <div className="banner error">
          {error}{' '}
          <button className="link" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}

      <div className="body">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          spots={spots}
          prefs={prefs}
          onChange={setPrefs}
          view={view}
          onView={(v) => {
            setView(v)
            closeSidebarOnMobile()
          }}
        />
        <div className="content">
          <div className="map-wrap">
            <MapView
              spots={visibleSpots}
              selectedId={selectedId}
              onSelect={(id) => selectSpot(id)}
              userPos={prefs.showMe ? geo.pos : null}
              showCenter={prefs.showCenter}
              basemap={prefs.basemap}
              draftPos={draftPos}
              onDraftMove={moveDraft}
              onMapClick={draft ? moveDraft : () => setSelectedId(null)}
              onReady={(m) => (mapRef.current = m)}
              drawing={drawing}
              strokes={drawings.strokes}
              drawColor={drawings.color}
              onStroke={drawings.add}
            />

            {view === 'list' && (
              <SpotList
                spots={visibleSpots}
                userPos={geo.pos}
                loading={loading}
                onPick={(id) => {
                  setView('map')
                  selectSpot(id, true)
                }}
                onLocate={locate}
                onBack={() => setView('map')}
              />
            )}

            {view === 'map' && (
              <>
                {!draft && (
                  <button
                    className={`fab pen ${drawing ? 'on' : ''}`}
                    onClick={() => {
                      setSelectedId(null)
                      setDrawing((d) => !d)
                    }}
                    aria-label={drawing ? 'Quitter le mode dessin' : 'Dessiner sur la carte'}
                    aria-pressed={drawing}
                  >
                    ✏️
                  </button>
                )}
                <BasemapButton value={prefs.basemap} onChange={(basemap) => setPrefs({ ...prefs, basemap })} />
                <button className={`fab locate ${geo.active ? 'on' : ''}`} onClick={locate} aria-label="Me localiser">
                  ◎
                </button>
                {drawing && (
                  <DrawToolbar
                    color={drawings.color}
                    onColor={drawings.setColor}
                    canUndo={drawings.strokes.length > 0}
                    onUndo={drawings.undo}
                    onClear={drawings.clear}
                    onDone={() => setDrawing(false)}
                  />
                )}
                {!draft && !selected && !drawing && (
                  <button className="fab add" onClick={startCreate}>
                    <span aria-hidden>＋</span> Ajouter un lieu
                  </button>
                )}
                {prefs.hidden.size > 0 && spots.length > visibleSpots.length && !draft && (
                  <button className="filter-pill" onClick={() => setPrefs({ ...prefs, hidden: new Set() })}>
                    {spots.length - visibleSpots.length} lieu(x) masqué(s) · <strong>Tout afficher</strong>
                  </button>
                )}
                {!loading && !spots.length && !draft && !error && (
                  <div className="empty-hint">Aucun lieu pour l'instant. Rendez-vous sur place et appuyez sur « Ajouter un lieu ».</div>
                )}
              </>
            )}
          </div>

          {draft && draftPos && (
            <SpotForm
              key={draft.mode === 'edit' ? draft.spot.id : 'new'}
              mode={draft.mode}
              spot={draft.mode === 'edit' ? draft.spot : null}
              userId={userId}
              draftPos={draftPos}
              followGps={followGps}
              gpsPos={geo.pos}
              gpsError={geo.error}
              onUseGps={useGpsForDraft}
              onCancel={closeDraft}
              onSaved={async (id, msg) => {
                closeDraft()
                await refresh()
                setSelectedId(id)
                showToast(msg)
              }}
            />
          )}

          {!draft && selected && (
            <SpotDetails
              spot={selected}
              userId={userId}
              isAdmin={isAdmin}
              canEdit={canEdit(selected)}
              userPos={geo.pos}
              onClose={() => setSelectedId(null)}
              onEdit={() => startEdit(selected)}
              onChanged={refresh}
              onDeleted={async () => {
                setSelectedId(null)
                await refresh()
                showToast('Lieu supprimé')
              }}
              toast={showToast}
            />
          )}
        </div>
      </div>

      {panel === 'account' && (
        <AccountPanel session={session} role={role} onClose={() => setPanel(null)} onMembers={() => openMembers(true)} toast={showToast} />
      )}
      {panel === 'members' && isAdmin && (
        <MembersPage
          onClose={() => {
            setPanel(membersFromAccount ? 'account' : null)
            refreshPending()
          }}
          toast={showToast}
          myEmail={session.user.email ?? ''}
        />
      )}

      {geo.denied && (
        <GeoHelp
          onClose={geo.dismissDenied}
          onRetry={() => {
            geo.dismissDenied()
            geo.start()
          }}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
