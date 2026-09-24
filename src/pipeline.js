import { statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { scanFolderTaxonomy } from './scanTargets.js';
import { classifyFile } from './classify.js';
import { confirmMove } from './notify.js';
import { moveFileTo } from './mover.js';
import { isSeen, markSeen } from './store.js';
import { log, logError, recordHistory } from './logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStable(filePath) {
  let lastSize = -1;
  let stableCount = 0;

  while (stableCount < config.stableCheckCount) {
    if (!existsSync(filePath)) return false;
    let size;
    try {
      size = statSync(filePath).size;
    } catch {
      return false;
    }
    if (size === lastSize) {
      stableCount++;
    } else {
      stableCount = 0;
      lastSize = size;
    }
    await sleep(config.stableCheckIntervalMs);
  }
  return true;
}

export async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (config.ignoredExtensions.includes(ext)) return;

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return; // file already gone (moved/deleted before we got to it)
  }
  if (!stat.isFile()) return;

  const stable = await waitForStable(filePath);
  if (!stable) return;

  // Re-stat after waiting, in case the file changed size/finished writing.
  try {
    stat = statSync(filePath);
  } catch {
    return;
  }

  if (isSeen(filePath, stat.size, stat.mtimeMs)) return;

  const fileName = path.basename(filePath);
  const folders = scanFolderTaxonomy();
  if (folders.length === 0) {
    logError('No valid target folders found. Check "targets" in config.json.');
    return;
  }

  const match = await classifyFile(fileName, folders);
  if (!match) {
    log(`No confident match for "${fileName}", leaving in place.`);
    markSeen(filePath, stat.size, stat.mtimeMs, 'no-match');
    return;
  }

  const decision = await confirmMove(fileName, match.label);

  if (decision !== 'accept') {
    log(`Suggestion for "${fileName}" -> ${match.label} was ${decision}.`);
    markSeen(filePath, stat.size, stat.mtimeMs, decision);
    recordHistory({ file: fileName, from: filePath, suggested: match.label, decision });
    return;
  }

  try {
    const dest = moveFileTo(filePath, match.absPath, fileName);
    log(`Moved "${fileName}" -> ${dest}`);
    recordHistory({ file: fileName, from: filePath, to: dest, decision: 'accept' });
  } catch (err) {
    logError(`Failed to move "${fileName}":`, err.message);
    return;
  }

  markSeen(filePath, stat.size, stat.mtimeMs, 'accept');
}
