export type Role = 'admin' | 'member'
/** Statut d'accès du compte connecté (fonction SQL my_status). */
export type AccessStatus = Role | 'pending' | 'disabled' | 'unconfirmed'

export interface Photo {
  id: string
  path: string
  created_by: string | null
  created_at: string
}

export interface Spot {
  id: string
  title: string
  category: string
  description: string | null
  lat: number
  lng: number
  accuracy_m: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  author: { display_name: string } | null
  photos: Photo[]
}

export interface Member {
  email: string
  role: Role
  created_at: string
  session_id: string | null
}

/** Groupe de membres nommé par l'administrateur, activable / désactivable. */
export interface MemberSession {
  id: string
  name: string
  active: boolean
  created_at: string
}

/** Compte créé dans Supabase Auth (liste réservée aux administrateurs). */
export interface Account {
  user_id: string
  email: string
  display_name: string | null
  created_at: string
  email_confirmed: boolean
  last_sign_in_at: string | null
}

export interface GeoPos {
  lat: number
  lng: number
  accuracy: number
  ts: number
}

export interface LatLng {
  lat: number
  lng: number
}
