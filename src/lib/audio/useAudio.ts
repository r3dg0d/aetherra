"use client";
import { useEffect } from "react";
import { audio } from "./engine";
import type { Scene } from "./params";
import { useApp } from "@/lib/store/app";
import { useReducedMotion } from "@/lib/useReducedMotion";

/** Keeps the engine in sync with persisted settings; unlocks audio on the first gesture; UI ticks on clicks. */
export function useAudioSystem() {
  const { muted, volume, ambient, uiSounds } = useApp();
  const calm = useReducedMotion();
  useEffect(() => { audio.configure({ muted, volume, ambient, ui: uiSounds, calm }); }, [muted, volume, ambient, uiSounds, calm]);
  useEffect(() => {
    const unlock = () => { if (!useApp.getState().muted) audio.unlock(); };
    const click = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button, a, [role=button], select, input[type=checkbox]");
      if (el && !el.hasAttribute("data-silent")) audio.tick();
    };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock); window.addEventListener("click", click);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); window.removeEventListener("click", click); };
  }, []);
}

/** Ambient drone for the current scene while mounted. */
export function useAmbient(scene: Scene) {
  useEffect(() => { audio.setScene(scene); return () => audio.setScene(null); }, [scene]);
}
