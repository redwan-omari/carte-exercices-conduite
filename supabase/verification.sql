-- =====================================================================
--  Vérification après migration — à exécuter dans le SQL Editor.
--  Lecture seule : ne modifie rien.
--  Chaque ligne doit afficher « OK » (après les 2 migrations).
-- =====================================================================
select controle, resultat, case when ok then 'OK' else 'MANQUANT' end as statut
from (
  select 1 as n, 'Tables' as controle,
         string_agg(table_name, ', ' order by table_name) as resultat,
         count(*) = 5 as ok
  from information_schema.tables
  where table_schema = 'public' and table_name in ('members', 'profiles', 'spots', 'spot_photos', 'sessions')

  union all
  select 2, 'Fonctions',
         string_agg(routine_name, ', ' order by routine_name),
         count(*) = 5
  from information_schema.routines
  where routine_schema = 'public' and routine_name in ('my_role', 'is_member', 'is_admin', 'my_status', 'admin_list_accounts')

  union all
  select 3, 'RLS activé',
         string_agg(relname, ', ' order by relname),
         count(*) = 5
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity
    and relname in ('members', 'profiles', 'spots', 'spot_photos', 'sessions')

  union all
  select 4, 'Politiques RLS (tables)',
         count(*)::text || ' politiques',
         count(*) = 17
  from pg_policies
  where schemaname = 'public' and tablename in ('members', 'profiles', 'spots', 'spot_photos', 'sessions')

  union all
  select 5, 'Politiques photos (storage)',
         count(*)::text || ' politiques',
         count(*) = 3
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'spot-photos:%'

  union all
  select 6, 'Bucket photos privé',
         coalesce(string_agg(id || case when public then ' (PUBLIC !)' else ' (privé)' end, ', '), 'absent'),
         count(*) = 1 and not bool_or(public)
  from storage.buckets
  where id = 'spot-photos'

  union all
  select 7, 'Temps réel',
         coalesce(string_agg(tablename, ', ' order by tablename), 'aucune table'),
         count(*) = 2
  from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('spots', 'spot_photos')

  union all
  select 8, 'Trigger création de profil',
         coalesce(string_agg(tgname, ', '), 'absent'),
         count(*) = 1
  from pg_trigger
  where tgname = 'on_auth_user_created' and not tgisinternal

  union all
  select 9, 'Administrateur(s)',
         coalesce(string_agg(email, ', '), 'aucun — exécutez l''insert administrateur'),
         count(*) >= 1
  from public.members
  where role = 'admin'
) v
order by n;
