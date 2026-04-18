/**
 * Strips chain-of-thought / reasoning artifacts from LLM output before
 * returning it to the client. Defensive: runs even when we route through
 * a non-reasoning model, because some providers still inject <think>
 * blocks or preambles under load.
 */

const THINK_BLOCK = /<think(?:\s[^>]*)?>[\s\S]*?<\/think>\s*/gi;
const UNCLOSED_THINK = /<think(?:\s[^>]*)?>[\s\S]*$/i;
const REASONING_BLOCK = /<reasoning(?:\s[^>]*)?>[\s\S]*?<\/reasoning>\s*/gi;

// Common Spanish/English conversational preambles that appear before the
// actual answer. Kept conservative — only matches when it's the leading line.
const PREAMBLE_LINES = [
  /^aquí\s+(?:está|tienes|va)[^\n]*\n+/i,
  /^here\s+(?:is|are|'s)[^\n]*\n+/i,
  /^claro[^\n]*\n+/i,
  /^por supuesto[^\n]*\n+/i,
  /^sure[^\n]*\n+/i,
];

// Surrounding quotes the model sometimes adds despite instructions.
const WRAPPING_QUOTES = /^["'`“”‘’]+|["'`“”‘’]+$/g;

export function stripThinkBlocks(input: string): string {
  if (!input) return "";
  let out = input
    .replace(THINK_BLOCK, "")
    .replace(REASONING_BLOCK, "")
    .replace(UNCLOSED_THINK, "")
    .trim();

  for (const pattern of PREAMBLE_LINES) {
    out = out.replace(pattern, "");
  }

  out = out.replace(WRAPPING_QUOTES, "").trim();
  return out;
}

export const TRANSLATE_SYSTEM_PROMPT =
  "CRITICAL INSTRUCTION: You are an API that translates and summarizes. " +
  "You MUST output ONLY the final translated summary. " +
  "DO NOT include any preamble, DO NOT explain your thought process, " +
  "DO NOT use conversational filler like 'Aquí está el resumen'. " +
  "DO NOT wrap the output in <think> tags or any other reasoning markup. " +
  "Return absolutely nothing but the requested summary text.";
