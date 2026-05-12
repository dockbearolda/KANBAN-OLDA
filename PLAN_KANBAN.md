# PLAN KANBAN — Refonte légère et fluide

## Vue d'ensemble

**Objectif :** remplacer ton Kanban actuel (trop lourd, buggy) par une app ultra-rapide, fluide, déployable sur Railway, avec édition style Google Sheets.

**Stack retenue :**
- **Frontend :** React 18 + Vite + TailwindCSS + `@dnd-kit/core` (drag & drop léger)
- **Backend :** Node.js + Express + `better-sqlite3` (synchrone, ultra-rapide)
- **DB :** SQLite (fichier persistant sur Railway volume)
- **Déploiement :** Railway en single container (front buildé + servi par Express)
- **Pas de framework lourd** : pas de Next.js, pas de Redux, pas d'ORM. État local + fetch.

**Choix utilisateur validés :**
- Liste clients vide au démarrage (remplie via l'interface)
- 3 utilisateurs fixes : **L**, **C**, **M** (sélection d'initiale en arrivant, pas de login)
- Colonnes identiques à l'actuel :
  - `DEMANDE` → `DEVIS EN COURS` → `DEVIS ACCEPTÉ` → `PRODUCTION` → `FACTURATION`
  - Sous-catégories Production : **DTF / PRESSAGE / ROLAND UV / TROTEC / AUTRES**
- Édition inline style Google Sheets (clic dans la case = on tape, Tab/Entrée pour valider)
- Modal sous-catégorie quand on glisse une carte dans Production

---

## Architecture cible

```
kanban/
├── server/
│   ├── index.js          # Express + API REST
│   ├── db.js             # better-sqlite3 init + migrations
│   └── data.db           # SQLite (volume Railway)
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Board.jsx          # le kanban
│   │   │   ├── Column.jsx
│   │   │   ├── Card.jsx           # carte commande (édition inline)
│   │   │   ├── NewOrderRow.jsx    # ligne style Google Sheets
│   │   │   ├── ProductionPicker.jsx  # modal DTF/PRESSAGE/...
│   │   │   ├── ClientsPanel.jsx   # CRUD clients
│   │   │   └── UserBadge.jsx      # pastilles L/C/M
│   │   ├── api.js                 # fetch wrappers
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── package.json          # scripts: dev, build, start
├── railway.json
└── README.md
```

### Schéma DB

```sql
clients (id, name, email, phone, company, notes, created_at)
orders  (id, client_id, title, qty, product, note, status, prod_subcat,
         urgent, due_date, assignees, position, created_at, updated_at)
```

`status` ∈ {`demande`,`devis_en_cours`,`devis_accepte`,`production`,`facturation`}
`prod_subcat` ∈ {`dtf`,`pressage`,`roland_uv`,`trotec`,`autres`} (null sauf si status=production)
`assignees` = string CSV ex: "L,C"

### API REST

```
GET    /api/orders
POST   /api/orders                {client_id?, title, qty, product, note}
PATCH  /api/orders/:id            (n'importe quel champ — édition inline)
DELETE /api/orders/:id
POST   /api/orders/:id/move       {status, prod_subcat?, position}

GET    /api/clients
POST   /api/clients
PATCH  /api/clients/:id
DELETE /api/clients/:id
```

---

## Comment utiliser ce plan avec Claude Code

Ouvre un terminal, va dans un dossier vide pour ton projet, lance `claude` puis copie-colle les prompts **un par un dans l'ordre**. Attends qu'un prompt soit complet avant de lancer le suivant. À la fin du Prompt 7 tu auras une app fonctionnelle déployable.

---

# === PROMPTS À ENVOYER À CLAUDE CODE ===

---

## 🟦 PROMPT 1 — Initialisation du projet

```
Initialise un projet Kanban dans le dossier courant avec cette structure :

- Monorepo simple : dossier server/ pour Express+SQLite, dossier client/ pour React+Vite+Tailwind
- package.json racine avec workspaces ET scripts :
    "dev"   : lance server (port 3001) et client (port 5173) en parallèle (utilise concurrently)
    "build" : build le client Vite dans server/public
    "start" : lance uniquement node server (sert l'API + les fichiers statiques de server/public)
- server/ : Express, better-sqlite3, cors, sert client buildé en prod
- client/ : Vite + React 18 + Tailwind + @dnd-kit/core + @dnd-kit/sortable
- .gitignore complet (node_modules, *.db, dist, .env)
- railway.json minimal qui lance "npm run build && npm run start"
- README.md court avec commandes dev/build/deploy

Ne crée aucune logique métier encore, juste la structure + dépendances installées + un endpoint /api/health qui répond {ok:true} pour vérifier que tout marche. Le client doit afficher juste "Kanban prêt" pour valider le pipeline.

À la fin, lance "npm run dev" et vérifie que les deux serveurs démarrent sans erreur.
```

---

## 🟦 PROMPT 2 — Base de données et API

```
Dans server/, crée :

1. server/db.js : initialise better-sqlite3 sur ./data.db, crée les tables si absentes :

   CREATE TABLE IF NOT EXISTS clients (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     email TEXT,
     phone TEXT,
     company TEXT,
     notes TEXT,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE IF NOT EXISTS orders (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
     title TEXT NOT NULL DEFAULT '',
     qty INTEGER DEFAULT 1,
     product TEXT DEFAULT '',
     note TEXT DEFAULT '',
     status TEXT NOT NULL DEFAULT 'demande',
     prod_subcat TEXT,
     urgent INTEGER DEFAULT 0,
     due_date TEXT,
     assignees TEXT DEFAULT '',
     position REAL DEFAULT 0,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT DEFAULT CURRENT_TIMESTAMP
   );

   Active WAL mode pour la perf : db.pragma('journal_mode = WAL');
   Crée des index sur orders(status) et orders(prod_subcat).

2. server/index.js : route REST complète :
   - GET    /api/orders                 (toutes, triées par position)
   - POST   /api/orders                 (crée, retourne l'objet)
   - PATCH  /api/orders/:id             (update partiel ; met à jour updated_at)
   - DELETE /api/orders/:id
   - POST   /api/orders/:id/move        body {status, prod_subcat, position}
   - GET/POST/PATCH/DELETE /api/clients (idem clients)

   Utilise des prepared statements pour TOUT (perf+sécu).
   Validation simple des champs (status doit être dans la whitelist).
   Renvoie JSON, gère les erreurs 400/404/500 proprement.

3. Position management : quand on déplace une carte, recalcule sa position comme la moyenne des positions adjacentes (technique LexoRank simplifiée). Si pas de voisin, position = (max position du même status) + 1000.

Teste chaque endpoint avec curl avant de passer au prompt suivant.
```

---

## 🟦 PROMPT 3 — Sélection utilisateur + structure UI

```
Dans client/src/ :

1. Crée un store ultra-simple (useState dans App ou un petit context) qui retient l'utilisateur courant parmi ['L','C','M']. Persiste-le dans localStorage sous la clé "kanban_user".

2. Si aucun utilisateur n'est sélectionné, affiche un écran d'accueil plein écran avec 3 gros boutons ronds "L", "C", "M". Au clic, on rentre dans l'app.

3. Layout principal une fois connecté :
   - Header fin : logo "Production", recherche (input désactivé pour l'instant), pastille de l'utilisateur courant (avec menu pour switch), bouton "+ Nouvelle commande" en haut à droite, icône "Clients" (ouvre le panneau clients).
   - Sous le header : le board horizontal scrollable.

4. Style Tailwind clean, fond #FAF7F2 (crème très clair comme sur le screen actuel), cards blanches arrondies xl, ombre légère, typo Inter (charge via Google Fonts).

5. Définis dans un fichier constants.js :
   const COLUMNS = [
     { id:'demande',        label:'DEMANDE' },
     { id:'devis_en_cours', label:'DEVIS EN COURS' },
     { id:'devis_accepte',  label:'DEVIS ACCEPTÉ' },
     { id:'production',     label:'PRODUCTION', sub:['dtf','pressage','roland_uv','trotec','autres'] },
     { id:'facturation',    label:'FACTURATION' },
   ];
   const SUBCATS = {
     dtf:'DTF', pressage:'PRESSAGE', roland_uv:'ROLAND UV',
     trotec:'TROTEC', autres:'AUTRES'
   };
   const USERS = ['L','C','M'];

Aucune donnée mockée pour l'instant — on branche l'API au prompt suivant.
```

---

## 🟦 PROMPT 4 — Board + cartes (lecture + édition inline Google Sheets)

```
Construis le board et les cartes :

1. client/src/api.js : wrappers fetch (getOrders, createOrder, updateOrder, deleteOrder, moveOrder, get/create/update/deleteClient). Tout passe par /api en relatif (vite proxy en dev vers :3001).

2. Vite config : proxy "/api" → "http://localhost:3001" en dev.

3. Composant Board :
   - Charge les orders au mount.
   - Affiche 5 colonnes horizontalement, scroll horizontal si besoin.
   - La colonne PRODUCTION affiche les 5 sous-sections (DTF / PRESSAGE / ROLAND UV / TROTEC / AUTRES) chacune avec son label en petit gris au-dessus de sa pile de cartes.
   - Chaque colonne affiche un compteur du nombre de cartes en haut à droite du label.

4. Composant Card (carte commande) :
   - Affichage : titre (= client ou nom commande), ligne "qty × product", note grise, pastilles assignees (L/C/M), date d'échéance si présente, badge "Urgent" rouge si urgent=1, badge "DTF/PRESSAGE/..." si en production.
   - **ÉDITION INLINE STYLE GOOGLE SHEETS** : chaque champ texte est cliquable → devient un input/textarea sur place. Tab passe au champ suivant. Entrée valide. Esc annule. Blur valide.
   - À chaque modification : PATCH /api/orders/:id en optimistic update (UI updated avant la réponse serveur, rollback si erreur).
   - Click sur les pastilles L/C/M = toggle de l'assignee.
   - Click sur le badge urgent = toggle.
   - Bouton "..." discret en haut à droite ouvre un mini-menu : Supprimer.

5. Ligne "+ Ajouter" en bas de chaque colonne : un clic crée immédiatement une carte vide dans ce statut, le focus va sur le titre, on tape, Tab pour passer aux autres champs, Entrée pour valider et créer la suivante. Vraie expérience Google Sheets.

Performance : debounce le PATCH à 300ms pour ne pas spammer le serveur quand on tape.

À la fin de ce prompt, on doit pouvoir créer/éditer/supprimer des commandes uniquement au clavier, sans aucune modale.
```

---

## 🟦 PROMPT 5 — Drag & drop + sélecteur sous-catégorie Production

```
Ajoute le drag & drop avec @dnd-kit :

1. Toutes les cartes sont draggables (DnDContext + SortableContext par colonne ET par sous-section Production).
2. Drop dans une colonne autre que PRODUCTION : POST /api/orders/:id/move avec le nouveau status + position.
3. Drop dans la colonne PRODUCTION (zone globale) MAIS sans cibler de sous-section :
   → ouvre une modale "Où envoyer cette commande ?" avec 5 gros boutons :
     [ DTF ] [ PRESSAGE ] [ ROLAND UV ] [ TROTEC ] [ AUTRES ]
   → au clic, move avec status='production' + prod_subcat choisi. Esc/clic en dehors = annule le drop.
4. Drop directement dans une sous-section précise : move direct sans modale.
5. Drop optimiste : la carte se déplace visuellement avant la réponse serveur. Rollback en cas d'erreur.

Modale style propre :
- Overlay semi-transparent flou (backdrop-blur-sm)
- Centrée, max-w-md, p-6, fond blanc, ombre xl, rounded-2xl
- Titre clair en haut, 5 boutons en grille 2x3 (1 case vide), gros, faciles à cliquer
- Animation d'entrée légère (scale + fade, 150ms)

Aucun bug : si tu drop sur une zone invalide → la carte revient à sa position d'origine.
```

---

## 🟦 PROMPT 6 — Panneau clients

```
Construis le panneau Clients :

1. Bouton "Clients" dans le header ouvre un drawer/sheet latéral qui glisse depuis la droite (largeur 480px max, animation 200ms).

2. Liste des clients :
   - Vide au démarrage avec un message "Aucun client. Ajoute le premier ↓"
   - Champ de recherche en haut (filtre par nom/société).
   - Une ligne par client : nom (en gras), société, email/phone en plus petit gris.
   - Click sur une ligne = passe en édition inline (mêmes mécaniques Google Sheets que les cartes : Tab entre champs, Entrée valide).
   - Bouton "+ Nouveau client" en bas qui ajoute une ligne vide focus sur le nom.

3. Champs client : name (obligatoire), company, email, phone, notes (textarea).

4. Suppression : icône poubelle qui apparaît au hover, confirmation simple (window.confirm OK pour rester léger).

5. Sur une carte de commande : le champ "titre" propose en autocomplete les noms de clients existants quand on tape (datalist HTML natif suffit, zéro lib). Si on choisit un client existant → la carte stocke client_id en plus du titre.

6. Important : tout passe par l'API REST avec optimistic update + debounce 300ms.

Tests rapides : créer 3 clients, les éditer, en supprimer un, puis vérifier que l'autocomplete dans une nouvelle commande propose bien les noms.
```

---

## 🟦 PROMPT 7 — Polish, optimisation Railway, déploiement

```
Finitions et préparation Railway :

1. PERF FRONT :
   - Vérifie qu'aucune lib lourde n'est dans le bundle (analyse avec `vite build --report`).
   - Lazy-load le panneau Clients (React.lazy).
   - Memoize les Card avec React.memo, useCallback pour les handlers.
   - Virtualisation NON nécessaire à cette échelle, ne l'ajoute pas.

2. PERF BACK :
   - Cache HTTP : ajoute "ETag" sur GET /api/orders et /api/clients.
   - Gzip via compression middleware Express.
   - Helmet pour les headers de sécurité de base.
   - Rate limit léger (express-rate-limit) : 300 req/min/IP sur les routes /api.

3. DB sur Railway :
   - Le fichier data.db doit être sur un volume persistant Railway.
   - Crée un dossier server/data/ et place data.db dedans.
   - Dans railway.json (ou via dashboard Railway) : monte un volume sur /app/server/data.
   - Au boot, si data.db n'existe pas, le créer avec les migrations.

4. SCRIPTS package.json racine :
   - "build" : cd client && npm install && npm run build && cd .. && cp -r client/dist server/public
   - "start" : cd server && node index.js (sert API + /public)
   - "dev"   : concurrently

5. PORT : Express écoute sur process.env.PORT || 3001 (Railway impose la variable PORT).

6. Health check : GET /api/health → {ok:true, version, uptime}.

7. ENV : zéro variable secrète obligatoire pour fonctionner. Optionnel : BASIC_AUTH_PASS pour ajouter une protection ultra-simple plus tard.

8. Crée un fichier DEPLOY.md avec les étapes Railway :
   - Push le repo sur GitHub
   - "New project" → "Deploy from GitHub repo" sur Railway
   - Ajouter un volume monté sur /app/server/data
   - Build command : npm install && npm run build
   - Start command : npm run start
   - Variable PORT laissée auto

9. Lancement final : npm run dev, je veux pouvoir cliquer-éditer-déplacer 20 cartes sans aucun lag, sans aucune erreur console.

Liste-moi à la fin tout ce qui pourrait encore être amélioré (typage TS, tests, websockets pour le multi-utilisateur temps réel, etc.) mais NE LES IMPLÉMENTE PAS — on veut une V1 stable et minimale.
```

---

## 🟦 PROMPT 8 (optionnel, à faire plus tard) — Synchronisation temps réel multi-utilisateurs

```
Ajoute du temps réel léger sans complexifier :
- Polling intelligent : GET /api/orders avec If-None-Match (ETag) toutes les 5 secondes.
- Si la réponse est 304, rien ne bouge ; sinon merge intelligent (préserver l'édition locale en cours).
- Indicateur discret en haut à droite "Synchronisé il y a Xs".
- Pas de WebSockets, pas de Socket.io — surcoût pas justifié à 3 utilisateurs.
```

---

# Récap des choix d'optimisation

| Choix | Raison |
|---|---|
| **SQLite + WAL** | Lectures concurrentes, zéro latence, parfait jusqu'à 100 cartes/jour |
| **better-sqlite3 (synchrone)** | 5–10× plus rapide que sqlite3 async pour ce volume |
| **Vite + React 18** | Build < 200 KB gzip, démarrage instantané |
| **@dnd-kit** | 10 KB vs react-beautiful-dnd (50 KB+) et maintenu |
| **Édition inline (zéro modale)** | UX type Google Sheets demandée par ton patron |
| **Optimistic updates + debounce 300 ms** | Frappe fluide, pas de spinner |
| **Pas d'ORM** | Prepared statements directs = perf max, code lisible |
| **Single container Railway** | Express sert API + statique, un seul déploiement |
| **Polling avec ETag (V2)** | Multi-utilisateurs simple, sans WebSocket |

---

# Ordre conseillé

1. Lance Prompt 1 → vérifie que `npm run dev` marche.
2. Prompt 2 → teste avec curl.
3. Prompt 3 → écran sélection L/C/M visible.
4. Prompt 4 → tu peux déjà créer/éditer/supprimer des commandes au clavier.
5. Prompt 5 → drag & drop + modale sous-catégorie Production.
6. Prompt 6 → panneau clients fonctionnel.
7. Prompt 7 → déploiement Railway.
8. (Plus tard) Prompt 8 → temps réel.

Compte ~30 min par prompt avec Claude Code, soit environ 3–4 h pour la V1 complète déployée.
