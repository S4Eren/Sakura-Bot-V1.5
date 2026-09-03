process.on('unhandledRejection', (err) => {
	console.error('[unhandledRejection]', err);
});

process.on('uncaughtException', (err) => {
	console.error('[uncaughtException]', err);
});

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

import log, { header } from './system/log.js';
import { loadCommands, loadEvents } from './system/login.js';
import createHandlerAction from './system/handlerAction.js';
import { startWebServer } from './web/server.js';
import { initDatabase } from './database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const configPath = path.join(ROOT, 'json', 'config.json');
const tokensPath = path.join(ROOT, 'json', 'tokens.json');
const messagesPath = path.join(ROOT, 'json', 'messages.json');

const config = JSON.parse(
	fs.readFileSync(configPath, 'utf8')
);

let tokens = JSON.parse(
	fs.readFileSync(tokensPath, 'utf8')
);

if (!Array.isArray(tokens)) {
	tokens = [tokens];
}


// ============================================================
// MESSAGES
// ============================================================

function loadMessages() {
	try {
		return JSON.parse(
			fs.readFileSync(messagesPath, 'utf8')
		);
	} catch (e) {
		log.warn(
			'messages.json missing or invalid — using empty messages object.'
		);

		return {};
	}
}

let messages = loadMessages();


// ============================================================
// CONFIG WATCHER
// ============================================================

let configLastMod = fs.statSync(configPath).mtimeMs;

fs.watch(configPath, (eventType) => {
	if (eventType !== 'change') return;

	setTimeout(() => {
		try {
			const newMod = fs.statSync(configPath).mtimeMs;

			if (newMod === configLastMod) return;

			configLastMod = newMod;

			global.Sakura.config = JSON.parse(
				fs.readFileSync(configPath, 'utf8')
			);

			log.info('Config reloaded.');
		} catch {
			log.warn(
				'Config reload failed — keeping previous config.'
			);
		}
	}, 200);
});


// ============================================================
// MESSAGES WATCHER
// ============================================================

let messagesLastMod = 0;

try {
	messagesLastMod = fs.statSync(messagesPath).mtimeMs;
} catch {
	// File may be added later.
}

try {
	fs.watch(messagesPath, (eventType) => {
		if (eventType !== 'change') return;

		setTimeout(() => {
			try {
				const newMod = fs.statSync(messagesPath).mtimeMs;

				if (newMod === messagesLastMod) return;

				messagesLastMod = newMod;

				global.Sakura.messages = loadMessages();

				log.info('Messages reloaded.');
			} catch {
				log.warn(
					'Messages reload failed — keeping previous messages.'
				);
			}
		}, 200);
	});
} catch {
	// messages.json not present yet — skip watcher
}


// ============================================================
// PREFIX CHECK
// ============================================================

async function processWithSakura({ body }) {
	const prefix =
		global.Sakura.config.prefix || '/';

	const extras =
		global.Sakura.config.subprefix || [];

	const all = [
		prefix,
		...extras
	];

	if (
		!body ||
		!all.some(p => body.startsWith(p))
	) {
		return false;
	}

	return true;
}


// ============================================================
// GLOBAL SAKURA OBJECT
// ============================================================

global.Sakura = {
	startTime:
		Date.now() -
		process.uptime() * 1000,

	commands: new Map(),

	eventCommands: new Map(),

	commandFilesPath: [],

	eventCommandsFilesPath: [],

	aliases: new Map(),

	onFirstChat: [],

	onChat: [],

	onEvent: [],

	onReply: new Map(),

	onReaction: new Map(),

	onAnyEvent: [],

	firstChatSeen: new Set(),

	cooldowns: new Map(),

	botUsername: null,

	bots: [],

	uptimeHistory: [],

	gcEvictedChats: new Set(),

	notifiedUsers: new Set(),

	notifiedThreads: new Set(),


	// Database
	db: null,

	usersData: null,

	threadsData: null,

	globalData: null,


	// Sakura processor
	processWithSakura,

	config,

	messages,


	// Logger
	log: {
		commands: msg => log.commands(msg),

		events: msg => log.events(msg),

		error: msg => log.error(msg),

		warn: msg => log.warn(msg),

		info: msg => log.info(msg),

		sakura: msg => log.info(msg)
	}
};


// ============================================================
// UPTIME TRACKER
// ============================================================

function recordUptimeSample() {
	if (!global.Sakura) return;

	const history =
		global.Sakura.uptimeHistory ||
		(global.Sakura.uptimeHistory = []);

	history.push({
		ts: Date.now(),

		uptime:
			Date.now() -
			global.Sakura.startTime
	});

	// Keep approximately 72 hours of minute samples.
	if (history.length > 4320) {
		history.shift();
	}
}

recordUptimeSample();

setInterval(
	recordUptimeSample,
	60000
);


// ============================================================
// ENGINE START
// ============================================================

(async () => {

	console.log(
		chalk.bold.cyan(
			'\nSAKURA ENGINE INITIALIZING...'
		)
	);

	log.info(
		'Activating Engine Protocols...'
	);


	// ----------------------------------------------------------
	// TOKEN CHECK
	// ----------------------------------------------------------

	if (
		tokens.length === 0 ||
		tokens.every(
			t =>
				!t ||
				t === 'YOUR_BOT_TOKEN_HERE'
		)
	) {
		log.error(
			'No valid tokens in json/tokens.json — exiting.'
		);

		process.exit(1);
	}


	// ----------------------------------------------------------
	// DATABASE
	// ----------------------------------------------------------

	try {

		const db =
			await initDatabase(config);

		global.Sakura.db = db;

		global.Sakura.usersData =
			db.usersData;

		global.Sakura.threadsData =
			db.threadsData;

		global.Sakura.globalData =
			db.globalData;

		log.info(
			`Database connected: ${db.type}`
		);

	} catch (e) {

		log.error(
			`Database init failed: ${e.message}`
		);

		process.exit(1);
	}


	// ----------------------------------------------------------
	// LOAD COMMANDS
	// ----------------------------------------------------------

	await loadCommands();


	// ----------------------------------------------------------
	// LOAD EVENTS
	// ----------------------------------------------------------

	await loadEvents();


	// ----------------------------------------------------------
	// WEB SERVER
	// ----------------------------------------------------------

	startWebServer();


	// ----------------------------------------------------------
	// START BOTS
	// ----------------------------------------------------------

	for (
		let i = 0;
		i < tokens.length;
		i++
	) {

		const token = tokens[i];

		if (
			!token ||
			token === 'YOUR_BOT_TOKEN_HERE'
		) {

			log.warn(
				`Token #${i + 1} is a placeholder — skipping.`
			);

			continue;
		}

		try {

			await startBot(
				token,
				i + 1
			);

		} catch (e) {

			log.error(
				`Failed to start bot #${i + 1}: ${e.message}`
			);

		}
	}


	// ----------------------------------------------------------
	// STARTUP MESSAGE
	// ----------------------------------------------------------

	await sendStartupMessage();

})();


// ============================================================
// START TELEGRAM BOT
// ============================================================

async function startBot(
	token,
	index
) {

	const bot =
		new TelegramBot(token, {
			polling: {
				params: {
					allowed_updates: [
						'message',
						'edited_message',
						'callback_query',
						'message_reaction',
						'message_reaction_count'
					]
				}
			}
		});


	// ----------------------------------------------------------
	// GET BOT INFORMATION
	// ----------------------------------------------------------

	const me =
		await bot.getMe();


	if (index === 1) {
		global.Sakura.botUsername =
			me.username;
	}


	// ----------------------------------------------------------
	// HANDLER
	// ----------------------------------------------------------

	const handlerAction =
		createHandlerAction(bot);


	bot.on(
		'message',
		msg =>
			handlerAction({
				message: msg
			})
	);


	bot.on(
		'edited_message',
		msg =>
			handlerAction({
				edited_message: msg
			})
	);


	bot.on(
		'callback_query',
		cbq =>
			handlerAction({
				callback_query: cbq
			})
	);


	bot.on(
		'message_reaction',
		rxn =>
			handlerAction({
				message_reaction: rxn
			})
	);


	// ========================================================
	// POLLING ERROR HANDLER
	// ========================================================

	bot.on(
		'polling_error',
		err => {

			if (
				err?.response?.statusCode === 409
			) {

				log.error(
					`Bot #${index} @${me.username}: polling conflict — another instance is using this token.`
				);

				return;
			}


			log.error(
				`Polling error (bot #${index}): ${err.message}`
			);
		}
	);


	// ----------------------------------------------------------
	// SAVE BOT
	// ----------------------------------------------------------

	global.Sakura.bots.push({
		bot,

		username:
			me.username,

		index,

		token,

		userId:
			me.id
	});


	// ----------------------------------------------------------
	// ONLINE LOG
	// ----------------------------------------------------------

	header(
		'SAKURA SERVER ONLINE',
		chalk.bold.green
	);

	log.login(
		`Bot #${index} @${me.username} is online`
	);


	return bot;
}


// ============================================================
// STARTUP MESSAGE FOR DEVELOPERS
// ============================================================

async function sendStartupMessage() {

	const {
		bots,
		config
	} = global.Sakura;


	if (!bots.length) {
		return;
	}


	// First active bot sends the message.
	const { bot } = bots[0];


	const {
		devID = [],
		timezone = 'UTC'
	} = config;


	if (!Array.isArray(devID) || !devID.length) {
		return;
	}


	// ----------------------------------------------------------
	// TIME
	// ----------------------------------------------------------

	const time =
		new Date().toLocaleString(
			'en-US',
			{
				timeZone: timezone,

				hour: 'numeric',

				minute: '2-digit',

				hour12: true
			}
		);


	// ----------------------------------------------------------
	// DATABASE
	// ----------------------------------------------------------

	const database =
		global.Sakura.db?.type ||
		'Unknown';


	// ----------------------------------------------------------
	// BOT INFO
	// ----------------------------------------------------------

	const username =
		global.Sakura.botUsername
			? `@${global.Sakura.botUsername}`
			: 'Unknown';


	// ----------------------------------------------------------
	// STARTUP MESSAGE
	// ----------------------------------------------------------

	const text =
		`🔔 *𝗦𝘆𝘀𝘁𝗲𝗺 𝗢𝗻𝗹𝗶𝗻𝗲:*\n` +
		`▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +

		`⏰ *Time:* ${time}\n\n` +

		`📌 Sakura Bot is now online and ready to handle your commands. ` +
		`All systems are operational! 🚀✨\n\n` +

		`🤖 *Bot:* ${username}\n` +

		`🗄️ *Database:* ${database}\n` +

		`🔢 *Instances:* ${bots.length}\n` +

		`📡 *Status:* Operational ✅\n\n` +

		`— 𝐒𝐀𝐊𝐔𝐑𝐀 𝐁𝐎𝐓\n` +
		`▬▬▬▬▬▬▬▬▬▬▬▬`;


	// ----------------------------------------------------------
	// SEND TO ALL DEVELOPERS
	// ----------------------------------------------------------

	for (const id of devID) {

		try {

			await bot.sendMessage(
				id,
				text,
				{
					parse_mode: 'Markdown'
				}
			);

		} catch (e) {

			log.warn(
				`Startup message failed for ${id}: ${e.message}`
			);

		}
	}
}
