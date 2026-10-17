"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bvToRgb, loadConstellations, loadStars, type Constellation, type StarRow } from "@/lib/astro/catalog";
import { latLonToVec3, DEG } from "@/lib/astro/coords";
import { gastDeg } from "@/lib/astro/sky";
import { getSimDate } from "@/lib/store/time";
import { MilkyWay } from "./MilkyWay";

const vert = /* glsl */ `
attribute float size; attribute vec3 color; attribute float boost; varying vec3 vColor; varying float vBoost; uniform float dpr;
void main() { vColor = color; vBoost = boost; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * dpr; gl_Position = projectionMatrix * mv; }`;
const frag = /* glsl */ `
varying vec3 vColor; varying float vBoost;
void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); a = pow(a, 1.6);
  // Bright stars get an HDR core (> 1.0) so the bloom pass picks them up.
  gl_FragColor = vec4(vColor * (0.6 + 0.6 * a) * (1.0 + vBoost * a * a), a);
  #include <colorspace_fragment> }`;

/**
 * Real star positions (J2000, Hipparcos-derived catalog, mag ≤ 6) on a celestial sphere that rotates with
 * Greenwich sidereal time so stars appear where they actually are relative to the Earth-fixed globe.
 */
export function Starfield({ radius = 800, maxMag = 6, lines = true, milkyWay = false }: { radius?: number; maxMag?: number; lines?: boolean; milkyWay?: boolean }) {
  const [stars, setStars] = useState<StarRow[] | null>(null);
  const [cons, setCons] = useState<Constellation[] | null>(null);
  const group = useRef<THREE.Group>(null);
  useEffect(() => { loadStars().then((c) => setStars(c.stars)); if (lines) loadConstellations().then((c) => setCons(c.constellations)); }, [lines]);
  const geo = useMemo(() => {
    if (!stars) return null;
    const list = stars.filter((s) => s[3] <= maxMag);
    const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3), size = new Float32Array(list.length), boost = new Float32Array(list.length);
    list.forEach((s, i) => {
      pos.set(latLonToVec3(s[2], s[1], radius), i * 3);
      const [r, g, b] = bvToRgb(s[4]);
      col.set([r, g, b], i * 3);
      size[i] = Math.max(1.2, Math.min(9, 1.2 + (6.5 - s[3]) * 1.05));
      boost[i] = Math.max(0, Math.min(2.5, (2.2 - s[3]) * 0.9));
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("boost", new THREE.BufferAttribute(boost, 1));
    return g;
  }, [stars, maxMag, radius]);
  const lineGeo = useMemo(() => {
    if (!cons) return null;
    const pts: number[] = [];
    for (const c of cons) for (const seg of c.lines) for (let i = 0; i < seg.length - 1; i++) pts.push(...latLonToVec3(seg[i][1], seg[i][0], radius * 0.999), ...latLonToVec3(seg[i + 1][1], seg[i + 1][0], radius * 0.999));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [cons, radius]);
  const uniforms = useMemo(() => ({ dpr: { value: typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio) : 1 } }), []);
  useFrame((st) => { uniforms.dpr.value = st.viewport.dpr; if (group.current) group.current.rotation.y = -gastDeg(getSimDate()) * DEG; });
  return (
    <group ref={group}>
      {milkyWay && <MilkyWay radius={radius * 0.985} />}
      {geo && (
        <points geometry={geo} frustumCulled={false}>
          <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
      {lineGeo && (
        <lineSegments geometry={lineGeo} frustumCulled={false}>
          <lineBasicMaterial color="#7956FF" transparent opacity={0.18} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}
