export const eren = {
  name: 'ban',
  version: '1.0.0',
  aliases: ['userban'],
  description: 'Ban a user from the bot.',
  author: 'S4Eren',
  usePrefix: 'both',
  type: 'developer',
  cooldown: 1,
  guide: ['<uid> [reason]', '(reply to a user)']
};

export async function onStart({ args, event, senderID, usersData, response, usage }) {
  let uid = args[0];
  let reasonStart = 1;

  if (event?.reply_to_message?.from?.id) {
    uid = String(event.reply_to_message.from.id);
    reasonStart = event?.reply_to_message?.from?.id && args[0] && !/^\d+$/.test(args[0]) ? 0 : (args[0] === uid ? 1 : 0);
  }

  if (!uid) return usage();
  if (!/^\d+$/.test(String(uid))) return response.reply('❌ Give a numeric Telegram user ID or reply to their message.');

  const reason = args.slice(reasonStart).join(' ') || 'Banned by admin';
  await usersData.ban(uid, reason, senderID);
  const user = await usersData.get(uid);

  return response.reply(
    `🚫 Banned **${user.name || uid}**\nID: \`${uid}\`\nReason: ${reason}`
  );
}
