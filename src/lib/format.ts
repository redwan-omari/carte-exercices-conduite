const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

export function relativeDate(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return "à l'instant"
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return `le ${dtf.format(new Date(iso))}`
}

/** Traduit les erreurs Supabase les plus courantes. */
export function frError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  const map: [RegExp, string][] = [
    [/invalid login credentials/i, 'Email ou mot de passe incorrect.'],
    [/email not confirmed/i, "Email non confirmé : cliquez sur le lien reçu par email (pensez aux spams)."],
    [/user already registered/i, 'Un compte existe déjà avec cet email. Utilisez « Connexion ».'],
    [/password should be at least/i, 'Le mot de passe doit contenir au moins 8 caractères.'],
    [/rate limit|too many requests|security purposes/i, 'Trop de tentatives. Patientez quelques minutes puis réessayez.'],
    [/row-level security|permission denied|violates row-level/i, "Action non autorisée pour votre compte."],
    [/failed to fetch|network|load failed/i, 'Connexion internet indisponible ou instable.'],
    [/jwt expired/i, 'Session expirée, reconnectez-vous.'],
    [/dernier administrateur/i, 'Impossible de retirer le dernier administrateur.'],
    [/duplicate key.*sessions|sessions_name_key/i, 'Une session porte déjà ce nom.'],
    [/violates foreign key constraint.*session|members_session_id_fkey/i, 'Cette session contient encore des membres : déplacez-les ou retirez-les avant de la supprimer.'],
    [/duplicate key/i, 'Cet élément existe déjà.'],
    [/Réservé aux administrateurs/i, 'Réservé aux administrateurs.'],
    [/same.*password|new password should be different/i, "Le nouveau mot de passe doit être différent de l'ancien."],
  ]
  for (const [re, fr] of map) if (re.test(msg)) return fr
  return msg || 'Erreur inconnue.'
}
