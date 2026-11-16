import { PHOTO_BUCKET, supabase } from './supabase'
import { compressImage } from './image'
import type { AccessStatus, Account, Member, MemberSession, Photo, Role, Spot } from './types'

const SPOT_SELECT =
  'id,title,category,description,lat,lng,accuracy_m,created_by,created_at,updated_at,' +
  'author:profiles(display_name),photos:spot_photos(id,path,created_by,created_at)'

function sortPhotos(s: Spot): Spot {
  s.photos = [...(s.photos ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return s
}

export async function fetchSpots(): Promise<Spot[]> {
  const { data, error } = await supabase.from('spots').select(SPOT_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as Spot[]).map(sortPhotos)
}

export interface SpotInput {
  title: string
  category: string
  description: string | null
  lat: number
  lng: number
  accuracy_m: number | null
}

export async function createSpot(input: SpotInput, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('spots')
    .insert({ ...input, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateSpot(id: string, input: SpotInput): Promise<void> {
  const { error } = await supabase.from('spots').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteSpot(spot: Spot): Promise<void> {
  const paths = spot.photos.map((p) => p.path)
  if (paths.length) {
    // Les fichiers d'abord (la ligne SQL emportera les métadonnées en cascade).
    await supabase.storage.from(PHOTO_BUCKET).remove(paths)
  }
  const { error } = await supabase.from('spots').delete().eq('id', spot.id)
  if (error) throw error
}

export async function uploadPhotos(
  spotId: string,
  userId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ failed: number }> {
  let failed = 0
  for (let i = 0; i < files.length; i++) {
    try {
      const blob = await compressImage(files[i])
      const path = `${spotId}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      })
      if (up.error) throw up.error
      const { error } = await supabase.from('spot_photos').insert({ spot_id: spotId, path, created_by: userId })
      if (error) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path])
        throw error
      }
    } catch (e) {
      console.error('Envoi photo échoué', e)
      failed++
    }
    onProgress?.(i + 1, files.length)
  }
  return { failed }
}

export async function deletePhoto(photo: Photo): Promise<void> {
  const { error } = await supabase.from('spot_photos').delete().eq('id', photo.id)
  if (error) throw error
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.path])
}

const urlCache = new Map<string, { url: string; expires: number }>()
const SIGNED_TTL = 60 * 60 * 6

/** URL signées (bucket privé) avec cache mémoire. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of paths) {
    const c = urlCache.get(p)
    if (c && c.expires > now + 60_000) out[p] = c.url
    else missing.push(p)
  }
  if (missing.length) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(missing, SIGNED_TTL)
    if (error) throw error
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        urlCache.set(item.path, { url: item.signedUrl, expires: now + SIGNED_TTL * 1000 })
        out[item.path] = item.signedUrl
      }
    }
  }
  return out
}

export async function fetchMyRole(): Promise<Role | null> {
  const { data, error } = await supabase.rpc('my_role')
  if (error) throw error
  return (data as Role | null) ?? null
}

export async function fetchMyProfile(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.display_name ?? null
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  if (error) throw error
}

/** Objet ou fonction absent : la migration « sessions » n'a pas encore été exécutée. */
function isMissing(error: { code?: string } | null) {
  return !!error && ['PGRST202', 'PGRST205', '42703', '42P01', '42883'].includes(error.code ?? '')
}

/** Statut détaillé du compte connecté (repli sur my_role si la migration sessions manque). */
export async function fetchMyStatus(): Promise<AccessStatus | null> {
  const { data, error } = await supabase.rpc('my_status')
  if (isMissing(error)) return (await fetchMyRole()) ?? 'pending'
  if (error) throw error
  return (data as AccessStatus | null) ?? null
}

export async function fetchMembers(): Promise<Member[]> {
  const withSession = await supabase.from('members').select('email,role,created_at,session_id').order('email')
  const res = isMissing(withSession.error)
    ? await supabase.from('members').select('email,role,created_at').order('email')
    : withSession
  if (res.error) throw res.error
  return (res.data as Partial<Member>[]).map((m) => ({ session_id: null, ...m }) as Member)
}

/** Tous les comptes créés (null si la migration sessions n'est pas encore exécutée). */
export async function fetchAccounts(): Promise<Account[] | null> {
  const { data, error } = await supabase.rpc('admin_list_accounts')
  if (isMissing(error)) return null
  if (error) throw error
  return data as Account[]
}

/** Sessions (null si la migration sessions n'est pas encore exécutée). */
export async function fetchSessions(): Promise<MemberSession[] | null> {
  const { data, error } = await supabase.from('sessions').select('id,name,active,created_at').order('created_at', { ascending: false })
  if (isMissing(error)) return null
  if (error) throw error
  return data as MemberSession[]
}

export async function fetchPendingCount(): Promise<number> {
  const [accounts, members] = await Promise.all([fetchAccounts(), fetchMembers()])
  if (!accounts) return 0
  const emails = new Set(members.map((m) => m.email))
  return accounts.filter((a) => !emails.has(a.email)).length
}

export async function addMember(email: string, role: Role, sessionId: string | null = null): Promise<void> {
  const row: Record<string, unknown> = { email: email.trim().toLowerCase(), role }
  if (sessionId) row.session_id = sessionId
  const { error } = await supabase.from('members').insert(row)
  if (error) throw error
}

export async function setMemberSession(email: string, sessionId: string | null): Promise<void> {
  const { error } = await supabase.from('members').update({ session_id: sessionId }).eq('email', email)
  if (error) throw error
}

export async function createSession(name: string): Promise<void> {
  const { error } = await supabase.from('sessions').insert({ name: name.trim() })
  if (error) throw error
}

export async function updateSession(id: string, patch: { name?: string; active?: boolean }): Promise<void> {
  const { error } = await supabase.from('sessions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}

export async function setMemberRole(email: string, role: Role): Promise<void> {
  const { error } = await supabase.from('members').update({ role }).eq('email', email)
  if (error) throw error
}

export async function removeMember(email: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('email', email)
  if (error) throw error
}
