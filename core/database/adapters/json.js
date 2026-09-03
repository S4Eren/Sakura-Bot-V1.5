import fs from 'fs-extra';
import path from 'path';

export async function createJsonAdapter(rootDir) {
  const dir = path.join(rootDir || process.cwd(), 'data');
  await fs.ensureDir(dir);

  const files = {
    users: path.join(dir, 'users.json'),
    threads: path.join(dir, 'threads.json'),
    global: path.join(dir, 'global.json')
  };

  const cache = {
    users: {},
    threads: {},
    global: {}
  };

  for (const key of Object.keys(files)) {
    if (!(await fs.pathExists(files[key]))) {
      await fs.writeJson(files[key], {}, { spaces: 2 });
    }
    cache[key] = await fs.readJson(files[key]);
  }

  async function save(collection) {
    await fs.writeJson(files[collection], cache[collection], { spaces: 2 });
  }

  return {
    type: 'json',

    async get(collection, id) {
      return cache[collection][String(id)] || null;
    },

    async set(collection, id, data) {
      cache[collection][String(id)] = data;
      await save(collection);
      return data;
    },

    async delete(collection, id) {
      delete cache[collection][String(id)];
      await save(collection);
    },

    async all(collection) {
      return { ...cache[collection] };
    },

    async close() {}
  };
}
