"use client";
import { useState } from "react";

const SCRIPTS = {
  Sponsors: {
    opener: "Hello, this is {your name} from KingiMaster. Do you have 30 seconds? I'm calling about sponsorship visibility with our audience of Nigerian business leaders.",
    points: [
      "Who owns sponsorship / brand partnerships decisions at your company?",
      "Have you sponsored industry events or media before? What worked?",
      "We offer branded placement in front of decision-makers, measurable by leads.",
    ],
    close: "Can I send a short deck today and book 15 minutes this week?",
  },
  Investors: {
    opener: "Hello, this is {your name} from KingiMaster. We connect founders and investors across Nigeria and Africa. Is this a good moment?",
    points: [
      "What sectors and ticket sizes are you currently looking at?",
      "How do you source deals today?",
      "We can introduce pre-vetted opportunities that match your thesis.",
    ],
    close: "Shall I email details and set a short intro call?",
  },
} as const;

export default function Script() {
  const [tab, setTab] = useState<keyof typeof SCRIPTS>("Sponsors");
  const s = SCRIPTS[tab];
  return (
    <div className="card script">
      <h2>Call script</h2>
      <div className="row">
        {(Object.keys(SCRIPTS) as (keyof typeof SCRIPTS)[]).map((k) => (
          <button key={k} className={tab === k ? "primary" : ""} onClick={() => setTab(k)}>
            {k}
          </button>
        ))}
      </div>
      <h3>Opener</h3>
      <p>{s.opener}</p>
      <h3>Key questions</h3>
      <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <h3>Close</h3>
      <p>{s.close}</p>
    </div>
  );
}
