"use client";
import dynamic from "next/dynamic";
const AscentSim = dynamic(() => import("@/components/ascent/AscentSim"), { ssr: false });
export function AscentClient() { return <AscentSim />; }
