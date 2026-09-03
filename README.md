<div align="center">

<img src="./banner.png" alt="Sakura Bot v1.5" width="100%">

<img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=700&size=20&duration=2500&pause=800&color=FF7EB6&center=true&vCenter=true&width=380&height=28&lines=SAKURA+BOT+v1.5;Telegram+Automation+Engine;Deploy+on+Render+in+minutes" alt="Sakura typing banner">

<img src="https://img.shields.io/badge/VERSION-1.5.0-ff6b9d?style=for-the-badge&labelColor=1a1020">
<img src="https://img.shields.io/badge/NODE.js-%3E%3D18.18-3c873a?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/PLATFORM-TELEGRAM-26A5E4?style=for-the-badge&logo=telegram&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/LICENSE-MIT-6c8cff?style=for-the-badge&labelColor=1a1020">

<img src="https://img.shields.io/badge/DEPLOY-RENDER-46E3B7?style=for-the-badge&logo=render&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/DATABASE-SQLite%20%7C%20MongoDB%20%7C%20JSON-c084fc?style=for-the-badge&labelColor=1a1020">

<p>
  <a href="#quick-start">Start</a> ·
  <a href="#run-on-render">Render</a> ·
  <a href="#creating-commands">Commands</a> ·
  <a href="#available-parameters">Params</a> ·
  <a href="#response-api">Response</a> ·
  <a href="#handler-types">Handlers</a> ·
  <a href="#command-types">Types</a> ·
  <a href="#global-state--globalsakura">Global</a>
</p>

</div>

---

**Sakura** is a modular Telegram bot engine by **S4Eren**.
Commands live in `scripts/cmds` and can change between updates — use `/help` inside Telegram for the live list.

```text
  ▸  multi-token login
  ▸  hot-reload commands & events
  ▸  sqlite / mongodb / json storage
  ▸  built-in web dashboard
  ▸  economy · games · image tools · group events
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/S4Eren/Sakura-Bot-V1.5.git
cd Sakura-Bot-V1.5
```

**System packages** (needed for `canvas` + `sqlite3`):

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install -y python3 make g++ pkg-config \
  libsqlite3-dev libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev

# Termux
pkg update -y && pkg install -y nodejs git python make clang \
  libsqlite libjpeg-turbo libcairo pango
```

```bash
npm install
```

### 2. Add your bot token — `json/tokens.json`

```json
[
  "123456789:AA...YOUR_TELEGRAM_BOT_TOKEN"
]
```

Multiple tokens = multiple bot instances from one process.

### 3. Configure the bot — `json/config.json`

```json
{
  "timezone": "Asia/Dhaka",
  "developer": "YOUR_NAME",
  "prefix": "/",
  "subprefix": ["+", "-", "#"],
  "usePrefix": true,
  "devID": ["YOUR_TELEGRAM_USER_ID"],
  "premium": [],
  "database": {
    "type": "sqlite",
    "mongodbURI": ""
  }
}
```

`devID` must be your **numeric** Telegram ID. After first start you can also run `/uid`.

| Field | Description |
|-------|-------------|
| `prefix` / `subprefix` | Accepted command prefixes |
| `usePrefix` | `true` / `false` / `"both"` |
| `devID` | Developer IDs (role `2`) |
| `premium` | Premium IDs (role `1`) |
| `adminOnly` | Lock the whole bot to developers |
| `whiteListMode` | Allow only listed users |
| `whiteListModeThread` | Allow only listed groups |
| `approve` | User / group approval gate |
| `database.type` | `sqlite` · `mongodb` · `json` |
| `economy.daily` | Daily reward amount |
| `reaction.success` / `reaction.error` | Auto reactions after a command |
| `timezone` | Clock + logs |
| `hideNotiMessage` | Hide “not found” / permission notices |

`json/config.json` and `json/messages.json` reload while the bot is running.

### 4. Start

```bash
npm start
```

| Script | What it does |
|--------|----------------|
| `npm start` | Production start → `core/main.js` |
| `npm run dev` | Watch mode |
| `npm run start:trace` | Start + stack traces |
| `node index.js` | Process wrapper with graceful restart |

Dashboard: **http://localhost:3000**
Then send `/help` in Telegram.

---

## Run on Render

Sakura already starts a web dashboard, so Render can treat it as a **Web Service**.
The dashboard port in code is `SAKURA_DASH_PORT` (default `3000`). Render health-checks `$PORT`, so you must map them.

### Before you deploy

1. Push the repo to GitHub.
2. Fill `json/tokens.json` and `json/config.json` (use a **private** repo — public tokens get stolen).
3. For data that must survive redeploys, use MongoDB:

```json
"database": {
  "type": "mongodb",
  "mongodbURI": "mongodb+srv://USER:PASS@cluster.mongodb.net/sakura"
}
```

Free Render disks wipe SQLite on every deploy. Mongo also reads `process.env.MONGODB_URI` if the config URI is empty.

### Create the service

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect `Sakura-Bot-V1.5`
3. Settings:

| Field | Value |
|-------|--------|
| Language | `Node` |
| Branch | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `SAKURA_DASH_PORT=$PORT npm start` |
| Instance | Free works if you add the URL to Sakura Uptime |

4. Environment variables:

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `20.18.0` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas URI *(only if you use MongoDB)* |

5. Deploy. Logs should show database connected + dashboard + bot started.
6. Open the Render URL (dashboard), then test `/help` on Telegram.

### Keep the bot alive (Render Free)

Render Free sleeps when nobody hits the URL. Sleep = bot offline.

1. Copy your Render URL — example `https://sakura-bot.onrender.com`
2. Open [Sakura Uptime Monitor](http://sakura-uptime-monitor.onrender.com)
3. **Get Started** / **Start Monitoring Free**
4. Add that Render URL

The monitor pings the dashboard so Render does not spin the service down.

### Local → Render checklist

```text
[ ] token in json/tokens.json
[ ] numeric ID in json/config.json → devID
[ ] database type chosen (mongodb on Render)
[ ] Start command maps SAKURA_DASH_PORT to $PORT
[ ] Render URL added on sakura-uptime-monitor.onrender.com
[ ] /help works in Telegram
```

---

## Project Structure

```text
Sakura-Bot-V1.5/
│
├── banner.png
├── index.js                      # process wrapper
├── package.json
│
├── json/
│   ├── config.json               # prefixes, owners, db, economy
│   ├── tokens.json               # Telegram bot token list
│   └── messages.json             # reply strings
│
├── core/
│   ├── main.js                   # boot: db, loaders, bots, dashboard
│   │
│   ├── system/
│   │   ├── config.json           # logger labels
│   │   ├── log.js
│   │   ├── login.js              # scan scripts/cmds + scripts/events
│   │   ├── handlerAction.js      # update dispatcher
│   │   ├── handlerEvent.js       # onStart / onChat / onReply / …
│   │   ├── Response.js           # Telegram helper
│   │   └── notify.js             # owner notices + approve buttons
│   │
│   ├── database/
│   │   ├── index.js
│   │   ├── adapters/             # json.js · sqlite.js · mongodb.js
│   │   └── controllers/          # users.js · threads.js · global.js
│   │
│   └── web/
│       ├── server.js             # dashboard HTTP API
│       └── index.html
│
└── scripts/
    ├── cmds/                     # one folder per category
    └── events/
        ├── welcome.js
        └── goodbye.js
```

---

## Creating Commands

Commands live under `scripts/cmds/<category>/`. Each file is an ESM module. **Do not import the engine** — everything is injected as handler arguments.

Metadata export is named **`eren`** (not `meta`).

```js
export const eren = {
  name: 'example',
  version: '1.0.0',
  aliases: ['ex'],
  description: 'Short summary shown in /help.',
  author: 'S4Eren',
  category: 'utility',
  type: 'anyone',          // see Command Types
  usePrefix: 'both',       // true | false | 'both'
  cooldown: 3,             // seconds (skipped for premium + developer)
  balance: 0,              // coin cost (skipped for premium + developer)
  guide: ['<text>']
};

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();
  await response.reply(`You said: ${args.join(' ')}`);
}
```

Drop the file in the matching category folder and restart, or load it live with the developer `cmd` tool.

`usePrefix`:

| Value | Meaning |
|-------|---------|
| `true` | Prefix required |
| `false` | No prefix |
| `'both'` | Works with or without a prefix |

Developers always bypass the prefix rule.

---

## Available Parameters

Every handler receives the same base object. Take only what you need.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bot` | `TelegramBot` | Raw `node-telegram-bot-api` instance |
| `api` | `object` | Optional URLs on `global.Sakura.api` |
| `event` | `object` | Resolved Telegram message |
| `body` | `string` | Full text or caption |
| `args` | `string[]` | Words after the command name (`onStart`) |
| `response` | `Response` | Message helper — see Response API |
| `role` | `number` | `0` anyone · `1` premium · `2` developer |
| `config` | `object` | Live `json/config.json` |
| `senderID` | `string` | Sender Telegram ID |
| `chatId` | `number` | Chat ID |
| `messageID` | `number` | Trigger message ID |
| `isGroup` | `boolean` | Group / supergroup |
| `from` | `object` | Raw Telegram `from` |
| `commandName` | `string` | Resolved command name |
| `usedPrefix` | `string` | Prefix the user typed (`onStart`) |
| `usage` | `function` | Sends `eren.guide` |
| `usersData` | `object` | User controller |
| `threadsData` | `object` | Thread / group controller |
| `globalData` | `object` | Global key-value controller |
| `userData` | `object` | This sender’s row |
| `threadData` | `object` | This chat’s row |

`onCallback` also gets:

| Parameter | Description |
|-----------|-------------|
| `callbackQuery` | Raw callback query |
| `payload` | Parsed `callback_data` |

`onReply` also gets `Reply` (saved data + `Reply.delete()`).
`onReaction` also gets `Reaction` (saved data + `Reaction.delete()`).

---

## Response API

All Telegram calls go through `response`. `**bold**` is converted to Telegram Markdown `*bold*`.

### Send

```js
await response.send('Hello!');                 // no quote
await response.reply('Hello!');                // quotes the user in groups
await response.sendTo(chatId, 'Hello!');
await response.forDev('Something happened.');  // every config.devID
```

### Upload

```js
await response.upload('photo',      fileOrUrl, { caption: 'Caption' });
await response.upload('audio',      fileOrUrl);
await response.upload('video',      fileOrUrl);
await response.upload('document',   buffer, { filename: 'file.json' });
await response.upload('sticker',    fileOrUrl);
await response.upload('animation',  fileOrUrl);
await response.upload('voice',      fileOrUrl);
await response.upload('video_note', fileOrUrl);
await response.upload('media_group', [
  { type: 'photo', media: url1, caption: 'First' },
  { type: 'photo', media: url2 }
]);
```

### Extra

```js
await response.location(lat, lng);
await response.venue(lat, lng, 'Title', 'Address');
await response.contact('+8801XXXXXXXXX', 'Name');
await response.poll('Best fruit?', ['Mango', 'Litchi']);
await response.dice();
await response.action('typing');   // typing | upload_photo | upload_document | …
```

### Edit / delete / react

```js
await response.edit('text',    sentMsg, 'New text');
await response.edit('caption', sentMsg, 'New caption');
await response.edit('media',   sentMsg, { type: 'photo', media: newUrl });
await response.edit('markup',  sentMsg, { inline_keyboard: [...] });
await response.update(loadingMsg, 'Done!');
await response.delete(sentMsg);

await response.react('🔥');
await response.react('👍', sentMsg);
await response.react(null);        // clear
```

Command success / error reactions are also applied automatically from `config.reaction`.

### Callbacks + keyboards

```js
await response.answerCallback(callbackQuery);
await response.answerCallback(callbackQuery, { text: 'Done!' });
await response.answerCallback(callbackQuery, { text: 'Error!', show_alert: true });

import { Response } from '../../core/system/Response.js';

const keyboard = Response.buildInlineKeyboard([
  [
    { text: 'Yes', data: { command: 'example', args: ['yes'] } },
    { text: 'No',  data: { command: 'example', args: ['no'] } }
  ],
  [{ text: 'Open', url: 'https://example.com' }]
]);

await response.reply('Choose:', { reply_markup: keyboard });
```

---

## Handler Types

### `onStart` — prefix command

```js
export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();
}
```

### `onChat` — every normal message

```js
export async function onChat({ body, response }) {
  if (!body) return;
}
```

### `onReply` — user replies to a registered bot message

```js
const sent = await response.reply('Reply with your name.');
global.Sakura.onReply.set(sent.message_id, {
  commandName: 'example',
  senderID
});

export async function onReply({ Reply, event, response }) {
  Reply.delete();
  await response.reply(`Name: ${event.text || ''}`);
}
```

### `onCallback` — inline button

```js
export async function onCallback({ payload, response, callbackQuery }) {
  const action = payload.args?.[0];
  await response.edit('text', callbackQuery.message, `You chose: ${action}`);
}
```

### `onEvent` — join / leave / service updates

Used by `scripts/events/welcome.js` and `goodbye.js`.

```js
export async function onEvent({ event, response, isGroup, threadData }) {
  if (!isGroup || !event.new_chat_members) return;
}
```

### `onAnyEvent` — every update

Runs before the other handlers.

### `onFirstChat` — first time this `chatId` hits the module

### `onReaction` — user reacted to a registered bot message

```js
global.Sakura.onReaction.set(sentMsg.message_id, {
  commandName: 'example',
  senderID
});
```

---

## User Roles

Assigned from `config.devID` and `config.premium`:

| Value | Name | Who |
|------:|------|-----|
| `2` | developer | `devID` |
| `1` | premium | `premium` |
| `0` | anyone | everyone else |

```js
export async function onStart({ role, response }) {
  if (role < 1) return response.reply('Premium only.');
  if (role < 2) return response.reply('Premium user.');
  await response.reply('Developer.');
}
```

Per-handler minimums:

```js
export const eren = {
  name: 'example',
  type: 'anyone',
  role: {
    onStart: 0,
    onReply: 1,
    onCallback: 0
  }
};
```

Cooldowns and `eren.balance` apply to role `0` only. Premium and developers skip both.

---

## Command Types

`eren.type` controls **who can run it** and **where**.

| Type | Who / where |
|------|-------------|
| `anyone` | Everybody, everywhere |
| `premium` | Premium + developer |
| `developer` | `devID` only |
| `administrator` | Group admins + developer (private chat: developer only) |
| `group` | Groups only |
| `private` | Private chat only |
| `hidden` | Runnable by name, kept out of `/help` style listings |

```js
export const eren = { name: 'gid', type: 'group' };
export const eren = { name: 'shell', type: 'developer' };
export const eren = { name: 'adboxonly', type: 'administrator' };
```

Group settings can also disable whole categories:

- `threadData.settings.games === false` → `category: 'game'` blocked
- `threadData.settings.economy === false` → `category: 'economy'` blocked

`/help` shows the live list for the current user. Do not hardcode every command in this README.

```text
/help           menu
/help <name>    one command
/help all       full list
/status         runtime
```

---

## Global State — `global.Sakura`

Available from any command without importing.

| Property | Type | Description |
|----------|------|-------------|
| `global.Sakura.commands` | `Map` | Loaded commands by name |
| `global.Sakura.aliases` | `Map` | Alias → name |
| `global.Sakura.eventCommands` | `Map` | Loaded events |
| `global.Sakura.onReply` | `Map` | Reply listeners |
| `global.Sakura.onReaction` | `Map` | Reaction listeners |
| `global.Sakura.onChat` | `array` | Commands with `onChat` |
| `global.Sakura.onEvent` | `array` | Commands / events with `onEvent` |
| `global.Sakura.onAnyEvent` | `array` | `onAnyEvent` modules |
| `global.Sakura.onFirstChat` | `array` | `onFirstChat` modules |
| `global.Sakura.cooldowns` | `Map` | `command:senderID → ms` |
| `global.Sakura.config` | `object` | Live config |
| `global.Sakura.messages` | `object` | Live `messages.json` |
| `global.Sakura.api` | `object` | Optional API map you attach |
| `global.Sakura.bots` | `array` | `{ bot, username, index }` |
| `global.Sakura.botUsername` | `string` | Primary username |
| `global.Sakura.startTime` | `number` | Boot time (ms) |
| `global.Sakura.db` | `object` | Active adapter + type |
| `global.Sakura.usersData` | `object` | Users controller |
| `global.Sakura.threadsData` | `object` | Threads controller |
| `global.Sakura.globalData` | `object` | Global controller |
| `global.Sakura.log` | `object` | `.commands()` `.events()` `.error()` `.warn()` `.info()` |

### Database helpers

```js
const user = await usersData.get(senderID);
await usersData.set(senderID, { money: 1000 });
await usersData.addExp(senderID, 20);

const thread = await threadsData.get(chatId);
await globalData.set('key', value);
```

User row includes `money`, `exp`, `level`, `daily`, `banned`, `approved`, `stats`, `data`.

---

## Database

| Type | Best for |
|------|----------|
| `sqlite` | Local VPS / PC (default) |
| `mongodb` | Render / ephemeral disk |
| `json` | Tiny tests, no native addon |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot starts, no replies | Token, prefix, approve / whitelist / adminOnly |
| `canvas` install error | Install Cairo / Pango / jpeg libs, then `npm install` |
| `sqlite3` install error | `libsqlite3-dev` + `python3 make g++` |
| Render live, Telegram silent | Start command must be `SAKURA_DASH_PORT=$PORT npm start` |
| Render healthy, data resets | MongoDB Atlas |
| Bot dies after minutes on Render Free | Add the Render URL to [Sakura Uptime](http://sakura-uptime-monitor.onrender.com) |
| Group ignored | Approve the group if `approve.enable` is on |

---

## License

MIT © [S4Eren](https://github.com/S4Eren)

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&duration=2000&pause=1000&color=E8B4D0&center=true&vCenter=true&width=260&height=22&lines=Developed+by+S4Eren" alt="footer typing">

https://github.com/S4Eren/Sakura-Bot-V1.5

</div>
