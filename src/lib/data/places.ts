/** Curated launch sites (approximate pad coordinates from public sources) and their LL2 search term. */
export const LAUNCH_SITES = [
  { name: "Kennedy Space Center LC-39A", q: "Kennedy", lat: 28.6082, lon: -80.6041, country: "US" },
  { name: "Cape Canaveral SFS SLC-40", q: "Cape Canaveral", lat: 28.5619, lon: -80.5774, country: "US" },
  { name: "Starbase, Texas", q: "Starbase", lat: 25.9972, lon: -97.156, country: "US" },
  { name: "Vandenberg SFB SLC-4E", q: "Vandenberg", lat: 34.6321, lon: -120.6106, country: "US" },
  { name: "Wallops Flight Facility", q: "Wallops", lat: 37.8338, lon: -75.4881, country: "US" },
  { name: "Rocket Lab LC-1, Mahia", q: "Mahia", lat: -39.2615, lon: 177.8649, country: "NZ" },
  { name: "Guiana Space Centre, Kourou", q: "Kourou", lat: 5.239, lon: -52.768, country: "GF" },
  { name: "Baikonur Cosmodrome", q: "Baikonur", lat: 45.965, lon: 63.305, country: "KZ" },
  { name: "Jiuquan Satellite Launch Center", q: "Jiuquan", lat: 40.958, lon: 100.291, country: "CN" },
  { name: "Satish Dhawan Space Centre", q: "Satish", lat: 13.7199, lon: 80.2304, country: "IN" },
  { name: "Tanegashima Space Center", q: "Tanegashima", lat: 30.4009, lon: 130.9756, country: "JP" },
];

/**
 * Curated directory of public traffic/road camera portals run by the responsible authorities.
 * AETHERRA links to them; it does not embed, scrape or re-stream any feed.
 */
export const WEBCAM_DIRECTORY = [
  { name: "NYC DOT traffic cameras", operator: "New York City DOT", url: "https://webcams.nyctmc.org/", lat: 40.7128, lon: -74.006 },
  { name: "511NY cameras", operator: "New York State DOT", url: "https://511ny.org/cctv", lat: 42.65, lon: -73.75 },
  { name: "Caltrans QuickMap", operator: "California DOT", url: "https://quickmap.dot.ca.gov/", lat: 34.05, lon: -118.24 },
  { name: "WSDOT traffic cameras", operator: "Washington State DOT", url: "https://wsdot.com/travel/real-time/map/", lat: 47.61, lon: -122.33 },
  { name: "FL511 cameras", operator: "Florida DOT", url: "https://fl511.com/cctv", lat: 28.54, lon: -81.38 },
  { name: "Live Traffic NSW", operator: "Transport for NSW", url: "https://www.livetraffic.com/", lat: -33.87, lon: 151.21 },
  { name: "Umferðin road cameras", operator: "Icelandic Road Administration", url: "https://umferdin.is/", lat: 64.15, lon: -21.94 },
];
