import axios from "axios";

const API_URL = "https://sakura-apis.onrender.com/api/tiktok-search";

const sessions = new Map();

export const eren = {
  name: "tiktok",
  version: "1.0.0",
  aliases: ["tt"],
  description: "TikTok search with thumbnail preview and download.",
  author: "S4Eren",
  category: "media",
  type: "anyone",
  cooldown: 5,
};

function getButtons(shortId, page, total) {
  return {
    inline_keyboard: [
      [
        {
          text: "⬅️ Prev",
          callback_data: JSON.stringify({
            command: "tiktok",
            a: "prev",
            i: shortId
          })
        },
        {
          text: "➡️ Next",
          callback_data: JSON.stringify({
            command: "tiktok",
            a: "next",
            i: shortId
          })
        }
      ],
      [
        {
          text: "⬇️ Download Video",
          callback_data: JSON.stringify({
            command: "tiktok",
            a: "download",
            index: page - 1,
            i: shortId
          })
        }
      ]
    ]
  };
}

async function sendThumb(
  response,
  bot,
  chatId,
  video,
  query,
  page,
  total,
  shortId,
  replyTo,
  messageId = null
) {
  const caption = `
🎵 TikTok Search

🔎 Query: ${query}
📄 Result: ${page}/${total}

🎬 ${video.title?.slice(0,80) || "No Title"}

❤️ ${video.likes || 0}
👁️ ${video.views || 0}

👇 Click Download to get video
`;

  const thumb = video.cover || "";

  if (messageId) {
    return response.edit(
      "media",
      messageId,
      {
        type: "photo",
        media: thumb,
        caption,
        parse_mode: "Markdown"
      },
      {
        reply_markup: getButtons(shortId, page, total)
      }
    );
  }

  return bot.sendPhoto(
    chatId,
    thumb,
    {
      caption,
      parse_mode: "Markdown",
      reply_markup: getButtons(shortId, page, total),
      reply_to_message_id: replyTo
    }
  );
}

export async function onStart({
  args,
  response,
  bot,
  chatId,
  event
}) {
  const query = args.join(" ").trim();
  const replyTo = event?.message_id;

  if (!query) {
    return response.reply(
      "❌ Please provide keyword\n\nExample:\n/tiktok anime edit"
    );
  }

  try {
    const loading = await bot.sendMessage(
      chatId,
      "🔎 Searching TikTok..."
    );

    const { data } = await axios.get(
      API_URL + `?query=${encodeURIComponent(query)}&count=30`,
      {
        timeout: 20000
      }
    );

    const results = data?.results || [];

    if (!results.length) {
      return response.reply(
        "❌ No videos found!"
      );
    }

    const shortId = Math.random().toString(36).substring(2, 8);

    sessions.set(shortId, {
      query,
      results,
      page: 1
    });

    setTimeout(() => sessions.delete(shortId), 10 * 60 * 1000);

    await bot.deleteMessage(chatId, loading.message_id);

    return sendThumb(
      response,
      bot,
      chatId,
      results[0],
      query,
      1,
      results.length,
      shortId,
      replyTo
    );

  } catch (err) {
    console.log(err.message);
    return response.reply(
      "❌ Failed to fetch TikTok data"
    );
  }
}

export async function onCallback({
  bot,
  callbackQuery,
  payload,
  response,
  chatId,
  messageId
}) {
  if (!messageId && callbackQuery.message) {
    messageId = callbackQuery.message.message_id;
  }

  let pl = payload;

  if (!pl && callbackQuery.data) {
    try {
      pl = JSON.parse(callbackQuery.data);
    } catch {
      return;
    }
  }

  if (!pl || pl.command !== "tiktok" || !pl.i) return;

  const session = sessions.get(pl.i);

  if (!session) {
    return response.answerCallback(
      callbackQuery,
      {
        text: "⏰ Session expired.",
        show_alert: true
      }
    );
  }

  const total = session.results.length;

  if (pl.a === "next") {
    if (session.page < total) {
      session.page++;
    }
  }

  if (pl.a === "prev") {
    if (session.page > 1) {
      session.page--;
    }
  }

  if (pl.a === "download") {
    const video = session.results[pl.index];

    if (!video) {
      return response.answerCallback(
        callbackQuery,
        {
          text: "❌ Video not found",
          show_alert: true
        }
      );
    }

    await response.answerCallback(
      callbackQuery,
      {
        text: "⬇️ Sending video..."
      }
    );

    return bot.sendVideo(
      chatId,
      video.noWatermark || video.play,
      {
        caption: `🎬 ${video.title?.slice(0,80) || "TikTok Video"}`,
        reply_to_message_id: callbackQuery.message?.reply_to_message?.message_id
      }
    );
  }

  await response.answerCallback(callbackQuery);

  const video = session.results[session.page - 1];

  return sendThumb(
    response,
    bot,
    chatId,
    video,
    session.query,
    session.page,
    total,
    pl.i,
    callbackQuery.message?.reply_to_message?.message_id,
    messageId
  );
}
