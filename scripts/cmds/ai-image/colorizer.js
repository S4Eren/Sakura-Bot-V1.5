import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/colorizer';

export const eren = {
  name: 'colorizer',
  version: '1.0.0',
  aliases: ['colorize'],
  description: 'Colorize black and white images using AI.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'ai-image',
  type: 'anyone',
  cooldown: 10,
  balance: 2500,
  guide: [
    '<reply to image> — colorize the image',
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
      '🎨 AI Colorizer\n\n' +
      'Please reply to an image with:\n' +
      '/colorizer'
    );
  }

  const processing = await response.reply(
    '🎨 AI Colorizer\n\n' +
    '⏳ Colorizing your image...\n\n' +
    'Please wait.'
  );

  try {
    const startTime = Date.now();

    const fileId = photo[photo.length - 1].file_id;

    const telegramUrl = await bot.getFileLink(fileId);

    console.log('[COLORIZER] Telegram:', telegramUrl);

    const apiUrl = API_URL + '?' +
      'url=' + encodeURIComponent(telegramUrl);

    console.log('[COLORIZER] API:', apiUrl);

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
          `🎨 AI Colorizer\n\n` +
          `✨ Image colorized successfully.\n` +
          `⏱️ Time: ${elapsed}s`,
        reply_to_message_id: event.message_id,
      }
    );

  } catch (error) {
    console.error('[COLORIZER ERROR]', error);

    await response.delete(processing).catch(() => {});

    return response.reply(
      `❌ Failed:\n${getApiError(error)}`
    );
  }
}
