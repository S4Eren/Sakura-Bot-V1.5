import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// One colored [TAG] line on the console.
const print = (tag, msg, colorFn = chalk.blue) =>
  console.log(`${chalk.bold(colorFn(`[${tag.toUpperCase()}]`))} ${msg}`);

// Thick section title between load steps.
export const header = (text, colorFn = chalk.cyan) =>
  console.log(chalk.bold(colorFn(`\n${text}`)));

// Old-style logger. Prefer log.error / log.info on new code.
const log = (msg, type) => {
  switch (type) {
    case 'load':    return print(cfg.load,  msg);
    case 'error':   return print(cfg.error, msg, chalk.red);
    case 'warn':    return console.warn(`${chalk.bold.yellow(`[${cfg.warn.toUpperCase()}]`)} ${msg}`);
    case 'login':   return print(cfg.login, msg, chalk.green);
    case 'cmd':     return print(cfg.cmd,   msg, chalk.magenta);
    case 'evnts':   return print(cfg.evnts, msg, chalk.yellow);
    default:        return print(cfg.load,  msg);
  }
};

log.header   = header;
log.sakura   = msg => print(cfg.sakura || 'sakura', msg, chalk.cyan);
log.commands = msg => print(cfg.cmd,   msg, chalk.magenta);
log.events   = msg => print(cfg.evnts, msg, chalk.yellow);
log.dev      = msg => print(cfg.dev,   msg, chalk.gray);
log.login    = msg => print(cfg.login, msg, chalk.green);
log.error    = msg => print(cfg.error, msg, chalk.red);
log.warn     = msg => console.warn(`${chalk.bold.yellow(`[${cfg.warn.toUpperCase()}]`)} ${msg}`);
log.info     = msg => print('info',    msg, chalk.blue);

export default log;
