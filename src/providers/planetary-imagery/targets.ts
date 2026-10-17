/** Curated targets and NASA Image and Video Library queries. Each query is a mission/instrument "filter chip". */
export interface ImageryQuery { id: string; label: string; q: string; keywords?: string }
export interface ImageryTarget { id: string; label: string; parent?: string; rover?: boolean; queries: ImageryQuery[] }

export const TARGETS: ImageryTarget[] = [
  { id: "moon", label: "Moon", queries: [
    { id: "apollo", label: "Apollo", q: "Apollo lunar surface" },
    { id: "lro", label: "LRO", q: "Lunar Reconnaissance Orbiter LROC" },
    { id: "artemis", label: "Artemis", q: "Artemis Orion Moon" },
    { id: "earthrise", label: "Earthrise & far side", q: "lunar far side" },
  ] },
  { id: "mercury", label: "Mercury", queries: [
    { id: "messenger", label: "MESSENGER", q: "MESSENGER Mercury" },
    { id: "mariner10", label: "Mariner 10", q: "Mariner 10 Mercury" },
  ] },
  { id: "venus", label: "Venus", queries: [
    { id: "magellan", label: "Magellan radar", q: "Magellan Venus" },
    { id: "parker", label: "Parker Solar Probe", q: "Parker Solar Probe Venus" },
    { id: "mariner", label: "Mariner / Galileo", q: "Venus Mariner 10 Galileo" },
  ] },
  { id: "mars", label: "Mars", rover: true, queries: [
    { id: "hirise", label: "HiRISE (MRO)", q: "HiRISE Mars" },
    { id: "perseverance", label: "Perseverance (released)", q: "Perseverance rover Jezero" },
    { id: "curiosity", label: "Curiosity (released)", q: "Curiosity rover Gale crater" },
    { id: "viking", label: "Viking", q: "Viking Mars surface" },
  ] },
  { id: "jupiter", label: "Jupiter", queries: [
    { id: "junocam", label: "Juno / JunoCam", q: "JunoCam Jupiter" },
    { id: "galileo", label: "Galileo", q: "Galileo Jupiter atmosphere" },
    { id: "voyager", label: "Voyager", q: "Voyager Jupiter" },
  ] },
  { id: "io", label: "Io", parent: "jupiter", queries: [{ id: "io", label: "Io", q: "Io volcano Jupiter moon" }] },
  { id: "europa", label: "Europa", parent: "jupiter", queries: [{ id: "europa-galileo", label: "Galileo", q: "Europa Galileo" }, { id: "europa-juno", label: "Juno", q: "Europa Juno" }] },
  { id: "ganymede", label: "Ganymede", parent: "jupiter", queries: [{ id: "ganymede", label: "Ganymede", q: "Ganymede" }] },
  { id: "callisto", label: "Callisto", parent: "jupiter", queries: [{ id: "callisto", label: "Callisto", q: "Callisto Galileo" }] },
  { id: "saturn", label: "Saturn", queries: [
    { id: "cassini", label: "Cassini", q: "Cassini Saturn rings" },
    { id: "voyager", label: "Voyager", q: "Voyager Saturn" },
  ] },
  { id: "titan", label: "Titan", parent: "saturn", queries: [{ id: "titan", label: "Cassini / Huygens", q: "Titan Cassini" }] },
  { id: "enceladus", label: "Enceladus", parent: "saturn", queries: [{ id: "enceladus", label: "Cassini", q: "Enceladus Cassini" }] },
  { id: "uranus", label: "Uranus", queries: [{ id: "voyager", label: "Voyager 2", q: "Voyager Uranus" }] },
  { id: "neptune", label: "Neptune", queries: [{ id: "voyager", label: "Voyager 2", q: "Voyager Neptune" }, { id: "triton", label: "Triton", q: "Triton Voyager" }] },
  { id: "pluto", label: "Pluto", queries: [{ id: "newhorizons", label: "New Horizons", q: "New Horizons Pluto" }, { id: "charon", label: "Charon", q: "Charon New Horizons" }] },
];

export const targetById = (id: string | null | undefined) => TARGETS.find((t) => t.id === id);

/** SKY body name → imagery target id. */
export const bodyToTarget = (name: string): string | null => {
  const t = targetById(name.toLowerCase());
  return t ? t.id : null;
};

export interface RoverCamera { id: string; label: string }
export const ROVERS = {
  perseverance: {
    label: "Perseverance", mission: "Mars 2020 (Perseverance)", source: "mars-raw-m20" as const,
    cameras: [
      ["NAVCAM_LEFT", "Navcam (left)"], ["NAVCAM_RIGHT", "Navcam (right)"], ["MCZ_LEFT", "Mastcam-Z (left)"], ["MCZ_RIGHT", "Mastcam-Z (right)"],
      ["FRONT_HAZCAM_LEFT_A", "Front Hazcam (left)"], ["REAR_HAZCAM_LEFT", "Rear Hazcam (left)"], ["SHERLOC_WATSON", "SHERLOC WATSON"],
      ["SUPERCAM_RMI", "SuperCam RMI"], ["PIXL_MCC", "PIXL MCC"], ["SKYCAM", "MEDA SkyCam"], ["CACHECAM", "CacheCam"],
    ].map(([id, label]) => ({ id, label })) as RoverCamera[],
  },
  curiosity: {
    label: "Curiosity", mission: "Mars Science Laboratory (Curiosity)", source: "mars-raw-msl" as const,
    cameras: [
      ["NAV_LEFT_B", "Navcam (left)"], ["NAV_RIGHT_B", "Navcam (right)"], ["MAST_LEFT", "Mastcam (left)"], ["MAST_RIGHT", "Mastcam (right)"],
      ["FHAZ_LEFT_B", "Front Hazcam (left)"], ["RHAZ_LEFT_B", "Rear Hazcam (left)"], ["MAHLI", "MAHLI"], ["MARDI", "MARDI"], ["CHEMCAM_RMI", "ChemCam RMI"],
    ].map(([id, label]) => ({ id, label })) as RoverCamera[],
  },
} as const;
export type RoverId = keyof typeof ROVERS;
export const cameraLabel = (rover: RoverId, id: string | null) => ROVERS[rover].cameras.find((c) => c.id === id)?.label ?? id?.replace(/_/g, " ") ?? null;
