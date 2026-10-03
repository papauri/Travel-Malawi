# Build and Run

How to install, run, check, build and deploy Travel Malawi.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 22 or newer (tested on 24) |
| npm | Comes with Node |
| Firebase CLI | Installed as a dev dependency (`npx firebase`) |

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Where it is used | Required |
| --- | --- | --- |
| `VITE_CLOUDINARY_CLOUD_NAME` | Browser image uploads | Yes |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Browser image uploads | Yes |
| `GEMINI_API_KEY` | Server, Ulendo concierge (primary) | Recommended |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY` | Server, fallback AI providers | Optional |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a Firebase service-account JSON for admin scripts | Only for `scripts/` |

Notes:

- AI keys are read by the server only. Never prefix an AI key with `VITE_`, because Vite ships `VITE_*` values to the browser.
- AI keys can also be set in Admin Dashboard > AI Settings.
- `.env*` files and service-account JSON files are git-ignored. Do not commit them.
- Firebase web config lives in `firebase-applet-config.json`.

## 3. Run in development

```bash
npm run dev
```

Starts `server.ts` with `tsx`. Express serves the API under `/api/*` and mounts Vite as middleware, so the app and API share one origin at http://localhost:3000.

## 4. Check before committing

```bash
npm run lint                         # TypeScript type check (tsc --noEmit)
npm run check:validation             # Booking and room validation checks
npx tsx scripts/swarm-flow-check.ts  # Booking, availability, roles, currency, docs, AI pacing checks
```

All three must pass before pushing to `main`.

## 5. Production build

```bash
npm run build
```

This runs two steps:

1. `vite build` writes the frontend and PWA service worker to `dist/`.
2. `esbuild` bundles `server.ts` into `dist/server.cjs` (CommonJS, packages kept external).

Start the built app:

```bash
NODE_ENV=production npm start
```

On Windows PowerShell: `$env:NODE_ENV='production'; npm start`.

`NODE_ENV=production` is required. Without it, `npm start` boots Vite in development mode instead of serving `dist/`.

In production the server serves `dist/` as static files and falls back to `index.html` for client routes. Port 3000.

## 6. Firebase rules

Firestore uses a named database (see `firebase.json`). Deploy rules after changing `firestore.rules` or `storage.rules`:

```bash
npx firebase deploy --only firestore:rules,storage
```

## 7. Data scripts

Need `GOOGLE_APPLICATION_CREDENTIALS`. Run with care against production.

| Command | Purpose |
| --- | --- |
| `npm run data:inspect` | Print a summary of Firestore data |
| `npm run data:seed-accounts` | Create test guest, manager and admin accounts |
| `npm run data:seed-restaurants` | Seed restaurant data |
| `npm run data:repair` | Fix known data inconsistencies |
| `npm run data:provision-storage` | Set up storage buckets and CORS |

## 8. Guides

Partner and admin guides live in `server/docs/` as a Markdown source plus an HTML copy, and in `src/pages/` as in-app pages. Admins edit them in Admin Dashboard > Docs. All guides use the same plain theme: neutral greys, system font, single column, no colour accents.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `429 Too Many Requests` from Gemini | Free tier allows 15 requests per minute. The server queue waits 4 seconds between calls; wait and retry, or add a fallback provider key. |
| Port 3000 in use | Stop the other process, or change `PORT` in `server.ts`. |
| Blank page after deploy | Clear the old service worker: browser DevTools > Application > Service Workers > Unregister. |
| `Permission denied` from Firestore | Rules not deployed, or the user's role is missing. Check `firestore.rules` and the `users` document. |
