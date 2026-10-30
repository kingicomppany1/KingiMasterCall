from datetime import timedelta

from fastapi import APIRouter, Depends

from ..auth import current_user, require_agent
from ..db import fetch_all
from ..util import day_start, spend, summarize, week_start

router = APIRouter()


@router.get("/me")
async def me(me: dict = Depends(current_user)):
    return {"id": str(me["id"]), "full_name": me["full_name"], "role": me["role"], "active": me["active"]}


@router.get("/agent/dashboard")
async def dashboard(me: dict = Depends(require_agent)):
    end_today = day_start() + timedelta(days=1)
    contacts = await fetch_all(
        """
        select c.id, c.company, c.name, c.title, c.phone, c.switchboard, c.linkedin,
               c.status, c.callback_at, c.call_attempts
        from contacts c
        join company_assignments a on a.company_key = c.company_key
        where a.agent_id = %s
          and c.status in ('new','contacted','callback')
          and (c.status <> 'callback' or c.callback_at < %s)
        order by (c.status = 'callback') desc, c.call_attempts, c.company
        """,
        (me["id"], end_today),
    )
    logs = await fetch_all(
        """
        select l.id, l.duration_sec, l.answered, l.cost_ngn, l.started_at, l.ended_at, o.outcome::text as outcome
        from call_logs l left join call_outcomes o on o.call_log_id = l.id
        where l.agent_id = %s and l.started_at >= %s
        """,
        (me["id"], week_start()),
    )
    ds = day_start()
    today = [l for l in logs if l["started_at"] >= ds]
    sp = await spend(me["id"])
    return {
        "active": me["active"],
        "caps": {"daily": float(me["daily_cap_ngn"]), "monthly": float(me["monthly_cap_ngn"])},
        "spend": sp,
        "today": summarize(today),
        "week": summarize(logs),
        "contacts": [{**c, "id": str(c["id"])} for c in contacts],
    }
