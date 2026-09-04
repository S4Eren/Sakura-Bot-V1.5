import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/imagetopdf';

export const eren = {
  name: 'imagetopdf',
  version: '1.0.0',
  aliases: ['img2pdf', 'topdf'],
  description: 'Convert an image to PDF.',
  author: 'S4Eren',
  usePrefix: true,
  category: 'utility',
  type: 'anyone',
  cooldown: 10,
  guide: [
    '<reply to image> — convert the replied image to PDF',
    '<send image with caption /imagetopdf> — convert the sent image to PDF',
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
      '📷 Please send an image with the caption /imagetopdf, or reply to an image with /imagetopdf.'
    );
  }

  const fileId = photo[photo.length - 1].file_id;

  let loading;

  try {
    loading = await response.reply('📄 Converting your image to PDF...');

    const fileUrl = await bot.getFileLink(fileId);

    const apiUrl =
      API_URL + '?url=' + encodeURIComponent(fileUrl);

    const { data } = await axios.get(apiUrl, {
      timeout: 120000,
    });

    if (!data?.status || !data?.result?.pdf_url) {
      throw new Error(
        data?.message || 'PDF URL was not returned by the API.'
      );
    }

    await response.upload(
      'document',
      data.result.pdf_url,
      {
        caption: `📄 Here's your PDF\n\n📁 ${data.result.file_name || 'converted.pdf'}`,
      }
    );

    if (loading) {
      await response.delete(loading).catch(() => {});
    }

  } catch (err) {
    console.error('[IMAGE TO PDF ERROR]', err);

    if (loading) {
      await response.delete(loading).catch(() => {});
    }

    return response.reply(
      `❌ Failed:\n${err?.message || 'Unknown error'}`
    );
  }
}
