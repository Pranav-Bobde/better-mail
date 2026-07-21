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
// and bracketed list tags like [EXT] as the thread grows. Match one such
// leading token so the whole run can be stripped to Gmail's clean base subject.
const replyPrefixPattern = /^(?:\[[^\]]*\]|(?:re|fwd|fw)(?:\[\d+\])?\s*:)\s*/i;

export function getBaseSubject(subject: string) {
  let base = subject.trim();

  while (replyPrefixPattern.test(base)) {
    const stripped = base.replace(replyPrefixPattern, "").trim();

    // Stop before stripping the subject down to nothing — a prefix-only subject
    // like "Re: Re:" keeps its last prefix instead of vanishing from the header.
    if (stripped.length === 0) {
      break;
    }

    base = stripped;
  }

  return base;
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
