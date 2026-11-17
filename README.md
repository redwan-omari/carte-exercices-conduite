# Carte des exercices de conduite

Carte collaborative (PWA mobile) pour repérer les lieux d'exercices de conduite : créneau, bataille, épi, démarrage en côte, giratoires, etc.
Chaque collègue se connecte avec son propre compte, ajoute un lieu avec le GPS de son téléphone (et des photos), et **les points apparaissent immédiatement chez tout le monde**.

- **Adresse :** https://redwan-omari.github.io/carte-exercices-conduite/
- **Frontend :** React + Vite + TypeScript + Leaflet (photos aériennes et plan IGN), installable en PWA, hébergé sur GitHub Pages (site statique)
- **Backend :** Supabase (authentification, base Postgres + RLS, stockage des photos, temps réel)

> Ce dépôt est **totalement indépendant** de `carte-poitiers` : dépôt séparé, workflow séparé, projet Supabase séparé. Rien ici ne touche à l'autre site.

---

## Fonctionnalités

- Connexion par email + mot de passe, création de compte, mot de passe oublié.
- Accès réservé aux **membres autorisés** (liste blanche d'emails gérée par les administrateurs dans l'application).
- Ajout d'un lieu à la position GPS (le repère suit le GPS jusqu'à ce que vous le déplaciez ; touchez la carte pour l'ajuster), avec indicateur de précision.
- Type d'exercice, description, photos (appareil photo ou galerie, compressées sur le téléphone avant envoi).
- Synchronisation **temps réel** : ajouts, modifications, suppressions et photos des collègues apparaissent sans recharger.
- Filtres par type d'exercice, vue liste triée par distance, recherche.
- Itinéraire (Apple Plans sur iPhone, Google Maps ailleurs), partage d'un lieu.
- Modification / suppression par l'auteur ou un administrateur.
- Installable sur l'écran d'accueil (PWA) ; les tuiles de carte consultées restent disponibles hors ligne.

---

## Mise en place (une seule fois, ~20 minutes)

### 1. Créer le projet Supabase

1. Sur https://supabase.com, créez un **nouveau projet** (par ex. `carte-exercices-conduite`), région **Europe (Paris – eu-west-3)** de préférence.
2. Ouvrez **SQL Editor → New query**, collez le contenu de [`supabase/migrations/20261109000000_init.sql`](supabase/migrations/20261109000000_init.sql) et cliquez sur **Run**.
   Cela crée les tables, les règles RLS, le bucket privé `spot-photos` et active le temps réel.
   Exécutez ensuite, de la même façon, [`supabase/migrations/20261116000000_sessions.sql`](supabase/migrations/20261116000000_sessions.sql) (sessions de membres + liste des comptes en attente).
   Pour vérifier : exécutez [`supabase/verification.sql`](supabase/verification.sql) dans une nouvelle requête — chaque ligne doit afficher `OK` (la ligne « Administrateur(s) » passe à `OK` après l'étape 4).
3. **Créez votre propre compte** sur le site (étape 5) _ou_ dans **Authentication → Users → Add user** (cochez *Auto Confirm User*).
4. Déclarez-vous **administrateur** : dans **SQL Editor**, exécutez avec **votre** email :

   ```sql
   insert into public.members (email, role) values ('votre.email@exemple.fr', 'admin');
   ```

   (L'ordre n'a pas d'importance : vous pouvez exécuter cette ligne avant ou après la création du compte.)

### 2. Configurer l'authentification Supabase

Dans **Authentication → URL Configuration** :

| Champ | Valeur |
|---|---|
| Site URL | `https://redwan-omari.github.io/carte-exercices-conduite/` |
| Redirect URLs | `https://redwan-omari.github.io/carte-exercices-conduite/` et `http://localhost:5173/carte-exercices-conduite/` |

Dans **Authentication → Sign In / Providers → Email** : laissez **Confirm email activé**. C'est indispensable : l'accès n'est accordé qu'à un email **confirmé**, ce qui empêche quelqu'un de s'inscrire avec l'adresse d'un collègue.

> **Envoi d'emails :** le serveur email intégré de Supabase est limité à quelques emails par heure et sert aux tests. Pour une équipe, deux options :
> - configurer un SMTP (Brevo, Resend, Gmail…) dans **Authentication → Emails → SMTP Settings** ;
> - ou créer les comptes vous-même : **Authentication → Users → Add user** avec *Auto Confirm User*, puis communiquer le mot de passe initial (chacun pourra le changer via « Mot de passe oublié »).

### 3. Récupérer les clés publiques

**Project Settings → API Keys** (ou **API**) :

- **Project URL** → `VITE_SUPABASE_URL`
- **Publishable key** (`sb_publishable_…`) _ou_ l'ancienne clé **anon** → `VITE_SUPABASE_PUBLISHABLE_KEY`

> ⚠️ N'utilisez **jamais** la clé `service_role` ni une *secret key* (`sb_secret_…`). Le site refuse de démarrer et le workflow échoue si une clé secrète est détectée.
> La clé publique est faite pour être visible dans le navigateur : la protection des données repose sur les règles RLS.

### 4. Créer le dépôt GitHub

1. Sur https://github.com/new : nom **`carte-exercices-conduite`**, propriétaire `redwan-omari`, visibilité **Public** (requis pour GitHub Pages sur un compte gratuit — aucun secret n'est dans le code). Ne cochez ni README ni .gitignore.
2. Dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**, créez :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Settings → Pages → Build and deployment → Source : GitHub Actions**.

### 5. Publier

Depuis ce dossier :

```bash
git init -b main
git add .
git commit -m "Carte des exercices de conduite"
git remote add origin https://github.com/redwan-omari/carte-exercices-conduite.git
git push -u origin main
```

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compile et publie le site (onglet **Actions**, ~1 min).
Ensuite, **chaque `git push` sur `main` redéploie automatiquement**.

Ouvrez https://redwan-omari.github.io/carte-exercices-conduite/ sur votre téléphone, connectez-vous : c'est prêt.

---

## Gérer les membres et les sessions

Réservé aux administrateurs : bouton **👥 Membres** à côté de la photo de profil (une pastille rouge indique les comptes en attente).

- **En attente** : toutes les personnes qui ont créé un compte mais ne sont pas encore autorisées. Choisissez leur session puis **Autoriser** : l'accès est immédiat.
- **Membres** : tous les membres, regroupés par session (changer de session ou de rôle, retirer l'accès). Vous pouvez aussi autoriser une adresse email à l'avance.
- **Sessions** : groupes dont **vous choisissez le nom** (« Promo septembre 2026 », « Stage été »…). Désactiver une session coupe l'accès de tous ses membres en une fois ; la réactiver le rétablit. Les administrateurs gardent toujours leur accès, et un membre « sans session » a un accès permanent (ex. formateurs). Une session ne peut être supprimée que lorsqu'elle est vide.

Pour inviter quelqu'un : envoyez-lui le lien (Mon compte → **Partager le lien de l'application**) ; il crée son compte, apparaît dans **En attente**, vous l'autorisez.

**Installer sur le téléphone :** iPhone → Safari → bouton Partager → « Sur l'écran d'accueil ». Android → Chrome propose « Installer l'application » (ou via le menu Mon compte).

---

## Sécurité

| Qui | Lieux & photos | Liste des membres |
|---|---|---|
| Visiteur non connecté | ❌ aucun accès | ❌ |
| Compte non autorisé ou email non confirmé | ❌ aucun accès | ❌ |
| Membre | voir tout, ajouter ; modifier / supprimer **ses** lieux et photos (et les photos posées sur ses lieux) | voir |
| Administrateur | tout | ajouter / retirer / changer de rôle (le dernier admin ne peut pas être retiré) |

- Toutes les règles sont appliquées côté base de données (RLS Postgres), pas seulement dans l'interface.
- Les photos sont dans un bucket **privé** ; elles s'affichent via des URL signées temporaires.
- Le temps réel Supabase respecte les mêmes règles RLS.
- Seule la clé publique est embarquée dans le site.

---

## Développement local

```bash
cp .env.example .env.local   # puis renseignez l'URL et la clé publique
npm install
npm run dev                  # http://localhost:5173/carte-exercices-conduite/
```

Tester le build de production avec le chemin GitHub Pages :

```bash
npm run build && npm run preview   # http://localhost:4173/carte-exercices-conduite/
```

### Tester sur un vrai téléphone (GPS + appareil photo) avant de publier

Le GPS n'est autorisé par les navigateurs que sur une adresse HTTPS. Ce mode lance un serveur HTTPS local (certificat de test) accessible depuis votre Wi-Fi :

```bash
npm run dev:phone
```

1. Le téléphone et le Mac doivent être sur **le même Wi-Fi**. Si macOS demande d'autoriser les connexions entrantes pour « node », acceptez.
2. Dans le terminal, repérez la ligne `Network: https://<adresse-du-mac>:5173/carte-exercices-conduite/` (par ex. `https://192.168.1.20:5173/…`) et ouvrez cette adresse sur le téléphone (en **https**).
3. Le téléphone affiche un avertissement de sécurité (certificat de test, c'est normal) :
   - **iPhone (Safari)** : « Afficher les détails » → « visiter ce site web » → confirmer ;
   - **Android (Chrome)** : « Paramètres avancés » → « Continuer vers le site ».
4. Connectez-vous, appuyez sur **Ajouter un lieu** et autorisez la localisation.

Notes :
- Utilisez un compte déjà créé (inscription ou « mot de passe oublié » depuis l'ordinateur) : les liens envoyés par email pointent vers `localhost` ou le site publié, pas vers l'adresse Wi-Fi.
- Les lieux créés pendant ces tests sont réels (même projet Supabase que le site publié) : supprimez-les ensuite depuis l'application.
- Ce mode sert uniquement aux tests : il n'est jamais utilisé par le build ni par GitHub Pages.

### Personnaliser

- **Types d'exercices :** [`src/lib/categories.ts`](src/lib/categories.ts) (aucune modification SQL nécessaire).
- **Centre de la carte :** `DEFAULT_CENTER` dans [`src/lib/geo.ts`](src/lib/geo.ts) — 1625 route de Sandillon, 45560 Saint-Denis-en-Val.
- **Nom du dépôt / chemin :** si vous renommez le dépôt, changez `BASE` dans [`vite.config.ts`](vite.config.ts), les liens d'icônes dans [`index.html`](index.html) et les URL de redirection Supabase.
- **Icônes :** modifiez `public/favicon.svg` puis `npm run generate-icons`.

---

## Dépannage

| Problème | Solution |
|---|---|
| Page blanche « Configuration manquante » | Secrets GitHub absents ou mal nommés → vérifiez l'étape 4.2 puis relancez le workflow (Actions → Run workflow). |
| « Accès en attente » | L'email n'est pas dans la liste des membres, ou n'est pas confirmé. |
| Le lien de confirmation renvoie vers `localhost` | Corrigez **Site URL** et **Redirect URLs** (étape 2). |
| « Trop de tentatives » à l'inscription | Limite d'emails de Supabase → configurez un SMTP ou créez les comptes manuellement. |
| La position ne se met pas à jour | Autorisez la localisation pour le site (iPhone : Réglages → Confidentialité → Service de localisation → Safari). |
| Les points des autres n'apparaissent pas en direct | Le point vert à côté du titre indique la connexion temps réel. Vérifiez que la dernière section de la migration (publication `supabase_realtime`) a bien été exécutée. |
| Ancienne version affichée après un déploiement | La PWA se met à jour automatiquement ; fermez et rouvrez l'application. |
