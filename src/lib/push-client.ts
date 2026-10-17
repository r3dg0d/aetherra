"use client";
import { useApp } from "./store/app";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type SubscribeResult = { ok: true; channel: "webpush" | "inapp"; note?: string } | { ok: false; error: string };

/**
 * Subscribe to alerts. Tries browser Web Push (user-initiated permission prompt); falls back to the in-app inbox.
 */
export async function subscribeAlerts(scope: "launch" | "operator" | "all", target?: string, leadMinutes = [60, 10]): Promise<SubscribeResult> {
  const clientId = useApp.getState().ensureClientId();
  let push: PushSubscriptionJSON | null = null;
  let note: string | undefined;
  try {
    const v = await fetch("/api/push/vapid").then((r) => r.json());
    if (v.configured && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(v.publicKey) }));
        push = sub.toJSON();
      } else note = "Browser notifications were not allowed; using the in-app inbox.";
    } else if (!v.configured) note = "Web Push is not configured on this server; using the in-app inbox.";
    else note = "This browser does not support Web Push; using the in-app inbox.";
  } catch (e) {
    note = `Web Push unavailable (${(e as Error).message}); using the in-app inbox.`;
  }
  const body = { clientId, channel: push ? "webpush" : "inapp", scope, target, leadMinutes, notifyChanges: true, push: push ? { endpoint: push.endpoint, keys: push.keys } : undefined };
  const r = await fetch("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return { ok: false, error: (await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}` };
  return { ok: true, channel: push ? "webpush" : "inapp", note };
}

export async function unsubscribeAll() {
  const clientId = useApp.getState().ensureClientId();
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  return fetch("/api/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }).then((r) => r.json());
}
