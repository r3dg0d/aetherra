"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { NextLaunchWidget } from "@/components/launches/NextLaunchWidget";

const HomeScene = dynamic(() => import("@/components/globe/HomeScene"), { ssr: false, loading: () => <div className="h-full w-full bg-space" /> });

const MODES = [
  { href: "/sky", title: "SKY", sub: "Planetarium from any place and time" },
  { href: "/earth", title: "EARTH", sub: "Satellite imagery down to the street" },
  { href: "/orbit", title: "ORBIT", sub: "ISS, stations, GPS, weather satellites" },
  { href: "/flights", title: "FLIGHTS", sub: "Aircraft overhead, live" },
  { href: "/launches", title: "LAUNCHES", sub: "Mission Control for real launches" },
  { href: "/ascent", title: "ASCENT", sub: "Fly your own spacecraft to orbit" },
];

export function HomeClient() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0"><HomeScene /></div>
      <div className="intro pointer-events-none absolute inset-0 z-30 grid place-items-center bg-space" aria-hidden>
        <div className="text-center">
          <div className="intro-logo text-[clamp(28px,6vw,64px)] font-light tracking-[0.42em] text-starlight">AETHERRA</div>
          <div className="intro-logo mt-3 text-[12px] tracking-[0.5em] text-violet" style={{ animationDelay: "0.5s" }}>FROM STREETLIGHT TO STARLIGHT</div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-4 top-20 z-10 max-w-sm md:left-8 md:top-24">
        <h1 className="fade-in text-[clamp(22px,3vw,34px)] font-light leading-tight tracking-wide">The Living Atlas<br />of Earth and Space</h1>
        <p className="fade-in mt-2 text-[13px] text-starlight/55">Real Sun, Moon and stars for this instant. Day and night as they are now. The ISS where SGP4 says it is.</p>
        <nav aria-label="Modes" className="pointer-events-auto mt-6 grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <Link key={m.href} href={m.href} className="glass group px-3 py-2 transition-colors hover:border-violet/50">
              <div className="text-[11px] tracking-[0.25em] text-starlight">{m.title}</div>
              <div className="text-[10px] text-starlight/45 group-hover:text-starlight/70">{m.sub}</div>
            </Link>
          ))}
        </nav>
      </div>
      <div className="absolute bottom-20 right-4 z-10 md:right-8"><NextLaunchWidget /></div>
    </div>
  );
}
