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
        timeout: 30,
        actions: ['Accept', 'Reject']
      },
      (err, response) => {
        if (err) {
          resolve('timeout');
          return;
        }
        if (response === 'Accept' || response === 'activate') {
          resolve('accept');
        } else if (response === 'Reject') {
          resolve('reject');
        } else {
          resolve('timeout');
        }
      }
    );
  });
}
