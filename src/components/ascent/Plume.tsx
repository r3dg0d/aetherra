"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vert = /* glsl */ `
attribute float life; attribute float seed; uniform float dpr; uniform float scale; varying float vLife; varying float vSeed;
void main() {
  vLife = life; vSeed = seed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(scale * (0.4 + 2.2 * life) * dpr / max(-mv.z, 1e-5), 1.0, 256.0);
  gl_Position = projectionMatrix * mv;
}`;
// HDR core (> 1) so bloom picks up the hot exhaust; low in the atmosphere the tail turns to grey smoke.
const frag = /* glsl */ `
uniform float smoke; uniform float vac; varying float vLife; varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 hot = vec3(2.4, 2.0, 1.4);
  vec3 warm = vec3(1.6, 0.7, 0.25);
  vec3 sm = vec3(0.55, 0.55, 0.58);
  vec3 vacc = vec3(0.9, 0.75, 1.4);
  vec3 col = mix(hot, warm, smoothstep(0.0, 0.35, vLife));
  col = mix(col, mix(sm, vacc, vac), smoothstep(0.3, 0.9, vLife) * mix(smoke, 0.6, vac));
  float a = soft * (1.0 - smoothstep(0.5, 1.0, vLife)) * (0.32 - 0.15 * vSeed * vLife);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

/**
 * Particle exhaust in the vehicle's local frame (units km, nozzle at y = -2 m).
 * `get()` returns throttle 0..1 and ambient density fraction 0..1. The plume lengthens with throttle and
 * balloons as the air thins (under-expanded exhaust at altitude).
 */
export function Plume({ count, get }: { count: number; get: () => { throttle: number; density: number } }) {
  const m = 0.001;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("life", new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    const seed = new Float32Array(count); for (let i = 0; i < count; i++) seed[i] = Math.random();
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const parts = useMemo(() => Array.from({ length: count }, () => ({ age: Math.random(), life: 0.5 + Math.random() * 0.6, dir: new THREE.Vector3(), speed: 0 })), [count]);
  const uniforms = useMemo(() => ({ dpr: { value: 1 }, scale: { value: 0.006 }, smoke: { value: 1 }, vac: { value: 0 } }), []);
  const pts = useRef<THREE.Points>(null);
  useFrame((st, dt) => {
    const { throttle, density } = get();
    uniforms.dpr.value = st.viewport.dpr;
    const vac = 1 - Math.min(1, Math.sqrt(density));
    uniforms.vac.value = vac; uniforms.smoke.value = Math.min(1, density * 4);
    const cam = st.camera as THREE.PerspectiveCamera;
    const proj = st.size.height / (2 * Math.tan(((cam.fov ?? 50) * Math.PI) / 360));
    uniforms.scale.value = (1.6 + 10 * vac) * m * (0.5 + 0.5 * throttle) * proj;
    const pos = geo.attributes.position as THREE.BufferAttribute, life = geo.attributes.life as THREE.BufferAttribute;
    const spread = 0.05 + 0.7 * vac;
    for (let i = 0; i < count; i++) {
      const p = parts[i];
      p.age += Math.min(dt, 0.05) / p.life;
      if (p.age >= 1) {
        if (throttle <= 0.01) { life.setX(i, 1); continue; }
        p.age = 0; p.life = 0.18 + Math.random() * 0.32 * (0.6 + throttle);
        const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
        p.dir.set(Math.cos(a) * r, -1, Math.sin(a) * r).normalize();
        p.speed = (70 + 60 * throttle) * m * (1 + vac * 1.5);
      }
      const t = p.age * p.life;
      pos.setXYZ(i, p.dir.x * p.speed * t, -2 * m + p.dir.y * p.speed * t, p.dir.z * p.speed * t);
      life.setX(i, p.age);
    }
    pos.needsUpdate = true; life.needsUpdate = true;
  });
  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
