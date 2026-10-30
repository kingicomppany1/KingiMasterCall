"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtDuration, ngn } from "@/lib/common";
import Dialer, { type ContactRow } from "./Dialer";
import Script from "./Script";

type Summary = { calls: number; talk_sec: number; answered_pct: number; meetings: number; deals: number };
type Dash = {
  active: boolean;
  caps: { daily: number; monthly: number };
  spend: { day: number; month: number };
  today: Summary;
  week: Summary;
  contacts: ContactRow[];
};

export default function MyCalls() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api<Dash>("/agent/dashboard").then(setD).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  if (err) return <div className="err">{err}</div>;
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <h1>My Calls</h1>
      <p className="sub">
        Budget today {ngn(d.spend.day)} / {ngn(d.caps.daily)} · month {ngn(d.spend.month)} / {ngn(d.caps.monthly)}
      </p>
      {!d.active && <div className="banner">Your calling is switched off. Contact your head of sales.</div>}
      <div className="card">
        <div className="grid stats">
          <Stat l="Calls today" v={d.today.calls} />
          <Stat l="Calls this week" v={d.week.calls} />
          <Stat l="Talk time today" v={fmtDuration(d.today.talk_sec)} />
          <Stat l="Answered (week)" v={`${d.week.answered_pct}%`} />
          <Stat l="Meetings (week)" v={d.week.meetings} />
          <Stat l="Deals (week)" v={d.week.deals} />
        </div>
      </div>
      <div className="two">
        <Dialer contacts={d.contacts} disabled={!d.active} onChanged={load} />
        <Script />
      </div>
    </>
  );
}

function Stat({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="stat">
      <div className="v num">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}
