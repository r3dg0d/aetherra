import { json } from "@/server/http";
import { getDb } from "@/server/db/client";

export async function GET() {
  try {
    const { driver } = await getDb();
    return json({ ok: true, db: driver, time: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, db: "error", error: (e as Error).message }, { status: 503 });
  }
}
