import { logAudit } from './audit.repo';
export async function safeAudit(params) {
    try {
        await logAudit(params);
    }
    catch {
        // swallow audit errors to avoid breaking the moderation action
    }
}
