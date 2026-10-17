/** NASA GIBS (Global Imagery Browse Services) WMTS layers, EPSG:3857 (256 px web-mercator tiles). Public, no key. */
export const GIBS_ATTRIBUTION = "Imagery: NASA EOSDIS GIBS / Worldview";
export interface GibsLayer { id: string; title: string; ext: "jpg" | "png"; level: number; daily: boolean; description: string; staticDate?: string }
export const GIBS_LAYERS: GibsLayer[] = [
  { id: "BlueMarble_ShadedRelief_Bathymetry", title: "Blue Marble (relief)", ext: "jpg", level: 8, daily: false, description: "Static NASA Blue Marble composite" },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", title: "VIIRS true colour (daily)", ext: "jpg", level: 9, daily: true, description: "Suomi NPP VIIRS corrected reflectance" },
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", title: "MODIS Terra true colour (daily)", ext: "jpg", level: 9, daily: true, description: "Terra MODIS corrected reflectance" },
  { id: "VIIRS_Black_Marble", title: "Black Marble night lights (2016)", ext: "png", level: 8, daily: false, staticDate: "2016-01-01", description: "VIIRS annual night-lights composite" },
  { id: "MODIS_Terra_Land_Surface_Temp_Day", title: "Land surface temperature (day)", ext: "png", level: 7, daily: true, description: "Terra MODIS LST" },
];

/** URL template for Cesium's UrlTemplateImageryProvider ({z}/{y}/{x}). */
export function gibsTemplate(layer: GibsLayer, date: string) {
  const d = layer.staticDate ?? (layer.daily ? date : "default");
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${d}/GoogleMapsCompatible_Level${layer.level}/{z}/{y}/{x}.${layer.ext}`;
}

/** Daily products are usually complete ~1 day after acquisition. */
export function defaultGibsDate(now = new Date()) {
  return new Date(now.getTime() - 36 * 3600_000).toISOString().slice(0, 10);
}
