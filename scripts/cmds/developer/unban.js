export const eren = {
  name: 'unban',
  version: '1.0.0',
  aliases: [],
  description: 'Unban a user.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 1,
  guide: ['<uid>', '(reply to a user)']
};

export async function onStart({ args, event, usersData, response, usage }) {
  let uid = args[0];

  if (event?.reply_to_message?.from?.id) {
    uid = String(event.reply_to_message.from.id);
  }

  if (!uid) return usage();
  if (!/^\d+$/.test(String(uid))) return response.reply('❌ Give a numeric Telegram user ID or reply to their message.');

  await usersData.unban(uid);
  return response.reply(`✅ Unbanned \`${uid}\`.`);
}
