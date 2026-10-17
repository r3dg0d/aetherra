"use client";
import dynamic from "next/dynamic";
const LaunchesPage = dynamic(() => import("@/components/launches/LaunchesPage"), { ssr: false });
export function LaunchesClient() { return <LaunchesPage />; }
