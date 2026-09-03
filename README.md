<div align="center">

<img src="./banner.png" alt="Sakura Bot v1.5" width="100%">

<br>

<img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=700&size=30&duration=2800&pause=900&color=FF7EB6&center=true&vCenter=true&width=640&lines=SAKURA+BOT+v1.5;Telegram+Automation+Engine;Deploy+on+Render+in+minutes" alt="Sakura typing banner">

<br><br>

<img src="https://img.shields.io/badge/VERSION-1.5.0-ff6b9d?style=for-the-badge&labelColor=1a1020">
<img src="https://img.shields.io/badge/NODE.js-%3E%3D18.18-3c873a?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/PLATFORM-TELEGRAM-26A5E4?style=for-the-badge&logo=telegram&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/LICENSE-MIT-6c8cff?style=for-the-badge&labelColor=1a1020">

<br>

<img src="https://img.shields.io/badge/DEPLOY-RENDER-46E3B7?style=for-the-badge&logo=render&logoColor=white&labelColor=1a1020">
<img src="https://img.shields.io/badge/DATABASE-SQLite%20%7C%20MongoDB%20%7C%20JSON-c084fc?style=for-the-badge&labelColor=1a1020">

<p>
  <a href="#quick-start">Quick Start</a> ·
  <a href="#run-on-render">Render</a> ·
  <a href="#configuration">Config</a> ·
  <a href="#project-structure">Structure</a>
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

### 2. Put your token

Create a bot with [@BotFather](https://t.me/BotFather), then edit `json/tokens.json`:

```json
[
  "123456789:AA...YOUR_TELEGRAM_BOT_TOKEN"
]
```

Multiple tokens = multiple bot instances from one process.

### 3. Set owner + prefix

Edit `json/config.json`:

```json
{
  "developer": "YOUR_NAME",
  "prefix": "/",
  "subprefix": ["+", "-", "#"],
  "devID": ["YOUR_TELEGRAM_USER_ID"],
  "timezone": "Asia/Dhaka",
  "database": {
    "type": "sqlite",
    "mongodbURI": ""
  }
}
```

`devID` must be your **numeric** Telegram ID. After first start you can also run `/uid`.

### 4. Run locally

```bash
npm start
```

| Script | What it does |
|--------|----------------|
| `npm start` | Production start → `core/main.js` |
| `npm run dev` | Watch mode (auto restart on edit) |
| `npm run start:trace` | Same start + stack traces |
| `node index.js` | Process wrapper with graceful restart |

Dashboard: **http://localhost:3000**

If the bot is online, send `/help` in Telegram.

---

## Run on Render

Sakura already starts a web dashboard, so Render can treat it as a **Web Service**.  
The dashboard port in code is `SAKURA_DASH_PORT` (default `3000`). Render health-checks `$PORT`, so you must map them.

### Before you deploy

1. Push the repo to GitHub (your fork or this repo).
2. Fill `json/tokens.json` and `json/config.json` **in that repo** (or use a private repo — tokens in a public repo can be stolen).
3. For production data that should survive redeploys, switch database to MongoDB:

```json
"database": {
  "type": "mongodb",
  "mongodbURI": "mongodb+srv://USER:PASS@cluster.mongodb.net/sakura"
}
```

Free Render disks are ephemeral. SQLite files reset on every deploy.

### Create the service

1. Open [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect the GitHub repo `Sakura-Bot-V1.5`
3. Use these settings:

| Field | Value |
|-------|--------|
| Language | `Node` |
| Branch | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `SAKURA_DASH_PORT=$PORT npm start` |
| Instance | Paid / Starter recommended (Free spins down and the bot goes offline) |

4. **Environment → Environment Variables**

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `20.18.0` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas URI *(only if you use MongoDB)* |

5. Deploy. Wait until logs show:

```text
Database connected: sqlite
Dashboard running → http://localhost:XXXX
Bot started
```

6. Open the Render URL — that is the Sakura dashboard. Then test `/help` on Telegram.

### If `canvas` / `sqlite3` fails on Render

Native modules need compilers and Cairo. If the build errors, you can temporarily use the JSON database so `sqlite3` is not required:

```json
"database": { "type": "json", "mongodbURI": "" }
```

Image commands that draw with `canvas` still need Cairo on the host.

### Keep the bot alive

- Render **Free** web services sleep after idle time. A sleeping service = dead Telegram bot.
- Use a **Starter** (always-on) instance for a real 24/7 bot.
- Optional: ping your Render URL every 5–10 minutes from an uptime monitor if you stay on Free (not reliable).

### Local → Render checklist

```text
[ ] BotFather token in json/tokens.json
[ ] Your numeric ID in json/config.json → devID
[ ] prefix / timezone set
[ ] database type chosen (mongodb recommended on Render)
[ ] Start command maps SAKURA_DASH_PORT to $PORT
[ ] Always-on plan if you need 24/7
[ ] After deploy: /help works in Telegram
```

---

## Configuration

All live settings: `json/config.json`  
Reply templates: `json/messages.json`  
Tokens: `json/tokens.json`

Both `config.json` and `messages.json` are watched and reload without a full restart.

| Key | Purpose |
|-----|---------|
| `prefix` / `subprefix` | Command prefixes |
| `usePrefix` | Require a prefix |
| `devID` | Developer IDs |
| `premium` | Premium user IDs |
| `adminOnly` | Lock bot to developers |
| `whiteListMode` | Allow only listed users |
| `whiteListModeThread` | Allow only listed groups |
| `approve` | User / group approval gate |
| `database.type` | `sqlite` · `mongodb` · `json` |
| `economy.daily` | Daily reward amount |
| `reaction` | Success / error reactions |
| `timezone` | Clock + logs |

Commands are **not** hardcoded here. After the bot is running:

```text
/help          live command menu
/help <name>   usage for one command
/status        runtime info
```

New modules go in `scripts/cmds/<category>/` and can be loaded with the developer `cmd` tool — no README edit needed.

---

## Project Structure

```text
Sakura-Bot-V1.5/
│
├── banner.png                 # README / brand banner
├── index.js                   # process wrapper (start / stop / restart)
├── package.json
│
├── json/
│   ├── config.json            # prefixes, owners, db, economy
│   ├── tokens.json            # Telegram bot token list
│   └── messages.json          # reply strings
│
├── core/
│   ├── main.js                # engine entry — db, loaders, bots, dashboard
│   │
│   ├── system/
│   │   ├── config.json        # logger label map
│   │   ├── log.js             # colored console logger
│   │   ├── login.js           # load commands + events
│   │   ├── handlerAction.js   # message / callback / command router
│   │   ├── handlerEvent.js    # Telegram event router
│   │   ├── Response.js        # reply / send / edit helpers
│   │   └── notify.js          # owner / system notices
│   │
│   ├── database/
│   │   ├── index.js           # picks adapter + builds controllers
│   │   ├── adapters/
│   │   │   ├── json.js
│   │   │   ├── sqlite.js
│   │   │   └── mongodb.js
│   │   └── controllers/
│   │       ├── users.js
│   │       ├── threads.js
│   │       └── global.js
│   │
│   └── web/
│       ├── server.js          # dashboard HTTP API
│       └── index.html         # dashboard UI
│
└── scripts/
    ├── cmds/                  # commands grouped by category
    │   ├── administrator/
    │   ├── ai-image/
    │   ├── developer/
    │   ├── economy/
    │   ├── game/
    │   ├── group/
    │   ├── image/
    │   ├── system/
    │   ├── tools/
    │   └── utility/
    └── events/
        ├── welcome.js
        └── goodbye.js
```

### Core map

| Path | Role |
|------|------|
| `core/main.js` | Boot sequence, watchers, multi-token login |
| `core/system/login.js` | Scans `scripts/cmds` + `scripts/events` |
| `core/system/handlerAction.js` | Permissions, cooldown, command run |
| `core/system/handlerEvent.js` | Welcome / goodbye and other events |
| `core/system/Response.js` | Unified Telegram replies |
| `core/database/index.js` | `sqlite` / `mongodb` / `json` |
| `core/web/server.js` | Dashboard on `SAKURA_DASH_PORT` or `3000` |

### Command module shape

```js
export const eren = {
  name: 'example',
  version: '1.0.0',
  aliases: ['ex'],
  description: 'Short summary shown in /help',
  author: 'S4Eren',
  category: 'utility',
  type: 'anyone',          // anyone | administrator | developer
  usePrefix: 'both',
  cooldown: 3,
  guide: ['<args>']
};

export async function onStart({ event, response }) {
  await response.reply('Sakura is online.');
}
```

---

## Database

Set `database.type` in `json/config.json`.

| Type | Best for |
|------|----------|
| `sqlite` | Local VPS / PC (default) |
| `mongodb` | Render / any host where disk is wiped |
| `json` | Tiny tests, no native addon |

Mongo can also read `process.env.MONGODB_URI` if the config URI is empty.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot starts, no replies | Token, prefix, `approve` / whitelist / `adminOnly` |
| `canvas` install error | Install Cairo / Pango / jpeg system libs, then `npm install` |
| `sqlite3` install error | Install `libsqlite3-dev` + `python3 make g++` |
| Render deploy is live but Telegram silent | Start command must be `SAKURA_DASH_PORT=$PORT npm start` |
| Render deploy healthy, data resets | Move to MongoDB Atlas |
| Bot dies after some minutes on Render Free | Service slept — use an always-on plan |
| Group ignored | Approve that group if `approve.enable` is on |

---

## License

MIT © [S4Eren](https://github.com/S4Eren)

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=18&duration=2500&pause=1200&color=E8B4D0&center=true&vCenter=true&width=520&lines=Built+with+Sakura;Developed+by+S4Eren" alt="footer typing">

<br>

[github.com/S4Eren/Sakura-Bot-V1.5](https://github.com/S4Eren/Sakura-Bot-V1.5)

</div>
