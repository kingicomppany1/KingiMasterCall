"use client";
import { Alert, Card, PageSkeleton, Stat } from "@/components/ui";
import { AssignPanel } from "../team/Controls";
import { useOverview } from "../team/useOverview";

export default function Companies() {
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

  const free = d.companies.filter((c) => !c.owner).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Companies</h1>
          <p className="sub">Decide which agent calls which company.</p>
        </div>
      </div>
      {err && <Alert tone="bad">{err}</Alert>}

      <div className={busy ? "refreshing" : undefined} aria-busy={busy}>
        <div className="grid stats">
          <Stat label="Companies" value={d.companies.length} />
          <Stat label="Unassigned" value={free} />
          <Stat label="Assigned" value={d.companies.length - free} />
        </div>
        <AssignPanel onChanged={reload} companies={d.companies} agents={d.agents.map((a) => ({ id: a.id, name: a.name }))} />
      </div>
    </>
  );
}
