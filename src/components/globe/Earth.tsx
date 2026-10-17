"use client";
import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToVec3 } from "@/lib/astro/coords";
import { subsolarPoint } from "@/lib/astro/sky";
import { getSimDate } from "@/lib/store/time";
import type { Quality } from "@/lib/store/app";

const vert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir; uniform float lightsGain;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 day = texture2D(dayMap, vUv).rgb;
  vec3 night = texture2D(nightMap, vUv).rgb;
  float c = dot(n, sunDir);
  float dayMix = smoothstep(-0.10, 0.14, c);
  float lum = dot(night, vec3(0.299, 0.587, 0.114));
  vec3 lights = vec3(1.0, 0.78, 0.48) * pow(smoothstep(0.12, 0.85, lum), 1.4) * lightsGain + night * 0.05;
  vec3 lit = day * (0.18 + 1.05 * max(c, 0.0));
  vec3 col = mix(lights, lit, dayMix);
  vec3 v = normalize(cameraPosition - vW);
  vec3 h = normalize(sunDir + v);
  float water = smoothstep(0.03, 0.22, day.b - day.r) * (1.0 - smoothstep(0.35, 0.6, day.g));
  col += vec3(0.75, 0.88, 1.0) * pow(max(dot(n, h), 0.0), 70.0) * water * dayMix * 0.7;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += vec3(0.32, 0.75, 1.0) * fres * (0.06 + 0.55 * dayMix);
  float twilight = smoothstep(-0.22, 0.0, c) * (1.0 - smoothstep(0.0, 0.22, c));
  col += vec3(0.47, 0.34, 1.0) * twilight * 0.07;
  gl_FragColor = vec4(col, 1.0);
}`;

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const atmoFrag = /* glsl */ `
uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  float rim = pow(clamp(1.0 - abs(dot(normalize(vN), v)), 0.0, 1.0), 2.4);
  float lit = smoothstep(-0.35, 0.45, dot(normalize(vN), sunDir));
  vec3 col = mix(vec3(0.47, 0.34, 1.0) * 0.35, vec3(0.26, 0.80, 1.0), lit);
  gl_FragColor = vec4(col, rim * (0.12 + 0.9 * lit));
}`;

/** Earth-fixed globe of radius 1 (6371 km). Sun direction is updated from the simulation clock. */
export function Earth({ quality = "medium", onSun, fixedSunLocal, segments }: { quality?: Quality; onSun?: (v: THREE.Vector3) => void; fixedSunLocal?: [number, number, number]; segments?: number }) {
  const res = quality === "high" ? "4k" : "2k";
  const [day, night] = useLoader(THREE.TextureLoader, [`/textures/earth_day_${res}.jpg`, `/textures/earth_night_${res}.jpg`]);
  const gl = useThree((s) => s.gl);
  useMemo(() => {
    for (const t of [day, night]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); }
  }, [day, night, gl]);
  const uniforms = useMemo(() => ({ dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, lightsGain: { value: 1.6 } }), [day, night]);
  const atmo = useMemo(() => ({ sunDir: uniforms.sunDir }), [uniforms]);
  const last = useRef(0);
  useFrame(() => {
    if (fixedSunLocal) { uniforms.sunDir.value.set(...fixedSunLocal).normalize(); return; }
    const d = getSimDate();
    if (Math.abs(d.getTime() - last.current) < 1000) return;
    last.current = d.getTime();
    const s = subsolarPoint(d);
    uniforms.sunDir.value.set(...latLonToVec3(s.lat, s.lon)).normalize();
    onSun?.(uniforms.sunDir.value);
  });
  const seg = segments ?? (quality === "low" ? 96 : 160);
  return (
    <group>
      <mesh name="earth">
        <sphereGeometry args={[1, seg, seg / 2]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
      </mesh>
      <mesh scale={1.028}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={atmo} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
