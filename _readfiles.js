// Read all local text files and output as JSON for batch push
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const files = [
  'js/config.js','js/auth.js','js/dashboard.js','js/screen-lock.js',
  'js/realtime-sync.js','js/groups.js','js/records.js','js/announcements.js',
  'js/lucky-wheel.js','js/effects.js','js/shop.js','js/audio-challenge.js',
  'js/ui.js','js/store.js','js/class-view.js','js/students.js',
  'css/certificate.css','css/style.css','vendor/remixicon/remixicon.css'
];
const out = {};
for (const f of files) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) out[f] = fs.readFileSync(p, 'utf8');
}
fs.writeFileSync(path.join(dir, '_payload.json'), JSON.stringify(out));
console.log('Files ready:', Object.keys(out).length);
for (const k of Object.keys(out)) console.log('  ', k, out[k].length, 'chars');
