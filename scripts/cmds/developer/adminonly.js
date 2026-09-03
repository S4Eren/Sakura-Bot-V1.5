import fs from 'fs-extra';
import path from 'path';

export const eren = {
  name: 'adminonly',
  version: '1.0.0',
  aliases: ['onlyadmin', 'adonly'],
  description: 'Lock the whole bot so only developers can use it.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 3,
  guide: ['on | off']
};

function configPath() {
  return path.resolve(process.cwd(), 'json/config.json');
}

async function saveConfig(config) {
  await fs.writeJson(configPath(), config, { spaces: 2 });
}

export async function onStart({ args, response, config, usage }) {
  const mode = String(args[0] || '').toLowerCase();
  if (!config.adminOnly) config.adminOnly = { enable: false, ignoreCommand: ['help', 'uid', 'gid'] };

  if (mode !== 'on' && mode !== 'off') return usage();

  config.adminOnly.enable = mode === 'on';
  await saveConfig(config);

  if (mode === 'on') {
    return response.reply('🔒 Admin-only mode is now ON.\n\n» Only bot developers can use the bot.');
  }
  return response.reply('🔓 Admin-only mode is now OFF.\n\n» Everyone allowed by other gates can use the bot.');
}
