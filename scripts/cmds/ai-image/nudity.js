import axios from 'axios';

const ANIME_API_URL = 'https://sakura-apis.onrender.com/api/anime-nudity';
const NORMAL_API_URL = 'https://sakura-apis.onrender.com/api/nudity';

export const eren = {
  name: 'nudity',
  version: '1.0.0',
  aliases: ['nsfwgen', 'nudegen', 'nuditygen'],
  description: 'Generate NSFW/AI nudity images with prompt.',
  author: 'S4Eren',
  category: 'ai-imqge',
  type: 'anyone',
  balance: 2500,
  cooldown: 15,
  guide: [
    '/nudity <prompt> — generate normal nudity',
    '/nudity <prompt> --anime — generate anime nudity',
  ],
};

export async function onStart({ bot, event, response }) {
  const text = event.text || event.caption || '';
  
  let prompt = text
    .replace(/^\/nudity(?:@\w+)?/i, '')
    .trim();

  if (!prompt) {
    return response.reply(
      '🔥 Please provide a prompt.\n\n' +
      'Examples:\n' +
      '/nudity a cute girl\n' +
      '/nudity a cute girl --anime'
    );
  }

  let isAnime = false;
  if (prompt.includes('--anime')) {
    isAnime = true;
    prompt = prompt.replace('--anime', '').trim();
  }

  const processing = await response.reply(
    `🔞 Generating ${isAnime ? 'anime ' : ''}NSFW image...\n\n` +
    '⏳ Please wait...'
  );

  try {
    const startTime = Date.now();

    const baseUrl = isAnime ? ANIME_API_URL : NORMAL_API_URL;
    const apiUrl = `${baseUrl}?prompt=${encodeURIComponent(prompt)}`;

    const { data } = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const caption =
      `🔞 Here's your generated image.\n\n` +
      `📝 Prompt: ${prompt}\n` +
      `🎨 Type: ${isAnime ? 'Anime' : 'Normal'}\n` +
      `⏱️ Time: ${elapsed}s`;

    await response.delete(processing).catch(() => {});

    await response.upload('photo', Buffer.from(data), {
      caption,
    });
  } catch (err) {
    console.error('[NUDITY ERROR]', err);
    await response.delete(processing).catch(() => {});
    return response.reply(
      `❌ Failed:\n${err?.message || 'Unknown error'}`
    );
  }
}
