"use client";
import { forwardRef } from "react";
import * as THREE from "three";

/** AETHER-1: original procedural vehicle. Units: km (vehicle ≈ 62 m tall). Origin at engine plane, +Y = nose. */
export const Rocket = forwardRef<THREE.Group, { stage: number; thrust: number }>(function Rocket({ stage, thrust }, ref) {
  const m = 0.001; // metres → km
  return (
    <group ref={ref}>
      {stage === 0 && (
        <group>
          <mesh position={[0, 20 * m, 0]}><cylinderGeometry args={[1.85 * m, 1.85 * m, 40 * m, 32]} /><meshStandardMaterial color="#e9ecf5" metalness={0.3} roughness={0.45} /></mesh>
          <mesh position={[0, 37 * m, 0]}><cylinderGeometry args={[1.86 * m, 1.86 * m, 1.2 * m, 32]} /><meshStandardMaterial color="#7956FF" /></mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 2.6 * m, 3 * m, Math.sin((i * Math.PI) / 2) * 2.6 * m]} rotation={[0, -(i * Math.PI) / 2, 0]}>
              <boxGeometry args={[1.8 * m, 5 * m, 0.25 * m]} /><meshStandardMaterial color="#1b2238" />
            </mesh>
          ))}
          <mesh position={[0, -1 * m, 0]}><cylinderGeometry args={[1.2 * m, 1.7 * m, 2 * m, 24]} /><meshStandardMaterial color="#2a2f3c" metalness={0.8} roughness={0.3} /></mesh>
        </group>
      )}
      <group position={[0, (stage === 0 ? 40 : 0) * m, 0]}>
        <mesh position={[0, 7 * m, 0]}><cylinderGeometry args={[1.85 * m, 1.85 * m, 14 * m, 32]} /><meshStandardMaterial color="#dfe4f0" metalness={0.3} roughness={0.4} /></mesh>
        <mesh position={[0, 18 * m, 0]}><cylinderGeometry args={[2.1 * m, 2.1 * m, 8 * m, 32]} /><meshStandardMaterial color="#f4f7ff" metalness={0.2} roughness={0.35} /></mesh>
        <mesh position={[0, 24.5 * m, 0]}><coneGeometry args={[2.1 * m, 5 * m, 32]} /><meshStandardMaterial color="#f4f7ff" metalness={0.2} roughness={0.35} /></mesh>
        <mesh position={[0, 14.2 * m, 0]}><cylinderGeometry args={[1.87 * m, 1.87 * m, 0.6 * m, 32]} /><meshStandardMaterial color="#42E2D0" emissive="#42E2D0" emissiveIntensity={0.4} /></mesh>
        {stage === 1 && <mesh position={[0, -1 * m, 0]}><cylinderGeometry args={[0.9 * m, 1.5 * m, 2.5 * m, 24]} /><meshStandardMaterial color="#2a2f3c" metalness={0.8} roughness={0.3} /></mesh>}
      </group>
      {thrust > 0 && (
        <group position={[0, -2 * m, 0]} scale={[1, 0.5 + thrust, 1]}>
          <mesh position={[0, -9 * m, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[1.6 * m, 18 * m, 24, 1, true]} /><meshBasicMaterial color="#FFB454" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, -5 * m, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.9 * m, 10 * m, 24, 1, true]} /><meshBasicMaterial color="#F4F7FF" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <pointLight color="#FFB454" intensity={4} distance={0.4} />
        </group>
      )}
    </group>
  );
});
