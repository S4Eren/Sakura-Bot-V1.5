export const eren = {
  name: 'adboxonly',
  version: '1.0.0',
  aliases: ['onlyadminbox', 'onlyadbox', 'admingrouponly', 'adminboxonly'],
  description: 'Lock this group so only group admins can use the bot.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'administrator',
  type: 'administrator',
  cooldown: 3,
  guide: ['on | off', 'noti on | off']
};

export async function onStart({ args, response, isGroup, chatId, threadsData, threadData, usage }) {
  if (!isGroup) return response.reply('❌ This command only works in groups.');
  if (!threadsData) return response.reply('❌ Thread database is not ready.');

  const settings = (threadData && threadData.settings) || {};
  const sub = String(args[0] || '').toLowerCase();

  if (sub === 'noti') {
    const mode = String(args[1] || '').toLowerCase();
    if (mode !== 'on' && mode !== 'off') return usage();
    settings.hideNotiOnlyAdminBox = mode === 'off';
    await threadsData.set(chatId, { settings: settings });
    return response.reply(
      mode === 'on'
        ? '🔔 Notice is ON.\n\n» Non-admins will get a message when they try to use the bot.'
        : '🔕 Notice is OFF.\n\n» Non-admins will be blocked silently.'
    );
  }

  if (sub !== 'on' && sub !== 'off') return usage();

  settings.onlyAdminBox = sub === 'on';
  await threadsData.set(chatId, { settings: settings });

  if (sub === 'on') {
    return response.reply('🛡️ Admin-group-only is now ON.\n\n» Only group admins can use the bot here.');
  }
  return response.reply('🔓 Admin-group-only is now OFF.\n\n» Members can use the bot in this group.');
}
