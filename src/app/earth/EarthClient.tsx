"use client";
import dynamic from "next/dynamic";
const EarthPage = dynamic(() => import("@/components/cesium/EarthPage"), { ssr: false });
export function EarthClient() { return <EarthPage />; }
