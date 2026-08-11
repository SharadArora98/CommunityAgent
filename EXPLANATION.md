# Move-In / Move-Out Agentic Workflow — Explanation Document

## 1. Problem Interpretation

Move-in and move-out are compliance-sensitive intake processes: a resident must supply a specific, community-defined set of information and documents, and an admin must verify that set before granting or denying the request. Two things make this a good fit for an *agentic* workflow rather than a static form:

- **The required information differs per community** and will keep changing — a form-per-community would not scale.
- **The intake conversation benefits from guidance**: residents shouldn't have to guess what's needed or fill out a wall of fields with no context; they should be walked through it one question at a time, exactly the way a helpful leasing-office employee would.

The counter-consideration is that the actual **compliance decision** (accept/reject) is a real accountability action with consequences for the resident and legal exposure for the community — that should stay a human decision, with AI in an assistive role. That split (AI drives the conversational intake; AI assists but does not decide on approval) is the central design choice in this prototype, detailed in §4.

## 2. Experience Design

### Resident journey (`/resident`)

1. **Select a community** from a dropdown (the assignment's specified minimal UI — no signup/login).
2. **Chat opens** with a greeting and one question: *"Are you looking to move in or move out?"* — intent detection, not a menu, per the assignment's "use natural language" guidance.
3. **One field at a time.** The agent asks for exactly one piece of information per turn, drawn from that community's configured field list for the detected flow. It validates the answer's format before accepting it; on an invalid or off-topic reply, it re-asks the *same* field with a specific reason, rather than guessing or skipping ahead. This directly implements the user's own instruction: *"act like a state machine, don't go out of context, don't assume."*
4. **Recap & confirm.** Once every required field is collected, the agent recaps all answers and asks for confirmation. The resident can request a change to a specific field (e.g. "change unit number"), which drops the state machine back into `COLLECTING` at that field.
5. **Submit.** Confirming sets status to `pending` and triggers one silent, automatic admin-assist review (§4) cached on the request.
6. **Follow-up.** The resident can return to `/resident` any time (session persists by request ID) and ask about their status; once an admin has decided, the agent reports the outcome and any note.

The right-hand **Requirements Panel** mirrors the state machine in the UI: it lists every required field for the resident's flow, marks each collected (✓), in-progress (…), or pending (○), and shows the request's status once submitted — so residents always know what's needed and what's left, without reading it out of the chat transcript.

### Admin journey (`/admin`)

1. **Select a community** — this doubles as "logging in as that community's admin," matching the assignment's instruction to keep the UI to two simple routes and not add auth infrastructure that wasn't asked for.
2. **See the queue**: a filterable list (pending/approved/rejected/all) of requests, each showing type, resident name/unit, and a color-coded **agent recommendation chip** (`approve` / `review` / `reject`) so the admin can prioritize at a glance.
3. **Open a request** to see every submitted answer labeled against the community's requirements, plus the agent's full assessment: missing fields (should be none by the time a request reaches `pending`, but checked defensively), flagged issues (e.g. a move-in date in the past, or a "No" on a move-out condition acknowledgement), and a one-line rationale.
4. **Accept or Reject**, with an optional note back to the resident. This is the one action in the whole system that only a human can take — the UI does not offer any "auto-approve" shortcut.

## 3. Architecture

```
web/  (React + Vite, routes: /resident, /admin)
   -> fetch /api/*  (Vite dev proxy -> :4000)

server/ (Express, :4000)
   routes/communities.js        GET  /api/communities
   routes/residentRequests.js   POST /api/requests
                                 GET  /api/requests/:id
                                 POST /api/requests/:id/message
   routes/adminRequests.js      GET  /api/admin/communities/:id/requests
                                 GET  /api/admin/requests/:id
                                 POST /api/admin/requests/:id/decision

   stateMachine.js   <- the only place that mutates a request's conversational state
   store.js          <- JSON file read/write (data/communities.json, data/requests.json)
   agents/
     llmClient.js     Gemini wrapper, returns null on any failure/missing key
     intentAgent.js    uses llmClient, falls back to keyword matching
     fieldAgent.js      uses llmClient for extraction, always re-validates with regex/format rules
     reviewAgent.js      uses llmClient only for the rationale sentence; the recommendation itself is rule-based
```

**Data model** (`server/src/data/communities.json`, `requests.json`):

- **Community**: `{ id, name, admin: {id, name}, flows: { move_in: [Field...], move_out: [Field...] } }`
- **Field**: `{ key, label, prompt, inputType: text|date|number|select|file, options?, required }`
- **Request**: `{ id, communityId, type, state, currentFieldIndex, answers, status: draft|pending|approved|rejected, agentReview, history, createdAt, submittedAt, decidedAt, decisionNote }`

Two states live on a request: `state` (where the *conversation* is: `INTENT → COLLECTING → REVIEWING → SUBMITTED → DECIDED`) and `status` (where the *request* is for admin purposes: `draft → pending → approved|rejected`). Keeping these separate meant the admin-facing status model didn't have to grow conversational states, and vice versa.

## 4. Agent Design

Three narrowly-scoped agents, each with an explicit, limited responsibility — deliberately *not* one big autonomous agent with broad tool access, so its behavior stays predictable and auditable:

| Agent | Reads | Writes | Autonomy |
|---|---|---|---|
| **Intent Agent** | resident's opening message | `request.type` only | Classifies move_in / move_out / unclear; on `unclear` it re-asks (capped at 2 attempts) rather than guessing. |
| **Field Agent** | one field's config + resident's message | `request.answers[currentField.key]` only | Extracts a value from natural phrasing (LLM-assisted) but **always** re-validates the result against a deterministic format rule (date regex, number regex, option match) before accepting it. Invalid → reprompt, state does not advance. |
| **Review Agent** | one submitted request + its community's required fields | `request.agentReview` (a recommendation, not a decision) | Read-only. Produces `{complete, missingFields, flaggedIssues, recommendation, rationale}`. Never sets `status`. |

**Inference approach**: `agents/llmClient.js` wraps Google Gemini (`GEMINI_API_KEY`) and asks for strict JSON responses. Every call site treats a `null`/failed response as expected, not exceptional, and falls back to deterministic logic (keyword lists for intent, regex/format rules for field validation, a rule table for compliance flags). This means:
- The LLM adds real value where it's suited to it — interpreting free-form phrasing ("I'll be moving in mid-September, 9/15" → normalized date; "I want to move out"/"vacating" → intent) and writing a readable rationale sentence for the admin.
- The LLM is **never the sole authority** on anything that gates state transitions or the admin recommendation — those are deterministic and testable independent of any API key, which is also why the whole prototype runs with zero setup.

**Where AI guides vs. decides vs. acts** (the assignment's explicit ask):
- *Acts autonomously*: advancing the resident conversation state, extracting/normalizing field values, running the completeness check on submission.
- *Recommends, does not decide*: the admin-assist review. It states a recommendation and why, but the accept/reject action is a separate, explicit human step — the API enforces this by having only `POST /admin/requests/:id/decision` (a human-triggered route) mutate `status`.
- *Guides, does not assume*: on ambiguous or invalid input, the agent always re-asks rather than filling in a best guess — this was an explicit constraint from the assignment.

## 5. Scalability Strategy

**What's configurable** (no code changes needed): everything in `communities.json` — a community's name, its admin, and the complete ordered field list (label, prompt, input type, options, required) for each flow. Adding a new community, or changing what Community X requires for move-out, is a JSON edit. The two seeded communities (Cedar Heights: lease agreement + vehicle info; Palm Residency: deposit receipt + pet declaration) intentionally have different field sets and counts to prove the state machine, chat prompts, requirements panel, and admin review all adapt without touching `stateMachine.js`, `fieldAgent.js`, or any React component.

**What's core logic** (shared, not duplicated per community): the state machine's transition rules, the field validation-by-type rules, the review agent's rule table, and every route/component. This is the boundary the assignment asks for explicitly — "what's configurable, what belongs in core logic."

**How it evolves**: new input types (e.g. a multi-select, a numeric range) are added once in `fieldAgent.js`'s `validateFormat` and immediately available to every community. New per-community *policies* (e.g. "communities that don't allow pets should flag pet_declaration=Yes as `reject` not `review`") would be the natural next config knob — currently `reviewAgent.js`'s flag rules are global; making them a small per-community rules list is a straightforward, additive change (see §9).

## 6. Assumptions

- **No auth system.** The community dropdown stands in for both resident identity and admin login, per the assignment's instruction to keep scope to "2 routes... simplify APIs... don't add extra features." Production would need real resident and admin accounts.
- **Documents are referenced, not uploaded.** "File" fields accept a typed filename/reference rather than a binary upload+storage pipeline, since the assignment is about the *workflow*, not document storage infrastructure.
- **One resident per request, one active request per link.** There's no handling for a resident having multiple simultaneous requests to the same community; the browser holds the current `request.id`, not a resident account with a request history.
- **JSON-file persistence is single-writer.** Fine for a prototype; not safe for concurrent multi-instance writes.
- **The review agent's rule table is illustrative** (past move-in date, negative move-out acknowledgements, pet declarations) — a real system would source these rules from each community's actual policy documents.

## 7. Testing & Results

Testing was done at the API layer (an end-to-end scripted walkthrough) plus a production `vite build` to catch any compile/type issues in the React code:

- **Happy path**: full move-in conversation for Cedar Heights (6 fields, all valid) → clean recap → submit → agent recommends `approve` → admin approves with a note → resident sees the approval on their next message.
- **Validation/reprompt**: a move-out conversation where the date field was answered with "next tuesday" (not `YYYY-MM-DD`) — the agent rejected it in place with a specific reason and re-asked the same field without advancing; the next, valid answer proceeded normally.
- **Flagged-for-review path**: a move-out request where the resident answered "No" to the key-return acknowledgement — the review agent correctly flagged it and recommended `review` (not `approve`), and the admin rejected it with a note, which the resident then saw.
- **Config-driven behavior**: verified the two seeded communities produce genuinely different question sequences and requirement checklists from the same code paths.
- **No-API-key path**: the entire above was run with no `GEMINI_API_KEY` set, confirming the rule-based fallback alone is sufficient for a fully working demo (`GET /api/health` reports `llmAvailable: false` in that mode).

**Not done**: interactive browser click-through. This prototype was built and verified in a headless/background environment without a connected browser-automation tool, so UI verification stopped at a successful production build plus the dev server serving the page — the resident/admin click-flow itself should be spot-checked once in a real browser before treating this as demo-ready (`npm run dev` in both `server/` and `web/`, then visit `/resident` and `/admin`).

## 8. Limitations & Trade-offs

- **Single-field-per-turn intake** is simple and matches the "don't assume" instruction, but it's slower than letting a resident state several answers in one message (e.g. "I'm Rahul, moving into B-204 on 9/1"). A production version could let the field agent opportunistically fill multiple upcoming fields from one message while still confirming each.
- **The review agent's flagged-issue rules are hardcoded field-key checks** (`move_in_date`, `clearance_ack`, etc.), not fully data-driven — a community with entirely custom field keys wouldn't get any flags, only the baseline completeness check. This was a deliberate scope cut to keep the prototype small rather than build a general per-community rules engine.
- **No retry/backoff on Gemini calls** — a single failure for a given turn falls back to rules for that turn only (not cached as "LLM is down" for the rest of the session), which is simple and safe but means every call pays the same latency/failure risk independently.
- **JSON file storage** has no transactions, migrations, or indexing — fine at prototype scale, not for production request volume.

## 9. Failure Recovery

- **LLM unavailable or errors** (no key, network failure, malformed JSON): every agent call site treats this as an expected `null` and falls back to deterministic logic; the resident/admin never see an error because of it.
- **Invalid resident input**: handled in-state as a re-prompt (§2), not an error — the state machine never advances on invalid data, so a resident can't accidentally submit an incomplete/malformed request.
- **Double-decision race** (two admin tabs deciding the same request): `POST /admin/requests/:id/decision` checks `status === 'pending'` and returns `409` otherwise, so a second decision attempt is rejected rather than silently overwriting the first.
- **Server restart**: requests persist to `data/requests.json` on every write, so an in-progress conversation survives a backend restart (the frontend just re-fetches by `request.id`).

## 10. Production Considerations / Next Steps

To take this from prototype to production:

1. **Real auth** for both residents (account + request history) and admins (per-community role, audit log of who decided what).
2. **Actual document upload** (object storage + virus scan + retention policy) instead of filename references.
3. **A real database** (e.g. Postgres) instead of JSON files, with the same `Community`/`Request` shape, to support concurrency, querying, and audit trails.
4. **Per-community compliance rules as data**, not hardcoded field-key checks in `reviewAgent.js` — e.g. a small rules DSL per community (`{field: "pet_declaration", equals: "Yes", flag: "..."}`) so new policies don't require code changes, extending the same configurability principle already used for required fields.
5. **Notifications** (email/SMS/push) on state changes (submitted, decided) instead of chat-only polling.
6. **Observability**: log every LLM call (prompt, response, fallback-triggered or not) for auditing agent behavior on compliance-adjacent decisions.
7. **Rate limiting / abuse handling** on the resident chat endpoint before exposing it publicly.
8. **Hosting**: the backend and frontend are independently deployable (e.g. backend on Render/Fly, frontend on Vercel, with `VITE`-time or runtime API base URL config replacing the dev-only Vite proxy).
