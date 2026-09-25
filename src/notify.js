import notifier from 'node-notifier';

/**
 * Shows a Windows toast with Accept/Reject buttons for a proposed file move.
 * Resolves to 'accept', 'reject', or 'timeout' (no response / dismissed).
 */
export function confirmMove(fileName, folderLabel) {
  return new Promise((resolve) => {
    notifier.notify(
      {
        title: 'DownSort',
        message: `${fileName}\n→ ${folderLabel}`,
        wait: true,
        timeout: 120,
        actions: ['Accept', 'Reject']
      },
      (err, response) => {
        if (err) {
          resolve('timeout');
          return;
        }
        // node-notifier lowercases/sanitizes the button label before handing it back here
        // (see its actionJackerDecorator), so match against the actual button text — not
        // the capitalized labels we passed in via `actions` above.
        const normalized = String(response || '').toLowerCase().trim();
        if (normalized === 'accept') {
          resolve('accept');
        } else if (normalized === 'reject') {
          resolve('reject');
        } else {
          // Covers dismissed / clicked-body / timed-out / anything unrecognized — none of
          // these are an explicit decision, so treat them all as "ask again later".
          resolve('timeout');
        }
      }
    );
  });
}
