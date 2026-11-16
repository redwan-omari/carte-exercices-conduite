import type { AccessStatus } from '../lib/types'

interface Props {
  email: string
  status: AccessStatus | null
  error: string | null
  onRetry: () => void
  onSignOut: () => void
}

export default function PendingAccess({ email, status, error, onRetry, onSignOut }: Props) {
  const disabled = status === 'disabled'
  return (
    <div className="screen center auth">
      <div className="card">
        <h1>{disabled ? '🔒 Accès désactivé' : '⏳ Accès en attente'}</h1>
        {error ? (
          <p className="alert error">{error}</p>
        ) : disabled ? (
          <p>
            Le compte <strong>{email}</strong> fait partie d'une session qui a été désactivée par l'administrateur. Vos données
            restent conservées.
          </p>
        ) : status === 'unconfirmed' ? (
          <p>
            Confirmez d'abord votre adresse <strong>{email}</strong> en cliquant sur le lien reçu par email (pensez aux spams).
          </p>
        ) : (
          <p>
            Votre compte <strong>{email}</strong> est bien créé. Un administrateur doit maintenant l'autoriser : il voit votre demande dans
            sa liste « En attente ».
          </p>
        )}
        <p>
          {disabled
            ? "Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur, puis appuyez sur « Réessayer »."
            : 'Dès que votre accès est validé, appuyez sur « Réessayer ».'}
        </p>
        <button className="btn primary block" onClick={onRetry}>
          Réessayer
        </button>
        <button className="btn block" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
