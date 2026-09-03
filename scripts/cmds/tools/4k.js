import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/upscale';

export const eren = {
  name: '4k',
  version: '1.0.0',
  aliases: ['upscale', 'enhance'],
  description: 'Upscale an image to 4K quality using AI.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'tools',
  type: 'anyone',
  balance: 500,
  cooldown: 10,
  guide: [
    '<reply to image> — upscale the replied image',
    '<send image with caption /4k> — upscale the sent image',
  ],
};

export async function onStart({ bot, event, response }) {
  const photo =
    event.photo?.length > 0
      ? event.photo
      : event.reply_to_message?.photo?.length > 0
        ? event.reply_to_message.photo
        : null;

  if (!photo) {
    return response.reply(
      '📷 Please send an image with the caption /4k, or reply to an image with /4k.'
    );
  }

  const fileId = photo[photo.length - 1].file_id;

  let loading;

  try {
    loading = await response.reply('🔍 Upscaling your image...');

    const fileUrl = await bot.getFileLink(fileId);

    const apiUrl = API_URL + '?url=' + encodeURIComponent(fileUrl);

    const { data } = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    await response.upload('photo', Buffer.from(data), {
      caption: "✨ Here's your 4K Upscaled Image",
    });

    if (loading) {
      await response.delete(loading).catch(() => {});
    }
  } catch (err) {
    console.error('[4K ERROR]', err);

    if (loading) {
      await response.delete(loading).catch(() => {});
    }

    return response.reply(
      `❌ Failed:\n${err?.message || 'Unknown error'}`
    );
  }
}
