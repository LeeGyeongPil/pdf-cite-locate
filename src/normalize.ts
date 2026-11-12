const INVISIBLE = new Set(["­", "​", "‌", "‍", "⁠", "﻿"]);
const SINGLE_QUOTES = new Set(["‘", "’", "‚", "‛", "′"]);
const DOUBLE_QUOTES = new Set(["“", "”", "„", "‟", "″", "«", "»"]);
const DASHES = new Set(["‐", "‑", "‒", "–", "—", "―", "−"]);

/**
 * Folds one character (one code point) into its search form, keeping letter case.
 * Returns "" for invisible characters, " " for any whitespace, and possibly several
 * characters for compatibility forms such as the ligature "fi".
 */
export function foldChar(ch: string): string {
  // Fast path: printable ASCII is already in its search form (keeps long quotes cheap).
  if (ch.length === 1) {
    const code = ch.charCodeAt(0);
    if (code > 32 && code < 127) return ch;
  }
  if (INVISIBLE.has(ch)) return "";
  if (/^\s$/u.test(ch)) return " ";
  if (SINGLE_QUOTES.has(ch)) return "'";
  if (DOUBLE_QUOTES.has(ch)) return '"';
  if (DASHES.has(ch)) return "-";
  const nfkc = ch.normalize("NFKC");
  if (nfkc === ch) return ch;
  // Compatibility forms can themselves contain whitespace, quotes or dashes.
  let out = "";
  for (const c of nfkc) out += foldChar(c);
  return out;
}

/** Lower-cases one folded character without ever changing its length. */
export function lowerChar(ch: string): string {
  const lower = ch.toLowerCase();
  return lower.length === ch.length ? lower : ch;
}

/**
 * Normalizes free text the same way page text is normalized: compatibility folding (NFKC),
 * curly quotes and dashes to ASCII, invisible characters removed, whitespace collapsed and
 * trimmed, and (by default) case folded.
 */
export function normalizeText(text: string, options: { caseSensitive?: boolean } = {}): string {
  const parts: string[] = [];
  let lastIsSpace = true; // true at the start so leading whitespace is dropped
  for (const ch of text) {
    for (const f of foldChar(ch)) {
      if (f === " ") {
        if (lastIsSpace) continue;
        lastIsSpace = true;
      } else {
        lastIsSpace = false;
      }
      parts.push(options.caseSensitive ? f : lowerChar(f));
    }
  }
  if (lastIsSpace && parts.length > 0) parts.pop(); // trailing space
  return parts.join("");
}
