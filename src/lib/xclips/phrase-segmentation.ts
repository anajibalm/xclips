import { WordTimestamp } from "./types";

export interface PhraseSegment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  words: WordTimestamp[];
}

export interface PhraseSegmentationOptions {
  maxWords?: number;
  maxGapSec?: number;
  breakRegex?: RegExp;
}

export interface TimelineInterval {
  start?: number;
  end?: number;
  startSec?: number;
  endSec?: number;
  duration?: number;
}

const DEFAULT_MAX_WORDS = 6;
const DEFAULT_MAX_GAP_SEC = 0.8;
const DEFAULT_BREAK_REGEX = /[.?!,;:]$/;

/**
 * Single Unified Phrase Segmentation Engine for Studio UI, Canvas Preview, SRT Export & ASS Subtitles
 * Guarantees 100% WYSIWYG parity across editor and rendered outputs.
 */
export function segmentPhrases(
  words: WordTimestamp[],
  options?: PhraseSegmentationOptions
): PhraseSegment[] {
  if (!words || words.length === 0) return [];

  const maxWords = options?.maxWords ?? DEFAULT_MAX_WORDS;
  const maxGapSec = options?.maxGapSec ?? DEFAULT_MAX_GAP_SEC;
  const breakRegex = options?.breakRegex ?? DEFAULT_BREAK_REGEX;

  const validWords = words.filter((w) => !w.excluded && w.word !== undefined && w.word !== null);
  if (validWords.length === 0) return [];

  // Check if explicit segmentation markers (breakAfter) exist
  const hasExplicitBreaks = validWords.some((w) => w.breakAfter === true);

  const phrases: PhraseSegment[] = [];
  let currentWords: WordTimestamp[] = [];

  for (let i = 0; i < validWords.length; i++) {
    const word = validWords[i];
    const prevWord = currentWords[currentWords.length - 1];

    let shouldBreak = false;
    if (prevWord) {
      if (hasExplicitBreaks) {
        // Strict explicit break: only break where breakAfter was set
        shouldBreak = prevWord.breakAfter === true;
      } else {
        // Heuristic break for unsegmented raw words
        const isGapBreak = word.start - prevWord.end >= maxGapSec;
        const isPunctuationBreak = prevWord.word ? breakRegex.test(prevWord.word.trim()) : false;
        const isMaxWordsReached = currentWords.length >= maxWords;
        shouldBreak = isGapBreak || isPunctuationBreak || isMaxWordsReached;
      }
    }

    if (currentWords.length > 0 && shouldBreak) {
      const phraseStart = currentWords[0].start;
      const phraseEnd = currentWords[currentWords.length - 1].end;
      // Ensure the boundary word is marked with breakAfter
      const finalWords = currentWords.map((w, idx) =>
        idx === currentWords.length - 1 ? { ...w, breakAfter: true } : w
      );
      phrases.push({
        id: `phrase_${phrases.length}_${Math.round(phraseStart * 100)}`,
        index: phrases.length,
        startSec: phraseStart,
        endSec: phraseEnd,
        text: finalWords.map((w) => w.word).filter(Boolean).join(" ").trim(),
        words: finalWords,
      });
      currentWords = [];
    }

    currentWords.push(word);
  }

  if (currentWords.length > 0) {
    const phraseStart = currentWords[0].start;
    const phraseEnd = currentWords[currentWords.length - 1].end;
    const finalWords = currentWords.map((w, idx) =>
      idx === currentWords.length - 1 ? { ...w, breakAfter: true } : w
    );
    phrases.push({
      id: `phrase_${phrases.length}_${Math.round(phraseStart * 100)}`,
      index: phrases.length,
      startSec: phraseStart,
      endSec: phraseEnd,
      text: finalWords.map((w) => w.word).filter(Boolean).join(" ").trim(),
      words: finalWords,
    });
  }

  return phrases;
}

/**
 * Generates standard SRT subtitle text from word timestamps with frame-accurate timecodes
 */
export function generateSrtFromWords(
  words: WordTimestamp[],
  options?: PhraseSegmentationOptions & { offsetSec?: number }
): string {
  const phrases = segmentPhrases(words, options);
  if (phrases.length === 0) return "";

  const offsetSec = options?.offsetSec ?? 0;

  const formatSrtTime = (seconds: number): string => {
    const adjusted = Math.max(0, seconds + offsetSec);
    const hrs = Math.floor(adjusted / 3600);
    const mins = Math.floor((adjusted % 3600) / 60);
    const secs = Math.floor(adjusted % 60);
    const ms = Math.floor((adjusted % 1) * 1000);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };

  return phrases
    .map((phrase, idx) => {
      const startStr = formatSrtTime(phrase.startSec);
      const endStr = formatSrtTime(phrase.endSec);
      return `${idx + 1}\n${startStr} --> ${endStr}\n${phrase.text}\n`;
    })
    .join("\n");
}

/**
 * Pure function: Remaps word timestamps to the newly concatenated keep-intervals timeline
 * when filler words or silent gaps are removed from the video stream.
 *
 * Prevents progressive A/V subtitle drift and guarantees 100% A/V synchronization.
 */
export function remapWordsToKeepTimeline(
  words: WordTimestamp[],
  keepIntervals: TimelineInterval[],
  clipStartSec: number = 0
): WordTimestamp[] {
  if (!keepIntervals || keepIntervals.length === 0) return [];
  if (!words || words.length === 0) return [];

  const remappedWords: WordTimestamp[] = [];

  // Precompute cumulative rendered offsets for each keep interval
  let cumulativeRenderedOffset = 0;
  const intervalRanges: Array<{ start: number; end: number; renderedOffset: number }> = [];

  for (const interval of keepIntervals) {
    const start = interval.startSec ?? interval.start ?? 0;
    const end = interval.endSec ?? interval.end ?? 0;
    const duration = Math.max(0, end - start);

    intervalRanges.push({
      start,
      end,
      renderedOffset: cumulativeRenderedOffset,
    });
    cumulativeRenderedOffset += duration;
  }

  for (const word of words) {
    if (word.excluded) continue;

    // Convert word time to relative offset if keepIntervals are relative to clipStart
    // Determine whether keepIntervals are absolute or relative:
    // If keepIntervals[0].start < clipStartSec, it is relative to clipStart
    const isRelativeInterval = keepIntervals[0] && (keepIntervals[0].startSec ?? keepIntervals[0].start ?? 0) === 0 && clipStartSec > 0;
    const wordRefStart = isRelativeInterval ? word.start - clipStartSec : word.start;
    const wordRefEnd = isRelativeInterval ? word.end - clipStartSec : word.end;

    // Find which keep interval this word belongs to
    for (const range of intervalRanges) {
      // Check if word overlaps with this keep interval
      const overlapStart = Math.max(wordRefStart, range.start);
      const overlapEnd = Math.min(wordRefEnd, range.end);

      if (overlapEnd > overlapStart) {
        // Word is within this keep interval
        const remappedStart = range.renderedOffset + (overlapStart - range.start);
        const remappedEnd = range.renderedOffset + (overlapEnd - range.start);

        remappedWords.push({
          ...word,
          start: parseFloat(remappedStart.toFixed(2)),
          end: parseFloat(remappedEnd.toFixed(2)),
        });
        break; // Only map to the first overlapping interval
      }
    }
  }

  return remappedWords;
}
