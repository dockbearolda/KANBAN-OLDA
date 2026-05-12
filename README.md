# THE_KANBAN

A simple Kanban app: Express + SQLite backend, React + Vite + Tailwind frontend.

## Structure

```
.
├── server/   # Express + better-sqlite3 API (port 3002 in dev)
├── client/   # Vite + React + Tailwind + dnd-kit (port 5173 in dev)
└── package.json (workspaces)
```

## Commands

```bash
npm install      # install all workspaces
npm run dev      # run server (3001) + client (5173) in parallel
npm run build    # build the client into server/public
npm run start    # production: serve API + built client from server/
```

## Health check

`GET /api/health` → `{"ok":true}`

## Deploy (Railway)

`railway.json` runs `npm install && npm run build` at build time, then `npm run start`. The server serves both the API and the built static client from `server/public`.
