import { useState, type FormEvent } from 'react'
import { APP_URL, supabase } from '../lib/supabase'
import { frError } from '../lib/format'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const cleanEmail = email.trim().toLowerCase()
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password should be at least 8 characters')
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: APP_URL },
        })
        if (error) throw error
        if (!data.session) {
          setInfo(
            `Compte créé ! Un email de confirmation a été envoyé à ${cleanEmail}. Ouvrez le lien qu'il contient (vérifiez les spams), puis connectez-vous.`,
          )
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: APP_URL })
        if (error) throw error
        setInfo('Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.')
      }
    } catch (err) {
      setError(frError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen center auth">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" width={56} height={56} />
          <div>
            <h1>Exercices de conduite</h1>
            <p className="muted">Carte partagée de l'équipe</p>
          </div>
        </div>

        {mode !== 'reset' && (
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
              Connexion
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
              Créer un compte
            </button>
          </div>
        )}
        {mode === 'reset' && <h2>Mot de passe oublié</h2>}

        {mode === 'signup' && (
          <label>
            Nom affiché
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" placeholder="Prénom Nom" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" placeholder="vous@exemple.fr" />
        </label>
        {mode !== 'reset' && (
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? '8 caractères minimum' : ''}
            />
          </label>
        )}

        {error && <p className="alert error">{error}</p>}
        {info && <p className="alert info">{info}</p>}

        <button className="btn primary block" disabled={busy}>
          {busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>

        {mode === 'login' && (
          <button type="button" className="link" onClick={() => switchMode('reset')}>
            Mot de passe oublié ?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link" onClick={() => switchMode('login')}>
            ← Retour à la connexion
          </button>
        )}
        <p className="muted small">
          L'accès aux données est réservé aux membres du groupe. Après la création de votre compte, un administrateur doit
          autoriser votre adresse email.
        </p>
      </form>
    </div>
  )
}
