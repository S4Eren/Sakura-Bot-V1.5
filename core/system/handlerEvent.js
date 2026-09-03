import { Response } from './Response.js';
import { notifyNewUser, notifyNewThread } from './notify.js';

// Pull a line from messages.json and fill in {placeholders}.
function getLang(key, vars) {
	vars = vars || {};
	const pack = (global.Sakura && global.Sakura.messages) || {};
	let text = pack[key];
	if (text == null) return key;
	text = String(text);
	for (const k of Object.keys(vars)) {
		text = text.split('{' + k + '}').join(String(vars[k] == null ? '' : vars[k]));
	}
	return text;
}

// 0 = anyone, 1 = premium list, 2 = developer list.
function getRole(senderID) {
	const { devID = [], premium = [] } = global.Sakura.config;
	const id = String(senderID);
	if (devID.includes(id)) return 2;
	if (premium.includes(id)) return 1;
	return 0;
}

// True only when this user sits in config.devID.
function isBotAdmin(senderID) {
	const devID = (global.Sakura.config && global.Sakura.config.devID) || [];
	return devID.map(String).includes(String(senderID));
}

// Ask Telegram if this user is admin or owner of the group.
async function isGroupAdmin(bot, chatId, senderID) {
	try {
		const member = await bot.getChatMember(chatId, senderID);
		return ['administrator', 'creator'].includes(member.status);
	} catch {
		return false;
	}
}

// Figure out the minimum role each handler on a command needs.
function getRoleConfig(command) {
	const typeMap = {
		developer: 2, premium: 1, anyone: 0,
		administrator: 0, admin: 0, private: 0, group: 0, hidden: 0,
	};
	const m = command.eren;
	if (typeof m?.role === 'number') {
		const base = m.role;
		return { onStart: base, onChat: base, onReply: base, onReaction: base, onCallback: base, onEvent: base };
	}
	if (typeof m?.role === 'object' && !Array.isArray(m?.role)) {
		const r = m.role;
		const out = {};
		for (const k of ['onStart', 'onChat', 'onReply', 'onReaction', 'onCallback', 'onEvent'])
			out[k] = r[k] ?? r.onStart ?? 0;
		return out;
	}
	const base = typeMap[m?.type] ?? 0;
	return { onStart: base, onChat: base, onReply: base, onReaction: base, onCallback: base, onEvent: base };
}

// Best display name we can build from a Telegram from-object.
function displayName(from = {}) {
	return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '';
}

// Short first name for greetings.
function greetName(from = {}) {
	return from.first_name || from.username || 'there';
}

// Distance between two strings. Used for "did you mean".
function levenshtein(a, b) {
	a = String(a || '').toLowerCase();
	b = String(b || '').toLowerCase();
	const m = a.length;
	const n = b.length;
	if (!m) return n;
	if (!n) return m;
	const dp = Array.from({ length: m + 1 }, function () { return Array(n + 1).fill(0); });
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
		}
	}
	return dp[m][n];
}

// Closest command or alias name for a typo.
function findSimilarCommand(input, commands) {
	const q = String(input || '').toLowerCase();
	if (!q) return null;

	const names = [];
	for (const cmd of commands.values()) {
		const name = cmd && cmd.eren && cmd.eren.name;
		if (name) names.push(String(name));
		const aliases = cmd && cmd.eren && cmd.eren.aliases;
		if (Array.isArray(aliases)) {
			for (let i = 0; i < aliases.length; i++) names.push(String(aliases[i]));
		}
	}

	let best = null;
	let bestScore = Infinity;
	for (let i = 0; i < names.length; i++) {
		const n = names[i];
		const low = n.toLowerCase();
		let score = levenshtein(q, low);
		if (low.startsWith(q) || q.startsWith(low)) score = Math.min(score, 1);
		if (score < bestScore) {
			bestScore = score;
			best = n;
		}
	}

	const maxDist = Math.max(2, Math.floor(q.length * 0.4));
	if (best && bestScore <= maxDist) return best;
	return null;
}

// Approve settings from json/config.json.
function approveConf() {
	return global.Sakura.config.approve || {};
}

// User was hard-blocked with /unapprove.
function isDeniedUser(user) {
	if (!user) return false;
	if (user.denied === true) return true;
	if (user.data && user.data.denied === true) return true;
	return false;
}

// Group was hard-blocked with /unapprove.
function isDeniedThread(thread) {
	if (!thread) return false;
	if (thread.denied === true) return true;
	if (thread.data && thread.data.denied === true) return true;
	return false;
}

// These names can still run while approve mode is waiting.
function isBypassCommand(name) {
	const allow = ['help', 'approve', 'unapprove', 'ban', 'unban', 'threadapprove', 'userapprove', 'threadban', 'adminonly', 'wl', 'whitelist', 'adboxonly', 'onlyadminbox'];
	return allow.includes(String(name || '').toLowerCase());
}

// Case-insensitive check against an ignore list.
function inIgnoreList(list, commandName) {
	if (!commandName) return false;
	return (list || []).map(function (x) { return String(x).toLowerCase(); }).includes(String(commandName).toLowerCase());
}

// Force every id to string so "123" and 123 match.
function asIdList(arr) {
	return (arr || []).map(String);
}

// Success / error reaction. Emoji comes from config.reaction.
async function reactResult(response, kind) {
	const reaction = (global.Sakura.config && global.Sakura.config.reaction) || {};
	if (reaction.enable === false) return;
	const emoji = kind === 'error'
		? (reaction.error || '🤔')
		: (reaction.success || '🔥');
	if (!emoji) return;
	try {
		await response.react(emoji);
	} catch (e) {}
}

// Load or refresh user + thread rows, and keep name/title in sync.
async function loadEntities(senderID, chatId, from, msg, isGroup) {
	const { usersData, threadsData } = global.Sakura;
	let userData = null;
	let threadData = null;

	if (usersData && senderID) {
		userData = await usersData.get(senderID, {
			name: displayName(from),
			username: from?.username || ''
		});
		const nextName = displayName(from);
		const patch = {};
		if (nextName && userData.name !== nextName) patch.name = nextName;
		if (from?.username && userData.username !== from.username) patch.username = from.username;
		if (Object.keys(patch).length) userData = await usersData.set(senderID, patch);
	}

	if (threadsData && chatId) {
		threadData = await threadsData.get(chatId, {
			title: msg?.chat?.title || (isGroup ? '' : 'Private'),
			type: msg?.chat?.type || (isGroup ? 'group' : 'private')
		});
		if (isGroup && msg?.chat?.title && threadData.title !== msg.chat.title) {
			threadData = await threadsData.set(chatId, { title: msg.chat.title, type: msg.chat.type });
		}
	}

	return { userData, threadData };
}

// adminOnly, whitelist, and per-group onlyAdminBox.
async function accessGate({ role, isGroup, response, userData, threadData, commandName, silent, bot, chatId, senderID }) {
	if (role >= 2) return { ok: true };

	async function say(text) {
		if (!silent && text) await response.reply(text);
	}

	const hide = (global.Sakura.config && global.Sakura.config.hideNotiMessage) || {};
	const adminOnly = (global.Sakura.config && global.Sakura.config.adminOnly) || {};
	const wlUser = (global.Sakura.config && global.Sakura.config.whiteListMode) || {};
	const wlThread = (global.Sakura.config && global.Sakura.config.whiteListModeThread) || {};

	if (adminOnly.enable && !isBotAdmin(senderID) && !inIgnoreList(adminOnly.ignoreCommand, commandName)) {
		if (!hide.adminOnly) await say(getLang('onlyAdminBot'));
		return { ok: false, reason: 'admin-only' };
	}

	const userMode = !!wlUser.enable;
	const threadMode = !!wlThread.enable;
	if (userMode || threadMode) {
		const userOk = !userMode || asIdList(wlUser.whiteListIds).includes(String(senderID));
		const threadOk = !threadMode || !isGroup || asIdList(wlThread.whiteListThreadIds).includes(String(chatId));
		const ignored = inIgnoreList(wlUser.ignoreCommand, commandName) || inIgnoreList(wlThread.ignoreCommand, commandName);
		let allowed = false;
		if (ignored) {
			allowed = true;
		} else if (userMode && threadMode) {
			allowed = userOk || threadOk;
		} else if (userMode) {
			allowed = userOk;
		} else {
			allowed = threadOk;
		}
		if (!allowed) {
			if (!hide.whiteList) {
				if (userMode && !userOk && !(threadMode && threadOk)) await say(getLang('whiteListUser'));
				else await say(getLang('whiteListThread'));
			}
			return { ok: false, reason: 'whitelist' };
		}
	}

	const settings = (threadData && threadData.settings) || {};
	if (isGroup && settings.onlyAdminBox === true && !inIgnoreList(settings.ignoreCommandOnlyAdminBox, commandName)) {
		const isChatAdmin = bot ? await isGroupAdmin(bot, chatId, senderID) : false;
		if (!isChatAdmin) {
			if (!hide.onlyAdminBox && !settings.hideNotiOnlyAdminBox) await say(getLang('onlyAdminBox'));
			return { ok: false, reason: 'only-admin-box' };
		}
	}

	return { ok: true };
}

// Ban / denied / pending first, then the access gates above.
async function gateMessage({ role, isGroup, response, userData, threadData, commandName, silent, bot, chatId, senderID }) {
	if (role >= 2) return { ok: true };

	async function say(text) {
		if (!silent) await response.reply(text);
	}

	if (userData && userData.banned && userData.banned.status) {
		await say(getLang('userBanned', { reason: userData.banned.reason || 'No reason' }));
		return { ok: false, reason: 'user-ban' };
	}

	if (isGroup && threadData && threadData.banned) {
		await say(getLang('threadBanned'));
		return { ok: false, reason: 'thread-ban' };
	}

	if (isDeniedUser(userData)) {
		await say(getLang('userDenied'));
		return { ok: false, reason: 'user-denied' };
	}

	if (isGroup && isDeniedThread(threadData)) {
		await say(getLang('threadDenied'));
		return { ok: false, reason: 'thread-denied' };
	}

	const ap = approveConf();
	if (ap.enable) {
		if (!(commandName && isBypassCommand(commandName) && role >= 2)) {
			if (ap.user && userData && !userData.approved) {
				await say(getLang('userPending'));
				return { ok: false, reason: 'user-pending' };
			}

			if (ap.thread && isGroup && threadData && !threadData.approved) {
				await say(getLang('threadPending'));
				return { ok: false, reason: 'thread-pending' };
			}
		}
	}

	return accessGate({
		role: role, isGroup: isGroup, response: response,
		userData: userData, threadData: threadData, commandName: commandName,
		silent: silent, bot: bot, chatId: chatId, senderID: senderID
	});
}

// Does this command expect a prefix for this user?
function shouldUsePrefix(commandName, cmd, role, globalUsePrefix) {
	if (role >= 2) return false;

	let cmdUsePrefix = null;
	if (cmd && cmd.eren && cmd.eren.usePrefix !== undefined) {
		cmdUsePrefix = cmd.eren.usePrefix;
	}

	if (cmdUsePrefix !== null) {
		return cmdUsePrefix;
	}

	return globalUsePrefix;
}

// Can they fire it with plain text, no prefix?
function canTriggerWithoutPrefix(commandName, cmd, role, globalUsePrefix) {
	if (role >= 2) return true;

	let cmdUsePrefix = null;
	if (cmd && cmd.eren && cmd.eren.usePrefix !== undefined) {
		cmdUsePrefix = cmd.eren.usePrefix;
	}

	if (cmdUsePrefix !== null) {
		if (cmdUsePrefix === 'both') return true;
		if (cmdUsePrefix === false) return true;
		return false;
	}

	if (globalUsePrefix === 'both') return true;
	if (globalUsePrefix === false) return true;
	return false;
}

// Paid commands. Premium and developers skip the cost.
async function checkCommandBalance({ commandName, cmd, senderID, usersData, response, prefix, role }) {
	if (role >= 1) return { hasBalance: true };

	const cost = cmd.eren?.balance || 0;
	if (cost <= 0) return { hasBalance: true };

	const user = await usersData.get(senderID);
	const currentBalance = user?.money || 0;

	if (currentBalance < cost) {
		await response.reply(getLang('insufficientBalance', {
			cost: cost,
			balance: currentBalance,
			currency: global.Sakura.config.currency || '💰',
			prefix: global.Sakura.config.prefix || '/'
		}));
		return { hasBalance: false };
	}

	return { hasBalance: true, cost: cost, currentBalance: currentBalance };
}

// Take the fee after the command actually ran.
async function deductCommandBalance({ senderID, usersData, cost }) {
	if (cost <= 0) return;

	const user = await usersData.get(senderID);
	const newBalance = (user?.money || 0) - cost;

	await usersData.set(senderID, { money: newBalance });
}

// Build every handler for one incoming Telegram update.
export default function createHandlerEvent(bot) {
	const processedCommands = new Set();

	return async function handleEvent(event) {
		const {
			commands, eventCommands,
			onReply: onReplyMap,
			onReaction: onReactionMap,
			onChat: onChatList,
			onEvent: onEventList,
			onAnyEvent: onAnyEventList,
			onFirstChat: onFirstChatList,
			firstChatSeen, config,
		} = global.Sakura;

		const allPrefixes = [config.prefix, ...(config.subprefix || [])];
		const globalUsePrefix = config.usePrefix !== undefined ? config.usePrefix : true;

		const msg = event.message || event.edited_message || event.callback_query?.message || event;
		const chatId = msg?.chat?.id ?? event?.chat?.id;
		if (!chatId) return;

		const _chatType = msg?.chat?.type ?? event?.chat?.type ?? 'private';
		if (_chatType !== 'private') {
			const _bots = global.Sakura?.bots ?? [];
			if (_bots.length > 1) {
				const _thisBotEntry = _bots.find(b => b.bot === bot);
				const _primaryIndex = Math.min(..._bots.map(b => b.index));

				if (_thisBotEntry && _thisBotEntry.index !== _primaryIndex) {
					const _evictKey = _thisBotEntry.index + ':' + chatId;
					const _evicted = global.Sakura.gcEvictedChats ?? (global.Sakura.gcEvictedChats = new Set());

					if (!_evicted.has(_evictKey)) {
						_evicted.add(_evictKey);
						const _primaryBot = _bots.find(b => b.index === _primaryIndex);
						const _primaryTag = _primaryBot?.username ? '@' + _primaryBot.username : 'the primary instance';
						const _leaveMsg = getLang('multiBotLeave', {
							bot: _thisBotEntry.username ?? 'this bot',
							primary: _primaryTag
						});
						try { await bot.sendMessage(chatId, _leaveMsg); } catch (e) {}
						try {
							await bot.leaveChat(chatId);
							global.Sakura?.log?.warn('[Multi-Bot] left group ' + chatId);
						} catch (e) {
							global.Sakura?.log?.error('[Multi-Bot] leave failed: ' + e.message);
						}
					}
					return;
				}
			}
		}

		const from = msg?.from || event?.from;
		const senderID = String(from?.id ?? '');
		const messageID = msg?.message_id;
		const body = msg?.text || msg?.caption || '';
		const isGroup = msg?.chat?.type !== 'private';
		const response = new Response(bot, msg);
		const role = getRole(senderID);
		const name = greetName(from);

		if (event.message) event.message.body = body;
		if (event.edited_message) event.edited_message.body = body;

		const loaded = await loadEntities(senderID, chatId, from, msg, isGroup);
		const userData = loaded.userData;
		const threadData = loaded.threadData;

		const usedPrefixEarly = allPrefixes.find(function (p) { return body && body.startsWith(p); });
		const isCommand = !!usedPrefixEarly;

		if (
			isCommand &&
			role < 2 &&
			senderID &&
			userData &&
			!userData.notified
		) {
			notifyNewUser(senderID, from, isGroup, msg && msg.chat).catch(function () {});
			if (global.Sakura.usersData) {
				userData.notified = true;
				global.Sakura.usersData.set(senderID, { notified: true }).catch(function () {});
			}
		}

		const api = global.Sakura.api;
		const usersData = global.Sakura.usersData;
		const threadsData = global.Sakura.threadsData;
		const globalData = global.Sakura.globalData;

		const base = {
			bot: bot, api: api, event: msg, body: body, response: response, role: role, config: config,
			senderID: senderID, chatId: chatId, messageID: messageID, isGroup: isGroup, from: from,
			usersData: usersData, threadsData: threadsData, globalData: globalData,
			userData: userData, threadData: threadData,
		};

		// Build the "how to use this command" reply.
		function createUsage(command) {
			return async function usage() {
				const m = command.eren || {};
				const guides = Array.isArray(m.guide) ? m.guide : [m.guide || ''];
				let text = getLang('usageTitle');
				for (let i = 0; i < guides.length; i++) {
					const g = guides[i];
					text += g ? config.prefix + m.name + ' ' + g + '\n' : config.prefix + m.name + '\n';
				}
				text += '\n' + (m.description || getLang('noDescription'));
				await response.reply(text);
			};
		}

		setTimeout(() => {
			processedCommands.clear();
		}, 100);

		// Runs on every update, command or not.
		async function onAnyEvent() {
			for (const name of (onAnyEventList || [])) {
				const cmd = commands.get(name);
				if (!cmd || !cmd.onAnyEvent) continue;
				try {
					const args = body ? body.split(/\s+/) : [];
					const fn = await cmd.onAnyEvent(Object.assign({}, base, { args: args, commandName: name, usage: createUsage(cmd) }));
					if (typeof fn === 'function') await fn();
				} catch (e) {
					console.error('[onAnyEvent:' + name + ']', e.message);
				}
			}
		}

		// First time this chat talks to the bot.
		async function onFirstChat() {
			for (const item of (onFirstChatList || [])) {
				const key = item.commandName + ':' + chatId;
				if (firstChatSeen.has(key)) continue;
				const cmd = commands.get(item.commandName);
				if (!cmd || !cmd.onFirstChat) continue;
				firstChatSeen.add(key);
				try {
					const args = body ? body.split(/\s+/) : [];
					const fn = await cmd.onFirstChat(Object.assign({}, base, { args: args, commandName: item.commandName, usage: createUsage(cmd) }));
					if (typeof fn === 'function') await fn();
				} catch (e) {
					console.error('[onFirstChat:' + item.commandName + ']', e.message);
				}
			}
		}

		// Normal messages. Also gives exp per message.
		async function onChat() {
			const gate = await gateMessage({
				role: role, isGroup: isGroup, response: response,
				userData: userData, threadData: threadData, silent: true,
				bot: bot, chatId: chatId, senderID: senderID
			});
			if (!gate.ok) return;

			if (usersData && senderID && config.economy && config.economy.expPerMessage) {
				usersData.addExp(senderID, config.economy.expPerMessage).catch(function () {});
				usersData.set(senderID, 'stats.messages', (userData && userData.stats && userData.stats.messages || 0) + 1).catch(function () {});
			}

			for (const name of (onChatList || [])) {
				const cmd = commands.get(name);
				if (!cmd || !cmd.onChat) continue;
				if (getRoleConfig(cmd).onChat > role) continue;
				try {
					const args = body ? body.split(/\s+/) : [];
					const fn = await cmd.onChat(Object.assign({}, base, { args: args, commandName: name, usage: createUsage(cmd) }));
					if (typeof fn === 'function') await fn();
				} catch (e) {
					console.error('[onChat:' + name + ']', e.message);
				}
			}
		}

		// Prefix / no-prefix command call.
		async function onStart() {
			if (!body) return;

			let usedPrefix = null;
			for (let i = 0; i < allPrefixes.length; i++) {
				if (body.startsWith(allPrefixes[i])) { usedPrefix = allPrefixes[i]; break; }
			}

			const trimmed = usedPrefix ? body.slice(usedPrefix.length).trim() : body.trim();
			if (!trimmed) {
				if (usedPrefix) {
					await response.reply(getLang('systemOnline', { name: name, prefix: usedPrefix }));
				}
				return;
			}

			const rawArgs = trimmed.split(/\s+/);
			let commandName = rawArgs.shift().toLowerCase();

			const botUsername = global.Sakura.botUsername;
			if (botUsername && commandName.indexOf('@') !== -1) {
				const parts = commandName.split('@');
				if (parts[1].toLowerCase() !== botUsername.toLowerCase()) {
					if (usedPrefix) return;
				}
				commandName = parts[0];
			}

			let cmd = commands.get(commandName);
			if (!cmd) {
				for (const c of commands.values()) {
					if (c.eren && c.eren.aliases && c.eren.aliases.indexOf(commandName) !== -1) { cmd = c; break; }
				}
			}

			if (!cmd) {
				if (usedPrefix && !(config.hideNotiMessage && config.hideNotiMessage.commandNotFound)) {
					const suggest = findSimilarCommand(commandName, commands);
					if (suggest) {
						await response.reply(getLang('commandNotFoundSuggest', {
							name: name,
							command: commandName,
							suggest: suggest,
							prefix: usedPrefix
						}));
					} else {
						await response.reply(getLang('commandNotFound', {
							name: name,
							command: commandName,
							prefix: usedPrefix
						}));
					}
				}
				return;
			}

			const requiresPrefix = shouldUsePrefix(commandName, cmd, role, globalUsePrefix);
			const canTriggerNoPrefix = canTriggerWithoutPrefix(commandName, cmd, role, globalUsePrefix);

			if (requiresPrefix && !usedPrefix) {
				return;
			}

			if (!usedPrefix && !canTriggerNoPrefix) {
				return;
			}

			commandName = cmd.eren.name;

			const executionKey = commandName + ':' + senderID + ':' + messageID;

			if (processedCommands.has(executionKey)) {
				return;
			}

			processedCommands.add(executionKey);

			const rc = getRoleConfig(cmd);
			const cmdType = String(cmd.eren && cmd.eren.type || 'anyone').toLowerCase();

			const gate = await gateMessage({
				role: role, isGroup: isGroup, response: response,
				userData: userData, threadData: threadData, commandName: commandName, silent: false,
				bot: bot, chatId: chatId, senderID: senderID
			});
			if (!gate.ok) return;

			if (rc.onStart > role) {
				if (!(config.hideNotiMessage && config.hideNotiMessage.needRoleToUseCmd))
					await response.reply(getLang(rc.onStart === 2 ? 'restrictedDeveloper' : 'restrictedPremium', { command: commandName }));
				return;
			}

			if (cmdType === 'private' && isGroup) {
				await response.reply(getLang('privateOnly', { command: commandName }));
				return;
			}
			if (cmdType === 'group' && !isGroup) {
				await response.reply(getLang('groupOnly', { command: commandName }));
				return;
			}
			if (cmdType === 'administrator' || cmdType === 'admin') {
				if (role < 2) {
					if (!isGroup) {
						await response.reply(getLang('adminOnly', { command: commandName }));
						return;
					}
					const isChatAdmin = await isGroupAdmin(bot, chatId, senderID);
					if (!isChatAdmin) {
						await response.reply(getLang('adminOnly', { command: commandName }));
						return;
					}
				}
			}

			const cat = String(cmd.eren && cmd.eren.category || '').toLowerCase();
			if (isGroup && threadData && threadData.settings && threadData.settings.games === false && cat === 'game') {
				await response.reply(getLang('gamesDisabled'));
				return;
			}
			if (isGroup && threadData && threadData.settings && threadData.settings.economy === false && cat === 'economy') {
				await response.reply(getLang('economyDisabled'));
				return;
			}

			const coolKey = commandName + ':' + senderID;
			const cooldown = ((cmd.eren && cmd.eren.cooldown) || 1) * 1000;
			const now = Date.now();

			if (role < 1) {
				const lastUsed = global.Sakura.cooldowns.get(coolKey) || 0;
				if (now - lastUsed < cooldown) {
					const left = ((cooldown - (now - lastUsed)) / 1000).toFixed(1);
					await response.reply(getLang('cooldown', { seconds: left, command: commandName }));
					return;
				}
			}

			const balanceCheck = await checkCommandBalance({
				commandName: commandName,
				cmd: cmd,
				senderID: senderID,
				usersData: usersData,
				response: response,
				prefix: usedPrefix || global.Sakura.config.prefix,
				role: role
			});

			if (!balanceCheck.hasBalance) {
				return;
			}

			const commandCost = balanceCheck.cost || 0;

			if (typeof cmd.onStart !== 'function') return;

			try {
				await cmd.onStart(Object.assign({}, base, { args: rawArgs, commandName: commandName, usedPrefix: usedPrefix, usage: createUsage(cmd) }));
				await reactResult(response, 'success');
				global.Sakura.cooldowns.set(coolKey, now);
				global.Sakura.log.commands(commandName + ' | ' + ((from && from.username) || senderID) + ' | ' + chatId);

				if (commandCost > 0) {
					try {
						await deductCommandBalance({
							senderID: senderID,
							usersData: usersData,
							cost: commandCost
						});
					} catch (e) {
						console.error('[Balance Deduction] Error:', e.message);
					}
				}

				if (usersData && senderID) {
					const exp = (config.economy && config.economy.expPerCommand) || 5;
					usersData.addExp(senderID, exp).catch(function () {});
					usersData.set(senderID, 'stats.commands', (userData && userData.stats && userData.stats.commands || 0) + 1).catch(function () {});
				}
			} catch (e) {
				console.error('[onStart:' + commandName + ']', e);
				await reactResult(response, 'error');
				await response.reply(getLang('commandError', { command: commandName, error: e.message }));
			}
		}

		// Reply to a bot message that stored onReply data.
		async function onReply() {
			if (!msg || !msg.reply_to_message) return;
			const replyToID = msg.reply_to_message.message_id;
			const data = onReplyMap.get(replyToID);
			if (!data) return;
			const cmd = commands.get(data.commandName);
			if (!cmd || !cmd.onReply) return;
			if (getRoleConfig(cmd).onReply > role) return;

			const gate = await gateMessage({
				role: role, isGroup: isGroup, response: response,
				userData: userData, threadData: threadData, commandName: data.commandName, silent: false,
				bot: bot, chatId: chatId, senderID: senderID
			});
			if (!gate.ok) return;

			try {
				const args = body ? body.split(/\s+/) : [];
				await cmd.onReply(Object.assign({}, base, {
					args: args,
					commandName: data.commandName,
					Reply: Object.assign({}, data, { delete: function () { onReplyMap.delete(replyToID); } }),
					usage: createUsage(cmd),
				}));
				await reactResult(response, 'success');
			} catch (e) {
				console.error('[onReply:' + data.commandName + ']', e.message);
				await reactResult(response, 'error');
				await response.reply(getLang('replyError', { error: e.message }));
			}
		}

		// Stored reaction listener on this message.
		async function onReaction() {
			const data = onReactionMap.get(messageID);
			if (!data) return;
			const cmd = commands.get(data.commandName);
			if (!cmd || !cmd.onReaction) return;
			try {
				await cmd.onReaction(Object.assign({}, base, {
					commandName: data.commandName,
					Reaction: Object.assign({}, data, { delete: function () { onReactionMap.delete(messageID); } }),
					usage: createUsage(cmd),
				}));
			} catch (e) {
				console.error('[onReaction:' + data.commandName + ']', e.message);
			}
		}

		// Inline button presses.
		async function onCallback() {
			const cbq = event.callback_query;
			if (!cbq) return;
			const rawData = cbq.data;
			if (!rawData) { await response.answerCallback(cbq, { text: getLang('invalidCallback') }); return; }

			let payload;
			try { payload = JSON.parse(rawData); }
			catch (e) {
				const parts = rawData.split(':');
				payload = parts.length ? { command: parts[0], args: parts.slice(1) } : null;
			}

			if (!payload || !payload.command) { await response.answerCallback(cbq, { text: getLang('invalidCallbackFormat') }); return; }

			const cmd = commands.get(payload.command);
			if (!cmd || !cmd.onCallback) { await response.answerCallback(cbq, { text: getLang('callbackCommandNotFound'), show_alert: true }); return; }

			const cbRole = getRole(cbq.from && cbq.from.id);
			const cbSender = String((cbq.from && cbq.from.id) || '');

			if (getRoleConfig(cmd).onCallback > cbRole) {
				await response.answerCallback(cbq, { text: getLang('callbackPermissionDenied'), show_alert: true });
				return;
			}

			if (usersData && cbSender && cbRole < 2) {
				const u = await usersData.get(cbSender);
				if (u && u.banned && u.banned.status) {
					await response.answerCallback(cbq, { text: getLang('callbackBanned'), show_alert: true });
					return;
				}
				if (isDeniedUser(u)) {
					await response.answerCallback(cbq, { text: getLang('callbackUnapproved'), show_alert: true });
					return;
				}

				const adminOnly = config.adminOnly || {};
				if (adminOnly.enable && !isBotAdmin(cbSender) && !inIgnoreList(adminOnly.ignoreCommand, payload.command)) {
					await response.answerCallback(cbq, { text: getLang('onlyAdminBot'), show_alert: true });
					return;
				}

				const wlUser = config.whiteListMode || {};
				const wlThread = config.whiteListModeThread || {};
				if (wlUser.enable || wlThread.enable) {
					const userOk = !wlUser.enable || asIdList(wlUser.whiteListIds).includes(cbSender);
					const threadOk = !wlThread.enable || !isGroup || asIdList(wlThread.whiteListThreadIds).includes(String(chatId));
					let allowed = false;
					if (wlUser.enable && wlThread.enable) allowed = userOk || threadOk;
					else if (wlUser.enable) allowed = userOk;
					else allowed = threadOk;
					if (!allowed) {
						await response.answerCallback(cbq, { text: getLang(userOk ? 'whiteListThread' : 'whiteListUser'), show_alert: true });
						return;
					}
				}
			}

			const cbMsg = cbq.message || msg;
			const cbResponse = new Response(bot, cbMsg);

			try {
				await cmd.onCallback({
					bot: bot, api: api,
					callbackQuery: cbq,
					event: cbq,
					response: cbResponse,
					chatId: cbMsg && cbMsg.chat && cbMsg.chat.id,
					messageId: cbMsg && cbMsg.message_id,
					senderID: cbSender,
					from: cbq.from,
					args: payload.args || [],
					payload: payload,
					role: cbRole,
					config: config,
					usersData: usersData, threadsData: threadsData, globalData: globalData,
					usage: createUsage(cmd),
				});
				await cbResponse.answerCallback(cbq).catch(function () {});
			} catch (e) {
				console.error('[onCallback:' + payload.command + ']', e.message);
				await cbResponse.answerCallback(cbq, { text: getLang('callbackError'), show_alert: true }).catch(function () {});
			}
		}

		// Join / leave / pin style chat events.
		async function onEvent() {
			for (const name of (onEventList || [])) {
				const cmd = commands.get(name) || eventCommands.get(name);
				if (!cmd || !cmd.onEvent) continue;
				try {
					const fn = await cmd.onEvent(Object.assign({}, base, { commandName: name, args: [], usage: createUsage(cmd) }));
					if (typeof fn === 'function') await fn();
				} catch (e) {
					console.error('[onEvent:' + name + ']', e.message);
				}
			}
		}

		return { onAnyEvent: onAnyEvent, onFirstChat: onFirstChat, onChat: onChat, onStart: onStart, onReply: onReply, onReaction: onReaction, onCallback: onCallback, onEvent: onEvent };
	};
}
