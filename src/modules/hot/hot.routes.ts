import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { isAuth } from "../../middleware/auth";
import { HotController } from "./hot.controller";

const router = Router();

// 20 posts/hour/account — Hot posts are more spam-prone than a gist or
// spot (ephemeral, gone in 24h, lower perceived stakes to spamming), and
// unlike gist/spot creation (which have no dedicated limiter at all, just
// the blanket 600-req/15min API-wide one in app.ts) this one's tight
// enough to actually matter. Keyed by account_id, not IP — this route
// always runs after `isAuth`, so req.user is already populated by the time
// this middleware sees the request; same ordering auth.routes.ts's own
// limiters don't need (theirs are pre-auth, keyed by IP/email instead).
// ipKeyGenerator wraps the IP fallback (a raw req.ip concatenation is
// trivially bypassable for IPv6 — see auth.routes.ts's own identical
// comment) — express-rate-limit actually THROWS at startup, not just warns,
// if it detects req.ip used directly in a keyGenerator without this.
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.account_id ?? ipKeyGenerator(req.ip ?? ""),
  message: { success: false, message: "Too many Hot posts — abeg wait small before you try again." },
});

router.post("/upload-signature", isAuth, HotController.uploadSignature);
router.post("/", isAuth, createLimiter, HotController.create);
router.get("/mine", isAuth, HotController.mine);
router.get("/feed", isAuth, HotController.feed);
router.post("/seen", isAuth, HotController.markSeen);
router.delete("/:hot_post_id", isAuth, HotController.remove);

export default router;
