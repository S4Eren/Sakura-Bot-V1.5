import axios from 'axios';

const API_URL = 'https://sakura-apis.onrender.com/api/font2';

const fontSessions = new Map();

const FONT_PREVIEWS = {
  "1": "𝖠𝖡𝖢𝖺𝖻𝖼123", "2": "𝗔𝗕𝗖防𝗯𝗰𝟭𝟮𝟯", "3": "𝘈𝘉𝘊𝘢𝘣𝘤𝟭𝟮𝟯", "4": "𝘼𝘽𝘾𝙖𝙗𝙘𝟭𝟮𝟯",
  "5": "𝔄𝔅ℭ𝔞𝔟𝔠123", "6": "𝕬𝕭𝕮𝖆𝖇𝖈123", "7": "𝐴𝐵𝐶𝑎𝑏𝑐123", "8": "𝑨boldsymbol𝑪𝒂𝒃𝒄123",
  "9": "𝒜𝒲𝒞𝒶𝒷𝒸123", "10": "𝓐𝓑𝓒𝓪𝓫𝓬123", "11": "ⒶⒷⒸⓐⓑⓒ①②③", "12": "🅐🅑🅒🅐🅑🅒➊➋➌",
  "13": "🄰🄱🄲🄰🄱🄲①②③", "14": "🅰🅱🅲🅰🅱🅲➊➋➌", "15": "𝙰𝙱𝙲𝚊𝚋𝚌𝟷𝟸𝟹", "16": "𝐀𝐁𝐂𝐚𝐛𝐜𝟏𝟐𝟑",
  "17": "ᴀʙᴄΑʙᴄ¹²³", "18": "𝔸𝔹ℂ𝕒𝕓𝕔𝟙𝟚𝟛", "19": "ᏗᏰፈᏗᏰፈ123", "20": "ΑΒϾαв¢123",
  "21": "ᗩᗷᑕᗩᗷᑕ123", "22": "A̸B̸C̸a̸b̸c̸1̸2̸3̸", "23": "ꋫꃲꉓꋫꃲꉓ123", "24": "Ă̈B̆̈C̆̈ă̈b̆̈c̆̈1̆̈2̆̈3̆̈",
  "25": "𐌀𐌁𐌂𐌀𐌁𐌂123", "26": "ΛВϾΛВϾ123", "27": "ǟɓƈǟɓƈ123", "28": "卂乃匚卂乃匚123",
  "29": "ɒƃɔɒƃɔ123", "30": "ᴬᴮᶜᵃᵇᶜ¹²³", "31": "ꪖ᥇ᥴꪖ᥇ᥴ123", "32": "A͛B͛C͛a͛b͛c͛1͛2͛3͛",
  "33": "A᷈B᷈C᷈a᷈b᷈c᷈1᷈2᷈3᷈", "34": "A̶B̶C̶a̶b̶c̶1̶2̶3̶", "35": "A͒B͒C͒a͒b͒c͒1͒2͒3͒",
  "36": "A̲B̲C̲a̲b̲c̲1̲2̲3̲", "37": "A⎵B⎵C⎵a⎵b⎵c⎵1⎵2⎵3⎵", "38": "A͜͡B͜͡C͜͡a͜͡b͜͡c͜͡1͜͡2͜͡3͜͡",
  "39": "⒜⒝⒞⒜⒝⒞123", "40": "⦗A⦘⦗B⦘⦗C⦘⦗a⦘⦗b⦘⦗c⦘⦗1⦘⦗2⦘⦗3⦘"
};

const ITEMS_PER_PAGE = 10;

function buildFontMenu(shortId, page = 1) {
  const totalFonts = 40;
  const startIdx = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min(page * ITEMS_PER_PAGE, totalFonts);

  const text = 
    `🌸 *SAKURA • FONT STYLER*\n` +
    `────────────────────➤\n\n` +
    `✨ *Select your preferred font style below to convert your text.*\n\n` +
    `📖 *Page:* \`${page} / 4\` (Fonts ${startIdx}-${endIdx})`;

  const buttons = [];
  
  for (let i = startIdx; i <= endIdx; i++) {
    const fontKey = String(i);
    const sampleText = FONT_PREVIEWS[fontKey] || "Style " + fontKey;
    
    buttons.push([{
      text: `${fontKey}. ${sampleText}`,
      callback_data: JSON.stringify({ command: 'font', i: shortId, a: 'f', f: fontKey })
    }]);
  }

  const navRow = [];
  if (page > 1) {
    navRow.push({
      text: '◀️ Back',
      callback_data: JSON.stringify({ command: 'help', i: shortId, a: 'p', p: page - 1 })
    });
  }
  if (endIdx < totalFonts) {
    navRow.push({
      text: 'Next ▶️',
      callback_data: JSON.stringify({ command: 'font', i: shortId, a: 'p', p: page + 1 })
    });
  }
  
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  return { text, reply_markup: { inline_keyboard: buttons } };
}

export const eren = {
  name: 'font',
  version: '1.0.0',
  aliases: ['fontstyle', 'styletext', 'fonts'],
  description: 'Convert your normal text into 40+ professional stylish fonts.',
  author: 'S4YEM',
  category: 'utility',
  type: 'anyone',
  usePrefix: 'both',
  balance: 0,
  cooldown: 4,
  guide: ['[your_text_here]'],
};

export async function onStart({ args, response, senderID, usedPrefix }) {
  const inputText = args.join(' ');

  if (!inputText) {
    return response.reply(`❌ *Usage Example:* \`${usedPrefix}font Hello World\``);
  }

  const shortId = Math.random().toString(36).substring(2, 6);
  
  fontSessions.set(shortId, {
    uid: senderID,
    text: inputText,
    currentPage: 1
  });

  setTimeout(() => fontSessions.delete(shortId), 10 * 60 * 1000);

  const menu = buildFontMenu(shortId, 1);
  await response.reply(menu.text, { reply_markup: menu.reply_markup, parse_mode: 'Markdown' });
}

export async function onCallback({ callbackQuery, payload, response, messageId, senderID }) {
  let pl = payload;

  if (!pl && callbackQuery.data) {
    try { pl = JSON.parse(callbackQuery.data); } catch { return; }
  }

  if (!pl || (pl.command !== 'font' && pl.command !== 'help') || !pl.i || !pl.a) return;

  const session = fontSessions.get(pl.i);
  if (!session) {
    return response.answerCallback(callbackQuery, { text: '⏰ Session expired. Please send the command again.', show_alert: true });
  }

  if (String(senderID) !== String(session.uid)) {
    return response.answerCallback(callbackQuery, { text: '⛔ Access Denied: You cannot control this menu.', show_alert: true });
  }

  if (pl.a === 'p' && pl.p !== undefined) {
    session.currentPage = pl.p;
    fontSessions.set(pl.i, session);

    const menu = buildFontMenu(pl.i, pl.p);
    try {
      await response.edit('text', messageId, menu.text, {
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown',
      });
      await response.answerCallback(callbackQuery);
    } catch {
      await response.answerCallback(callbackQuery);
    }
    return;
  }

  if (pl.a === 'f' && pl.f !== undefined) {
    try {
      await response.answerCallback(callbackQuery, { text: '🔄 Converting your text...' });

      const apiUrl = `${API_URL}?text=${encodeURIComponent(session.text)}&id=${pl.f}`;
      const apiRes = await axios.get(apiUrl);

      if (apiRes.data && apiRes.data.code === 200 && apiRes.data.result) {
        const convertedText = apiRes.data.result;
        const fontStyleVisual = FONT_PREVIEWS[String(pl.f)] || "Stylish";

        const outputMessage = 
          `📥 *Original:* \`${session.text}\`\n\n` +
          `📝 *Result (Tap to copy):*\n\`${convertedText}\``;

        await response.edit('text', messageId, outputMessage, { parse_mode: 'Markdown' });
        fontSessions.delete(pl.i);
      } else {
        await response.reply(`❌ API Error: Unable to convert font. Code: ${apiRes.data?.code}`);
      }
    } catch (error) {
      console.error("Font Conversion Error:", error);
      await response.reply(`❌ Dynamic API execution failed. Please check network connection.`);
    }
  }
}
