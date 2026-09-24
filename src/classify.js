import { config } from './config.js';
import { logError } from './logger.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Asks the LLM to pick the best-matching folder for a file, from the given taxonomy.
 * Returns { label, absPath } on a confident match, or null if no good match / on error.
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
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.openrouter.model,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
  } catch (err) {
    logError('OpenRouter request failed:', err.message);
    return null;
  }

  if (!response.ok) {
    logError('OpenRouter returned', response.status, await response.text().catch(() => ''));
    return null;
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    logError('OpenRouter response had no content:', JSON.stringify(data));
    return null;
  }

  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    logError('Could not parse LLM response as JSON:', content);
    return null;
  }

  if (!parsed.folder) return null;

  const match = folders.find((f) => f.label === parsed.folder);
  if (!match) {
    logError(`LLM picked a folder not in the list: "${parsed.folder}"`);
    return null;
  }
  return match;
}
