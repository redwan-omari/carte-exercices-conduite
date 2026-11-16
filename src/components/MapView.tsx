import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { getCategory } from '../lib/categories'
import { DEFAULT_CENTER, DEFAULT_ZOOM, TRAINING_CENTER, directionsUrl } from '../lib/geo'
import type { GeoPos, LatLng, Spot } from '../lib/types'

const iconCache = new Map<string, L.DivIcon>()

function spotIcon(category: string, selected: boolean): L.DivIcon {
  const key = `${category}|${selected}`
  let icon = iconCache.get(key)
  if (!icon) {
    const c = getCategory(category)
    icon = L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin${selected ? ' sel' : ''}" style="--c:${c.color}"><span>${c.emoji}</span></div>`,
      iconSize: [38, 46],
      iconAnchor: [19, 44],
    })
    iconCache.set(key, icon)
  }
  return icon
}

const draftIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<div class="pin draft"><span>＋</span></div><div class="pin-label">Nouveau lieu</div>',
  iconSize: [38, 46],
  iconAnchor: [19, 44],
})

/** Repère fixe du centre de formation (toujours affiché, non modifiable). */
const centerIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<div class="pin home"><span>🏫</span></div><div class="pin-label home">Centre de formation</div>',
  iconSize: [44, 52],
  iconAnchor: [22, 50],
  popupAnchor: [0, -46],
})

/** Recalcule la taille de la carte quand un panneau s'ouvre / se ferme. */
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

interface Props {
  spots: Spot[]
  selectedId: string | null
  onSelect: (id: string) => void
  userPos: GeoPos | null
  showCenter: boolean
  draftPos: LatLng | null
  onDraftMove: (p: LatLng) => void
  onMapClick?: (p: LatLng) => void
  onReady: (map: L.Map) => void
}

export default function MapView({ spots, selectedId, onSelect, userPos, showCenter, draftPos, onDraftMove, onMapClick, onReady }: Props) {
  const draftHandlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const ll = (e.target as L.Marker).getLatLng()
        onDraftMove({ lat: ll.lat, lng: ll.lng })
      },
    }),
    [onDraftMove],
  )

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="map"
      ref={(m) => {
        if (m) onReady(m)
      }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <AutoResize />
      <ClickHandler onClick={onMapClick} />

      {showCenter && (
      <Marker position={[TRAINING_CENTER.lat, TRAINING_CENTER.lng]} icon={centerIcon} zIndexOffset={-100} title={TRAINING_CENTER.name}>
        <Popup>
          <div className="center-popup">
            <strong>{TRAINING_CENTER.name}</strong>
            <span>{TRAINING_CENTER.address}</span>
            <a href={directionsUrl(TRAINING_CENTER)} target="_blank" rel="noopener noreferrer">
              🧭 Itinéraire
            </a>
          </div>
        </Popup>
      </Marker>
      )}

      {spots.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={spotIcon(s.category, s.id === selectedId)}
          zIndexOffset={s.id === selectedId ? 500 : 0}
          eventHandlers={{ click: () => onSelect(s.id) }}
          title={s.title}
        />
      ))}

      {userPos && (
        <>
          {userPos.accuracy > 8 && (
            <Circle
              center={[userPos.lat, userPos.lng]}
              radius={userPos.accuracy}
              pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }}
              interactive={false}
            />
          )}
          <CircleMarker
            center={[userPos.lat, userPos.lng]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}

      {draftPos && (
        <Marker position={[draftPos.lat, draftPos.lng]} icon={draftIcon} draggable zIndexOffset={1000} eventHandlers={draftHandlers} />
      )}
    </MapContainer>
  )
}
