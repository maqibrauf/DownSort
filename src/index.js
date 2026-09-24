import chokidar from 'chokidar';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { processFile } from './pipeline.js';
import { log, logError } from './logger.js';

const once = process.argv.includes('--once');

process.on('unhandledRejection', (err) => logError('Unhandled rejection:', err));
process.on('uncaughtException', (err) => logError('Uncaught exception:', err));

async function runOnce() {
  log(`Scanning existing files in ${config.downloadsPath} ...`);
  const entries = readdirSync(config.downloadsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(config.downloadsPath, entry.name);
    await processFile(filePath);
  }
  log('One-shot sweep complete.');
}

function runWatcher() {
  log(`Watching ${config.downloadsPath} for new downloads...`);
  const watcher = chokidar.watch(config.downloadsPath, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: false // pipeline does its own stability check
  });

  watcher.on('add', (filePath) => {
    processFile(filePath).catch((err) => logError('Error processing', filePath, err));
  });

  watcher.on('error', (err) => logError('Watcher error:', err));
}

if (once) {
  runOnce();
} else {
  runWatcher();
}
