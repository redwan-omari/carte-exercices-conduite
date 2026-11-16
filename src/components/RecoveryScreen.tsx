import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { frError } from '../lib/format'

export default function RecoveryScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onDone()
    } catch (err) {
      setError(frError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen center auth">
      <form className="card" onSubmit={submit}>
        <h1>Nouveau mot de passe</h1>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="8 caractères minimum" />
        </label>
        {error && <p className="alert error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Patientez…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
