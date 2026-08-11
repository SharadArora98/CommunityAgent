# ANACITY Move-In / Move-Out Agentic Workflow — Prototype

A state-driven agentic workflow for resident move-in/move-out requests and admin review, built for the ANACITY SDE3 assignment.

See [`EXPLANATION.md`](./EXPLANATION.md) for the full design write-up (experience, architecture, agent design, assumptions, scalability, testing, limitations, production considerations).

## Stack

- **Backend**: Node.js + Express, JSON-file persistence (no DB)
- **Frontend**: React (Vite), 2 routes only — `/resident`, `/admin`
- **AI**: Google Gemini (`GEMINI_API_KEY`) for intent detection, natural-language field extraction, and admin-review rationale — with a deterministic rule-based fallback, so the app runs fully **even with no API key**.

## Prerequisites

- Node.js 18+ (tested on Node 24)

## Setup & Run

Two servers, run in two terminals.

### 1. Backend (port 4000)

```bash
cd server
npm install
cp .env.example .env   # optional: add GEMINI_API_KEY to enable real LLM inference
npm run dev
```

### 2. Frontend (port 5173)

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173**. `/resident` and `/admin` are the two routes; the Vite dev server proxies `/api/*` to the backend on port 4000.

Without a `GEMINI_API_KEY`, the app runs entirely on rule-based logic (keyword intent matching, regex/format validation, rule-scored completeness checks) — no functionality is lost, only the natural-language flexibility of intent/field extraction is reduced. `GET /api/health` reports whether the LLM is active (`{"llmAvailable": true|false}`).

## Trying it out

1. Go to `/resident`, pick a community (**Cedar Heights** or **Palm Residency** — each has a different required-document set, to demonstrate config-driven scalability), and tell the chat you want to move in or move out.
2. Answer each question as it's asked — the right-hand checklist fills in live. Invalid input (e.g. a non-`YYYY-MM-DD` date) is rejected in place with guidance, without skipping ahead.
3. Confirm the recap to submit. The request now shows "pending".
4. Go to `/admin`, pick the same community (this doubles as the admin's "login," per the assignment's minimal-scope instruction), open the request, and see the agent's completeness/compliance recommendation — then Accept or Reject with an optional note.
5. Back on `/resident`, send any message to see the admin's decision appear in the chat.

## Project layout

```
server/
  src/
    data/communities.json   # per-community config: admin + required fields for each flow
    data/requests.json      # runtime request store (JSON "DB")
    store.js                # read/write + query helpers
    stateMachine.js          # the resident conversation state machine
    agents/
      llmClient.js            # Gemini wrapper with rule-based fallback
      intentAgent.js           # move_in vs move_out classification
      fieldAgent.js             # per-field extraction + validation
      reviewAgent.js            # admin-assist completeness/compliance recommendation
    routes/                   # Express routes (communities, resident requests, admin requests)
web/
  src/
    pages/ResidentPage.jsx, AdminPage.jsx
    components/ChatWindow.jsx, RequirementsPanel.jsx, RequestList.jsx, RequestDetail.jsx
    api.js                    # fetch helpers
```

## Deployment

The backend persists request/message history to `server/src/data/requests.json` on local disk. Whether that survives a redeploy depends entirely on the host — see the general options below, then the concrete Render steps this repo is currently set up for.

### Render (current target)

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) defining two free-tier services: `anacity-backend` (Node web service) and `anacity-frontend` (static site).

**Known limitation on the free tier**: Render's free plan has no persistent disk. The backend's filesystem resets on every redeploy and likely on every idle spin-down/wake cycle (free services sleep after ~15 min of inactivity), so `requests.json` goes back to `[]` at those points. This is a deliberate trade-off for a zero-cost deploy — see the "Render / Railway / Fly.io" section below for how to add a persistent disk later if you upgrade to a paid instance type.

Steps:
1. Push this repo to GitHub if you haven't (`origin` is already set to `SharadArora98/CommunityAgent`).
2. In the Render dashboard: **New +** → **Blueprint** → connect the `CommunityAgent` repo. Render will detect `render.yaml` and propose both services.
3. Before deploying, it will prompt for the two `sync: false` secrets:
   - `anacity-backend` → `GEMINI_API_KEY` (optional — leave blank and the app still runs on rule-based fallback logic, `GET /api/health` will report `llmAvailable: false`)
   - `anacity-frontend` → `VITE_API_BASE_URL` — leave this blank for the first deploy (the backend's URL doesn't exist yet).
4. Deploy. Once `anacity-backend` is live, copy its URL (e.g. `https://anacity-backend.onrender.com`).
5. Go to `anacity-frontend` → Environment, set `VITE_API_BASE_URL` to `<backend-url>/api` (e.g. `https://anacity-backend.onrender.com/api`), then trigger a manual redeploy of just the frontend (env vars only take effect on the next build, since Vite bakes them in at build time).
6. Visit the frontend's Render URL, `/resident` and `/admin` are the two routes.

To add persistence later (paid plan required — see below), add a `disk:` block under `anacity-backend` in `render.yaml` and a `DATA_DIR` env var pointing at its mount path, then redeploy the Blueprint.

### Other hosts

- **A plain VPS** (or any host with a genuinely persistent disk): works with zero changes. Just keep the process running (e.g. `pm2 start src/index.js` or a systemd unit) and set `GEMINI_API_KEY`/`PORT` in the environment.
- **Render / Railway / Fly.io on a paid plan**: attach a persistent volume/disk to the service (Render: "Disks", requires a paid instance type; Railway: "Volumes"; Fly.io: `fly volumes create`), mount it somewhere (e.g. `/data`), and set `DATA_DIR=/data` in that service's environment variables. `server/src/store.js` reads `requests.json` from `DATA_DIR` (defaulting to `src/data/` for local dev) and creates it with `[]` on first boot if the volume is empty.
- **Frontend on any static host** (Vercel, Netlify, etc.): same `VITE_API_BASE_URL`-at-build-time approach as above.

Vercel serverless functions are **not** a good fit for the backend specifically: their filesystem is read-only outside `/tmp`, and `/tmp` doesn't persist across invocations, so this JSON-file store would lose all history. Vercel works fine for the *frontend* static build, paired with a backend hosted elsewhere per above.

See `EXPLANATION.md` for the fuller production-considerations discussion (real database, auth, document storage, etc.).
