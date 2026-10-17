export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.AETHERRA_SCHEDULER === "off") return;
  const { tick } = await import("./providers/launches/service");
  const run = () => tick().catch((e) => console.warn("[aetherra] scheduler tick failed:", (e as Error).message));
  // First tick shortly after boot, then every minute (refreshes are TTL- and quota-gated inside).
  setTimeout(run, 5_000);
  setInterval(run, 60_000).unref?.();
}
