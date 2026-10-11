/**
 * Find in book.
 *
 * Search runs over the authoritative playback plan rather than a PDF text
 * layer or EPUB DOM, so every format resolves a hit to the same worker-plan
 * ordinal that playback seeks to. Segments are joined with one space so a
 * phrase can span a planner sentence boundary; the hit belongs to the segment
 * its first character is in.
 *
 * Matching is case- and diacritic-insensitive. Each original character is
 * folded (NFD, combining marks removed, lower-cased) while remembering where it
 * came from, so a match in the folded text maps back to an exact range of the
 * readable text for its snippet.
 */

export const BOOK_SEARCH_RESULT_LIMIT = 200;

const SNIPPET_BEFORE = 55;
const SNIPPET_AFTER = 90;

export type BookSearchSegment = {
  ordinal: number;
  text: string;
};

export type BookSearchResult = {
  /** Offset of the match in the joined text; unique per result. */
  id: number;
  ordinal: number;
  snippet: string;
  /** Half-open range of the matched text inside `snippet`. */
  matchStart: number;
  matchEnd: number;
};

export type BookSearchIndex = {
  text: string;
  folded: string;
  /** `foldedToText[i]` is the index in `text` of folded character `i`. */
  foldedToText: number[];
  segmentStarts: number[];
  ordinals: number[];
};

const COMBINING_MARKS = /\p{M}/gu;

function collapseWhitespace(text: string): string {
  return text.split(/\s+/u).filter(Boolean).join(' ');
}

function foldCharacter(char: string): string {
  return char.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

function foldQuery(query: string): string {
  let folded = '';
  for (const char of collapseWhitespace(query)) folded += foldCharacter(char);
  return folded;
}

export function foldText(text: string): { folded: string; foldedToText: number[] } {
  let folded = '';
  const foldedToText: number[] = [];
  let index = 0;
  for (const char of text) {
    const foldedChar = foldCharacter(char);
    for (let offset = 0; offset < foldedChar.length; offset += 1) foldedToText.push(index);
    folded += foldedChar;
    index += char.length;
  }
  return { folded, foldedToText };
}

export function buildBookSearchIndex(segments: readonly BookSearchSegment[]): BookSearchIndex {
  let text = '';
  const segmentStarts: number[] = [];
  const ordinals: number[] = [];
  for (const segment of segments) {
    const collapsed = collapseWhitespace(segment.text);
    if (!collapsed) continue;
    if (text) text += ' ';
    segmentStarts.push(text.length);
    ordinals.push(segment.ordinal);
    text += collapsed;
  }

  const { folded, foldedToText } = foldText(text);
  return { text, folded, foldedToText, segmentStarts, ordinals };
}

export function searchBookIndex(
  index: BookSearchIndex,
  query: string,
  limit = BOOK_SEARCH_RESULT_LIMIT,
): BookSearchResult[] {
  const needle = foldQuery(query);
  if (!needle || limit <= 0 || index.ordinals.length === 0) return [];

  const results: BookSearchResult[] = [];
  let segmentIndex = 0;
  let cursor = 0;
  while (results.length < limit) {
    const foldedStart = index.folded.indexOf(needle, cursor);
    if (foldedStart < 0) break;
    const foldedEnd = foldedStart + needle.length;
    const start = index.foldedToText[foldedStart];
    const end = foldedEnd < index.foldedToText.length
      ? index.foldedToText[foldedEnd]
      : index.text.length;

    while (
      segmentIndex + 1 < index.segmentStarts.length
      && index.segmentStarts[segmentIndex + 1] <= start
    ) segmentIndex += 1;

    const lower = Math.max(0, start - SNIPPET_BEFORE);
    const upper = Math.min(index.text.length, end + SNIPPET_AFTER);
    const lead = lower > 0 ? '…' : '';
    const snippet = `${lead}${index.text.slice(lower, upper)}${upper < index.text.length ? '…' : ''}`;
    results.push({
      id: start,
      ordinal: index.ordinals[segmentIndex],
      snippet,
      matchStart: lead.length + start - lower,
      matchEnd: lead.length + end - lower,
    });
    cursor = foldedEnd;
  }
  return results;
}

export function searchBook(
  segments: readonly BookSearchSegment[],
  query: string,
  limit = BOOK_SEARCH_RESULT_LIMIT,
): BookSearchResult[] {
  return searchBookIndex(buildBookSearchIndex(segments), query, limit);
}

/**
 * Find in book over the PDF's parsed layout blocks.
 *
 * Each parsed block (`pdf:<page>:<blockId>`, the worker's source key) is one
 * search entry, so a hit maps to exactly the block the reader highlights and
 * can seek into the sentence the block was read as. Snippets come from the
 * block's own text; matching is the same case- and diacritic-insensitive
 * folding as the playback-plan search.
 */

export type PdfBlockSearchEntry = {
  /** The worker source key `pdf:<page>:<blockId>`. */
  key: string;
  page: number;
  blockId: string;
  text: string;
};

export type PdfBlockSearchResult = {
  /** Match identity (`key:start`); unique per result. */
  id: string;
  key: string;
  page: number;
  blockId: string;
  /** Folded index of the match inside the block's folded text. */
  matchFoldedOffset: number;
  snippet: string;
  /** Half-open range of the matched text inside `snippet`. */
  matchStart: number;
  matchEnd: number;
};

export type PdfBlockSearchIndex = {
  blocks: readonly {
    entry: PdfBlockSearchEntry;
    folded: string;
    foldedToText: number[];
  }[];
};

export function buildPdfBlockSearchIndex(
  entries: readonly PdfBlockSearchEntry[],
): PdfBlockSearchIndex {
  const blocks: Array<{ entry: PdfBlockSearchEntry; folded: string; foldedToText: number[] }> = [];
  for (const entry of entries) {
    const collapsed = collapseWhitespace(entry.text);
    if (!collapsed) continue;
    const { folded, foldedToText } = foldText(collapsed);
    blocks.push({ entry: { ...entry, text: collapsed }, folded, foldedToText });
  }
  return { blocks };
}

export function searchPdfBlockIndex(
  index: PdfBlockSearchIndex,
  query: string,
  limit = BOOK_SEARCH_RESULT_LIMIT,
): PdfBlockSearchResult[] {
  const needle = foldQuery(query);
  if (!needle || limit <= 0) return [];

  const results: PdfBlockSearchResult[] = [];
  for (const { entry, folded, foldedToText } of index.blocks) {
    let cursor = 0;
    while (results.length < limit) {
      const foldedStart = folded.indexOf(needle, cursor);
      if (foldedStart < 0) break;
      const foldedEnd = foldedStart + needle.length;
      const start = foldedToText[foldedStart];
      const end = foldedEnd < foldedToText.length
        ? foldedToText[foldedEnd]
        : entry.text.length;
      if (!(end > start)) {
        cursor = foldedEnd;
        continue;
      }
      const lower = Math.max(0, start - SNIPPET_BEFORE);
      const upper = Math.min(entry.text.length, end + SNIPPET_AFTER);
      const lead = lower > 0 ? '…' : '';
      const snippet = `${lead}${entry.text.slice(lower, upper)}${upper < entry.text.length ? '…' : ''}`;
      results.push({
        id: `${entry.key}:${start}`,
        key: entry.key,
        page: entry.page,
        blockId: entry.blockId,
        matchFoldedOffset: foldedStart,
        snippet,
        matchStart: lead.length + start - lower,
        matchEnd: lead.length + end - lower,
      });
      cursor = foldedEnd;
    }
    if (results.length >= limit) break;
  }
  return results;
}
