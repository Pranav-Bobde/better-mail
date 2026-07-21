// Windows-1252 maps bytes 0x80-0x9F to these codepoints; reversing them is
// required to reconstruct the original UTF-8 bytes from mojibake text.
const cp1252CharToByte = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

// Subjects sent before the RFC 2047 fix carry UTF-8 bytes that were decoded
// as Windows-1252 (sometimes twice), rendering "😸" as "Ã°ÂŸÂ˜Â¸". Undo that at display
// time, lossless-only: a round applies just when every char fits one byte AND
// the byte run is strictly valid UTF-8, so legit accented text never changes.
export function repairMojibakeText(text: string) {
  let repaired = text;

  for (let round = 0; round < 3; round += 1) {
    const next = decodeSingleByteCharsAsUtf8(repaired);

    if (next === null) {
      break;
    }

    repaired = next;
  }

  return repaired;
}

function decodeSingleByteCharsAsUtf8(text: string) {
  const bytes = toSingleByteArray(text);

  if (bytes === null) {
    return null;
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded === text ? null : decoded;
  } catch {
    return null;
  }
}

function toSingleByteArray(text: string) {
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    const byte = toCp1252Byte(text.charCodeAt(index));

    if (byte === null) {
      return null;
    }

    bytes[index] = byte;
  }

  // Pure-ASCII text has nothing to repair.
  return bytes.some((byte) => byte > 0x7f) ? bytes : null;
}

function toCp1252Byte(code: number) {
  return code <= 0xff ? code : (cp1252CharToByte.get(code) ?? null);
}

// Gmail snippets are HTML-entity-encoded; plain-text bodies can leak markup or
// CSS. Strip both to a readable single line for list and thread previews.
export function cleanMailPreviewText(raw: string) {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;|&rsquo;/gi, "’")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// A conversation subject accumulates reply/forward prefixes (Re:, Fwd:, Fw:)
// as the thread grows, sometimes interleaved with bracketed list tags like
// [EXT]. Strip the whole leading run down to Gmail's clean base subject.
const replyTokenPattern = /^(?:re|fwd|fw)(?:\[\d+\])?\s*:\s*/i;
const bracketTagPattern = /^\[[^\]]*\]\s*/;

export function getBaseSubject(subject: string) {
  let base = subject.trim();

  for (let next = stripReplyNoise(base); next !== null; next = stripReplyNoise(base)) {
    base = next;
  }

  return base;
}

// One stripping step: a reply token, or a bracketed tag directly followed by a
// reply token (e.g. "[EXT] Re: x"). Returns null when nothing more should
// strip.
function stripReplyNoise(base: string) {
  return stripReplyToken(base) ?? stripTaggedReplyToken(base);
}

// Never empties a prefix-only subject like "Re: Re:" — it keeps its last prefix.
function stripReplyToken(base: string) {
  if (!replyTokenPattern.test(base)) {
    return null;
  }

  const stripped = base.replace(replyTokenPattern, "").trim();
  return stripped.length === 0 ? null : stripped;
}

// A standalone tag like "[JIRA-123]" is part of the real subject and stays.
function stripTaggedReplyToken(base: string) {
  const withoutTag = base.replace(bracketTagPattern, "").trim();
  return withoutTag !== base && replyTokenPattern.test(withoutTag) ? withoutTag : null;
}

// Avatar fallbacks show at most two initials, Gmail-style: the first letter of
// the first two words, or the leading letter of a single-word name.
export function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].slice(0, 1);
  }

  return `${words[0][0]}${words[1][0]}`;
}

// Split a plain-text reply into the freshly written body and the quoted history
// beneath it, so the thread view can collapse the quote behind a toggle. The
// quote starts at the first "On … wrote:" attribution or the first ">" line.
export function splitQuotedReply(text: string) {
  const lines = text.split(/\r?\n/);
  const quoteStart = findQuoteStart(lines);

  // A quote that starts at the top (or leaves only blank lines above it) would
  // collapse the whole message to nothing, so leave it fully visible instead.
  if (quoteStart <= 0) {
    return { quoted: null, visible: text };
  }

  const visible = lines.slice(0, quoteStart).join("\n").trimEnd();

  if (visible.length === 0) {
    return { quoted: null, visible: text };
  }

  return { quoted: lines.slice(quoteStart).join("\n"), visible };
}

function findQuoteStart(lines: readonly string[]) {
  return lines.findIndex((line) => /^On .+ wrote:$/.test(line.trimEnd()) || line.startsWith(">"));
}
