import { useCallback, useEffect, useState } from 'react'
import { configError, supabase } from './lib/supabase'
import { useAuth } from './hooks/useAuth'
import { fetchMyStatus } from './lib/api'
import { frError } from './lib/format'
import type { AccessStatus, Role } from './lib/types'
import AuthScreen from './components/AuthScreen'
import RecoveryScreen from './components/RecoveryScreen'
import PendingAccess from './components/PendingAccess'
import MainScreen from './components/MainScreen'
import { Splash } from './components/Splash'

export default function App() {
  if (configError) {
    return (
      <div className="screen center">
        <div className="card">
          <h1>⚙️ Configuration manquante</h1>
          <p>{configError}</p>
        </div>
      </div>
    )
  }
  return <AuthedApp />
}

function AuthedApp() {
  const { session, ready, recovery, endRecovery } = useAuth()
  const [status, setStatus] = useState<AccessStatus | null | undefined>(undefined)
  const [roleError, setRoleError] = useState<string | null>(null)
  const userId = session?.user.id

  // silent = revérification en arrière-plan (sans écran de chargement)
  const loadRole = useCallback(async (silent = false) => {
    setRoleError(null)
    if (!silent) setStatus(undefined)
    try {
      setStatus(await fetchMyStatus())
    } catch (e) {
      if (!silent) {
        setRoleError(frError(e))
        setStatus(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setStatus(undefined)
      return
    }
    loadRole()
    // Revérifie l'accès quand l'appli revient au premier plan
    // (ex. session désactivée ou compte autorisé entre-temps).
    const onVisible = () => document.visibilityState === 'visible' && loadRole(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, loadRole])

  const role: Role | null | undefined = status === 'admin' || status === 'member' ? status : status === undefined ? undefined : null

  if (!ready) return <Splash />
  if (recovery && session) return <RecoveryScreen onDone={endRecovery} />
  if (!session) return <AuthScreen />
  if (role === undefined) return <Splash />
  if (role === null)
    return (
      <PendingAccess
        email={session.user.email ?? ''}
        status={status ?? null}
        error={roleError}
        onRetry={() => loadRole()}
        onSignOut={() => supabase.auth.signOut()}
      />
    )
  return <MainScreen session={session} role={role} />
}
