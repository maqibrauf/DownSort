import { existsSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

function uniqueDestination(destDir, fileName) {
  let candidate = path.join(destDir, fileName);
  if (!existsSync(candidate)) return candidate;

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let n = 1;
  while (existsSync(candidate)) {
    candidate = path.join(destDir, `${base} (${n})${ext}`);
    n++;
  }
  return candidate;
}

/**
 * Moves a file into destDir, avoiding name collisions.
 * Falls back to copy+delete if rename fails (e.g. across drives).
 * Returns the final destination path.
 */
export function moveFileTo(srcPath, destDir, fileName) {
  const dest = uniqueDestination(destDir, fileName);
  try {
    renameSync(srcPath, dest);
  } catch {
    copyFileSync(srcPath, dest);
    unlinkSync(srcPath);
  }
  return dest;
}
