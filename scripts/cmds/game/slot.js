export const eren = {
  name: 'slot',
  version: '1.0.0',
  aliases: ['slots', 'spin'],
  description: 'Place your bet, spin the reels, and see how much you can win.',
  author: 'S4Eren',
  category: 'game',
  type: 'anyone',
  cooldown: 5,
  usePrefix: 'both',
  balance: 0,
  guide: ['<amount>', '1000']
};

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];

function pickReplyId(ctx) {
  if (!ctx) return null;
  return (
    (ctx.message && (ctx.message.message_id || ctx.message.id)) ||
    ctx.messageID ||
    ctx.msgID ||
    (ctx.event && (ctx.event.messageID || ctx.event.message_id)) ||
    null
  );
}

function cmdPrefix(ctx) {
  const body =
    (ctx && ctx.event && ctx.event.body) ||
    (ctx && ctx.message && ctx.message.text) ||
    '';
  return body[0] || '/';
}

function randSym() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function wait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function frameText(step, status, balance) {
  return (
    '━━━━━━━━━━━━━━\n' +
    '🎰 SLOT MACHINE\n' +
    '╭─╼━━━━━━━━━━╾─╮\n' +
    '│     ' + step[0] + ' | ' + step[1] + ' | ' + step[2] + '\n' +
    '│\n' +
    '│  ' + status + '\n' +
    '╰─╼━━━━━━━━━━╾─╯\n' +
    '💰 BALANCE: ' + balance + '$\n' +
    '━━━━━━━━━━━━━━'
  );
}

async function editOrSend(bot, chatId, msgId, text, replyTo) {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId
    });
    return msgId;
  } catch (e1) {
    try {
      await bot.editMessage(text, msgId, chatId);
      return msgId;
    } catch (e2) {
      try { await bot.deleteMessage(chatId, msgId); } catch (e3) {}
      const msg = await bot.sendMessage(chatId, text, {
        reply_to_message_id: replyTo,
        allow_sending_without_reply: true
      });
      return msg && msg.message_id;
    }
  }
}

export async function onStart(ctx) {
  const { args, senderID, bot, chatId, usersData } = ctx;
  const userId = String(senderID);
  const bet = parseInt(args && args[0], 10);
  const prefix = cmdPrefix(ctx);
  const replyTo = pickReplyId(ctx);

  let user = await usersData.get(userId);
  if (!user) {
    user = { money: 1000 };
    await usersData.set(userId, user);
  }

  if (!bet || bet <= 0) {
    return bot.sendMessage(
      chatId,
      '❌ ENTER A VALID BET.\nEXAMPLE: ' + prefix + 'slot 1000',
      { reply_to_message_id: replyTo, allow_sending_without_reply: true }
    );
  }

  if ((user.money || 0) < bet) {
    return bot.sendMessage(
      chatId,
      '❌ NOT ENOUGH BALANCE.\nBALANCE: ' + (user.money || 0) + '$',
      { reply_to_message_id: replyTo, allow_sending_without_reply: true }
    );
  }

  user.money -= bet;

  const first = await bot.sendMessage(
    chatId,
    '🎰 SLOT MACHINE\nSpinning... 🍒🍋🔔',
    { reply_to_message_id: replyTo, allow_sending_without_reply: true }
  );
  let msgId = first && first.message_id;

  const spinSteps = [
    [randSym(), randSym(), randSym()],
    [randSym(), randSym(), randSym()]
  ];

  for (let i = 0; i < spinSteps.length; i++) {
    await wait(800);
    msgId = await editOrSend(
      bot,
      chatId,
      msgId,
      frameText(spinSteps[i], '🔄 SPINNING...', user.money),
      replyTo
    );
  }

  const chance = Math.random() * 100;
  let s1, s2, s3;

  if (chance < 30) {
    s1 = s2 = randSym();
    s3 = randSym();
    while (s3 === s1) s3 = randSym();
  } else if (chance < 40) {
    s1 = s2 = s3 = randSym();
  } else {
    do {
      s1 = randSym();
      s2 = randSym();
      s3 = randSym();
    } while (s1 === s2 || s1 === s3 || s2 === s3);
  }

  let winnings = 0;
  let status = '';

  if (s1 === s2 && s2 === s3) {
    if (s1 === '💎') {
      winnings = bet * 50;
    } else if (s1 === '7️⃣') {
      winnings = bet * 30;
    } else if (s1 === '⭐') {
      winnings = bet * 15;
    } else if (s1 === '🔔') {
      winnings = bet * 10;
    } else {
      winnings = bet * 5;
    }
    user.money += winnings;
    status = '🎰 JACKPOT!\n│  YOU WON ' + winnings + '$';
  } else if (s1 === s2 || s1 === s3 || s2 === s3) {
    winnings = Math.floor(bet * 1.5);
    user.money += winnings;
    status = '✅ DOUBLE MATCH!\n│  YOU WON ' + winnings + '$';
  } else {
    status = '😢 NO MATCH.\n│  YOU LOST ' + bet + '$';
  }

  await usersData.set(userId, user);

  const finalStep = [s1, s2, s3];
  await wait(800);
  msgId = await editOrSend(
    bot,
    chatId,
    msgId,
    frameText(finalStep, status, user.money),
    replyTo
  );
}
