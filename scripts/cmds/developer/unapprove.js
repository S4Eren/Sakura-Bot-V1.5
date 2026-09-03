export const eren = {
  name: 'unapprove',
  version: '1.3.0',
  aliases: ['deny'],
  description: 'Unapprove a user or group. This always blocks them.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 1,
  guide: ['user <uid>', 'user (reply)', 'thread', 'thread <chatId>']
};

export async function onStart({ args, event, chatId, isGroup, usersData, threadsData, response }) {
  const mode = String(args[0] || (isGroup ? 'thread' : '')).toLowerCase();

  if (mode === 'thread' || mode === 'group' || mode === 'chat') {
    const id = String(args[1] || chatId);
    await threadsData.set(id, { approved: false, denied: true });
    return response.reply('Unapproved group. Bot blocked here.\nChat ID: ' + id);
  }

  let uid = mode === 'user' ? args[1] : args[0];
  if (event && event.reply_to_message && event.reply_to_message.from) {
    uid = String(event.reply_to_message.from.id);
  }
  if (!uid) {
    return response.reply(
      'Usage:\n' +
      '/unapprove user 123456789\n' +
      '/unapprove user (reply)\n' +
      '/unapprove thread'
    );
  }
  uid = String(uid);
  await usersData.set(uid, { approved: false, denied: true });
  return response.reply('Unapproved user. Bot blocked for them.\nUID: ' + uid);
      }
