"use client";
import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { StatusBar } from "./StatusBar";
import { SearchPalette } from "./SearchPalette";
import { SettingsPanel } from "./SettingsPanel";
import { PerfPanel } from "./PerfPanel";
import { useApp, useView } from "@/lib/store/app";
import { useAudioSystem } from "@/lib/audio/useAudio";

export { useReducedMotion } from "@/lib/useReducedMotion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState(false);
  const [settings, setSettings] = useState(false);
  const reduced = useApp((s) => s.reducedMotion);
  const hideUi = useView((s) => s.hideUi);
  useAudioSystem();
  useEffect(() => { useApp.persist.rehydrate(); }, []);
  useEffect(() => {
    const sys = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("reduce-motion", reduced || sys);
  }, [reduced]);
  useEffect(() => { document.documentElement.classList.toggle("ui-hidden", hideUi); }, [hideUi]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
      if (e.key === "/" && !typing) { e.preventDefault(); setSearch(true); }
      // H toggles screenshot mode everywhere except ASCENT, where H is free for flight (it uses the eye button / U).
      if (!typing && !e.metaKey && !e.ctrlKey && (e.key === "u" || e.key === "U" || ((e.key === "h" || e.key === "H") && !location.pathname.startsWith("/ascent")))) {
        useView.getState().setHideUi(!useView.getState().hideUi);
      }
      if (e.key === "Escape" && useView.getState().hideUi) useView.getState().setHideUi(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <a href="#main" data-tap-exempt className="sr-only focus:min-h-[44px] focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-midnight focus:px-3 focus:py-1">Skip to content</a>
      <Nav onSearch={() => setSearch(true)} onSettings={() => setSettings((s) => !s)} />
      <main id="main" className="fixed inset-0">{children}</main>
      <StatusBar />
      <PerfPanel />
      <SearchPalette open={search} onClose={() => setSearch(false)} />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
      {hideUi && (
        <button className="show-ui-btn fixed right-3 z-50 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-starlight/60 backdrop-blur hover:text-starlight" style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }} onClick={() => useView.getState().setHideUi(false)} aria-label="Show interface">
          Show UI (H)
        </button>
      )}
    </>
  );
}
