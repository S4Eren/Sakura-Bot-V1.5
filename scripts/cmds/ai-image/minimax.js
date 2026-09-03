import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/minimax';

export const eren = {
  name: 'minimax',
  version: '1.0.0',
  aliases: ['mmx', 'minimaxai'],
  description: 'Generate high-quality AI images using MiniMax.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'ai-image',
  type: 'anyone',
  cooldown: 10,
  balance: 25000,
  guide: [
    '<prompt> — generate an image',
  ],
};

const sessions = new Map();

const RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '3:4',
  '4:3',
];

function ratioKeyboard() {
  const rows = [];

  for (let i = 0; i < RATIOS.length; i += 2) {
    const row = [];

    row.push({
      text: RATIOS[i],
      callback_data: JSON.stringify({
        command: 'minimax',
        args: ['ratio', RATIOS[i]],
      }),
    });

    if (RATIOS[i + 1]) {
      row.push({
        text: RATIOS[i + 1],
        callback_data: JSON.stringify({
          command: 'minimax',
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

export async function onStart({ event, response }) {
  const text = event.caption || event.text || '';

  const prompt = text
    .replace(/^\/(?:minimax|mmx|minimaxai)(?:@\w+)?/i, '')
    .trim();

  if (!prompt) {
    return response.reply(
      '🎨 MiniMax AI Image Generator\n\n' +
      '📝 Please provide a prompt.\n\n' +
      'Example:\n' +
      '/minimax Naruto Uzumaki\n\n' +
      'Then select an Aspect Ratio.'
    );
  }

  const sent = await response.reply(
    `🎨 MiniMax AI Image Generator\n\n` +
    `📝 Prompt:\n${prompt}\n\n` +
    `📐 Select Aspect Ratio:`,
    {
      reply_markup: ratioKeyboard(),
    }
  );

  sessions.set(sent.message_id, {
    prompt,
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

  if (action !== 'ratio') {
    return response.answerCallback(callbackQuery);
  }

  const aspectRatio = args?.[1];

  const session = sessions.get(messageId);

  if (!session) {
    return response.answerCallback(callbackQuery, {
      text: '⚠️ Session expired.',
      show_alert: true,
    });
  }

  const {
    prompt,
    chatId,
    messageId: originalMessageId,
  } = session;

  await response.answerCallback(callbackQuery, {
    text: `Selected: ${aspectRatio}`,
  });

  await response.edit(
    'text',
    messageId,
    '🎨 MiniMax AI\n\n' +
    '⏳ Generating your image...\n\n' +
    'Please wait.'
  );

  try {
    const startTime = Date.now();

    const apiUrl = API_URL + '?' +
      'prompt=' + encodeURIComponent(prompt) +
      '&aspect_ratio=' + encodeURIComponent(aspectRatio);

    console.log('[MINIMAX GENERATE]', apiUrl);

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

    await response.delete(messageId).catch(() => {});

    await bot.sendPhoto(
      chatId || event.chat.id,
      Buffer.from(result.data),
      {
        caption:
          `🎨 MiniMax AI Generated Image\n\n` +
          `📝 Prompt:\n${prompt}\n\n` +
          `📐 Aspect Ratio: ${aspectRatio}\n` +
          `⏱️ Time: ${elapsed}s`,
        reply_to_message_id: originalMessageId || event.message_id,
      }
    );

    sessions.delete(messageId);

  } catch (error) {
    console.error('[MINIMAX GENERATE ERROR]', error);

    await response.edit(
      'text',
      messageId,
      `❌ Failed:\n${getApiError(error)}`
    ).catch(() => {});

    sessions.delete(messageId);
  }
}
