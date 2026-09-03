import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import log, { header } from './log.js';

const COMMANDS_PATH = path.join(process.cwd(), 'scripts', 'cmds');
const EVENTS_PATH = path.join(process.cwd(), 'scripts', 'events');
const VERSION = '1.5';

let bannerShown = false;

function termWidth() {
	return Math.max(40, process.stdout.columns || 80);
}

function createLine(content, full = false) {
	const width = full ? termWidth() : Math.min(termWidth(), 56);
	if (!content) return '─'.repeat(width);
	const text = ` ${String(content).trim()} `;
	const rest = Math.max(0, width - text.length);
	const left = Math.floor(rest / 2);
	return '─'.repeat(left) + text + '─'.repeat(rest - left);
}

function centerText(plain, painted) {
	const width = termWidth();
	const pad = Math.max(0, Math.floor((width - plain.length) / 2));
	console.log(' '.repeat(pad) + (painted || plain));
}

function paintLine(text, i) {
	const colors = ['#FA8BFF', '#7B8CFF', '#2BD2FF', '#2BFF88', '#AFF6CF', '#f5af19'];
	return chalk.hex(colors[i % colors.length]).bold(text);
}

export function printBanner() {
	if (bannerShown) return;
	bannerShown = true;

	try {
		process.stdout.write('\x1b]2;Sakura Bot V' + VERSION + ' - Made by S4Eren\x1b\\');
	} catch (e) {}

	const wide = [
		'███████╗ █████╗ ██╗  ██╗██╗   ██╗██████╗  █████╗',
		'██╔════╝██╔══██╗██║ ██╔╝██║   ██║██╔══██╗██╔══██╗',
		'███████╗███████║█████╔╝ ██║   ██║██████╔╝███████║',
		'╚════██║██╔══██║██╔═██╗ ██║   ██║██╔══██╗██╔══██║',
		'███████║██║  ██║██║  ██╗╚██████╔╝██║  ██║██║  ██║',
		'╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝'
	];
	const mid = [
		'█▀▀ █▀█ █▄▀ █░█ █▀█ █▀█',
		'▄█  █▀█ █░█ █▄█ █▀▄ █▀█'
	];
	const width = termWidth();
	const title = width > 52 ? wide : width > 26 ? mid : ['SAKURA BOT V' + VERSION];

	console.log(chalk.hex('#f5af19')(createLine(null, true)));
	console.log();
	title.forEach((line, i) => centerText(line, paintLine(line, i)));
	console.log();

	const lines = [
		'Sakura Bot V' + VERSION + '  —  Telegram engine',
		'Created by S4Eren with ♡',
		'Type /help to see commands after boot'
	];
	for (const t of lines) {
		centerText(t, chalk.hex('#9F98E8')(t));
	}
	console.log(chalk.hex('#f12711')(createLine(null, true)));
	console.log();
}

function printBox(label, colorFn = chalk.hex('#f5ab00')) {
	console.log(colorFn.bold(createLine(label, true)));
}

// Walk a folder and collect every .js file, including nested ones.
function getAllCommandFiles(dir, fileList = []) {
	if (!fs.existsSync(dir)) return fileList;

	const items = fs.readdirSync(dir);

	for (const item of items) {
		const fullPath = path.join(dir, item);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			if (item === 'node_modules' || item.startsWith('.')) continue;
			getAllCommandFiles(fullPath, fileList);
		} else if (item.endsWith('.js')) {
			fileList.push(fullPath);
		}
	}
	return fileList;
}

// Import every command file and hang it on global.Sakura.
export async function loadCommands() {
	printBanner();
	printBox('SCANNING COMMANDS');
	log.info('commands path: ' + COMMANDS_PATH);

	const allFiles = getAllCommandFiles(COMMANDS_PATH);
	log.info('found ' + allFiles.length + ' command file(s)');

	for (const filePath of allFiles) {
		log.commands('Scanned ' + path.relative(COMMANDS_PATH, filePath));
	}

	printBox('DEPLOYING COMMANDS');

	let ok = 0;
	let skip = 0;
	let fail = 0;

	for (const filePath of allFiles) {
		const relativePath = path.relative(COMMANDS_PATH, filePath);
		try {
			const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());

			if (!mod.eren) {
				log.warn('Skipped ' + relativePath + ': missing "eren" export');
				skip++;
				continue;
			}

			const name = mod.eren.name;
			const parts = relativePath.split(path.sep);
			if (parts.length > 1) mod.eren.category = parts[0];

			global.Sakura.commands.set(name, mod);
			global.Sakura.commandFilesPath.push({
				filePath,
				commandName: name
			});

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

			log.commands('Deployed ' + name + ' [' + (mod.eren.category || 'uncategorized') + '] (' + relativePath + ')');
			ok++;
		} catch (e) {
			log.error('Failed to load ' + relativePath + ': ' + e.message);
			console.error(e);
			fail++;
		}
	}

	log.info('commands ready  •  loaded ' + ok + '  •  skipped ' + skip + '  •  failed ' + fail);
}

// Import event files from scripts/events (flat folder).
export async function loadEvents() {
	if (!fs.existsSync(EVENTS_PATH)) {
		log.warn('No events directory found.');
		return;
	}

	printBox('SCANNING EVENTS');
	log.info('events path: ' + EVENTS_PATH);

	const files = fs.readdirSync(EVENTS_PATH).filter(f => f.endsWith('.js'));
	log.info('found ' + files.length + ' event file(s)');
	for (const f of files) log.events('Scanned ' + f);

	printBox('DEPLOYING EVENTS');

	let ok = 0;
	let skip = 0;
	let fail = 0;

	for (const f of files) {
		try {
			const filePath = path.join(EVENTS_PATH, f);
			const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());

			if (!mod.eren) {
				log.warn('Skipped event ' + f + ': missing "eren" export');
				skip++;
				continue;
			}

			const name = mod.eren.name;
			global.Sakura.eventCommands.set(name, mod);
			global.Sakura.eventCommandsFilesPath.push({ filePath, commandName: name });

			if (typeof mod.onEvent === 'function') global.Sakura.onEvent.push(name);
			if (typeof mod.onAnyEvent === 'function') global.Sakura.onAnyEvent.push(name);

			log.events('Deployed ' + name);
			ok++;
		} catch (e) {
			log.error('Failed to load event ' + f + ': ' + e.message);
			console.error(e);
			fail++;
		}
	}

	log.info('events ready  •  loaded ' + ok + '  •  skipped ' + skip + '  •  failed ' + fail);
	printBox('BOOT COMPLETE');
		}
