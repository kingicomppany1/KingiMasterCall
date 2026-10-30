"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDuration, ngn } from "@/lib/common";
import { Alert, Card, EmptyState, PageSkeleton, Pill, Stat } from "@/components/ui";
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

function shiftDay(iso: string, by: number) {
  const t = new Date(`${iso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + by);
  return t.toISOString().slice(0, 10);
}
function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function Team() {
  const [date, setDate] = useState("");
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setBusy(true);
    api<Overview>(`/admin/overview${date ? `?date_=${date}` : ""}`)
      .then((o) => { setD(o); setErr(""); })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [date]);
  useEffect(load, [load]);

  if (err && !d) {
    return (
      <Card>
        <Alert tone="bad">{err}</Alert>
        <div style={{ marginTop: 12 }}><button onClick={load}>Try again</button></div>
      </Card>
    );
  }
  if (!d) return <PageSkeleton />;

  const cur = date || d.date;
  const tot = d.agents.reduce(
    (t, a) => ({ calls: t.calls + a.day.calls, talk: t.talk + a.day.talk_sec, answered: t.answered + a.day.answered, cost: t.cost + a.day.cost }),
    { calls: 0, talk: 0, answered: 0, cost: 0 },
  );
  const rate = tot.calls ? Math.round((tot.answered / tot.calls) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team Overview</h1>
          <p className="sub">Call data comes from Africa&apos;s Talking webhooks — agents cannot edit it.</p>
        </div>
        <div className="date-nav">
          <button className="icon" aria-label="Previous day" onClick={() => setDate(shiftDay(cur, -1))}><ChevronLeft size={16} /></button>
          <input type="date" aria-label="Report date" value={cur} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="icon" aria-label="Next day" onClick={() => setDate(shiftDay(cur, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>
      {err && <Alert tone="bad">{err}</Alert>}

      <div className={busy ? "refreshing" : undefined} aria-busy={busy}>
        <div className="grid stats">
          <Stat label="Calls" value={tot.calls} sub={prettyDate(cur)} />
          <Stat label="Talk time" value={fmtDuration(tot.talk)} />
          <Stat label="Answered" value={tot.answered} sub={`${rate}% of calls`} />
          <Stat label="Cost" value={ngn(tot.cost)} />
        </div>

        <Card title="Performance by agent" subtitle={prettyDate(cur)} flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="sticky-col">Agent</th><th className="r">Calls</th><th className="r">Talk time</th><th className="r">Answered</th>
                  {d.outcomes.map((o) => <th key={o} className="r">{label(o)}</th>)}
                  <th className="r">Cost</th><th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {d.agents.map((a) => {
                  const z = (n: number) => (n ? "r num" : "r num zero");
                  return (
                    <tr key={a.id}>
                      <td className="sticky-col"><strong>{a.name}</strong> {!a.active && <Pill tone="bad">off</Pill>}</td>
                      <td className={z(a.day.calls)}>{a.day.calls}</td>
                      <td className={z(a.day.talk_sec)}>{fmtDuration(a.day.talk_sec)}</td>
                      <td className={z(a.day.answered)}>{a.day.answered} <span className="muted">({a.day.answered_pct}%)</span></td>
                      {d.outcomes.map((o) => <td key={o} className={z(a.day.counts[o] ?? 0)}>{a.day.counts[o] ?? 0}</td>)}
                      <td className={z(a.day.cost)}>{ngn(a.day.cost)}</td>
                      <td>
                        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          {a.day.flags.missing_outcome && <Pill tone="bad">{a.day.no_outcome} outcome missing</Pill>}
                          {a.day.flags.short_calls && <Pill tone="warn">{a.day.short_calls} very short</Pill>}
                          {a.day.flags.mostly_no_answer && <Pill tone="warn">mostly no answer</Pill>}
                          {!a.day.flags.missing_outcome && !a.day.flags.short_calls && !a.day.flags.mostly_no_answer && <span className="muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!d.agents.length && (
              <EmptyState icon={<Users size={20} />} title="No agents yet" hint="Add your first sales agent in the Add agent card below to start tracking calls." />
            )}
          </div>
        </Card>

        <Card title="Budget & access" subtitle="Spending limits and who can place calls." flush>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Month spend</th><th>Daily cap ₦</th><th>Monthly cap ₦</th><th>Calling</th><th></th></tr></thead>
              <tbody>
                {d.agents.map((a) => (
                  <AgentControls key={a.id} onChanged={load} spent={a.month_spend}
                    agent={{ id: a.id, name: a.name, active: a.active, daily: a.daily_cap, monthly: a.monthly_cap }} />
                ))}
              </tbody>
            </table>
            {!d.agents.length && <EmptyState title="Nothing to manage yet" />}
          </div>
        </Card>

        <NewAgentForm onChanged={load} />

        <div className="two even">
          <AssignPanel onChanged={load} companies={d.companies} agents={d.agents.map((a) => ({ id: a.id, name: a.name }))} />
          <ImportForm onChanged={load} />
        </div>
      </div>
    </>
  );
}
