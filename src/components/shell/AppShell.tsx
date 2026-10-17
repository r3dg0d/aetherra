"use client";
import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { StatusBar } from "./StatusBar";
import { SearchPalette } from "./SearchPalette";
import { SettingsPanel } from "./SettingsPanel";
import { PerfPanel } from "./PerfPanel";
import { useApp } from "@/lib/store/app";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState(false);
  const [settings, setSettings] = useState(false);
  const reduced = useApp((s) => s.reducedMotion);
  useEffect(() => { useApp.persist.rehydrate(); }, []);
  useEffect(() => {
    const sys = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("reduce-motion", reduced || sys);
  }, [reduced]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-midnight focus:px-3 focus:py-1">Skip to content</a>
      <Nav onSearch={() => setSearch(true)} onSettings={() => setSettings((s) => !s)} />
      <main id="main" className="fixed inset-0">{children}</main>
      <StatusBar />
      <PerfPanel />
      <SearchPalette open={search} onClose={() => setSearch(false)} />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </>
  );
}

/** Prefer the OS setting, then the user toggle. */
export function useReducedMotion() {
  const pref = useApp((s) => s.reducedMotion);
  const [sys, setSys] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSys(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return pref || sys;
}
