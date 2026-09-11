import { describe, expect, it } from "bun:test";

// S4 regression: captions must use native .id.srt timestamps mapped
// source->program (program = abs - sourceStart), never whisper-ordinal pairing.
// Dissolve math must come from a tested pure helper.

const SYNTHETIC_SRT = `1
00:00:10,500 --> 00:00:14,400
Satu dua tiga empat lima enam tujuh delapan

2
00:00:14,500 --> 00:00:17,500
Sembilan sepuluh sebelas dua belas`;

const EXPECTED_CUES = [
  { start: 0, end: 3.3, text: "Satu dua tiga empat lima enam" },
  { start: 3.3, end: 4.4, text: "tujuh delapan" },
  { start: 4.5, end: 7.5, text: "Sembilan sepuluh sebelas dua belas" },
];

describe("S4 caption native-srt sync", () => {
  it("rebases native SRT bounds into monotonic <=6-word cues", async () => {
    const { buildNativeSrtCues } = await import("@/lib/xclips/bakom-enrichment");
    const cues = buildNativeSrtCues(SYNTHETIC_SRT, 10, 20);
    expect(cues).toEqual(EXPECTED_CUES);
    expect(cues[0].start).toBe(0);
    expect(cues[cues.length - 1].end).toBeLessThanOrEqual(10);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].start + 1e-9).toBeGreaterThanOrEqual(cues[i - 1].end);
    }
    for (const c of cues) {
      const n = c.text.split(" ").length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
      expect(c.end).toBeGreaterThan(c.start);
    }
    expect(() => buildNativeSrtCues(SYNTHETIC_SRT, 20, 10)).toThrow();
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
