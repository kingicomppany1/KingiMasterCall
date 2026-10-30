from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import current_user, require_agent
from ..config import settings
from ..db import execute, fetch_one, pool
from ..util import OUTCOME_EFFECT, OUTCOMES, normalize_phone, spend

router = APIRouter(prefix="/calls")


class StartBody(BaseModel):
    contact_id: str
    kind: str  # 'phone' | 'switchboard'


async def _last_ended_without_outcome(agent_id) -> dict | None:
    return await fetch_one(
        """
        select * from (
          select l.id, l.number, l.duration_sec, l.answered, l.contact_id,
                 exists(select 1 from call_outcomes o where o.call_log_id = l.id) as has_outcome
          from call_logs l
          where l.agent_id = %s and l.ended_at is not null
          order by l.started_at desc limit 1
        ) t where not has_outcome
        """,
        (agent_id,),
    )


@router.post("/start")
async def start(body: StartBody, me: dict = Depends(require_agent)):
    """The ONLY way to start a call. The number comes from the DB, never from the client."""
    if not me["active"]:
        raise HTTPException(403, "Your calling is switched off. Contact your head of sales.")
    if body.kind not in ("phone", "switchboard"):
        raise HTTPException(400, "Bad request")

    contact = await fetch_one(
        """
        select c.id, c.phone, c.switchboard
        from contacts c join company_assignments a on a.company_key = c.company_key
        where c.id = %s and a.agent_id = %s
        """,
        (body.contact_id, me["id"]),
    )
    if not contact:
        raise HTTPException(403, "This contact is not in your call list")
    number = normalize_phone(contact[body.kind])
    if not number:
        raise HTTPException(400, "No valid number stored for this contact")

    if await _last_ended_without_outcome(me["id"]):
        raise HTTPException(409, "Record the outcome of your previous call first")

    sp = await spend(me["id"])
    if sp["day"] >= float(me["daily_cap_ngn"]):
        raise HTTPException(403, "Daily call budget reached")
    if sp["month"] >= float(me["monthly_cap_ngn"]):
        raise HTTPException(403, "Monthly call budget reached")

    session = await fetch_one(
        "insert into call_sessions (agent_id, contact_id, dialed_number) values (%s,%s,%s) returning id",
        (me["id"], contact["id"], number),
    )

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.post(
            "https://webrtc.africastalking.com/capability-token/request",
            headers={"apiKey": settings.at_api_key},
            json={
                "username": settings.at_username,
                "clientName": str(me["id"]),
                "phoneNumber": settings.at_phone_number,
                "incoming": False,
                "outgoing": True,
                "lifeTimeSec": 300,
            },
        )
    if r.status_code != 200 and r.status_code != 201:
        raise HTTPException(502, "Calling provider unavailable")
    return {"session_id": str(session["id"]), "token": r.json()["token"]}


@router.get("/pending")
async def pending(me: dict = Depends(current_user)):
    row = await _last_ended_without_outcome(me["id"])
    if not row:
        return {"pending": None}
    return {"pending": {**row, "id": str(row["id"]), "contact_id": str(row["contact_id"]) if row["contact_id"] else None}}


class OutcomeBody(BaseModel):
    call_log_id: str
    outcome: str
    callback_at: datetime | None = None
    notes: str | None = None


@router.post("/outcome")
async def outcome(body: OutcomeBody, me: dict = Depends(require_agent)):
    if body.outcome not in OUTCOMES:
        raise HTTPException(400, "Outcome required")
    if body.outcome == "call_back" and not body.callback_at:
        raise HTTPException(400, "Pick a call-back date")

    log = await fetch_one(
        "select id, agent_id, contact_id, ended_at from call_logs where id = %s", (body.call_log_id,)
    )
    if not log or log["agent_id"] != me["id"]:
        raise HTTPException(403, "Not your call")
    if not log["ended_at"]:
        raise HTTPException(409, "Call has not ended yet")

    status, stop_seq = OUTCOME_EFFECT[body.outcome]
    cb = body.callback_at if body.outcome == "call_back" else None
    async with pool.connection() as conn:
        async with conn.transaction():
            cur = await conn.execute(
                """insert into call_outcomes (call_log_id, agent_id, outcome, callback_at, notes)
                   values (%s,%s,%s,%s,%s) on conflict do nothing""",
                (log["id"], me["id"], body.outcome, cb, (body.notes or "")[:2000] or None),
            )
            if cur.rowcount == 0:
                raise HTTPException(409, "Outcome already recorded")
            if log["contact_id"]:
                # Link to outreach: interested / meeting / deal -> status 'yes', email sequence stops
                await conn.execute(
                    """update contacts set status = %s, callback_at = %s,
                       email_sequence_active = email_sequence_active and not %s
                       where id = %s""",
                    (status, cb, stop_seq, log["contact_id"]),
                )
    return {"ok": True}
