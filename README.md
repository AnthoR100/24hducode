# 3026 Dashboard

Interface web (React + Vite) pour suivre l’exploration du jeu **3026**, avec une **API Express** qui fait proxy vers l’API officielle, persiste les données en **SQLite** (`better-sqlite3`), et un **bot** Node.js optionnel pour l’exploration automatique.

## Prérequis

- **Node.js** 18+ (LTS recommandé)
- **npm**

Sous **Windows**, `better-sqlite3` compile du code natif : si `npm install` échoue, installez les [Build Tools Visual C++](https://visualstudio.microsoft.com/visual-cpp-build-tools/) ou utilisez une version de Node pour laquelle des binaires précompilés existent.

## Installation (après un `git clone`)

```bash
cd 3026-dashboard
npm install
```

### Variables d’environnement

Copiez le fichier d’exemple et renseignez vos valeurs :

```bash
copy .env.example .env
```

Sous macOS / Linux : `cp .env.example .env`

| Variable | Rôle |
|----------|------|
| `PORT` | Port du serveur Express (défaut **4000**) |
| `GAME_API` | URL de base de l’API du jeu (proxy côté serveur) |
| `CODINGGAME_ID` | Token Codingame (lu par le serveur et exposé au front via `/config`) |

Fichiers ignorés par Git : `.env`, `3026.db` et fichiers auxiliaires SQLite (`*.db-shm`, `*.db-wal`).

### Bot (`bot.js`)

Le bot lit aussi `.env`. Champs utiles :

| Variable | Rôle |
|----------|------|
| `CODINGGAME_ID` | Obligatoire — envoyé en en-tête `codinggame-id` |
| `BOT_SERVER` | URL du **dashboard** (proxy), ex. `http://localhost:4000` ou un serveur distant. Sinon valeur par défaut dans le code. |
| `MOVE_DELAY` | Délai en ms entre les moves (défaut **500**) |

## Lancer le projet

### Mode développement

Démarre l’API sur le port défini par `PORT` (souvent **4000**) et Vite sur **http://localhost:3000** avec proxy `/game`, `/db`, `/config` vers l’API locale.

```bash
npm run dev
```

Ouvrir : **http://localhost:3000**

### Build + mode « production » locale

```bash
npm start
```

Construit le front (`dist/`) puis sert les fichiers statiques via Express. Accès selon votre `PORT` (ex. **http://localhost:4000**).

### Bot d’exploration

Le bot doit joindre le **même** serveur que celui qui proxy le jeu (souvent l’instance où tourne `server.js`).

```bash
npm run bot
```

## Scripts npm

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur Node + Vite (développement) |
| `npm run build` | Build Vite uniquement |
| `npm start` | Build + `node server.js --prod` |
| `npm run bot` | Lance `bot.js` |

## Structure (aperçu)

- `src/` — application React (dashboard)
- `server.js` — Express, SQLite, proxy `/game/*`, routes `/db/*`, `/config`
- `bot.js` — exploration automatique via l’API proxifiée
- `vite.config.js` — port dev **3000**, proxy vers le backend

## Dépannage rapide

- **CORS / 401** : vérifier `CODINGGAME_ID` dans `.env` et le rechargement du serveur après modification.
- **Base vide** : `3026.db` est créée au premier lancement du serveur ; elle reste locale et n’est pas versionnée.
