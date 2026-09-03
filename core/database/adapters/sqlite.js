import fs from 'fs-extra';
import path from 'path';
import sqlite3 from 'sqlite3';

function open(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params || [], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function all(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function createSqliteAdapter(rootDir) {
  const dir = path.join(rootDir || process.cwd(), 'data');
  await fs.ensureDir(dir);
  const file = path.join(dir, 'reze.sqlite');
  const db = await open(file);

  await run(db, 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT)');
  await run(db, 'CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, data TEXT)');
  await run(db, 'CREATE TABLE IF NOT EXISTS global (id TEXT PRIMARY KEY, data TEXT)');

  return {
    type: 'sqlite',

    async get(collection, id) {
      const row = await get(db, 'SELECT data FROM ' + collection + ' WHERE id = ?', [String(id)]);
      if (!row) return null;
      try { return JSON.parse(row.data); } catch (e) { return null; }
    },

    async set(collection, id, data) {
      const raw = JSON.stringify(data);
      await run(
        db,
        'INSERT INTO ' + collection + ' (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        [String(id), raw]
      );
      return data;
    },

    async delete(collection, id) {
      await run(db, 'DELETE FROM ' + collection + ' WHERE id = ?', [String(id)]);
    },

    async all(collection) {
      const rows = await all(db, 'SELECT id, data FROM ' + collection);
      const out = {};
      for (const row of rows) {
        try { out[row.id] = JSON.parse(row.data); } catch (e) {}
      }
      return out;
    },

    async close() {
      return new Promise((resolve) => db.close(() => resolve()));
    }
  };
}
