import { config } from './config.js';
import { logError, log } from './logger.js';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [500, 1500]; // between attempts 1->2 and 2->3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  // 429 is deliberately excluded: each Groq model has its own separate rate limit, so if one
  // is hit, retrying the same model won't help — move to the next configured model instead
  // (see attemptModel), which has its own independent quota.
  return status >= 500;
}

async function callGroq(model, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
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
 * Tries a single model with bounded retries (network errors / 5xx only — see isRetryableStatus).
 * Returns { outcome: 'ok', response } | { outcome: 'model-unavailable' } | { outcome: 'error', reason }
 */
async function attemptModel(model, systemPrompt, userPrompt) {
  let response;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      response = await callGroq(model, systemPrompt, userPrompt);
    } catch (err) {
      lastError = err.message;
      logError(`Groq request failed (${model}, attempt ${attempt}/${MAX_ATTEMPTS}):`, lastError);
      response = null;
    }

    if (response?.ok) return { outcome: 'ok', response };

    if (response?.status === 404) {
      // Model deprecated/renamed — move on to the next configured model.
      const body = await response.text().catch(() => '');
      log(`Model "${model}" is unavailable (404), trying next configured model. ${body}`);
      return { outcome: 'model-unavailable' };
    }

    if (response?.status === 429) {
      // Move on immediately — no point retrying the same rate-limited model.
      log(`Model "${model}" is rate-limited (429), trying next configured model.`);
      return { outcome: 'model-unavailable' };
    }

    if (response && !isRetryableStatus(response.status)) {
      const body = await response.text().catch(() => '');
      logError('Groq returned non-retryable status', response.status, body);
      return { outcome: 'error', reason: `http_${response.status}` };
    }

    if (response) {
      lastError = `http_${response.status}`;
      logError(`Groq returned ${response.status} (${model}, attempt ${attempt}/${MAX_ATTEMPTS}), will retry if attempts remain.`);
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1));
    }
  }

  return { outcome: 'error', reason: lastError ?? 'unknown' };
}

/**
 * Asks the LLM to pick the best-matching folder for a file, from the given taxonomy.
 * Tries each model in config.groq.models in order, moving to the next one whenever
 * one is deprecated/unavailable (404) or rate-limited (429), so a single model issue
 * doesn't stall the whole pipeline.
 *
 * Returns a discriminated result:
 *   { status: 'match', folder: { label, absPath } }  - confident pick
 *   { status: 'no-match' }                            - LLM says nothing fits (final answer)
 *   { status: 'error', reason }                       - every model failed (transient or account-
 *                                                        level issue); caller should NOT treat this
 *                                                        as "no match" and should retry a later run
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

  let lastReason = 'no_models_configured';

  for (const model of config.groq.models) {
    const attempt = await attemptModel(model, systemPrompt, userPrompt);

    if (attempt.outcome === 'model-unavailable') {
      lastReason = 'model_unavailable';
      continue; // try the next configured model
    }

    if (attempt.outcome === 'error') {
      // Non-retryable, model-independent failure (bad API key, malformed request, etc.) —
      // trying another model won't help, so give up now rather than burning more requests.
      logError(`Giving up on "${fileName}": ${attempt.reason}`);
      return { status: 'error', reason: attempt.reason };
    }

    // outcome === 'ok'
    const data = await attempt.response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      logError('Groq response had no content:', JSON.stringify(data));
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

    if (!parsed.folder) return { status: 'no-match' };

    const match = folders.find((f) => f.label === parsed.folder);
    if (!match) {
      logError(`LLM picked a folder not in the list: "${parsed.folder}"`);
      return { status: 'no-match' };
    }
    return { status: 'match', folder: match };
  }

  logError(`Giving up on "${fileName}": all configured models failed (${lastReason}).`);
  return { status: 'error', reason: lastReason };
}
