import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { pathToFileURL } from 'url';
import crypto from 'crypto';

const COMMANDS_DIR = path.join(process.cwd(), 'scripts', 'cmds');

if (!global.Sakura.pendingInstalls) global.Sakura.pendingInstalls = new Map();

export const eren = {
  name: "cmd",
  version: "1.0.1",
  aliases: ["command", "cmds"],
  description: "Install, load, and unload commands without restarting",
  author: "S4Eren",
  category: "developer",
  type: "developer",
  cooldown: 3,
  guide: [
    "load <name|category/filename.js>",
    "unload <name>",
    "loadall",
    "install <category/filename.js> <url>",
    "install <category/filename.js> <code>",
    "install <category/filename.js> (reply to a code message)"
  ],
  usePrefix: "both"
};

function listCommandFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item === 'node_modules' || item.startsWith('.')) continue;
      listCommandFiles(full, out);
    } else if (item.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function resolveCommandFile(input) {
  const raw = String(input || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.includes('..')) return null;

  const withJs = raw.endsWith('.js') ? raw : raw + '.js';
  const direct = path.join(COMMANDS_DIR, withJs);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  const all = listCommandFiles(COMMANDS_DIR);
  const relMatch = all.find(f => path.relative(COMMANDS_DIR, f).replace(/\\/g, '/') === withJs);
  if (relMatch) return relMatch;

  const base = path.basename(withJs);
  const hits = all.filter(f => path.basename(f) === base);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    throw new Error('Multiple matches:\n» ' + hits.map(f => path.relative(COMMANDS_DIR, f)).join('\n» '));
  }
  return null;
}

function unregisterCommand(name) {
  const cmd = global.Sakura.commands.get(name);
  if (!cmd) return false;

  if (Array.isArray(cmd.eren?.aliases)) {
    for (const alias of cmd.eren.aliases) {
      global.Sakura.aliases.delete(alias);
    }
  }

  global.Sakura.onChat = (global.Sakura.onChat || []).filter(n => n !== name);
  global.Sakura.onEvent = (global.Sakura.onEvent || []).filter(n => n !== name);
  global.Sakura.onAnyEvent = (global.Sakura.onAnyEvent || []).filter(n => n !== name);
  global.Sakura.onFirstChat = (global.Sakura.onFirstChat || []).filter(item => item.commandName !== name);
  global.Sakura.commandFilesPath = (global.Sakura.commandFilesPath || []).filter(item => item.commandName !== name);

  global.Sakura.commands.delete(name);
  return true;
}

async function loadCommandFile(fileName) {
  const filePath = resolveCommandFile(fileName);
  if (!filePath) throw new Error(`File not found: ${fileName}`);

  const importUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
  const mod = await import(importUrl);

  if (!mod.eren || !mod.eren.name) throw new Error(`Invalid command: missing eren.name`);

  const name = mod.eren.name;
  const relativePath = path.relative(COMMANDS_DIR, filePath);
  const parts = relativePath.split(path.sep);
  if (parts.length > 1) mod.eren.category = parts[0];

  unregisterCommand(name);

  global.Sakura.commands.set(name, mod);
  global.Sakura.commandFilesPath.push({ filePath, commandName: name });

  if (Array.isArray(mod.eren.aliases)) {
    for (const alias of mod.eren.aliases) {
      global.Sakura.aliases.set(alias, name);
    }
  }

  if (typeof mod.onChat === 'function') global.Sakura.onChat.push(name);
  if (typeof mod.onAnyEvent === 'function') global.Sakura.onAnyEvent.push(name);
  if (typeof mod.onEvent === 'function') global.Sakura.onEvent.push(name);
  if (typeof mod.onFirstChat === 'function') {
    global.Sakura.onFirstChat.push({ commandName: name, chatIDsChattedFirstTime: [] });
  }

  return { name, relativePath };
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
  const savePath = path.join(COMMANDS_DIR, fileName);
  await fs.ensureDir(path.dirname(savePath));
  await fs.writeFile(savePath, code, "utf8");
  const info = await loadCommandFile(fileName);

  const successText =
    `✅ Installed & Loaded successfully!\n\n` +
    `• File: \`${info.relativePath}\`\n` +
    `• Command: **${info.name}**`;

  if (loadingMsg) {
    return response.edit("text", loadingMsg, successText);
  }
  return response.reply(successText);
}

export async function onStart({ args, response, usage, event }) {
  if (!args.length) return usage();

  const action = args[0].toLowerCase();

  if (action === "load") {
    if (!args[1]) return response.reply("❌ Usage: `/cmd load <name|category/file.js>`");
    try {
      const info = await loadCommandFile(args[1]);
      return response.reply(`✅ Loaded command: **${info.name}**\n» ${info.relativePath}`);
    } catch (err) {
      return response.reply(`❌ Failed to load:\n\`${err.message}\``);
    }
  }

  if (action === "unload") {
    if (!args[1]) return response.reply("❌ Usage: `/cmd unload <name>`");
    const key = args[1].replace(/\.js$/i, '');
    let success = unregisterCommand(key);
    if (!success) {
      try {
        const filePath = resolveCommandFile(args[1]);
        const hit = filePath && (global.Sakura.commandFilesPath || []).find(x => x.filePath === filePath);
        if (hit) success = unregisterCommand(hit.commandName);
      } catch (e) {
        return response.reply(`❌ ${e.message}`);
      }
    }
    return response.reply(success ? `✅ Unloaded command: **${args[1]}**` : `❌ Command not found`);
  }

  if (action === "loadall") {
    const files = listCommandFiles(COMMANDS_DIR);
    let success = 0, failed = 0;
    const errors = [];

    for (const file of files) {
      const rel = path.relative(COMMANDS_DIR, file);
      try {
        await loadCommandFile(rel);
        success++;
      } catch (e) {
        failed++;
        errors.push(rel + ': ' + e.message);
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
      return response.reply("❌ Please provide a filename.\nExample: `/cmd install fun/test.js <url/code>`");
    }

    if (event.reply_to_message) {
      const repliedText = event.reply_to_message.text || event.reply_to_message.caption || "";
      code = extractCode(repliedText);
      fileName = args[1];

      if (!fileName) {
        return response.reply("❌ Please provide a filename.\nExample: `/cmd install fun/test.js`");
      }
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
        return response.reply("❌ Please provide a filename.\nExample: `/cmd install <url> fun/test.js`");
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
        if (remainingText) {
          code = remainingText;
        }
      }

      if (!code && args.length > 2) {
        const argsWithoutFirstTwo = args.slice(2).join(" ");
        if (argsWithoutFirstTwo.trim()) {
          code = argsWithoutFirstTwo.trim();
        }
      }
    }

    if (!fileName) {
      return response.reply("❌ Please provide a filename.\nExample: `/cmd install fun/test.js`");
    }

    if (!code || code.length < 10) {
      return response.reply("❌ No valid code found. Please provide code, a URL, or reply to a code message.");
    }

    if (!fileName.endsWith(".js")) fileName += ".js";
    fileName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (fileName.includes('..')) {
      return response.reply("❌ Invalid filename.");
    }

    if (!code.includes("export const eren") && !code.includes("export { eren }")) {
      return response.reply("❌ This does not look like a valid Sakura command (missing `export const eren`).");
    }

    const savePath = path.join(COMMANDS_DIR, fileName);

    if (fs.existsSync(savePath)) {
      const id = crypto.randomBytes(8).toString("hex");

      global.Sakura.pendingInstalls.set(id, {
        fileName,
        code,
        userId: event.from.id,
        chatId: event.chat.id,
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
                { text: "✅ Yes, Overwrite", callback_data: `cmd:overwrite:${id}` },
                { text: "❌ No, Cancel", callback_data: `cmd:cancel:${id}` }
              ]
            ]
          }
        }
      );
    }

    try {
      const loading = await response.reply("⏳ Installing...");
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

  const pending = global.Sakura.pendingInstalls.get(id);

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
    global.Sakura.pendingInstalls.delete(id);
    await response.edit("text", callbackQuery.message, "❌ Installation cancelled.");
    await response.answerCallback(callbackQuery, { text: "Cancelled" });
    return;
  }

  if (action === "overwrite") {
    global.Sakura.pendingInstalls.delete(id);

    try {
      await response.edit("text", callbackQuery.message, "⏳ Overwriting and installing...");
      await doInstall(pending.fileName, pending.code, response, callbackQuery.message);
      await response.answerCallback(callbackQuery, { text: "✅ Successfully overwritten" });
      return;
    } catch (err) {
      await response.edit("text", callbackQuery.message, `❌ Failed:\n\`${err.message}\``);
      await response.answerCallback(callbackQuery, {
        text: "Failed to overwrite",
        show_alert: true
      });
      return;
    }
  }
                            }
