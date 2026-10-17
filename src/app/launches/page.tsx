import type { Metadata } from "next";
import { LaunchesClient } from "./LaunchesClient";
export const metadata: Metadata = { title: "LAUNCHES · AETHERRA Mission Control" };
export default function Page() { return <LaunchesClient />; }
