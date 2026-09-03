export const eren = {
  name: 'approve',
  version: '1.3.0',
  aliases: ['allow'],
  description: 'Approve a user or this group.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 1,
  guide: ['user <uid>', 'user (reply)', 'thread', 'thread <chatId>']
};

async function doApprove(kind, id, state, usersData, threadsData) {
  id = String(id);
  if (kind === 'user') {
    await usersData.set(id, { approved: !!state, denied: !state });
    const u = await usersData.get(id);
    const label = u.name || u.username || id;
    return (state ? 'Approved user: ' : 'Unapproved user: ') + label + '\nUID: ' + id;
  }
  await threadsData.set(id, { approved: !!state, denied: !state });
  const t = await threadsData.get(id);
  const label = t.title || id;
  return (state ? 'Approved group: ' : 'Unapproved group: ') + label + '\nChat ID: ' + id;
}

export async function onStart({ args, event, chatId, isGroup, usersData, threadsData, response }) {
  const mode = String(args[0] || (isGroup ? 'thread' : '')).toLowerCase();

  if (mode === 'thread' || mode === 'group' || mode === 'chat') {
    const id = args[1] || chatId;
    const text = await doApprove('thread', id, true, usersData, threadsData);
    return response.reply(text);
  }

  let uid = mode === 'user' ? args[1] : args[0];
  if (event && event.reply_to_message && event.reply_to_message.from) {
    uid = String(event.reply_to_message.from.id);
  }
  if (!uid) {
    return response.reply(
      'Usage:\n' +
      '/approve user 123456789\n' +
      '/approve user (reply to message)\n' +
      '/approve thread\n' +
      '/approve thread -1001234567890'
    );
  }
  const text = await doApprove('user', uid, true, usersData, threadsData);
  return response.reply(text);
}

export async function onCallback({ payload, usersData, threadsData, response, callbackQuery, role }) {
  if (role < 2) {
    return response.answerCallback(callbackQuery, { text: 'Developers only.', show_alert: true });
  }
  const kind = payload.kind;
  const id = payload.id;
  const state = payload.act !== 'no';
  if (!id || (kind !== 'user' && kind !== 'thread')) {
    return response.answerCallback(callbackQuery, { text: 'Invalid data.', show_alert: true });
  }
  const text = await doApprove(kind, id, state, usersData, threadsData);
  await response.answerCallback(callbackQuery, { text: state ? 'Approved' : 'Unapproved' });
  try { await response.update(callbackQuery.message, text); }
  catch (e) { await response.reply(text); }
}
