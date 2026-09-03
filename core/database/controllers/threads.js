function defaultThread(id, extra) {
  return {
    threadID: String(id),
    title: extra && extra.title ? extra.title : '',
    type: extra && extra.type ? extra.type : 'private',
    approved: false,
    banned: false,
    settings: {
      prefix: null,
      economy: true,
      games: true,
      antiSpam: false
    },
    data: {}
  };
}

export function createThreadsController(adapter) {
  return {
    async get(id, extra) {
      const key = String(id);
      let thread = await adapter.get('threads', key);
      if (!thread) {
        thread = defaultThread(key, extra);
        await adapter.set('threads', key, thread);
      }
      return thread;
    },

    async getAll() {
      return adapter.all('threads');
    },

    async set(id, data) {
      const thread = await this.get(id);
      Object.assign(thread, data || {});
      return adapter.set('threads', String(id), thread);
    },

    async approve(id, state) {
      return this.set(id, { approved: state !== false });
    },

    async ban(id, state) {
      return this.set(id, { banned: state !== false });
    },

    async isApproved(id) {
      const thread = await this.get(id);
      return !!thread.approved;
    }
  };
}
