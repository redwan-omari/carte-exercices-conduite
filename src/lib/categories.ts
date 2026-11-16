export interface Category {
  id: string
  label: string
  emoji: string
  color: string
}

/**
 * Types d'exercices. Pour en ajouter un : ajoutez une ligne ici
 * (identifiant en minuscules, sans espace). Aucune modification SQL n'est nécessaire.
 */
export const CATEGORIES: Category[] = [
  { id: 'creneau', label: 'Créneau', emoji: '🅿️', color: '#2563eb' },
  { id: 'bataille', label: 'Rangement en bataille', emoji: '⬆️', color: '#0891b2' },
  { id: 'epi', label: 'Rangement en épi', emoji: '↗️', color: '#0d9488' },
  { id: 'demi-tour', label: 'Demi-tour', emoji: '↩️', color: '#7c3aed' },
  { id: 'cote', label: 'Démarrage en côte', emoji: '⛰️', color: '#a16207' },
  { id: 'giratoire', label: 'Rond-point / giratoire', emoji: '🔄', color: '#16a34a' },
  { id: 'intersection', label: 'Intersection / priorités', emoji: '✖️', color: '#dc2626' },
  { id: 'insertion', label: 'Insertion voie rapide', emoji: '🛣️', color: '#ea580c' },
  { id: 'ville', label: 'Circulation urbaine dense', emoji: '🏙️', color: '#db2777' },
  { id: 'campagne', label: 'Route de campagne / virages', emoji: '🌾', color: '#65a30d' },
  { id: 'freinage', label: 'Freinage / arrêt de précision', emoji: '🛑', color: '#b91c1c' },
  { id: 'autre', label: 'Autre', emoji: '📍', color: '#475569' },
]

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get('autre')!
}
