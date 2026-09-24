import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { logError } from './logger.js';

function walk(dir, depth, maxDepth, acc, relBase) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    logError(`Cannot read target folder "${dir}":`, err.message);
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const rel = relBase ? path.join(relBase, entry.name) : entry.name;
    acc.push({ abs, rel });
    walk(abs, depth + 1, maxDepth, acc, rel);
  }
}

/**
 * Returns a flat list of { targetName, label, absPath } for every folder
 * (including each target's root) across all configured targets, up to maxFolderDepth.
 */
export function scanFolderTaxonomy() {
  const folders = [];
  for (const target of config.targets) {
    let rootStat;
    try {
      rootStat = statSync(target.path);
    } catch {
      logError(`Target "${target.name}" path does not exist: ${target.path}`);
      continue;
    }
    if (!rootStat.isDirectory()) continue;

    folders.push({ targetName: target.name, label: target.name, absPath: target.path });

    const acc = [];
    walk(target.path, 1, config.maxFolderDepth, acc, '');
    for (const { abs, rel } of acc) {
      folders.push({ targetName: target.name, label: `${target.name}/${rel.replace(/\\/g, '/')}`, absPath: abs });
    }
  }
  return folders;
}
