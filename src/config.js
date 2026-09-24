import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const configPath = path.join(rootDir, 'config.json');

if (!existsSync(configPath)) {
  console.error(
    `Missing config.json. Copy config.example.json to config.json and fill in your paths + API key.`
  );
  process.exit(1);
}

const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

if (!raw.downloadsPath) {
  console.error('config.json: "downloadsPath" is required.');
  process.exit(1);
}
if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
  console.error(
    'config.json: "targets" must be a non-empty array of { name, path }. Add at least one project folder.'
  );
  process.exit(1);
}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error(
    'Missing OPENROUTER_API_KEY environment variable. Get a free key at https://openrouter.ai/keys, ' +
      'then set it (e.g. `setx OPENROUTER_API_KEY "..."` in PowerShell, then reopen your terminal).'
  );
  process.exit(1);
}

export const config = {
  downloadsPath: raw.downloadsPath,
  targets: raw.targets,
  openrouter: {
    apiKey,
    baseUrl: raw.openrouter?.baseUrl || 'https://openrouter.ai/api/v1',
    model: raw.openrouter?.model || 'deepseek/deepseek-chat-v3.1:free'
  },
  maxFolderDepth: raw.maxFolderDepth ?? 4,
  ignoredExtensions: raw.ignoredExtensions ?? ['.crdownload', '.tmp', '.part', '.download'],
  stableCheckIntervalMs: raw.stableCheckIntervalMs ?? 1000,
  stableCheckCount: raw.stableCheckCount ?? 2
};

export const rootDirPath = rootDir;
