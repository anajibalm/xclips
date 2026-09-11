import { describe, expect, it } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import {
  BAKOM_GOLD,
  BAKOM_INTRO,
  BAKOM_NAVY,
  BAKOM_SUBTITLE,
  BAKOM_V5,
  buildBakomAss,
  buildS3EventTimeline,
  buildTimedCues,
  endcardChannelLines,
  endcardCtaLayout,
  enforceCueDurations,
  fitHeadlineSize,
  formatSourceCredit,
  parsePresentationMode,
  reconstructWords,
  suppressCuesDuring,
  toTitleCase,
  verifySpeechCoverage,
  wrapCueWords,
} from "@/lib/xclips/bakom-presentation";

describe("S3.2 BAKOM presentation primitives", () => {
  it("freezes official V5 geometry and timing", () => {
    expect(BAKOM_V5.block).toEqual({ x: 66, y: 1090, w: 760, h: 150, radius: 12 });
    expect(BAKOM_V5.windowSec).toEqual([3.0, 6.5]);
    expect(BAKOM_V5.visibleSec).toBe(3.5);
    expect(BAKOM_SUBTITLE.blockBottomEdgeY).toBe(1500);
    expect(BAKOM_GOLD).toBe("#E6BF70");
    expect(BAKOM_NAVY).toBe("#122B4E");
  });

  it("title-cases subtitle text without reordering words", () => {
    expect(toTitleCase("REAKSI TERHADAP KEBAKARAN")).toBe("Reaksi Terhadap Kebakaran");
  });

  it("wraps cues at 32 chars preserving order and timing", () => {
    const cues = wrapCueWords([
      { word: "Satu", start: 0, end: 1 },
      { word: "dua", start: 1, end: 2 },
      { word: "tiga-empat-lima-enam-tujuh", start: 2, end: 3 },
    ]);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0].text.split(" ").length).toBeLessThanOrEqual(6);
    expect(cues.flatMap((c) => c.text.split(" ")).join(" ")).toContain("tiga-empat");
  });

  it("suppresses cues during V5 and resumes after", () => {
    const cues = [
      { text: "a", startSec: 0, endSec: 1 },
      { text: "b", startSec: 3.5, endSec: 4 },
      { text: "c", startSec: 7, endSec: 8 },
    ];
    const kept = suppressCuesDuring(cues, [{ start: 3.0, end: 6.5 }]);
    expect(kept.map((c) => c.text)).toEqual(["a", "c"]);
  });

  it("enforces official cue durations without reordering", () => {
    const out = enforceCueDurations([{ text: "a b", startSec: 0, endSec: 0.5 }]);
    expect(out[0].endSec - out[0].startSec).toBeGreaterThanOrEqual(1.2);
  });

  it("fits headline size within official bounds", () => {
    const size = fitHeadlineSize("Reaksi terhadap Kebakaran Hutan", 900, (t, s) => t.length * s * 0.6);
    expect(size).toBeLessThanOrEqual(104);
    expect(size).toBeGreaterThanOrEqual(75);
  });

  it("writes official ASS with navy box and bottom pin", () => {    const outPath = path.join("/tmp", `s32-ass-${Date.now()}.ass`);
    const result = buildBakomAss([{ text: "HALO DUNIA", startSec: 0, endSec: 2 }], outPath);
    expect(result.success).toBe(true);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("Nunito Sans,52");
    expect(content).toContain("BorderStyle, Outline");
    expect(content).toContain(",3,0,0,2,");
    expect(content).toContain("Halo Dunia");
    fs.unlinkSync(outPath);
  });
});

describe("S3.3 two presentation modes, one timeline", () => {
  it("accepts only official and hybrid", () => {
    expect(parsePresentationMode("official")).toBe("official");
    expect(parsePresentationMode("hybrid")).toBe("hybrid");
    expect(() => parsePresentationMode("cinematic")).toThrow();
    expect(() => parsePresentationMode("")).toThrow();
  });

  it("shares one event timeline across modes", () => {
    const timeline = buildS3EventTimeline(46.15);
    expect(timeline).toEqual([
      { type: "hook", start: 0, end: 3 },
      {
        type: "lower_third",
        start: 3,
        end: 6.5,
        name: "Prabowo Subianto",
        role: "Presiden Republik Indonesia",
      },
      { type: "end_card", start: 46.15, end: 50.15 },
    ]);
  });

  it("V5 window suppresses subtitles and resume follows", () => {
    const cues = [
      { text: "a", startSec: 0, endSec: 2 },
      { text: "b", startSec: 4, endSec: 5 },
      { text: "c", startSec: 7, endSec: 8 },
    ];
    const kept = suppressCuesDuring(cues, [{ start: 3.0, end: 6.5 }]);
    expect(kept.map((c) => c.text)).toEqual(["a", "c"]);
  });

  it("splits long cues only at aligned word boundaries", () => {
    const words = [
      { word: "satu", start: 0, end: 1 },
      { word: "dua", start: 1, end: 2 },
      { word: "tiga", start: 2, end: 3 },
      { word: "empat", start: 3, end: 4 },
    ];
    const out = enforceCueDurations(
      [{ text: "satu dua tiga empat", startSec: 0, endSec: 4 }],
      1.2,
      3.5,
      words,
    );
    expect(out).toHaveLength(2);
    expect(out[0].endSec).toBe(2);
    expect(out[1].startSec).toBe(2);
    // No synthetic midpoint: boundary equals a real word edge.
    expect(out[0].endSec).toBe(words[1].end);
  });

  it("keeps long cues whole when word timings are unavailable", () => {
    const out = enforceCueDurations([{ text: "satu dua tiga empat", startSec: 0, endSec: 4 }]);
    expect(out).toHaveLength(1);
  });

  it("subtitle constants are mode-independent", () => {
    expect(BAKOM_SUBTITLE.sizePx).toBe(52);
    expect(BAKOM_SUBTITLE.maxCharsPerLine).toBe(32);
    expect(BAKOM_SUBTITLE.blockBottomEdgeY).toBe(1500);
  });
});

describe("S3.3 hybrid composition", () => {
  it("hybrid zones keep headline, footage, and caption bands disjoint", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    const headlineBottom = mod.BAKOM_HYBRID.headlineTop + 296;
    expect(headlineBottom).toBeLessThanOrEqual(mod.BAKOM_HYBRID.mediaTop);
    expect(mod.BAKOM_HYBRID.mediaTop + mod.BAKOM_HYBRID.mediaSize).toBeLessThanOrEqual(
      mod.BAKOM_HYBRID.captionTop,
    );
  });

  it("hybrid reuses official palette, never legacy red", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    const dumped = JSON.stringify([mod.BAKOM_GOLD, mod.BAKOM_NAVY, mod.BAKOM_HYBRID]);
    expect(dumped).not.toContain("#D71920");
    expect(dumped).toContain("#E6BF70");
  });
});

describe("S3.4 full official parity", () => {
  it("registers all 10 official modules with source functions", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    for (const id of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"]) {
      const spec = mod.getBakomModuleSpec(id);
      expect(spec.sourceHtmlFunction.length).toBeGreaterThan(0);
    }
    expect(() => mod.getBakomModuleSpec("v11")).toThrow();
  });

  it("freezes exact official tokens and safe-zone guide policy", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    expect(mod.BAKOM_CANVAS).toEqual({ width: 1080, height: 1920 });
    expect(mod.BAKOM_SAFE_ZONE).toEqual({ topPx: 250, bottomPx: 420, marginX: 90 });
    expect(mod.BAKOM_GOLD_DEEP).toBe("#AA8544");
    expect(mod.BAKOM_BLUE).toBe("#154277");
    expect(mod.BAKOM_SAFE_ZONE_GUIDE_VISIBLE).toBe(false);
    expect(mod.BAKOM_LEGACY_RED).toBe("#D71920");
  });

  it("V3/V4 share one subtitle system; V4 only adds gold phrase", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    expect(mod.getBakomModuleSpec("v3").replacesSubtitle).toBe(false);
    expect(mod.getBakomModuleSpec("v4").replacesSubtitle).toBe(false);
    expect(mod.getBakomModuleSpec("v5").replacesSubtitle).toBe(true);
    expect(mod.getBakomModuleSpec("v7").replacesSubtitle).toBe(true);
    const outPath = `/tmp/s34-v4-${Date.now()}.ass`;
    const cues = [
      { text: "kita gunakan prinsip", startSec: 0, endSec: 2 },
      { text: "lebih baik", startSec: 2, endSec: 4 },
    ];
    expect(mod.buildBakomAss(cues, outPath, "prinsip").success).toBe(true);
    const content = (await import("fs")).readFileSync(outPath, "utf-8");
    const goldLines = content.split("\n").filter((l) => l.includes("1c&H"));
    expect(goldLines).toHaveLength(1);
    expect(goldLines[0]).toContain("Prinsip");
    (await import("fs")).unlinkSync(outPath);
  });

  it("location is required only for field footage", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    expect(mod.isLocationRequired(true)).toBe(true);
    expect(mod.isLocationRequired(false)).toBe(false);
  });

  it("V10 is always required and V6 carries one stat", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    expect(mod.BAKOM_V10.appendSec).toBe(4.0);
    expect(mod.BAKOM_V6.countUpMs).toBe(700);
    expect(mod.BAKOM_V6.number.sizePx).toBe(230);
  });
});

describe("S3.4b production module entry", () => {
  it("renders all 10 module types from one entry point", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    const jobs: Array<[string, Record<string, string>]> = [
      ["hook", { headline: "Uji Coba Modul" }],
      ["subtitle", {}],
      ["subtitle_emphasis", { phrase: "uji" }],
      ["lower_third", { name: "Nama", role: "Jabatan" }],
      ["stat", { value: "25", label: "jam" }],
      ["quote", { quote: "Kutipan", attribution: "Nama · Peran" }],
      ["location", { label: "Lokasi · Tanggal" }],
      ["map", { caption: "Lokasi" }],
      ["end_card", {}],
    ];
    for (const [type, content] of jobs) {
      const job = mod.renderBakomModule({ type: type as never, content, start: 0, end: 1 });
      expect(job.start).toBe(0);
      expect(job.end).toBe(1);
    }
    expect(() => mod.renderBakomModule({ type: "glitch" as never, content: {}, start: 0, end: 1 })).toThrow();
    expect(() => mod.renderBakomModule({ type: "quote", content: {}, start: 0, end: 1 })).toThrow();
  });

  it("counts V6 linearly to final at 700ms", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    expect(mod.countUpValue(25, 0)).toBe(0);
    expect(mod.countUpValue(25, 350)).toBe(12.5);
    expect(mod.countUpValue(25, 700)).toBe(25);
    expect(mod.countUpValue(25, 5000)).toBe(25);
  });

  it("derives V7/V8 replacement and eligibility from events", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    const windows = mod.subtitleSuppressionWindows([
      { type: "hook", start: 0, end: 3 },
      { type: "lower_third", start: 3, end: 6.5 },
      { type: "quote", start: 10, end: 14 },
      { type: "end_card", start: 46, end: 50 },
    ]);
    expect(windows).toEqual([{ start: 3, end: 6.5 }, { start: 10, end: 14 }]);
    expect(mod.isLocationRequired(true)).toBe(true);
    expect(mod.isLocationRequired(false)).toBe(false);
  });
});

describe("S3.5 shared production renderer", () => {
  // External parity fixture lives outside the repo: these tests run only
  // when explicitly pointed at it, otherwise they skip. No machine paths here.
  const s35Dir = process.env.XCLIPS_S35_DIR ?? "";
  const s35Python = process.env.XCLIPS_S35_PYTHON ?? "";
  const s35Files = ["parity.py", "render_production.py"].map((f) => (s35Dir ? path.join(s35Dir, f) : ""));
  const s35Ok = s35Dir !== "" && s35Python !== "" && s35Files.every((f) => f !== "" && fs.existsSync(f)) && fs.existsSync(s35Python);
  const itS35 = s35Ok ? it : it.skip;

  itS35("proof and production resolve to bakom_render module", async () => {
    const fs = await import("fs");
    for (const file of s35Files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).toContain("bakom_render");
    }
    const prod = fs.readFileSync(path.join(s35Dir, "render_production.py"), "utf-8");
    expect(prod).not.toMatch(/drawbox|drawtext|ass=/);
  });

  itS35("TypeScript official constants match the shared Python renderer", async () => {
    const { execFileSync } = await import("child_process");
    const mod = await import("@/lib/xclips/bakom-presentation");
    const dump = execFileSync(
      s35Python,
      [
        "-c",
        "import json, bakom_render as R; print(json.dumps({'gold': '#%02X%02X%02X' % R.GOLD, 'navy': '#%02X%02X%02X' % R.NAVY, 'size': R.SUBTITLE['size'], 'bottom': R.SUBTITLE['bottom'], 'v5': [R.V5['x'], R.V5['y'], R.V5['w'], R.V5['h']]}))",
      ],
      { cwd: s35Dir },
    );
    const py = JSON.parse(String(dump));
    expect(py.gold).toBe(mod.BAKOM_GOLD);
    expect(py.navy).toBe(mod.BAKOM_NAVY);
    expect(py.size).toBe(mod.BAKOM_SUBTITLE.sizePx);
    expect(py.bottom).toBe(mod.BAKOM_SUBTITLE.blockBottomEdgeY);
    expect(py.v5).toEqual([mod.BAKOM_V5.block.x, mod.BAKOM_V5.block.y, mod.BAKOM_V5.block.w, mod.BAKOM_V5.block.h]);
  });

  it("wrap limits cues to two official lines", async () => {
    const mod = await import("@/lib/xclips/bakom-presentation");
    const words = "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh".split(" ").map((word, i) => ({ word, start: i, end: i + 1 }));
    for (const cue of mod.wrapCueWords(words)) {
      expect(mod.countWrappedLines(cue.text.split(" ").map((word) => ({ word, start: 0, end: 0 })), 32)).toBeLessThanOrEqual(2);
    }
  });
});

describe("S3 finalization metadata and coverage", () => {
  it("intro owns exactly the first 3 seconds", async () => {
    expect(BAKOM_INTRO.durationSec).toBe(3);
  });

  it("keeps source name and publisher handle as separate concepts", async () => {
    const meta = { sourceName: "Metro TV", publisherHandle: "@bakom_ri" };
    expect(meta.sourceName).not.toContain("@");
    expect(meta.publisherHandle).toContain("@");
    expect(formatSourceCredit(meta)).toBe("Metro TV · @bakom_ri");
  });

  it("passes fully covered speech and true pauses", async () => {
    const windows = [
      { start: 0, end: 3, kind: "v1" },
      { start: 3, end: 6.5, kind: "v5" },
      { start: 6.9, end: 9.8, kind: "cue" },
    ];
    const ok = verifySpeechCoverage(
      [
        { word: "a", start: 1.0, end: 1.4 },
        { word: "b", start: 4.0, end: 4.4 },
        { word: "c", start: 7.0, end: 7.5 },
      ],
      windows,
      { start: 0, end: 10 },
    );
    expect(ok.ok).toBe(true);
    expect(ok.gaps).toEqual([]);
  });

  it("fails closed on an uncaptioned sentence and reports its interval", async () => {
    const windows = [
      { start: 0, end: 3, kind: "v1" },
      { start: 6.9, end: 9.8, kind: "cue" },
    ];
    const res = verifySpeechCoverage(
      [
        { word: "ditemukan", start: 4.0, end: 4.5 },
        { word: "nanti", start: 4.6, end: 5.0 },
        { word: "ok", start: 7.0, end: 7.4 },
      ],
      windows,
      { start: 0, end: 10 },
    );
    expect(res.ok).toBe(false);
    expect(res.gaps).toHaveLength(1);
    expect(res.gaps[0].start).toBeLessThanOrEqual(4.0);
    expect(res.gaps[0].end).toBeGreaterThanOrEqual(5.0);
    expect(res.gaps[0].words).toEqual(["ditemukan", "nanti"]);
  });

  it("tolerates boundary snap but not real gaps", async () => {
    const windows = [{ start: 6.9, end: 9.8, kind: "cue" }];
    const snapped = verifySpeechCoverage(
      [{ word: "w", start: 6.75, end: 7.2 }],
      windows,
      { start: 0, end: 10 },
    );
    expect(snapped.ok).toBe(true);
    const gapped = verifySpeechCoverage(
      [{ word: "w", start: 5.0, end: 5.6 }],
      windows,
      { start: 0, end: 10 },
    );
    expect(gapped.ok).toBe(false);
  });
});

describe("S3 correction cue timing", () => {
  it("joins fragments via raw boundary spaces", async () => {
    const words = reconstructWords([
      { text: " Saya", start: 0, end: 1 },
      { text: " re", start: 1, end: 2 },
      { text: "aksi", start: 2, end: 3 },
      { text: " m", start: 3, end: 4 },
      { text: "inta", start: 4, end: 5 },
    ]);
    expect(words.map((w) => w.word)).toEqual(["Saya", "reaksi", "minta"]);
    expect(words[1]).toMatchObject({ start: 1, end: 3 });
    expect(words[2]).toMatchObject({ start: 3, end: 5 });
  });

  it("times accepted cues from true words, absorbing colloquial joins", async () => {
    const cues = buildTimedCues(["Kita Juga", "Di Sana Sini"], [
      { text: " kita", start: 7.3, end: 7.8 },
      { text: " juga", start: 7.8, end: 8.2 },
      { text: " dis", start: 13.0, end: 13.1 },
      { text: "ana", start: 13.1, end: 13.4 },
      { text: " sini", start: 13.4, end: 13.8 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ text: "Kita Juga", start: 7.3, end: 8.2, provenance: "accepted" });
    expect(cues[1]).toMatchObject({ text: "Di Sana Sini", start: 13.0, end: 13.8, provenance: "accepted" });
  });

  it("flags one skipped particle and fails closed otherwise", async () => {
    const cues = buildTimedCues(["Ya Kita", "Prinsip Ya Lebih"], [
      { text: " kita", start: 36.0, end: 36.8 },
      { text: " pr", start: 38.0, end: 38.7 },
      { text: "insip", start: 38.7, end: 39.3 },
      { text: " lebih", start: 39.7, end: 40.8 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0].skippedTokens).toEqual(["ya"]);
    expect(cues[1].skippedTokens).toEqual(["ya"]);
    expect(cues[1]).toMatchObject({ start: 38.0, end: 40.8 });
    expect(() => buildTimedCues(["Tidak Ada Di Sini"], [{ text: " kita", start: 36.0, end: 36.8 }])).toThrow(/unmatched/);
    expect(() => buildTimedCues(["Sama Sekali Tak Cocok Cocok"], [{ text: " kita", start: 36.0, end: 36.8 }])).toThrow(/unmatched/);
  });

  it("accepts one flagged spelling variant for colloquial pronunciation", async () => {
    const cues = buildTimedCues(["Catat Untuk"], [
      { text: " cat", start: 17.6, end: 18.0 },
      { text: "et", start: 18.0, end: 18.2 },
      { text: " untuk", start: 18.6, end: 19.2 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 17.6, end: 19.2 });
    expect(cues[0].spellingVariants).toEqual(["catat→catet"]);
  });
  it("derives transcript-faithful cues for untiled speech, ordered", async () => {
    const cues = buildTimedCues(["Ketiga"], [
      { text: " Saya", start: 0.0, end: 0.9 },
      { text: " lihat", start: 0.9, end: 1.7 },
      { text: " ketiga", start: 5.0, end: 5.8 },
    ]);
    expect(cues.map((c) => c.provenance)).toEqual(["derived", "accepted"]);
    expect(cues[0].text).toBe("Saya Lihat");
    expect(cues[0].start).toBe(0.0);
    expect(cues[0].end).toBe(1.7);
  });

  it("de-overlaps accepted cues sharing a boundary word", async () => {
    const cues = buildTimedCues(["Yang", "Yang Antisipatif"], [
      { text: " yang", start: 24.3, end: 24.9 },
      { text: " ant", start: 24.9, end: 26.2 },
      { text: "isipatif", start: 26.2, end: 29.5 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ text: "Yang", start: 24.3, end: 24.9 });
    expect(cues[1].text).toBe("Yang Antisipatif");
    expect(cues[1].start).toBeGreaterThanOrEqual(24.9);
    expect(cues[1].end).toBe(29.5);
  });
});

describe("S3 correction endcard policy", () => {
  it("keeps handle and footage source as separate lines", async () => {
    expect(endcardChannelLines("@bakom_ri", "Metro TV")).toEqual([
      "Informasi resmi: @bakom_ri",
      "Sumber footage: Metro TV",
    ]);
    expect(endcardChannelLines("@x", "Y", "8 Sep 2026")).toEqual([
      "Informasi resmi: @x",
      "Sumber footage: Y · 8 Sep 2026",
    ]);
  });

  it("collapses single-line CTA to HTML geometry", async () => {
    const one = endcardCtaLayout(1, 80);
    expect(one).toMatchObject({ topY: 760, lead: 77, ruleY: 760 + 77 + 26, channelsY: 760 + 77 + 70 });
    const two = endcardCtaLayout(2, 60);
    expect(two.topY).toBe(760 - 57);
  });
});
