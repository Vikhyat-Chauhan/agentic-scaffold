// Shared Anthropic client. Gracefully degrades to null when no key is set,
// so every consumer must fall back to non-LLM behavior when `anthropic` is null.
import Anthropic from "@anthropic-ai/sdk";

export const hasLLM = !!process.env.ANTHROPIC_API_KEY;

export const anthropic = hasLLM
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Fast + cheap model — good for batched scoring and structured normalization.
export const MODEL = "claude-haiku-4-5-20251001";

/** Pull the first text block out of a Claude message response. */
export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Extract the first top-level JSON value (object or array) from a string. */
export function parseJsonLoose<T>(s: string): T {
  const start = s.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  const open = s[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1)) as T;
    }
  }
  throw new Error("unbalanced JSON in model output");
}
