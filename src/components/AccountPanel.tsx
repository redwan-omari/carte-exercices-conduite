import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchMyProfile, updateDisplayName } from '../lib/api'
import { frError } from '../lib/format'
import { APP_URL, supabase } from '../lib/supabase'
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import type { Role } from '../lib/types'
import type { ShowToast } from './Toast'

interface Props {
  session: Session
  role: Role
  onClose: () => void
  onMembers: () => void
  toast: ShowToast
}

export default function AccountPanel({ session, role, onClose, onMembers, toast }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [, force] = useState(0)

  useEffect(() => onInstallChange(() => force((n) => n + 1)), [])
  useEffect(() => {
    fetchMyProfile(session.user.id).then((n) => n && setName(n)).catch(() => {})
  }, [session.user.id])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateDisplayName(session.user.id, name)
      await supabase.auth.updateUser({ data: { display_name: name.trim() } })
      toast('Nom mis à jour')
    } catch (err) {
      toast(frError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function shareApp() {
    try {
      if (navigator.share) await navigator.share({ title: 'Carte des exercices de conduite', url: APP_URL })
      else {
        await navigator.clipboard.writeText(APP_URL)
        toast('Lien copié')
      }
    } catch {
      /* annulé */
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Mon compte">
      <div className="modal-body">
        <div className="sheet-head">
          <h2>Mon compte</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p>
          {session.user.email} <span className={`role ${role}`}>{role === 'admin' ? 'Administrateur' : 'Membre'}</span>
        </p>

        <form onSubmit={save} className="inline-form">
          <label>
            Nom affiché sur les lieux
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </label>
          <button className="btn" disabled={saving || !name.trim()}>
            Enregistrer
          </button>
        </form>

        {role === 'admin' && (
          <button className="btn block" onClick={onMembers}>
            👥 Gérer les membres
          </button>
        )}
        <button className="btn block" onClick={shareApp}>
          🔗 Partager le lien de l'application
        </button>

        {!isStandalone() &&
          (canPromptInstall() ? (
            <button className="btn block" onClick={() => promptInstall()}>
              📲 Installer sur l'écran d'accueil
            </button>
          ) : isIOS() ? (
            <p className="alert info small">
              📲 Pour installer l'application : bouton <strong>Partager</strong> de Safari puis <strong>« Sur l'écran d'accueil »</strong>.
            </p>
          ) : null)}

        <button className="btn block danger" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
