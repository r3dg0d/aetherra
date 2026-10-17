"use client";
import { useEffect, useState } from "react";

/**
 * Groups a page's floating panels. On desktop it is layout-transparent (`display: contents`), so children keep their
 * own absolute positions. On phones (< 768 px) it becomes a collapsible bottom sheet that stacks the panels.
 */
export function Sheet({ title, children, defaultOpen = false, testId, openSignal }: { title: string; children: React.ReactNode; defaultOpen?: boolean; testId?: string; openSignal?: unknown }) {
  const [open, setOpen] = useState(defaultOpen);
  // Expand when something important appears (e.g. a selection).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  return (
    <section className="sheet" data-collapsed={!open} data-testid={testId} aria-label={title}>
      <button className="sheet-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }}><path d="m6 15 6-6 6 6" /></svg>
      </button>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
