"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NextLaunchWidget } from "@/components/launches/NextLaunchWidget";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useAmbient } from "@/lib/audio/useAudio";

const HomeScene = dynamic(() => import("@/components/globe/HomeScene"), { ssr: false, loading: () => <div className="h-full w-full bg-space" /> });

const MODES = [
  { href: "/sky", title: "SKY", sub: "Planetarium from any place and time" },
  { href: "/earth", title: "EARTH", sub: "Satellite imagery down to the street" },
  { href: "/orbit", title: "ORBIT", sub: "ISS, stations, GPS, weather satellites" },
  { href: "/flights", title: "FLIGHTS", sub: "Aircraft overhead, live" },
  { href: "/launches", title: "LAUNCHES", sub: "Mission Control for real launches" },
  { href: "/ascent", title: "ASCENT", sub: "Fly your own spacecraft to orbit" },
];

type Phase = "logo" | "flight" | "done";

export function HomeClient() {
  const reduced = useReducedMotion();
  // The intro plays once per session; reduced motion skips straight to the static home view.
  const [phase, setPhase] = useState<Phase>("done");
  useAmbient("home");
  useEffect(() => {
    if (reduced || sessionStorage.getItem("aetherra-intro") || new URLSearchParams(window.location.search).has("nointro")) return;
    setPhase("logo");
    sessionStorage.setItem("aetherra-intro", "1");
    const t = setTimeout(() => setPhase((p) => (p === "logo" ? "flight" : p)), 2300);
    return () => clearTimeout(t);
  }, [reduced]);
  const skip = useCallback(() => setPhase("done"), []);
  useEffect(() => {
    if (phase === "done") return;
    const evs = ["pointerdown", "wheel", "keydown", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, skip, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, skip));
  }, [phase, skip]);
  const playing = phase !== "done";
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0"><HomeScene intro={playing} onIntroDone={skip} /></div>
      {playing && (
        <div className={`pointer-events-none absolute inset-0 z-30 grid place-items-center transition-opacity duration-1000 ${phase === "logo" ? "bg-space opacity-100" : "opacity-0"}`} aria-hidden>
          <div className="text-center">
            <div className="intro-logo text-[clamp(28px,6vw,64px)] font-light tracking-[0.42em] text-starlight">AETHERRA</div>
            <div className="intro-logo mt-3 text-[12px] tracking-[0.5em] text-violet" style={{ animationDelay: "0.5s" }}>FROM STREETLIGHT TO STARLIGHT</div>
          </div>
        </div>
      )}
      {playing && <button className="btn absolute bottom-24 left-1/2 z-40 -translate-x-1/2" onClick={skip}>Skip intro</button>}
      <div className={`ui-chrome pointer-events-none absolute left-4 top-20 z-10 max-w-sm transition-opacity duration-700 md:left-8 md:top-24 ${playing ? "opacity-0" : "opacity-100"}`}>
        <h1 className="text-[clamp(24px,3vw,36px)] font-extralight leading-tight tracking-wide">The Living Atlas<br /><span className="text-gradient">of Earth and Space</span></h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-starlight/60">Real Sun, Moon and stars for this instant. Day and night as they are now. The ISS where SGP4 says it is.</p>
        <nav aria-label="Modes" className="pointer-events-auto mt-6 grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <Link key={m.href} href={m.href} className="glass glass-hover group min-h-[44px] px-3 py-2">
              <div className="text-[11px] tracking-[0.25em] text-starlight">{m.title}</div>
              <div className="hidden text-[10px] text-starlight/45 group-hover:text-starlight/70 sm:block">{m.sub}</div>
            </Link>
          ))}
        </nav>
      </div>
      <div className={`ui-chrome absolute bottom-20 right-4 z-10 transition-opacity duration-700 md:right-8 ${playing ? "opacity-0" : "opacity-100"} max-sm:left-4 max-sm:bottom-16`}><NextLaunchWidget /></div>
    </div>
  );
}
