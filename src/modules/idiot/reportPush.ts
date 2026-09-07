import * as webpushService from './webpush.service';
import logger from '../../utils/logger';

/**
 * Debounced report push — mirrors AdminNotificationToast.tsx's own
 * bump()-with-timer pattern, just server-side and feeding a phone push
 * instead of an in-app toast. Confirmed with real testing that firing one
 * push per report is wrong the moment more than one report lands close
 * together (a pile-on, or several people reporting different things at
 * once) — nobody wants 10 buzzes in 10 seconds. Instead: every new report
 * bumps a count and (re)starts a short window; when it goes quiet, ONE
 * push goes out summarizing however many arrived, then the count resets.
 *
 * Module-level state (not per-request) is correct here — there is exactly
 * one Node process running this backend today (see adminSocket.ts's own
 * doc comment on the single-instance assumption), so a single shared
 * counter is the whole story. If this backend ever runs multiple
 * instances, this would need to move to Redis — not needed yet.
 */
const DEBOUNCE_MS = 5_000;
let pendingCount = 0;
let timer: NodeJS.Timeout | null = null;

export function bumpReportPush(): void {
  pendingCount += 1;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flush();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  const count = pendingCount;
  pendingCount = 0;
  timer = null;
  if (count === 0) return;
  try {
    await webpushService.sendToAllAdmins({
      title: count === 1 ? 'New report' : `${count} new reports`,
      body: count === 1 ? 'A gist was just reported — tap to review.' : 'Tap to review the queue.',
      url: '/villagepeople/moderation?tab=reports',
    });
  } catch (err) {
    logger.error({ err }, 'Failed to send report push digest');
  }
}
