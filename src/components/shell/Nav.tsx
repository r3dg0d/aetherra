"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationCenter } from "./NotificationCenter";
import { useApp, useView } from "@/lib/store/app";
import { audio } from "@/lib/audio/engine";

const LINKS = [
  { href: "/", label: "EXPLORE" },
  { href: "/sky", label: "SKY" },
  { href: "/earth", label: "EARTH" },
  { href: "/orbit", label: "ORBIT" },
  { href: "/flights", label: "FLIGHTS" },
  { href: "/launches", label: "LAUNCHES" },
  { href: "/ascent", label: "ASCENT" },
];

const isActive = (href: string, path: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function MuteButton({ className = "" }: { className?: string }) {
  const muted = useApp((s) => s.muted);
  const setMuted = useApp((s) => s.setMuted);
  return (
    <button
      className={`icon-btn glass ${className}`}
      data-testid="mute-toggle"
      aria-pressed={!muted}
      aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Mute"}
      title={muted ? "Sound off (cinematic sound, not space acoustics)" : "Mute"}
      onClick={() => { const next = !muted; if (!next) audio.unlock(); setMuted(next); }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
      </svg>
    </button>
  );
}

export function Nav({ onSearch, onSettings }: { onSearch: () => void; onSettings: () => void }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  // Close the mobile menu after navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMenu(false); }, [path]);
  return (
    <header className="app-header pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 md:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
      <nav aria-label="Primary" className="glass pointer-events-auto flex min-w-0 items-center gap-1 px-1.5 py-1 md:px-2 md:py-1.5">
        <button className="icon-btn lg:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu((m) => !m)} data-testid="menu-toggle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>{menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
        <Link href="/" className="logo-link tap-link mr-1 truncate px-1 text-[13px] font-semibold tracking-[0.42em] text-starlight md:px-2" aria-label="AETHERRA home">AETHERRA</Link>
        <span className="mx-1 hidden h-4 w-px bg-violet/25 lg:block" />
        <ul className="hidden items-center lg:flex">
          {LINKS.map((l) => {
            const active = isActive(l.href, path);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined} className={`nav-link rounded-full px-3 py-1 text-[11px] tracking-[0.2em] transition-colors ${active ? "bg-nebula/25 text-starlight shadow-[0_0_18px_-6px_rgba(121,86,255,0.8)]" : "text-starlight/60 hover:text-starlight"}`}>{l.label}</Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <button className="glass icon-btn gap-2 sm:px-3 text-[12px] text-starlight/70 hover:text-starlight" onClick={onSearch} aria-label="Search (Ctrl+K)" data-testid="search-open">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="hidden xl:inline">Search universe</span>
          <kbd className="mono hidden rounded border border-violet/30 px-1 text-[10px] xl:inline">⌘K</kbd>
        </button>
        <MuteButton />
        <button className="glass icon-btn hidden md:inline-flex" onClick={() => useView.getState().setHideUi(true)} aria-label="Hide interface for screenshots (H)" title="Hide UI (H)" data-testid="hide-ui">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></svg>
        </button>
        <NotificationCenter />
        <button className="glass icon-btn hidden md:inline-flex" onClick={onSettings} aria-label="Settings" data-testid="settings-open">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>
      {menu && (
        <div id="mobile-menu" className="glass glass-strong sheet-in pointer-events-auto fixed inset-x-3 z-50 p-2 lg:hidden" style={{ top: "calc(env(safe-area-inset-top) + 66px)" }} role="dialog" aria-label="Navigation menu">
          <ul className="grid grid-cols-2 gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href, path) ? "page" : undefined} className={`flex min-h-[48px] items-center rounded-xl px-4 text-[13px] tracking-[0.22em] ${isActive(l.href, path) ? "bg-nebula/25 text-starlight" : "text-starlight/75 active:bg-nebula/15"}`}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-1 border-t border-violet/15 pt-2">
            <button className="flex min-h-[48px] items-center rounded-xl px-4 text-[13px] text-starlight/75 active:bg-nebula/15" onClick={() => { setMenu(false); onSettings(); }}>Settings</button>
            <button className="flex min-h-[48px] items-center rounded-xl px-4 text-[13px] text-starlight/75 active:bg-nebula/15" onClick={() => { setMenu(false); useView.getState().setHideUi(true); }}>Hide UI</button>
            <Link href="/status" className="col-span-2 flex min-h-[48px] items-center rounded-xl px-4 text-[13px] text-starlight/75 active:bg-nebula/15">Data sources &amp; status</Link>
          </div>
        </div>
      )}
    </header>
  );
}
