import { describe, expect, test } from "bun:test";
import { clampCueOverlaps, segmentPhrases } from "@/lib/xclips/phrase-segmentation";
import type { WordTimestamp } from "@/lib/xclips/types";

function words(count: number, stepSec: number, wordDurSec = 0.4, startAt = 10): WordTimestamp[] {
  return Array.from({ length: count }, (_, i) => ({
    word: `kata${i + 1}`,
    start: startAt + i * stepSec,
    end: startAt + i * stepSec + wordDurSec,
  }));
}

describe("generic caption timing contract", () => {
  test("8 words split into cues of at most 6 words", () => {
    const phrases = segmentPhrases(words(8, 0.5), { maxWords: 6, maxDurationSec: 3.5 });
    expect(phrases.length).toBeGreaterThan(1);
    for (const phrase of phrases) {
      expect(phrase.words.length).toBeLessThanOrEqual(6);
    }
  });

  test("6-second span splits into cues of at most 3.5 seconds", () => {
    const phrases = segmentPhrases(words(8, 0.75), { maxWords: 6, maxDurationSec: 3.5 });
    expect(phrases.length).toBeGreaterThan(1);
    for (const phrase of phrases) {
      expect(phrase.endSec - phrase.startSec).toBeLessThanOrEqual(3.5 + 1e-9);
    }
  });

  test("all words kept in order without rewriting", () => {
    const input = words(10, 0.5);
    const phrases = segmentPhrases(input, { maxWords: 6, maxDurationSec: 3.5 });
    const flat = phrases.flatMap((p) => p.words.map((w) => w.word));
    expect(flat).toEqual(input.map((w) => w.word));
  });

  test("cue start/end follow first/last word timestamps", () => {
    const phrases = segmentPhrases(words(5, 0.5), { maxWords: 6, maxDurationSec: 3.5 });
    expect(phrases).toHaveLength(1);
    expect(phrases[0].startSec).toBe(10);
    expect(phrases[0].endSec).toBe(10 + 4 * 0.5 + 0.4);
  });

  test("cues do not overlap on clean timestamps", () => {
    const phrases = segmentPhrases(words(12, 0.5), { maxWords: 6, maxDurationSec: 3.5 });
    for (let i = 1; i < phrases.length; i++) {
      expect(phrases[i].startSec).toBeGreaterThanOrEqual(phrases[i - 1].endSec);
    }
  });

  test("no invented gaps: cue edges sit on word edges", () => {
    const input = words(7, 0.5);
    const phrases = segmentPhrases(input, { maxWords: 6, maxDurationSec: 3.5 });
    expect(phrases).toHaveLength(2);
    // boundary falls exactly between word 6 end and word 7 start
    expect(phrases[0].endSec).toBe(input[5].end);
    expect(phrases[1].startSec).toBe(input[6].start);
  });

  test("duration cap respected without dropping filler-like tokens", () => {
    const input: WordTimestamp[] = [
      { word: "ee", start: 0, end: 0.4 },
      { word: "jadi", start: 0.4, end: 0.8 },
      { word: "begini", start: 0.8, end: 3.6 },
      { word: "ya", start: 3.6, end: 4.0 },
    ];
    const phrases = segmentPhrases(input, { maxWords: 6, maxDurationSec: 3.5 });
    expect(phrases.flatMap((p) => p.words.map((w) => w.word))).toEqual(["ee", "jadi", "begini", "ya"]);
  });

  test("inverted cue dropped before neighbors clamp", () => {
    const cues = clampCueOverlaps([
      { start: 17.84, end: 20.24, text: "satu asisten" },
      { start: 20.24, end: 18.51, text: "khusus presiden" },
      { start: 18.51, end: 21.85, text: "judulnya itu" },
    ]);
    expect(cues).toEqual([
      { start: 17.84, end: 18.51, text: "satu asisten" },
      { start: 18.51, end: 21.85, text: "judulnya itu" },
    ]);
  });
});
