"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Controls = { enabled: boolean; target: THREE.Vector3; update: () => void } | null;

/**
 * Point on a cinematic orbital arc from `a` to `b` (both camera positions around the origin):
 * the direction is slerped on the sphere, the distance is eased, and a bump pulls the camera back mid-flight.
 * Pure and testable.
 */
export function arcPoint(a: THREE.Vector3, b: THREE.Vector3, t: number, out = new THREE.Vector3()) {
  const e = easeInOutCubic(Math.min(1, Math.max(0, t)));
  const da = a.length(), db = b.length();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const ua = a.clone().normalize(), ub = b.clone().normalize();
  qb.setFromUnitVectors(ua, ub);
  const q = qa.slerp(qb, e);
  const angle = ua.angleTo(ub);
  const bump = Math.sin(Math.PI * e) * Math.min(da, db) * 0.35 * Math.min(1, angle / 1.2);
  return out.copy(ua).applyQuaternion(q).multiplyScalar(THREE.MathUtils.lerp(da, db, e) + bump);
}

/**
 * Smooth fly-to for scenes orbiting the origin. When `target` changes, the camera travels along an arc to look
 * at it from `distance` (or ×factor of its radius). Reduced motion: jumps instantly. Controls are paused while flying.
 */
export function CinematicFlyTo({ target, distanceFactor = 1.9, minDistance = 2.4, duration = 2.2, reduced = false }: {
  target: [number, number, number] | null; distanceFactor?: number; minDistance?: number; duration?: number; reduced?: boolean;
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    if (!target) return;
    const v = new THREE.Vector3(...target);
    const to = v.clone().normalize().multiplyScalar(Math.max(minDistance, v.length() * distanceFactor));
    if (reduced) { camera.position.copy(to); camera.lookAt(0, 0, 0); controls?.update(); return; }
    anim.current = { from: camera.position.clone(), to, t: 0 };
  }, [target, camera, controls, distanceFactor, minDistance, reduced]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a) return;
    a.t += dt / duration;
    if (controls) controls.enabled = false;
    arcPoint(a.from, a.to, a.t, camera.position);
    camera.lookAt(0, 0, 0);
    if (a.t >= 1) { anim.current = null; if (controls) { controls.enabled = true; controls.update(); } }
  });
  return null;
}

/**
 * Opening shot: the camera sweeps in from deep space to the home framing. Any user input interrupts it
 * (handled by the parent via `active`). Not rendered at all when reduced motion is on.
 */
export function IntroOrbit({ active, to = [2.2, 1.1, 2.6], duration = 7, onDone }: { active: boolean; to?: [number, number, number]; duration?: number; onDone: () => void }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const t = useRef(0);
  const from = useRef(new THREE.Vector3(-14, 6.5, -26));
  const goal = useRef(new THREE.Vector3(...to));
  const started = useRef(false);
  useFrame((_, dt) => {
    if (!active) { if (started.current) { started.current = false; if (controls) { controls.enabled = true; controls.update(); } } return; }
    if (!started.current) { started.current = true; t.current = 0; camera.position.copy(from.current); }
    if (controls) controls.enabled = false;
    t.current += Math.min(dt, 0.05) / duration;
    const e = easeOutCubic(Math.min(1, t.current));
    // Spiral in: slerp direction with an extra azimuth sweep, distance eased exponentially.
    const p = arcPoint(from.current, goal.current, e);
    const sweep = (1 - e) * 1.4;
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), sweep);
    camera.position.copy(p);
    camera.lookAt(0, 0, 0);
    if (t.current >= 1) onDone();
  });
  return null;
}
