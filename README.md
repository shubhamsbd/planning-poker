# Sprint Planning Poker

Real-time planning poker for agile teams. Built with **React + Vite + TypeScript + Tailwind** and **Vercel Serverless Functions** (SSE + REST).

Standalone project at `Workspace/planning-poker` (sibling to other repos like `tbd`).

## Features

- Create or join a room with a shareable code
- Real-time participant list and vote status
- Fibonacci deck: `0, ½, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
- Facilitator controls: reveal votes, start next round, close room
- Vote statistics (average, min, max) after reveal

## Quick start (local)

```bash
cd planning-poker
npm install
npm install --prefix client
npm run dev
```

- App: http://localhost:5174
- API (local dev server): http://localhost:3000/api

Open the app in two browser tabs to simulate a team session. Local dev uses a lightweight Express server (`scripts/dev-server.ts`) — no Vercel CLI login required.

## Project structure

```
planning-poker/
├── api/      # Vercel serverless routes (4 functions: health, create, join, [roomId]/[action])
├── client/   # Vite React frontend
├── lib/      # Shared room logic
├── vercel.json
└── package.json
```

## Deploy to Vercel

1. Push this repo to GitHub (or connect your local project).
2. Import the project in [Vercel](https://vercel.com/new).
3. Use the defaults from `vercel.json` (no extra build settings required).
4. Deploy.

The frontend and API are served from the same Vercel project — no separate backend host is needed.

## Environment

| Variable | Default | Where |
| -------- | ------- | ----- |
| `VITE_API_URL` | `` (same origin) | client — set only if the API is on another origin |

In local dev, leave `VITE_API_URL` empty; Vite proxies `/api` to the local dev server on port 3000.
