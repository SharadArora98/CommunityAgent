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

The backend persists request/message history to `server/src/data/requests.json` on local disk. Whether that survives a redeploy depends entirely on the host:

- **A plain VPS** (or any host with a genuinely persistent disk): works with zero changes. Just keep the process running (e.g. `pm2 start src/index.js` or a systemd unit) and set `GEMINI_API_KEY`/`PORT` in the environment.
- **Render / Railway / Fly.io**: these reset the container's local filesystem on every deploy and (on some plans) every restart — `requests.json` would silently go back to `[]` each time unless you attach a **persistent volume** and point the app at it:
  1. Add a persistent volume/disk to the service (Render: "Disks"; Railway: "Volumes"; Fly.io: `fly volumes create`) and mount it somewhere, e.g. `/data`.
  2. Set `DATA_DIR=/data` in that service's environment variables. `server/src/store.js` reads `requests.json` from `DATA_DIR` (defaulting to `src/data/` for local dev) and creates it with `[]` on first boot if the volume is empty.
- **Frontend**: `web/` is a static Vite build (`npm run build` → `dist/`) — deploy it to any static host (Vercel, Netlify, Render Static Site, etc.). Since the frontend and backend will be on different origins in this setup (unlike the local dev proxy), set `VITE_API_BASE_URL` at build time to the backend's public URL + `/api` (see `web/.env.example`). The backend's CORS is currently open (`cors()` with no origin restriction), so no backend change is needed for this.

Vercel serverless functions are **not** a good fit for the backend specifically: their filesystem is read-only outside `/tmp`, and `/tmp` doesn't persist across invocations, so this JSON-file store would lose all history. Vercel works fine for the *frontend* static build, paired with a backend hosted elsewhere per above.

See `EXPLANATION.md` for the fuller production-considerations discussion (real database, auth, document storage, etc.).
