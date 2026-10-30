"use client";
import { ImportForm } from "../team/Controls";

export default function ImportPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import call list</h1>
          <p className="sub">Add new contacts from a CSV. New companies show up under Companies, ready to assign.</p>
        </div>
      </div>
      <div style={{ maxWidth: 640 }}>
        <ImportForm onChanged={() => {}} />
      </div>
    </>
  );
}
