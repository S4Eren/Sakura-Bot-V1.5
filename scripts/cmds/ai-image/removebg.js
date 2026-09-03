import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/bgremover';

export const eren = {
  name: 'removebg',
  version: '1.0.0',
  aliases: ['rbg', 'bgremove', 'bgremover'],
  description: 'Remove background from images.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'ai-image',
  type: 'anyone',
  cooldown: 10,
  balance: 500,
  guide: [
    '<reply to image> — remove image background',
  ],
};

function getApiError(error) {
  if (error?.response?.data) {
    const body = error.response.data;

    if (Buffer.isBuffer(body)) {
      const text = body.toString('utf8');

      try {
        const json = JSON.parse(text);

        return (
          json.message ||
          json.error ||
          json.detail ||
          text
        );
      } catch {
        return text.slice(0, 1000);
      }
    }

    if (typeof body === 'string') {
      return body.slice(0, 1000);
    }

    return (
      body.message ||
      body.error ||
      body.detail ||
      JSON.stringify(body).slice(0, 1000)
    );
  }

  return error?.message || 'Unknown error';
}

export async function onStart({ event, response, bot }) {
  const photo =
    event.photo?.length > 0
      ? event.photo
      : event.reply_to_message?.photo?.length > 0
        ? event.reply_to_message.photo
        : null;

  if (!photo) {
    return response.reply(
      '🖼️ Remove Background\n\n' +
      'Please reply to an image with:\n' +
      '/removebg'
    );
  }

  const processing = await response.reply(
    '🖼️ Remove Background\n\n' +
    '⏳ Removing image background...\n\n' +
    'Please wait.'
  );

  try {
    const startTime = Date.now();

    const fileId = photo[photo.length - 1].file_id;

    const telegramUrl = await bot.getFileLink(fileId);

    console.log('[REMOVEBG] Telegram:', telegramUrl);

    const apiUrl = API_URL + '?' +
      'image=' + encodeURIComponent(telegramUrl);

    console.log('[REMOVEBG] API:', apiUrl);

    const result = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 180000,
      headers: {
        Accept: '*/*',
      },
      validateStatus: () => true,
    });

    if (result.status < 200 || result.status >= 300) {
      let message = `HTTP ${result.status}`;

      if (Buffer.isBuffer(result.data)) {
        const text = result.data.toString('utf8');

        try {
          const json = JSON.parse(text);

          message =
            json.message ||
            json.error ||
            json.detail ||
            text;
        } catch {
          message = text;
        }
      }

      throw new Error(message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    await response.delete(processing).catch(() => {});

    await bot.sendPhoto(
      event.chat.id,
      Buffer.from(result.data),
      {
        caption:
          `🖼️ Background Removed\n\n` +
          `✨ Background removed successfully.\n` +
          `⏱️ Time: ${elapsed}s`,
        reply_to_message_id: event.message_id,
      }
    );

  } catch (error) {
    console.error('[REMOVEBG ERROR]', error);

    await response.delete(processing).catch(() => {});

    return response.reply(
      `❌ Failed:\n${getApiError(error)}`
    );
  }
}
