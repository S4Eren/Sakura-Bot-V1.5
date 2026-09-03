import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/sana';

export const eren = {
  name: 'sana',
  version: '1.0.0',
  aliases: [],
  description: 'Generate images using Sana AI.',
  author: 'S4Eren',
  usePrefix: true,
  category: 'ai-image',
  type: 'anyone',
  balance: 2500,
  cooldown: 10,
  guide: [
    '<prompt> — generate an image',
    '<prompt> — generate with style',
  ],
};

const sessions = new Map();

const STYLES = [
  '(No style)',
  'Cinematic',
  'Photographic',
  'Anime',
  'Manga',
  'Digital Art',
  'Pixel art',
  'Fantasy art',
  'Neonpunk',
  '3D Model',
];

const RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
];

function styleKeyboard() {
  const rows = [];

  for (let i = 0; i < STYLES.length; i += 2) {
    const row = [];

    row.push({
      text: STYLES[i],
      callback_data: JSON.stringify({
        command: 'sana',
        args: ['style', STYLES[i]],
      }),
    });

    if (STYLES[i + 1]) {
      row.push({
        text: STYLES[i + 1],
        callback_data: JSON.stringify({
          command: 'sana',
          args: ['style', STYLES[i + 1]],
        }),
      });
    }

    rows.push(row);
  }

  return {
    inline_keyboard: rows,
  };
}

function ratioKeyboard() {
  const rows = [];

  for (let i = 0; i < RATIOS.length; i += 2) {
    const row = [];

    row.push({
      text: RATIOS[i],
      callback_data: JSON.stringify({
        command: 'sana',
        args: ['ratio', RATIOS[i]],
      }),
    });

    if (RATIOS[i + 1]) {
      row.push({
        text: RATIOS[i + 1],
        callback_data: JSON.stringify({
          command: 'sana',
          args: ['ratio', RATIOS[i + 1]],
        }),
      });
    }

    rows.push(row);
  }

  return {
    inline_keyboard: rows,
  };
}

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
  const text = event.caption || event.text || '';

  const prompt = text
    .replace(/^\/(?:sana)(?:@\w+)?/i, '')
    .trim();

  if (!prompt) {
    return response.reply(
      '🎨 Sana AI Image Generator\n\n' +
      '📝 Please provide a prompt.\n\n' +
      'Example:\n' +
      '/sana Sakura\n\n' +
      'Then select Style & Aspect Ratio.'
    );
  }

  const sent = await response.reply(
    `🎨 Sana AI Image Generator\n\n` +
    `📝 Prompt:\n${prompt}\n\n` +
    `🎨 Select Artistic Style:`,
    {
      reply_markup: styleKeyboard(),
    }
  );

  sessions.set(sent.message_id, {
    prompt,
    style: '(No style)',
    ratio: '1:1',
    step: 'style',
    chatId: event.chat.id,
    messageId: event.message_id,
  });
}

export async function onCallback({
  callbackQuery,
  response,
  messageId,
  args,
  event,
  bot,
}) {
  const action = args?.[0];

  const session = sessions.get(messageId);

  if (!session) {
    return response.answerCallback(callbackQuery, {
      text: '⚠️ Session expired.',
      show_alert: true,
    });
  }

  const { prompt } = session;

  if (action === 'style') {
    const style = args?.[1] || '(No style)';

    session.style = style;
    session.step = 'ratio';

    await response.answerCallback(callbackQuery, {
      text: `✅ Style selected: ${style}`,
    });

    await response.edit(
      'text',
      messageId,
      `🎨 Sana AI Image Generator\n\n` +
      `📝 Prompt:\n${prompt}\n\n` +
      `🎨 Style: ${style}\n\n` +
      `📐 Select Aspect Ratio:`,
      {
        reply_markup: ratioKeyboard(),
      }
    );

    return;
  }

  if (action === 'ratio') {
    const ratio = args?.[1] || '1:1';

    session.ratio = ratio;

    await response.answerCallback(callbackQuery, {
      text: `✅ Ratio selected: ${ratio}`,
    });

    await response.edit(
      'text',
      messageId,
      '🎨 Sana AI\n\n' +
      '⏳ Generating your image...\n\n' +
      'Please wait.'
    );

    try {
      const startTime = Date.now();

      const apiUrl = API_URL + '?' +
        'prompt=' + encodeURIComponent(prompt) +
        '&style=' + encodeURIComponent(session.style) +
        '&size=' + encodeURIComponent(ratio);

      console.log('[SANA GENERATE]', apiUrl);

      const result = await axios.get(apiUrl, {
        responseType: 'arraybuffer',
        timeout: 180000,
        headers: {
          Accept: 'application/json',
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

      const elapsed = (
        (Date.now() - startTime) /
        1000
      ).toFixed(2);

      await response.delete(messageId).catch(() => {});

      await bot.sendPhoto(
        session.chatId || event.chat.id,
        Buffer.from(result.data),
        {
          caption:
            `🌸 Sana AI Generated Image\n\n` +
            `📝 Prompt:\n${prompt}\n\n` +
            `🎨 Style: ${session.style}\n` +
            `📐 Aspect Ratio: ${ratio}\n` +
            `⏱️ Time: ${elapsed}s`,
          reply_to_message_id: session.messageId || event.message_id,
        }
      );

      sessions.delete(messageId);

    } catch (error) {
      console.error('[SANA GENERATE ERROR]', error);

      await response.edit(
        'text',
        messageId,
        `❌ Failed:\n${getApiError(error)}`
      ).catch(() => {});

      sessions.delete(messageId);
    }

    return;
  }

  return response.answerCallback(callbackQuery);
}
