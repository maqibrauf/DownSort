import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { rootDirPath } from './config.js';

const dataDir = path.join(rootDirPath, 'data');
mkdirSync(dataDir, { recursive: true });
const storePath = path.join(dataDir, 'seen.json');

let seen = {};
if (existsSync(storePath)) {
  try {
    seen = JSON.parse(readFileSync(storePath, 'utf-8'));
  } catch {
    seen = {};
  }
}

function persist() {
  writeFileSync(storePath, JSON.stringify(seen, null, 2));
}

function keyFor(absPath, size, mtimeMs) {
  return `${absPath}::${size}::${mtimeMs}`;
}

export function isSeen(absPath, size, mtimeMs) {
  return Boolean(seen[keyFor(absPath, size, mtimeMs)]);
}

export function markSeen(absPath, size, mtimeMs, decision) {
  seen[keyFor(absPath, size, mtimeMs)] = { decision, at: new Date().toISOString() };
  persist();
}
