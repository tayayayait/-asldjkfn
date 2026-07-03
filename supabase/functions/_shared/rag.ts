export type ChunkTextOptions = {
  maxChars?: number;
  overlapChars?: number;
};

const DEFAULT_CHUNK_MAX_CHARS = 1_200;
const DEFAULT_CHUNK_OVERLAP_CHARS = 160;

export function estimateTokenCount(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / 3);
}

export function chunkTextForEmbedding(
  text: string,
  options: ChunkTextOptions = {},
) {
  const maxChars = Math.max(40, options.maxChars ?? DEFAULT_CHUNK_MAX_CHARS);
  const overlapChars = Math.max(
    0,
    Math.min(options.overlapChars ?? DEFAULT_CHUNK_OVERLAP_CHARS, maxChars - 1),
  );
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const rawChunks: string[] = [];
  let current = "";

  const withPreviousOverlap = (next: string) => {
    const previous = rawChunks.at(-1);

    if (!previous || overlapChars === 0) {
      return next;
    }

    const separatorLength = 2;
    const maxTailLength = Math.max(0, maxChars - next.length - separatorLength);
    const tailLength = Math.min(overlapChars, maxTailLength);

    if (tailLength === 0) {
      return next;
    }

    let start = previous.length - tailLength;

    while (
      start > 0 &&
      !/\s/.test(previous[start - 1]) &&
      previous.length - (start - 1) <= maxTailLength
    ) {
      start -= 1;
    }

    return `${previous.slice(start)}\n\n${next}`;
  };

  const flushCurrent = () => {
    if (current.trim()) {
      rawChunks.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (trimmed.length > maxChars) {
      flushCurrent();
      for (
        let start = 0;
        start < trimmed.length;
        start += maxChars - overlapChars
      ) {
        rawChunks.push(trimmed.slice(start, start + maxChars).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      flushCurrent();
      current = withPreviousOverlap(trimmed);
    }
  }

  flushCurrent();

  return rawChunks.map((content, index) => ({
    chunkIndex: index,
    content,
    charLength: content.length,
    tokenCount: estimateTokenCount(content),
  }));
}
