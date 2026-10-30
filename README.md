# KingiMaster – Sales Team calling (MVP)

- `frontend/` – Next.js 15 (login via Supabase Auth, all data via the API)
- `backend/` – FastAPI + Postgres (Supabase-hosted), Africa's Talking Voice

## Setup

1. **Database**: in Supabase, run `backend/migrations/0001_init.sql` (SQL editor).
2. **Backend**: `cd backend && cp .env.example .env` (fill in), then
   `.venv\Scripts\activate && uvicorn app.main:app --reload` (venv already created; else `python -m venv .venv && pip install -r requirements.txt`).
3. **Frontend**: `cd frontend && cp .env.example .env.local` (fill in), `npm run dev`.
4. **First admin**: create a user in Supabase Auth, then in SQL:
   `update profiles set role = 'admin' where id = '<user uuid>';`
   Agents are then created from Team Overview → Add agent.
5. **Africa's Talking**: set the Voice callback URL to
   `https://<api-host>/at/voice?secret=<AT_WEBHOOK_SECRET>` (needs a public URL; use a tunnel such as ngrok locally).

## How the "can't fake it" rules work

- Browser never sends a phone number. `POST /calls/start` takes a contact id; the server checks the contact belongs to the agent's assigned company, checks active flag, daily/monthly caps and that the previous call has an outcome, stores the number in `call_sessions`, and returns a WebRTC token + session id.
- The browser calls AT with the session id. AT hits `/at/voice`; the webhook looks up the number from `call_sessions` and replies `<Dial>`. Unknown/expired sessions get `<Reject/>`.
- `call_logs` is written only by that webhook (start + end with duration/cost). Agents have no endpoint to create or edit it.
- Outcomes: `Interested`, `Meeting booked`, `Deal closed`, `Not interested` set contact status and stop `email_sequence_active`.
- One agent per company: `company_assignments.company_key` is the primary key.

## Please verify against Africa's Talking (not confirmable from code)

- Whether WebRTC calls bill at ₦3 (SIP) or ₦15 (regular), international rates, and account/number verification time: ask AT support. Cost is read from the webhook `amount`, falling back to `AT_RATE_NGN_PER_MIN`.
- Exact callback field names (`clientDialedNumber`, `callerNumber`, `durationInSeconds`, `amount`) and the `africastalking-client` event names (`callaccepted`, `hangup`) should be checked in the AT sandbox with one test call.
- Budget caps stop *new* calls; a running call is limited by `AT_MAX_CALL_SECONDS`.

## Not built yet

Callbacks-due reminders beyond list ordering, real script editing, actual wiring to your existing outreach email sequencer (this app only flips `email_sequence_active` / `status` on `contacts`; point your sequencer at those columns or tell me its schema).
