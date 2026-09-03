export const eren = {
  name: 'daily',
  version: '1.0.0',
  aliases: ['claim'],
  description: 'Claim your daily reward.',
  author: 'S4Eren',
  usePrefix: 'both',
  category: 'economy',
  type: 'anyone',
  cooldown: 3,
  guide: []
};

export async function onStart({ senderID, usersData, response, config }) {
  const user = await usersData.get(senderID);
  const now = Date.now();
  const wait = 24 * 60 * 60 * 1000;

  if (user.daily && now - user.daily < wait) {
    const left = wait - (now - user.daily);
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    return response.reply(`⏳ Daily reward already claimed.\nCome back in **${h}h ${m}m**.`);
  }

  const amount = Number(config.economy?.daily || 500);
  await usersData.addMoney(senderID, amount);
  await usersData.set(senderID, { daily: now });
  const fresh = await usersData.get(senderID);

  return response.reply(
    `🎁 Daily reward claimed: **+${amount}**\n💰 Balance: **${fresh.money}**`
  );
  }
