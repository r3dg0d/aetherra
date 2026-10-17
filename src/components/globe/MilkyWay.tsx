"use client";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Procedural Milky Way band, positioned with the real J2000 → galactic rotation so the band, the bulge
 * (Sagittarius) and the dust lane sit where they are on the sky. It is an artistic approximation of brightness,
 * not survey imagery. Rendered inside the Starfield group (equatorial frame, rotated by sidereal time).
 */
const vert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
uniform float intensity; varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  // Scene frame → equatorial (x, y, z) = (d.x, -d.z, d.y), then IAU J2000 → galactic.
  vec3 e = vec3(vDir.x, -vDir.z, vDir.y);
  vec3 g = vec3(
    dot(vec3(-0.0548755604, -0.8734370902, -0.4838350155), e),
    dot(vec3( 0.4941094279, -0.4448296300,  0.7469822445), e),
    dot(vec3(-0.8676661490, -0.1980763734,  0.4559837762), e));
  float l = atan(g.y, g.x);
  float b = asin(clamp(g.z, -1.0, 1.0));
  float n = fbm(vDir * 6.0);
  float n2 = fbm(vDir * 22.0 + 3.1);
  float bulge = exp(-(l * l) / 0.7) * exp(-(b * b) / 0.03);
  float band = exp(-(b * b) / (0.022 + 0.02 * n)) * (0.45 + 0.55 * exp(-(l * l) / 2.6));
  float wide = exp(-(b * b) / 0.25) * 0.18;
  float dust = 1.0 - 0.75 * exp(-(b - 0.01) * (b - 0.01) / 0.0012) * smoothstep(0.35, 0.75, n2) * exp(-(l * l) / 3.0);
  float lum = (band * (0.55 + 0.9 * n) + bulge * 1.2 + wide * n) * dust;
  vec3 col = mix(vec3(0.62, 0.68, 0.95), vec3(1.0, 0.86, 0.7), clamp(bulge * 2.0, 0.0, 1.0));
  col += vec3(0.47, 0.34, 1.0) * 0.12 * n2 * band;
  gl_FragColor = vec4(col * lum * intensity, 1.0);
  #include <colorspace_fragment>
}`;

export function MilkyWay({ radius = 790, intensity = 0.16 }: { radius?: number; intensity?: number }) {
  const uniforms = useMemo(() => ({ intensity: { value: intensity } }), [intensity]);
  return (
    <mesh frustumCulled={false} raycast={() => null} renderOrder={-10}>
      <sphereGeometry args={[radius, 96, 48]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} transparent blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
