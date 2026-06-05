// Shared Resend client. Gracefully degrades to null when no key is set,
// so every consumer must fall back to a no-op when `resend` is null.
// Mirrors the LLM-optional pattern in src/lib/anthropic.ts.
import { Resend } from "resend";

export const hasEmail = !!process.env.RESEND_API_KEY;

export const resend = hasEmail
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Where the digest gets sent, and who it comes from. Both have sensible
// placeholders so the no-op path never needs them.
export const DIGEST_TO = process.env.RESEND_TO || "me@example.com";
export const DIGEST_FROM = process.env.RESEND_FROM || "Afoot <digest@afoot.dev>";
