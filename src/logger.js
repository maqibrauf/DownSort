import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { rootDirPath } from './config.js';

const dataDir = path.join(rootDirPath, 'data');
mkdirSync(dataDir, { recursive: true });
const historyPath = path.join(dataDir, 'history.jsonl');

export function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

export function logError(...args) {
  console.error(new Date().toISOString(), ...args);
}

export function recordHistory(entry) {
  appendFileSync(historyPath, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
}
