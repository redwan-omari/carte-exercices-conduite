import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addMember,
  createSession,
  deleteSession,
  fetchAccounts,
  fetchMembers,
  fetchSessions,
  removeMember,
  setMemberRole,
  setMemberSession,
  updateSession,
} from '../lib/api'
import { frError, relativeDate } from '../lib/format'
import { APP_URL } from '../lib/supabase'
import type { Account, Member, MemberSession, Role } from '../lib/types'
import type { ShowToast } from './Toast'

interface Props {
  onClose: () => void
  toast: ShowToast
  myEmail: string
}

type Tab = 'pending' | 'members' | 'sessions'
const NO_SESSION = ''

/**
 * Page plein écran réservée aux administrateurs :
 * comptes en attente, membres (par session) et gestion des sessions.
 */
export default function MembersPage({ onClose, toast, myEmail }: Props) {
  const me = myEmail.toLowerCase()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<MemberSession[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, m, s] = await Promise.all([fetchAccounts(), fetchMembers(), fetchSessions()])
      setAccounts(a)
      setMembers(m)
      setSessions(s)
      setTab((t) => t ?? (a && a.some((x) => !m.some((y) => y.email === x.email)) ? 'pending' : 'members'))
    } catch (e) {
      toast(frError(e), 'error')
    } finally {
      setLoaded(true)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sessionsEnabled = sessions !== null
  const sessionById = useMemo(() => new Map((sessions ?? []).map((s) => [s.id, s])), [sessions])
  const accountByEmail = useMemo(() => new Map((accounts ?? []).map((a) => [a.email, a])), [accounts])
  const memberEmails = useMemo(() => new Set(members.map((m) => m.email)), [members])
  const pending = useMemo(() => (accounts ?? []).filter((a) => !memberEmails.has(a.email)), [accounts, memberEmails])
  const countBySession = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of members) if (m.session_id) c.set(m.session_id, (c.get(m.session_id) ?? 0) + 1)
    return c
  }, [members])
  // Session proposée par défaut : la plus récente encore active.
  const defaultSession = (sessions ?? []).find((s) => s.active)?.id ?? NO_SESSION

  async function run(key: string, fn: () => Promise<void>, ok?: string) {
    setBusy(key)
    try {
      await fn()
      if (ok) toast(ok)
      await load()
    } catch (e) {
      toast(frError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const sessionLabel = (id: string | null) => (id ? (sessionById.get(id)?.name ?? 'Session inconnue') : 'Sans session')

  return (
    <div className="page" role="dialog" aria-modal="true" aria-label="Gestion des membres">
      <header className="page-head">
        <button className="icon-btn" onClick={onClose} aria-label="Retour à la carte">
          ←
        </button>
        <h1>Gestion des membres</h1>
        <button className="icon-btn" onClick={() => load()} aria-label="Actualiser" title="Actualiser">
          ⟳
        </button>
      </header>

      <nav className="page-tabs" role="tablist">
        <TabBtn tab="pending" cur={tab} set={setTab} label="En attente" count={accounts ? pending.length : undefined} alert={pending.length > 0} />
        <TabBtn tab="members" cur={tab} set={setTab} label="Membres" count={members.length} />
        <TabBtn tab="sessions" cur={tab} set={setTab} label="Sessions" count={sessions?.length} />
      </nav>

      <div className="page-body">
        {!loaded && <p className="muted pad">Chargement…</p>}

        {loaded && !sessionsEnabled && (
          <p className="alert info">
            Pour voir les comptes en attente et gérer les sessions, exécutez la migration{' '}
            <code>supabase/migrations/20261116000000_sessions.sql</code> dans le SQL Editor de Supabase.
          </p>
        )}

        {loaded && tab === 'pending' && (
          <PendingTab
            pending={pending}
            available={accounts !== null}
            sessions={sessions}
            defaultSession={defaultSession}
            busy={busy}
            onApprove={(a, role, sessionId) =>
              run(`approve:${a.email}`, () => addMember(a.email, role, sessionId || null), `${a.display_name ?? a.email} est autorisé(e)`)
            }
          />
        )}

        {loaded && tab === 'members' && (
          <MembersTab
            members={members}
            me={me}
            sessions={sessions}
            sessionById={sessionById}
            accountByEmail={accountByEmail}
            accountsKnown={accounts !== null}
            defaultSession={defaultSession}
            busy={busy}
            sessionLabel={sessionLabel}
            onInvite={(email, role, sessionId) =>
              run('invite', () => addMember(email, role, sessionId || null), `${email.trim().toLowerCase()} est autorisé(e)`)
            }
            onRole={(m, role) => run(`role:${m.email}`, () => setMemberRole(m.email, role))}
            onSession={(m, sid) => run(`session:${m.email}`, () => setMemberSession(m.email, sid || null))}
            onRemove={(m) => {
              if (confirm(`Retirer l'accès de ${m.email} ?`)) run(`remove:${m.email}`, () => removeMember(m.email), 'Accès retiré')
            }}
          />
        )}

        {loaded && tab === 'sessions' && sessionsEnabled && (
          <SessionsTab
            sessions={sessions!}
            countBySession={countBySession}
            busy={busy}
            onCreate={(name) => run('create-session', () => createSession(name), `Session « ${name.trim()} » créée`)}
            onToggle={(s) => {
              const n = countBySession.get(s.id) ?? 0
              if (s.active && !confirm(`Désactiver « ${s.name} » ?\n\nLes ${n} membre(s) de cette session perdront l'accès immédiatement (les administrateurs gardent le leur).`))
                return
              run(`toggle:${s.id}`, () => updateSession(s.id, { active: !s.active }), s.active ? 'Session désactivée' : 'Session réactivée')
            }}
            onRename={(s) => {
              const name = prompt('Nouveau nom de la session :', s.name)?.trim()
              if (name && name !== s.name) run(`rename:${s.id}`, () => updateSession(s.id, { name }), 'Session renommée')
            }}
            onDelete={(s) => {
              if (confirm(`Supprimer la session « ${s.name} » ?`)) run(`delete:${s.id}`, () => deleteSession(s.id), 'Session supprimée')
            }}
          />
        )}
      </div>
    </div>
  )
}

function TabBtn({ tab, cur, set, label, count, alert }: { tab: Tab; cur: Tab | null; set: (t: Tab) => void; label: string; count?: number; alert?: boolean }) {
  return (
    <button role="tab" aria-selected={cur === tab} className={cur === tab ? 'active' : ''} onClick={() => set(tab)}>
      {label}
      {count !== undefined && <span className={`tab-count ${alert ? 'alert' : ''}`}>{count}</span>}
    </button>
  )
}

function SessionSelect({ sessions, value, onChange, disabled, label }: { sessions: MemberSession[]; value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}>
      <option value={NO_SESSION}>Sans session (permanent)</option>
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.active ? '' : ' (désactivée)'}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */

function PendingTab(props: {
  pending: Account[]
  available: boolean
  sessions: MemberSession[] | null
  defaultSession: string
  busy: string | null
  onApprove: (a: Account, role: Role, sessionId: string) => void
}) {
  const { pending, available, sessions, defaultSession, busy, onApprove } = props
  if (!available) return null
  if (!pending.length)
    return (
      <div className="empty-state">
        <p>✅ Aucun compte en attente.</p>
        <p className="muted small">
          Les personnes qui créent un compte sur {APP_URL} apparaissent ici jusqu'à ce que vous les autorisiez.
        </p>
      </div>
    )
  return (
    <>
      <p className="muted small">Ces personnes ont créé un compte mais ne voient pas encore la carte. Choisissez leur session, puis autorisez-les.</p>
      <ul className="people">
        {pending.map((a) => (
          <PendingRow key={a.user_id} a={a} sessions={sessions} defaultSession={defaultSession} busy={busy === `approve:${a.email}`} onApprove={onApprove} />
        ))}
      </ul>
    </>
  )
}

function PendingRow({ a, sessions, defaultSession, busy, onApprove }: { a: Account; sessions: MemberSession[] | null; defaultSession: string; busy: boolean; onApprove: (a: Account, role: Role, sessionId: string) => void }) {
  const [sessionId, setSessionId] = useState(defaultSession)
  const [role, setRole] = useState<Role>('member')
  useEffect(() => setSessionId(defaultSession), [defaultSession])
  return (
    <li className="person">
      <div className="person-main">
        <Avatar name={a.display_name ?? a.email} />
        <div className="person-id">
          <strong>{a.display_name ?? a.email.split('@')[0]}</strong>
          <span className="muted small">{a.email}</span>
          <span className="badges">
            <span className="badge">Inscrit {relativeDate(a.created_at)}</span>
            {!a.email_confirmed && <span className="badge warn">Email non confirmé</span>}
          </span>
        </div>
      </div>
      <div className="person-actions">
        {sessions && <SessionSelect sessions={sessions} value={sessionId} onChange={setSessionId} label={`Session de ${a.email}`} />}
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={`Rôle de ${a.email}`}>
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn primary" disabled={busy} onClick={() => onApprove(a, role, sessionId)}>
          {busy ? '…' : '✓ Autoriser'}
        </button>
      </div>
      {!a.email_confirmed && <p className="muted small">Autorisation possible dès maintenant : l'accès s'ouvrira quand la personne aura confirmé son email.</p>}
    </li>
  )
}

/* ------------------------------------------------------------------ */

function MembersTab(props: {
  members: Member[]
  me: string
  sessions: MemberSession[] | null
  sessionById: Map<string, MemberSession>
  accountByEmail: Map<string, Account>
  accountsKnown: boolean
  defaultSession: string
  busy: string | null
  sessionLabel: (id: string | null) => string
  onInvite: (email: string, role: Role, sessionId: string) => void
  onRole: (m: Member, role: Role) => void
  onSession: (m: Member, sid: string) => void
  onRemove: (m: Member) => void
}) {
  const { members, me, sessions, sessionById, accountByEmail, accountsKnown, defaultSession, busy, sessionLabel } = props
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [sessionId, setSessionId] = useState(defaultSession)
  useEffect(() => setSessionId(defaultSession), [defaultSession])

  const groups = useMemo(() => {
    const nq = q.trim().toLowerCase()
    const list = members.filter((m) => {
      if (filter !== 'all' && (m.session_id ?? NO_SESSION) !== filter) return false
      if (!nq) return true
      const name = accountByEmail.get(m.email)?.display_name ?? ''
      return `${m.email} ${name}`.toLowerCase().includes(nq)
    })
    const map = new Map<string, Member[]>()
    for (const m of list) {
      const k = m.session_id ?? NO_SESSION
      map.set(k, [...(map.get(k) ?? []), m])
    }
    // Ordre : sessions actives récentes, puis désactivées, puis « sans session ».
    const order = [...(sessions ?? []).filter((s) => s.active), ...(sessions ?? []).filter((s) => !s.active)].map((s) => s.id)
    order.push(NO_SESSION)
    for (const k of map.keys()) if (!order.includes(k)) order.push(k)
    return order.filter((k) => map.has(k)).map((k) => ({ key: k, items: map.get(k)! }))
  }, [members, q, filter, sessions, accountByEmail])

  function invite(e: FormEvent) {
    e.preventDefault()
    props.onInvite(email, role, sessionId)
    setEmail('')
  }

  return (
    <>
      <details className="invite">
        <summary>＋ Autoriser une adresse email à l'avance</summary>
        <form onSubmit={invite} className="invite-form">
          <input type="email" required placeholder="email@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" aria-label="Email" />
          {sessions && <SessionSelect sessions={sessions} value={sessionId} onChange={setSessionId} label="Session" />}
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rôle">
            <option value="member">Membre</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn primary" disabled={busy === 'invite'}>
            Autoriser
          </button>
        </form>
        <p className="muted small">La personne crée ensuite son compte sur {APP_URL} avec cette adresse : l'accès est immédiat après confirmation de l'email.</p>
      </details>

      <div className="members-tools">
        <input type="search" placeholder="Rechercher un nom ou un email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        {sessions && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer par session">
            <option value="all">Toutes les sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NO_SESSION}>Sans session</option>
          </select>
        )}
      </div>

      {!groups.length && <p className="muted pad">Aucun membre trouvé.</p>}
      {groups.map(({ key, items }) => {
        const s = key ? sessionById.get(key) : undefined
        return (
          <section key={key || 'none'} className="member-group">
            <h3>
              {sessionLabel(key || null)}
              {s && <span className={`badge ${s.active ? 'ok' : 'off'}`}>{s.active ? 'Active' : 'Désactivée'}</span>}
              <span className="muted small">{items.length}</span>
            </h3>
            <ul className="people">
              {items.map((m) => {
                const acc = accountByEmail.get(m.email)
                const disabled = m.role !== 'admin' && !!s && !s.active
                return (
                  <li key={m.email} className={`person ${disabled ? 'is-off' : ''}`}>
                    <div className="person-main">
                      <Avatar name={acc?.display_name ?? m.email} />
                      <div className="person-id">
                        <strong>
                          {acc?.display_name ?? m.email.split('@')[0]}
                          {m.email === me && <span className="muted"> (vous)</span>}
                        </strong>
                        <span className="muted small">{m.email}</span>
                        <span className="badges">
                          {m.role === 'admin' && <span className="badge admin">Admin</span>}
                          {disabled && <span className="badge off">Accès désactivé</span>}
                          {accountsKnown && !acc && <span className="badge">Compte pas encore créé</span>}
                          {acc && !acc.email_confirmed && <span className="badge warn">Email non confirmé</span>}
                          {acc?.last_sign_in_at && <span className="badge">Vu {relativeDate(acc.last_sign_in_at)}</span>}
                        </span>
                      </div>
                    </div>
                    <div className="person-actions">
                      {sessions && (
                        <SessionSelect
                          sessions={sessions}
                          value={m.session_id ?? NO_SESSION}
                          onChange={(v) => props.onSession(m, v)}
                          disabled={busy === `session:${m.email}`}
                          label={`Session de ${m.email}`}
                        />
                      )}
                      <select value={m.role} onChange={(e) => props.onRole(m, e.target.value as Role)} disabled={busy === `role:${m.email}`} aria-label={`Rôle de ${m.email}`}>
                        <option value="member">Membre</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="icon-btn" onClick={() => props.onRemove(m)} aria-label={`Retirer ${m.email}`} title="Retirer l'accès">
                        🗑️
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------ */

function SessionsTab(props: {
  sessions: MemberSession[]
  countBySession: Map<string, number>
  busy: string | null
  onCreate: (name: string) => void
  onToggle: (s: MemberSession) => void
  onRename: (s: MemberSession) => void
  onDelete: (s: MemberSession) => void
}) {
  const { sessions, countBySession, busy } = props
  const [name, setName] = useState('')
  function create(e: FormEvent) {
    e.preventDefault()
    props.onCreate(name)
    setName('')
  }
  return (
    <>
      <p className="muted small">
        Une session regroupe des membres sous le nom de votre choix (ex. « Promo septembre 2026 », « Groupe stage été »). Désactiver une
        session coupe l'accès de tous ses membres en une fois ; la réactiver le rétablit. Les administrateurs gardent toujours leur accès.
      </p>
      <form onSubmit={create} className="invite-form">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Nom de la nouvelle session" aria-label="Nom de la session" />
        <button className="btn primary" disabled={busy === 'create-session' || !name.trim()}>
          Créer
        </button>
      </form>
      {!sessions.length && <p className="muted pad">Aucune session pour l'instant.</p>}
      <ul className="people">
        {sessions.map((s) => {
          const n = countBySession.get(s.id) ?? 0
          return (
            <li key={s.id} className={`person session-row ${s.active ? '' : 'is-off'}`}>
              <div className="person-id">
                <strong>{s.name}</strong>
                <span className="muted small">
                  {n} membre(s) · créée {relativeDate(s.created_at)}
                </span>
              </div>
              <div className="person-actions">
                <label className="switch" title={s.active ? 'Désactiver la session' : 'Réactiver la session'}>
                  <input type="checkbox" checked={s.active} onChange={() => props.onToggle(s)} disabled={busy === `toggle:${s.id}`} />
                  <span className="switch-track" aria-hidden />
                  <span>{s.active ? 'Active' : 'Désactivée'}</span>
                </label>
                <button className="icon-btn" onClick={() => props.onRename(s)} aria-label={`Renommer ${s.name}`} title="Renommer">
                  ✏️
                </button>
                <button
                  className="icon-btn"
                  onClick={() => props.onDelete(s)}
                  disabled={n > 0}
                  aria-label={`Supprimer ${s.name}`}
                  title={n > 0 ? 'Déplacez ou retirez d’abord ses membres' : 'Supprimer'}
                >
                  🗑️
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="person-avatar" aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
