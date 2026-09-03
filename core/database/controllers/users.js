function defaultUser(id, extra) {
  return {
    userID: String(id),
    name: extra && extra.name ? extra.name : '',
    username: extra && extra.username ? extra.username : '',
    money: 0,
    exp: 0,
    level: 1,
    daily: 0,
    work: 0,
    banned: {
      status: false,
      reason: '',
      date: 0,
      by: ''
    },
    approved: false,
    stats: {
      messages: 0,
      commands: 0,
      wins: 0,
      loses: 0
    },
    data: {}
  };
}

function calcLevel(exp) {
  return Math.floor(Math.sqrt(Math.max(0, exp) / 100)) + 1;
}

function setPath(obj, path, value) {
  const keys = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

export function createUsersController(adapter) {
  return {
    async get(id, extra) {
      const key = String(id);
      let user = await adapter.get('users', key);
      if (!user) {
        user = defaultUser(key, extra);
        await adapter.set('users', key, user);
      }
      return user;
    },

    async getAll() {
      return adapter.all('users');
    },

    async set(id, a, b) {
      const user = await this.get(id);
      if (typeof a === 'string') setPath(user, a, b);
      else Object.assign(user, a || {});
      user.level = calcLevel(user.exp || 0);
      return adapter.set('users', String(id), user);
    },

    async addMoney(id, amount) {
      const user = await this.get(id);
      user.money = Math.max(0, (user.money || 0) + Number(amount || 0));
      return adapter.set('users', String(id), user);
    },

    async subtractMoney(id, amount) {
      return this.addMoney(id, -Math.abs(Number(amount || 0)));
    },

    async addExp(id, amount) {
      const user = await this.get(id);
      user.exp = Math.max(0, (user.exp || 0) + Number(amount || 0));
      user.level = calcLevel(user.exp);
      return adapter.set('users', String(id), user);
    },

    async ban(id, reason, by) {
      return this.set(id, {
        banned: {
          status: true,
          reason: reason || 'No reason',
          date: Date.now(),
          by: String(by || '')
        }
      });
    },

    async unban(id) {
      return this.set(id, {
        banned: { status: false, reason: '', date: 0, by: '' }
      });
    },

    async approve(id, state) {
      return this.set(id, { approved: state !== false });
    },

    async isBanned(id) {
      const user = await this.get(id);
      return !!(user.banned && user.banned.status);
    }
  };
}
