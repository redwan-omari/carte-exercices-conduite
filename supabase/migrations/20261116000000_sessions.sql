-- =====================================================================
--  Carte des exercices de conduite — Sessions de membres
--  À exécuter APRÈS 20261109000000_init.sql (SQL Editor > New query > Run).
--  Ne supprime aucune donnée ; peut être relancé sans risque.
--
--  * Une session = un groupe nommé librement par l'administrateur
--    (ex. « Promo septembre 2026 »), active ou désactivée.
--  * Chaque membre peut être rattaché à une session (ou à aucune :
--    accès permanent, par ex. pour les formateurs).
--  * Désactiver une session coupe immédiatement l'accès de tous ses
--    membres. Les administrateurs gardent toujours leur accès.
--  * Les administrateurs peuvent lister tous les comptes créés, y compris
--    ceux qui attendent une autorisation.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table des sessions
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(btrim(name)) between 1 and 80),
  active     boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.sessions is 'Groupes de membres (nommés par l''administrateur) pouvant être activés ou désactivés.';

-- Rattachement d'un membre à une session.
-- ON DELETE RESTRICT : une session qui contient encore des membres ne peut
-- pas être supprimée (sinon ses membres deviendraient « permanents »).
alter table public.members
  add column if not exists session_id uuid references public.sessions (id) on delete restrict;

create index if not exists members_session_id_idx on public.members (session_id);

alter table public.sessions enable row level security;

drop policy if exists "sessions: lecture par admin" on public.sessions;
create policy "sessions: lecture par admin" on public.sessions
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "sessions: ajout par admin" on public.sessions;
create policy "sessions: ajout par admin" on public.sessions
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "sessions: modification par admin" on public.sessions;
create policy "sessions: modification par admin" on public.sessions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "sessions: suppression par admin" on public.sessions;
create policy "sessions: suppression par admin" on public.sessions
  for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.sessions from anon;
grant select, insert, update, delete on public.sessions to authenticated;

-- ---------------------------------------------------------------------
-- 2. Règle d'accès : un membre d'une session désactivée n'a plus accès
--    (même signature qu'avant : toutes les règles RLS existantes en profitent)
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from auth.users u
  join public.members m on m.email = lower(u.email)
  left join public.sessions s on s.id = m.session_id
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and (m.role = 'admin' or m.session_id is null or s.active)
  limit 1;
$$;

-- Statut détaillé pour l'affichage : 'admin', 'member', 'pending'
-- (pas encore autorisé), 'disabled' (session désactivée), 'unconfirmed'.
create or replace function public.my_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when u.id is null then null
    when u.email_confirmed_at is null then 'unconfirmed'
    when m.email is null then 'pending'
    when m.role = 'admin' then 'admin'
    when m.session_id is not null and not coalesce(s.active, false) then 'disabled'
    else m.role
  end
  from (select auth.uid() as uid) me
  left join auth.users u on u.id = me.uid
  left join public.members m on m.email = lower(u.email)
  left join public.sessions s on s.id = m.session_id;
$$;

revoke all on function public.my_status() from public, anon;
grant execute on function public.my_status() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Liste de tous les comptes (réservée aux administrateurs)
--    Inclut les comptes en attente d'autorisation.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_accounts()
returns table (
  user_id         uuid,
  email           text,
  display_name    text,
  created_at      timestamptz,
  email_confirmed boolean,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
    select u.id,
           lower(u.email)::text,
           p.display_name,
           u.created_at,
           u.email_confirmed_at is not null,
           u.last_sign_in_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email is not null
    order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
