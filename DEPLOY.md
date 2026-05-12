# Déploiement Railway

Stack : Node (Express) qui sert l'API **et** le bundle Vite statique, plus une base SQLite (`better-sqlite3`) stockée sur un volume persistant Railway.

---

## 1. Pousser le repo sur GitHub

```bash
git init                         # si pas déjà fait
git add -A && git commit -m "init"
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

## 2. Créer le projet Railway

1. Aller sur https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Sélectionner le repo. Railway détecte Nixpacks automatiquement.
3. Le fichier [railway.json](railway.json) à la racine fournit déjà :
   - `buildCommand : npm install && npm run build`
   - `startCommand : npm run start`
   - `healthcheckPath : /api/health`

Si Railway demande, override manuellement avec les mêmes valeurs.

## 3. Ajouter un volume persistant (CRUCIAL)

La base SQLite vit dans `server/data/data.db`. Sans volume, **chaque redéploiement Railway efface la DB**.

1. Dans le service Railway → onglet **Settings** → **Volumes** → **+ New Volume**.
2. Mount path : `/app/server/data`
3. Taille : 1 Go (largement suffisant pour démarrer).
4. Save → redéployer.

Au premier boot, le code (`server/src/db.js`) crée le dossier s'il manque et applique le schéma SQL (`CREATE TABLE IF NOT EXISTS …`). Aucune migration manuelle nécessaire.

## 4. Variables d'environnement

**`BASIC_AUTH_PASS` est obligatoire en prod** (sinon n'importe qui sur Internet peut lire/écrire). Tout le reste a un défaut sain.

| Variable           | Défaut                            | Pour quoi                                                       |
|--------------------|-----------------------------------|-----------------------------------------------------------------|
| `PORT`             | injecté par Railway (sinon 3001)  | Port d'écoute Express + Socket.io.                              |
| `DB_DIR`           | `server/data`                     | Override du dossier DB si besoin (le volume tape déjà au bon endroit). |
| `DB_PATH`          | `<DB_DIR>/data.db`                | Override complet du chemin du fichier.                          |
| `BASIC_AUTH_PASS`  | (vide → auth désactivée)          | Mot de passe partagé HTTP Basic. À définir en prod. Chrome affiche le prompt natif au premier accès et le retient pour la session. Protège aussi le handshake Socket.io. |
| `ALLOWED_ORIGINS`  | (vide → localhost en dev)         | Liste CSV des origines cross-origin autorisées. En prod same-origin (la SPA est servie par le serveur), ce n'est utile que si tu veux exposer l'API à un autre domaine. |

### Configurer `BASIC_AUTH_PASS` sur Railway

1. Service → onglet **Variables** → **+ New Variable**.
2. Name: `BASIC_AUTH_PASS`. Value: un mot de passe long (générer avec `openssl rand -base64 24`).
3. Save → Railway redéploie automatiquement.
4. À l'ouverture de l'app, Chrome affiche un prompt « Le site demande de s'identifier » : laisser le nom d'utilisateur vide ou mettre n'importe quoi, coller le mot de passe. Chrome retient pour la session.

## 5. Vérifier le déploiement

Une fois le build vert :

- `GET https://<app>.up.railway.app/api/health` → `{ ok: true, version, uptime }`
- L'UI doit se charger sur `https://<app>.up.railway.app/`
- Tester création/édition/déplacement d'une carte : le rechargement doit conserver l'état (= volume OK).

## 6. Logs et redémarrages

- Logs en direct : onglet **Deployments** → **View Logs**.
- Politique de redémarrage : `ON_FAILURE`, 10 tentatives (déjà configuré).

## 7. Mises à jour

`git push` sur la branche connectée → Railway rebuild automatiquement. Le volume reste monté entre les déploiements, donc la DB est préservée.

---

## Annexe — Lancer en local

```bash
npm install               # installe racine + workspaces (server + client)
npm run dev               # API sur :3001, Vite sur :5173 (proxy /api → :3001)
```

Pour reproduire le binaire prod en local :

```bash
npm run build             # bundle client → server/public/
npm run start             # Express sert /api + statique
```
