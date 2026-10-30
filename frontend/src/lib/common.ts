export const OUTCOMES = [
  { value: "no_answer", label: "No answer" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "call_back", label: "Call back" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "deal_closed", label: "Deal closed" },
] as const;
export type OutcomeValue = (typeof OUTCOMES)[number]["value"];

/** How an outcome changes the outreach contact. */
export const OUTCOME_EFFECT: Record<
  OutcomeValue,
  { status: string; stopSequence: boolean }
> = {
  no_answer: { status: "contacted", stopSequence: false },
  wrong_number: { status: "bad_number", stopSequence: false },
  call_back: { status: "callback", stopSequence: false },
  interested: { status: "yes", stopSequence: true },
  not_interested: { status: "no", stopSequence: true },
  meeting_booked: { status: "yes", stopSequence: true },
  deal_closed: { status: "yes", stopSequence: true },
};

/** Africa/Lagos is UTC+1 all year (no DST). */
const LAGOS_MS = 3600_000;
export function lagosDayStart(d = new Date()): Date {
  const shifted = new Date(d.getTime() + LAGOS_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - LAGOS_MS);
}
export function lagosDateString(d = new Date()): string {
  return new Date(d.getTime() + LAGOS_MS).toISOString().slice(0, 10);
}
export function lagosMonthStart(d = new Date()): Date {
  const shifted = new Date(d.getTime() + LAGOS_MS);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - LAGOS_MS);
}
export function lagosWeekStart(d = new Date()): Date {
  const start = lagosDayStart(d);
  const dow = new Date(start.getTime() + LAGOS_MS).getUTCDay(); // 0=Sun
  return new Date(start.getTime() - ((dow + 6) % 7) * 86400_000); // Monday
}

/** Normalise to E.164. Assumes Nigeria for local numbers (0803... -> +234803...). */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{8,15}$/.test(s) ? s : "";
  if (s.startsWith("234") && s.length >= 12) return "+" + s;
  if (s.startsWith("0") && s.length >= 10) return "+234" + s.slice(1);
  return "";
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, "0")}`;
}
export const ngn = (n: number) =>
  "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
