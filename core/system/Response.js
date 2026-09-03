export class Response {
  constructor(bot, msg) {
    this.bot    = bot;
    this.msg    = msg;
    this.chatId = msg?.chat?.id ?? msg?.message?.chat?.id ?? null;
    this._msgId = msg?.message_id ?? msg?.message?.message_id ?? null;
    this._isGrp = msg?.chat?.type !== 'private';
  }

  // **bold** → Telegram Markdown *bold*.
  _text(t) {
    if (typeof t !== 'string') return String(t ?? '');
    return t.replace(/\*\*(.*?)\*\*/g, '*$1*');
  }

  // Default parse_mode to Markdown unless the caller set one.
  _mode(o = {}) {
    const f = { ...o };
    if (!f.parse_mode) f.parse_mode = 'Markdown';
    return f;
  }

  // Strip helper flags that Telegram does not understand.
  _final(o = {}) {
    const f = this._mode(o);
    delete f.noReply;
    return f;
  }

  // In groups, reply to the trigger message unless noReply is set.
  _opts(o = {}) {
    const f = this._final(o);
    if (this._isGrp && !o.noReply && !('reply_to_message_id' in o) && this._msgId)
      f.reply_to_message_id = this._msgId;
    return f;
  }

  // Turn a number / object / empty target into chat_id + message_id.
  _resolve(target) {
    if (!target)                      return { chat_id: this.chatId, message_id: undefined };
    if (typeof target === 'number')   return { chat_id: this.chatId, message_id: target };
    if (typeof target === 'object') {
      if (typeof target.message_id === 'number') return { chat_id: target.chat?.id ?? this.chatId, message_id: target.message_id };
      if (typeof target.messageId  === 'number') return { chat_id: target.chatId  ?? this.chatId, message_id: target.messageId };
      if (target.chat_id  !== undefined && target.message_id !== undefined) return { chat_id: target.chat_id,  message_id: target.message_id };
      if (target.chatId   !== undefined && target.messageId  !== undefined) return { chat_id: target.chatId,   message_id: target.messageId };
    }
    return { chat_id: this.chatId, message_id: undefined };
  }

  send(text, opts = {})   { return this.bot.sendMessage(this.chatId, this._text(text), this._final(opts)); }
  reply(text, opts = {})  { return this.bot.sendMessage(this.chatId, this._text(text), this._opts(opts)); }
  sendTo(id, text, opts = {}) { return this.bot.sendMessage(id, this._text(text), this._final(opts)); }

  // Photo, video, file, album, etc.
  upload(type, content, opts = {}) {
    const o = this._opts(opts);
    const cap = o => { if (o.caption) o.caption = this._text(o.caption); return o; };
    switch (type.toLowerCase()) {
      case 'photo':      return this.bot.sendPhoto(this.chatId, content, cap(o));
      case 'audio':      return this.bot.sendAudio(this.chatId, content, cap(o));
      case 'document':   return this.bot.sendDocument(this.chatId, content, cap(o));
      case 'sticker':    return this.bot.sendSticker(this.chatId, content, o);
      case 'video':      return this.bot.sendVideo(this.chatId, content, cap(o));
      case 'animation':  return this.bot.sendAnimation(this.chatId, content, cap(o));
      case 'voice':      return this.bot.sendVoice(this.chatId, content, cap(o));
      case 'video_note': return this.bot.sendVideoNote(this.chatId, content, o);
      case 'media_group': {
        const media = content.map(m => ({ ...m, caption: m.caption ? this._text(m.caption) : m.caption }));
        return this.bot.sendMediaGroup(this.chatId, media, o);
      }
      default: throw new Error(`Unknown upload type: ${type}`);
    }
  }

  location(lat, lng, opts = {})                         { return this.bot.sendLocation(this.chatId, lat, lng, this._opts(opts)); }
  venue(lat, lng, title, addr, opts = {})               { return this.bot.sendVenue(this.chatId, lat, lng, title, addr, this._opts(opts)); }
  contact(phone, firstName, opts = {})                  { return this.bot.sendContact(this.chatId, phone, firstName, this._opts(opts)); }
  poll(question, options, opts = {})                    { return this.bot.sendPoll(this.chatId, this._text(question), options, this._opts(opts)); }
  dice(opts = {})                                       { return this.bot.sendDice(this.chatId, this._opts(opts)); }
  action(act = 'typing')                                { return this.bot.sendChatAction(this.chatId, act); }
  removeListener(event, fn)                             { return this.bot.removeListener(event, fn); }

  // Edit text, caption, media, or inline buttons on an existing message.
  edit(type, target, content, opts = {}) {
    const ids = this._resolve(target);
    switch (type.toLowerCase()) {
      case 'text': {
        const o = { ...this._final(opts), chat_id: ids.chat_id, message_id: ids.message_id };
        return this.bot.editMessageText(this._text(content), o);
      }
      case 'caption': {
        const o = { ...this._final(opts), chat_id: ids.chat_id, message_id: ids.message_id };
        return this.bot.editMessageCaption(this._text(content), o);
      }
      case 'media': {
        const o = { ...this._final(opts), chat_id: ids.chat_id, message_id: ids.message_id };
        const m = content.caption ? { ...content, caption: this._text(content.caption) } : content;
        return this.bot.editMessageMedia(m, o);
      }
      case 'markup': {
        const o = { ...opts, chat_id: ids.chat_id, message_id: ids.message_id };
        delete o.noReply;
        return this.bot.editMessageReplyMarkup(content, o);
      }
      default: throw new Error(`Unknown edit type: ${type}`);
    }
  }

  delete(target) {
    const ids = this._resolve(target);
    return this.bot.deleteMessage(ids.chat_id, ids.message_id);
  }

  answerCallback(cbQuery, opts = {}) {
    const id = typeof cbQuery === 'string' ? cbQuery : cbQuery?.id;
    if (!id) throw new Error('Invalid callback query: missing id');
    return this.bot.answerCallbackQuery(id, opts);
  }

  // Send the same text to every ID in config.devID.
  forDev(text, opts = {}) {
    const devs = global.Sakura?.config?.devID || [];
    const o = this._final(opts);
    const t = this._text(text);
    return Promise.all(devs.map(id => this.bot.sendMessage(id, t, o)));
  }

  // Emoji on a message. Fails quietly if Telegram rejects it.
  react(emoji, target = null) {
    const chatId = this.chatId;
    const msgId  = target != null
      ? (typeof target === 'number' ? target
          : target.message_id ?? target.messageId ?? null)
      : this._msgId;
    if (!chatId || !msgId) return Promise.resolve();
    const reaction = emoji ? JSON.stringify([{ type: 'emoji', emoji }]) : JSON.stringify([]);
    return this.bot.setMessageReaction(chatId, msgId, { reaction, is_big: false })
      .catch(() => {});
  }

  // Replace a loading message with the final text.
  update(target, text, opts = {}) {
    const ids = this._resolve(target);
    const o   = { ...this._final(opts), chat_id: ids.chat_id, message_id: ids.message_id };
    return this.bot.editMessageText(this._text(text), o);
  }

  static buildInlineKeyboard(rows) {
    return {
      inline_keyboard: rows.map(row =>
        row.map(btn => ({
          text: btn.text,
          ...(btn.url
            ? { url: btn.url }
            : { callback_data: typeof btn.data === 'object' ? JSON.stringify(btn.data) : String(btn.data) }
          )
        }))
      )
    };
  }
}
