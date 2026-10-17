// Copies Cesium's prebuilt static assets (Workers, Assets, Widgets, ThirdParty, Cesium.js) into /public/cesium.
import fs from 'node:fs';
import path from 'node:path';
const from = path.join('node_modules', 'cesium', 'Build', 'Cesium');
const to = path.join('public', 'cesium');
if (!fs.existsSync(from)) { console.warn('cesium build not found, skipping'); process.exit(0); }
fs.rmSync(to, { recursive: true, force: true });
for (const d of ['Workers', 'Assets', 'Widgets', 'ThirdParty', 'Cesium.js']) fs.cpSync(path.join(from, d), path.join(to, d), { recursive: true });
console.log('Cesium assets copied to public/cesium');
