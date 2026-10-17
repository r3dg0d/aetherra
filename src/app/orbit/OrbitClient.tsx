"use client";
import dynamic from "next/dynamic";
const OrbitPage = dynamic(() => import("@/components/orbit/OrbitPage"), { ssr: false });
export function OrbitClient() { return <OrbitPage />; }
