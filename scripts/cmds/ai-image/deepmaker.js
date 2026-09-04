import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/deepmaker';

export const eren = {
  name: 'deepmaker',
  version: '1.0.0',
  aliases: ['dm', 'deep'],
  description: 'Generate or edit images using DeepMaker AI.',
  author: 'S4Eren',
  category: 'ai-image',
  type: 'premium',
  cooldown: 10,
  guide: [
    '<prompt> — generate an image',
    '<reply to image> <prompt> — edit an image',
  ],
};

const sessions = new Map();

const RATIOS = ['1:1', '16:9', '9:16', '3:4', '4:3'];

function aspectKeyboard() {
  const rows = [];

  for (let i = 0; i < RATIOS.length; i += 2) {
    const row = [];

    row.push({
      text: RATIOS[i],
      callback_data: JSON.stringify({
        command: 'deepmaker',
        args: ['ratio', RATIOS[i]],
      }),
    });

    if (RATIOS[i + 1]) {
      row.push({
        text: RATIOS[i + 1],
        callback_data: JSON.stringify({
          command: 'deepmaker',
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
        return json.message || json.error || json.detail || text;
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
    .replace(/^\/(?:deepmaker|dm|deep)(?:@\w+)?/i, '')
    .trim();

  if (!prompt) {
    return response.reply(
      '🎨 DeepMaker AI\n\n' +
      '📝 Please provide a prompt.\n\n' +
      'Generate:\n' +
      '/deepmaker A beautiful landscape\n\n' +
      'Image Edit:\n' +
      'Reply to an image with:\n' +
      '/deepmaker Make it anime style'
    );
  }

  const photo =
    event.photo?.length > 0
      ? event.photo
      : event.reply_to_message?.photo?.length > 0
        ? event.reply_to_message.photo
        : null;

  let telegramUrl = null;

  if (photo) {
    try {
      const fileId = photo[photo.length - 1].file_id;
      telegramUrl = await bot.getFileLink(fileId);
    } catch (error) {
      console.error('[DEEPMAKER FILE ERROR]', error);
      return response.reply(
        `❌ Failed to get image:\n${error?.message || 'Unknown error'}`
      );
    }
  }

  if (telegramUrl) {
    const processing = await response.reply(
      '🎨 DeepMaker AI\n\n' +
      '🖼️ Editing your image...\n\n' +
      '⏳ Please wait...'
    );

    try {
      const startTime = Date.now();

      const apiUrl = API_URL + '?' +
        'prompt=' + encodeURIComponent(prompt) +
        '&imageUrl=' + encodeURIComponent(telegramUrl) +
        '&aspect_ratio=1:1';

      console.log('[DEEPMAKER EDIT]', apiUrl);

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
            message = json.message || json.error || json.detail || text;
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
            `🎨 DeepMaker AI — Edit Complete\n\n` +
            `📝 Prompt:\n${prompt}\n\n` +
            `🎨 Mode: Image Edit\n` +
            `⏱️ Time: ${elapsed}s`,
          reply_to_message_id: event.message_id,
        }
      );

    } catch (error) {
      console.error('[DEEPMAKER EDIT ERROR]', error);

      await response.delete(processing).catch(() => {});

      return response.reply(
        `❌ Failed:\n${getApiError(error)}`
      );
    }

    return;
  }

  const sent = await response.reply(
    `🎨 DeepMaker AI — Image Generator\n\n` +
    `📝 Prompt:\n${prompt}\n\n` +
    `📐 Select Aspect Ratio:`,
    {
      reply_markup: aspectKeyboard(),
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

  const { prompt, chatId, messageId: originalMessageId } = session;

  await response.answerCallback(callbackQuery, {
    text: `Selected: ${aspectRatio}`,
  });

  await response.edit(
    'text',
    messageId,
    '🎨 DeepMaker AI\n\n' +
    '⏳ Generating your image...\n\n' +
    'Please wait.'
  );

  try {
    const startTime = Date.now();

    const apiUrl = API_URL + '?' +
      'prompt=' + encodeURIComponent(prompt) +
      '&aspect_ratio=' + encodeURIComponent(aspectRatio);

    console.log('[DEEPMAKER GENERATE]', apiUrl);

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
          message = json.message || json.error || json.detail || text;
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
          `🎨 DeepMaker AI — Generation Complete\n\n` +
          `📝 Prompt:\n${prompt}\n\n` +
          `📐 Aspect Ratio: ${aspectRatio}\n` +
          `🎨 Mode: Image Generation\n` +
          `⏱️ Time: ${elapsed}s`,
        reply_to_message_id: originalMessageId || event.message_id,
      }
    );

    sessions.delete(messageId);

  } catch (error) {
    console.error('[DEEPMAKER GENERATE ERROR]', error);

    await response.edit(
      'text',
      messageId,
      `❌ Failed:\n${getApiError(error)}`
    ).catch(() => {});

    sessions.delete(messageId);
  }
        }
