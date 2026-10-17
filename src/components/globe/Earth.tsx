"use client";
import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToVec3 } from "@/lib/astro/coords";
import { subsolarPoint } from "@/lib/astro/sky";
import { getSimDate } from "@/lib/store/time";
import { useApp } from "@/lib/store/app";
import { useQuality } from "@/lib/quality";

const vert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Surface: day/night blend with a warm terminator, city lights that only appear past civil twilight,
// ocean specular, cloud shadows, and an inner Rayleigh-like Fresnel rim.
const frag = /* glsl */ `
uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D cloudMap;
uniform vec3 sunDir; uniform float lightsGain; uniform float cloudAmt;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 day = pow(texture2D(dayMap, vUv).rgb, vec3(1.18)) * 0.92;
  vec3 night = texture2D(nightMap, vUv).rgb;
  float cloud = texture2D(cloudMap, vUv).r * cloudAmt;
  float c = dot(n, sunDir);
  // Soft wrap lighting and a smooth terminator ~6 degrees wide.
  float dayMix = smoothstep(-0.06, 0.12, c);
  float diffuse = max(c * 0.92 + 0.08, 0.0);
  // Cloud shadow: sample the cloud map displaced away from the sun.
  vec3 tang = normalize(sunDir - n * c);
  vec2 shOff = vec2(-tang.z, tang.y) * 0.0025;
  float shadow = texture2D(cloudMap, vUv + shOff).r * cloudAmt * 0.45;
  vec3 lit = day * (0.06 + 1.12 * diffuse) * (1.0 - shadow);
  // Warm low-sun tint near the terminator on the day side.
  float sunset = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.08, 0.32, c));
  lit *= mix(vec3(1.0), vec3(1.18, 0.86, 0.68), sunset * 0.8);
  // City lights: emerge only past the terminator (≈ civil twilight), dimmed by clouds.
  float lum = dot(night, vec3(0.299, 0.587, 0.114));
  float nightSide = smoothstep(0.02, -0.14, c);
  vec3 lights = vec3(1.0, 0.76, 0.45) * pow(smoothstep(0.1, 0.85, lum), 1.35) * lightsGain * nightSide * (1.0 - cloud * 0.75);
  vec3 col = lit * dayMix + lights + night * 0.015 * (1.0 - dayMix);
  // Ocean glint.
  vec3 h = normalize(sunDir + v);
  float water = smoothstep(0.03, 0.22, day.b - day.r) * (1.0 - smoothstep(0.35, 0.6, day.g)) * (1.0 - cloud);
  col += vec3(1.0, 0.92, 0.8) * pow(max(dot(n, h), 0.0), 90.0) * water * dayMix * 0.9;
  // Inner atmosphere: view-angle Fresnel tinted by sun angle (blue by day, violet in twilight).
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  float twilight = smoothstep(-0.25, 0.0, c) * (1.0 - smoothstep(0.0, 0.3, c));
  vec3 rayleigh = mix(vec3(0.47, 0.34, 1.0), vec3(0.32, 0.72, 1.0), dayMix);
  col = mix(col, rayleigh, fres * (0.08 + 0.62 * smoothstep(-0.2, 0.35, c)));
  col += vec3(1.0, 0.45, 0.25) * twilight * fres * 0.18;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const cloudFrag = /* glsl */ `
uniform sampler2D cloudMap; uniform vec3 sunDir; uniform float cloudAmt;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  float c = dot(n, sunDir);
  float a = texture2D(cloudMap, vUv).r;
  a = smoothstep(0.14, 0.95, a) * cloudAmt * 0.88;
  float lit = smoothstep(-0.12, 0.25, c);
  vec3 col = mix(vec3(0.03, 0.04, 0.08), vec3(1.0), lit);
  col *= mix(vec3(1.0), vec3(1.0, 0.75, 0.55), smoothstep(0.0, 0.1, c) * (1.0 - smoothstep(0.1, 0.3, c)));
  gl_FragColor = vec4(col, a * (0.35 + 0.6 * lit));
  #include <colorspace_fragment>
}`;

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// Outer glow shell (back faces): limb brightening with forward scattering toward the sun.
const atmoFrag = /* glsl */ `
uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  vec3 n = normalize(vN);
  float limb = 1.0 - abs(dot(n, v));
  float rim = pow(clamp(limb, 0.0, 1.0), 3.2);
  float lit = smoothstep(-0.3, 0.4, dot(n, sunDir));
  float forward = pow(max(dot(-v, sunDir), 0.0), 6.0);
  vec3 day = vec3(0.30, 0.74, 1.0);
  vec3 dusk = vec3(0.95, 0.5, 0.35);
  float tw = smoothstep(-0.3, 0.0, dot(n, sunDir)) * (1.0 - smoothstep(0.0, 0.35, dot(n, sunDir)));
  vec3 col = mix(vec3(0.47, 0.34, 1.0) * 0.25, day, lit) + dusk * tw * 0.35 + vec3(1.0, 0.85, 0.7) * forward * 0.5;
  gl_FragColor = vec4(col, rim * (0.06 + 0.8 * lit + 0.6 * forward));
  #include <colorspace_fragment>
}`;

const blank = (() => {
  if (typeof document === "undefined") return null;
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t;
})();

/** Earth-fixed globe of radius 1 (6371 km). Sun direction is updated from the simulation clock. */
export function Earth({ onSun, fixedSunLocal, segments, clouds: cloudsProp }: { onSun?: (v: THREE.Vector3) => void; fixedSunLocal?: [number, number, number]; segments?: number; clouds?: boolean }) {
  const q = useQuality();
  const showClouds = useApp((s) => s.showClouds) && (cloudsProp ?? true) && q.clouds != null;
  const urls = [`/textures/earth_day_${q.textures}.jpg`, `/textures/earth_night_${q.textures}.jpg`, `/textures/earth_clouds_${q.clouds ?? "1k"}.jpg`];
  const [day, night, cloudTex] = useLoader(THREE.TextureLoader, urls);
  const gl = useThree((s) => s.gl);
  useMemo(() => {
    for (const t of [day, night]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); }
    cloudTex.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
  }, [day, night, cloudTex, gl]);
  const sunDir = useMemo(() => ({ value: new THREE.Vector3(1, 0, 0) }), []);
  const cloudAmt = useMemo(() => ({ value: 1 }), []);
  const uniforms = useMemo(() => ({ dayMap: { value: day }, nightMap: { value: night }, cloudMap: { value: cloudTex ?? blank }, sunDir, lightsGain: { value: 1.7 }, cloudAmt }), [day, night, cloudTex, sunDir, cloudAmt]);
  const cloudUniforms = useMemo(() => ({ cloudMap: { value: cloudTex }, sunDir, cloudAmt }), [cloudTex, sunDir, cloudAmt]);
  const atmo = useMemo(() => ({ sunDir }), [sunDir]);
  const last = useRef(0);
  useFrame(() => {
    cloudAmt.value = showClouds ? 1 : 0;
    if (fixedSunLocal) { sunDir.value.set(...fixedSunLocal).normalize(); return; }
    const d = getSimDate();
    if (Math.abs(d.getTime() - last.current) < 1000) return;
    last.current = d.getTime();
    const s = subsolarPoint(d);
    sunDir.value.set(...latLonToVec3(s.lat, s.lon)).normalize();
    onSun?.(sunDir.value);
  });
  const seg = segments ?? q.segments;
  return (
    <group>
      <mesh name="earth">
        <sphereGeometry args={[1, seg, seg / 2]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
      </mesh>
      {showClouds && (
        <mesh scale={1.004} raycast={() => null}>
          <sphereGeometry args={[1, Math.min(seg, 128), Math.min(seg, 128) / 2]} />
          <shaderMaterial vertexShader={vert} fragmentShader={cloudFrag} uniforms={cloudUniforms} transparent depthWrite={false} />
        </mesh>
      )}
      <mesh scale={1.022} raycast={() => null}>
        <sphereGeometry args={[1, 96, 48]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={atmo} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
