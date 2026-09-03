const PAGE_SIZE = 8;

const CAT_ICON = {
	system: '⚙️',
	admin: '🛡️',
	group: '👥',
	economy: '💰',
	game: '🎮',
	fun: '🎉',
	media: '🖼️',
	ai: '🤖',
	utility: '🧰',
	info: 'ℹ️',
	premium: '💎',
	developer: '🔧'
};

function erenOf(cmd) {
	return (cmd && cmd.eren) || {};
}

function slug(value) {
	return String(value || 'system').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function roleLabel(role) {
	if (role >= 2) return 'Developer';
	if (role >= 1) return 'Premium';
	return 'Member';
}

function requiredRole(cmd) {
	const m = erenOf(cmd);
	if (typeof m.role === 'number') return m.role;
	if (m.role && typeof m.role === 'object' && typeof m.role.onStart === 'number') return m.role.onStart;

	const type = String(m.type || 'anyone').toLowerCase();
	if (type === 'developer') return 2;
	if (type === 'premium') return 1;
	return 0;
}

function canSee(cmd, { role, isGroup, isAdmin }) {
	const m = erenOf(cmd);
	const type = String(m.type || 'anyone').toLowerCase();
	const category = String(m.category || 'system').toLowerCase();

	if (type === 'hidden' || category === 'hidden') return false;
	if (requiredRole(cmd) > role) return false;
	if ((type === 'group' || category === 'group') && !isGroup) return false;
	if ((type === 'private' || category === 'private') && isGroup) return false;
	if (type === 'administrator' || type === 'admin') {
		if (!isGroup) return role >= 2;
		return isAdmin || role >= 2;
	}
	return true;
}

function visibleCommands({ role, isGroup, isAdmin }) {
	const list = [];
	for (const cmd of global.Sakura.commands.values()) {
		if (canSee(cmd, { role, isGroup, isAdmin })) list.push(cmd);
	}
	return list.sort((a, b) => erenOf(a).name.localeCompare(erenOf(b).name));
}

function findCommand(query) {
	const key = String(query || '').toLowerCase();
	if (!key) return null;

	const { commands, aliases } = global.Sakura;
	if (commands.has(key)) return commands.get(key);

	const aliasName = aliases.get(key);
	if (aliasName && commands.has(aliasName)) return commands.get(aliasName);

	for (const cmd of commands.values()) {
		const aliasesList = erenOf(cmd).aliases || [];
		if (aliasesList.map(String).map(v => v.toLowerCase()).includes(key)) return cmd;
	}
	return null;
}

async function groupAdmin(bot, chatId, userId, isGroup) {
	if (!isGroup || !bot || !chatId || !userId) return false;
	try {
		const member = await bot.getChatMember(chatId, userId);
		return ['administrator', 'creator'].includes(member.status);
	} catch {
		return false;
	}
}

function categoriesOf(list) {
	const map = new Map();
	for (const cmd of list) {
		const name = erenOf(cmd).category || 'system';
		const key = slug(name);
		if (!map.has(key)) map.set(key, { key, name, items: [] });
		map.get(key).items.push(cmd);
	}
	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function findCategory(list, key) {
	return categoriesOf(list).find(cat => cat.key === key) || null;
}

function pageSlice(items, page) {
	const total = items.length;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const current = Math.min(Math.max(Number(page) || 1, 1), pages);
	return {
		current,
		pages,
		total,
		items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
	};
}

function prefixOf(usedPrefix, config) {
	return usedPrefix || config.prefix || '/';
}

function homeText(list, prefix, role) {
	const cats = categoriesOf(list);
	const lines = cats.map(cat => {
		const icon = CAT_ICON[cat.key] || '📁';
		return `${icon} **${cat.name}** — ${cat.items.length}`;
	});

	return (
		`🌸 **Sakura Help**\n\n` +
		`Prefix: \`${prefix}\`\n` +
		`Commands: **${list.length}**\n` +
		`Role: **${roleLabel(role)}**\n\n` +
		(lines.length ? lines.join('\n') + '\n\n' : 'No commands loaded yet.\n\n') +
		`Use \`${prefix}help <name>\` for details\n` +
		`Use \`${prefix}help all\` for the full tree`
	);
}

function categoryText(cat, page, prefix) {
	const slice = pageSlice(cat.items, page);
	const icon = CAT_ICON[cat.key] || '📁';
	const rows = slice.items.map(cmd => {
		const m = erenOf(cmd);
		return `• \`${prefix}${m.name}\` — ${m.description || 'No description.'}`;
	});

	return (
		`${icon} **${cat.name}**\n\n` +
		(rows.join('\n') || 'Empty category.') +
		`\n\nPage **${slice.current}** / **${slice.pages}** · ${slice.total} commands`
	);
}

function allText(list, page, prefix) {
	const slice = pageSlice(list, page);
	const rows = slice.items.map(cmd => {
		const m = erenOf(cmd);
		return `• \`${prefix}${m.name}\` — ${m.description || 'No description.'}`;
	});

	return (
		`📜 **All commands**\n\n` +
		(rows.join('\n') || 'No commands available.') +
		`\n\nPage **${slice.current}** / **${slice.pages}** · ${slice.total} commands\n` +
		`\`${prefix}help <name>\` for details`
	);
}

function treeText(list, prefix) {
	const cats = categoriesOf(list);
	const lines = ['Sakura'];

	cats.forEach((cat, i) => {
		const lastCat = i === cats.length - 1;
		const branch = lastCat ? '└─' : '├─';
		const pad = lastCat ? '  ' : '│ ';
		lines.push(`${branch} ${cat.name}`);
		cat.items.forEach((cmd, j) => {
			const lastCmd = j === cat.items.length - 1;
			lines.push(`${pad}${lastCmd ? '└─' : '├─'} ${prefix}${erenOf(cmd).name}`);
		});
	});

	return (
		`📂 **Command tree**\n\n` +
		`\`\`\`\n${lines.join('\n')}\n\`\`\`\n` +
		`Total: **${list.length}**`
	);
}

function detailText(cmd, prefix) {
	const m = erenOf(cmd);
	const guides = Array.isArray(m.guide) ? m.guide : [m.guide || ''];
	const usage = guides.map(g => g ? `${prefix}${m.name} ${g}` : `${prefix}${m.name}`).join('\n');
	const aliases = (m.aliases || []).length
		? m.aliases.map(a => `\`${a}\``).join(', ')
		: 'None';

	let prefixRule = 'Required';
	if (m.usePrefix === false) prefixRule = 'Not required';
	if (m.usePrefix === 'both') prefixRule = 'Optional';

	return (
		`📘 **${m.name}**\n\n` +
		`Category: \`${m.category || 'system'}\`\n` +
		`Type: \`${m.type || 'anyone'}\`\n` +
		`Cooldown: **${m.cooldown ?? 1}s**\n` +
		`Balance: **${m.balance || 0}**\n` +
		`Prefix: **${prefixRule}**\n` +
		`Aliases: ${aliases}\n\n` +
		`${m.description || 'No description.'}\n\n` +
		`Usage:\n\`\`\`\n${usage}\n\`\`\``
	);
}

function btn(text, ...parts) {
	return { text, data: ['help', ...parts].join(':') };
}

function homeKeyboard(list) {
	const cats = categoriesOf(list);
	const rows = [];
	for (let i = 0; i < cats.length; i += 2) {
		const row = [btn(`${CAT_ICON[cats[i].key] || '📁'} ${cats[i].name}`, 'cat', cats[i].key, '1')];
		if (cats[i + 1]) row.push(btn(`${CAT_ICON[cats[i + 1].key] || '📁'} ${cats[i + 1].name}`, 'cat', cats[i + 1].key, '1'));
		rows.push(row);
	}
	rows.push([
		btn('📜 All', 'all', '1'),
		btn('📂 Tree', 'tree')
	]);
	return rows.length ? { inline_keyboard: rows.map(r => r.map(b => ({ text: b.text, callback_data: b.data }))) } : undefined;
}

function navKeyboard(view, extra, page, pages) {
	const row = [];
	if (page > 1) row.push(btn('◀️', view, extra, String(page - 1)).text === '◀️'
		? { text: '◀️', callback_data: ['help', view, extra, String(page - 1)].filter(v => v !== undefined && v !== '').join(':') }
		: null);
	// Build explicitly to keep callback_data short.
	const prev = page > 1 ? { text: '◀️', callback_data: extra ? `help:${view}:${extra}:${page - 1}` : `help:${view}:${page - 1}` } : null;
	const next = page < pages ? { text: '▶️', callback_data: extra ? `help:${view}:${extra}:${page + 1}` : `help:${view}:${page + 1}` } : null;
	const buttons = [];
	if (prev) buttons.push(prev);
	if (next) buttons.push(next);

	const rows = [];
	if (buttons.length) rows.push(buttons);
	rows.push([{ text: '🏠 Home', callback_data: 'help:home' }]);
	return { inline_keyboard: rows };
}

function treeKeyboard() {
	return {
		inline_keyboard: [[{ text: '🏠 Home', callback_data: 'help:home' }]]
	};
}

function detailKeyboard() {
	return {
		inline_keyboard: [[{ text: '🏠 Home', callback_data: 'help:home' }]]
	};
}

async function accessCtx({ bot, chatId, senderID, isGroup, role }) {
	const admin = role < 2 ? await groupAdmin(bot, chatId, senderID, isGroup) : true;
	return { role, isGroup: !!isGroup, isAdmin: !!admin };
}

function sendHelp(response, text, markup, mode) {
	const opts = markup ? { reply_markup: markup } : {};
	if (mode === 'edit') {
		return response.edit('text', response.msg, text, opts);
	}
	return response.reply(text, opts);
}

export const eren = {
	name: 'help',
	version: '3.0.0',
	aliases: ['h', 'menu', 'cmds', 'commands'],
	description: 'Show command list, categories, and usage.',
	author: 'S4Eren',
	category: 'system',
	type: 'anyone',
	role: 0,
	cooldown: 3,
	usePrefix: true,
	balance: 0,
	guide: ['', '<command>', '<page>', 'all']
};

export async function onStart({ args, response, config, bot, senderID, chatId, isGroup, role, usedPrefix }) {
	const prefix = prefixOf(usedPrefix, config);
	const ctx = await accessCtx({ bot, chatId, senderID, isGroup, role });
	const list = visibleCommands(ctx);
	const query = String(args[0] || '').toLowerCase();

	if (query && !['all', 'tree', 'menu'].includes(query) && Number.isNaN(Number(query))) {
		const cmd = findCommand(query);
		if (!cmd || !canSee(cmd, ctx)) {
			return response.reply(`Command \`${query}\` was not found.`);
		}
		return response.reply(detailText(cmd, prefix), { reply_markup: detailKeyboard() });
	}

	if (query === 'all' || query === 'tree') {
		return response.reply(treeText(list, prefix), { reply_markup: treeKeyboard() });
	}

	if (query && !Number.isNaN(Number(query))) {
		const slice = pageSlice(list, Number(query));
		return response.reply(allText(list, slice.current, prefix), {
			reply_markup: navKeyboard('all', '', slice.current, slice.pages)
		});
	}

	return response.reply(homeText(list, prefix, role), { reply_markup: homeKeyboard(list) });
}

export async function onCallback({ bot, callbackQuery, payload, args, response, chatId, senderID, role, config }) {
	const chatType = callbackQuery?.message?.chat?.type || '';
	const isGroup = chatType !== 'private';
	const prefix = prefixOf(null, config);
	const ctx = await accessCtx({ bot, chatId, senderID, isGroup, role });
	const list = visibleCommands(ctx);

	const action = String((payload && payload.args && payload.args[0]) || args[0] || 'home').toLowerCase();
	const a = (payload && payload.args) || args || [];

	let text = homeText(list, prefix, role);
	let markup = homeKeyboard(list);

	if (action === 'home') {
		text = homeText(list, prefix, role);
		markup = homeKeyboard(list);
	} else if (action === 'tree') {
		text = treeText(list, prefix);
		markup = treeKeyboard();
	} else if (action === 'all') {
		const page = Number(a[1]) || 1;
		const slice = pageSlice(list, page);
		text = allText(list, slice.current, prefix);
		markup = navKeyboard('all', '', slice.current, slice.pages);
	} else if (action === 'cat') {
		const key = String(a[1] || '');
		const page = Number(a[2]) || 1;
		const cat = findCategory(list, key);
		if (!cat) {
			text = homeText(list, prefix, role);
			markup = homeKeyboard(list);
		} else {
			const slice = pageSlice(cat.items, page);
			text = categoryText(cat, slice.current, prefix);
			markup = navKeyboard('cat', cat.key, slice.current, slice.pages);
		}
	} else if (action === 'cmd') {
		const cmd = findCommand(a[1]);
		if (!cmd || !canSee(cmd, ctx)) {
			await response.answerCallback(callbackQuery, { text: 'Command not found.', show_alert: true });
			return;
		}
		text = detailText(cmd, prefix);
		markup = detailKeyboard();
	}

	try {
		await response.edit('text', callbackQuery.message, text, { reply_markup: markup });
		await response.answerCallback(callbackQuery);
	} catch {
		await response.answerCallback(callbackQuery).catch(() => {});
	}
}
