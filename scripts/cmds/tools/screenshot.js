import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/screenshot';

export const eren = {
  name: 'screenshot',
  version: '1.0.0',
  aliases: ['ss', 'webshot'],
  description: 'Take a screenshot of any website.',
  author: 'S4Eren',
  usePrefix: true,
  category: 'tools',
  type: 'anyone',
  cooldown: 10,
  guide: [
    '<url> — take a screenshot of a website',
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
  const text = event.text || event.caption || '';

  const url = text
    .replace(/^\/(?:screenshot|ss|webshot)(?:@\w+)?/i, '')
    .trim();

  if (!url) {
    return response.reply(
      '📸 Website Screenshot\n\n' +
      '📝 Please provide a website URL.\n\n' +
      'Example:\n' +
      '/screenshot https://facebook.com'
    );
  }

  let targetUrl = url;

  // Add https:// if the user only provides a domain
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    new URL(targetUrl);
  } catch {
    return response.reply(
      '❌ Invalid URL.\n\n' +
      'Please provide a valid website URL.\n\n' +
      'Example:\n' +
      '/screenshot https://example.com'
    );
  }

  const processing = await response.reply(
    '📸 Website Screenshot\n\n' +
    `🌐 URL: ${targetUrl}\n\n` +
    '⏳ Taking screenshot...\n' +
    'Please wait.'
  );

  try {
    const startTime = Date.now();

    const apiUrl =
      API_URL +
      '?url=' +
      encodeURIComponent(targetUrl);

    console.log('[SCREENSHOT]', apiUrl);

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

    const elapsed =
      ((Date.now() - startTime) / 1000).toFixed(2);

    await response.delete(processing.message_id).catch(() => {});

    await bot.sendPhoto(
      event.chat.id,
      Buffer.from(result.data),
      {
        caption:
          `📸 Website Screenshot\n\n` +
          `🌐 URL: ${targetUrl}\n` +
          `⏱️ Time: ${elapsed}s`,
        reply_to_message_id: event.message_id,
      }
    );

  } catch (error) {
    console.error('[SCREENSHOT ERROR]', error);

    await response.edit(
      'text',
      processing.message_id,
      `❌ Screenshot Failed\n\n${getApiError(error)}`
    ).catch(() => {});
  }
}
