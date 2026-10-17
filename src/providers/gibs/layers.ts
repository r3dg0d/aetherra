/** NASA GIBS (Global Imagery Browse Services) WMTS layers. Public, no key required. */
export const GIBS_ATTRIBUTION = "Imagery: NASA EOSDIS GIBS / Worldview";
export interface GibsLayer { id: string; title: string; format: "jpg" | "png"; matrixSet: string; maxLevel: number; daily: boolean; description: string; staticDate?: string }
export const GIBS_LAYERS: GibsLayer[] = [
  { id: "BlueMarble_ShadedRelief_Bathymetry", title: "Blue Marble (relief)", format: "jpg", matrixSet: "500m", maxLevel: 8, daily: false, description: "Static composite, NASA Blue Marble" },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", title: "VIIRS true color (daily)", format: "jpg", matrixSet: "250m", maxLevel: 9, daily: true, description: "Suomi NPP VIIRS corrected reflectance, daily" },
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", title: "MODIS Terra true color (daily)", format: "jpg", matrixSet: "250m", maxLevel: 9, daily: true, description: "Terra MODIS corrected reflectance, daily" },
  { id: "VIIRS_Black_Marble", title: "Black Marble night lights (2016)", format: "png", matrixSet: "500m", maxLevel: 8, daily: false, staticDate: "2016-01-01", description: "VIIRS Black Marble annual composite" },
  { id: "MODIS_Terra_Land_Surface_Temp_Day", title: "Land surface temperature (day)", format: "png", matrixSet: "1km", maxLevel: 7, daily: true, description: "MODIS Terra LST" },
];

export function gibsUrl(layer: GibsLayer, date: string) {
  const d = layer.staticDate ?? (layer.daily ? date : "default");
  return `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer.id}/default/${d}/${layer.matrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${layer.format}`;
}
