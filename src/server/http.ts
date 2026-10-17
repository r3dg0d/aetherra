import { NextResponse } from "next/server";

export function json(data: unknown, init: { status?: number; maxAge?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": init.maxAge ? `public, max-age=${init.maxAge}, stale-while-revalidate=${init.maxAge * 4}` : "no-store", ...init.headers },
  });
}

export function bad(message: string, status = 400) {
  return json({ error: message }, { status });
}

export const isUuid = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
