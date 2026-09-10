import type { Result, WordTimestamp } from "@/lib/xclips/types";
import { isNonSpeechCaptionCue } from "@/lib/xclips/phrase-segmentation";

export interface WhisperCppTimedWord {
  word: string;
  start: number;
  end: number;
}

export interface AudioAlignmentResult {
  words: WordTimestamp[];
  matchedAnchors: number;
  coverage: number;
  interpolated: number;
  unresolved: string[];
  openingDirect: boolean;
  endingDirect: boolean;
}

export interface CanonicalSliceOptions {
  opening: string[];
  ending: string[];
}

/** Minimum subtitle word duration; interpolated runs below this BLOCK. */
export const MIN_ALIGNED_WORD_SEC = 0.06;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Parse whisper.cpp -ml 1 JSON segment output into relative timed words. */
export function parseWhisperCppWordOutput(payload: unknown, windowStartSec: number): Result<WhisperCppTimedWord[]> {
  if (!payload || typeof payload !== "object") return { success: false, error: "Invalid whisper.cpp output" };
  const transcription = (payload as { transcription?: unknown }).transcription;
  if (!Array.isArray(transcription)) return { success: false, error: "Missing whisper.cpp transcription" };
  const words: WhisperCppTimedWord[] = [];
  for (const item of transcription) {
    if (!item || typeof item !== "object") continue;
    const row = item as { text?: unknown; offsets?: { from?: unknown; to?: unknown } };
    const word = typeof row.text === "string" ? row.text.trim() : "";
    const from = Number(row.offsets?.from);
    const to = Number(row.offsets?.to);
    if (!word || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
    words.push({ word, start: windowStartSec + from / 1000, end: windowStartSec + to / 1000 });
  }
  if (words.length === 0) return { success: false, error: "No timed whisper.cpp words" };
  return { success: true, data: words };
}

/**
 * Extract the contiguous canonical span between opening and ending token
 * sequences using WORD ORDER and TEXT only. Canonical WordTimestamp timing
 * is never consulted — it is untrusted CC alignment hint, not truth.
 */
export function sliceCanonicalSpanByText(
  words: WordTimestamp[],
  options: CanonicalSliceOptions,
): Result<{ words: WordTimestamp[] }> {
  const norm = words.map((w) => normalize(w.word));
  const open = options.opening.map(normalize).filter(Boolean);
  const close = options.ending.map(normalize).filter(Boolean);
  if (open.length === 0 || close.length === 0) {
    return { success: false, error: "Empty semantic anchor" };
  }
  let startIndex = -1;
  for (let i = 0; i + open.length <= norm.length; i++) {
    if (open.every((token, k) => norm[i + k] === token)) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) return { success: false, error: "Opening anchor not found in canonical text" };
  let endIndex = -1;
  for (let i = norm.length - close.length; i >= startIndex; i--) {
    if (close.every((token, k) => norm[i + k] === token)) {
      endIndex = i + close.length - 1;
      break;
    }
  }
  if (endIndex === -1 || endIndex < startIndex) {
    return { success: false, error: "Ending anchor not found after opening anchor" };
  }
  return { success: true, data: { words: words.slice(startIndex, endIndex + 1) } };
}

function substitutionScore(a: string, b: string): number {
  if (!a || !b) return -1;
  if (a === b) return 2;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 1;
  return -1;
}

interface AlignedPair {
  canonical: number;
  timedStart: number;
  timedEnd: number;
}

/**
 * Needleman-Wunsch alignment of canonical tokens to timed tokens.
 * Handles token split/join (e.g. ["baik","lebih"] vs "baik-lebih") via
 * concatenation transitions. Minor ASR insertions/deletions cost gaps
 * without shifting later anchors.
 */
export function alignTokenSequences(
  canonical: string[],
  timed: string[],
): AlignedPair[] {
  const n = canonical.length;
  const m = timed.length;
  const GAP = -1;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const back: Array<Array<"diag" | "up" | "left" | "diag2" | "up2">> = Array.from({ length: n + 1 }, () =>
    new Array<"diag" | "up" | "left" | "diag2" | "up2">(m + 1).fill("diag"),
  );
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + GAP;
    back[i][0] = "up";
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + GAP;
    back[0][j] = "left";
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = dp[i - 1][j - 1] + substitutionScore(canonical[i - 1], timed[j - 1]);
      let move: "diag" | "up" | "left" | "diag2" | "up2" = "diag";
      const up = dp[i - 1][j] + GAP;
      if (up > best) {
        best = up;
        move = "up";
      }
      const left = dp[i][j - 1] + GAP;
      if (left > best) {
        best = left;
        move = "left";
      }
      if (j >= 2 && canonical[i - 1] === timed[j - 2] + timed[j - 1]) {
        const joined = dp[i - 1][j - 2] + 2;
        if (joined > best) {
          best = joined;
          move = "diag2";
        }
      }
      if (i >= 2 && timed[j - 1] === canonical[i - 2] + canonical[i - 1]) {
        const joined = dp[i - 2][j - 1] + 2;
        if (joined > best) {
          best = joined;
          move = "up2";
        }
      }
      dp[i][j] = best;
      back[i][j] = move;
    }
  }
  const pairs: AlignedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const move = back[i][j];
    if (move === "diag") {
      if (substitutionScore(canonical[i - 1], timed[j - 1]) >= 1) {
        pairs.push({ canonical: i - 1, timedStart: j - 1, timedEnd: j - 1 });
      }
      i--;
      j--;
    } else if (move === "diag2") {
      pairs.push({ canonical: i - 1, timedStart: j - 2, timedEnd: j - 1 });
      i--;
      j -= 2;
    } else if (move === "up2") {
      pairs.push({ canonical: i - 1, timedStart: j - 1, timedEnd: j - 1 });
      pairs.push({ canonical: i - 2, timedStart: j - 1, timedEnd: j - 1 });
      i -= 2;
      j--;
    } else if (move === "up") {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

/**
 * Map a text-selected canonical span onto whisper.cpp timing.
 * Direct DP anchors carry trusted timing. Unmatched words strictly BETWEEN
 * two anchors receive subtitle-only interpolation (never cut evidence).
 * Words before the first anchor or after the last anchor BLOCK the mapping
 * instead of fabricating timing.
 */
export function mapCanonicalWordsToAudio(
  canonicalWords: WordTimestamp[],
  timedWords: WhisperCppTimedWord[],
  options: CanonicalSliceOptions,
): Result<AudioAlignmentResult> {
  const slice = sliceCanonicalSpanByText(canonicalWords, options);
  if (!slice.success) return slice;
  // Filler/excluded words never render (the frozen subtitle builder drops
  // isFiller/excluded words), so they need no timing and must not BLOCK.
  // Non-speech caption cues ([musik] etc.) are lexical sanitation targets:
  // dropped here and before subtitle output, never interpolated, never cut
  // evidence.
  const selected = slice.data.words.filter(
    (word) => !word.isFiller && !word.excluded && !isNonSpeechCaptionCue(word.word),
  );
  if (selected.length === 0) return { success: false, error: "Empty alignable span" };
  if (timedWords.length === 0) return { success: false, error: "Empty timed words" };

  const canonicalTokens = selected.map((w) => normalize(w.word));
  const timedTokens = timedWords.map((w) => normalize(w.word));
  const pairs = alignTokenSequences(canonicalTokens, timedTokens);
  const anchorByCanonical = new Map<number, AlignedPair>();
  for (const pair of pairs) {
    if (!anchorByCanonical.has(pair.canonical)) anchorByCanonical.set(pair.canonical, pair);
  }

  const openingDirect = anchorByCanonical.has(0);
  const endingDirect = anchorByCanonical.has(selected.length - 1);
  if (!openingDirect || !endingDirect) {
    const missing: string[] = [];
    if (!openingDirect) missing.push(selected[0]?.word ?? "(opening)");
    if (!endingDirect && selected.length > 1) missing.push(selected[selected.length - 1]?.word ?? "(ending)");
    return { success: false, error: `Unbounded semantic anchor: ${missing.join(", ")}` };
  }

  const timedOf = (pair: AlignedPair): { start: number; end: number } => ({
    start: timedWords[pair.timedStart].start,
    end: timedWords[pair.timedEnd].end,
  });

  const words: WordTimestamp[] = [];
  const directIndex = new Set<number>();
  const unresolved: string[] = [];
  let interpolated = 0;

  for (let index = 0; index < selected.length; index++) {
    const direct = anchorByCanonical.get(index);
    if (direct) {
      const span = timedOf(direct);
      words.push({ ...selected[index], start: span.start, end: span.end });
      directIndex.add(index);
      continue;
    }
    // Bounded interpolation: nearest anchors on both sides are guaranteed
    // because index 0 and the final index are direct.
    let before = index - 1;
    while (before >= 0 && !anchorByCanonical.has(before)) before--;
    let after = index + 1;
    while (after < selected.length && !anchorByCanonical.has(after)) after++;
    if (before < 0 || after >= selected.length) {
      unresolved.push(selected[index].word);
      words.push({ ...selected[index], start: 0, end: 0 });
      continue;
    }
    const spanStart = timedOf(anchorByCanonical.get(before)!).end;
    const spanEnd = timedOf(anchorByCanonical.get(after)!).start;
    if (!Number.isFinite(spanStart) || !Number.isFinite(spanEnd)) {
      return { success: false, error: `Untimable span near "${selected[index].word}"` };
    }
    // Subtitle-only interpolation, always bounded by direct anchors. When the
    // gap is too small (e.g. ASR-dropped interjections between abutting
    // segments), center minimum-duration slots on the boundary instant
    // instead of collapsing to ~0. Never cut evidence, never reordered.
    const unmatched = after - before - 1;
    const position = index - before;
    const span = Math.max(0, spanEnd - spanStart);
    const need = unmatched * MIN_ALIGNED_WORD_SEC;
    const share = span >= need ? span / unmatched : MIN_ALIGNED_WORD_SEC;
    const runStart = span >= need ? spanStart : spanStart - (need - span) / 2;
    const start = runStart + share * (position - 1);
    const end = runStart + share * position;
    interpolated++;
    words.push({ ...selected[index], start, end });
  }

  if (unresolved.length > 0) {
    return { success: false, error: `Unresolved span: ${unresolved.join(" ")}` };
  }

  // Monotonicity + positivity guard for subtitle timing. Direct anchors keep
  // their exact trusted times; only interpolated words are clamped forward.
  let cursor = -Infinity;
  const final = words.map((word, index) => {
    if (directIndex.has(index)) {
      cursor = Math.max(cursor, word.end);
      return {
        ...word,
        start: Number(Math.max(0, word.start).toFixed(3)),
        end: Number(Math.max(word.start, word.end).toFixed(3)),
      };
    }
    const start = Math.max(0, Math.max(word.start, cursor));
    const end = Math.max(start + MIN_ALIGNED_WORD_SEC, word.end);
    cursor = end;
    return {
      ...word,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    };
  });

  const directCount = anchorByCanonical.size;
  return {
    success: true,
    data: {
      words: final,
      matchedAnchors: directCount,
      coverage: directCount / selected.length,
      interpolated,
      unresolved,
      openingDirect,
      endingDirect,
    },
  };
}
