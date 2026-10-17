import type { Metadata } from "next";
import { EarthClient } from "./EarthClient";
export const metadata: Metadata = { title: "EARTH · AETHERRA" };
export default function Page() { return <EarthClient />; }
