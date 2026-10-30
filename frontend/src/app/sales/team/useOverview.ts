"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type Day = {
  calls: number; talk_sec: number; answered: number; answered_pct: number; cost: number;
  counts: Record<string, number>; no_outcome: number; short_calls: number;
  flags: { missing_outcome: boolean; short_calls: boolean; mostly_no_answer: boolean };
};
export type Overview = {
  date: string;
  outcomes: string[];
  agents: { id: string; name: string; active: boolean; daily_cap: number; monthly_cap: number; month_spend: number; day: Day }[];
  companies: { key: string; name: string; contacts: number; owner: string | null }[];
};

/** Loads /admin/overview for the admin pages; `reload` refetches after a change. */
export function useOverview(date = "") {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => {
    setBusy(true);
    api<Overview>(`/admin/overview${date ? `?date_=${date}` : ""}`)
      .then((o) => { setD(o); setErr(""); })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [date]);
  useEffect(reload, [reload]);
  return { d, err, busy, reload };
}
