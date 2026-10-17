"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { simNow, useTime } from "./store/time";

/** Re-render at `ms` interval with the wall clock. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Re-render with the simulation clock. */
export function useSimNow(ms = 1000) {
  const t = useTime();
  const real = useNow(ms);
  return simNow(t, real);
}

const noop = () => () => {};
/** False during SSR and hydration, true afterwards. Use to avoid rendering clock text on the server. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
