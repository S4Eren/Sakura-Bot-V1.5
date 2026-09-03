export const eren = {
  name: 'unsend',
  version: '1.0.0',
  aliases: ['uns', 'del', 'delete'],
  description: 'Delete a bot message by replying to it. Also deletes your command.',
  author: 'S4Eren',
  category: 'utility',
  type: 'anyone',
  usePrefix: 'both',
  cooldown: 1,
  guide: ['(reply to a bot message)']
};

export async function onStart({ event, response, bot, chatId }) {
  const reply = event.reply_to_message;
  if (!reply) {
    return response.reply('Reply to a bot message to unsend it.');
  }

  let botId = null;
  try {
    const me = await bot.getMe();
    botId = me && me.id;
  } catch (e) {}

  const fromId = reply.from && reply.from.id;
  if (!botId || fromId !== botId) {
    return response.reply('You can only unsend the bot\'s messages.');
  }

  try {
    await bot.deleteMessage(chatId, reply.message_id);
  } catch (e) {
    return response.reply('Could not delete that message.');
  }

  try {
    await bot.deleteMessage(chatId, event.message_id);
  } catch (e) {}
}
