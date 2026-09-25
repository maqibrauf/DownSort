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
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error(
    'Missing GROQ_API_KEY environment variable. Get a free key at https://console.groq.com/keys, ' +
      'then set it (e.g. `setx GROQ_API_KEY "..."` in PowerShell, then reopen your terminal).'
  );
  process.exit(1);
}

// Groq occasionally deprecates/renames models too. If you hit "unavailable" for all of
// these, check https://console.groq.com/docs/models for what's currently live and update
// this list (or your config.json's "groq.models").
const DEFAULT_FREE_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'allam-2-7b'];

const configuredModels = raw.groq?.models ?? (raw.groq?.model ? [raw.groq.model] : undefined);

export const config = {
  downloadsPath: raw.downloadsPath,
  targets: raw.targets,
  groq: {
    apiKey,
    baseUrl: raw.groq?.baseUrl || 'https://api.groq.com/openai/v1',
    // Tried in order; if one is deprecated/unavailable, the next is tried automatically.
    models: Array.isArray(configuredModels) && configuredModels.length > 0 ? configuredModels : DEFAULT_FREE_MODELS
  },
  maxFolderDepth: raw.maxFolderDepth ?? 4,
  // If set, only files with one of these extensions are processed at all — everything else
  // is left alone. Leave unset (or null) to process every file except ignoredExtensions.
  allowedExtensions: Array.isArray(raw.allowedExtensions) && raw.allowedExtensions.length > 0
    ? raw.allowedExtensions.map((e) => e.toLowerCase())
    : null,
  ignoredExtensions: raw.ignoredExtensions ?? ['.crdownload', '.tmp', '.part', '.download'],
  stableCheckIntervalMs: raw.stableCheckIntervalMs ?? 1000,
  stableCheckCount: raw.stableCheckCount ?? 2
};

export const rootDirPath = rootDir;
