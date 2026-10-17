import "server-only";
import type { PushSender } from "./queue";

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function getPushSender(): Promise<PushSender | null> {
  if (!vapidConfigured()) return null;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@localhost", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (sub, payload) => {
    if (!sub.endpoint || !sub.p256dh || !sub.auth) return { ok: false, gone: true, error: "incomplete subscription" };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      return { ok: true };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      return { ok: false, gone: code === 404 || code === 410, error: `push ${code ?? ""} ${(e as Error).message}` };
    }
  };
}
