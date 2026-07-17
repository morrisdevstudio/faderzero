# Deploiement PWA Android via Tailscale

Objectif: garder le developpement local confortable sur le poste de dev, tout en deployant automatiquement une version "reelle" de la PWA sur un serveur de test, installable depuis Chrome Android.

## Architecture cible

- Le poste de dev sert a coder et lancer `npm run dev`.
- Le serveur de test heberge la version de test reel.
- Un conteneur `tailscale/tailscale` tourne sur le serveur de test.
- Un conteneur `caddy` sert la PWA localement sur `127.0.0.1:8080`.
- Caddy reverse-proxy aussi Supabase via `/supabase/*` vers `127.0.0.1:54321`.
- Tailscale Serve publie `http://127.0.0.1:8080` en HTTPS prive sur une URL `*.ts.net`.

Cette separation evite deux problemes:

1. le cycle de dev local reste rapide;
2. la PWA Android ne tombe pas en mixed content, car l'app et Supabase passent tous deux en HTTPS du point de vue du telephone.

## 1. Variables d'environnement de deploiement

Creer `pwa/.env.deploy.local` en partant de `pwa/.env.deploy.example`.

Exemple:

```env
VITE_SUPABASE_URL=https://faderzero-server.your-tailnet.ts.net/supabase
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Important:

- `VITE_SUPABASE_URL` doit etre en `https://...ts.net/supabase`
- il ne doit pas pointer vers une URL Supabase en `http://...`, sinon Chrome Android bloquera les requetes

Le script `npm run build:deploy` utilise automatiquement ce mode `deploy`.

## 2. Etat actuel du serveur de test

Le setup actuellement en place est le suivant:

- SSH via un compte de deploiement dedie
- Docker disponible sur ce compte
- conteneur `faderzero-caddy`
- conteneur `faderzero-tailscale`
- release active dans un dossier `current` cote serveur
- URL privee finale: URL Tailscale HTTPS de votre tailnet

Si tu veux recreer ou verifier l'arborescence cible:

```bash
mkdir -p /path/to/faderzero-pwa/releases
```

Les fichiers utilises cote serveur sont:

- `pwa/deploy/Caddyfile`
- `pwa/deploy/docker-compose.remote.yml`

Pour redemarrer le serveur web:

```bash
docker compose -f /path/to/docker-compose.remote.yml up -d --force-recreate
```

Verifier ensuite que l'app repond bien en local:

```bash
curl http://127.0.0.1:8080/
```

## 3. Publication HTTPS privee via Tailscale

La publication active est:

```bash
https://your-server.your-tailnet.ts.net/
```

La commande utile pour verifier `serve` dans le conteneur Tailscale:

```bash
docker exec faderzero-tailscale tailscale --socket=/tmp/tailscaled.sock serve status
```

Si tu dois le reactiver manuellement:

```bash
docker exec faderzero-tailscale tailscale --socket=/tmp/tailscaled.sock serve --bg --yes 8080
```

Cette URL doit etre la meme que celle utilisee dans `pwa/.env.deploy.local` pour `VITE_SUPABASE_URL`, avec le suffixe `/supabase`.

## 4. Deploiement depuis ce PC

Scripts disponibles:

- `npm run deploy:test` : build `deploy` puis copie `dist` sur le serveur de test
- `npm run deploy:test:watch` : surveille les changements utiles et redeploie automatiquement

Le deploiement:

- lance `npm run build:deploy`
- archive `dist`
- envoie l'archive en SSH sur le serveur de test
- cree une release horodatee
- bascule le lien `current` sur la nouvelle release

Variables optionnelles pour adapter le script sans modifier le code:

```powershell
$env:FADERZERO_DEPLOY_HOST = "your-server-or-ip"
$env:FADERZERO_DEPLOY_USER = "your-deploy-user"
$env:FADERZERO_DEPLOY_BASE_DIR = "/path/to/faderzero-pwa"
```

## 5. Workflow recommande

Pour coder:

```bash
cd pwa
npm run dev
```

Pour un redeploiement manuel sur le serveur:

```bash
cd pwa
npm run deploy:test
```

Pour pousser automatiquement chaque changement pertinent:

```bash
cd pwa
npm run deploy:test:watch
```

Pour tester sur Android:

1. Ouvrir votre URL Tailscale HTTPS dans Chrome Android
2. Se connecter si besoin
3. Verifier que les appels Supabase passent bien
4. Installer l'application depuis le menu Chrome

## 6. Notes de securite

- Ce montage n'expose pas ton serveur au web public tant que tu utilises `Tailscale Serve` et non `Tailscale Funnel`.
- Le serveur web local peut rester lie a `127.0.0.1`.
- N'active ni `Exit Node` ni `Subnet Router` pour ce besoin.
- Le deploiement automatique pousse uniquement les fichiers statiques de `dist`, pas tout le depot.
