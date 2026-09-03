import { createCanvas, loadImage } from 'canvas';

export const eren = {
  name: 'balance',
  version: '1.0.0',
  aliases: ['bal', 'money', 'wallet'],
  description: 'Check money and level on a profile card.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'economy',
  type: 'anyone',
  cooldown: 3,
  guide: ['', '@user', 'uid', '(reply)']
};

const THEMES = [
  { name: 'GOLD', accent: '#f5c542', soft: '#ffe9a8', dark: '#7a5a10', bg1: '#120e08', bg2: '#241c10', panel: '#1b160e' },
  { name: 'CYAN', accent: '#3ad7e6', soft: '#b8f6ff', dark: '#0b5b66', bg1: '#071016', bg2: '#10222b', panel: '#0e1a21' },
  { name: 'VIOLET', accent: '#b07cff', soft: '#e2ccff', dark: '#4b2d86', bg1: '#0d0a16', bg2: '#1a1230', panel: '#141022' },
  { name: 'ROSE', accent: '#ff6b8b', soft: '#ffd0da', dark: '#7a2438', bg1: '#14080c', bg2: '#2a1218', panel: '#1c0e13' },
  { name: 'EMERALD', accent: '#3ee0a0', soft: '#c8ffe8', dark: '#0d5c40', bg1: '#07140f', bg2: '#10241c', panel: '#0d1b16' },
  { name: 'BLUE', accent: '#4d8dff', soft: '#c9dbff', dark: '#1a3d86', bg1: '#070b16', bg2: '#10182c', panel: '#0d1422' }
];

function pickTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function calcLevel(exp) {
  return Math.floor(Math.sqrt((Number(exp) || 0) / 100)) + 1;
}

function expForLevel(level) {
  return 100 * Math.pow(Math.max(0, level - 1), 2);
}

function formatNum(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(2).replace(/\.00$/, '') + 'B';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function initials(name) {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
  const a = parts[0] ? parts[0].charAt(0) : 'U';
  const b = parts[1] ? parts[1].charAt(0) : '';
  return (a + b).toUpperCase();
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function hexRgba(hexColor, a) {
  const h = hexColor.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

async function getAvatar(bot, userId) {
  try {
    const pack = await bot.getUserProfilePhotos(userId, { limit: 1 });
    if (!pack || !pack.total_count || !pack.photos[0] || !pack.photos[0].length) return null;
    const sizes = pack.photos[0];
    const file = sizes[sizes.length - 1];
    const link = await bot.getFileLink(file.file_id);
    return await loadImage(link);
  } catch (e) {
    return null;
  }
}

function resolveTarget(event, args, senderID) {
  if (event && event.reply_to_message && event.reply_to_message.from) {
    return String(event.reply_to_message.from.id);
  }
  if (event && event.entities) {
    for (let i = 0; i < event.entities.length; i++) {
      const e = event.entities[i];
      if (e.type === 'text_mention' && e.user && e.user.id) return String(e.user.id);
    }
  }
  if (args[0] && /^-?\d+$/.test(String(args[0]))) return String(args[0]);
  return String(senderID);
}

function chip(ctx, x, y, theme) {
  rr(ctx, x, y, 54, 42, 8);
  const g = ctx.createLinearGradient(x, y, x + 54, y + 42);
  g.addColorStop(0, theme.soft);
  g.addColorStop(1, theme.accent);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 4);
  ctx.lineTo(x + 18, y + 38);
  ctx.moveTo(x + 36, y + 4);
  ctx.lineTo(x + 36, y + 38);
  ctx.moveTo(x + 6, y + 16);
  ctx.lineTo(x + 48, y + 16);
  ctx.moveTo(x + 6, y + 26);
  ctx.lineTo(x + 48, y + 26);
  ctx.strokeStyle = hexRgba(theme.dark, 0.45);
  ctx.stroke();
}

function waves(ctx, x, y, theme) {
  ctx.save();
  ctx.strokeStyle = theme.soft;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y, 8 + i * 8, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

async function drawCard(bot, user, target, theme) {
  const W = 1080;
  const H = 540;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = theme.accent;
  for (let i = 0; i < 36; i++) {
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc((i * 97) % W, (i * 53) % H, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  rr(ctx, 40, 36, W - 80, H - 72, 32);
  ctx.fillStyle = hexRgba('#ffffff', 0.03);
  ctx.fill();
  ctx.strokeStyle = hexRgba(theme.accent, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 18px Sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAKURA', 72, 78);
  ctx.fillStyle = hexRgba('#ffffff', 0.45);
  ctx.font = '16px Sans-serif';
  ctx.fillText('PREMIUM WALLET', 148, 78);

  ctx.textAlign = 'right';
  ctx.fillStyle = hexRgba('#ffffff', 0.5);
  ctx.font = 'bold 16px Sans-serif';
  ctx.fillText('VIRTUAL CARD', W - 72, 78);
  waves(ctx, W - 210, 78, theme);
  chip(ctx, W - 168, 108, theme);

  const name = user.name || user.username || 'Unknown';
  const money = user.money || 0;
  const exp = user.exp || 0;
  const level = user.level || calcLevel(exp);
  const curFloor = expForLevel(level);
  const nextFloor = expForLevel(level + 1);
  const need = Math.max(1, nextFloor - curFloor);
  const have = Math.max(0, exp - curFloor);
  const pct = Math.max(0, Math.min(1, have / need));

  const hx = 196;
  const hy = 278;
  const hr = 108;

  hex(ctx, hx, hy, hr + 10);
  ctx.strokeStyle = hexRgba(theme.accent, 0.18);
  ctx.lineWidth = 12;
  ctx.stroke();

  hex(ctx, hx, hy, hr + 3);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  const avatar = await getAvatar(bot, target);
  ctx.save();
  hex(ctx, hx, hy, hr - 4);
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, hx - hr, hy - hr, hr * 2, hr * 2);
  } else {
    ctx.fillStyle = theme.panel;
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 54px Sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), hx, hy);
  }
  ctx.restore();

  hex(ctx, hx, hy + hr - 8, 28);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.fillStyle = theme.bg1;
  ctx.font = 'bold 16px Sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), hx, hy + hr - 8);

  const shown = String(name).length > 22 ? String(name).slice(0, 21) + '…' : String(name);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = hexRgba('#ffffff', 0.5);
  ctx.font = '16px Sans-serif';
  ctx.fillText('CARD HOLDER', 360, 168);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Sans-serif';
  ctx.fillText(shown.toUpperCase(), 360, 216);

  ctx.fillStyle = hexRgba('#ffffff', 0.38);
  ctx.font = '20px Sans-serif';
  ctx.fillText(String(target), 360, 250);

  ctx.fillStyle = hexRgba('#ffffff', 0.5);
  ctx.font = '15px Sans-serif';
  ctx.fillText('AVAILABLE BALANCE', 360, 310);

  ctx.fillStyle = theme.soft;
  ctx.font = 'bold 56px Sans-serif';
  ctx.fillText('$' + formatNum(money), 360, 368);

  rr(ctx, 360, 400, 640, 70, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  ctx.fillStyle = hexRgba('#ffffff', 0.5);
  ctx.font = '14px Sans-serif';
  ctx.fillText('XP  ' + formatNum(have) + ' / ' + formatNum(need), 384, 428);

  ctx.textAlign = 'right';
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 14px Sans-serif';
  ctx.fillText('LEVEL ' + level + '  →  ' + (level + 1), 976, 428);

  const barX = 384;
  const barY = 440;
  const barW = 592;
  const barH = 14;
  rr(ctx, barX, barY, barW, barH, 7);
  ctx.fillStyle = theme.bg1;
  ctx.fill();
  if (pct > 0) {
    ctx.save();
    rr(ctx, barX, barY, barW, barH, 7);
    ctx.clip();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(barX, barY, Math.max(16, barW * pct), barH);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

function captionOf(user, target) {
  const name = user.name || user.username || 'Unknown';
  return (
    name + '\n' +
    'Balance: $' + formatNum(user.money || 0) + '\n' +
    'Level: ' + (user.level || calcLevel(user.exp || 0)) + '  |  EXP: ' + formatNum(user.exp || 0) + '\n' +
    'UID: ' + target
  );
}

export async function onStart({ args, senderID, usersData, response, event, bot, chatId }) {
  const target = resolveTarget(event, args, senderID);
  const user = await usersData.get(target);
  const theme = pickTheme();
  const caption = captionOf(user, target);

  try {
    const buffer = await drawCard(bot, user, target, theme);
    if (typeof response.upload === 'function') {
      return response.upload('photo', buffer, { caption: caption, filename: 'balance.png' });
    }
    return bot.sendPhoto(chatId, buffer, { caption: caption }, { filename: 'balance.png' });
  } catch (err) {
    console.error('[balance canvas]', err);
    return response.reply(caption);
  }
}
