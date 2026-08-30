import { describe, it, expect } from "bun:test";
import {
  segmentPhrases,
  generateSrtFromWords,
  remapWordsToKeepTimeline,
} from "@/lib/xclips/phrase-segmentation";
import { parseSrtToWords } from "@/lib/xclips/ytdlp-downloader";
import { WordTimestamp } from "@/lib/xclips/types";

describe("xclips - Subtitle & Sync Precision Spec (A/V Parity Guarantee)", () => {
  describe("remapWordsToKeepTimeline (P0-1 Fix)", () => {
    it("should keep timestamps identical when there are no cut intervals", () => {
      const words: WordTimestamp[] = [
        { word: "Halo", start: 1.0, end: 1.5 },
        { word: "kawan", start: 1.6, end: 2.0 },
      ];
      const keepIntervals = [{ startSec: 0, endSec: 10 }];

      const remapped = remapWordsToKeepTimeline(words, keepIntervals);
      expect(remapped.length).toBe(2);
      expect(remapped[0].start).toBe(1.0);
      expect(remapped[0].end).toBe(1.5);
      expect(remapped[1].start).toBe(1.6);
      expect(remapped[1].end).toBe(2.0);
    });

    it("should accurately shift timestamps backward after a cut filler interval", () => {
      const words: WordTimestamp[] = [
        { word: "Sebelum", start: 2.0, end: 3.0 },
        { word: "ehm", start: 5.0, end: 7.0, isFiller: true }, // 2.0s filler cut
        { word: "Sesudah", start: 10.0, end: 11.0 },
      ];

      // Keep intervals after cutting 5.0-7.0: [0, 5.0] and [7.0, 15.0]
      const keepIntervals = [
        { startSec: 0.0, endSec: 5.0 }, // rendered 0.0 to 5.0 (5s duration)
        { startSec: 7.0, endSec: 15.0 }, // rendered 5.0 to 13.0 (8s duration)
      ];

      const remapped = remapWordsToKeepTimeline(words, keepIntervals);
      expect(remapped.length).toBe(2); // filler omitted

      // Word before cut remains at 2.0 - 3.0
      expect(remapped[0].word).toBe("Sebelum");
      expect(remapped[0].start).toBe(2.0);
      expect(remapped[0].end).toBe(3.0);

      // Word after cut: source 10.0 shifted by 2.0s cut -> rendered start 8.0, end 9.0
      expect(remapped[1].word).toBe("Sesudah");
      expect(remapped[1].start).toBe(8.0);
      expect(remapped[1].end).toBe(9.0);
    });

    it("should accumulate multiple cuts across the timeline without drift", () => {
      const words: WordTimestamp[] = [
        { word: "Satu", start: 1.0, end: 2.0 },
        { word: "Dua", start: 6.0, end: 7.0 },
        { word: "Tiga", start: 12.0, end: 13.0 },
      ];

      // Two cuts: 3-5 (2s) and 8-10 (2s)
      const keepIntervals = [
        { startSec: 0.0, endSec: 3.0 }, // 3s
        { startSec: 5.0, endSec: 8.0 }, // 3s (rendered 3 to 6)
        { startSec: 10.0, endSec: 15.0 }, // 5s (rendered 6 to 11)
      ];

      const remapped = remapWordsToKeepTimeline(words, keepIntervals);
      expect(remapped.length).toBe(3);

      expect(remapped[0].start).toBe(1.0); // before cut 1
      expect(remapped[1].start).toBe(4.0); // 6.0 - 2.0s cut = 4.0
      expect(remapped[2].start).toBe(8.0); // 12.0 - 4.0s total cuts = 8.0
    });
  });

  describe("segmentPhrases (P1-5 WYSIWYG Parity)", () => {
    it("should break phrases at punctuation marks (. ? ! , ; :)", () => {
      const words: WordTimestamp[] = [
        { word: "Halo,", start: 0.0, end: 0.5 },
        { word: "selamat", start: 0.6, end: 1.0 },
        { word: "datang!", start: 1.1, end: 1.8 },
        { word: "Mari", start: 1.9, end: 2.2 },
        { word: "mulai.", start: 2.3, end: 2.7 },
      ];

      const phrases = segmentPhrases(words);
      expect(phrases.length).toBe(3);
      expect(phrases[0].text).toBe("Halo,");
      expect(phrases[1].text).toBe("selamat datang!");
      expect(phrases[2].text).toBe("Mari mulai.");
    });

    it("should break phrases when time gap between words exceeds threshold (0.8s)", () => {
      const words: WordTimestamp[] = [
        { word: "Bagian", start: 0.0, end: 0.4 },
        { word: "pertama", start: 0.5, end: 1.0 },
        // 1.5 second silence gap
        { word: "Bagian", start: 2.5, end: 2.9 },
        { word: "kedua", start: 3.0, end: 3.5 },
      ];

      const phrases = segmentPhrases(words);
      expect(phrases.length).toBe(2);
      expect(phrases[0].text).toBe("Bagian pertama");
      expect(phrases[1].text).toBe("Bagian kedua");
    });

    it("should strictly respect maxWords limit", () => {
      const words: WordTimestamp[] = [
        { word: "w1", start: 0.1, end: 0.2 },
        { word: "w2", start: 0.3, end: 0.4 },
        { word: "w3", start: 0.5, end: 0.6 },
        { word: "w4", start: 0.7, end: 0.8 },
        { word: "w5", start: 0.9, end: 1.0 },
        { word: "w6", start: 1.1, end: 1.2 },
        { word: "w7", start: 1.3, end: 1.4 },
      ];

      const phrases = segmentPhrases(words, { maxWords: 4 });
      expect(phrases.length).toBe(2);
      expect(phrases[0].words.length).toBe(4);
      expect(phrases[1].words.length).toBe(3);
    });

    it("should omit excluded words from segmented output", () => {
      const words: WordTimestamp[] = [
        { word: "Saya", start: 0.0, end: 0.4 },
        { word: "ummm", start: 0.5, end: 0.9, excluded: true },
        { word: "senang", start: 1.0, end: 1.4 },
      ];

      const phrases = segmentPhrases(words);
      expect(phrases.length).toBe(1);
      expect(phrases[0].text).toBe("Saya senang");
    });
  });

  describe("generateSrtFromWords", () => {
    it("should generate valid SRT with timing offset applied", () => {
      const words: WordTimestamp[] = [
        { word: "Halo", start: 1.0, end: 1.5 },
        { word: "dunia.", start: 1.6, end: 2.0 },
      ];

      const srt = generateSrtFromWords(words, { offsetSec: 0.5 });
      expect(srt).toContain("1\n00:00:01,500 --> 00:00:02,500\nHalo dunia.");
    });
  });

  describe("parseSrtToWords (WebVTT & SRT Parity)", () => {
    it("should parse standard SRT subtitles accurately", () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Halo kawan podcast

2
00:00:03,500 --> 00:00:05,000
Selamat mendengarkan
`;

      const words = parseSrtToWords(srt);
      expect(words.length).toBe(5);
      expect(words[0].word).toBe("Halo");
      expect(words[0].start).toBe(1.0);
      expect(words[2].word).toBe("podcast");
    });

    it("should parse WebVTT format with headers, notes, and period decimals", () => {
      const vtt = `WEBVTT
Kind: captions
Language: id

NOTE This is a commentary note

00:01.000 --> 00:03.000 position:10% align:start
<v Speaker1>Halo kawan podcast</v>

00:03.500 --> 00:05.000
Selamat mendengarkan
`;

      const words = parseSrtToWords(vtt);
      expect(words.length).toBe(5);
      expect(words[0].word).toBe("Halo");
      expect(words[0].start).toBe(1.0);
      expect(words[3].word).toBe("Selamat");
    });
  });

  describe("Phrase Split & Reorder Verification", () => {
    it("should segment and allow splitting a phrase into two distinct segments", () => {
      const initialWords: WordTimestamp[] = [
        { word: "Selamat", start: 1.0, end: 1.5 },
        { word: "pagi", start: 1.5, end: 2.0 },
        { word: "sahabat", start: 2.0, end: 2.5 },
        { word: "semua", start: 2.5, end: 3.0 },
      ];

      const initialPhrases = segmentPhrases(initialWords);
      expect(initialPhrases.length).toBe(1);
      expect(initialPhrases[0].text).toBe("Selamat pagi sahabat semua");

      // Split after "Selamat pagi"
      const wordsPart1: WordTimestamp[] = [
        { word: "Selamat", start: 1.0, end: 1.5 },
        { word: "pagi.", start: 1.5, end: 2.0 },
      ];
      const wordsPart2: WordTimestamp[] = [
        { word: "Sahabat", start: 2.0, end: 2.5 },
        { word: "semua", start: 2.5, end: 3.0 },
      ];
      const splitWords = [...wordsPart1, ...wordsPart2];
      const splitPhrases = segmentPhrases(splitWords);

      expect(splitPhrases.length).toBe(2);
      expect(splitPhrases[0].text).toBe("Selamat pagi.");
      expect(splitPhrases[1].text).toBe("Sahabat semua");
      expect(splitPhrases[0].startSec).toBe(1.0);
      expect(splitPhrases[0].endSec).toBe(2.0);
      expect(splitPhrases[1].startSec).toBe(2.0);
      expect(splitPhrases[1].endSec).toBe(3.0);
    });

    it("should maintain timestamp integrity after reordering phrase segments", () => {
      const phrase1Words: WordTimestamp[] = [
        { word: "Frasa", start: 1.0, end: 1.5 },
        { word: "Satu.", start: 1.5, end: 2.0, breakAfter: true },
      ];
      const phrase2Words: WordTimestamp[] = [
        { word: "Frasa", start: 3.0, end: 3.5 },
        { word: "Dua.", start: 3.5, end: 4.0, breakAfter: true },
      ];

      // Reorder phrase 2 before phrase 1
      const reorderedWords = [...phrase2Words, ...phrase1Words];
      const reorderedPhrases = segmentPhrases(reorderedWords);

      expect(reorderedPhrases.length).toBe(2);
      expect(reorderedPhrases[0].text).toBe("Frasa Dua.");
      expect(reorderedPhrases[1].text).toBe("Frasa Satu.");
      expect(reorderedPhrases[0].startSec).toBe(3.0);
      expect(reorderedPhrases[1].startSec).toBe(1.0);
    });

    it("should NOT absorb words from the next phrase when deleting words in the first phrase (backspace isolation)", () => {
      const phrase1Words: WordTimestamp[] = [
        { word: "Hanya", start: 1.0, end: 1.5, breakAfter: true }, // reduced to 1 word with breakAfter
      ];
      const phrase2Words: WordTimestamp[] = [
        { word: "kalimat", start: 2.0, end: 2.5 },
        { word: "berikutnya", start: 2.5, end: 3.0, breakAfter: true },
      ];

      const allWords = [...phrase1Words, ...phrase2Words];
      const phrases = segmentPhrases(allWords);

      // Must remain 2 separate phrases, not merged into 1
      expect(phrases.length).toBe(2);
      expect(phrases[0].text).toBe("Hanya");
      expect(phrases[1].text).toBe("kalimat berikutnya");
    });

    it("should merge two phrases into one when breakAfter is cleared (backspace at start)", () => {
      const phrase1Words: WordTimestamp[] = [
        { word: "Halo", start: 1.0, end: 1.5, breakAfter: false }, // break cleared on merge
      ];
      const phrase2Words: WordTimestamp[] = [
        { word: "dunia", start: 1.5, end: 2.0, breakAfter: true },
      ];

      const mergedWords = [...phrase1Words, ...phrase2Words];
      const phrases = segmentPhrases(mergedWords);

      expect(phrases.length).toBe(1);
      expect(phrases[0].text).toBe("Halo dunia");
      expect(phrases[0].startSec).toBe(1.0);
      expect(phrases[0].endSec).toBe(2.0);
    });

    it("should allow clearing all text in the first phrase (empty placeholder word) without crashing or disappearing", () => {
      const phrase1Words: WordTimestamp[] = [
        { word: "", start: 1.0, end: 2.0, breakAfter: true }, // empty phrase placeholder
      ];
      const phrase2Words: WordTimestamp[] = [
        { word: "Kalimat", start: 2.5, end: 3.0 },
        { word: "kedua", start: 3.0, end: 3.5, breakAfter: true },
      ];

      const allWords = [...phrase1Words, ...phrase2Words];
      const phrases = segmentPhrases(allWords);

      expect(phrases.length).toBe(2);
      expect(phrases[0].text).toBe("");
      expect(phrases[0].startSec).toBe(1.0);
      expect(phrases[0].endSec).toBe(2.0);
      expect(phrases[1].text).toBe("Kalimat kedua");
    });
  });
});
