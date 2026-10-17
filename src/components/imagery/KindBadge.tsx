import type { ImageryKind } from "@/providers/planetary-imagery/types";

const STYLE: Record<ImageryKind, { label: string; cls: string; title: string }> = {
  raw: { label: "RAW · UNCALIBRATED", cls: "border-amber-300/50 text-amber-200", title: "Raw image as downlinked: no colour or radiometric calibration" },
  photo: { label: "PHOTO", cls: "border-celestial/40 text-celestial", title: "Spacecraft or astronaut image" },
  illustration: { label: "ILLUSTRATION", cls: "border-rose-300/50 text-rose-200", title: "Artwork, rendering or diagram, not a photograph" },
  processed: { label: "PROCESSED", cls: "border-violet/50 text-violet", title: "Enhanced or processed (often by citizen scientists) from spacecraft data" },
};

export function KindBadge({ kind }: { kind: ImageryKind }) {
  const s = STYLE[kind];
  return <span className={`mono inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] tracking-[0.12em] ${s.cls}`} title={s.title}>{s.label}</span>;
}
