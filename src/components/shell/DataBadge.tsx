"use client";
import { DATA_CLASS_INFO, type DataClass } from "@/lib/classification";

export function DataBadge({ value, note, size = "sm" }: { value: DataClass; note?: string; size?: "sm" | "xs" }) {
  const info = DATA_CLASS_INFO[value];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 ${size === "xs" ? "py-0 text-[9px]" : "py-0.5 text-[10px]"} font-medium tracking-[0.16em] mono`}
      style={{ borderColor: `${info.color}55`, color: info.color, background: `${info.color}12` }}
      title={`${value}: ${info.description}${note ? ` — ${note}` : ""}`}
      aria-label={`Data status ${value}${note ? `: ${note}` : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${value === "LIVE" ? "live-dot" : ""}`} style={{ background: info.color }} />
      {value}
    </span>
  );
}
