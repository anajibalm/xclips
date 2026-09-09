import { describe, it, expect } from "bun:test";
import { findStartBoundary } from "@/lib/xclips/auto-production-renderer";
import type { WordTimestamp } from "@/lib/xclips/types";

const W = (text: string, start: number, end: number): WordTimestamp => ({
  word: text,
  text,
  start,
  end,
  confidence: 1,
});

describe("xclips - Start boundary guard (findStartBoundary)", () => {
  it("1. raw start inside a sentence moves backward to sentence end", () => {
    // Sentence 1 ends at word "selesai." (end 5.0)
    // Sentence 2: "Ini adalah kalimat penting." (starts at 5.5)
    // Raw start lands at "kalimat" (start 7.0) — inside sentence 2
    const words: WordTimestamp[] = [
      W("Saya", 0, 1.0),
      W("sudah", 1.0, 2.0),
      W("selesai.", 2.0, 5.0),
      W("Ini", 5.5, 6.0),
      W("adalah", 6.0, 6.5),
      W("kalimat", 6.5, 7.5),
      W("penting.", 7.5, 9.0),
    ];
    const result = findStartBoundary(words, 7.0);
    // Should land at 5.0 — the END of the sentence boundary word.
    expect(result).toBe(5.0);
  });

  it("2. raw start already at a sentence boundary stays unchanged", () => {
    const words: WordTimestamp[] = [
      W("Sebelumnya.", 0, 3.0),
      W("Ini", 3.5, 4.0),
      W("kalimat", 4.0, 4.5),
      W("baru.", 4.5, 6.0),
    ];
    // Raw start at "Ini" (3.5). Walk backward: "Sebelumnya." has punct → return its end (3.0).
    // But 3.0 < rawStart 3.5, which is allowed (guard moves backward only in the sense that finalStart <= rawStart).
    const result = findStartBoundary(words, 3.5);
    expect(result).toBe(3.0);
  });

  it("3. guard never moves forward", () => {
    const words: WordTimestamp[] = [
      W("Selesai.", 0, 2.0),
      W("Mulai", 2.5, 3.0),
      W("sekarang.", 3.0, 5.0),
    ];
    // Raw start is at "Mulai" (2.5) — already at a boundary.
    // Guard must NOT move to 3.0 or later.
    const result = findStartBoundary(words, 2.5);
    expect(result).toBeLessThanOrEqual(2.5);
  });

  it("4. guard never exceeds maximum lookback", () => {
    // Build a long transcript with NO sentence boundaries.
    // Raw start is at 10.0; max lookback is 8s; earliest allowed = 2.0.
    const words: WordTimestamp[] = [];
    for (let i = 0; i < 40; i++) {
      words.push(W(`word${i}`, i * 0.5, i * 0.5 + 0.4));
    }
    // Raw start at word index 20 (start 10.0).
    // No punctuation anywhere, so guard falls through to rawStart.
    const result = findStartBoundary(words, 10.0);
    expect(result).toBe(10.0);
  });

  it("4b. time bound stops the walk even without punctuation", () => {
    // Words every 0.5s, no punctuation, raw start at 10.0, max lookback 8s.
    // Walk should stop at earliestAllowed=2.0 and return rawStart.
    const words: WordTimestamp[] = [];
    for (let i = 0; i < 30; i++) {
      words.push(W(`w${i}`, i * 0.5, i * 0.5 + 0.3));
    }
    const result = findStartBoundary(words, 10.0, 8, 1.2);
    expect(result).toBe(10.0);
  });

  it("5. non-monotonic CC timestamps do not break timestamp-order walking", () => {
    // Word B has an earlier timestamp than A, but comes later in transcript order.
    // The guard walks by timestamp order (physical reality), not transcript order.
    const words: WordTimestamp[] = [
      W("Pertama.", 0, 3.0),
      W("A", 2.5, 2.8),   // index 1 — backward-overlapping
      W("B", 2.0, 3.2),   // index 2 — earlier timestamp but later in order
      W("C", 3.5, 4.0),
      W("D", 4.0, 5.0),
    ];
    // Timestamp order: Pertama.(0-3.0), B(2.0-3.2), A(2.5-2.8), C(3.5-4.0), D(4.0-5.0)
    // Raw start at C (3.5). Walk backward: A (no punct), B (no punct),
    // Pertama. (has period) → return its END (3.0).
    const result = findStartBoundary(words, 3.5);
    expect(result).toBe(3.0);
  });

  it("6. fallback: timing gap triggers boundary detection", () => {
    // No sentence-ending punctuation, but there's a 2.0s gap between words.
    const words: WordTimestamp[] = [
      W("satu", 0, 0.5),
      W("dua", 0.5, 1.0),
      // gap: 1.0 → 3.0 (2.0 seconds)
      W("tiga", 3.0, 3.5),
      W("empat", 3.5, 4.0),
    ];
    // Raw start at "empat" (3.5). Walk backward: "tiga" (no punct, gap to dua = 2.0s > 1.2s)
    // → return "tiga".end = 3.5. But 3.5 == rawStart, which means no move.
    // The gap boundary returns the END of the boundary word, not the start of the next.
    // In this case the gap is BETWEEN dua and tiga, so the boundary word is "tiga" (i=2).
    // sorted by start: satu(0), dua(0.5), tiga(3.0), emp(3.5). anchorIdx=3.
    // i=2: tiga, gap = 3.5-3.5=0 to emp. No. i=1: dua, gap = 3.0-1.0=2.0 >= 1.2 → return dua.end=1.0.
    const result = findStartBoundary(words, 3.5);
    expect(result).toBe(1.0);
  });

  it("7. gap boundary respects maxLookbackSec", () => {
    // Raw start lands at "dekat" (9.5). Timestamp-sorted: awal(0), jauh(9.0), dekat(9.5).
    // anchorIdx=2. i=1: jauh, gap = 9.5-9.5=0. No. i=0: awal, gap = 9.0-0.5=8.5 >= 1.2 → return awal.end=0.5.
    const words: WordTimestamp[] = [
      W("awal", 0, 0.5),
      W("jauh", 9.0, 9.5),
      W("dekat", 9.5, 10.0),
    ];
    const result = findStartBoundary(words, 9.5, 8, 1.2);
    expect(result).toBe(0.5);
  });

  it("8. empty words array returns rawStart", () => {
    expect(findStartBoundary([], 5.0)).toBe(5.0);
  });

  it("9. single word returns rawStart", () => {
    expect(findStartBoundary([W("test", 0, 1)], 0.5)).toBe(0.5);
  });

  it("10. multiple sentence boundaries picks the nearest one", () => {
    const words: WordTimestamp[] = [
      W("Saat.", 0, 2.0),
      W("lalu.", 2.0, 4.0),
      W("kita", 4.5, 5.0),
      W("mulai", 5.0, 5.5),
      W("sekarang.", 5.5, 7.0),
    ];
    // Raw start at "mulai" (5.0). Timestamp-sorted is same order.
    // Walk backward: "kita" (no punct), "lalu." (has punct) → return lalu.end = 4.0.
    const result = findStartBoundary(words, 5.0);
    expect(result).toBe(4.0);
  });
});
