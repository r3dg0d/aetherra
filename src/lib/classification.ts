/**
 * Data classification. Every datum shown in AETHERRA carries exactly one of these labels.
 * Never present SIMULATED or PREDICTED data as LIVE.
 */
export const DATA_CLASSES = ["LIVE", "DELAYED", "HISTORICAL", "PREDICTED", "SIMULATED", "UNAVAILABLE"] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const DATA_CLASS_INFO: Record<DataClass, { color: string; description: string }> = {
  LIVE: { color: "#42E2D0", description: "Received from the source within its expected refresh interval." },
  DELAYED: { color: "#52BFFF", description: "Real data, but older than the source's expected refresh interval or intentionally delayed by the provider." },
  HISTORICAL: { color: "#A78BFA", description: "Archived real data for a past time." },
  PREDICTED: { color: "#F4F7FF", description: "Computed from a model (e.g. SGP4 propagation, ephemeris, dead reckoning)." },
  SIMULATED: { color: "#FFB454", description: "Synthetic data produced by AETHERRA for demonstration. Not a real-world measurement." },
  UNAVAILABLE: { color: "#FF6B81", description: "The source is not configured, unreachable, or returned no usable data." },
};
