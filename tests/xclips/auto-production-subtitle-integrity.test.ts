import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { buildAutoProductionAss } from "@/lib/xclips/auto-production-renderer";
import { ACCOUNT_PRESETS } from "@/lib/xclips/auto-production-types";
import { WordTimestamp } from "@/lib/xclips/types";

// ============================================================
// Gate 4 — Subtitle Integrity (order-aware window + clip-end invariant)
// ============================================================
// Spec written against the invariants, not against current output:
//   A. Word selection follows TRANSCRIPT ORDER, not timestamp overlap.
//      Selection stops at the first word (in order) whose end reaches
//      clipEnd. Later words that overlap backwards must not leak in.
//   B. Every emitted event satisfies 0 <= start < end <= clipDuration.
//      The minimum-display-duration floor must never break this.

const PRESET = ACCOUNT_PRESETS.get("shadow")!;
const TMP = path.resolve(process.cwd(), "tmp", "test-subtitle-integrity");

function word(
  text: string,
  start: number,
  end: number,
  overrides?: Partial<WordTimestamp>,
): WordTimestamp {
  return { word: text, start, end, confidence: 1, isFiller: false, excluded: false, ...overrides };
}

interface AssEvent {
  start: number;
  end: number;
  text: string;
}

function assTimeToSec(value: string): number {
  const [h, m, rest] = value.split(":");
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(rest);
}

function readEvents(assPath: string): AssEvent[] {
  return fs
    .readFileSync(assPath, "utf-8")
    .split("\n")
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line) => {
      const fields = line.slice("Dialogue:".length).split(",");
      const text = fields.slice(9).join(",");
      return {
        start: assTimeToSec(fields[1]),
        end: assTimeToSec(fields[2]),
        text: text.replace(/^\{[^}]*\}/, "").trim(),
      };
    });
}

function build(words: WordTimestamp[], clipStart: number, clipEnd: number, name: string): AssEvent[] {
  const assPath = path.join(TMP, `${name}.ass`);
  const result = buildAutoProductionAss(words, clipStart, clipEnd, PRESET, assPath);
  expect(result.success).toBe(true);
  return readEvents(assPath);
}

/**
 * Synthetic backwards-overlap case, generic (no real-source words):
 *   A   ends before the boundary
 *   B.  is the word that REACHES clipEnd
 *   C   comes AFTER B in transcript order but its timestamp
 *       overlaps backwards (starts/ends earlier than B's end)
 */
function backwardsOverlapWords(): WordTimestamp[] {
  return [
    word("A", 8.0, 9.0),
    word("B.", 9.1, 10.0),
    word("C", 8.9, 9.6),
    word("D", 10.1, 11.0),
  ];
}

describe("xclips - Auto Production subtitle integrity (Gate 4)", () => {
  beforeAll(() => {
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(TMP, { recursive: true }); } catch { /* ignore */ }
  });

  // --- A. order-aware word window ----------------------------------------

  it("1. preserves transcript order when CC timestamps overlap backwards", () => {
    const events = build(backwardsOverlapWords(), 8, 10, "order");
    const spoken = events.flatMap((e) => e.text.split(/\s+/)).filter(Boolean);
    expect(spoken).toEqual(["A", "B."]);
  });

  it("2. a later word overlapping backwards does not leak past the boundary word", () => {
    const events = build(backwardsOverlapWords(), 8, 10, "leak");
    expect(events.map((e) => e.text).join(" ")).not.toContain("C");
  });

  it("3. keeps the closure/boundary word that reaches clipEnd", () => {
    const events = build(backwardsOverlapWords(), 8, 10, "closure");
    expect(events.map((e) => e.text).join(" ")).toContain("B.");
  });

  it("4. drops no word that precedes the boundary in transcript order", () => {
    const words = [
      word("Satu", 0.0, 1.0),
      word("dua", 1.0, 2.0),
      word("tiga", 2.0, 3.0),
      word("empat.", 3.0, 4.0),
      word("lima", 2.5, 3.5),
    ];
    const spoken = build(words, 0, 4, "no-drop")
      .flatMap((e) => e.text.split(/\s+/))
      .filter(Boolean);
    expect(spoken).toEqual(["SATU", "DUA", "TIGA", "EMPAT."]);
  });

  it("4b. an out-of-order word BEFORE the boundary is still kept", () => {
    const words = [
      word("Satu", 0.0, 1.0),
      word("dua", 0.8, 1.6),
      word("tiga.", 1.2, 3.0),
      word("empat", 3.0, 3.8),
    ];
    const spoken = build(words, 0, 3, "inner-overlap")
      .flatMap((e) => e.text.split(/\s+/))
      .filter(Boolean);
    expect(spoken).toEqual(["SATU", "DUA", "TIGA."]);
  });

  // --- B. hard clip-end invariant ----------------------------------------

  it("5. emits zero overlapping events", () => {
    const words = [
      word("Satu", 0, 2),
      word("Dua", 1, 3),
      word("Tiga", 2.5, 4),
    ];
    const events = build(words, 0, 5, "overlap");
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].start).toBeGreaterThanOrEqual(events[i - 1].end);
    }
  });

  it("6. every event satisfies 0 <= start < end <= clipDuration", () => {
    const clipStart = 132;
    const clipEnd = 180.92;
    const clipDuration = clipEnd - clipStart;
    const words = [
      word("Awal", 132.0, 134.0),
      word("tengah", 150.0, 152.0),
      word("akhir.", 178.71, 180.92),
      word("Bocor", 178.6, 179.93),
    ];
    const events = build(words, clipStart, clipEnd, "invariant");
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.start).toBeGreaterThanOrEqual(0);
      expect(e.end).toBeGreaterThan(e.start);
      expect(e.end).toBeLessThanOrEqual(clipDuration + 1e-6);
    }
    expect(events.at(-1)!.text).toContain("AKHIR.");
  });

  it("7. the minimum cue duration can never push an event past clipDuration", () => {
    // Final word ends exactly at clipEnd and is shorter than the 0.5s floor.
    const clipStart = 0;
    const clipEnd = 3.2;
    const words = [
      word("Satu", 0.0, 1.0),
      word("dua.", 1.0, 2.0),
      word("Tiga", 3.0, 3.2),
    ];
    const events = build(words, clipStart, clipEnd, "min-duration");
    for (const e of events) {
      expect(e.end).toBeLessThanOrEqual(clipEnd - clipStart + 1e-6);
      expect(e.end).toBeGreaterThan(e.start);
    }
  });

  it("7b. drops an event whose clamped span would be non-positive", () => {
    // Second phrase starts at the clip boundary → nothing left to show.
    const words = [
      word("Satu", 0.0, 2.0),
      word("dua.", 2.0, 4.0),
      word("Tiga", 4.0, 4.0),
    ];
    const events = build(words, 0, 4, "degenerate");
    for (const e of events) expect(e.end).toBeGreaterThan(e.start);
    expect(events.map((e) => e.text).join(" ")).not.toContain("TIGA");
  });

  // --- unchanged behavior guard ------------------------------------------

  it("8. keeps subtitle anchor, styling and max-words rules unchanged", () => {
    const assPath = path.join(TMP, "style.ass");
    const words = [
      word("satu", 0, 0.5),
      word("dua", 0.6, 1.0),
      word("tiga", 1.1, 1.5),
      word("empat", 1.6, 2.0),
      word("lima", 2.1, 2.5),
      word("enam", 2.6, 3.0),
      word("tujuh", 3.1, 3.5),
    ];
    const result = buildAutoProductionAss(words, 0, 5, PRESET, assPath);
    expect(result.success).toBe(true);
    const content = fs.readFileSync(assPath, "utf-8");
    expect(content).toContain("\\an8\\pos(540,1476)");
    expect(content).toContain(`Style: Default,${PRESET.captionStyle.fontFamily},${PRESET.captionStyle.fontSizePx},`);
    const events = readEvents(assPath);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.text).toBe(e.text.toUpperCase());
      expect(e.text.split(/\s+/).length).toBeLessThanOrEqual(PRESET.captionStyle.maxWordsPerPhrase);
    }
  });

  it("8b. still excludes fillers and still writes a bare header when nothing is in range", () => {
    const withFiller = build(
      [word("Warga", 0, 0.9), word("eh", 1, 1.2, { isFiller: true }), word("di", 1.3, 1.5)],
      0,
      5,
      "filler",
    );
    expect(withFiller.map((e) => e.text).join(" ")).not.toContain("EH");

    const emptyPath = path.join(TMP, "empty.ass");
    const emptyResult = buildAutoProductionAss([word("Warga", 20, 21)], 0, 5, PRESET, emptyPath);
    expect(emptyResult.success).toBe(true);
    const emptyContent = fs.readFileSync(emptyPath, "utf-8");
    expect(emptyContent).toContain("[Script Info]");
    expect(emptyContent).not.toContain("Dialogue:");
  });
});
