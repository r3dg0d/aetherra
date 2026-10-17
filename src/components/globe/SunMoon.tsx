"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToVec3, EARTH_RADIUS_KM } from "@/lib/astro/coords";
import { subsolarPoint, sublunarPoint } from "@/lib/astro/sky";
import { getSimDate } from "@/lib/store/time";

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.15, "rgba(255,244,220,0.9)"); grd.addColorStop(0.4, "rgba(255,210,150,0.25)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Sun glow at the true solar direction and the Moon at its true (scaled) geocentric position. */
export function SunMoon({ showMoon = true }: { showMoon?: boolean }) {
  const sun = useRef<THREE.Sprite>(null);
  const moon = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const tex = useMemo(() => (typeof document !== "undefined" ? glowTexture() : null), []);
  useFrame(() => {
    const d = getSimDate();
    const s = subsolarPoint(d);
    const v = new THREE.Vector3(...latLonToVec3(s.lat, s.lon, 600));
    sun.current?.position.copy(v);
    light.current?.position.copy(v);
    if (moon.current) {
      const m = sublunarPoint(d);
      moon.current.position.set(...latLonToVec3(m.lat, m.lon, m.distKm / EARTH_RADIUS_KM));
    }
  });
  return (
    <>
      <directionalLight ref={light} intensity={2.2} />
      <ambientLight intensity={0.03} />
      {tex && <sprite ref={sun} scale={[60, 60, 1]}><spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>}
      {showMoon && (
        <mesh ref={moon} name="moon">
          <sphereGeometry args={[1737.4 / EARTH_RADIUS_KM, 48, 24]} />
          <meshStandardMaterial color="#b9b6b0" roughness={0.95} />
        </mesh>
      )}
    </>
  );
}
