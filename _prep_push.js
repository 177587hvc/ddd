// Push all local files to GitHub via REST API using OAuth token
// This script reads files and calls GitHub API directly
const https = require('https');
const fs = require('fs');
const path = require('path');

const OWNER = '177587hvc';
const REPO = 'ddd';
const BRANCH = 'main';
const DIR = path.join(__dirname, '..');

// Read all files to push
const filesToPush = {
  'js/config.js': null,
  'js/auth.js': null,
  'js/dashboard.js': null,
  'js/screen-lock.js': null,
  'js/realtime-sync.js': null,
  'js/groups.js': null,
  'js/records.js': null,
  'js/announcements.js': null,
  'js/lucky-wheel.js': null,
  'js/effects.js': null,
  'js/shop.js': null,
  'js/audio-challenge.js': null,
  'js/ui.js': null,
  'js/store.js': null,
  'js/class-view.js': null,
  'js/students.js': null,
  'css/certificate.css': null,
  'css/style.css': null,
  'vendor/remixicon/remixicon.css': null,
};

for (const f of Object.keys(filesToPush)) {
  filesToPush[f] = fs.readFileSync(path.join(DIR, f), 'utf8');
}

console.log('Files to push:', Object.keys(filesToPush).length);
console.log('Total chars:', Object.values(filesToPush).reduce((a, b) => a + b.length, 0));

// Output as JSON for inspection
fs.writeFileSync(path.join(__dirname, '_push_payload.json'), JSON.stringify({
  owner: OWNER, repo: REPO, branch: BRANCH,
  message: '批量推送前端 JS/CSS 文件',
  files: Object.entries(filesToPush).map(([p, c]) => ({ path: p, content: c }))
}, null, 2));
console.log('Payload written to _push_payload.json');
