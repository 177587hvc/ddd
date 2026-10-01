/* ═══════════════════════════════════════════════════════════
   班级宠物园 - 本地后端服务器 (Node.js, 零依赖)
   复刻原 PHP backend/api.php 的全部接口
   启动: node server.js  →  http://localhost:8080
   ═══════════════════════════════════════════════════════════ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, '_localdata');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
function loadJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}
function saveJSON(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); }
let users = loadJSON(USERS_FILE, {});
let sessions = loadJSON(SESSIONS_FILE, {});
function persistUsers() { saveJSON(USERS_FILE, users); }
function persistSessions() { saveJSON(SESSIONS_FILE, sessions); }
function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function getSession(token) { return sessions[token] || null; }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.map': 'application/json',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404: ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function sendJSON(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 50*1024*1024) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}
function teacherObj(s) { const u = users[s.username]; return { id: s.username, name: u.name, username: s.username }; }

async function handleApi(req, res, action) {
  const body = await readBody(req);
  switch (action) {
    case 'getPublicConfig': return sendJSON(res, { ok: true, activationCodeShopUrl: '' });
    case 'register': {
      const { username, name, password } = body;
      if (!username || !/^[a-zA-Z0-9]+$/.test(username)) return sendJSON(res, { ok: false, msg: '账号仅能使用英文字母与数字' });
      if (!password || password.length < 6) return sendJSON(res, { ok: false, msg: '密码至少6位' });
      if (users[username]) return sendJSON(res, { ok: false, msg: '该账号已被注册' });
      const salt = crypto.randomBytes(16).toString('hex');
      users[username] = { name: name || username, salt, passwordHash: hashPassword(password, salt), createdAt: new Date().toISOString() };
      const token = makeToken();
      sessions[token] = { username, createdAt: Date.now(), data: {}, version: 1, updatedAt: new Date().toISOString() };
      persistUsers(); persistSessions();
      return sendJSON(res, { ok: true, token, teacher: { id: username, name: users[username].name, username } });
    }
    case 'login': {
      const { username, password } = body;
      const u = users[username];
      if (!u) return sendJSON(res, { ok: false, msg: '账号不存在' });
      if (hashPassword(password || '', u.salt) !== u.passwordHash) return sendJSON(res, { ok: false, msg: '密码错误' });
      const token = makeToken();
      sessions[token] = { username, createdAt: Date.now(), data: u.data || {}, version: u.version || 1, updatedAt: u.updatedAt || new Date().toISOString() };
      persistSessions();
      return sendJSON(res, { ok: true, token, teacher: { id: username, name: u.name, username }, data: sessions[token].data, version: sessions[token].version, updatedAt: sessions[token].updatedAt });
    }
    case 'logout': { const { token } = body; if (token) delete sessions[token]; persistSessions(); return sendJSON(res, { ok: true }); }
    case 'verify': { const { token } = body; const s = getSession(token); if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401); return sendJSON(res, { ok: true, teacher: teacherObj(s) }); }
    case 'changeName': { const { token, name } = body; const s = getSession(token); if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401); users[s.username].name = name || s.username; persistUsers(); return sendJSON(res, { ok: true }); }
    case 'getTimestamp': { const { token } = body; const s = getSession(token); if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401); return sendJSON(res, { ok: true, version: s.version, updatedAt: s.updatedAt }); }
    case 'load': { const { token } = body; const s = getSession(token); if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401); return sendJSON(res, { ok: true, data: s.data, version: s.version, updatedAt: s.updatedAt }); }
    case 'save': {
      const { token, data, version, forceUpload } = body;
      const s = getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401);
      const v = Number(version) || 0;
      if (!forceUpload && v > 0 && v < s.version) return sendJSON(res, { ok: false, msg: '版本冲突', version: s.version }, 409);
      s.data = data || {}; s.version = s.version + 1; s.updatedAt = new Date().toISOString();
      users[s.username].data = s.data; users[s.username].version = s.version; users[s.username].updatedAt = s.updatedAt;
      persistUsers(); persistSessions();
      return sendJSON(res, { ok: true, version: s.version });
    }
    case 'createClassShare': {
      const { token, daysValid, snapshot } = body;
      const s = getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      const shareId = crypto.randomBytes(8).toString('hex');
      fs.writeFileSync(path.join(DATA_DIR, 'share_' + shareId + '.json'), JSON.stringify(snapshot || {}, null, 2));
      return sendJSON(res, { ok: true, url: '/share.html?id=' + shareId, id: shareId });
    }
    default: return sendJSON(res, { ok: false, msg: '未知操作：' + action });
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  if (url === '/backend/api.php') return handleApi(req, res, query.action || '');
  if (url.startsWith('/backend/')) { res.writeHead(403); res.end('Forbidden'); return; }
  serveStatic(req, res);
});
server.listen(PORT, () => {
  console.log('\n  班级宠物园 - 本地服务已启动');
  console.log('  访问: http://localhost:' + PORT + '\n');
});
