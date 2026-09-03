import { createCanvas } from 'canvas';

export const eren = {
  name: 'clock',
  version: '1.0.0',
  aliases: ['time', 'now'],
  description: 'Analog clock with timezone buttons.',
  author: 'S4Eren',
  prefix: 'both',
  category: 'utility',
  type: 'anyone',
  cooldown: 3,
  guide: [''],
};

var lastClock = new Map();

var THEMES = [
  {
    name: 'Gold',
    bg1: '#0c0a12',
    bg2: '#161221',
    accent: '#d4af37',
    accentSoft: 'rgba(212,175,55,0.16)',
    face1: '#2a2438',
    face2: '#121018',
    text: '#f5f0e6',
    muted: '#b8b0a0',
    second: '#e57373'
  },
  {
    name: 'Ocean',
    bg1: '#06151c',
    bg2: '#0b2a37',
    accent: '#4fc3f7',
    accentSoft: 'rgba(79,195,247,0.16)',
    face1: '#123044',
    face2: '#071821',
    text: '#e8f6ff',
    muted: '#9fc3d4',
    second: '#80cbc4'
  },
  {
    name: 'Emerald',
    bg1: '#07140f',
    bg2: '#0e2a1c',
    accent: '#66bb6a',
    accentSoft: 'rgba(102,187,106,0.16)',
    face1: '#163324',
    face2: '#08150e',
    text: '#e8ffe8',
    muted: '#a9cbb0',
    second: '#ffcc80'
  },
  {
    name: 'Crimson',
    bg1: '#16080c',
    bg2: '#2a1018',
    accent: '#ef5350',
    accentSoft: 'rgba(239,83,80,0.16)',
    face1: '#3a1820',
    face2: '#14080b',
    text: '#ffe8ea',
    muted: '#d7a8ad',
    second: '#ffd54f'
  },
  {
    name: 'Violet',
    bg1: '#12081d',
    bg2: '#231338',
    accent: '#b388ff',
    accentSoft: 'rgba(179,136,255,0.16)',
    face1: '#2d1a4a',
    face2: '#120816',
    text: '#f3e8ff',
    muted: '#c3b3db',
    second: '#f48fb1'
  },
  {
    name: 'Silver',
    bg1: '#0d1014',
    bg2: '#1a2028',
    accent: '#cfd8dc',
    accentSoft: 'rgba(207,216,220,0.14)',
    face1: '#2a313a',
    face2: '#101418',
    text: '#f4f7f8',
    muted: '#b0bec5',
    second: '#90caf9'
  }
];

var ZONES = [
  { id: 'Asia/Dhaka', label: 'Dhaka' },
  { id: 'Asia/Kolkata', label: 'Kolkata' },
  { id: 'Asia/Karachi', label: 'Karachi' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Riyadh', label: 'Riyadh' },
  { id: 'Asia/Jakarta', label: 'Jakarta' },
  { id: 'Asia/Bangkok', label: 'Bangkok' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Shanghai', label: 'Shanghai' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Seoul', label: 'Seoul' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris' },
  { id: 'Europe/Berlin', label: 'Berlin' },
  { id: 'Europe/Moscow', label: 'Moscow' },
  { id: 'Europe/Istanbul', label: 'Istanbul' },
  { id: 'Africa/Cairo', label: 'Cairo' },
  { id: 'Africa/Lagos', label: 'Lagos' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'America/Chicago', label: 'Chicago' },
  { id: 'America/Denver', label: 'Denver' },
  { id: 'America/Los_Angeles', label: 'Los Angeles' },
  { id: 'America/Sao_Paulo', label: 'Sao Paulo' },
  { id: 'Australia/Sydney', label: 'Sydney' },
  { id: 'Pacific/Auckland', label: 'Auckland' },
  { id: 'UTC', label: 'UTC' }
];

var PER_PAGE = 8;

function pad(n) {
  return String(n).padStart(2, '0');
}

function pickTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

async function drop(bot, chatId, messageId) {
  if (!chatId || !messageId) return;
  await bot.deleteMessage(chatId, messageId).catch(function () {});
}

function remember(chatId, messageId) {
  lastClock.set(String(chatId), messageId);
}

function previous(chatId) {
  return lastClock.get(String(chatId));
}

function isValidZone(zone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch (e) {
    return false;
  }
}

function resolveZone(input) {
  var raw = String(input || '').trim();
  if (!raw) return null;

  var compact = raw.replace(/\s+/g, '_');
  if (isValidZone(compact)) return compact;
  if (isValidZone(raw)) return raw;

  var lower = raw.toLowerCase().replace(/\s+/g, ' ');
  var aliases = {
    dhaka: 'Asia/Dhaka',
    bd: 'Asia/Dhaka',
    bangladesh: 'Asia/Dhaka',
    india: 'Asia/Kolkata',
    kolkata: 'Asia/Kolkata',
    delhi: 'Asia/Kolkata',
    london: 'Europe/London',
    uk: 'Europe/London',
    tokyo: 'Asia/Tokyo',
    ny: 'America/New_York',
    nyc: 'America/New_York',
    'new york': 'America/New_York',
    la: 'America/Los_Angeles',
    utc: 'UTC',
    gmt: 'UTC'
  };
  if (aliases[lower]) return aliases[lower];

  for (var i = 0; i < ZONES.length; i++) {
    if (ZONES[i].id.toLowerCase() === lower.replace(/\s+/g, '_')) return ZONES[i].id;
    if (ZONES[i].label.toLowerCase() === lower) return ZONES[i].id;
  }
  return null;
}

function zoneParts(timeZone) {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZoneName: 'shortOffset'
  }).formatToParts(new Date());

  var map = {};
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type !== 'literal') map[parts[i].type] = parts[i].value;
  }

  var hour24 = Number(map.hour);
  var hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;

  return {
    hour24: hour24,
    hour12: hour12,
    minute: Number(map.minute),
    second: Number(map.second),
    ampm: hour24 >= 12 ? 'PM' : 'AM',
    weekday: map.weekday,
    day: map.day,
    month: map.month,
    year: map.year,
    offset: map.timeZoneName || '',
    zone: timeZone
  };
}

function drawClock(ctx, cx, cy, radius, t, theme) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0, 0, radius + 16, 0, Math.PI * 2);
  ctx.fillStyle = theme.accentSoft;
  ctx.fill();

  var face = ctx.createRadialGradient(-40, -40, 10, 0, 0, radius);
  face.addColorStop(0, theme.face1);
  face.addColorStop(1, theme.face2);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = theme.accent;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 12, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = theme.accentSoft;
  ctx.stroke();

  for (var i = 0; i < 60; i++) {
    var ang = (Math.PI / 30) * i;
    var outer = radius - 20;
    var inner = i % 5 === 0 ? radius - 42 : radius - 28;
    ctx.beginPath();
    ctx.moveTo(Math.sin(ang) * inner, -Math.cos(ang) * inner);
    ctx.lineTo(Math.sin(ang) * outer, -Math.cos(ang) * outer);
    ctx.lineWidth = i % 5 === 0 ? 3.5 : 1.2;
    ctx.strokeStyle = i % 5 === 0 ? theme.text : 'rgba(255,255,255,0.28)';
    ctx.stroke();
  }

  ctx.fillStyle = theme.text;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (var n = 1; n <= 12; n++) {
    var a = (Math.PI / 6) * n;
    var r = radius - 68;
    ctx.fillText(String(n), Math.sin(a) * r, -Math.cos(a) * r);
  }

  var hourAng = ((t.hour24 % 12) + t.minute / 60 + t.second / 3600) * Math.PI / 6;
  var minAng = (t.minute + t.second / 60) * Math.PI / 30;
  var secAng = t.second * Math.PI / 30;

  function hand(angle, length, width, color) {
    ctx.beginPath();
    ctx.moveTo(-Math.sin(angle) * 16, Math.cos(angle) * 16);
    ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  hand(hourAng, radius * 0.46, 9, theme.text);
  hand(minAng, radius * 0.66, 5, theme.accent);
  hand(secAng, radius * 0.74, 2.4, theme.second);

  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

function createClockCard(timeZone) {
  var theme = pickTheme();
  var t = zoneParts(timeZone);
  var width = 1400;
  var height = 800;
  var canvas = createCanvas(width, height);
  var ctx = canvas.getContext('2d');

  var bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  var glow = ctx.createRadialGradient(380, 400, 20, 380, 400, 360);
  glow.addColorStop(0, theme.accentSoft);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.beginPath();
  ctx.roundRect(40, 40, width - 80, height - 80, 28);
  ctx.fill();
  ctx.strokeStyle = theme.accentSoft;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawClock(ctx, 380, 400, 270, t, theme);

  var textX = 780;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = theme.accent;
  ctx.font = '20px Arial';
  ctx.fillText(String(t.zone).toUpperCase(), textX, 230);

  var digital = pad(t.hour12) + ':' + pad(t.minute) + ':' + pad(t.second);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px Arial';
  ctx.fillText(digital, textX, 340);

  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 42px Arial';
  ctx.fillText(t.ampm, textX + 430, 340);

  ctx.fillStyle = theme.accentSoft;
  ctx.fillRect(textX, 375, 280, 2);

  ctx.fillStyle = theme.text;
  ctx.font = '28px Arial';
  ctx.fillText(t.weekday, textX, 430);

  ctx.fillStyle = theme.muted;
  ctx.font = '24px Arial';
  ctx.fillText(t.day + ' ' + t.month + ' ' + t.year, textX, 475);

  ctx.fillStyle = theme.muted;
  ctx.font = '20px Arial';
  ctx.fillText('Timezone: ' + t.zone + (t.offset ? '  (' + t.offset + ')' : ''), textX, 530);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by Sakura AI', width / 2, 740);

  return {
    buffer: canvas.toBuffer('image/png'),
    digital: digital,
    ampm: t.ampm,
    date: t.weekday + ', ' + t.day + ' ' + t.month + ' ' + t.year,
    zone: t.zone,
    offset: t.offset,
    theme: theme.name
  };
}

function cb(obj) {
  obj.command = 'clock';
  return JSON.stringify(obj);
}

function buildKeyboard(page) {
  var others = ZONES.slice(1);
  var totalPages = Math.max(1, Math.ceil(others.length / (PER_PAGE - 1)));
  if (page < 0) page = 0;
  if (page > totalPages - 1) page = totalPages - 1;

  var start = page * (PER_PAGE - 1);
  var slice = others.slice(start, start + (PER_PAGE - 1));
  var list = [ZONES[0]].concat(slice);

  var rows = [];
  for (var i = 0; i < list.length; i += 2) {
    var row = [{
      text: list[i].id === 'Asia/Dhaka' ? 'Dhaka' : list[i].label,
      callback_data: cb({ a: 'z', z: list[i].id })
    }];
    if (list[i + 1]) {
      row.push({
        text: list[i + 1].label,
        callback_data: cb({ a: 'z', z: list[i + 1].id })
      });
    }
    rows.push(row);
  }

  var nav = [];
  if (page > 0) nav.push({ text: 'Prev', callback_data: cb({ a: 'p', n: page - 1 }) });
  nav.push({ text: (page + 1) + '/' + totalPages, callback_data: cb({ a: 'p', n: page }) });
  if (page < totalPages - 1) nav.push({ text: 'Next', callback_data: cb({ a: 'p', n: page + 1 }) });
  rows.push(nav);
  rows.push([
    { text: 'Custom', callback_data: cb({ a: 'c' }) },
    { text: 'Close', callback_data: cb({ a: 'x' }) }
  ]);

  return { inline_keyboard: rows };
}

function captionOf(card) {
  return (
    '🕐 <b>' + card.digital + ' ' + card.ampm + '</b>\n' +
    '📅 ' + card.date + '\n' +
    '🌍 ' + card.zone + (card.offset ? '  (' + card.offset + ')' : '')
  );
}

async function sendClock(bot, chatId, timeZone, page) {
  var card = createClockCard(timeZone);
  var oldId = previous(chatId);
  var sent = await bot.sendPhoto(chatId, card.buffer, {
    caption: captionOf(card),
    parse_mode: 'HTML',
    reply_markup: buildKeyboard(page || 0)
  });
  remember(chatId, sent.message_id);
  if (oldId && oldId !== sent.message_id) await drop(bot, chatId, oldId);
  return sent;
}

export async function onStart({ event, bot }) {
  await sendClock(bot, event.chat.id, 'Asia/Dhaka', 0);
}

export async function onCallback({ bot, callbackQuery, payload, response, senderID }) {
  var action = payload && payload.a;
  var msg = callbackQuery.message;
  var chatId = msg.chat.id;
  var messageId = msg.message_id;
  remember(chatId, messageId);

  if (action === 'x') {
    await drop(bot, chatId, messageId);
    lastClock.delete(String(chatId));
    return response.answerCallback(callbackQuery, { text: 'Closed' });
  }

  if (action === 'p') {
    await bot.editMessageReplyMarkup(buildKeyboard(Number(payload.n) || 0), {
      chat_id: chatId,
      message_id: messageId
    }).catch(function () {});
    return response.answerCallback(callbackQuery, { text: 'Page updated' });
  }

  if (action === 'z') {
    var zone = payload.z;
    if (!isValidZone(zone)) {
      return response.answerCallback(callbackQuery, { text: 'Invalid timezone', show_alert: true });
    }
    await sendClock(bot, chatId, zone, 0);
    return response.answerCallback(callbackQuery, { text: zone });
  }

  if (action === 'c') {
    await bot.editMessageCaption(
      'Custom Timezone\n\n' +
      'Reply to this message with a timezone name.\n\n' +
      'Example:\n' +
      '<code>Europe/London</code>\n' +
      '<code>America/New_York</code>\n' +
      '<code>Asia/Tokyo</code>',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: 'Back', callback_data: cb({ a: 'b' }) },
            { text: 'Close', callback_data: cb({ a: 'x' }) }
          ]]
        }
      }
    ).catch(function () {});

    if (global.Sakura && global.Sakura.onReply) {
      global.Sakura.onReply.set(messageId, {
        commandName: 'clock',
        author: String(senderID)
      });
    }

    return response.answerCallback(callbackQuery, { text: 'Send a timezone name' });
  }

  if (action === 'b') {
    await sendClock(bot, chatId, 'Asia/Dhaka', 0);
    return response.answerCallback(callbackQuery, { text: 'Back' });
  }
}

export async function onReply({ event, bot, Reply, senderID }) {
  if (Reply && Reply.author && String(senderID) !== String(Reply.author)) return;

  var raw = (event.text || event.caption || '').trim();
  var zone = resolveZone(raw);

  if (!zone) {
    return bot.sendMessage(
      event.chat.id,
      'Invalid timezone.\nTry: Europe/London, America/New_York, Asia/Tokyo',
      { reply_to_message_id: event.message_id }
    );
  }

  var promptId = event.reply_to_message && event.reply_to_message.message_id;
  await drop(bot, event.chat.id, promptId);
  if (Reply && Reply.delete) Reply.delete();

  await sendClock(bot, event.chat.id, zone, 0);
    }
