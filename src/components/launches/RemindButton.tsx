"use client";
import { useState } from "react";
import { subscribeAlerts } from "@/lib/push-client";

export function RemindButton({ scope, target, label = "Remind me" }: { scope: "launch" | "operator" | "all"; target?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [note, setNote] = useState<string>("");
  return (
    <span className="inline-flex flex-col">
      <button
        className={`btn ${state === "done" ? "btn-primary" : ""}`}
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const r = await subscribeAlerts(scope, target);
          if (r.ok) { setState("done"); setNote(r.channel === "webpush" ? "Browser notifications on (T−60/T−10 + changes)" : (r.note ?? "In-app alerts on")); window.dispatchEvent(new Event("aetherra:subscribed")); }
          else { setState("error"); setNote(r.error); }
        }}
      >
        {state === "done" ? "✓ Reminder set" : state === "busy" ? "…" : label}
      </button>
      {note && <span className="mt-1 max-w-[260px] text-[10px] text-starlight/50" role="status">{note}</span>}
    </span>
  );
}
