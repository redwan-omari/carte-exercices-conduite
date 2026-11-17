/**
 * Fonds de carte disponibles, gratuits et sans clé (Géoplateforme de l'IGN,
 * data.geopf.fr). Un bouton sur la carte passe de l'un à l'autre.
 */
export type BasemapId = 'satellite' | 'plan-ign'

export interface Basemap {
  id: BasemapId
  label: string
  emoji: string
  url: string
  attribution: string
  /** Dernier niveau de zoom fourni par le serveur (au-delà : agrandissement). */
  maxNativeZoom: number
}

const IGN_WMTS =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM' +
  '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
const IGN_ATTRIBUTION = '&copy; <a href="https://www.ign.fr/">IGN</a> – Géoplateforme'

export const BASEMAPS: Basemap[] = [
  {
    id: 'satellite',
    label: 'Satellite',
    emoji: '🛰️',
    url: `${IGN_WMTS}&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&FORMAT=image/jpeg`,
    attribution: IGN_ATTRIBUTION,
    maxNativeZoom: 19,
  },
  {
    id: 'plan-ign',
    label: 'Plan',
    emoji: '🗺️',
    url: `${IGN_WMTS}&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png`,
    attribution: IGN_ATTRIBUTION,
    maxNativeZoom: 19,
  },
]

export const DEFAULT_BASEMAP: BasemapId = 'satellite'

export function getBasemap(id: string | null | undefined): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS.find((b) => b.id === DEFAULT_BASEMAP)!
}

/** Le fond proposé par le bouton de la carte (celui qui n'est pas affiché). */
export function otherBasemap(id: BasemapId): Basemap {
  return BASEMAPS.find((b) => b.id !== id) ?? getBasemap(DEFAULT_BASEMAP)
}
