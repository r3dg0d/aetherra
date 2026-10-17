"use client";
import dynamic from "next/dynamic";
const SkyPage = dynamic(() => import("@/components/sky/SkyPage"), { ssr: false });
export function SkyClient() { return <SkyPage />; }
