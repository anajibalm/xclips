import { describe, it, expect } from "bun:test";
import { detectTokenFillers, calculateKeepIntervals } from "@/lib/xclips/filler-detector";
import { WordTimestamp } from "@/lib/xclips/types";

describe("xclips - Filler & Silence Detector", () => {
  it("should detect single-token Indonesian filler words accurately without false positives", () => {
    const mockWords: WordTimestamp[] = [
      { word: "Saya", start: 0.0, end: 0.4 },
      { word: "rasa", start: 0.45, end: 0.8 },
      { word: "ee", start: 0.85, end: 1.3 }, // filler
      { word: "harga", start: 1.35, end: 1.8 }, // NOT filler (contains 'ha', but full word is 'harga')
      { word: "saham", start: 1.85, end: 2.2 },
      { word: "hm", start: 2.25, end: 2.7 }, // filler
      { word: "sangat", start: 2.75, end: 3.1 },
      { word: "bagus", start: 3.15, end: 3.5 },
    ];

    const fillers = detectTokenFillers(mockWords);

    expect(fillers.length).toBe(2);
    expect(fillers[0].text).toBe("ee");
    expect(fillers[1].text).toBe("hm");

    // Ensure 'harga' was NOT marked as filler
    expect(mockWords.find((w) => w.word === "harga")?.isFiller).toBe(false);
    expect(mockWords.find((w) => w.word === "ee")?.isFiller).toBe(true);
  });

  it("should detect multi-word filler phrases (e.g. 'begitu ya ya', 'apa namanya')", () => {
    const mockWords: WordTimestamp[] = [
      { word: "Sebenarnya", start: 0.0, end: 0.5 },
      { word: "apa", start: 0.55, end: 0.8 },
      { word: "namanya", start: 0.85, end: 1.2 },
      { word: "pasar", start: 1.25, end: 1.6 },
      { word: "sedang", start: 1.65, end: 2.0 },
      { word: "bullish", start: 2.05, end: 2.5 },
    ];

    const fillers = detectTokenFillers(mockWords);

    expect(fillers.length).toBe(1);
    expect(fillers[0].text).toBe("apa namanya");
    expect(fillers[0].startSec).toBe(0.55);
    expect(fillers[0].endSec).toBe(1.2);
  });

  it("should calculate keep intervals correctly when cutting exclusion segments", () => {
    const clipStart = 10.0;
    const clipEnd = 30.0; // 20s total

    const exclusions = [
      { startSec: 14.0, endSec: 15.0 }, // Cut 4.0s - 5.0s relative
      { startSec: 22.0, endSec: 23.5 }, // Cut 12.0s - 13.5s relative
    ];

    const keepIntervals = calculateKeepIntervals(clipStart, clipEnd, exclusions);

    expect(keepIntervals.length).toBe(3);

    // First interval: 0 to 4.0
    expect(keepIntervals[0].start).toBe(0);
    expect(keepIntervals[0].end).toBe(4.0);

    // Second interval: 5.0 to 12.0
    expect(keepIntervals[1].start).toBe(5.0);
    expect(keepIntervals[1].end).toBe(12.0);

    // Third interval: 13.5 to 20.0
    expect(keepIntervals[2].start).toBe(13.5);
    expect(keepIntervals[2].end).toBe(20.0);
  });
});
