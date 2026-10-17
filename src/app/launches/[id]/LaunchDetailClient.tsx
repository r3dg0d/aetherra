"use client";
import dynamic from "next/dynamic";
const LaunchDetail = dynamic(() => import("@/components/launches/LaunchDetail"), { ssr: false });
export function LaunchDetailClient({ id }: { id: string }) { return <LaunchDetail id={id} />; }
