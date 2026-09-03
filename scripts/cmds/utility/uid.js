export const eren = {
  name: 'uid',
  version: '1.0.0',
  aliases: ['id', 'userid'],
  description: 'Show your Telegram user ID, or the ID of the user you reply to.',
  author: 'S4Eren',
  category: 'utility',
  type: 'anyone',
  usePrefix: 'both',
  cooldown: 2,
  guide: ['', '(reply to someone)']
};

export async function onStart({ event, from, senderID, args, response }) {
  const reply = event.reply_to_message;
  const target = reply && reply.from ? reply.from : from;
  const id = target && target.id ? String(target.id) : String(senderID);
  const name = [target && target.first_name, target && target.last_name].filter(Boolean).join(' ') || 'User';
  const username = target && target.username ? '@' + target.username : 'none';

  if (args[0] && /^\d+$/.test(args[0])) {
    return response.reply('UID: `' + args[0] + '`');
  }

  return response.reply(
    '👤 Name: ' + name + '\n' +
    '🔗 Username: ' + username + '\n' +
    '🆔 UID: `' + id + '`'
  );
}
