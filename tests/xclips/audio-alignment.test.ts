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
