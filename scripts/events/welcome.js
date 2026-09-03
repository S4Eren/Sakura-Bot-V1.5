export const eren = {
  name: 'welcome',
  version: '1.0.0',
  description: 'Greets new members when they join a group',
  author: 'S4Eren',
  category: 'events'
};

export async function onEvent({ event, response, isGroup, threadData, bot }) {
  if (!isGroup || !event.new_chat_members || !event.new_chat_members.length) return;

  let botId = null;
  try {
    const me = await bot.getMe();
    botId = me && me.id;
  } catch (e) {}

  const title = (event.chat && event.chat.title) || (threadData && threadData.title) || 'the group';
  const custom = threadData && threadData.settings && threadData.settings.welcome;

  for (const user of event.new_chat_members) {
    if (botId && user.id === botId) continue;
    const name = user.first_name || user.username || 'there';
    const text = custom
      ? String(custom).replace(/\{name\}/g, name).replace(/\{group\}/g, title)
      : `Welcome ${name} to ${title}.`;
    await response.reply(text);
  }
}
