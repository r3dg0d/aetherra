"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app";
import { unsubscribeAll } from "@/lib/push-client";

interface Item { id: number; launchId: string | null; kind: string; title: string; body: string; createdAt: string; readAt: string | null }

export function NotificationCenter() {
  const clientId = useApp((s) => s.clientId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [subs, setSubs] = useState<{ id: string; scope: string; target: string; channel: string; leadMinutes: number[] }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      const [n, s] = await Promise.all([fetch(`/api/notifications?clientId=${clientId}`).then((r) => r.json()), fetch(`/api/subscriptions?clientId=${clientId}`).then((r) => r.json())]);
      setItems(n.data ?? []); setSubs(s.data ?? []);
    } catch {}
  }, [clientId]);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    const onSub = () => load();
    window.addEventListener("aetherra:subscribed", onSub);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener("aetherra:subscribed", onSub); };
  }, [load]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="relative" ref={ref}>
      <button className="glass icon-btn relative" data-testid="notifications-open" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) load(); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-nebula px-1 text-[9px] mono">{unread}</span>}
      </button>
      {open && (
        <div className="glass glass-strong fade-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+64px)] max-h-[70dvh] overflow-y-auto p-3 md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-[340px]" role="dialog" aria-label="Notification center">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Mission alerts</span>
            {unread > 0 && <button className="text-[11px] text-celestial" onClick={async () => { await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }); load(); }}>Mark all read</button>}
          </div>
          <ul className="scroll-thin max-h-72 space-y-2 overflow-y-auto">
            {items.length === 0 && <li className="text-[12px] text-starlight/50">No alerts yet. Use “Remind me” on a launch to subscribe to countdown reminders and schedule changes.</li>}
            {items.map((i) => (
              <li key={i.id} className={`rounded-lg border hairline p-2 ${i.readAt ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium">{i.title}</span><span className="mono text-[9px] text-starlight/40">{new Date(i.createdAt).toLocaleString()}</span></div>
                <p className="text-[11px] text-starlight/60">{i.body}</p>
                {i.launchId && <Link className="text-[11px] text-celestial" href={`/launches/${i.launchId}`} onClick={() => setOpen(false)}>Open mission →</Link>}
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t hairline pt-2">
            <span className="label">Subscriptions ({subs.length})</span>
            <ul className="mt-1 space-y-1 text-[11px] text-starlight/60">
              {subs.map((s) => <li key={s.id}>{s.channel === "webpush" ? "🔔 push" : "📥 in-app"} · {s.scope === "all" ? "all launches" : `${s.scope}: ${s.target.slice(0, 24)}`} · T−{s.leadMinutes.join("/")} min</li>)}
            </ul>
            {subs.length > 0 && <button className="mt-2 text-[11px] text-alert" onClick={async () => { await unsubscribeAll(); load(); }}>Unsubscribe from everything</button>}
            <p className="mt-2 text-[10px] text-starlight/40">Anonymous: alerts are tied to a random ID stored in this browser. No account, no location.</p>
          </div>
        </div>
      )}
    </div>
  );
}
