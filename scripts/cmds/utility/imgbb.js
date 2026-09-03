import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/imgbb';

export const eren = {
  name: 'imgbb',
  version: '1.0.0',
  aliases: ['ibb'],
  description: 'Upload an image to ImgBB.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'utility',
  type: 'anyone',
  balance: 0,
  cooldown: 10,
  guide: [
    '<reply to image> — upload the replied image',
    '<send image with caption /imgbb> — upload the sent image',
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
      '📷 Please send an image with the caption /imgbb, or reply to an image with /imgbb.'
    );
  }

  const fileId = photo[photo.length - 1].file_id;

  try {
    const fileUrl = await bot.getFileLink(fileId);

    const apiUrl = API_URL + '?url=' + encodeURIComponent(fileUrl);

    const { data } = await axios.get(apiUrl, {
      timeout: 60000,
    });

    if (!data?.status || !data?.image?.display_url) {
      throw new Error(data?.message || 'Image upload failed.');
    }

    return response.reply(data.image.display_url);
  } catch (err) {
    console.error('[IMGBB ERROR]', err);

    return response.reply(
      `❌ Failed:\n${err?.message || 'Unknown error'}`
    );
  }
}
