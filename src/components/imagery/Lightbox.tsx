"use client";
import { useEffect, useRef, useState } from "react";
import type { ImageryItem } from "@/providers/planetary-imagery/types";
import { DataBadge } from "@/components/shell/DataBadge";
import { fmtUtc } from "./format";
import { KindBadge } from "./KindBadge";

const SOURCE_NAME: Record<ImageryItem["source"], string> = {
  "mars-raw-m20": "NASA/JPL raw image feed (mars.nasa.gov), Perseverance",
  "mars-raw-msl": "NASA/JPL raw image feed (mars.nasa.gov), Curiosity",
  "nasa-ivl": "NASA Image and Video Library (images.nasa.gov)",
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => v == null || v === "" ? null : (
  <div className="flex justify-between gap-3 border-b hairline py-1.5 text-[12px]"><dt className="shrink-0 text-starlight/50">{k}</dt><dd className="text-right">{v}</dd></div>
);

/** Full-screen viewer with complete metadata. ←/→ or swipe to move, Esc to close. */
export function Lightbox({ items, index, onIndex, onClose }: { items: ImageryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const it = items[index];
  const [src, setSrc] = useState(it?.large);
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSrc(it?.large); setLoaded(false); }, [it?.id, it?.large]);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "ArrowRight") onIndex(Math.min(items.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [index, items.length, onClose, onIndex]);
  if (!it) return null;
  const nativeId = it.id.split(":").slice(1).join(":");
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/92 md:flex-row" role="dialog" aria-modal="true" aria-label={`Image: ${it.title}`} data-testid="lightbox">
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-2 md:p-6"
        onPointerDown={(e) => { swipe.current = e.clientX; }}
        onPointerUp={(e) => { if (swipe.current != null) { const dx = e.clientX - swipe.current; if (dx < -50) onIndex(Math.min(items.length - 1, index + 1)); if (dx > 50) onIndex(Math.max(0, index - 1)); } swipe.current = null; }}
      >
        {!loaded && <div className="absolute text-[12px] text-starlight/50">Loading image…</div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src} src={src} alt={it.title} className={`max-h-full max-w-full select-none object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)} onError={() => { if (src !== it.thumb) setSrc(it.thumb); }} draggable={false}
        />
        <button className="icon-btn absolute left-2 top-1/2 -translate-y-1/2" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous image">‹</button>
        <button className="icon-btn absolute right-2 top-1/2 -translate-y-1/2" onClick={() => onIndex(Math.min(items.length - 1, index + 1))} disabled={index === items.length - 1} aria-label="Next image">›</button>
        <span className="mono absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-starlight/70" data-tap-exempt>{index + 1} / {items.length}</span>
      </div>
      <aside className="scroll-thin max-h-[42dvh] w-full overflow-y-auto border-t hairline bg-midnight/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-h-none md:w-[360px] md:border-l md:border-t-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-medium leading-snug">{it.title}</h2>
          <button ref={closeRef} className="icon-btn shrink-0" onClick={onClose} aria-label="Close image viewer" data-testid="lightbox-close">✕</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5"><DataBadge value={it.dataClass} size="xs" /><KindBadge kind={it.kind} /></div>
        <dl className="mt-3">
          <Row k="Mission" v={it.mission} />
          <Row k="Instrument / camera" v={it.instrument} />
          {it.sol != null && <Row k="Sol" v={<span className="mono">{it.sol}</span>} />}
          <Row k={it.dateKind === "acquired" ? "Acquired (Earth, UTC)" : "Date (library record, UTC)"} v={<span className="mono">{fmtUtc(it.date, it.dateKind === "acquired")}</span>} />
          <Row k="Image ID" v={<span className="mono break-all text-[11px]">{nativeId}</span>} />
          <Row k="Source" v={SOURCE_NAME[it.source]} />
          <Row k="Credit" v={it.credit} />
        </dl>
        {it.rightsNote && <p className="mt-2 text-[11px] text-amber-200/80">{it.rightsNote}</p>}
        {it.dateKind === "created" && <p className="mt-1 text-[10px] text-starlight/45">Library dates are when the record was created or released, which can differ from when the image was taken.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn" href={it.pageUrl} target="_blank" rel="noreferrer">Official page ↗</a>
          {it.full && it.full !== it.large && <a className="btn" href={it.full} target="_blank" rel="noreferrer">Full resolution ↗</a>}
        </div>
        {it.description && <details className="mt-3 text-[12px] text-starlight/75"><summary className="cursor-pointer text-starlight/60">Description</summary><p className="mt-1 whitespace-pre-line">{it.description}</p></details>}
      </aside>
    </div>
  );
}
