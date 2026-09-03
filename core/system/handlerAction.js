import createHandlerEvent from './handlerEvent.js';

// Emoji used to unsend. Comes from config.unsendEmoji or reaction.unsend.
function getUnsendEmoji() {
	const config = (global.Sakura && global.Sakura.config) || {};
	const fromReaction = config.reaction && config.reaction.unsend;
	const emoji = config.unsendEmoji || fromReaction || '';
	return String(emoji || '').trim();
}

// True when this user is in config.devID.
function isDev(userId) {
	const devID = (global.Sakura && global.Sakura.config && global.Sakura.config.devID) || [];
	return devID.map(String).includes(String(userId || ''));
}

// Pull every emoji string out of a Telegram reaction list.
function reactionEmojis(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	for (let i = 0; i < list.length; i++) {
		const item = list[i] || {};
		if (item.emoji) out.push(String(item.emoji));
		else if (item.type === 'emoji' && item.emoji) out.push(String(item.emoji));
	}
	return out;
}

// Dev reacted with the unsend emoji → delete that message.
async function handleDevUnsend(bot, update) {
	const rxn = update && (update.message_reaction || update.message_reaction_count);
	if (!rxn || !update.message_reaction) return;

	const unsendEmoji = getUnsendEmoji();
	if (!unsendEmoji) return;

	const user = update.message_reaction.user;
	if (!user || !isDev(user.id)) return;

	const added = reactionEmojis(update.message_reaction.new_reaction);
	const removed = reactionEmojis(update.message_reaction.old_reaction);
	if (!added.includes(unsendEmoji) || removed.includes(unsendEmoji)) return;

	const chatId = update.message_reaction.chat && update.message_reaction.chat.id;
	const messageId = update.message_reaction.message_id;
	if (!chatId || !messageId) return;

	try {
		await bot.deleteMessage(chatId, messageId);
	} catch (e) {}
}

// Route one Telegram update to the right handler.
export default function createHandlerAction(bot) {
	const handleEvent = createHandlerEvent(bot);

	return async function handlerAction(update) {
		try {
			const handlers = await handleEvent(update);
			if (!handlers) return;

			const {
				onAnyEvent, onFirstChat, onChat,
				onStart, onReply, onEvent, onReaction, onCallback,
			} = handlers;

			await onAnyEvent();

			if (update.message || update.edited_message) {
				const msg = update.message || update.edited_message;

				const isChatEvent =
					msg.new_chat_members   || msg.left_chat_member    ||
					msg.new_chat_title     || msg.new_chat_photo      ||
					msg.delete_chat_photo  || msg.group_chat_created  ||
					msg.supergroup_chat_created || msg.channel_chat_created ||
					msg.migrate_to_chat_id || msg.migrate_from_chat_id || msg.pinned_message;

				if (isChatEvent) {
					await onEvent();
					return;
				}

				await onFirstChat();
				await onChat();
				await onStart();
				await onReply();

			} else if (update.callback_query) {
				await onCallback();

			} else if (update.message_reaction || update.message_reaction_count) {
				await handleDevUnsend(bot, update);
				await onReaction();
			}

		} catch (e) {
			console.error('[handlerAction]', e.message);
		}
	};
}
