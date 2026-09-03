import http from 'http';
import https from 'https';
import fs from 'fs-extra';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');
const PORT = process.env.SAKURA_DASH_PORT || 3000;
const CMDS_DIR = path.join(ROOT, 'scripts', 'cmds');
const EVENTS_DIR = path.join(ROOT, 'scripts', 'events');

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function getTokensFromFile() {
  try {
    const tokensPath = path.join(ROOT, 'json', 'tokens.json');
    let tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    if (!Array.isArray(tokens)) tokens = [tokens];
    return tokens.filter(t => t && t !== 'YOUR_BOT_TOKEN_HERE');
  } catch {
    return [];
  }
}

function saveTokensToFile(tokens) {
  const tokensPath = path.join(ROOT, 'json', 'tokens.json');
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function commandFilePath(category, name, existing) {
  if (existing) {
    const rel = path.isAbsolute(existing) ? path.relative(ROOT, existing) : existing;
    return toPosix(rel);
  }
  return `scripts/cmds/${category}/${name}.js`;
}

async function hotStartBotFromWeb(token) {
  const mod = await import(
    pathToFileURL(path.join(ROOT, 'core', 'system', 'handlerAction.js')).href
  );
  const createHandlerAction = mod.default;
  const bot = new TelegramBot(token, { polling: true });
  const me = await bot.getMe();
  const handlerAction = createHandlerAction(bot);

  bot.on('message', msg => handlerAction({ message: msg }));
  bot.on('edited_message', msg => handlerAction({ edited_message: msg }));
  bot.on('callback_query', cbq => handlerAction({ callback_query: cbq }));
  bot.on('message_reaction', rxn => handlerAction({ message_reaction: rxn }));
  bot.on('polling_error', err =>
    global.Sakura?.log?.error(`[Web-HotBot @${me.username}] ${err.message}`)
  );

  const nextIndex = (global.Sakura?.bots?.length || 0) + 1;
  global.Sakura.bots.push({ bot, username: me.username, index: nextIndex, token, userId: me.id });
  global.Sakura?.log?.commands(`[Web] Hot-started @${me.username} as bot #${nextIndex}`);
  return { username: me.username, index: nextIndex, userId: me.id };
}

async function hotStopBotFromWeb(token) {
  const idx = global.Sakura?.bots?.findIndex(b => b.token === token) ?? -1;
  if (idx === -1) return null;

  const { bot, username } = global.Sakura.bots[idx];
  try {
    await bot.stopPolling();
    global.Sakura.bots.splice(idx, 1);
    global.Sakura?.log?.commands(`[Web] Hot-stopped @${username}`);
    return username;
  } catch (err) {
    global.Sakura.bots.splice(idx, 1);
    global.Sakura?.log?.warn(`[Web] Force-removed @${username}: ${err.message}`);
    return username;
  }
}

function isValidTokenFormat(token) {
  const parts = token.split(':');
  return parts.length === 2 && /^\d{5,}$/.test(parts[0]) && /^[A-Za-z0-9_-]{30,50}$/.test(parts[1]);
}

function getCommandsData() {
  if (global.Sakura?.commands) {
    return [...global.Sakura.commands.values()].map(cmd => {
      const m = cmd.eren || {};
      const category = (m.category || 'system').toLowerCase();
      const name = m.name || '';
      return {
        name,
        version: m.version || '1.0.0',
        aliases: m.aliases || [],
        description: m.description || '',
        category,
        type: (m.type || 'anyone').toLowerCase(),
        guide: m.guide || [],
        file: commandFilePath(category, name, m.file || cmd.filePath || cmd.path),
      };
    });
  }

  if (!fs.existsSync(CMDS_DIR)) return [];

  const list = [];
  for (const category of fs.readdirSync(CMDS_DIR)) {
    const catDir = path.join(CMDS_DIR, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.js')) continue;
      const name = path.basename(file, '.js');
      list.push({
        name,
        version: '1.0.0',
        aliases: [],
        description: '',
        category: category.toLowerCase(),
        type: 'anyone',
        guide: [],
        file: `scripts/cmds/${category}/${file}`,
      });
    }
  }
  return list;
}

function getEventsData() {
  const files = global.Sakura?.eventCommandsFilesPath || [];
  const commands = global.Sakura?.eventCommands || new Map();

  if (files.length) {
    return files.map(({ filePath, commandName }) => {
      const mod = commands.get(commandName);
      const m = mod?.eren || {};
      const base = path.basename(filePath || `${commandName}.js`);
      return {
        name: m.name || commandName || '',
        version: m.version || '1.0.0',
        author: m.author || 'S4Eren',
        description: m.description || '',
        category: (m.category || 'events').toLowerCase(),
        file: `scripts/events/${base}`,
        icon: 'event',
        color: 'green',
        trigger: 'Loaded from scripts/events',
        scope: 'scripts/events',
      };
    });
  }

  if (!fs.existsSync(EVENTS_DIR)) return [];

  return fs.readdirSync(EVENTS_DIR)
    .filter(file => file.endsWith('.js'))
    .map(file => ({
      name: path.basename(file, '.js'),
      version: '1.0.0',
      author: 'S4Eren',
      description: '',
      category: 'events',
      file: `scripts/events/${file}`,
      icon: 'event',
      color: 'green',
      trigger: 'Loaded from scripts/events',
      scope: 'scripts/events',
    }));
}

async function router(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (url === '/' || url === '/index.html') {
    return serveFile(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
  }

  if (url === '/api/status' && method === 'GET') {
    const uptime = global.Sakura ? Date.now() - global.Sakura.startTime : 0;
    const commands = getCommandsData();
    const bots = global.Sakura?.bots || [];
    const config = global.Sakura?.config || {};
    return json(res, {
      online: true,
      uptime,
      startTime: global.Sakura?.startTime || Date.now(),
      commandCount: commands.length,
      eventCount: getEventsData().length,
      uptimeHistory: global.Sakura?.uptimeHistory || [],
      botCount: bots.length,
      bots: bots.map(b => ({ username: b.username, index: b.index, userId: b.userId ?? null })),
      prefix: config.prefix || '/',
      subprefix: config.subprefix || [],
      timezone: config.timezone || 'UTC',
      developer: config.developer || 'S4Eren',
      maintenance: config.maintenance || false,
    });
  }

  if (url === '/api/commands' && method === 'GET') {
    return json(res, getCommandsData());
  }

  if (url === '/api/events' && method === 'GET') {
    return json(res, getEventsData());
  }

  if (url === '/api/tokens' && method === 'GET') {
    const tokens = getTokensFromFile();
    const running = global.Sakura?.bots || [];
    return json(res, tokens.map((t, i) => {
      const live = running.find(b => b.token === t);
      return {
        index: i,
        masked: t.split(':')[0] + ':' + '•'.repeat(14),
        live: !!live,
        username: live ? live.username : null,
        botIndex: live ? live.index : null,
        userId: live ? (live.userId ?? null) : null,
      };
    }));
  }

  if (url === '/api/tokens' && method === 'POST') {
    const body = await parseBody(req);
    const token = (body.token || '').trim();

    if (!token)
      return json(res, { ok: false, error: 'Token is empty.' }, 400);
    if (!isValidTokenFormat(token))
      return json(res, { ok: false, error: 'Invalid token format. Expected: <id>:<secret>' }, 400);

    const tokens = getTokensFromFile();
    if (tokens.includes(token))
      return json(res, { ok: false, error: 'Token already exists.' }, 409);

    let botInfo;
    try {
      botInfo = await hotStartBotFromWeb(token);
    } catch (err) {
      return json(res, {
        ok: false,
        error: `Hot-start failed: ${err.message}. Token was not saved.`,
      }, 500);
    }

    tokens.push(token);
    saveTokensToFile(tokens);

    return json(res, {
      ok: true,
      message: `Bot @${botInfo.username} is now online.`,
      username: botInfo.username,
      botIndex: botInfo.index,
      total: tokens.length,
    });
  }

  if (url === '/api/tokens' && method === 'DELETE') {
    const body = await parseBody(req);
    const token = (body.token || '').trim();

    if (!token)
      return json(res, { ok: false, error: 'Token is empty.' }, 400);

    const tokens = getTokensFromFile();
    const idx = tokens.indexOf(token);
    if (idx === -1)
      return json(res, { ok: false, error: 'Token not found in registry.' }, 404);

    const stoppedUsername = await hotStopBotFromWeb(token);
    tokens.splice(idx, 1);
    saveTokensToFile(tokens);

    return json(res, {
      ok: true,
      message: stoppedUsername
        ? `Bot @${stoppedUsername} has been stopped and removed.`
        : `Token removed (bot was not actively running).`,
      stopped: !!stoppedUsername,
      username: stoppedUsername,
      remaining: tokens.length,
    });
  }

  if (url === '/api/bot-photo' && method === 'GET') {
    const userId = new URLSearchParams(req.url.split('?')[1] || '').get('id');
    if (!userId) return json(res, { ok: false, error: 'Missing id param.' }, 400);

    const bots = global.Sakura?.bots || [];
    const entry = bots.find(b => String(b.userId) === String(userId));
    if (!entry) return json(res, { ok: false, error: 'Bot not found.' }, 404);

    try {
      const photos = await entry.bot.getUserProfilePhotos(userId, { limit: 1 });
      if (!photos.total_count || !photos.photos?.[0]?.[0]) {
        res.writeHead(404);
        return res.end('No profile photo.');
      }

      const sizes = photos.photos[0];
      const best = sizes[sizes.length - 1];
      const fileLink = await entry.bot.getFileLink(best.file_id);

      https.get(fileLink, (imgRes) => {
        res.writeHead(200, {
          'Content-Type': imgRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=300',
        });
        imgRes.pipe(res);
      }).on('error', () => {
        if (!res.headersSent) { res.writeHead(502); res.end('Photo fetch failed.'); }
      });
    } catch (err) {
      if (!res.headersSent) json(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

export function startWebServer() {
  const server = http.createServer(router);
  server.listen(PORT, () => {
    if (global.Sakura?.log) global.Sakura.log.sakura(`Dashboard running → http://localhost:${PORT}`);
    else console.log(`[Sakura Dashboard] http://localhost:${PORT}`);
  });
  return server;
}
