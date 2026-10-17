import type { Metadata } from "next";
import { StatusClient } from "./StatusClient";
export const metadata: Metadata = { title: "Data sources & status · AETHERRA" };
export default function Page() { return <StatusClient />; }
