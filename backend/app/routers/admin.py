import csv
import io
from datetime import date, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from ..auth import require_admin
from ..config import settings
from ..db import execute, fetch_all, fetch_one, pool
from ..util import LAGOS, OUTCOMES, month_start, normalize_phone, summarize

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


@router.get("/overview")
async def overview(date_: str | None = None):
    try:
        d = date.fromisoformat(date_) if date_ else datetime.now(LAGOS).date()
    except ValueError:
        raise HTTPException(400, "Bad date")
    start = datetime(d.year, d.month, d.day, tzinfo=LAGOS)
    end = start + timedelta(days=1)

    agents = await fetch_all("select * from profiles where role = 'sales_agent' order by full_name")
    logs = await fetch_all(
        """select l.id, l.agent_id, l.duration_sec, l.answered, l.cost_ngn, l.ended_at, o.outcome::text as outcome
           from call_logs l left join call_outcomes o on o.call_log_id = l.id
           where l.started_at >= %s and l.started_at < %s""",
        (start, end),
    )
    month = await fetch_all(
        "select agent_id, sum(cost_ngn) as spent from call_logs where started_at >= %s group by agent_id",
        (month_start(),),
    )
    spent = {m["agent_id"]: float(m["spent"]) for m in month}
    names = {a["id"]: a["full_name"] or str(a["id"])[:8] for a in agents}

    companies = await fetch_all(
        """select c.company_key as key, min(c.company) as name, count(*)::int as contacts, a.agent_id
           from contacts c left join company_assignments a on a.company_key = c.company_key
           group by c.company_key, a.agent_id order by min(c.company)"""
    )
    return {
        "date": d.isoformat(),
        "outcomes": OUTCOMES,
        "agents": [
            {
                "id": str(a["id"]),
                "name": names[a["id"]],
                "active": a["active"],
                "daily_cap": float(a["daily_cap_ngn"]),
                "monthly_cap": float(a["monthly_cap_ngn"]),
                "month_spend": spent.get(a["id"], 0.0),
                "day": summarize([l for l in logs if l["agent_id"] == a["id"]]),
            }
            for a in agents
        ],
        "companies": [
            {
                "key": c["key"],
                "name": c["name"],
                "contacts": c["contacts"],
                "owner": names.get(c["agent_id"]) if c["agent_id"] else None,
            }
            for c in companies
        ],
    }


class NewAgent(BaseModel):
    email: str
    password: str
    full_name: str = ""


@router.post("/agents")
async def create_agent(b: NewAgent):
    if len(b.password) < 8:
        raise HTTPException(400, "Password must be 8+ characters")
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            json={"email": b.email, "password": b.password, "email_confirm": True, "user_metadata": {"full_name": b.full_name}},
        )
    if r.status_code >= 300:
        raise HTTPException(400, r.json().get("msg") or r.json().get("message") or "Could not create user")
    return {"ok": True}


class AgentPatch(BaseModel):
    active: bool | None = None
    daily_cap_ngn: float | None = None
    monthly_cap_ngn: float | None = None


@router.patch("/agents/{agent_id}")
async def patch_agent(agent_id: str, b: AgentPatch):
    sets, vals = [], []
    for col, v in (("active", b.active), ("daily_cap_ngn", b.daily_cap_ngn), ("monthly_cap_ngn", b.monthly_cap_ngn)):
        if v is not None:
            if isinstance(v, float) and v < 0:
                raise HTTPException(400, "Caps cannot be negative")
            sets.append(f"{col} = %s")
            vals.append(v)
    if not sets:
        raise HTTPException(400, "Nothing to update")
    n = await execute(f"update profiles set {', '.join(sets)} where id = %s and role = 'sales_agent'", (*vals, agent_id))
    if not n:
        raise HTTPException(404, "Agent not found")
    return {"ok": True}


class AssignBody(BaseModel):
    agent_id: str | None
    company_keys: list[str]


@router.post("/assign")
async def assign(b: AssignBody):
    """company_assignments.company_key is the PK: a company has one agent only; assigning moves it."""
    if not b.company_keys:
        raise HTTPException(400, "Select at least one company")
    if b.agent_id is None:
        await execute("delete from company_assignments where company_key = any(%s)", (b.company_keys,))
        return {"ok": True}
    agent = await fetch_one("select 1 from profiles where id = %s and role = 'sales_agent'", (b.agent_id,))
    if not agent:
        raise HTTPException(400, "Not a sales agent")
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """insert into company_assignments (company_key, agent_id) values (%s,%s)
                   on conflict (company_key) do update set agent_id = excluded.agent_id, assigned_at = now()""",
                [(k, b.agent_id) for k in b.company_keys],
            )
    return {"ok": True}


def _pick(row: dict, *keys: str) -> str:
    for k, v in row.items():
        if k and k.strip().lower() in keys:
            return (v or "").strip()
    return ""


@router.post("/import")
async def import_csv(file: UploadFile):
    """CSV columns (case-insensitive): Company, Name, Title, Phone, Switchboard, LinkedIn, Email"""
    text = (await file.read()).decode("utf-8-sig", errors="replace")
    batch = datetime.now().isoformat()
    rows, skipped = [], 0
    for r in csv.DictReader(io.StringIO(text)):
        company = _pick(r, "company", "company name", "organisation", "organization")
        phone = normalize_phone(_pick(r, "phone", "mobile", "direct phone"))
        board = normalize_phone(_pick(r, "switchboard", "main line", "office"))
        if not company or not (phone or board):
            skipped += 1
            continue
        rows.append((
            company, _pick(r, "name", "contact", "full name") or None, _pick(r, "title", "job title") or None,
            phone, board, _pick(r, "linkedin", "linkedin url") or None, _pick(r, "email") or None, batch,
        ))
    if not rows:
        raise HTTPException(400, "No valid rows (need Company and a Phone or Switchboard)")
    imported = 0
    async with pool.connection() as conn:
        async with conn.transaction():
            for row in rows:
                cur = await conn.execute(
                    """insert into contacts (company, name, title, phone, switchboard, linkedin, email, import_batch)
                       values (%s,%s,%s,%s,%s,%s,%s,%s) on conflict (company_key, phone) do nothing""",
                    row,
                )
                imported += cur.rowcount
    return {"imported": imported, "skipped": skipped, "duplicates": len(rows) - imported}


class ResetPassword(BaseModel):
    password: str


@router.post("/agents/{agent_id}/reset-password")
async def reset_password(agent_id: str, b: ResetPassword):
    if len(b.password) < 8:
        raise HTTPException(400, "Password must be 8+ characters")
    if not await fetch_one("select 1 from profiles where id = %s and role = 'sales_agent'", (agent_id,)):
        raise HTTPException(404, "Agent not found")
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.put(
            f"{settings.supabase_url}/auth/v1/admin/users/{agent_id}",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            json={"password": b.password},
        )
    if r.status_code >= 300:
        raise HTTPException(400, "Could not reset password")
    return {"ok": True}
