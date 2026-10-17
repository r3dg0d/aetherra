"use client";
import { useEffect, useState } from "react";
import type * as CesiumNS from "cesium";

export type CesiumLib = typeof CesiumNS;
declare global { interface Window { Cesium?: CesiumLib; CESIUM_BASE_URL?: string } }

let p: Promise<CesiumLib> | null = null;

/** Loads Cesium's prebuilt bundle from /cesium (copied from node_modules at install) instead of bundling it. */
export function loadCesium(): Promise<CesiumLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.Cesium) return Promise.resolve(window.Cesium);
  p ??= new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = "/cesium/";
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/cesium/Cesium.js"; s.async = true;
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("Cesium failed to initialise")));
    s.onerror = () => { p = null; reject(new Error("Cesium assets missing (run npm install to copy them)")); };
    document.head.appendChild(s);
  });
  return p;
}

export function useCesium() {
  const [lib, setLib] = useState<CesiumLib | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadCesium().then(setLib).catch((e) => setError(e.message)); }, []);
  return { Cesium: lib, error };
}

/** Viewer with no Cesium ion dependency by default. ion token (optional) adds terrain + OSM Buildings. */
export function createViewer(C: CesiumLib, el: HTMLElement, opts: { baseLayer: CesiumNS.ImageryLayer }) {
  const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (token) C.Ion.defaultAccessToken = token;
  const viewer = new C.Viewer(el, {
    baseLayer: opts.baseLayer, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, terrainProvider: new C.EllipsoidTerrainProvider(), requestRenderMode: false,
  });
  viewer.scene.globe.enableLighting = true;
  viewer.scene.backgroundColor = C.Color.fromCssColorString("#030409");
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.showGroundAtmosphere = true;
  return { viewer, ionEnabled: !!token };
}

export const osmLayer = (C: CesiumLib) => new C.ImageryLayer(new C.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
