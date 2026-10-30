import re
from datetime import datetime, timedelta, timezone

LAGOS = timezone(timedelta(hours=1))  # Africa/Lagos, no DST

OUTCOMES = ["no_answer", "wrong_number", "call_back", "interested", "not_interested", "meeting_booked", "deal_closed"]

# outcome -> (contact status, stops email sequence)
OUTCOME_EFFECT = {
    "no_answer": ("contacted", False),
    "wrong_number": ("bad_number", False),
    "call_back": ("callback", False),
    "interested": ("yes", True),
    "not_interested": ("no", True),
    "meeting_booked": ("yes", True),
    "deal_closed": ("yes", True),
}


def day_start(d: datetime | None = None) -> datetime:
    d = (d or datetime.now(timezone.utc)).astimezone(LAGOS)
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def week_start(d: datetime | None = None) -> datetime:
    s = day_start(d)
    return s - timedelta(days=s.weekday())  # Monday


def month_start(d: datetime | None = None) -> datetime:
    return day_start(d).replace(day=1)


def normalize_phone(raw: str | None) -> str:
    """E.164. Local Nigerian numbers (0803...) become +234803..."""
    if not raw:
        return ""
    s = re.sub(r"[\s\-().]", "", raw.strip())
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        return s if re.fullmatch(r"\+\d{8,15}", s) else ""
    if s.startswith("234") and len(s) >= 12:
        return "+" + s
    if s.startswith("0") and len(s) >= 10:
        return "+234" + s[1:]
    return ""


def summarize(logs: list[dict]) -> dict:
    """logs: call_logs rows joined with `outcome` (None when missing)."""
    calls = len(logs)
    answered = sum(1 for l in logs if l["answered"])
    counts: dict[str, int] = {}
    for l in logs:
        if l.get("outcome"):
            counts[l["outcome"]] = counts.get(l["outcome"], 0) + 1
    no_outcome = sum(1 for l in logs if l["ended_at"] and not l.get("outcome"))
    short = sum(1 for l in logs if l["answered"] and 0 < l["duration_sec"] < 15)
    return {
        "calls": calls,
        "answered": answered,
        "answered_pct": round(answered / calls * 100) if calls else 0,
        "talk_sec": sum(l["duration_sec"] for l in logs),
        "cost": float(sum(l["cost_ngn"] for l in logs)),
        "meetings": counts.get("meeting_booked", 0),
        "deals": counts.get("deal_closed", 0),
        "counts": counts,
        "no_outcome": no_outcome,
        "short_calls": short,
        "flags": {
            "missing_outcome": no_outcome > 0,
            "short_calls": short >= 3,
            "mostly_no_answer": calls >= 5 and (calls - answered) / calls >= 0.8,
        },
    }


async def spend(agent_id: str) -> dict:
    from .db import fetch_all

    rows = await fetch_all(
        "select cost_ngn, started_at from call_logs where agent_id = %s and started_at >= %s",
        (agent_id, month_start()),
    )
    ds = day_start()
    return {
        "month": float(sum(r["cost_ngn"] for r in rows)),
        "day": float(sum(r["cost_ngn"] for r in rows if r["started_at"] >= ds)),
    }
