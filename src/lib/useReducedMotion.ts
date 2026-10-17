"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app";

/** Prefer the OS setting, then the user toggle. */
export function useReducedMotion() {
  const pref = useApp((s) => s.reducedMotion);
  const [sys, setSys] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSys(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return pref || sys;
}
