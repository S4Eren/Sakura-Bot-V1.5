import os from 'os';
import { execSync } from 'child_process';
import { createCanvas } from 'canvas';

export const eren = {
  name: 'status',
  version: '1.0.0',
  aliases: ['sys', 'system'],
  description: 'Show a professional system status card.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'system',
  type: 'anyone',
  cooldown: 8,
  guide: [''],
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatUptime(sec) {
  sec = Math.max(0, Math.floor(sec));
  var d = Math.floor(sec / 86400); sec %= 86400;
  var h = Math.floor(sec / 3600); sec %= 3600;
  var m = Math.floor(sec / 60); var s = sec % 60;
  return d + 'd ' + pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
}

function gb(bytes) {
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dhakaStamp() {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  var map = {};
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type !== 'literal') map[parts[i].type] = parts[i].value;
  }
  return {
    date: map.weekday + ' ' + map.day + ' ' + map.month + ' ' + map.year,
    time: map.hour + ':' + map.minute + ':' + map.second
  };
}

function cpuUsage() {
  var cpus = os.cpus() || [];
  if (!cpus.length) return 0;
  var idle = 0;
  var total = 0;
  for (var i = 0; i < cpus.length; i++) {
    var t = cpus[i].times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return clamp(((1 - idle / total) * 100), 0, 100);
}

function diskInfo() {
  try {
    var out = execSync('df -k /', { encoding: 'utf8' }).trim().split('\n');
    var cols = out[out.length - 1].split(/\s+/);
    var used = Number(cols[2]) * 1024;
    var total = Number(cols[1]) * 1024;
    if (!total) return null;
    return { used: used, total: total, pct: clamp((used / total) * 100, 0, 100) };
  } catch (e) {
    return null;
  }
}

function collect(pingMs) {
  var total = os.totalmem();
  var free = os.freemem();
  var used = total - free;
  var load = os.loadavg();
  var disk = diskInfo();
  var cmds = 0;
  try {
    cmds = (global.Sakura && global.Sakura.commands && global.Sakura.commands.size) ||
      (global.Sakura && global.Sakura.commands && Object.keys(global.Sakura.commands).length) || 0;
  } catch (e) {}

  return {
    uptime: formatUptime(process.uptime()),
    ping: (pingMs || 0) + ' ms',
    ramUsed: used,
    ramTotal: total,
    ramPct: clamp((used / total) * 100, 0, 100),
    cpuPct: cpuUsage(),
    platform: os.platform() + ' (' + os.arch() + ')',
    node: process.version,
    host: os.hostname(),
    load: load.map(function (n) { return n.toFixed(2); }).join(', '),
    disk: disk,
    commands: cmds,
    cores: (os.cpus() || []).length
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,16,28,0.82)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 220, 200, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, pct, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(8, w * clamp(pct, 0, 100) / 100), h, h / 2);
  ctx.fill();
}

function ring(ctx, cx, cy, r, pct, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 14;
  ctx.stroke();

  var start = -Math.PI / 2;
  var end = start + (Math.PI * 2 * clamp(pct, 0, 100) / 100);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.fillStyle = '#eaf7f4';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pct.toFixed(1) + '%', cx, cy);
}

function createCard(data) {
  var stamp = dhakaStamp();
  var width = 1500;
  var height = 820;
  var canvas = createCanvas(width, height);
  var ctx = canvas.getContext('2d');

  var bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#071018');
  bg.addColorStop(1, '#0b1c24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  var glow = ctx.createRadialGradient(180, 80, 10, 180, 80, 420);
  glow.addColorStop(0, 'rgba(64, 224, 196, 0.14)');
  glow.addColorStop(1, 'rgba(64,224,196,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  panel(ctx, 28, 22, width - 56, height - 44);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#40e0c4';
  ctx.beginPath();
  ctx.arc(68, 68, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8fffb';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('SYSTEM STATUS', 90, 78);

  ctx.fillStyle = '#6f8b90';
  ctx.font = '14px Arial';
  ctx.fillText('LIVE MONITOR  •  SAKURA AI', 90, 104);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#9eb6bb';
  ctx.font = '16px Arial';
  ctx.fillText(stamp.date, width - 56, 68);
  ctx.fillStyle = '#40e0c4';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(stamp.time, width - 56, 98);

  panel(ctx, 56, 130, 820, 470);

  var rows = [
    ['BOT UPTIME', data.uptime],
    ['PING', data.ping],
    ['RAM', gb(data.ramUsed) + ' / ' + gb(data.ramTotal)],
    ['CPU LOAD', data.cpuPct.toFixed(2) + '%  •  ' + data.cores + ' cores'],
    ['PLATFORM', data.platform],
    ['NODE.JS', data.node],
    ['HOSTNAME', data.host]
  ];

  for (var i = 0; i < rows.length; i++) {
    var y = 168 + i * 58;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)';
    roundRect(ctx, 76, y - 28, 780, 50, 8);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#40e0c4';
    ctx.beginPath();
    ctx.arc(98, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b7d7d2';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(rows[i][0], 116, y);
    ctx.fillStyle = '#f3fffc';
    ctx.font = '16px Arial';
    ctx.fillText(rows[i][1], 320, y);
  }

  bar(ctx, 320, 300, 420, 10, data.ramPct, '#40e0c4');
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8aa8a4';
  ctx.font = '13px Arial';
  ctx.fillText(data.ramPct.toFixed(0) + '%', 850, 292);

  panel(ctx, 900, 130, 544, 220);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#40e0c4';
  ctx.beginPath();
  ctx.arc(928, 162, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d7f6f1';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('CPU USAGE', 944, 168);
  ring(ctx, 1048, 250, 54, data.cpuPct, '#40e0c4');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9eb6bb';
  ctx.font = '15px Arial';
  ctx.fillText('Load average', 1148, 230);
  ctx.fillStyle = '#eaf7f4';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(data.load, 1148, 258);

  panel(ctx, 900, 370, 544, 230);
  ctx.fillStyle = '#7ee0a6';
  ctx.beginPath();
  ctx.arc(928, 402, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d7f6f1';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('MEMORY', 944, 408);
  ring(ctx, 1048, 492, 54, data.ramPct, '#7ee0a6');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9eb6bb';
  ctx.font = '15px Arial';
  ctx.fillText('Used  ' + gb(data.ramUsed), 1148, 472);
  ctx.fillText('Total  ' + gb(data.ramTotal), 1148, 500);

  panel(ctx, 56, 620, 820, 120);
  ctx.fillStyle = '#d7f6f1';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('STORAGE', 80, 656);
  if (data.disk) {
    bar(ctx, 80, 680, 620, 14, data.disk.pct, '#5ad1ff');
    ctx.fillStyle = '#9eb6bb';
    ctx.font = '14px Arial';
    ctx.fillText(gb(data.disk.used) + ' / ' + gb(data.disk.total) + '   (' + data.disk.pct.toFixed(0) + '%)', 80, 716);
  } else {
    ctx.fillStyle = '#9eb6bb';
    ctx.font = '14px Arial';
    ctx.fillText('Storage data unavailable', 80, 696);
  }

  panel(ctx, 900, 620, 544, 120);
  ctx.fillStyle = '#7ee0a6';
  ctx.beginPath();
  ctx.arc(932, 668, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eaf7f4';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('STATUS  ONLINE', 952, 674);
  ctx.fillStyle = '#9eb6bb';
  ctx.font = '15px Arial';
  ctx.fillText('Commands loaded: ' + data.commands, 952, 706);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.font = '13px Arial';
  ctx.fillText('Powered by Sakura AI', width / 2, height - 18);

  return canvas.toBuffer('image/png');
}

export async function onStart({ event, bot }) {
  var t0 = Date.now();
  try {
    await bot.getMe();
  } catch (e) {}
  var ping = Date.now() - t0;
  var data = collect(ping);
  var buffer = createCard(data);

  await bot.sendPhoto(event.chat.id, buffer, {
    caption: '🟢 <b>System Online</b>\n⏱ Uptime: <b>' + data.uptime + '</b>\n📡 Ping: <b>' + data.ping + '</b>',
    parse_mode: 'HTML',
    reply_to_message_id: event.message_id
  });
    }
