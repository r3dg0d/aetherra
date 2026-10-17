"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderEnvelope } from "@/providers/core/types";
import type { ImageryItem, ImageryPage } from "@/providers/planetary-imagery/types";
import { ROVERS, TARGETS, targetById, type RoverId } from "@/providers/planetary-imagery/targets";
import { DataBadge } from "@/components/shell/DataBadge";
import { KindBadge } from "./KindBadge";
import { Lightbox } from "./Lightbox";
import { fmtUtc } from "./format";

export interface GalleryInit { target: string; source?: "rover" | "archive"; rover?: RoverId; q?: string }

type Env = ProviderEnvelope<ImageryPage>;

/** "Surface & Mission Imagery": real spacecraft images for a planet or moon, with honest labels and empty states. */
export function ImageryGallery({ init, onClose }: { init: GalleryInit; onClose: () => void }) {
  const [targetId, setTargetId] = useState(targetById(init.target)?.id ?? "mars");
  const target = targetById(targetId)!;
  const [source, setSource] = useState<"rover" | "archive">(target.rover ? init.source ?? "rover" : "archive");
  const [rover, setRover] = useState<RoverId>(init.rover ?? "perseverance");
  const [camera, setCamera] = useState("");
  const [solInput, setSolInput] = useState("");
  const [sol, setSol] = useState<number | null>(null);
  const [qid, setQid] = useState<string>(init.q && target.queries.some((q) => q.id === init.q) ? init.q : target.queries[0].id);
  const [photosOnly, setPhotosOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [env, setEnv] = useState<Env | null>(null);
  const [items, setItems] = useState<ImageryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const effSource = target.rover ? source : "archive";

  const url = useMemo(() => {
    const p = new URLSearchParams({ target: targetId, source: effSource });
    if (effSource === "rover") { p.set("rover", rover); if (camera) p.set("camera", camera); if (sol != null) p.set("sol", String(sol)); }
    else { p.set("q", qid); p.set("page", String(page)); }
    return `/api/imagery?${p}`;
  }, [targetId, effSource, rover, camera, sol, qid, page]);

  useEffect(() => {
    const ctrl = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true); setErr(null);
    if (page === 1) setItems([]);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => { const j = (await r.json()) as Env & { error?: string }; if (j.error) throw new Error(j.error); return j; })
      .then((j) => { setEnv(j); setItems((prev) => (page === 1 ? j.data.items : [...prev, ...j.data.items.filter((x) => !prev.some((p) => p.id === x.id))])); })
      .catch((e) => { if ((e as Error).name !== "AbortError") setErr((e as Error).message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [url, page, nonce]);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && open == null) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, open]);

  const pickTarget = (id: string) => {
    const t = targetById(id)!;
    setTargetId(id); setQid(t.queries[0].id); setPage(1); setSource(t.rover ? "rover" : "archive"); setOpen(null);
  };
  const shown = useMemo(() => (effSource === "archive" && photosOnly ? items.filter((i) => i.kind !== "illustration") : items), [items, photosOnly, effSource]);
  const hidden = items.length - shown.length;
  const onIndex = setOpen;
  const page0 = env?.data;
  const unavailable = env?.dataClass === "UNAVAILABLE" || !!err;
  const roverInfo = ROVERS[rover];

  // Portal to <body>: <main> is position:fixed (its own stacking context) and would sit under the header.
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-space/60 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        className="glass glass-strong fade-in fixed inset-x-0 bottom-0 flex h-[88dvh] flex-col rounded-b-none rounded-t-2xl pb-[env(safe-area-inset-bottom)] md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(86vh,900px)] md:w-[min(1120px,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
        role="dialog" aria-modal="true" aria-label={`Surface & Mission Imagery: ${target.label}`} data-testid="imagery-gallery"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b hairline px-4 pb-2 pt-2 md:py-3">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-starlight/20 md:hidden" aria-hidden />
          <div className="flex items-center gap-2">
            <h2 className="shrink-0 text-[14px] font-medium md:text-[15px]"><span className="md:hidden">Imagery</span><span className="hidden md:inline">Surface & Mission Imagery</span></h2>
            <select className="input min-w-0 flex-1 py-1 text-[13px] md:max-w-[220px] md:flex-none" value={targetId} onChange={(e) => pickTarget(e.target.value)} aria-label="Planet or moon" data-testid="imagery-target">
              {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.parent ? `  ${t.label} (${targetById(t.parent)?.label} moon)` : t.label}</option>)}
            </select>
            <span className="hidden sm:inline-flex">{env && <DataBadge value={env.dataClass} note={env.notice} />}</span>
            <button ref={closeRef} className="icon-btn ml-auto shrink-0" onClick={onClose} aria-label="Close imagery gallery" data-testid="imagery-close">✕</button>
          </div>
          {env && <div className="mt-1 sm:hidden"><DataBadge value={env.dataClass} note={env.notice} size="xs" /></div>}
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b hairline px-4 py-2 text-[12px]">
          {target.rover && (
            <div className="flex overflow-hidden rounded-lg border hairline" role="tablist" aria-label="Image source">
              {(["rover", "archive"] as const).map((s) => (
                <button key={s} role="tab" aria-selected={effSource === s} className={`min-h-[36px] px-3 pointer-coarse:min-h-[44px] ${effSource === s ? "bg-nebula/30" : "hover:bg-nebula/10"}`} onClick={() => { setSource(s); setPage(1); }} data-testid={`imagery-source-${s}`}>
                  {s === "rover" ? "Rover raw images" : "Mission archive"}
                </button>
              ))}
            </div>
          )}
          {effSource === "rover" ? (
            <>
              <select className="input py-1" value={rover} onChange={(e) => { setRover(e.target.value as RoverId); setCamera(""); setSol(null); setSolInput(""); }} aria-label="Rover" data-testid="imagery-rover">
                {(Object.keys(ROVERS) as RoverId[]).map((r) => <option key={r} value={r}>{ROVERS[r].label}</option>)}
              </select>
              <select className="input py-1" value={camera} onChange={(e) => setCamera(e.target.value)} aria-label="Camera" data-testid="imagery-camera">
                <option value="">All cameras</option>
                {roverInfo.cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const n = parseInt(solInput, 10); setSol(Number.isFinite(n) && n >= 0 ? n : null); }}>
                <label className="text-starlight/55" htmlFor="sol-input">Sol</label>
                <input id="sol-input" className="input w-[84px] py-1" inputMode="numeric" placeholder={page0?.latestSol != null ? `${page0.latestSol}` : "latest"} value={solInput} onChange={(e) => setSolInput(e.target.value.replace(/\D/g, ""))} data-testid="imagery-sol" />
                <button className="btn" type="submit">Go</button>
                {sol != null && <button className="btn" type="button" onClick={() => { setSol(null); setSolInput(""); }}>Latest</button>}
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Mission">
                {target.queries.map((q) => (
                  <button key={q.id} className={`btn ${qid === q.id ? "btn-primary" : ""}`} aria-pressed={qid === q.id} onClick={() => { setQid(q.id); setPage(1); }} data-testid={`imagery-q-${q.id}`}>{q.label}</button>
                ))}
              </div>
              <label className="ml-auto flex min-h-[36px] items-center gap-1.5 pointer-coarse:min-h-[44px]"><input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} data-testid="imagery-photos-only" />Hide illustrations</label>
            </>
          )}
        </div>

        <div className="px-4 pt-2 text-[11px] text-starlight/55" aria-live="polite">
          {effSource === "rover"
            ? <>Raw images from {roverInfo.mission}{page0?.sol != null && <> · <span className="mono">sol {page0.sol}</span>{page0.latestSol != null && " (latest with images)"}</>} · <span className="text-amber-200/80">raw and uncalibrated, as downlinked; colours and exposure are not corrected</span>.</>
            : <>NASA Image and Video Library{page0?.total != null && <> · {page0.total.toLocaleString()} matches</>}{hidden > 0 && <> · {hidden} illustration{hidden > 1 ? "s" : ""} hidden</>}.</>}
          {env?.notice && <span className="ml-1 text-amber-200/80">{env.notice}</span>}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {unavailable && items.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="imagery-unavailable">
              <DataBadge value="UNAVAILABLE" />
              <p className="max-w-md text-[13px] text-starlight/70">{err ?? env?.notice ?? "The image source did not respond."} Nothing is shown rather than placeholder images.</p>
              <button className="btn" onClick={() => setNonce((n) => n + 1)}>Try again</button>
            </div>
          ) : !loading && shown.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-starlight/60" data-testid="imagery-empty">
              {effSource === "rover" ? `No ${camera ? "images from this camera" : "images"} ${sol != null ? `on sol ${sol}` : "in the latest listing"}. Try another sol or camera.` : hidden ? "Only illustrations matched. Untick “Hide illustrations” to see them." : "No images matched this mission query."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="imagery-grid">
              {shown.map((it, i) => (
                <li key={it.id}>
                  <button className="group block w-full overflow-hidden rounded-lg border hairline bg-black/40 text-left hover:border-violet/60" onClick={() => setOpen(i)} aria-label={`Open ${it.title}`} data-testid="imagery-thumb">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-midnight">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                      <span className="absolute left-1 top-1"><KindBadge kind={it.kind} /></span>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-[12px]">{it.source === "nasa-ivl" ? it.title : it.instrument ?? it.title}</div>
                      <div className="mono truncate text-[10px] text-starlight/45">{it.sol != null ? `sol ${it.sol} · ` : ""}{fmtUtc(it.date, it.dateKind === "acquired")}</div>
                    </div>
                  </button>
                </li>
              ))}
              {loading && Array.from({ length: items.length ? 4 : 12 }).map((_, i) => <li key={`sk${i}`} className="aspect-[4/3] animate-pulse rounded-lg bg-starlight/5" aria-hidden />)}
            </ul>
          )}
          {effSource === "archive" && !loading && page0?.total != null && items.length < page0.total && items.length > 0 && page < 20 && (
            <div className="mt-3 flex justify-center"><button className="btn" onClick={() => setPage((p) => p + 1)}>Load more</button></div>
          )}
        </div>
        <footer className="border-t hairline px-4 py-2 text-[10px] text-starlight/45">
          {env?.attribution ?? "NASA"} · Credits per image in the viewer · Thumbnails load from NASA servers (mars.nasa.gov, images-assets.nasa.gov).
        </footer>
      </section>
      {open != null && shown[open] && <div onMouseDown={(e) => e.stopPropagation()}><Lightbox items={shown} index={open} onIndex={onIndex} onClose={() => setOpen(null)} /></div>}
    </div>,
    document.body,
  );
}
