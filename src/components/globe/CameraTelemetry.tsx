"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { vec3ToLatLon, EARTH_RADIUS_KM } from "@/lib/astro/coords";
import { useView } from "@/lib/store/app";

/** Publishes the sub-camera point, altitude and distance to the status bar ~5×/s. */
export function CameraTelemetry() {
  const last = useRef(0);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - last.current < 0.2) return;
    last.current = clock.elapsedTime;
    const p = camera.position;
    const ll = vec3ToLatLon(p.x, p.y, p.z);
    useView.getState().setCamera({ lat: ll.lat, lon: ll.lon, altKm: (ll.r - 1) * EARTH_RADIUS_KM, distanceKm: ll.r * EARTH_RADIUS_KM });
  });
  return null;
}
