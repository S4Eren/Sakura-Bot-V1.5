import axios from "axios";

const API_URL = "https://sakura-apis.onrender.com/api/anime-search";

export const eren = {
  name: "animesearch",
  aliases: ["anisar", "anisearch", "animeedit"],
  version: "1.0",
  author: "S4Eren",
  description: "Search anime edit videos.",
  category: "anime",
  type: "anyone",
  cooldown: 5,
  guide: ["<anime name>"]
};

export async function onStart({ args, response, event, bot }) {
  const query = args.join(" ").trim();
  const replyTo = event?.message_id;

  if (!query) {
    return response.reply(
      "🔍 | Please provide an anime name!\n\nExample:\n/animesearch sakura haruka"
    );
  }

  try {
    const loading = await response.reply(`🔎 Searching anime video for ${query}...`);

    const { data } = await axios.get(
      API_URL + `?query=${encodeURIComponent(query)}`,
      {
        timeout: 30000
      }
    );

    if (!data?.status || !data?.random?.noWatermark) {
      await response.delete(loading).catch(() => {});
      return response.reply(`❌ | No results found for "${query}"`);
    }

    const video = data.random;

    await response.delete(loading).catch(() => {});

    await bot.sendVideo(
      event.chat.id,
      video.noWatermark,
      {
        caption: `🎥 | Here's a random anime video for "${query}"`,
        reply_to_message_id: replyTo
      }
    );

  } catch (err) {
    console.error("[ANIMESEARCH ERROR]", err);
    return response.reply("⚠️ | Something went wrong, please try again later.");
  }
}
