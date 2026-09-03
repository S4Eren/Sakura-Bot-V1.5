import { createCanvas } from 'canvas';

export const eren = {
  name: 'maze',
  version: '1.0.0',
  aliases: ['labyrinth'],
  description: 'Solve a maze with buttons. Win 5000 coins.',
  author: 'S4Eren',
  category: 'game',
  type: 'anyone',
  cooldown: 8,
  usePrefix: 'both',
  guide: ['', 'easy', 'medium', 'hard', '1-10']
};

const REWARD = 5000;
const MAX_WRONG = 3;
const CELL = 40;
const PAD = 18;

function games() {
  const g = global.Sakura || global.sakura;
  return g.mazeGames || (g.mazeGames = new Map());
}

function gameKey(chatId, userId) {
  return String(chatId) + ':' + String(userId);
}

function pickReplyId(ctx) {
  if (!ctx) return null;
  return (
    (ctx.message && (ctx.message.message_id || ctx.message.id)) ||
    ctx.messageID ||
    ctx.msgID ||
    (ctx.event && (ctx.event.messageID || ctx.event.message_id)) ||
    null
  );
}

function indexOf(x, y, cols, rows) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
  return x + y * cols;
}

function makeGrid(cols, rows) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid.push({
        x: x,
        y: y,
        walls: { top: true, right: true, bottom: true, left: true },
        visited: false
      });
    }
  }

  function neighbors(cell) {
    const list = [];
    const dirs = [
      grid[indexOf(cell.x, cell.y - 1, cols, rows)],
      grid[indexOf(cell.x + 1, cell.y, cols, rows)],
      grid[indexOf(cell.x, cell.y + 1, cols, rows)],
      grid[indexOf(cell.x - 1, cell.y, cols, rows)]
    ];
    for (let i = 0; i < dirs.length; i++) {
      if (dirs[i] && !dirs[i].visited) list.push(dirs[i]);
    }
    return list;
  }

  function carve(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (dx === 1) { a.walls.left = false; b.walls.right = false; }
    else if (dx === -1) { a.walls.right = false; b.walls.left = false; }
    if (dy === 1) { a.walls.top = false; b.walls.bottom = false; }
    else if (dy === -1) { a.walls.bottom = false; b.walls.top = false; }
  }

  let current = grid[0];
  current.visited = true;
  const stack = [];
  while (true) {
    const n = neighbors(current);
    if (n.length) {
      stack.push(current);
      const next = n[Math.floor(Math.random() * n.length)];
      carve(current, next);
      next.visited = true;
      current = next;
    } else if (stack.length) {
      current = stack.pop();
    } else break;
  }
  return grid;
}

function solvePath(grid, cols, rows) {
  const start = grid[0];
  const end = grid[grid.length - 1];
  const queue = [start];
  const visited = new Set([indexOf(start.x, start.y, cols, rows)]);
  const parent = {};

  while (queue.length) {
    const cell = queue.shift();
    if (cell === end) break;
    const moves = [
      !cell.walls.top && grid[indexOf(cell.x, cell.y - 1, cols, rows)],
      !cell.walls.right && grid[indexOf(cell.x + 1, cell.y, cols, rows)],
      !cell.walls.bottom && grid[indexOf(cell.x, cell.y + 1, cols, rows)],
      !cell.walls.left && grid[indexOf(cell.x - 1, cell.y, cols, rows)]
    ];
    for (let i = 0; i < moves.length; i++) {
      const next = moves[i];
      if (!next) continue;
      const idx = indexOf(next.x, next.y, cols, rows);
      if (!visited.has(idx)) {
        visited.add(idx);
        parent[idx] = cell;
        queue.push(next);
      }
    }
  }

  const path = [];
  let cur = end;
  while (cur && cur !== start) {
    path.push(cur);
    cur = parent[indexOf(cur.x, cur.y, cols, rows)];
  }
  path.push(start);
  return path.reverse();
}

function canMove(cell, dir) {
  if (dir === 'u') return !cell.walls.top;
  if (dir === 'd') return !cell.walls.bottom;
  if (dir === 'l') return !cell.walls.left;
  if (dir === 'r') return !cell.walls.right;
  return false;
}

function nextCell(grid, cols, rows, cell, dir) {
  let x = cell.x;
  let y = cell.y;
  if (dir === 'u') y--;
  if (dir === 'd') y++;
  if (dir === 'l') x--;
  if (dir === 'r') x++;
  const idx = indexOf(x, y, cols, rows);
  return idx === -1 ? null : grid[idx];
}

function parseMove(move) {
  if (!move) return null;
  const dir = move[0];
  if ('udlr'.indexOf(dir) === -1) return null;
  const steps = move.length > 1 ? parseInt(move.slice(1), 10) : 1;
  if (!steps || steps < 1 || steps > 3) return { dir: dir, steps: 1 };
  return { dir: dir, steps: steps };
}

function tryWalk(state, dir, steps) {
  const walked = [];
  let cur = state.pos;
  for (let i = 0; i < steps; i++) {
    if (!canMove(cur, dir)) return { ok: false, walked: walked };
    const nxt = nextCell(state.grid, state.cols, state.rows, cur, dir);
    if (!nxt) return { ok: false, walked: walked };
    walked.push(nxt);
    cur = nxt;
  }
  return { ok: true, walked: walked, pos: cur };
}

function cellCenter(cell, ox, oy) {
  return {
    x: ox + cell.x * CELL + CELL / 2,
    y: oy + cell.y * CELL + CELL / 2
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, y, x, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function strokeGlowPath(ctx, list, ox, oy, color, width) {
  if (!list || list.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let i = 0; i < list.length; i++) {
    const p = cellCenter(list[i], ox, oy);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

async function renderMaze(grid, cols, rows, opts) {
  opts = opts || {};
  const ox = PAD;
  const oy = PAD;
  const W = cols * CELL + PAD * 2;
  const H = rows * CELL + PAD * 2;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 20, W * 0.5, H * 0.55, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#1c1638');
  bg.addColorStop(0.45, '#0d1020');
  bg.addColorStop(1, '#06070d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#7aa2ff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.18 + i * 18, H * 0.12 + i * 10, 40 + i * 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  roundedRect(ctx, 8, 8, W - 16, H - 16, 16);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(255, 196, 80, 0.35)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  roundedRect(ctx, 12, 12, W - 24, H - 24, 13);
  ctx.strokeStyle = 'rgba(90, 140, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    const x = ox + cell.x * CELL;
    const y = oy + cell.y * CELL;
    const odd = (cell.x + cell.y) % 2 === 0;
    roundedRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 6);
    ctx.fillStyle = odd ? 'rgba(28, 36, 62, 0.72)' : 'rgba(18, 24, 44, 0.72)';
    ctx.fill();
  }

  strokeGlowPath(ctx, opts.progress, ox, oy, 'rgba(255, 206, 64, 0.92)', 7);
  strokeGlowPath(ctx, opts.good, ox, oy, 'rgba(64, 230, 150, 0.95)', 7);
  strokeGlowPath(ctx, opts.bad, ox, oy, 'rgba(255, 78, 88, 0.9)', 7);

  const start = grid[0];
  const end = grid[grid.length - 1];

  function drawPortal(cell, inner, outer, letter) {
    const c = cellCenter(cell, ox, oy);
    ctx.save();
    ctx.shadowColor = outer;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = outer;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.fillStyle = '#fffef6';
    ctx.font = 'bold 15px Sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, c.x, c.y + 0.5);
    ctx.restore();
  }

  drawPortal(start, '#2b6bff', '#6aa4ff', 'A');
  drawPortal(end, '#d63b4a', '#ff7a6b', 'B');

  if (opts.pos) {
    const c = cellCenter(opts.pos, ox, oy);
    ctx.save();
    ctx.shadowColor = '#ffe27a';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8d6';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#c98412';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(120, 210, 255, 0.22)';
  ctx.lineWidth = 7;
  ctx.shadowColor = 'rgba(80, 180, 255, 0.35)';
  ctx.shadowBlur = 8;
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    const x = ox + cell.x * CELL;
    const y = oy + cell.y * CELL;
    if (cell.walls.top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
    if (cell.walls.right) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
    if (cell.walls.bottom) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
    if (cell.walls.left) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e8f1ff';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    const x = ox + cell.x * CELL;
    const y = oy + cell.y * CELL;
    if (cell.walls.top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
    if (cell.walls.right) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
    if (cell.walls.bottom) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
    if (cell.walls.left) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
  }
  ctx.restore();

  return canvas.toBuffer('image/png');
}

function keyboard(disabled) {
  if (disabled) return { inline_keyboard: [[{ text: 'Game ended', callback_data: 'maze:x' }]] };
  return {
    inline_keyboard: [
      [
        { text: '⬆️ ×1', callback_data: 'maze:u' },
        { text: '⬆️ ×2', callback_data: 'maze:u2' },
        { text: '⬆️ ×3', callback_data: 'maze:u3' }
      ],
      [
        { text: '⬅️ ×1', callback_data: 'maze:l' },
        { text: '⬇️ ×1', callback_data: 'maze:d' },
        { text: '➡️ ×1', callback_data: 'maze:r' }
      ],
      [
        { text: '⬅️ ×2', callback_data: 'maze:l2' },
        { text: '⬇️ ×2', callback_data: 'maze:d2' },
        { text: '➡️ ×2', callback_data: 'maze:r2' }
      ],
      [
        { text: '⬅️ ×3', callback_data: 'maze:l3' },
        { text: '⬇️ ×3', callback_data: 'maze:d3' },
        { text: '➡️ ×3', callback_data: 'maze:r3' }
      ],
      [{ text: 'Give up', callback_data: 'maze:q' }]
    ]
  };
}

function parseDiff(args) {
  const raw = String((args && args[0]) || '').toLowerCase();
  if (raw === 'easy') return { level: 4, label: 'Easy' };
  if (raw === 'hard') return { level: 10, label: 'Hard' };
  const n = parseInt(raw, 10);
  if (!isNaN(n)) {
    const level = Math.max(1, Math.min(10, n));
    return { level: level, label: 'Level ' + level };
  }
  return { level: 6, label: 'Medium' };
}

function sizeFrom(level) {
  return Math.max(6, Math.min(14, 6 + Math.floor(level * 0.7)));
}

function caption(state, extra) {
  return (
    '✦ Maze  ·  ' + state.label + '\n' +
    'A = start    B = end\n' +
    '×1 / ×2 / ×3 = move 1, 2 or 3 cells\n' +
    'Moves: ' + (state.path.length - 1) + '\n' +
    'Wrong: ' + state.wrong + '/' + MAX_WRONG +
    (extra ? '\n' + extra : '')
  );
}

function photoOpts(state, extra, ended) {
  const opts = {
    caption: caption(state, extra),
    reply_markup: keyboard(!!ended)
  };
  if (state.replyTo) {
    opts.reply_to_message_id = state.replyTo;
    opts.allow_sending_without_reply = true;
  }
  return opts;
}

async function drawBuf(state, ended) {
  return renderMaze(state.grid, state.cols, state.rows, {
    progress: state.path,
    pos: ended ? null : state.pos,
    good: state.showGood || null,
    bad: state.showBad || null
  });
}

async function sendMaze(bot, chatId, state, extra, ended) {
  const buf = await drawBuf(state, ended);
  const msg = await bot.sendPhoto(chatId, buf, photoOpts(state, extra, ended), { filename: 'maze.png' });
  state.chatId = chatId;
  state.msgId = msg && msg.message_id;
  return msg;
}

async function updateMaze(bot, state, extra, ended) {
  const buf = await drawBuf(state, ended);
  try { await bot.deleteMessage(state.chatId, state.msgId); } catch (e) {}
  const msg = await bot.sendPhoto(state.chatId, buf, photoOpts(state, extra, ended), { filename: 'maze.png' });
  state.msgId = msg && msg.message_id;
  return msg;
}

export async function onStart(ctx) {
  const { args, senderID, bot, chatId } = ctx;
  const diff = parseDiff(args);
  const size = sizeFrom(diff.level);
  const grid = makeGrid(size, size);
  const good = solvePath(grid, size, size);
  const key = gameKey(chatId, senderID);
  const prev = games().get(key);
  if (prev && prev.msgId) {
    try { await bot.deleteMessage(chatId, prev.msgId); } catch (e) {}
  }

  const state = {
    owner: String(senderID),
    label: diff.label,
    grid: grid,
    cols: size,
    rows: size,
    pos: grid[0],
    path: [grid[0]],
    good: good,
    wrong: 0,
    ended: false,
    chatId: chatId,
    replyTo: pickReplyId(ctx)
  };

  await sendMaze(bot, chatId, state, 'Reach B. Path must be clear for ×2 / ×3.\nWin reward: ' + REWARD + ' coins');
  games().set(key, state);
}

export async function onCallback({ payload, callbackQuery, bot, usersData }) {
  const raw = (callbackQuery && callbackQuery.data) || '';
  const move = (payload && payload.args && payload.args[0]) || raw.split(':')[1];
  const uid = String(callbackQuery.from && callbackQuery.from.id);
  const chatId = callbackQuery.message && callbackQuery.message.chat && callbackQuery.message.chat.id;
  const key = gameKey(chatId, uid);
  const state = games().get(key);

  if (!state) {
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Game expired. Start /maze again.', show_alert: true }); } catch (e) {}
    return;
  }
  if (state.owner !== uid) {
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'This is not your maze.', show_alert: true }); } catch (e) {}
    return;
  }
  if (state.ended || move === 'x') {
    try { await bot.answerCallbackQuery(callbackQuery.id); } catch (e) {}
    return;
  }

  if (move === 'q') {
    state.ended = true;
    state.showGood = state.good;
    await updateMaze(bot, state, 'You gave up. Green path is the solution.', true);
    games().delete(key);
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Gave up' }); } catch (e) {}
    return;
  }

  const parsed = parseMove(move);
  if (!parsed) {
    try { await bot.answerCallbackQuery(callbackQuery.id); } catch (e) {}
    return;
  }

  const result = tryWalk(state, parsed.dir, parsed.steps);
  if (!result.ok) {
    state.wrong += 1;
    if (state.wrong >= MAX_WRONG) {
      state.ended = true;
      state.showGood = state.good;
      state.showBad = state.path;
      await updateMaze(bot, state, 'Out of attempts. Green = solution.', true);
      games().delete(key);
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Game over', show_alert: true }); } catch (e) {}
      return;
    }
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Wall! Need ' + parsed.steps + ' open cells. ' + state.wrong + '/' + MAX_WRONG
      });
    } catch (e) {}
    await updateMaze(bot, state, 'Blocked. ×' + parsed.steps + ' needs a clear path.');
    return;
  }

  for (let i = 0; i < result.walked.length; i++) state.path.push(result.walked[i]);
  state.pos = result.pos;

  const end = state.grid[state.grid.length - 1];
  if (state.pos.x === end.x && state.pos.y === end.y) {
    state.ended = true;
    state.showGood = state.good;
    try {
      const u = await usersData.get(uid);
      await usersData.set(uid, { money: (u.money || 0) + REWARD });
    } catch (e) {}
    await updateMaze(bot, state, 'You won! +' + REWARD + ' coins', true);
    games().delete(key);
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: '+' + REWARD + ' coins' }); } catch (e) {}
    return;
  }

  await updateMaze(bot, state);
  try {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: parsed.steps > 1 ? ('Moved ×' + parsed.steps) : undefined
    });
  } catch (e) {}
}
