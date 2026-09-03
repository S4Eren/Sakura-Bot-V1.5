import axios from 'axios';

const API = 'https://sakura-apis.onrender.com/api/pinterest';
const PER_PAGE = 10;
const MAX_RESULTS = 100;

export const eren = {
  name: 'pinterest',
  version: '1.3.0',
  aliases: ['pin'],
  description: 'Search Pinterest images, 10 per page.',
  author: 'S4Eren',
  category: 'image',
  type: 'anyone',
  cooldown: 8,
  usePrefix: true,
  guide: ['<query>']
};

function sessions() {
  const g = global.Sakura || global.sakura;
  return g.pinSessions || (g.pinSessions = new Map());
}

function keyOf(chatId, userId) {
  return String(chatId) + ':' + String(userId);
}

function replyOpts(replyTo) {
  return replyTo ? { reply_to_message_id: replyTo } : {};
}

async function searchPins(query) {
  const res = await axios.get(API, {
    params: { query: query, limit: MAX_RESULTS },
    timeout: 20000
  });
  const body = res.data || {};
  const list = body.data || body.results || body.images || [];
  return list.map(function (item) {
    if (typeof item === 'string') return item;
    return item.url || item.image || item.original || item.src || '';
  }).filter(Boolean).slice(0, MAX_RESULTS);
}

function pageSlice(urls, page) {
  const start = (page - 1) * PER_PAGE;
  return urls.slice(start, start + PER_PAGE);
}

function totalPages(urls) {
  return Math.max(1, Math.ceil(urls.length / PER_PAGE));
}

function keyboard(page, total) {
  const nav = [];
  if (page > 1) nav.push({ text: '< Prev', callback_data: 'pinterest:p' });
  nav.push({ text: page + '/' + total, callback_data: 'pinterest:x' });
  if (page < total) nav.push({ text: 'Next >', callback_data: 'pinterest:n' });
  return { inline_keyboard: [nav] };
}

async function deleteOld(bot, chatId, state) {
  const ids = (state.albumIds || []).concat(state.msgId ? [state.msgId] : []);
  for (let i = 0; i < ids.length; i++) {
    try { await bot.deleteMessage(chatId, ids[i]); } catch (e) {}
  }
  state.albumIds = [];
  state.msgId = null;
}

async function sendPage(bot, state, page) {
  const total = totalPages(state.urls);
  const cur = Math.min(Math.max(1, page), total);
  const urls = pageSlice(state.urls, cur);
  state.page = cur;

  await deleteOld(bot, state.chatId, state);

  const caption = '"' + state.query + '"\nPage ' + cur + '/' + total + ' • ' + state.urls.length + ' images';
  const opts = replyOpts(state.replyTo);

  let album = [];
  if (urls.length === 1) {
    const msg = await bot.sendPhoto(state.chatId, urls[0], Object.assign({ caption: caption }, opts));
    album = [msg];
  } else if (urls.length > 1) {
    const media = urls.map(function (url, i) {
      return { type: 'photo', media: url, caption: i === 0 ? caption : undefined };
    });
    album = await bot.sendMediaGroup(state.chatId, media, opts);
  }

  state.albumIds = (album || []).map(function (m) { return m.message_id; });

  const ctrl = await bot.sendMessage(
    state.chatId,
    'Page ' + cur + '/' + total + '  •  ' + urls.length + ' photos this page',
    Object.assign({ reply_markup: keyboard(cur, total) }, opts)
  );
  state.msgId = ctrl && ctrl.message_id;
}

export async function onStart({ args, senderID, bot, chatId, event }) {
  const query = args.join(' ').trim();
  const replyTo = event && event.message_id;
  if (!query) {
    return bot.sendMessage(chatId, 'Usage: /pin <query>', replyOpts(replyTo));
  }

  const wait = await bot.sendMessage(chatId, 'Searching Pinterest...', replyOpts(replyTo));
  try {
    const urls = await searchPins(query);
    try { await bot.deleteMessage(chatId, wait.message_id); } catch (e) {}
    if (!urls.length) {
      return bot.sendMessage(chatId, 'No images found for "' + query + '".', replyOpts(replyTo));
    }

    const key = keyOf(chatId, senderID);
    const prev = sessions().get(key);
    if (prev) await deleteOld(bot, chatId, prev);

    const state = {
      owner: String(senderID),
      chatId: chatId,
      query: query,
      urls: urls,
      page: 1,
      albumIds: [],
      msgId: null,
      replyTo: replyTo
    };
    await sendPage(bot, state, 1);
    sessions().set(key, state);
  } catch (err) {
    console.error('[pinterest]', err);
    try { await bot.deleteMessage(chatId, wait.message_id); } catch (e) {}
    return bot.sendMessage(chatId, 'Pinterest search failed. API may be down.', replyOpts(replyTo));
  }
}

export async function onCallback({ payload, callbackQuery, bot }) {
  const raw = String((callbackQuery && callbackQuery.data) || '');
  const parts = raw.split(':');
  const act = (payload && payload.args && payload.args[0]) || parts[1];
  const uid = String(callbackQuery.from && callbackQuery.from.id);
  const chatId = callbackQuery.message && callbackQuery.message.chat && callbackQuery.message.chat.id;
  const key = keyOf(chatId, uid);
  const state = sessions().get(key);

  if (!state || state.owner !== uid) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: state ? 'This search belongs to someone else.' : 'Session expired. Search again.',
        show_alert: true
      });
    } catch (e) {}
    return;
  }
  if (act === 'x') {
    try { await bot.answerCallbackQuery(callbackQuery.id); } catch (e) {}
    return;
  }
  if (act === 'n') {
    await sendPage(bot, state, state.page + 1);
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Page ' + state.page }); } catch (e) {}
    return;
  }
  if (act === 'p') {
    await sendPage(bot, state, state.page - 1);
    try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Page ' + state.page }); } catch (e) {}
    return;
  }
  try { await bot.answerCallbackQuery(callbackQuery.id); } catch (e) {}
}
