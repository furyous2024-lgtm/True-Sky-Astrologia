const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://truesky-ad5d6.web.app,https://truesky-ad5d6.firebaseapp.com,https://true-sky-astrologia.onrender.com,http://localhost:5500,http://localhost:5501,http://127.0.0.1:5500,http://127.0.0.1:5501')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  },
});
const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'local-db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { charts: [], settings: [], profiles: [], chat: {}, aiHistory: [] }; }
}
function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function recent(items) { return [...items].sort((a,b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')).slice(0, 100); }
function norm(v) { return String(v ?? '').trim().toLowerCase(); }
function chartKey(c) { return [c.name, c.year, c.month, c.day, c.hour, String(c.minute ?? '').padStart(2, '0'), c.location].map(norm).join('|'); }
function normalizeChart(c) {
  const now = new Date().toISOString();
  return { id: c.id || makeId(), profile_type: c.profile_type || c.chart_type || 'natal', ...c, created_at: c.created_at || now, updated_at: c.updated_at || now };
}

// CORS Middleware for Firebase Hosting + Render backend.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-TrueSky-Settings-Target');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));


// Firebase Web config served dynamically for Render.
// Set these public Firebase web app values in Render > Environment.
function getFirebaseWebConfig() {
  // Configuração real do app Web Firebase.
  // Variáveis de ambiente do Render podem sobrescrever estes valores, mas não são obrigatórias.
  return {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyC0rsz6oXGHtkmYgWz-S8iPFbko0lMe2vU',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'true-sky-astrology.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'true-sky-astrology',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'true-sky-astrology.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '189355672778',
    appId: process.env.FIREBASE_APP_ID || '1:189355672778:web:78590ccef247d81e006033',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-WCN6HM3YQ9'
  };
}

function isRealFirebaseConfig(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

app.get('/js/firebase-config.js', (req, res) => {
  const config = getFirebaseWebConfig();
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(`// Gerado pelo server.js no Render.\n(function () {\n  \"use strict\";\n  window.TRUESKY_FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n  window.TrueSkyFirebaseConfig = {\n    config: window.TRUESKY_FIREBASE_CONFIG,\n    isConfigured: ${JSON.stringify(isRealFirebaseConfig(config))}\n  };\n})();\n`);
});

app.get('/api/firebase-config-status', (req, res) => {
  const config = getFirebaseWebConfig();
  res.json({
    success: true,
    configured: isRealFirebaseConfig(config),
    projectId: config.projectId || null,
    authDomain: config.authDomain || null,
    missing: ['FIREBASE_API_KEY','FIREBASE_APP_ID','FIREBASE_MESSAGING_SENDER_ID'].filter((key) => !process.env[key])
  });
});

app.use(express.static(ROOT, { index: 'index.html' }));

app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', service: 'truesky-node', port: PORT }));
app.get('/api/swiss-health', (req, res) => {
  const script = path.join(ROOT, 'py', 'swiss_ephemeris_service.py');
  const candidates = process.platform === 'win32'
    ? [[path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'), 'Programs', 'Python', 'Python311', 'python.exe'), []], ['py', ['-3.11']]]
    : [['python3', []], ['python', []]];
  const results = candidates.map(([cmd, args]) => {
    const child = spawnSync(cmd, [...args, '-c', 'import swisseph as swe; print(swe.version)'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    return { command: `${cmd} ${args.join(' ')}`.trim(), ok: child.status === 0, stdout: (child.stdout || '').trim(), stderr: (child.stderr || child.error?.message || '').trim() };
  });
  res.json({ success: results.some(r => r.ok), results, script });
});


// Calculation compatibility endpoint. The browser code already calculates charts locally in sharedNatal.js.
// This keeps older fetch('/') calls from failing when running through Node.
app.post('/', (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.natalData)) return res.json(body.natalData);
  if (Array.isArray(body.data)) return res.json(body.data);

  // If a browser page submits a form directly to '/', redirect it back to the UI
  // instead of rendering raw JSON in the browser.
  const isJsonRequest = req.is('application/json');
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  if (acceptsHtml && !isJsonRequest) {
    return res.redirect(303, '/');
  }

  return res.json({ success: true, data: body });
});

app.get('/recent-charts', (req, res) => res.json({ success: true, recentCharts: recent(readDb().charts) }));
app.get('/search-charts', (req, res) => {
  const q = String(req.query.query || '').toLowerCase();
  const charts = recent(readDb().charts).filter(c => !q || JSON.stringify(c).toLowerCase().includes(q));
  res.json({ success: true, recentCharts: charts });
});
app.post('/save-chart', (req, res) => {
  const db = readDb();
  const chart = normalizeChart(req.body || {});
  const exists = db.charts.some(c => chartKey(c) === chartKey(chart));
  if (exists) return res.json({ success: false, error: 'Chart already exists in database.', recentCharts: recent(db.charts) });
  if (db.charts.length >= 5000) return res.json({ success: false, error: 'Chart limit reached. Maximum allowed charts is 5000.', recentCharts: recent(db.charts) });
  db.charts.unshift(chart); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.post('/delete-chart', (req, res) => {
  const db = readDb();
  db.charts = db.charts.filter(c => String(c.id) !== String(req.body.id)); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.post('/update-chart-timestamp', (req, res) => {
  const db = readDb(); const id = String(req.body.id || '');
  db.charts = db.charts.map(c => String(c.id) === id ? { ...c, updated_at: new Date().toISOString() } : c); writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});


app.get('/recent-profiles', (req, res) => res.json({ success: true, recentProfiles: recent(readDb().profiles || []) }));
app.post('/save-profile', (req, res) => {
  const db = readDb();
  db.profiles = Array.isArray(db.profiles) ? db.profiles : [];
  const nowIso = new Date().toISOString();
  const body = req.body || {};
  const profileName = String(body.profileName || body.profile_name || body.name || 'Main Profile').trim() || 'Main Profile';
  const existing = db.profiles.find(p => norm(p.profileName || p.profile_name) === norm(profileName));
  const item = {
    id: existing?.id || body.id || makeId(),
    profileName,
    chart: body.chart || {},
    settings: body.settings || {},
    natalData: body.natalData || null,
    created_at: existing?.created_at || body.created_at || nowIso,
    updated_at: nowIso,
  };
  db.profiles = [item, ...db.profiles.filter(p => String(p.id) !== String(item.id))].slice(0, 5000);
  writeDb(db);
  res.json({ success: true, recentProfiles: recent(db.profiles) });
});
app.post('/delete-profile', (req, res) => {
  const db = readDb();
  db.profiles = (db.profiles || []).filter(p => String(p.id) !== String(req.body.id));
  writeDb(db);
  res.json({ success: true, recentProfiles: recent(db.profiles) });
});
app.post('/update-profile-timestamp', (req, res) => {
  const db = readDb(); const id = String(req.body.id || '');
  db.profiles = (db.profiles || []).map(p => String(p.id) === id ? { ...p, updated_at: new Date().toISOString() } : p);
  writeDb(db);
  res.json({ success: true, recentProfiles: recent(db.profiles) });
});

app.get('/recent-settings', (req, res) => res.json({ success: true, recentSettings: recent(readDb().settings) }));
app.post('/save-settings', (req, res) => {
  const db = readDb();
  const item = { id: makeId(), settings_name: req.body.settingsName || req.body.settings_name || 'Settings', settings_json: req.body.settings_json || '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  db.settings.unshift(item); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});
app.post('/delete-settings', (req, res) => {
  const db = readDb(); db.settings = db.settings.filter(s => String(s.id) !== String(req.body.id)); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});
app.post('/update-settings-timestamp', (req, res) => {
  const db = readDb(); const id = String(req.body.id || '');
  db.settings = db.settings.map(s => String(s.id) === id ? { ...s, updated_at: new Date().toISOString() } : s); writeDb(db);
  res.json({ success: true, recentSettings: recent(db.settings) });
});


app.get('/api/default-location', (req, res) => {
  const db = readDb();
  res.json({ success: true, defaultLocation: db.defaultLocation || '' });
});
app.post('/save-default-location', (req, res) => {
  const defaultLocation = String(req.body.defaultLocation || '').trim();
  if (!defaultLocation) return res.status(400).json({ success: false, error: 'Default location is required.' });
  const db = readDb();
  db.defaultLocation = defaultLocation;
  db.updated_at = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, defaultLocation });
});
app.post('/view-report', (req, res) => res.json({ success: true }));
app.post('/import-charts', (req, res) => {
  const db = readDb();
  const incoming = Array.isArray(req.body) ? req.body : (req.body.charts || req.body.recentCharts || []);
  for (const raw of incoming) {
    const chart = normalizeChart(raw);
    if (!db.charts.some(c => chartKey(c) === chartKey(chart))) db.charts.push(chart);
  }
  writeDb(db);
  res.json({ success: true, recentCharts: recent(db.charts) });
});
app.get('/export-charts', (req, res) => res.json(readDb().charts));
app.post('/delete-exported-charts', (req, res) => res.json({ success: true }));
app.post('/deleteAccount', (req, res) => res.json({ success: true }));

function normalizeChatMessage(raw = {}) {
  const now = new Date().toISOString();
  const message = String(raw.message || '').trim().slice(0, 500);
  const channel = String(raw.channel || 'welcome').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'welcome';
  const userId = String(raw.userId || raw.user_id || 'local').slice(0, 128);
  const username = String(raw.username || raw.displayName || 'User').trim().slice(0, 80) || 'User';
  const profileImage = String(raw.profileImage || raw.profile_image || '/images/misc/anonymouse.png').slice(0, 400);
  const role = String(raw.role || raw.community_role || 'user').slice(0, 40);
  return {
    id: raw.id || makeId(),
    channel,
    userId,
    user_id: userId,
    username,
    message,
    profileImage,
    profile_image: profileImage,
    role,
    community_role: role,
    anonymous: Boolean(raw.anonymous),
    timestamp: raw.timestamp || now,
    created_at: raw.created_at || now
  };
}

function saveChatMessage(raw) {
  const item = normalizeChatMessage(raw);
  if (!item.message) return null;
  const db = readDb();
  db.chat = db.chat || {};
  db.chat[item.channel] = Array.isArray(db.chat[item.channel]) ? db.chat[item.channel] : [];
  if (!db.chat[item.channel].some((msg) => String(msg.id) === String(item.id))) {
    db.chat[item.channel].push(item);
  }
  db.chat[item.channel] = db.chat[item.channel].slice(-200);
  writeDb(db);
  return item;
}

app.get('/chat-history/:channel', (req, res) => {
  const channel = String(req.params.channel || 'welcome').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'welcome';
  const db = readDb();
  res.json({ success: true, messages: (db.chat && db.chat[channel]) || [] });
});

app.post('/delete-chat-message', (req, res) => {
  const id = String(req.body.id || '');
  const requestedChannel = String(req.body.channel || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  if (!id) return res.status(400).json({ success: false, error: 'Message id is required.' });
  const db = readDb();
  db.chat = db.chat || {};
  const channels = requestedChannel ? [requestedChannel] : Object.keys(db.chat);
  let removed = false;
  channels.forEach((channel) => {
    const before = Array.isArray(db.chat[channel]) ? db.chat[channel].length : 0;
    db.chat[channel] = (db.chat[channel] || []).filter((msg) => String(msg.id) !== id);
    if (db.chat[channel].length !== before) removed = true;
  });
  if (removed) writeDb(db);
  io.emit('messageDeleted', { id, channel: requestedChannel || null });
  res.json({ success: true, removed });
});

io.on('connection', socket => {
  function joinChannel(channel) {
    const safeChannel = String(channel || 'welcome').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'welcome';
    socket.join(safeChannel);
  }

  function handleChatMessage(msg) {
    const item = saveChatMessage(msg);
    if (!item) {
      socket.emit('errorMessage', { text: 'Message cannot be empty.' });
      return;
    }
    io.to(item.channel).emit('chatMessage', item);
    io.to(item.channel).emit('chat message', item);
  }

  socket.on('join', joinChannel);
  socket.on('joinChannel', joinChannel);
  socket.on('chatMessage', handleChatMessage);
  socket.on('chat message', handleChatMessage);
});


app.post('/api/swiss-ephemeris', (req, res) => {
  const script = path.join(ROOT, 'py', 'swiss_ephemeris_service.py');

  // Windows often has several Python versions installed. The Swiss module was
  // confirmed on this machine with: py -3.11 -c "import swisseph".
  // Try that first, then fall back to explicit env/PATH choices.
  const candidates = [];
  const addCandidate = (cmd, args = []) => {
    const key = `${cmd} ${args.join(' ')}`.trim();
    if (!candidates.some((c) => `${c.cmd} ${c.args.join(' ')}`.trim() === key)) {
      candidates.push({ cmd, args });
    }
  };

  // Windows fix: force the same Python 3.11 where Caio confirmed:
  // py -3.11 -c "import swisseph as swe; print(swe.version)" -> 2.10.03
  // Do NOT fall back to plain "python" on Windows, because that can be Python 3.14
  // or a Microsoft Store alias without pyswisseph.
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    addCandidate(path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'), []);
    addCandidate('py', ['-3.11']);
  } else {
    addCandidate('python3', []);
    addCandidate('python', []);
  }

  if (process.env.PYTHON) {
    const envPython = process.env.PYTHON.trim();
    const envArgs = (process.env.PYTHON_ARGS || '').trim().split(/\s+/).filter(Boolean);
    if (process.platform === 'win32' && envPython.toLowerCase() === 'python') {
      // Ignore incorrect Windows PYTHON=python env. It often points to a Python
      // without swisseph and caused the "No module named swisseph" error.
    } else if (envPython.toLowerCase() === 'py' && envArgs.length === 0) {
      addCandidate('py', ['-3.11']);
    } else {
      addCandidate(envPython, envArgs);
    }
  }

  const attemptedErrors = [];
  let lastError = '';
  for (const candidate of candidates) {
    try {
      const child = spawnSync(candidate.cmd, [...candidate.args, script], {
        input: JSON.stringify(req.body || {}),
        encoding: 'utf8',
        timeout: 20000,
        cwd: ROOT,
        maxBuffer: 1024 * 1024 * 8,
        windowsHide: true,
      });
      if (child.error) {
        lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${child.error.message}`;
        attemptedErrors.push(lastError);
        continue;
      }
      const stdout = (child.stdout || '').trim();
      const stderr = (child.stderr || '').trim();
      if (!stdout) {
        lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${stderr || `exit ${child.status}`}`;
        attemptedErrors.push(lastError);
        continue;
      }
      const payload = JSON.parse(stdout);
      if (payload && payload.success !== false) return res.json(payload);
      lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${payload.error || 'Swiss returned failure'}`;
      attemptedErrors.push(lastError);
    } catch (err) {
      lastError = `${candidate.cmd} ${candidate.args.join(' ')}: ${err.message}`;
      attemptedErrors.push(lastError);
    }
  }
  res.status(500).json({
    success: false,
    error: `Swiss Ephemeris service unavailable. Attempts: ${attemptedErrors.join(' | ')}. Local Windows: py -3.11 -m pip install pyswisseph. Render/Linux: use the included Dockerfile/render.yaml so python3 has pyswisseph installed.`,
  });
});

app.get('/api/geocode', (req, res) => {
  const query = String(req.query.query || req.query.q || '').trim();
  if (!query) return res.status(400).json({ success: false, error: 'Missing geocode query' });

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=1&q=${encodeURIComponent(query)}`;
  https
    .get(url, { headers: { 'User-Agent': 'AstroLocalServer/1.0 (+http://localhost)', Accept: 'application/json' } }, (proxyRes) => {
      let body = '';
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(body || '[]');
          res.status(proxyRes.statusCode || 200).json(data);
        } catch (err) {
          res.status(500).json({ success: false, error: 'Invalid geocode response' });
        }
      });
    })
    .on('error', (err) => {
      res.status(500).json({ success: false, error: err.message });
    });
});
app.post('/api/ai-chat', (req, res) => res.json({ success: true, message: 'AI local indisponível neste servidor Node básico.' }));
app.get('/api/ai-chat/history', (req, res) => res.json({ success: true, history: readDb().aiHistory }));
app.post('/api/ai-chat/clear', (req, res) => { const db = readDb(); db.aiHistory = []; writeDb(db); res.json({ success: true }); });
app.get('/api/ai-chat/suggestions', (req, res) => res.json({ success: true, suggestions: [] }));
app.post('/api/ai-chat/save-suggestions', (req, res) => res.json({ success: true }));

// SPA catch-all route - must be last
app.get(/^\/((?!.*\.[^\/]+$).)*$/, (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
server.listen(PORT, "0.0.0.0", () => console.log(`Truesky rodando em http://localhost:${PORT}`));
