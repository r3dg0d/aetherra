import { json } from "@/server/http";
import { vapidConfigured } from "@/providers/launches/push";

export async function GET() {
  return json({ configured: vapidConfigured(), publicKey: vapidConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}
