import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const exec = promisify(execCallback);

export const eren = {
  name: 'shell',
  version: '1.0.0',
  aliases: ['sh', 'exec', 'terminal'],
  description: 'Execute shell commands.',
  author: 'S4Eren',
  category: 'developer',
  type: 'developer',
  cooldown: 5,
  guide: [
    '<command> — execute a shell command',
  ],
};

export async function onStart({ event, response }) {
  const text = event.text || event.caption || '';

  const command = text
    .replace(
      /^(?:\/)?(?:shell|sh|exec|terminal)(?:@\w+)?\s*/i,
      ''
    )
    .trim();

  if (!command) {
    return response.reply(
      `❌ *Please provide a command to execute.*`,
      { parse_mode: 'Markdown' }
    );
  }

  let loading;

  try {
    loading = await response.reply(
      `⏳ *Executing command...*`,
      { parse_mode: 'Markdown' }
    );

    const { stdout, stderr } = await exec(command, {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
      shell: '/bin/sh',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        npm_config_progress: 'false',
        NPM_CONFIG_PROGRESS: 'false',
      },
    });

    if (loading) {
      await response.delete(loading).catch(() => {});
    }

    let output = [];
    
    if (stdout?.trim()) {
      output.push(stdout.trim());
    }
    
    if (stderr?.trim()) {
      const stderrOutput = stderr.trim();
      if (stderrOutput.includes('npm') || stderrOutput.includes('warn')) {
        output.push(stderrOutput);
      }
    }

    const finalOutput = output.join('\n') || 'Command executed successfully.';

    const result =
      `💻 *Shell Result*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Command:*\n` +
      `\`\`\`bash\n${command}\n\`\`\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📤 *Output:*\n` +
      `\`\`\`\n${finalOutput}\n\`\`\``;

    if (result.length <= 4000) {
      return response.reply(result, {
        parse_mode: 'Markdown',
      });
    }

    const fileName = `shell-output-${Date.now()}.txt`;
    const filePath = path.join(os.tmpdir(), fileName);

    await writeFile(filePath, finalOutput, 'utf8');

    try {
      await response.upload('document', filePath, {
        filename: fileName,
        caption: '📄 *Shell Output*',
        parse_mode: 'Markdown'
      });
    } finally {
      await unlink(filePath).catch(() => {});
    }

  } catch (error) {
    console.error('[SHELL ERROR]', error);

    if (loading) {
      await response.delete(loading).catch(() => {});
    }

    const stdout = error?.stdout?.trim();
    const stderr = error?.stderr?.trim();

    const output = [
      stderr,
      stdout,
    ]
      .filter(Boolean)
      .join('\n');

    const finalOutput =
      output ||
      error?.message ||
      'Unknown error';

    const message =
      `❌ *Shell command failed*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `\`\`\`\n${finalOutput}\n\`\`\``;

    if (message.length <= 4000) {
      return response.reply(message, {
        parse_mode: 'Markdown',
      });
    }

    const fileName = `shell-error-${Date.now()}.txt`;
    const filePath = path.join(os.tmpdir(), fileName);

    await writeFile(filePath, finalOutput, 'utf8');

    try {
      await response.upload('document', filePath, {
        filename: fileName,
        caption: '❌ *Shell Error Output*',
        parse_mode: 'Markdown'
      });
    } finally {
      await unlink(filePath).catch(() => {});
    }
  }
}
