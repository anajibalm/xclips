import { describe, expect, it } from "bun:test";
import {
  mapCanonicalWordsToAudio,
  parseWhisperCppWordOutput,
  sliceCanonicalSpanByText,
} from "@/lib/xclips/audio-alignment";
import { isNonSpeechCaptionCue } from "@/lib/xclips/phrase-segmentation";
import type { WordTimestamp } from "@/lib/xclips/types";

function timed(words: Array<[string, number, number]>) {
  return words.map(([word, start, end]) => ({ word, start, end }));
}

// Absurd CC-style timestamps: lexical selection must ignore them entirely.
function canonical(words: string[]): WordTimestamp[] {
  return words.map((word, i) => ({ word, start: 9999 + i, end: 9999 + i }));
}

describe("S2 audio alignment mapping", () => {
  it("1. canonical lexical selection ignores WordTimestamp times", () => {
    const words = canonical(["Kemudian", "saya", "lihat", "reaksi", "terhadap", "kebakaran", "kurang"]);
    const mapped = mapCanonicalWordsToAudio(
      words,
      timed([["saya", 1, 2], ["lihat", 2, 3], ["reaksi", 3, 4], ["terhadap", 4, 5], ["kebakaran", 5, 6], ["kurang", 6, 7]]),
      { opening: ["saya", "lihat", "reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data.words.map((w) => w.word)).toEqual(
        ["saya", "lihat", "reaksi", "terhadap", "kebakaran", "kurang"],
      );
      expect(mapped.data.openingDirect).toBe(true);
      expect(mapped.data.endingDirect).toBe(true);
    }
  });

  it("2. insertion in whisper sequence does not shift later matches", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["reaksi", "terhadap", "kebakaran", "kurang"]),
      timed([["reaksi", 0, 1], ["EXTRA", 1, 2], ["terhadap", 2, 3], ["kebakaran", 3, 4], ["kurang", 4, 5]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      const byWord = new Map(mapped.data.words.map((w) => [w.word, w]));
      expect(byWord.get("terhadap")?.start).toBe(2);
      expect(byWord.get("kurang")?.start).toBe(4);
    }
  });

  it("3. deletion in whisper sequence does not shift later matches", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["reaksi", "hilang", "terhadap", "kurang"]),
      timed([["reaksi", 0, 1], ["terhadap", 2, 3], ["kurang", 4, 5]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      const byWord = new Map(mapped.data.words.map((w) => [w.word, w]));
      expect(byWord.get("terhadap")?.start).toBe(2);
      expect(byWord.get("kurang")?.start).toBe(4);
      expect(mapped.data.interpolated).toBeGreaterThanOrEqual(1);
    }
  });

  it("4. token split/join stays alignable", () => {
    const split = mapCanonicalWordsToAudio(
      canonical(["baik", "lebih", "kurang"]),
      timed([["baik-lebih", 0, 2], ["kurang", 2, 3]]),
      { opening: ["baik"], ending: ["kurang"] },
    );
    expect(split.success).toBe(true);
    const joined = mapCanonicalWordsToAudio(
      canonical(["baik-lebih", "kurang"]),
      timed([["baik", 0, 1], ["lebih", 1, 2], ["kurang", 2, 3]]),
      { opening: ["baik-lebih"], ending: ["kurang"] },
    );
    expect(joined.success).toBe(true);
  });

  it("5. bounded unmatched canonical word interpolates", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["reaksi", "eeh", "terhadap", "kurang"]),
      timed([["reaksi", 0, 1], ["terhadap", 3, 4], ["kurang", 4, 5]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data.interpolated).toBe(1);
      const mid = mapped.data.words[1];
      expect(mid.end).toBeGreaterThan(mid.start);
    }
  });

  it("6. unbounded prefix/suffix cannot be fabricated", () => {
    // Opening word absent from timed output → BLOCK, not invented timing.
    const result = mapCanonicalWordsToAudio(
      canonical(["reaksi", "terhadap", "kurang"]),
      timed([["terhadap", 2, 3], ["kurang", 4, 5]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(result.success).toBe(false);
  });

  it("7b. ASR-dropped interjection between abutting anchors stays bounded", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["perencanaan", "ya", "kita", "kurang"]),
      timed([["perencanaan", 0, 1], ["kita", 1, 2], ["kurang", 2, 3]]),
      { opening: ["perencanaan"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      const ya = mapped.data.words[1];
      expect(ya.end).toBeGreaterThan(ya.start);
      expect(ya.end - ya.start).toBeGreaterThanOrEqual(0.06);
      expect(ya.start).toBeGreaterThanOrEqual(0.9);
      expect(ya.end).toBeLessThanOrEqual(2.1);
    }
  });

  it("7. interpolation has positive non-collapsed durations", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["reaksi", "a", "b", "terhadap", "kurang"]),
      timed([["reaksi", 0, 1], ["terhadap", 5, 6], ["kurang", 6, 7]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      for (const w of mapped.data.words) {
        expect(w.end).toBeGreaterThan(w.start);
      }
      for (let i = 1; i < mapped.data.words.length; i++) {
        expect(mapped.data.words[i].start).toBeGreaterThanOrEqual(mapped.data.words[i - 1].start);
      }
    }
  });

  it("8. first semantic anchor and final kurang stay direct audio anchors", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["saya", "lihat", "reaksi", "kurang"]),
      timed([["saya", 0, 1], ["lihat", 1, 2], ["reaksi", 2, 3], ["kurang", 5, 6]]),
      { opening: ["saya", "lihat", "reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data.openingDirect).toBe(true);
      expect(mapped.data.endingDirect).toBe(true);
      expect(mapped.data.words[0].start).toBe(0);
      expect(mapped.data.words.at(-1)?.end).toBe(6);
    }
  });

  it("rejects missing anchors and empty timed input", () => {
    expect(parseWhisperCppWordOutput({}, 0).success).toBe(false);
    expect(
      sliceCanonicalSpanByText(canonical(["a", "b"]), { opening: ["zz"], ending: ["b"] }).success,
    ).toBe(false);
    expect(
      mapCanonicalWordsToAudio(canonical(["a", "b"]), [], { opening: ["a"], ending: ["b"] }).success,
    ).toBe(false);
  });
});

describe("S2.9 non-speech caption cues", () => {
  it("removes known cues case-insensitively, keeps speech and valid brackets", () => {
    expect(isNonSpeechCaptionCue("[MUSIK]")).toBe(true);
    expect(isNonSpeechCaptionCue("[music]")).toBe(true);
    expect(isNonSpeechCaptionCue("[TEPUK TANGAN]")).toBe(true);
    expect(isNonSpeechCaptionCue("[tertawa]")).toBe(true);
    expect(isNonSpeechCaptionCue("(applause)")).toBe(true);
    expect(isNonSpeechCaptionCue("[tidak terdengar]")).toBe(true);
    expect(isNonSpeechCaptionCue("reaksi")).toBe(false);
    expect(isNonSpeechCaptionCue("[Presiden]")).toBe(false);
    expect(isNonSpeechCaptionCue("[Jakarta]")).toBe(false);
    expect(isNonSpeechCaptionCue("[2026]")).toBe(false);
    expect(isNonSpeechCaptionCue("")).toBe(false);
  });

  it("drops cue tokens from mapping without breaking timing", () => {
    const mapped = mapCanonicalWordsToAudio(
      canonical(["reaksi", "[musik]", "terhadap", "kurang"]),
      timed([["reaksi", 0, 1], ["terhadap", 1, 2], ["kurang", 2, 3]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data.words.map((w) => w.word)).toEqual(["reaksi", "terhadap", "kurang"]);
      expect(mapped.data.openingDirect).toBe(true);
      expect(mapped.data.endingDirect).toBe(true);
      for (let i = 1; i < mapped.data.words.length; i++) {
        expect(mapped.data.words[i].start).toBeGreaterThanOrEqual(mapped.data.words[i - 1].start);
        expect(mapped.data.words[i].end).toBeGreaterThan(mapped.data.words[i].start);
      }
    }
  });
});
  reconcileEdgeAnchor,
  it("6b. reconciler finds the contiguous clean phrase beside noise", () => {
    // Real S6 shape: semantic ["kolom","abu","tidak","ROC",...] in
    // transcript order; physical has "kolom abu tidak" contiguously.
    // Only exact contiguous slices are generated — never synthetic skips.
    const semantic = canonical(["kolom", "abu", "tidak", "ROC", "terekam"]);
    const result = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: semantic,
      timedWords: timed([
        ["kol", 29.92, 30.19], ["om", 30.19, 30.37],
        ["ab", 30.37, 30.55], ["u", 30.55, 30.64],
        ["tidak", 30.64, 31.09], ["terekam", 31.5, 32.0],
      ]),
      semanticEdgeSec: 33.21,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phrase).toEqual(["kolom", "abu", "tidak"]);
      expect(result.data.physicalStart).toBe(29.92);
      expect(result.data.physicalEnd).toBe(31.09);
      expect(result.data.maxAdjacentGapSec).toBeLessThanOrEqual(1.25);
      expect(result.data.wordSpans).toHaveLength(3);
      // Every tried candidate is a contiguous slice of semantic order.
      const lex = semantic.map((w) => w.word);
      for (const tried of result.data.triedPhrases) {
        const parts = tried.split(" ");
        const at = lex.indexOf(parts[0]);
        expect(at).toBeGreaterThanOrEqual(0);
        expect(lex.slice(at, at + parts.length)).toEqual(parts);
      }
    }
  });

  it("6b2. an interior negation can never be skipped", () => {
    // semantic "boleh tidak masuk" vs physical "boleh masuk": deleting
    // "tidak" to manufacture a match is forbidden → fail closed.
    const result = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: canonical(["boleh", "tidak", "masuk"]),
      timedWords: timed([["boleh", 10, 10.4], ["masuk", 10.4, 10.9]]),
      semanticEdgeSec: 10.1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("checked 3 candidates");
  });

  it("6c. scrambled CC timestamps never determine semantic word order", () => {
    // Same words as 6b but the noisy token carries the earliest timestamp:
    // transcript order must still win, yielding the same phrase.
    const semantic: WordTimestamp[] = [
      { word: "kolom", start: 32.48, end: 33.36 },
      { word: "abu", start: 33.36, end: 34.24 },
      { word: "tidak", start: 34.24, end: 35.12 },
      { word: "ROC", start: 32.0, end: 32.5 },
      { word: "terekam", start: 34.42, end: 35.62 },
    ];
    const result = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: semantic,
      timedWords: timed([
        ["kol", 29.92, 30.19], ["om", 30.19, 30.37],
        ["ab", 30.37, 30.55], ["u", 30.55, 30.64],
        ["tidak", 30.64, 31.09], ["terekam", 31.5, 32.0],
      ]),
      semanticEdgeSec: 33.21,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phrase).toEqual(["kolom", "abu", "tidak"]);
    }
  });

  it("6c2. a phrase crossing terminal punctuation is rejected", () => {
    // "kawah." ends a sentence: the crosser is considered but vetoed, and
    // the clean adjacent phrase wins instead.
    const result = reconcileEdgeAnchor({
      side: "ending",
      semanticWords: canonical(["laporan", "kawah.", "Jelajahi", "cara", "baru"]),
      timedWords: timed([
        ["kawah", 63.0, 63.5],
        ["Jelajahi", 64.0, 64.4], ["cara", 64.4, 64.8], ["baru", 64.8, 65.2],
      ]),
      semanticEdgeSec: 65.0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phrase).toEqual(["Jelajahi", "cara", "baru"]);
      expect(result.data.triedPhrases).toContain("kawah. Jelajahi cara baru");
    }
  });

  it("6c3. a physically large inter-word gap is rejected", () => {
    // "kolom"+"abu" realized with a 2s gap between them: not cohesive.
    const gapped = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: canonical(["kolom", "abu"]),
      timedWords: timed([
        ["kol", 10, 10.2], ["om", 10.2, 10.4],
        ["ab", 12.4, 12.6], ["u", 12.6, 12.8],
      ]),
      semanticEdgeSec: 10.1,
    });
    expect(gapped.success).toBe(false);
    // Same phrase with a tight later realization is accepted instead.
    const tight = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: canonical(["kolom", "abu"]),
      timedWords: timed([
        ["kol", 10, 10.2], ["om", 10.2, 10.4],
        ["ab", 12.4, 12.6], ["u", 12.6, 12.8],
        ["kol", 20, 20.2], ["om", 20.2, 20.4],
        ["ab", 20.4, 20.6], ["u", 20.6, 20.8],
      ]),
      semanticEdgeSec: 19.9,
    });
    expect(tight.success).toBe(true);
    if (tight.success) {
      expect(tight.data.physicalStart).toBe(20);
      expect(tight.data.maxAdjacentGapSec).toBeLessThanOrEqual(1.25);
    }
  });

  it("6d. reconciler fails closed with no exact 2+ word physical phrase", () => {
    // No two adjacent-in-semantics words are ever contiguous in physical
    // audio here.
    const result = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: canonical(["kolom", "ROC", "abu", "tidak"]),
      timedWords: timed([
        ["kol", 29.92, 30.19], ["om", 30.19, 30.37],
        ["salah", 30.37, 30.6], ["bukan", 30.6, 31.0],
      ]),
      semanticEdgeSec: 33.21,
    });
    expect(result.success).toBe(false);
  });

  it("6e. physically distant phrase realizations are rejected", () => {
    const result = reconcileEdgeAnchor({
      side: "opening",
      semanticWords: canonical(["kolom", "abu", "tidak"]),
      timedWords: timed([
        ["kol", 100, 100.2], ["om", 100.2, 100.4],
        ["ab", 100.4, 100.6], ["u", 100.6, 100.8],
        ["tidak", 100.8, 101.0],
      ]),
      semanticEdgeSec: 33.21,
    });
    expect(result.success).toBe(false);
  });
