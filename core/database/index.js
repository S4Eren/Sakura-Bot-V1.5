import { createJsonAdapter } from './adapters/json.js';
import { createSqliteAdapter } from './adapters/sqlite.js';
import { createMongoAdapter } from './adapters/mongodb.js';
import { createUsersController } from './controllers/users.js';
import { createThreadsController } from './controllers/threads.js';
import { createGlobalController } from './controllers/global.js';

export async function initDatabase(config) {
  const dbConf = (config && config.database) || {};
  const type = String(dbConf.type || 'json').toLowerCase();
  const root = process.cwd();

  let adapter;
  if (type === 'sqlite' || type === 'sqlite3') {
    adapter = await createSqliteAdapter(root);
  } else if (type === 'mongodb' || type === 'mongo') {
    adapter = await createMongoAdapter(dbConf.mongodbURI || process.env.MONGODB_URI);
  } else {
    adapter = await createJsonAdapter(root);
  }

  const usersData = createUsersController(adapter);
  const threadsData = createThreadsController(adapter);
  const globalData = createGlobalController(adapter);

  return {
    type: adapter.type,
    adapter,
    usersData,
    threadsData,
    globalData
  };
}
