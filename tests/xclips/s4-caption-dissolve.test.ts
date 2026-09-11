import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// S4 regression: captions must use native .id.srt timestamps mapped
// source->program (program = abs - sourceStart), never whisper-ordinal pairing.
// Dissolve math must come from a tested pure helper.

const ROOT = process.cwd();
const CUES = path.resolve(ROOT, "artifacts/slice-4-enriched-bakom-draft/s4-usable-cues.json");
const SRC_START = 5.0;

describe("S4 caption native-srt sync", () => {
  it("cue starts sit on native srt line starts mapped to program time", async () => {
    const { buildNativeSrtCues } = await import("@/lib/xclips/bakom-enrichment");
    const cues = buildNativeSrtCues(readFileSync(path.resolve(ROOT, "vault/xclips/downloads/proj_1789032540688_5jzy/Mencekam! Kebakaran Lahan Gambut di Trans Kalimantan Membesar Saat Tengah Malam ｜ iNews Pagi 8⧸9 [7QzF3NxGltQ].id.srt"), "utf8"), SRC_START, 55.05);
    const artifactCues = JSON.parse(readFileSync(CUES, "utf8")) as Array<{ start: number; end: number; text: string }>;
    expect(cues.length).toBeGreaterThan(10);
    expect(cues).toEqual(artifactCues);
    // first cue covers the program opening with the first sentence
    expect(cues[0].start).toBe(0);
    expect(cues[0].text.startsWith("Besarnya")).toBe(true);
    // native srt line starts (program time) must appear as cue starts;
    // backward tiling preserves starts and only trims ends
    for (const nativeAbs of [14.64, 19.12, 39.12, 49.84]) {
      const prog = nativeAbs - SRC_START;
      expect(cues.some((c) => Math.abs(c.start - prog) < 0.05)).toBe(true);
    }
    // whisper-ordinal times from the old pairing must be gone
    for (const stale of [3.34, 8.18, 10.61, 12.35, 15.92]) {
      expect(cues.some((c) => Math.abs(c.start - stale) < 0.02)).toBe(false);
    }
    // tiled: no overlaps, sorted, inside program
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].start + 1e-9).toBeGreaterThanOrEqual(cues[i - 1].end);
    }
    expect(cues[cues.length - 1].end).toBeLessThanOrEqual(50.05 + 1e-9);
    // spot check: the count-payoff cue keeps native timing
    const payoff = cues.find((c) => c.text.includes("ke-19"));
    expect(payoff).toBeDefined();
    expect(Math.abs(payoff!.start - (49.84 - SRC_START)) < 0.05).toBe(true);
    // structural shape of every cue
    for (const c of cues) {
      const n = c.text.split(" ").length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
      expect(c.end).toBeGreaterThan(c.start);
    }
  });
});

describe("S4 endcard dissolve math", () => {
  it("computes xfade offset and output duration from a pure helper", async () => {
    const mod = await import("@/lib/xclips/bakom-enrichment");
    expect(typeof mod.dissolveAssembly).toBe("function");
    const d = mod.dissolveAssembly({ speechVideoSec: 50.0, endcardSec: 4.0, dissolveSec: 0.35 });
    expect(d.offset).toBeCloseTo(49.65, 6);
    expect(d.outputVideoSec).toBeCloseTo(53.65, 6);
    expect(() => mod.dissolveAssembly({ speechVideoSec: 50.0, endcardSec: 4.0, dissolveSec: 0 })).toThrow();
    expect(() => mod.dissolveAssembly({ speechVideoSec: 50.0, endcardSec: 4.0, dissolveSec: 5 })).toThrow();
  });
});
