"use client";
import dynamic from "next/dynamic";
const FlightsPage = dynamic(() => import("@/components/flights/FlightsPage"), { ssr: false });
export function FlightsClient() { return <FlightsPage />; }
