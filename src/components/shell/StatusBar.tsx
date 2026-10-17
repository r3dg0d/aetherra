"use client";
import { useView } from "@/lib/store/app";
import { useTime, simNow, timeClass } from "@/lib/store/time";
import { useNow } from "@/lib/useNow";
import { formatLat, formatLon } from "@/lib/astro/coords";
import { DataBadge } from "./DataBadge";

function fmtDist(km: number) {
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} M km`;
  if (km >= 10) return `${Math.round(km).toLocaleString("en-US")} km`;
  return `${(km * 1000).toFixed(0)} m`;
}

export function StatusBar() {
  const real = useNow(250);
  const t = useTime();
  const sim = simNow(t, real);
  const { camera, cursor, dataClass, dataNote } = useView();
  const iso = new Date(sim).toISOString();
  const tc = timeClass(sim, t.mode, real);
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <div className="glass pointer-events-auto flex max-w-full items-center gap-4 overflow-x-auto px-4 py-2 text-[11px] mono text-starlight/80" role="status" aria-live="off">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="label">UTC</span>
          <span>{iso.slice(0, 10)} {iso.slice(11, 19)}</span>
          {t.mode !== "live" && <span className="text-violet">×{t.speed}{t.mode === "paused" ? " ⏸" : ""}</span>}
        </span>
        <span className="hidden whitespace-nowrap sm:inline"><span className="label mr-2">LAT</span>{camera ? formatLat(cursor?.lat ?? camera.lat) : "—"}</span>
        <span className="hidden whitespace-nowrap sm:inline"><span className="label mr-2">LON</span>{camera ? formatLon(cursor?.lon ?? camera.lon) : "—"}</span>
        <span className="hidden whitespace-nowrap md:inline"><span className="label mr-2">ALT</span>{camera ? fmtDist(camera.altKm) : "—"}</span>
        <span className="hidden whitespace-nowrap lg:inline"><span className="label mr-2">CAM</span>{camera ? fmtDist(camera.distanceKm) : "—"}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <DataBadge value={dataClass === "LIVE" && tc !== "LIVE" ? tc : dataClass} note={dataNote} />
          {dataNote && <span className="hidden max-w-[28ch] truncate text-starlight/50 xl:inline" title={dataNote}>{dataNote}</span>}
        </span>
      </div>
    </footer>
  );
}
