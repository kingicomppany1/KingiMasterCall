import math
import re
from datetime import datetime, timezone
from xml.sax.saxutils import quoteattr

from fastapi import APIRouter, HTTPException, Request, Response

from ..config import settings
from ..db import execute, fetch_one
from psycopg.types.json import Jsonb

router = APIRouter(prefix="/at")


def xml(body: str) -> Response:
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><Response>{body}</Response>', media_type="application/xml")


def dial(number: str) -> str:
    return (
        f"<Dial phoneNumbers={quoteattr(number)} callerId={quoteattr(settings.at_phone_number)} "
        f'record="false" maxDuration="{settings.at_max_call_seconds}"/>'
    )


@router.post("/voice")
async def voice(request: Request, secret: str = ""):
    """
    Africa's Talking voice callback: https://<api-host>/at/voice?secret=<AT_WEBHOOK_SECRET>
    isActive=1  -> call starting: resolve the number from the server-made call_session, answer <Dial>.
    isActive=0  -> call ended: write duration/cost/answered. This is the only writer of call_logs.
    """
    if not settings.at_webhook_secret or secret != settings.at_webhook_secret:
        raise HTTPException(403, "Forbidden")
    p = {k: str(v) for k, v in (await request.form()).items()}
    provider_id = p.get("sessionId")
    if not provider_id:
        raise HTTPException(400, "Bad request")

    if p.get("isActive") == "1":
        existing = await fetch_one("select number from call_logs where provider_session_id = %s", (provider_id,))
        if existing:  # AT retry
            return xml(dial(existing["number"]))
        s = await fetch_one("select * from call_sessions where id::text = %s", (p.get("clientDialedNumber", ""),))
        caller = p.get("callerNumber", "")
        if (
            not s
            or s["provider_session_id"]
            or s["expires_at"] < datetime.now(timezone.utc)
            or (caller and str(s["agent_id"]) not in caller)
        ):
            return xml("<Reject/>")
        await execute("update call_sessions set provider_session_id = %s where id = %s", (provider_id, s["id"]))
        await execute(
            """insert into call_logs (session_id, provider_session_id, agent_id, contact_id, number, raw)
               values (%s,%s,%s,%s,%s,%s) on conflict (provider_session_id) do nothing""",
            (s["id"], provider_id, s["agent_id"], s["contact_id"], s["dialed_number"], Jsonb(p)),
        )
        return xml(dial(s["dialed_number"]))

    # call ended
    try:
        duration = int(p.get("durationInSeconds", "0") or 0)
    except ValueError:
        duration = 0
    m = re.search(r"[\d.]+", p.get("amount", ""))
    cost = float(m.group()) if m else 0.0
    if not cost and duration > 0:
        cost = math.ceil(duration / 60) * settings.at_rate_ngn_per_min

    row = await fetch_one(
        """update call_logs set ended_at = now(), duration_sec = %s, answered = %s, cost_ngn = %s,
               hangup_cause = %s, state = %s, raw = %s
           where provider_session_id = %s returning contact_id""",
        (duration, duration > 0, cost, p.get("hangupCause"), p.get("callSessionState"), Jsonb(p), provider_id),
    )
    if row and row["contact_id"]:
        await execute(
            "update contacts set call_attempts = call_attempts + 1, last_called_at = now() where id = %s",
            (row["contact_id"],),
        )
    return Response("ok")
