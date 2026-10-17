"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadConstellations, loadStars, starLabel, type Constellation, type StarRow } from "@/lib/astro/catalog";
import { BODIES } from "@/lib/astro/sky";

interface Result { type: string; label: string; sub?: string; href: string }

const PAGES: Result[] = [
  { type: "view", label: "Sky view (planetarium)", href: "/sky" },
  { type: "view", label: "Earth (imagery, streetlights, webcams)", href: "/earth" },
  { type: "view", label: "Satellites & ISS", href: "/orbit" },
  { type: "view", label: "Live flights", href: "/flights" },
  { type: "view", label: "Mission Control — launches", href: "/launches" },
  { type: "view", label: "ASCENT spacecraft simulator", href: "/ascent" },
  { type: "view", label: "Data sources & provider status", href: "/status" },
];

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stars, setStars] = useState<StarRow[]>([]);
  const [cons, setCons] = useState<Constellation[]>([]);
  const [remote, setRemote] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    loadStars().then((c) => setStars(c.stars.filter((s: StarRow) => s[5] || s[6]))).catch(() => {});
    loadConstellations().then((c) => setCons(c.constellations)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((r) => r.json()); setRemote(r.data ?? []); } catch {}
      setLoading(false);
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const local = useMemo<Result[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return PAGES;
    const out: Result[] = [];
    for (const b of BODIES) if (b.toLowerCase().includes(s)) out.push({ type: "planet", label: b, sub: "Solar System body", href: `/sky?body=${b}` });
    for (const c of cons) if (c.name.toLowerCase().includes(s) || c.id.toLowerCase() === s) out.push({ type: "constellation", label: c.name, sub: `Constellation · ${c.id}`, href: `/sky?con=${c.id}` });
    for (const st of stars) { const l = starLabel(st); if (l.toLowerCase().includes(s) || `hip ${st[0]}` === s) out.push({ type: "star", label: l, sub: `HIP ${st[0]} · mag ${st[3].toFixed(2)}`, href: `/sky?hip=${st[0]}` }); if (out.length > 30) break; }
    for (const p of PAGES) if (p.label.toLowerCase().includes(s)) out.push(p);
    return out.slice(0, 14);
  }, [q, stars, cons]);

  const results = q.trim().length < 2 ? local : [...local, ...remote];
  const go = (r: Result) => { onClose(); setQ(""); router.push(r.href); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-space/50 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className="glass glass-strong fade-in w-[min(640px,92vw)] p-2" role="dialog" aria-label="Universal search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef} value={q} placeholder="Search stars, planets, constellations, satellites, launches, places…" className="input w-full border-0 bg-transparent px-3 py-3 text-[15px]"
          aria-label="Search query" role="combobox" aria-expanded aria-controls="search-results"
          onChange={(e) => { setQ(e.target.value); setSel(0); if (e.target.value.trim().length < 2) setRemote([]); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter" && results[sel]) go(results[sel]);
          }}
        />
        <ul id="search-results" role="listbox" className="scroll-thin max-h-[50vh] overflow-y-auto border-t hairline pt-1">
          {results.map((r, i) => (
            <li key={`${r.type}-${r.href}-${i}`} role="option" aria-selected={i === sel}>
              <button className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${i === sel ? "bg-nebula/20" : "hover:bg-nebula/10"}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                <span><span className="text-[13px]">{r.label}</span>{r.sub && <span className="ml-2 text-[11px] text-starlight/45">{r.sub}</span>}</span>
                <span className="label">{r.type}</span>
              </button>
            </li>
          ))}
          {loading && <li className="px-3 py-2 text-[11px] text-starlight/40">Searching launches, satellites and places…</li>}
          {!loading && q.trim().length >= 2 && results.length === 0 && <li className="px-3 py-2 text-[12px] text-starlight/50">No results.</li>}
        </ul>
        <p className="px-3 pt-2 text-[10px] text-starlight/35">Places via OpenStreetMap Nominatim · launches via Launch Library 2 · satellites via CelesTrak</p>
      </div>
    </div>
  );
}
