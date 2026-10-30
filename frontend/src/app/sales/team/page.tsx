"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { fmtDuration, ngn } from "@/lib/common";
import { Alert, Card, EmptyState, PageSkeleton, Pill, Stat } from "@/components/ui";
import { useOverview } from "./useOverview";

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
  const { d, err, busy, reload } = useOverview(date);

  if (err && !d) {
    return (
      <Card>
        <Alert tone="bad">{err}</Alert>
        <div style={{ marginTop: 12 }}><button onClick={reload}>Try again</button></div>
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
    <div className="fill-page">
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

      <div className={`col${busy ? " refreshing" : ""}`} aria-busy={busy}>
        <div className="grid stats">
          <Stat label="Calls" value={tot.calls} sub={prettyDate(cur)} />
          <Stat label="Talk time" value={fmtDuration(tot.talk)} />
          <Stat label="Answered" value={tot.answered} sub={`${rate}% of calls`} />
          <Stat label="Cost" value={ngn(tot.cost)} />
        </div>

        <Card title="Performance by agent" subtitle={prettyDate(cur)} flush grow>
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
              <EmptyState
                icon={<Users size={20} />}
                title="No agents yet"
                hint="Add your first sales agent to start tracking calls."
                action={<Link href="/sales/agents" className="btn primary" style={{ marginTop: 8 }}>Add an agent</Link>}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
