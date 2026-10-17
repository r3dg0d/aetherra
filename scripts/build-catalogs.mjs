// Builds compact sky catalogs from bundled d3-celestial data (BSD-3-Clause, (c) Olaf Frohn).
// Stars: XHIP/Hipparcos-derived, mag <= 6. Constellation lines: IAU 88 modern constellations.
import fs from 'node:fs';
const src = 'data-src/d3-celestial';
const read = (f) => JSON.parse(fs.readFileSync(`${src}/${f}`, 'utf8'));
const stars = read('stars.6.json');
const names = read('starnames.json');
const cons = read('constellations.json');
const lines = read('constellations.lines.json');
const ra = (lon) => +(lon < 0 ? lon + 360 : lon).toFixed(4);
// [hip, raDeg, decDeg, mag, bv|null, properName, bayer, flamsteed, constellation]
const outStars = stars.features.map((f) => {
  const n = names[f.id] || {};
  const bv = f.properties.bv === '' || f.properties.bv == null ? null : +f.properties.bv;
  return [f.id, ra(f.geometry.coordinates[0]), +f.geometry.coordinates[1].toFixed(4), f.properties.mag,
    Number.isFinite(bv) ? bv : null, n.name || '', n.bayer || '', n.flam || '', n.c || ''];
}).sort((a, b) => a[3] - b[3]);
const outCons = cons.features.map((f) => ({
  id: f.id, name: f.properties.name, gen: f.properties.gen, rank: +f.properties.rank,
  label: [ra(f.geometry.coordinates[0]), f.geometry.coordinates[1]],
  lines: (lines.features.find((l) => l.id === f.id)?.geometry.coordinates || []).map((seg) => seg.map(([x, y]) => [ra(x), +y.toFixed(4)])),
}));
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/stars.json', JSON.stringify({ source: 'd3-celestial (XHIP/Hipparcos), BSD-3-Clause', fields: ['hip','ra','dec','mag','bv','name','bayer','flam','con'], stars: outStars }));
fs.writeFileSync('public/data/constellations.json', JSON.stringify({ source: 'd3-celestial (IAU), BSD-3-Clause', constellations: outCons }));
console.log('stars', outStars.length, 'constellations', outCons.length, 'with lines', outCons.filter(c=>c.lines.length).length);
