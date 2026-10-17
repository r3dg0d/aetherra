import type { Metadata } from "next";
import { OrbitClient } from "./OrbitClient";
export const metadata: Metadata = { title: "ORBIT · AETHERRA" };
export default function Page() { return <OrbitClient />; }
