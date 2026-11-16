-- =====================================================================
--  Carte des exercices de conduite — schéma initial Supabase
--  À exécuter une seule fois : Supabase > SQL Editor > New query > Run
--  (ou `supabase db push` avec la CLI Supabase).
--
--  Modèle de sécurité :
--   * Toute personne peut créer un compte, mais NE VOIT RIEN tant que
--     son email (confirmé) n'est pas dans la table `members`.
--   * Les membres voient et ajoutent tous les lieux et photos du groupe.
--   * Un lieu / une photo ne peut être modifié(e) ou supprimé(e) que par
--     son auteur ou par un administrateur.
--   * Seuls les administrateurs gèrent la liste des membres.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Membres autorisés (liste blanche par email)
-- ---------------------------------------------------------------------
create table if not exists public.members (
  email      text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  role       text not null default 'member' check (role in ('admin', 'member')),
  added_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.members is 'Liste blanche des emails autorisés à accéder aux données du groupe.';

-- Rôle de l'utilisateur connecté : 'admin', 'member' ou NULL (non autorisé).
-- L'email doit être CONFIRMÉ, ce qui empêche de s'inscrire avec l'email d'un collègue.
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
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
  limit 1;
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role() is not null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

revoke all on function public.my_role()   from public, anon;
revoke all on function public.is_member() from public, anon;
revoke all on function public.is_admin()  from public, anon;
grant execute on function public.my_role()   to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin()  to authenticated;

-- Empêche de supprimer / rétrograder le dernier administrateur.
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and (select count(*) from public.members where role = 'admin') <= 1 then
    raise exception 'Impossible de retirer le dernier administrateur.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists members_protect_last_admin on public.members;
create trigger members_protect_last_admin
  before update or delete on public.members
  for each row execute function public.protect_last_admin();

-- Normalise les emails saisis (minuscules, sans espaces).
create or replace function public.normalize_member_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists members_normalize_email on public.members;
create trigger members_normalize_email
  before insert or update of email on public.members
  for each row execute function public.normalize_member_email();

alter table public.members enable row level security;

drop policy if exists "members: lecture par les membres" on public.members;
create policy "members: lecture par les membres" on public.members
  for select to authenticated
  using ((select public.is_member()));

drop policy if exists "members: ajout par admin" on public.members;
create policy "members: ajout par admin" on public.members
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "members: modification par admin" on public.members;
create policy "members: modification par admin" on public.members
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "members: suppression par admin" on public.members;
create policy "members: suppression par admin" on public.members
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. Profils (nom affiché des auteurs)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(new.email, '@', 1), 'Utilisateur'), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils des comptes créés avant cette migration.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
                           split_part(u.email, '@', 1), 'Utilisateur'), 60)
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "profiles: lecture" on public.profiles;
create policy "profiles: lecture" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_member()));

drop policy if exists "profiles: modification de son profil" on public.profiles;
create policy "profiles: modification de son profil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 3. Lieux d'exercices
-- ---------------------------------------------------------------------
create table if not exists public.spots (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  category    text not null default 'autre' check (category ~ '^[a-z0-9_-]{1,40}$'),
  description text check (description is null or char_length(description) <= 2000),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m is null or accuracy_m >= 0),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists spots_created_at_idx on public.spots (created_at desc);
create index if not exists spots_created_by_idx on public.spots (created_by);

-- updated_at automatique + auteur / date de création non modifiables.
create or replace function public.spots_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists spots_before_update on public.spots;
create trigger spots_before_update
  before update on public.spots
  for each row execute function public.spots_before_update();

alter table public.spots enable row level security;

drop policy if exists "spots: lecture par les membres" on public.spots;
create policy "spots: lecture par les membres" on public.spots
  for select to authenticated
  using ((select public.is_member()));

drop policy if exists "spots: ajout par les membres" on public.spots;
create policy "spots: ajout par les membres" on public.spots
  for insert to authenticated
  with check ((select public.is_member()) and created_by = (select auth.uid()));

drop policy if exists "spots: modification par auteur ou admin" on public.spots;
create policy "spots: modification par auteur ou admin" on public.spots
  for update to authenticated
  using ((select public.is_member()) and (created_by = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_member()));

drop policy if exists "spots: suppression par auteur ou admin" on public.spots;
create policy "spots: suppression par auteur ou admin" on public.spots
  for delete to authenticated
  using ((select public.is_member()) and (created_by = (select auth.uid()) or (select public.is_admin())));

-- ---------------------------------------------------------------------
-- 4. Photos (métadonnées ; les fichiers sont dans Storage)
-- ---------------------------------------------------------------------
create table if not exists public.spot_photos (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references public.spots (id) on delete cascade,
  path       text not null unique check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint spot_photos_path_matches_spot check (split_part(path, '/', 1) = spot_id::text)
);

create index if not exists spot_photos_spot_id_idx on public.spot_photos (spot_id);
create index if not exists spot_photos_created_by_idx on public.spot_photos (created_by);

alter table public.spot_photos enable row level security;

drop policy if exists "photos: lecture par les membres" on public.spot_photos;
create policy "photos: lecture par les membres" on public.spot_photos
  for select to authenticated
  using ((select public.is_member()));

drop policy if exists "photos: ajout par les membres" on public.spot_photos;
create policy "photos: ajout par les membres" on public.spot_photos
  for insert to authenticated
  with check ((select public.is_member()) and created_by = (select auth.uid()));

drop policy if exists "photos: suppression par auteur, auteur du lieu ou admin" on public.spot_photos;
create policy "photos: suppression par auteur, auteur du lieu ou admin" on public.spot_photos
  for delete to authenticated
  using (
    (select public.is_member()) and (
      created_by = (select auth.uid())
      or (select public.is_admin())
      or exists (select 1 from public.spots s
                 where s.id = spot_photos.spot_id and s.created_by = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- 5. Droits SQL de base (RLS fait le filtrage fin ; anon n'a rien)
-- ---------------------------------------------------------------------
revoke all on public.members, public.profiles, public.spots, public.spot_photos from anon;
grant select, insert, update, delete on public.members     to authenticated;
grant select, update                 on public.profiles    to authenticated;
grant select, insert, update, delete on public.spots       to authenticated;
grant select, insert, delete         on public.spot_photos to authenticated;

-- ---------------------------------------------------------------------
-- 6. Stockage des photos (bucket PRIVÉ, accès via URL signées)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-photos', 'spot-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "spot-photos: lecture par les membres" on storage.objects;
create policy "spot-photos: lecture par les membres" on storage.objects
  for select to authenticated
  using (bucket_id = 'spot-photos' and (select public.is_member()));

-- Upload uniquement dans le dossier d'un lieu existant : <spot_id>/<fichier>
drop policy if exists "spot-photos: ajout par les membres" on storage.objects;
create policy "spot-photos: ajout par les membres" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spot-photos'
    and (select public.is_member())
    and exists (select 1 from public.spots s
                where s.id::text = (storage.foldername(name))[1])
  );

drop policy if exists "spot-photos: suppression" on storage.objects;
create policy "spot-photos: suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'spot-photos'
    and (select public.is_member())
    and (
      owner_id = (select auth.uid())::text
      or (select public.is_admin())
      or exists (select 1 from public.spots s
                 where s.id::text = (storage.foldername(name))[1]
                   and s.created_by = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- 7. Temps réel : diffusion des changements (filtrés par RLS)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spots') then
    alter publication supabase_realtime add table public.spots;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spot_photos') then
    alter publication supabase_realtime add table public.spot_photos;
  end if;
end;
$$;

-- =====================================================================
--  ÉTAPE SUIVANTE (une seule fois) : déclarez-vous administrateur en
--  exécutant, avec VOTRE email :
--
--    insert into public.members (email, role) values ('votre.email@exemple.fr', 'admin');
--
--  Ensuite, ajoutez vos collègues depuis l'application (menu ☰ > Membres).
-- =====================================================================
