import { MongoClient } from 'mongodb';

export async function createMongoAdapter(uri) {
  if (!uri) throw new Error('MongoDB URI missing');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('reze');

  const cols = {
    users: db.collection('users'),
    threads: db.collection('threads'),
    global: db.collection('global')
  };

  return {
    type: 'mongodb',

    async get(collection, id) {
      const doc = await cols[collection].findOne({ _id: String(id) });
      if (!doc) return null;
      const copy = { ...doc };
      delete copy._id;
      return copy;
    },

    async set(collection, id, data) {
      const doc = { ...data, _id: String(id) };
      await cols[collection].replaceOne({ _id: String(id) }, doc, { upsert: true });
      return data;
    },

    async delete(collection, id) {
      await cols[collection].deleteOne({ _id: String(id) });
    },

    async all(collection) {
      const docs = await cols[collection].find({}).toArray();
      const out = {};
      for (const doc of docs) {
        const id = String(doc._id);
        const copy = { ...doc };
        delete copy._id;
        out[id] = copy;
      }
      return out;
    },

    async close() {
      await client.close();
    }
  };
}
