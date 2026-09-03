export const eren = {
  name: 'goodbye',
  version: '1.0.0',
  description: 'Says goodbye when a member leaves a group',
  author: 'S4Eren',
  category: 'events'
};

export async function onEvent({ event, response, isGroup, threadData, bot }) {
  if (!isGroup || !event.left_chat_member) return;

  const user = event.left_chat_member;
  let botId = null;
  try {
    const me = await bot.getMe();
    botId = me && me.id;
  } catch (e) {}

  if (botId && user.id === botId) return;

  const title = (event.chat && event.chat.title) || (threadData && threadData.title) || 'the group';
  const name = user.first_name || user.username || 'Someone';
  const custom = threadData && threadData.settings && threadData.settings.goodbye;
  const text = custom
    ? String(custom).replace(/\{name\}/g, name).replace(/\{group\}/g, title)
    : `${name} left ${title}.`;

  await response.reply(text);
}
