function defaultGlobal() {
  return {
    key: 'bot',
    totalUsers: 0,
    totalThreads: 0,
    totalMoney: 0,
    maintenance: false,
    data: {}
  };
}

export function createGlobalController(adapter) {
  return {
    async get(key) {
      const id = String(key || 'bot');
      let doc = await adapter.get('global', id);
      if (!doc) {
        doc = id === 'bot' ? defaultGlobal() : { key: id, data: {} };
        await adapter.set('global', id, doc);
      }
      return doc;
    },

    async set(key, data) {
      const id = String(key || 'bot');
      const doc = await this.get(id);
      Object.assign(doc, data || {});
      return adapter.set('global', id, doc);
    }
  };
    }
