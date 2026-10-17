"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { satrecFromOmm, positionAt, type OmmLike, type SatRec } from "@/lib/orbit/sgp4";
import { ecefToScene, EARTH_RADIUS_KM } from "@/lib/astro/coords";
import { getSimDate } from "@/lib/store/time";
import * as sat from "@/lib/orbit/satellite";

/** ISS position from CelesTrak elements via SGP4 (PREDICTED), with the current orbit ring. */
export function IssMarker({ onStatus }: { onStatus?: (s: string) => void }) {
  const [rec, setRec] = useState<SatRec | null>(null);
  const ref = useRef<THREE.Group>(null);
  const [ring, setRing] = useState<[number, number, number][]>([]);
  useEffect(() => {
    fetch("/api/satellites?group=stations").then((r) => r.json()).then((j) => {
      const iss = (j.data as (OmmLike & { NORAD_CAT_ID: number })[]).find((s) => s.NORAD_CAT_ID === 25544);
      if (iss) { setRec(satrecFromOmm(iss)); onStatus?.(`ISS from CelesTrak elements (${j.dataClass === "UNAVAILABLE" ? "unavailable" : "SGP4 PREDICTED"})`); }
      else onStatus?.("ISS elements unavailable");
    }).catch(() => onStatus?.("CelesTrak unavailable"));
  }, [onStatus]);
  const last = useRef(0);
  useFrame(() => {
    if (!rec || !ref.current) return;
    const d = getSimDate();
    if (Math.abs(d.getTime() - last.current) < 250) return;
    const p = positionAt(rec, d);
    if (!p) return;
    ref.current.position.set(...ecefToScene(p.ecf[0] / EARTH_RADIUS_KM, p.ecf[1] / EARTH_RADIUS_KM, p.ecf[2] / EARTH_RADIUS_KM));
    if (Math.abs(d.getTime() - last.current) > 20_000) {
      // Orbit ring: one period of ECI positions rotated with the current GMST (inertial ellipse in Earth-fixed view).
      const gmst = sat.gstime(d), pts: [number, number, number][] = [];
      for (let m = 0; m <= 93; m += 1) {
        const pv = sat.propagate(rec, new Date(d.getTime() + m * 60000));
        if (!pv || typeof pv.position === "boolean") continue;
        const f = sat.eciToEcf(pv.position, gmst);
        pts.push(ecefToScene(f.x / EARTH_RADIUS_KM, f.y / EARTH_RADIUS_KM, f.z / EARTH_RADIUS_KM));
      }
      setRing(pts);
    }
    last.current = d.getTime();
  });
  const color = useMemo(() => new THREE.Color("#42E2D0"), []);
  if (!rec) return null;
  return (
    <>
      {ring.length > 2 && <Line points={ring} color="#42E2D0" lineWidth={1} transparent opacity={0.35} />}
      <group ref={ref}>
        <mesh><sphereGeometry args={[0.012, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
        <Html distanceFactor={6} style={{ pointerEvents: "none" }} center zIndexRange={[10, 0]}>
          <div className="mono whitespace-nowrap text-[10px] text-teal" style={{ transform: "translate(18px, -10px)" }}>ISS · <span className="text-starlight/60">PREDICTED</span></div>
        </Html>
      </group>
    </>
  );
}
