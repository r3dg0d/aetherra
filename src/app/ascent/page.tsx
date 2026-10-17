import type { Metadata } from "next";
import { AscentClient } from "./AscentClient";
export const metadata: Metadata = { title: "ASCENT · AETHERRA" };
export default function Page() { return <AscentClient />; }
