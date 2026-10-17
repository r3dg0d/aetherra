import type { Metadata } from "next";
import { FlightsClient } from "./FlightsClient";
export const metadata: Metadata = { title: "FLIGHTS · AETHERRA" };
export default function Page() { return <FlightsClient />; }
