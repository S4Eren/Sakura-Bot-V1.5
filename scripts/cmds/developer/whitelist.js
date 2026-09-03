import fs from 'fs-extra';
import path from 'path';

export const eren = {
  name: 'wl',
  version: '1.0.0',
  aliases: ['whitelist'],
  description: 'Toggle user/group whitelist and manage whitelist IDs.',
  author: 'S4Eren',
  prefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 3,
  guide: [
    'on | off',
    'add <uid>',
    'remove <uid>',
    'list',
    'thread on | off',
    'thread add',
    'thread remove',
    'thread list'
  ]
};

function configPath() {
  return path.resolve(process.cwd(), 'json/config.json');
}

async function saveConfig(config) {
  await fs.writeJson(configPath(), config, { spaces: 2 });
}

function ensure(config) {
  if (!config.whiteListMode) {
    config.whiteListMode = { enable: false, whiteListIds: [], ignoreCommand: ['help', 'uid', 'gid'] };
  }
  if (!Array.isArray(config.whiteListMode.whiteListIds)) config.whiteListMode.whiteListIds = [];
  if (!config.whiteListModeThread) {
    config.whiteListModeThread = { enable: false, whiteListThreadIds: [], ignoreCommand: ['help', 'uid', 'gid'] };
  }
  if (!Array.isArray(config.whiteListModeThread.whiteListThreadIds)) {
    config.whiteListModeThread.whiteListThreadIds = [];
  }
}

function pickUid(args, event, from) {
  if (event && event.reply_to_message && event.reply_to_message.from) {
    return String(event.reply_to_message.from.id);
  }
  const entity = Array.isArray(event && event.entities) ? event.entities.find(function (e) {
    return e.type === 'text_mention' && e.user && e.user.id;
  }) : null;
  if (entity) return String(entity.user.id);
  if (args[0] && /^\d+$/.test(String(args[0]))) return String(args[0]);
  return null;
}

export async function onStart({ args, response, config, chatId, isGroup, event, usage }) {
  ensure(config);
  const sub = String(args[0] || '').toLowerCase();

  if (!sub) return usage();

  if (sub === 'on' || sub === 'off') {
    config.whiteListMode.enable = sub === 'on';
    await saveConfig(config);
    return response.reply(
      sub === 'on'
        ? '✅ User whitelist is now ON.\n\n» Only IDs in whiteListIds can use the bot.'
        : '✅ User whitelist is now OFF.'
    );
  }

  if (sub === 'add') {
    const uid = pickUid(args.slice(1), event);
    if (!uid) return response.reply('❌ Give a numeric user ID, or reply to that user.');
    if (!config.whiteListMode.whiteListIds.map(String).includes(uid)) {
      config.whiteListMode.whiteListIds.push(uid);
      await saveConfig(config);
    }
    return response.reply('✅ Added to user whitelist:\n» `' + uid + '`');
  }

  if (sub === 'remove' || sub === 'rm') {
    const uid = pickUid(args.slice(1), event);
    if (!uid) return response.reply('❌ Give a numeric user ID, or reply to that user.');
    config.whiteListMode.whiteListIds = config.whiteListMode.whiteListIds.map(String).filter(function (id) {
      return id !== uid;
    });
    await saveConfig(config);
    return response.reply('✅ Removed from user whitelist:\n» `' + uid + '`');
  }

  if (sub === 'list') {
    const ids = config.whiteListMode.whiteListIds || [];
    if (!ids.length) return response.reply('📃 User whitelist is empty.\n\n» Mode: ' + (config.whiteListMode.enable ? 'ON' : 'OFF'));
    return response.reply(
      '📃 User whitelist (' + (config.whiteListMode.enable ? 'ON' : 'OFF') + ')\n\n» ' + ids.join('\n» ')
    );
  }

  if (sub === 'thread' || sub === 'group') {
    const action = String(args[1] || '').toLowerCase();
    if (action === 'on' || action === 'off') {
      config.whiteListModeThread.enable = action === 'on';
      await saveConfig(config);
      return response.reply(
        action === 'on'
          ? '✅ Group whitelist is now ON.\n\n» Only listed groups can use the bot.'
          : '✅ Group whitelist is now OFF.'
      );
    }
    if (action === 'add') {
      if (!isGroup) return response.reply('❌ Use this inside a group.');
      const id = String(chatId);
      if (!config.whiteListModeThread.whiteListThreadIds.map(String).includes(id)) {
        config.whiteListModeThread.whiteListThreadIds.push(id);
        await saveConfig(config);
      }
      return response.reply('✅ This group was added to the group whitelist.\n» `' + id + '`');
    }
    if (action === 'remove' || action === 'rm') {
      if (!isGroup) return response.reply('❌ Use this inside a group.');
      const id = String(chatId);
      config.whiteListModeThread.whiteListThreadIds = config.whiteListModeThread.whiteListThreadIds
        .map(String)
        .filter(function (x) { return x !== id; });
      await saveConfig(config);
      return response.reply('✅ This group was removed from the group whitelist.\n» `' + id + '`');
    }
    if (action === 'list') {
      const ids = config.whiteListModeThread.whiteListThreadIds || [];
      if (!ids.length) {
        return response.reply('📃 Group whitelist is empty.\n\n» Mode: ' + (config.whiteListModeThread.enable ? 'ON' : 'OFF'));
      }
      return response.reply(
        '📃 Group whitelist (' + (config.whiteListModeThread.enable ? 'ON' : 'OFF') + ')\n\n» ' + ids.join('\n» ')
      );
    }
    return usage();
  }

  return usage();
}
