# KingiMaster – Sales Team calling (MVP)

- `frontend/` – Next.js 15 (login via Supabase Auth, all data via the API)
- `backend/` – FastAPI + Postgres (Supabase-hosted), Africa's Talking Voice

## One-time setup

1. **Database**: in Supabase, run `backend/migrations/0001_init.sql` (SQL editor).
2. **Backend env**: copy `backend/.env.example` to `backend/.env` and fill it in.
3. **Frontend env**: copy `frontend/.env.example` to `frontend/.env` and fill it in.
4. **First admin**: create a user in Supabase (Authentication → Users → Add user, tick Auto confirm), then run in the SQL editor:
   `update profiles set role = 'admin' where id = '<user uuid>';`
   Agents are then created from Team Overview → Add agent.
5. **Backend dependencies** (first time only). Needs Python 3.11+ (`brew install python` on macOS):

   macOS / Linux:
   ```bash
   cd backend
   cp .env.example .env          # then fill it in
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
   Windows (PowerShell):
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
6. **Frontend dependencies** (first time only). Needs Node 20+ (`brew install node` on macOS):
   ```bash
   cd frontend
   cp .env.example .env          # then fill it in (macOS/Linux; on Windows use Copy-Item)
   npm install
   ```

## Run both servers (two terminals)

**Terminal 1: backend (API on http://localhost:8000)**

macOS / Linux:
```bash
cd backend
source .venv/bin/activate
python run.py
```
Windows (PowerShell):
```powershell
cd backend
.venv\Scripts\activate
python run.py
```
`python run.py` works on every OS. On Windows use it instead of plain `uvicorn`, which breaks the Postgres driver. For auto-reload: `RELOAD=1 python run.py` (macOS/Linux) or `$env:RELOAD="1"; python run.py` (PowerShell).
Check it works: open http://localhost:8000/health (should show `{"ok":true}`). API docs: http://localhost:8000/docs.

**Terminal 2: frontend (app on http://localhost:3000)**
```bash
cd frontend
npm run dev
```
Open http://localhost:3000 and sign in. Restart `npm run dev` after changing `frontend/.env`, and restart the backend after changing `backend/.env`.

## Production (Render)

- Backend: root `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Frontend: root `frontend`, build `npm install && npm run build`, start `npm start`.
- Set the same variables as the `.env.example` files in each service's Environment tab. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy the frontend after changing them. Set the backend's `CORS_ORIGINS` to the frontend URL.

## Africa's Talking

Set the Voice callback URL to `https://<api-host>/at/voice?secret=<AT_WEBHOOK_SECRET>`. It must be a public URL; locally, use a tunnel such as `ngrok http 8000`.

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
