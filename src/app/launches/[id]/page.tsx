import { LaunchDetailClient } from "./LaunchDetailClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LaunchDetailClient id={id} />;
}
