"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtDuration, ngn } from "@/lib/common";
import { AgentControls, AssignPanel, ImportForm, NewAgentForm } from "./Controls";

type Day = {
  calls: number; talk_sec: number; answered: number; answered_pct: number; cost: number;
  counts: Record<string, number>; no_outcome: number; short_calls: number;
  flags: { missing_outcome: boolean; short_calls: boolean; mostly_no_answer: boolean };
};
type Overview = {
  date: string;
  outcomes: string[];
  agents: { id: string; name: string; active: boolean; daily_cap: number; monthly_cap: number; month_spend: number; day: Day }[];
  companies: { key: string; name: string; contacts: number; owner: string | null }[];
};
const label = (o: string) => o.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function Team() {
  const [date, setDate] = useState("");
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api<Overview>(`/admin/overview${date ? `?date_=${date}` : ""}`)
      .then((o) => { setD(o); setErr(""); })
      .catch((e) => setErr(e.message));
  }, [date]);
  useEffect(load, [load]);

  if (err) return <div className="err">{err}</div>;
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <h1>Team Overview</h1>
      <p className="sub">Call data comes from Africa&apos;s Talking webhooks — agents cannot edit it.</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <input type="date" value={date || d.date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
      </div>

      <div className="card table-wrap">
        <h2>Per agent · {d.date}</h2>
        <table>
          <thead>
            <tr>
              <th>Agent</th><th>Calls</th><th>Talk time</th><th>Answered</th>
              {d.outcomes.map((o) => <th key={o}>{label(o)}</th>)}
              <th>Cost</th><th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {d.agents.map((a) => (
              <tr key={a.id}>
                <td>{a.name} {!a.active && <span className="pill bad">off</span>}</td>
                <td className="num">{a.day.calls}</td>
                <td className="num">{fmtDuration(a.day.talk_sec)}</td>
                <td className="num">{a.day.answered} ({a.day.answered_pct}%)</td>
                {d.outcomes.map((o) => <td key={o} className="num">{a.day.counts[o] ?? 0}</td>)}
                <td className="num">{ngn(a.day.cost)}</td>
                <td>
                  {a.day.flags.missing_outcome && <span className="pill bad">{a.day.no_outcome} outcome missing</span>}{" "}
                  {a.day.flags.short_calls && <span className="pill warn">{a.day.short_calls} very short</span>}{" "}
                  {a.day.flags.mostly_no_answer && <span className="pill warn">mostly no answer</span>}
                </td>
              </tr>
            ))}
            {!d.agents.length && <tr><td colSpan={14} className="muted">No agents yet. Create one below.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h2>Budget &amp; access</h2>
        <table>
          <thead><tr><th>Agent</th><th>Month spend</th><th>Daily cap ₦</th><th>Monthly cap ₦</th><th>Calling</th></tr></thead>
          <tbody>
            {d.agents.map((a) => (
              <AgentControls key={a.id} onChanged={load} spent={a.month_spend}
                agent={{ id: a.id, name: a.name, active: a.active, daily: a.daily_cap, monthly: a.monthly_cap }} />
            ))}
          </tbody>
        </table>
        <NewAgentForm onChanged={load} />
      </div>

      <div className="two">
        <AssignPanel onChanged={load} companies={d.companies} agents={d.agents.map((a) => ({ id: a.id, name: a.name }))} />
        <ImportForm onChanged={load} />
      </div>
    </>
  );
}
