import axios from 'axios';

export const eren = {
  name: 'profile',
  aliases: ['pp', 'pfp'],
  version: '1.0.0',
  author: 'S4Eren',
  description: 'Show profile photo of you, a replied user, or a UID.',
  category: 'image',
  type: 'anyone',
  cooldown: 5,
  usePrefix: 'both',
  guide: ['', '@user', 'uid', '(reply)']
};

function extractMention(event) {
  if (!event) return null;
  
  const text = event.text || event.caption || '';
  const entities = event.entities || event.caption_entities || [];
  
  for (const entity of entities) {
    if (entity.type === 'text_mention' && entity.user) {
      return {
        type: 'id',
        value: String(entity.user.id),
        username: entity.user.username || null
      };
    }
  }
  
  for (const entity of entities) {
    if (entity.type === 'mention') {
      const username = text.slice(entity.offset, entity.offset + entity.length);
      return {
        type: 'username',
        value: username,
        username: username.replace('@', '')
      };
    }
  }
  
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.startsWith('@') && word.length > 1) {
      return {
        type: 'username',
        value: word,
        username: word.replace('@', '')
      };
    }
  }
  
  return null;
}

async function resolveTarget({ event, args, senderID, bot }) {
  if (event?.reply_to_message?.from?.id) {
    return String(event.reply_to_message.from.id);
  }
  
  if (event?.reply_to?.from?.id) {
    return String(event.reply_to.from.id);
  }
  
  const mention = extractMention(event);
  if (mention) {
    if (mention.type === 'id') {
      return mention.value;
    }
    
    if (mention.type === 'username') {
      try {
        const chat = await bot.getChat(mention.value);
        if (chat?.id) {
          return String(chat.id);
        }
      } catch (e) {
        try {
          const chatId = event.chat?.id || event.chat_id;
          if (chatId) {
            const member = await bot.getChatMember(chatId, mention.username);
            if (member?.user?.id) {
              return String(member.user.id);
            }
          }
        } catch (e2) {
          console.log('Username resolve failed:', e2.message);
        }
      }
      
      return mention.value;
    }
  }
  
  if (args && args.length > 0) {
    const arg = String(args[0]).trim();
    
    if (/^-?\d+$/.test(arg)) {
      return arg;
    }
    
    if (arg.startsWith('@')) {
      try {
        const chat = await bot.getChat(arg);
        if (chat?.id) {
          return String(chat.id);
        }
      } catch (e) {}
      
      try {
        const username = arg.replace('@', '');
        const chatId = event.chat?.id || event.chat_id;
        if (chatId) {
          const member = await bot.getChatMember(chatId, username);
          if (member?.user?.id) {
            return String(member.user.id);
          }
        }
      } catch (e) {}
      
      return arg;
    }
  }
  
  return String(senderID);
}

async function getDisplayName(usersData, bot, id) {
  try {
    if (usersData && typeof usersData.get === 'function') {
      const user = await usersData.get(id);
      if (user) {
        if (user.name) return user.name;
        if (user.username) return '@' + user.username;
        if (user.first_name) {
          return user.first_name + (user.last_name ? ' ' + user.last_name : '');
        }
      }
    }
  } catch (e) {}
  
  try {
    const chat = await bot.getChat(id);
    if (chat) {
      let name = '';
      if (chat.first_name) name += chat.first_name;
      if (chat.last_name) name += ' ' + chat.last_name;
      if (name.trim()) return name.trim();
      if (chat.username) return '@' + chat.username;
      if (chat.title) return chat.title;
    }
  } catch (e) {}
  
  return 'User (' + id + ')';
}

async function getProfilePhoto(bot, targetID) {
  try {
    const photos = await bot.getUserProfilePhotos(targetID, { limit: 1 });
    if (photos?.total_count > 0 && photos?.photos?.[0]?.length > 0) {
      const sizes = photos.photos[0];
      return sizes[sizes.length - 1];
    }
    return null;
  } catch (e) {
    console.log('getUserProfilePhotos error:', e.message);
    return null;
  }
}

export async function onStart({ 
  event, 
  args, 
  response, 
  bot, 
  senderID, 
  usersData,
  chatId 
}) {
  try {
    const targetID = await resolveTarget({ 
      event, 
      args, 
      senderID, 
      bot 
    });
    
    const name = await getDisplayName(usersData, bot, targetID);
    const photo = await getProfilePhoto(bot, targetID);
    
    if (!photo) {
      const msg = `❌ No profile photo found for ${name}\n📌 ID: ${targetID}`;
      return response.reply(msg);
    }
    
    const caption = `📸 Profile photo of ${name}\n🆔 ID: ${targetID}`;
    
    if (typeof response.upload === 'function') {
      return response.upload('photo', photo.file_id, { caption });
    }
    
    const chat = chatId || event.chat?.id || event.chat_id;
    if (chat) {
      return bot.sendPhoto(chat, photo.file_id, { caption });
    }
    
    return response.reply(caption);
    
  } catch (err) {
    console.error('[profile] Error:', err);
    
    let errorMsg = '❌ Could not fetch profile photo.';
    if (err.message) {
      if (err.message.includes('USER_ID_INVALID')) {
        errorMsg += '\nInvalid user ID or username.';
      } else if (err.message.includes('PHOTO_HIDDEN')) {
        errorMsg += '\nUser has hidden their profile photo.';
      } else {
        errorMsg += `\nError: ${err.message}`;
      }
    }
    
    return response.reply(errorMsg);
  }
}

export async function onError({ error, response }) {
  console.error('[profile] Fatal error:', error);
  return response.reply('⚠️ An error occurred while fetching profile photo.');
}
