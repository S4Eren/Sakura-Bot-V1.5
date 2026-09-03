function nameOf(from = {}, user = {}) {
  return (
    user.name ||
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    (from.username ? `@${from.username}` : '') ||
    user.username ||
    'Unknown'
  );
}

export async function notifyDevs(text, extra = {}) {
  const bots = global.Sakura?.bots || [];
  const devID = global.Sakura?.config?.devID || [];
  if (!bots.length || !devID.length) return;

  const { bot } = bots[0];
  const opts = {
    disable_web_page_preview: true
  };
  if (extra.reply_markup) opts.reply_markup = extra.reply_markup;

  for (const id of devID) {
    try {
      await bot.sendMessage(id, text, opts);
    } catch (e) {
      global.Sakura?.log?.warn(`Dev notify failed for ${id}: ${e.message}`);
    }
  }
}

export function approveKeyboard(kind, id) {
  return {
    inline_keyboard: [[
      { text: '✅ Approve', callback_data: JSON.stringify({ command: 'approve', act: 'ok', kind, id: String(id) }) },
      { text: '⛔ Unapprove', callback_data: JSON.stringify({ command: 'approve', act: 'no', kind, id: String(id) }) }
    ]]
  };
}

export async function notifyNewUser(senderID, from, isGroup, chat) {
  const id = String(senderID);
  const devID = (global.Sakura?.config?.devID || []).map(String);
  if (devID.includes(id)) return;

  const seen = global.Sakura.notifiedUsers || (global.Sakura.notifiedUsers = new Set());
  if (seen.has(id)) return;
  seen.add(id);

  const uname = from && from.username ? '@' + from.username : 'none';
  const where = isGroup
    ? 'Group: ' + (chat && chat.title || 'Unknown') + '\nChat ID: ' + (chat && chat.id)
    : 'Chat: Private';

  await notifyDevs(
    'New user used the bot\n\n' +
    'Name: ' + nameOf(from) + '\n' +
    'Username: ' + uname + '\n' +
    'User ID: ' + id + '\n' +
    where + '\n\n' +
    'Use:\n' +
    '/approve user ' + id + '\n' +
    '/unapprove user ' + id,
    { reply_markup: approveKeyboard('user', id) }
  );
}

export async function notifyNewThread(chat, from) {
  const chatId = String(chat?.id || '');
  if (!chatId) return;
  const seen = global.Sakura.notifiedThreads || (global.Sakura.notifiedThreads = new Set());
  if (seen.has(chatId)) return;
  seen.add(chatId);

  const adder = from ? `${nameOf(from)} | \`${from.id}\`` : 'Unknown';

  await notifyDevs(
    `👥 *Bot added to a new group*\n\n` +
    `Title: *${chat?.title || 'Unknown'}*\n` +
    `Type: ${chat?.type || 'group'}\n` +
    `Chat ID: \`${chatId}\`\n` +
    `Added by: ${adder}\n\n` +
    `Tap a button or use:\n` +
    `\`/approve thread ${chatId}\`\n` +
    `\`/unapprove thread ${chatId}\``,
    { reply_markup: approveKeyboard('thread', chatId) }
  );
}
