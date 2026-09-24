import { config } from './config.js';
import { logError } from './logger.js';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [500, 1500]; // between attempts 1->2 and 2->3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function callDeepSeek(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.deepseek.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Asks the LLM to pick the best-matching folder for a file, from the given taxonomy.
 *
 * Returns a discriminated result:
 *   { status: 'match', folder: { label, absPath } }  - confident pick
 *   { status: 'no-match' }                            - LLM says nothing fits (final answer)
 *   { status: 'error', reason }                       - API/network/parse failure (transient,
 *                                                        caller should NOT treat this as "no match"
 *                                                        and should leave the file for a later run)
 *
 * Retries a bounded number of times (only on network errors / 429 / 5xx) with backoff, then
 * gives up cleanly — it never loops indefinitely or hammers the API.
 */
export async function classifyFile(fileName, folders) {
  const folderLabels = folders.map((f) => f.label);

  const systemPrompt = `You sort downloaded files into an existing folder structure.
You will be given a filename and a list of existing folder paths.
Pick the single best-matching folder for the file based on its name.
Only pick from the given list — never invent a new folder name.
If nothing is a reasonable match, respond with folder: null.
Respond with ONLY a JSON object, no markdown, no explanation: {"folder": "<exact folder path from the list, or null>"}`;

  const userPrompt = `Filename: ${fileName}\n\nExisting folders:\n${folderLabels.map((l) => `- ${l}`).join('\n')}`;

  let response;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      response = await callDeepSeek(systemPrompt, userPrompt);
    } catch (err) {
      lastError = err.message;
      logError(`DeepSeek request failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, lastError);
      response = null;
    }

    if (response?.ok) break;

    if (response && !isRetryableStatus(response.status)) {
      // Non-retryable (bad request, auth failure, etc.) — retrying won't help.
      const body = await response.text().catch(() => '');
      logError('DeepSeek returned non-retryable status', response.status, body);
      return { status: 'error', reason: `http_${response.status}` };
    }

    if (response) {
      lastError = `http_${response.status}`;
      logError(`DeepSeek returned ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}), will retry if attempts remain.`);
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1));
    }
  }

  if (!response?.ok) {
    logError(`Giving up on "${fileName}" after ${MAX_ATTEMPTS} attempts:`, lastError);
    return { status: 'error', reason: lastError ?? 'unknown' };
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    logError('DeepSeek response had no content:', JSON.stringify(data));
    return { status: 'error', reason: 'empty_response' };
  }

  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    logError('Could not parse LLM response as JSON:', content);
    return { status: 'error', reason: 'unparseable_response' };
  }

  if (!parsed.folder) {
    return { status: 'no-match' };
  }

  const match = folders.find((f) => f.label === parsed.folder);
  if (!match) {
    logError(`LLM picked a folder not in the list: "${parsed.folder}"`);
    return { status: 'no-match' };
  }
  return { status: 'match', folder: match };
}
