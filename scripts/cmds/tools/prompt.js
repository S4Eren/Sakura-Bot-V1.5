import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/prompt';

export const eren = {
  name: 'prompt',
  version: '1.0.0',
  aliases: ['imgprompt', 'describe'],
  description: 'Generate a detailed AI prompt from an image.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'tools',
  type: 'anyone',
  balance: 100,
  cooldown: 10,
  guide: [
    '<reply to image> — generate a prompt from the replied image',
    '<send image with caption /prompt> — generate a prompt from the sent image',
  ],
};

export async function onStart({ bot, event, response }) {
  const photo =
    (event.photo && event.photo.length > 0 ? event.photo : null) ||
    (event.reply_to_message?.photo?.length > 0
      ? event.reply_to_message.photo
      : null);

  if (!photo) {
    return response.reply(
      '📷 Please send an image with the caption `/prompt`, or reply to an image with `/prompt`.'
    );
  }

  const fileId = photo[photo.length - 1].file_id;

  const loading = await response.reply(
    '🔍 **Analyzing your image...**\n\n✨ Generating a detailed prompt...'
  );

  try {
    const fileUrl = await bot.getFileLink(fileId);

    const apiUrl = API_URL + '?imgUrl=' + encodeURIComponent(fileUrl);

    const { data } = await axios.get(apiUrl, {
      timeout: 120000,
    });

    if (!data?.status || !data?.data?.prompt) {
      throw new Error(
        data?.message || 'Prompt generation failed.'
      );
    }

    const prompt = String(data.data.prompt).trim();

    if (!prompt) {
      throw new Error('API returned an empty prompt.');
    }

    await response.edit(
      'text',
      loading,
      prompt
    );

  } catch (err) {
    console.error('Prompt Error:', err);

    await response.edit(
      'text',
      loading,
      `⚠️ Failed to generate prompt:\n\n${String(
        err.message || 'Unknown error'
      )}`
    );
  }
}
