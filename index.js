import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = dirname(CURRENT_FILE);

const BOT_SCRIPT = resolve(CURRENT_DIR, 'core/main.js');
const NODE_ARGS = [
  '--trace-warnings',
  '--async-stack-traces'
];

let botProcess = null;
let shuttingDown = false;
let restarting = false;

const log = {
  info(message) {
    console.log(`ℹ️  ${message}`);
  },

  success(message) {
    console.log(`✅ ${message}`);
  },

  warn(message) {
    console.warn(`⚠️  ${message}`);
  },

  error(message) {
    console.error(`❌ ${message}`);
  }
};

function isRunning() {
  return botProcess && !botProcess.killed && botProcess.exitCode === null;
}

async function stopBot(reason = 'restart') {
  if (!isRunning()) {
    botProcess = null;
    return;
  }

  const child = botProcess;

  log.warn(`Stopping bot process (${reason})...`);

  return new Promise((resolveStop) => {
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;

      if (botProcess === child) {
        botProcess = null;
      }

      resolveStop();
    };

    child.once('close', finish);

    try {
      child.kill('SIGTERM');
    } catch (error) {
      log.error(`Failed to stop bot: ${error.message}`);
      finish();
      return;
    }

    // Force kill if the process doesn't exit gracefully.
    const forceTimer = setTimeout(() => {
      if (finished) return;

      log.warn('Bot did not exit gracefully. Force terminating...');

      try {
        child.kill('SIGKILL');
      } catch {}

      finish();
    }, 5000);

    forceTimer.unref();
  });
}

function startBot() {
  if (shuttingDown) return;

  if (isRunning()) {
    log.warn('Bot is already running.');
    return;
  }

  log.info(`Starting bot: ${BOT_SCRIPT}`);

  const child = spawn(
    process.execPath,
    [...NODE_ARGS, BOT_SCRIPT],
    {
      cwd: CURRENT_DIR,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    }
  );

  botProcess = child;

  child.once('spawn', () => {
    log.success(`Bot started successfully. PID: ${child.pid}`);
  });

  child.once('error', (error) => {
    log.error(`Unable to start bot: ${error.message}`);

    if (botProcess === child) {
      botProcess = null;
    }
  });

  child.once('close', (code, signal) => {
    if (botProcess === child) {
      botProcess = null;
    }

    if (shuttingDown) {
      log.info(`Bot stopped during shutdown.`);
      return;
    }

    if (restarting) {
      log.info(`Bot process closed. Restart sequence continues.`);
      return;
    }

    if (signal) {
      log.warn(`Bot terminated by signal: ${signal}`);
    } else if (code === 0) {
      log.info('Bot exited normally.');
    } else {
      log.error(`Bot crashed/exited with code: ${code}`);
    }
  });
}

async function restartBot() {
  if (shuttingDown) return;

  restarting = true;

  try {
    await stopBot('restart');
    startBot();
  } catch (error) {
    log.error(`Restart failed: ${error.message}`);
  } finally {
    restarting = false;
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  log.info(`Received ${signal}. Shutting down...`);

  try {
    await stopBot('shutdown');
  } finally {
    process.exit(0);
  }
}

// ─────────────────────────────────────────────
// Process Signals
// ─────────────────────────────────────────────

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// ─────────────────────────────────────────────
// Unexpected Errors
// ─────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (reason) => {
  log.error(
    `Unhandled rejection: ${
      reason instanceof Error
        ? reason.stack || reason.message
        : String(reason)
    }`
  );
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

startBot();

// Optional hot restart support.
// Call restartBot() from another part of your launcher if needed.
export {
  startBot,
  stopBot,
  restartBot,
  isRunning
};
