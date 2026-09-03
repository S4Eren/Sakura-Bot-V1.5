import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { pathToFileURL } from 'url';
import crypto from 'crypto';

const EVENTS_DIR = path.join(process.cwd(), 'scripts', 'events');

if (!global.Sakura.pendingEventInstalls) global.Sakura.pendingEventInstalls = new Map();

export const eren = {
  name: "event",
  version: "1.0.1",
  aliases: ["events", "evnt"],
  description: "Install, load, and unload events without restarting",
  author: "S4Eren",
  category: "developer",
  type: "developer",
  cooldown: 3,
  guide: [
    "load <name|filename.js>",
    "unload <name>",
    "loadall",
    "install <filename.js> <url>",
    "install <filename.js> <code>",
    "install <filename.js> (reply to a code message)"
  ],
  usePrefix: "both"
};

function safeFileName(input) {
  let name = path.basename(String(input || '').replace(/\\/g, '/'));
  if (!name || name.includes('..')) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  if (!name.endsWith('.js')) name += '.js';
  return name;
}

function unregisterEvent(name) {
  const S = global.Sakura;
  const ev = S.eventCommands.get(name);
  if (!ev) return false;

  S.onEvent = (S.onEvent || []).filter(n => n !== name);
  S.onAnyEvent = (S.onAnyEvent || []).filter(n => n !== name);
  S.eventCommandsFilesPath = (S.eventCommandsFilesPath || []).filter(item => item.commandName !== name);
  S.eventCommands.delete(name);
  return true;
}

async function loadEventFile(fileName) {
  const safe = safeFileName(fileName);
  if (!safe) throw new Error(`Invalid filename: ${fileName}`);

  const filePath = path.join(EVENTS_DIR, safe);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${safe}`);

  const mod = await import(pathToFileURL(filePath).href + `?t=${Date.now()}`);
  if (!mod.eren || !mod.eren.name) throw new Error(`Invalid event: missing eren.name`);

  const name = mod.eren.name;
  unregisterEvent(name);

  global.Sakura.eventCommands.set(name, mod);
  global.Sakura.eventCommandsFilesPath.push({ filePath, commandName: name });

  if (typeof mod.onEvent === 'function') global.Sakura.onEvent.push(name);
  if (typeof mod.onAnyEvent === 'function') global.Sakura.onAnyEvent.push(name);

  return { name, fileName: safe };
}

function extractCode(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const wrapped = raw.match(/^```(?:js|javascript)?\s*([\s\S]*?)```\s*$/i);
  if (wrapped && wrapped[1] && wrapped[1].trim().length > 20) return wrapped[1].trim();
  const inner = raw.match(/```(?:js|javascript)?\s*([\s\S]*?)```/i);
  if (inner && inner[1] && inner[1].trim().length > raw.length * 0.5) return inner[1].trim();
  return raw;
}

async function doInstall(fileName, code, response, loadingMsg = null) {
  const savePath = path.join(EVENTS_DIR, fileName);
  await fs.ensureDir(EVENTS_DIR);
  await fs.writeFile(savePath, code, "utf8");
  const info = await loadEventFile(fileName);

  const successText =
    `✅ Event installed & loaded!\n\n` +
    `• File: \`${info.fileName}\`\n` +
    `• Event: **${info.name}**`;

  if (loadingMsg) {
    return response.edit("text", loadingMsg, successText);
  }
  return response.reply(successText);
}

export async function onStart({ args, response, usage, event }) {
  if (!args.length) return usage();

  const action = args[0].toLowerCase();

  if (action === "load") {
    if (!args[1]) return response.reply("❌ Usage: `/event load <filename.js>`");
    try {
      const info = await loadEventFile(args[1]);
      return response.reply(`✅ Loaded event: **${info.name}**\n» ${info.fileName}`);
    } catch (err) {
      return response.reply(`❌ Failed to load:\n\`${err.message}\``);
    }
  }

  if (action === "unload") {
    if (!args[1]) return response.reply("❌ Usage: `/event unload <name>`");
    const key = args[1].replace(/\.js$/i, '');
    const success = unregisterEvent(key);
    return response.reply(success ? `✅ Unloaded event: **${args[1]}**` : `❌ Event not found`);
  }

  if (action === "loadall") {
    if (!fs.existsSync(EVENTS_DIR)) {
      return response.reply("❌ No events directory found.");
    }
    const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.js'));
    let success = 0, failed = 0;
    const errors = [];

    for (const file of files) {
      try {
        await loadEventFile(file);
        success++;
      } catch (e) {
        failed++;
        errors.push(file + ': ' + e.message);
      }
    }

    let text = `✅ Loaded: **${success}**\n❌ Failed: **${failed}**`;
    if (errors.length && errors.length <= 8) text += '\n\n' + errors.join('\n');
    return response.reply(text);
  }

  if (action === "install") {
    let fileName = null;
    let code = null;
    let url = null;

    if (args.length < 2) {
      return response.reply("❌ Please provide a filename.\nExample: `/event install welcome.js <url/code>`");
    }

    if (event.reply_to_message) {
      const repliedText = event.reply_to_message.text || event.reply_to_message.caption || "";
      code = extractCode(repliedText);
      fileName = args[1];
    }
    else if (args[2] && (args[2].startsWith("http://") || args[2].startsWith("https://"))) {
      fileName = args[1];
      url = args[2];
      if (url.includes("github.com") && url.includes("/blob/")) {
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
      }
      try {
        const { data } = await axios.get(url, { responseType: "text", timeout: 15000 });
        code = data;
      } catch (err) {
        return response.reply(`❌ Failed to download from URL:\n\`${err.message}\``);
      }
    }
    else if (args[1] && (args[1].startsWith("http://") || args[1].startsWith("https://"))) {
      if (!args[2]) {
        return response.reply("❌ Please provide a filename.\nExample: `/event install <url> welcome.js`");
      }
      url = args[1];
      fileName = args[2];
      if (url.includes("github.com") && url.includes("/blob/")) {
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
      }
      try {
        const { data } = await axios.get(url, { responseType: "text", timeout: 15000 });
        code = data;
      } catch (err) {
        return response.reply(`❌ Failed to download from URL:\n\`${err.message}\``);
      }
    }
    else {
      fileName = args[1];
      const fullText = event.message?.text || event.text || "";
      const lines = fullText.split("\n");
      lines.shift();
      if (lines.length > 0) {
        const remainingText = lines.join("\n").trim();
        if (remainingText) code = remainingText;
      }
      if (!code && args.length > 2) {
        const rest = args.slice(2).join(" ").trim();
        if (rest) code = rest;
      }
    }

    fileName = safeFileName(fileName);
    if (!fileName) {
      return response.reply("❌ Invalid filename. Use only `welcome.js` — no folders.");
    }

    if (!code || code.length < 10) {
      return response.reply("❌ No valid code found. Provide code, a URL, or reply to a code message.");
    }

    if (!code.includes("export const eren") && !code.includes("export { eren }")) {
      return response.reply("❌ This does not look like a valid Sakura event (missing `export const eren`).");
    }

    const savePath = path.join(EVENTS_DIR, fileName);

    if (fs.existsSync(savePath)) {
      const id = crypto.randomBytes(8).toString("hex");
      global.Sakura.pendingEventInstalls.set(id, {
        fileName,
        code,
        userId: event.from.id,
        expire: Date.now() + 5 * 60 * 1000
      });

      return response.reply(
        `⚠️ **File already exists!**\n\n` +
        `File: \`${fileName}\`\n\n` +
        `Do you want to overwrite it?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes, Overwrite", callback_data: `event:overwrite:${id}` },
                { text: "❌ No, Cancel", callback_data: `event:cancel:${id}` }
              ]
            ]
          }
        }
      );
    }

    try {
      const loading = await response.reply("⏳ Installing event...");
      await doInstall(fileName, code, response, loading);
      return;
    } catch (err) {
      return response.reply(`❌ Install failed:\n\`${err.message}\``);
    }
  }

  return usage();
}

export async function onCallback({ payload, response, callbackQuery }) {
  if (!payload?.args || payload.args.length < 2) return;

  const action = payload.args[0];
  const id = payload.args[1];
  const pending = global.Sakura.pendingEventInstalls.get(id);

  if (!pending) {
    await response.answerCallback(callbackQuery, {
      text: "⏳ This request has expired or is invalid.",
      show_alert: true
    });
    return;
  }

  if (callbackQuery.from.id !== pending.userId) {
    await response.answerCallback(callbackQuery, {
      text: "❌ This is not your request.",
      show_alert: true
    });
    return;
  }

  if (action === "cancel") {
    global.Sakura.pendingEventInstalls.delete(id);
    await response.edit("text", callbackQuery.message, "❌ Installation cancelled.");
    await response.answerCallback(callbackQuery, { text: "Cancelled" });
    return;
  }

  if (action === "overwrite") {
    global.Sakura.pendingEventInstalls.delete(id);
    try {
      await response.edit("text", callbackQuery.message, "⏳ Overwriting and installing...");
      await doInstall(pending.fileName, pending.code, response, callbackQuery.message);
      await response.answerCallback(callbackQuery, { text: "✅ Successfully overwritten" });
    } catch (err) {
      await response.edit("text", callbackQuery.message, `❌ Failed:\n\`${err.message}\``);
      await response.answerCallback(callbackQuery, {
        text: "Failed to overwrite",
        show_alert: true
      });
    }
  }
}
