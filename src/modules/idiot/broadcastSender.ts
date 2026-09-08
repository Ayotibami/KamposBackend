import { sendAdminMessageEmail } from '../../services/email/email.service';
import * as broadcastRepo from './broadcast.repo';
import logger from '../../utils/logger';

// A batch per tick, not "all pending at once" — gentle on the SMTP relay,
// and bounded so one huge broadcast can't monopolize every tick forever
// (a backlog just spreads across more ticks instead).
const BATCH_SIZE = 20;
// Small gap between individual sends within a batch — real mail relays
// rate-limit per-connection send speed, not just a daily total.
const DELAY_BETWEEN_SENDS_MS = 300;
// After this many failed attempts on the SAME recipient, stop retrying
// even for a "temporary" error — a persistently-failing temporary error
// (a typo'd domain that always times out, say) shouldn't retry forever.
const MAX_ATTEMPTS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SMTP convention: a 4xx response means "try again later" (quota,
 * greylisting, a temporary relay hiccup); 5xx means "this will never
 * succeed" (bad address, permanently rejected). A thrown error with no
 * SMTP response code at all (a connection drop, DNS failure) is treated as
 * temporary too — it says nothing about the recipient being bad. */
function isPermanentFailure(err: any): boolean {
  const responseCode = err?.responseCode;
  if (typeof responseCode === 'number') return responseCode >= 500 && responseCode < 600;
  // No SMTP response code at all means nodemailer rejected this locally
  // before ever reaching the relay — confirmed live: a malformed address
  // throws "No recipients defined" with no responseCode, which the
  // responseCode-only check above would've called "temporary" and retried
  // uselessly up to MAX_ATTEMPTS times. EENVELOPE/EMESSAGE mean the
  // address or content itself is invalid — no amount of retrying fixes
  // that, unlike a dropped connection or a timeout.
  return err?.code === 'EENVELOPE' || err?.code === 'EMESSAGE';
}

/** Called on a recurring schedule (see index.ts) AND once immediately
 * after a broadcast is created, so sending starts right away instead of
 * waiting for the next tick — but the recurring schedule is what actually
 * guarantees a quota-throttled backlog resumes on its own once the
 * provider's daily cap resets, with nobody needing to remember to retry it.
 */
export async function processPendingBroadcastRecipients(): Promise<void> {
  const batch = await broadcastRepo.claimPendingRecipients(BATCH_SIZE);
  if (batch.length === 0) return;

  // Broadcasts are looked up once per batch, not per recipient — every
  // recipient in a batch usually belongs to the same handful of broadcasts.
  const subjectCache = new Map<string, { subject: string; message: string } | null>();
  async function getBroadcastContent(broadcast_id: string) {
    if (subjectCache.has(broadcast_id)) return subjectCache.get(broadcast_id)!;
    const b = await broadcastRepo.getBroadcast(broadcast_id);
    const content = b ? { subject: b.subject, message: b.message } : null;
    subjectCache.set(broadcast_id, content);
    return content;
  }

  for (const recipient of batch) {
    const content = await getBroadcastContent(recipient.broadcast_id);
    if (!content) {
      // The broadcast itself is gone (shouldn't happen — recipients cascade-
      // delete with it) — nothing sane to send, drop it as permanently failed.
      await broadcastRepo.markRecipientFailedOrRetry(recipient.recipient_id, 'Parent broadcast not found', true, MAX_ATTEMPTS);
      continue;
    }
    try {
      await sendAdminMessageEmail(recipient.email, content.subject, content.message);
      await broadcastRepo.markRecipientSent(recipient.recipient_id);
    } catch (err: any) {
      const permanent = isPermanentFailure(err);
      const message = err?.response || err?.message || 'Unknown send error';
      logger.error({ err, recipient_id: recipient.recipient_id, permanent }, 'Broadcast recipient send failed');
      await broadcastRepo.markRecipientFailedOrRetry(recipient.recipient_id, String(message), permanent, MAX_ATTEMPTS);
    }
    await sleep(DELAY_BETWEEN_SENDS_MS);
  }
}
