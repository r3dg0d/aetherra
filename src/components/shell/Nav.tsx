"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "./NotificationCenter";

const LINKS = [
  { href: "/", label: "EXPLORE" },
  { href: "/sky", label: "SKY" },
  { href: "/earth", label: "EARTH" },
  { href: "/orbit", label: "ORBIT" },
  { href: "/flights", label: "FLIGHTS" },
  { href: "/launches", label: "LAUNCHES" },
  { href: "/ascent", label: "ASCENT" },
];

export function Nav({ onSearch, onSettings }: { onSearch: () => void; onSettings: () => void }) {
  const path = usePathname();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-3 md:px-6">
      <nav aria-label="Primary" className="glass pointer-events-auto flex items-center gap-1 px-2 py-1.5">
        <Link href="/" className="mr-2 px-2 text-[13px] font-semibold tracking-[0.42em] text-starlight" aria-label="AETHERRA home">
          AETHERRA
        </Link>
        <span className="mx-1 hidden h-4 w-px bg-violet/25 md:block" />
        <ul className="hidden items-center md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-[11px] tracking-[0.2em] transition-colors ${active ? "bg-nebula/25 text-starlight" : "text-starlight/60 hover:text-starlight"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <select aria-label="Navigate" className="input md:hidden" value={LINKS.find((l) => (l.href === "/" ? path === "/" : path.startsWith(l.href)))?.href ?? "/"} onChange={(e) => (window.location.href = e.target.value)}>
          {LINKS.map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}
        </select>
      </nav>
      <div className="pointer-events-auto flex items-center gap-2">
        <button className="glass flex items-center gap-2 px-3 py-2 text-[12px] text-starlight/70 hover:text-starlight" onClick={onSearch} aria-label="Search (Ctrl+K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="hidden sm:inline">Search universe</span>
          <kbd className="mono hidden rounded border border-violet/30 px-1 text-[10px] sm:inline">⌘K</kbd>
        </button>
        <NotificationCenter />
        <button className="glass p-2 text-starlight/70 hover:text-starlight" onClick={onSettings} aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>
    </header>
  );
}
