/* ═══════════════════════════════════════════════════════════
   班级宠物园 - Node.js 后端 (Turso 云数据库)
   部署到 Render / 本地均可
   启动: node server.js
   ═══════════════════════════════════════════════════════════ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@libsql/client');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

// ── Turso 数据库连接 ────────────────────────────────────
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://petclass-177587hvc.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA4MTgyNTQsImlkIjoiMDFhMGY1MTQtMzcwMS03MjBhLWEwNjItNTk3YjRiYWNlMTE1Iiwia2lkIjoiTzlJSjllRHg5NzFaS3NIQ3A5eDNBVDVHeU1rTU9yeUNHRi1EX0pmanFDTSIsInJpZCI6IjQxOTMxODBjLTI4NzgtNGYzNy1hNjEyLTI0YWU0YjNkOWIwZCJ9.iPZudRJ-3yjVlHGxT0Z_nYWgEoQIzQvDp8AbTdUC0jzqEcqMNGAN9YSA-Fqbjed2povvoS7Zebim_-gSSDmLAw';

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// ── 初始化表 ───────────────────────────────────────────
async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS shares (
    share_id TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  // 首次启动：迁移本地旧数据
  const userCount = await db.execute('SELECT COUNT(*) as c FROM users');
  if (userCount.rows[0].c === 0) {
    const localUsers = path.join(ROOT, '_localdata', 'users.json');
    const localSessions = path.join(ROOT, '_localdata', 'sessions.json');
    try {
      if (fs.existsSync(localUsers)) {
        const oldUsers = JSON.parse(fs.readFileSync(localUsers, 'utf8'));
        for (const [uname, u] of Object.entries(oldUsers)) {
          await db.execute(
            'INSERT OR IGNORE INTO users (username, name, salt, password_hash, created_at, data, version, updated_at) VALUES (?,?,?,?,?,?,?,?)',
            [uname, u.name, u.salt, u.passwordHash, u.createdAt || new Date().toISOString(),
             JSON.stringify(u.data || {}), u.version || 1, u.updatedAt || new Date().toISOString()]
          );
        }
        console.log('  已迁移本地用户数据');
      }
      if (fs.existsSync(localSessions)) {
        const oldSessions = JSON.parse(fs.readFileSync(localSessions, 'utf8'));
        for (const [tok, s] of Object.entries(oldSessions)) {
          await db.execute(
            'INSERT OR IGNORE INTO sessions (token, username, created_at, data, version, updated_at) VALUES (?,?,?,?,?,?)',
            [tok, s.username, s.createdAt || Date.now(), JSON.stringify(s.data || {}), s.version || 1, s.updatedAt || new Date().toISOString()]
          );
        }
        console.log('  已迁移本地会话数据');
      }
    } catch (e) { console.error('  迁移跳过:', e.message); }
  }
}

// ── 工具函数 ────────────────────────────────────────────
function hashPassword(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}
function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getUser(username) {
  const r = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
  return r.rows[0] || null;
}
async function getSession(token) {
  const r = await db.execute('SELECT * FROM sessions WHERE token = ?', [token]);
  return r.rows[0] || null;
}
function teacherObj(row) {
  return { id: row.username, name: row.name || row.username, username: row.username };
}

// ── 静态文件服务 ─────────────────────────────────────────
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
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ── API 处理 ─────────────────────────────────────────────
function sendJSON(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 50 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

async function handleApi(req, res, action) {
  const body = await readBody(req);

  switch (action) {

    case 'getPublicConfig':
      return sendJSON(res, { ok: true, activationCodeShopUrl: '' });

    case 'register': {
      const { username, name, password } = body;
      if (!username || !/^[a-zA-Z0-9]+$/.test(username))
        return sendJSON(res, { ok: false, msg: '账号仅能使用英文字母与数字' });
      if (!password || password.length < 6)
        return sendJSON(res, { ok: false, msg: '密码至少6位' });
      const existing = await getUser(username);
      if (existing) return sendJSON(res, { ok: false, msg: '该账号已被注册' });
      const salt = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      await db.execute(
        'INSERT INTO users (username, name, salt, password_hash, created_at, data, version, updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [username, name || username, salt, hashPassword(password, salt), now, '{}', 1, now]
      );
      const token = makeToken();
      await db.execute(
        'INSERT INTO sessions (token, username, created_at, data, version, updated_at) VALUES (?,?,?,?,?,?)',
        [token, username, Date.now(), '{}', 1, now]
      );
      return sendJSON(res, { ok: true, token, teacher: { id: username, name: name || username, username } });
    }

    case 'login': {
      const { username, password } = body;
      const u = await getUser(username);
      if (!u) return sendJSON(res, { ok: false, msg: '账号不存在' });
      const hash = hashPassword(password || '', u.salt);
      if (hash !== u.password_hash) return sendJSON(res, { ok: false, msg: '密码错误' });
      const token = makeToken();
      const now = new Date().toISOString();
      await db.execute(
        'INSERT OR REPLACE INTO sessions (token, username, created_at, data, version, updated_at) VALUES (?,?,?,?,?,?)',
        [token, username, Date.now(), u.data || '{}', u.version || 1, u.updated_at || now]
      );
      return sendJSON(res, {
        ok: true, token,
        teacher: { id: username, name: u.name, username },
        data: JSON.parse(u.data || '{}'),
        version: u.version || 1,
        updatedAt: u.updated_at || now,
      });
    }

    case 'logout': {
      const { token } = body;
      if (token) await db.execute('DELETE FROM sessions WHERE token = ?', [token]);
      return sendJSON(res, { ok: true });
    }

    case 'verify': {
      const { token } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401);
      const u = await getUser(s.username);
      return sendJSON(res, { ok: true, teacher: { id: s.username, name: u.name, username: s.username } });
    }

    case 'changeName': {
      const { token, name } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      await db.execute('UPDATE users SET name = ?, updated_at = ? WHERE username = ?',
        [name || s.username, new Date().toISOString(), s.username]);
      return sendJSON(res, { ok: true, teacher: { id: s.username, name: name || s.username, username: s.username } });
    }

    case 'pollAnnouncements':
      return sendJSON(res, { ok: true, messages: [] });

    case 'sendAnnouncement': {
      const { token } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      return sendJSON(res, { ok: true });
    }

    case 'getTimestamp': {
      const { token } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401);
      return sendJSON(res, { ok: true, version: s.version, updatedAt: s.updated_at });
    }

    case 'load': {
      const { token } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401);
      return sendJSON(res, { ok: true, data: JSON.parse(s.data || '{}'), version: s.version, updatedAt: s.updated_at });
    }

    case 'save': {
      const { token, data } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '登录已失效' }, 401);
      const newVersion = (s.version || 1) + 1;
      const now = new Date().toISOString();
      const dataStr = JSON.stringify(data || {});
      await db.execute('UPDATE sessions SET data = ?, version = ?, updated_at = ? WHERE token = ?',
        [dataStr, newVersion, now, token]);
      await db.execute('UPDATE users SET data = ?, version = ?, updated_at = ? WHERE username = ?',
        [dataStr, newVersion, now, s.username]);
      return sendJSON(res, { ok: true, version: newVersion });
    }

    case 'createClassShare': {
      const { token, snapshot } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      const shareId = crypto.randomBytes(8).toString('hex');
      await db.execute('INSERT INTO shares (share_id, snapshot, created_at) VALUES (?,?,?)',
        [shareId, JSON.stringify(snapshot || {}), new Date().toISOString()]);
      return sendJSON(res, { ok: true, url: '/share.html?id=' + shareId, id: shareId });
    }

    case 'adminDump': {
      const { password } = body;
      const ADMIN_PW = process.env.ADMIN_PASSWORD || '114514';
      if (password !== ADMIN_PW) return sendJSON(res, { ok: false, msg: '密码错误' }, 401);
      const r = await db.execute('SELECT username, name, created_at, updated_at, data FROM users ORDER BY updated_at DESC');
      const teachers = r.rows.map(row => {
        let raw = {};
        try { raw = JSON.parse(row.data || '{}'); } catch {}
        return {
          username: row.username, name: row.name,
          createdAt: row.created_at, updatedAt: row.updated_at,
          raw,
        };
      });
      return sendJSON(res, { ok: true, teachers });
    }

    case 'getWallpaper': {
      const { token } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      const r = await db.execute('SELECT value FROM app_config WHERE key = ?', ['wallpaper:' + s.username]);
      let wp = null;
      if (r.rows[0]) { try { wp = JSON.parse(r.rows[0].value); } catch {} }
      return sendJSON(res, { ok: true, wp });
    }

    case 'saveWallpaper': {
      const { token, wp } = body;
      const s = await getSession(token);
      if (!s) return sendJSON(res, { ok: false, msg: '未登录' }, 401);
      await db.execute('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)',
        ['wallpaper:' + s.username, JSON.stringify(wp || {})]);
      return sendJSON(res, { ok: true });
    }

    case 'getPets': {
      const r = await db.execute('SELECT value FROM app_config WHERE key = ?', ['pet_types']);
      let pets = null;
      if (r.rows[0]) { try { pets = JSON.parse(r.rows[0].value); } catch {} }
      return sendJSON(res, { ok: true, pets });
    }

    case 'adminListPets': {
      const { password } = body;
      if (password !== (process.env.ADMIN_PASSWORD || '114514')) return sendJSON(res, { ok: false, msg: '密码错误' }, 401);
      const r = await db.execute('SELECT value FROM app_config WHERE key = ?', ['pet_types']);
      let pets = null;
      if (r.rows[0]) { try { pets = JSON.parse(r.rows[0].value); } catch {} }
      return sendJSON(res, { ok: true, pets });
    }

    case 'adminSavePets': {
      const { password, pets } = body;
      if (password !== (process.env.ADMIN_PASSWORD || '114514')) return sendJSON(res, { ok: false, msg: '密码错误' }, 401);
      await db.execute('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)',
        ['pet_types', JSON.stringify(pets || [])]);
      return sendJSON(res, { ok: true });
    }

    case 'adminSaveTeacher': {
      const { password, username, data } = body;
      const ADMIN_PW = process.env.ADMIN_PASSWORD || '114514';
      if (password !== ADMIN_PW) return sendJSON(res, { ok: false, msg: '密码错误' }, 401);
      const now = new Date().toISOString();
      await db.execute('UPDATE users SET data = ?, version = version + 1, updated_at = ? WHERE username = ?',
        [JSON.stringify(data || {}), now, username]);
      await db.execute('UPDATE sessions SET data = ?, version = version + 1, updated_at = ? WHERE username = ?',
        [JSON.stringify(data || {}), now, username]);
      return sendJSON(res, { ok: true });
    }

    default:
      return sendJSON(res, { ok: false, msg: '未知操作：' + action });
  }
}

// ── 主服务器 ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (url === '/backend/api.php') {
    try {
      return await handleApi(req, res, query.action || '');
    } catch (e) {
      console.error('API error:', e);
      return sendJSON(res, { ok: false, msg: '服务器错误: ' + e.message }, 500);
    }
  }
  if (url.startsWith('/backend/')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (url === '/admin' || url === '/admin/') {
    req.url = '/admin.html';
  }
  serveStatic(req, res);
});

// ── 启动 ────────────────────────────────────────────────
initDB().then(() => {
  server.listen(PORT, () => {
    console.log('');
    console.log('  🐾 班级宠物园 - 服务已启动 (Turso 云数据库)');
    console.log('  ─────────────────────────────────');
    console.log('  访问地址:  http://localhost:' + PORT);
    console.log('  数据库:    ' + TURSO_URL);
    console.log('');
  });
}).catch(e => {
  console.error('数据库连接失败:', e.message);
  process.exit(1);
});
