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

// OpenRouter's free-tier model lineup rotates/gets deprecated fairly often. If you hit a
// "unavailable for free" 404 for all of these, check https://openrouter.ai/models?max_price=0
// for what's currently live and update this list (or your config.json's "openrouter.models").
const DEFAULT_FREE_MODELS = [
  'z-ai/glm-5.2:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3.8-27b:free',
  'nex-agi/nex-n2.5-pro:free'
];

const configuredModels = raw.openrouter?.models ?? (raw.openrouter?.model ? [raw.openrouter.model] : undefined);

export const config = {
  downloadsPath: raw.downloadsPath,
  targets: raw.targets,
  openrouter: {
    apiKey,
    baseUrl: raw.openrouter?.baseUrl || 'https://openrouter.ai/api/v1',
    // Tried in order; if one is deprecated/unavailable-for-free, the next is tried automatically.
    models: Array.isArray(configuredModels) && configuredModels.length > 0 ? configuredModels : DEFAULT_FREE_MODELS
  },
  maxFolderDepth: raw.maxFolderDepth ?? 4,
  ignoredExtensions: raw.ignoredExtensions ?? ['.crdownload', '.tmp', '.part', '.download'],
  stableCheckIntervalMs: raw.stableCheckIntervalMs ?? 1000,
  stableCheckCount: raw.stableCheckCount ?? 2
};

export const rootDirPath = rootDir;
