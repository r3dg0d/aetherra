"use client";
import { useState } from "react";
import { OBSERVER_PRESETS, useApp } from "@/lib/store/app";

/** Observer selection. Geolocation is only requested when the user presses the button. */
export function ObserverPicker() {
  const { observer, setObserver } = useApp();
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState(String(observer.lat));
  const [lon, setLon] = useState(String(observer.lon));
  const [msg, setMsg] = useState("");
  return (
    <div className="glass px-3 py-2 text-[12px]" role="group" aria-label="Observer location">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="label mr-1">Observer</span>
        <select className="input max-w-[200px]" aria-label="Preset location" value={OBSERVER_PRESETS.find((p) => p.name === observer.name)?.name ?? "custom"} onChange={(e) => { const p = OBSERVER_PRESETS.find((x) => x.name === e.target.value); if (p) setObserver(p); }}>
          {OBSERVER_PRESETS.map((p) => <option key={p.name}>{p.name}</option>)}
          {!OBSERVER_PRESETS.some((p) => p.name === observer.name) && <option value="custom">{observer.name}</option>}
        </select>
        <button className="btn" onClick={() => setManual(!manual)} aria-expanded={manual}>Coordinates</button>
        <button className="btn" onClick={() => {
          if (!navigator.geolocation) return setMsg("Geolocation not supported");
          setMsg("Requesting location…");
          navigator.geolocation.getCurrentPosition(
            (p) => { setObserver({ name: "My location", lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), heightM: Math.round(p.coords.altitude ?? 0) }); setMsg("Using your location (kept in this browser only)"); },
            (e) => setMsg(`Location not available: ${e.message}`), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
        }}>Use my location</button>
      </div>
      {manual && (
        <form className="mt-2 flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); const la = Number(lat), lo = Number(lon); if (Math.abs(la) <= 90 && Math.abs(lo) <= 180) setObserver({ name: `${la.toFixed(3)}, ${lo.toFixed(3)}`, lat: la, lon: lo, heightM: 0 }); }}>
          <input className="input mono w-24" aria-label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input className="input mono w-24" aria-label="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} />
          <button className="btn" type="submit">Set</button>
        </form>
      )}
      <div className="mt-1 mono text-[10px] text-starlight/45">{observer.lat.toFixed(4)}°, {observer.lon.toFixed(4)}° · {observer.heightM} m{msg && ` · ${msg}`}</div>
    </div>
  );
}
