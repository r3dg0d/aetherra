import type { Metadata } from "next";
import { SkyClient } from "./SkyClient";
export const metadata: Metadata = { title: "SKY · AETHERRA" };
export default function Page() { return <SkyClient />; }
