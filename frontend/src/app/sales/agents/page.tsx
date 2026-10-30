"use client";
import { Users } from "lucide-react";
import { Alert, Card, EmptyState, PageSkeleton } from "@/components/ui";
import { AgentControls, NewAgentForm } from "../team/Controls";
import { useOverview } from "../team/useOverview";

export default function Agents() {
  const { d, err, busy, reload } = useOverview();

  if (err && !d) {
    return (
      <Card>
        <Alert tone="bad">{err}</Alert>
        <div style={{ marginTop: 12 }}><button onClick={reload}>Try again</button></div>
      </Card>
    );
  }
  if (!d) return <PageSkeleton />;

  return (
    <div className="fill-page">
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="sub">Create agent logins, set spending limits and switch calling on or off.</p>
        </div>
      </div>
      {err && <Alert tone="bad">{err}</Alert>}

      <div className={`col${busy ? " refreshing" : ""}`} aria-busy={busy}>
        <NewAgentForm onChanged={reload} />

        <Card title="Budget & access" subtitle="Spending limits and who can place calls." flush grow>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Month spend</th><th>Daily cap ₦</th><th>Monthly cap ₦</th><th>Calling</th><th></th></tr></thead>
              <tbody>
                {d.agents.map((a) => (
                  <AgentControls key={a.id} onChanged={reload} spent={a.month_spend}
                    agent={{ id: a.id, name: a.name, active: a.active, daily: a.daily_cap, monthly: a.monthly_cap }} />
                ))}
              </tbody>
            </table>
            {!d.agents.length && <EmptyState icon={<Users size={20} />} title="No agents yet" hint="Use the form above to create the first one." />}
          </div>
        </Card>
      </div>
    </div>
  );
}
