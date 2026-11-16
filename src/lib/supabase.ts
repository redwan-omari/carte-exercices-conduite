import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** Refuse toute clé secrète : seule une clé publique doit se trouver dans le frontend. */
function isSecretKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true
  const parts = k.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload?.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}

export let configError: string | null = null
if (!url || !key) {
  configError =
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY manquantes. Voir le README (section configuration).'
} else if (!/^https:\/\/.+/.test(url) && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
  configError = 'VITE_SUPABASE_URL invalide (doit commencer par https://).'
} else if (isSecretKey(key)) {
  configError =
    'Clé secrète détectée (service_role / sb_secret_). Elle ne doit JAMAIS être utilisée dans le site : utilisez la clé publique (publishable / anon) et régénérez la clé secrète dans Supabase.'
}

export const supabase: SupabaseClient = createClient(
  configError ? 'http://localhost:54321' : url,
  configError ? 'public-placeholder' : key,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // "implicit" : le lien reçu par email fonctionne même s'il est ouvert
      // dans un autre navigateur que celui de l'inscription (fréquent sur mobile).
      flowType: 'implicit',
    },
    realtime: { params: { eventsPerSecond: 10 } },
  },
)

export const PHOTO_BUCKET = 'spot-photos'

/** URL publique de l'application (pour les liens envoyés par email). */
export const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`
