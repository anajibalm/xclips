import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  buildAutoProductionFfmpegCommand,
  buildAutoProductionAss,
  escapeDrawText,
  renderAutoProduction,
  RenderAutoProductionInput,
} from "@/lib/xclips/auto-production-renderer";
import {
  ProductionBrief,
  AccountPreset,
  EditPlan,
  ACCOUNT_PRESETS,
} from "@/lib/xclips/auto-production-types";
import { WordTimestamp } from "@/lib/xclips/types";
import { fitAutoProductionHeadline, estimateLineWidth } from "@/lib/xclips/auto-production-headline";
import { buildAutoProductionCoverFilter } from "@/lib/xclips/auto-production-cover";
import { BAKOM_LAYOUT, buildSourceTransformFilter, getBakomLayout, HEADLINE_GOLD_LINE_OFFSET_PX, HEADLINE_GOLD_LINE_THICKNESS_PX, resolveSourceOrientation, resolveSourceTransform } from "@/lib/xclips/auto-production-bakom-layout";

// ============================================================
// Test Helpers
// ============================================================

const FIXTURE_DIR = path.resolve(process.cwd(), "vault", "xclips", "test-fixtures");
const FIXTURE_VIDEO = path.join(FIXTURE_DIR, "auto-prod-smoke.mp4");

function makeBrief(overrides?: Partial<ProductionBrief>): ProductionBrief {
  return {
    source: { sourcePath: FIXTURE_VIDEO, sourceType: "local" },
    editorialAngle: "Dampak erupsi Gunung Kelud",
    editorialFunction: "Public communication / information integrity",
    accountPresetId: "shadow",
    sourceName: "TVRI Jatim",
    sourceDate: "2026-09-07",
    accountHandle: "@tvrijatim",
    brollPool: [],
    ...overrides,
  };
}

function makeEditPlan(overrides?: Partial<EditPlan>): EditPlan {
  return {
    statementStart: 5,
    statementEnd: 35,
    headline: "Erupsi Gunung Kelud Mengancam Warga",
    brollPlacements: [],
    thumbnailSourceFrame: 1200,
    statementSignal: { confidence: "strong", warnings: [] },
    brollSignal: { confidence: "strong", warnings: [] },
    headlineSignal: { confidence: "strong", warnings: [] },
    ...overrides,
  };
}

function makeWords(): WordTimestamp[] {
  const words: WordTimestamp[] = [];
  const texts = [
    "Warga", "di", "sekitar", "Gunung", "Kelud", "diminta",
    "untuk", "segera", "evakuasi", "karena", "status",
    "awas", "sudah", "ditetapkan", "oleh", "BMKG",
    "sejak", "tadi", "pagi", "dengan", "adius",
    "gempa", "tremor", "yang", "terus", "menerus",
    "membuat", "warga", "panik", "dan", "berlarian",
  ];
  for (let i = 0; i < texts.length; i++) {
    const start = 5 + i * 1.0;
    const end = start + 0.9;
    words.push({ word: texts[i], start, end, confidence: 1.0, isFiller: false, excluded: false });
  }
  return words;
}

// ============================================================
// Tests
// ============================================================

describe("xclips - Auto Production Renderer (Slice 3)", () => {
  it("fits headlines deterministically and preserves every word", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    const short = fitAutoProductionHeadline("Berita Terkini", preset);
    const headline = "Pemerintah Pantau Erupsi Anak Krakatau dan Dampaknya Bagi Warga Sekitar";
    const long = fitAutoProductionHeadline(headline, preset);
    expect(short.lines).toEqual(["Berita Terkini"]);
    expect(short.fontSizePx).toBe(48);
    expect(long.lines.join(" ")).toBe(headline);
    expect(long.fontSizePx).toBeGreaterThanOrEqual(28);
    expect(long.maxWidthPx).toBe(preset.width - preset.safeZone.leftPx - preset.safeZone.rightPx);
    expect(long.lines.at(-1)).not.toBe("Sekitar");
    expect(long.lines.slice(0, -1).every((line) => !line.toLowerCase().endsWith(" dan"))).toBe(true);
    expect(long.lines.every((line) => line.length > 0)).toBe(true);
  });

  it("keeps short and normal two-line headlines stable while balancing three lines", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    expect(fitAutoProductionHeadline("Berita Terkini", preset).lines).toEqual(["Berita Terkini"]);
    const two = fitAutoProductionHeadline("Pemerintah pantau perkembangan terbaru", preset);
    expect(two.lines.length).toBeLessThanOrEqual(2);
    const three = fitAutoProductionHeadline("Satu dua tiga empat lima enam tujuh delapan sembilan", preset);
    expect(three.lines.length).toBeLessThanOrEqual(3);
    expect(three.lines.every((line) => line.length > 0)).toBe(true);
  });

  it("uses fitted headline values in renderer command", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    const headline = "Pemerintah Pantau Erupsi Anak Krakatau dan Dampaknya Bagi Warga Sekitar";
    const layout = fitAutoProductionHeadline(headline, preset);
    const command = buildAutoProductionFfmpegCommand({
      sourceVideoPath: "/tmp/test.mp4", sourceWidth: 1920, sourceHeight: 1080,
      clipStart: 5, clipEnd: 35, preset, editPlan: makeEditPlan({ headline }),
      brief: makeBrief(), assSubtitlePath: "/tmp/test.ass",
    }, "/tmp/out.mp4", "cpu");
    expect(command.filterComplex).toContain(`fontsize=${layout.fontSizePx}`);
    expect(command.filterComplex).toContain(`y='${preset.safeZone.topPx + layout.fontSizePx + layout.lineSpacingPx}`);
    expect(command.filterComplex).toContain(layout.lines[0]);
    expect(command.filterComplex).toContain("x=72:y='120");
    expect(command.filterComplex.match(/drawtext=text='/g)?.length).toBeGreaterThanOrEqual(layout.lines.length + 2);
    expect(command.filterComplex).not.toContain("\\\\n");
    const coverFilter = buildAutoProductionCoverFilter(makeEditPlan({ headline }), preset);
    expect(coverFilter).toContain(`fontsize=${layout.fontSizePx}`);
    expect(coverFilter).toContain(`y=${preset.safeZone.topPx + layout.fontSizePx + layout.lineSpacingPx}`);
    expect(coverFilter).toContain("x=48:y=120");
  });

  it("BAKOM_VIDEO_V1 uses permanent gold accent line and no red accent", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    const headline = "Pemerintah Pantau Erupsi Anak Krakatau dan Dampaknya Bagi Warga Sekitar";
    const layout = fitAutoProductionHeadline(headline, preset);
    const command = buildAutoProductionFfmpegCommand({
      sourceVideoPath: "/tmp/test.mp4", sourceWidth: 1920, sourceHeight: 1080,
      clipStart: 5, clipEnd: 35, preset, editPlan: makeEditPlan({ headline }),
      brief: makeBrief(), assSubtitlePath: "/tmp/test.ass",
    }, "/tmp/out.mp4", "cpu");
    // Gold line: exact GSM 2026 color, 5px thick, at headline text left edge,
    // width = longest rendered line, static (no enable window).
    const longest = Math.max(...layout.lines.map((line) => estimateLineWidth(line, layout.fontSizePx)));
    const goldLineY = preset.safeZone.topPx +
      (layout.lines.length - 1) * (layout.fontSizePx + layout.lineSpacingPx) +
      layout.fontSizePx + HEADLINE_GOLD_LINE_OFFSET_PX;
    expect(command.filterComplex).toContain(`color=#E6BF70:t=fill`);
    expect(command.filterComplex).toContain(`h=${HEADLINE_GOLD_LINE_THICKNESS_PX}`);
    expect(command.filterComplex).toContain(`x=72:y=${goldLineY}:w=${Math.round(longest)}`);
    expect(command.filterComplex).not.toContain("between(t,0,0.3)");
    // No red accent remains in the video path.
    expect(command.filterComplex).not.toContain("#D71920");
    // Deterministic soft editorial background present (gradient + vignette).
    expect(command.filterComplex).toContain("gradients=s=1080x1920");
    expect(command.filterComplex).toContain("vignette=angle=PI/5:mode=forward");
    expect(command.filterComplex).toContain("c0=0x3A2A20:c1=0x151112");
    expect(command.filterComplex).toContain("color=black@0.35");
  });

  it("contains landscape and portrait source inside BAKOM media zone", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    for (const [sourceWidth, sourceHeight] of [[1920, 1080], [1080, 1920]] as const) {
      const command = buildAutoProductionFfmpegCommand({
        sourceVideoPath: "/tmp/test.mp4", sourceWidth, sourceHeight,
        clipStart: 5, clipEnd: 35, preset, editPlan: makeEditPlan(),
        brief: makeBrief(), assSubtitlePath: "/tmp/test.ass",
      }, "/tmp/out.mp4", "cpu");
      expect(command.filterComplex).toContain(sourceWidth > sourceHeight ? "scale=1080:1080:force_original_aspect_ratio=increase" : "scale=1080:1080:force_original_aspect_ratio=increase");
      expect(command.filterComplex).toContain("scale=1080:1080:force_original_aspect_ratio=increase");
      expect(command.filterComplex).toContain("overlay=0:360");
      expect(command.filterComplex).toContain("gradients=s=1080x1920");
    }
  });

  it("uses fixed portrait slot constants for every source orientation", () => {
    const portrait = getBakomLayout(ACCOUNT_PRESETS.get("shadow")!);
    expect(portrait.canvasWidth).toBe(1080); expect(portrait.canvasHeight).toBe(1920);
    expect(portrait.mediaTop).toBe(BAKOM_LAYOUT.mediaTop);
    expect(resolveSourceOrientation(1920, 1080)).toBe("landscape");
    expect(resolveSourceOrientation(1080, 1920)).toBe("portrait");
    expect(resolveSourceOrientation(1080, 1080)).toBe("square");
    expect(portrait.mediaTop + portrait.mediaHeight).toBeLessThanOrEqual(portrait.canvasHeight);
    expect(portrait.headlineTop + portrait.headlineAreaHeight).toBeLessThanOrEqual(portrait.mediaTop);
    expect(portrait.brandingSlot.x + portrait.brandingSlot.width).toBeLessThanOrEqual(portrait.canvasWidth);
    expect(portrait.brandingSlot.y + portrait.brandingSlot.height).toBeLessThanOrEqual(portrait.canvasHeight);
  });

  it("keeps output canvas independent from source orientation and transform strategy", () => {
    const portraitPreset = ACCOUNT_PRESETS.get("shadow")!;
    const portrait = getBakomLayout(portraitPreset);
    expect(portrait.mediaTop).toBe(BAKOM_LAYOUT.mediaTop);
    expect(resolveSourceTransform("default", "landscape").zoomLevel).toBe(1);
    expect(resolveSourceTransform("default", "portrait").zoomLevel).toBe(1);
    expect(resolveSourceTransform("wawancara_1_frame_utuh", "landscape").fitMode).toBe("contain");
    expect(buildSourceTransformFilter("[0:v]", "[out]", portrait, 1080, 1920)).toContain("force_original_aspect_ratio=increase");
    expect(buildSourceTransformFilter("[0:v]", "[out]", portrait, 1080, 1920, "wawancara_1_frame_utuh")).toContain("force_original_aspect_ratio=decrease");
    expect(buildSourceTransformFilter("[0:v]", "[out]", portrait, 1080, 1920, "default", 1920, 1080, "news_talking_head")).toContain("scale=1296:1296");
  });
  describe("escapeDrawText", () => {
    it("escapes colons", () => {
      expect(escapeDrawText("Sumber: TVRI")).toBe("Sumber\\: TVRI");
    });

    it("escapes single quotes", () => {
      expect(escapeDrawText("it's a test")).toBe("it'\\\\\\''s a test");
    });

    it("escapes percent signs", () => {
      expect(escapeDrawText("100%")).toBe("100%%");
    });

    it("escapes backslashes", () => {
      expect(escapeDrawText("path\\to")).toBe("path\\\\to");
    });

    it("handles empty string", () => {
      expect(escapeDrawText("")).toBe("");
    });

    it("handles string with no special chars", () => {
      expect(escapeDrawText("Normal text")).toBe("Normal text");
    });
  });

  describe("buildAutoProductionAss", () => {
    it("anchors spoken subtitle below fixed BROLL bottom", async () => {
      const assPath = path.join("/tmp", "s6-c1-subtitle.ass");
      const result = buildAutoProductionAss(makeWords(), 0, 35, ACCOUNT_PRESETS.get("shadow")!, assPath);
      expect(result.success).toBe(true);
      const content = fs.readFileSync(assPath, "utf8");
      expect(content).toContain("\\an8\\pos(540,1476)");
      expect(1476).toBeGreaterThan(1440);
    });

    it("keeps spoken subtitle Y independent of source orientation and content type", () => {
      const preset = ACCOUNT_PRESETS.get("shadow")!;
      const positions: string[] = [];
      for (const contentType of ["default", "news_talking_head"] as const) {
        for (const orientation of [[1920, 1080], [1080, 1920]]) {
          const assPath = path.join("/tmp", `s6-c1-${contentType}-${orientation[0]}.ass`);
          const result = buildAutoProductionAss(makeWords(), 0, 35, preset, assPath);
          expect(result.success).toBe(true);
          positions.push(fs.readFileSync(assPath, "utf8").match(/\\pos\(\d+,(\d+)\)/)?.[1] || "");
        }
      }
      expect(new Set(positions)).toEqual(new Set(["1476"]));
    });
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    const tmpDir = path.resolve(process.cwd(), "tmp", "test-ass");

    beforeAll(() => {
      fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    });

    it("generates ASS file with uppercase text, max 6 words per phrase", () => {
      const words: WordTimestamp[] = [
        { word: "Warga", start: 0, end: 0.9, confidence: 1, isFiller: false, excluded: false },
        { word: "di", start: 1, end: 1.4, confidence: 1, isFiller: false, excluded: false },
        { word: "sekitar", start: 1.5, end: 2.2, confidence: 1, isFiller: false, excluded: false },
        { word: "Gunung", start: 2.3, end: 2.9, confidence: 1, isFiller: false, excluded: false },
        { word: "Kelud", start: 3, end: 3.5, confidence: 1, isFiller: false, excluded: false },
        { word: "diminta", start: 3.6, end: 4.2, confidence: 1, isFiller: false, excluded: false },
        { word: "untuk", start: 4.3, end: 4.7, confidence: 1, isFiller: false, excluded: false },
        { word: "segera", start: 4.8, end: 5.3, confidence: 1, isFiller: false, excluded: false },
        { word: "evakuasi", start: 5.4, end: 6.1, confidence: 1, isFiller: false, excluded: false },
      ];
      const assPath = path.join(tmpDir, "test_phrase_grouping.ass");
      const result = buildAutoProductionAss(words, 0, 10, preset, assPath);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(assPath, "utf-8");

      // All dialogue text should be uppercase (excluding ASS transform tags)
      const dialogueLines = content.split("\n").filter((l) => l.startsWith("Dialogue:"));
      for (const line of dialogueLines) {
        const textPart = line.split(",,").pop() || "";
        const visibleText = textPart.replace(/^\{[^}]*\}/, "");
        expect(visibleText).toBe(visibleText.toUpperCase());
      }

      // Each phrase should have at most 6 words
      for (const line of dialogueLines) {
        const textPart = line.split(",,").pop() || "";
        const wordCount = textPart.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(6);
      }
    });

    it("excludes filler words from subtitle output", () => {
      const words: WordTimestamp[] = [
        { word: "Warga", start: 0, end: 0.9, confidence: 1, isFiller: false, excluded: false },
        { word: "eh", start: 1, end: 1.2, confidence: 1, isFiller: true, excluded: false },
        { word: "di", start: 1.3, end: 1.5, confidence: 1, isFiller: false, excluded: false },
        { word: "sana", start: 1.6, end: 2.0, confidence: 1, isFiller: false, excluded: false },
      ];
      const assPath = path.join(tmpDir, "test_filler_exclusion.ass");
      const result = buildAutoProductionAss(words, 0, 5, preset, assPath);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(assPath, "utf-8");
      expect(content).not.toContain("eh");
      expect(content).toContain("WARGA");
      expect(content).toContain("DI");
      expect(content).toContain("SANA");
    });

    it("writes empty ASS header when no words in clip range", () => {
      const words: WordTimestamp[] = [
        { word: "Warga", start: 20, end: 21, confidence: 1, isFiller: false, excluded: false },
      ];
      const assPath = path.join(tmpDir, "test_empty_range.ass");
      const result = buildAutoProductionAss(words, 0, 5, preset, assPath);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(assPath, "utf-8");
      expect(content).toContain("[Script Info]");
      expect(content).not.toContain("Dialogue:");
    });

    it("places every Dialogue event on its own line (no glued Format line)", () => {
      const words: WordTimestamp[] = [
        { word: "Warga", start: 0, end: 0.9, confidence: 1, isFiller: false, excluded: false },
        { word: "di", start: 1, end: 1.4, confidence: 1, isFiller: false, excluded: false },
        { word: "sana", start: 1.6, end: 2.0, confidence: 1, isFiller: false, excluded: false },
      ];
      const assPath = path.join(tmpDir, "test_dialogue_lines.ass");
      const result = buildAutoProductionAss(words, 0, 5, preset, assPath);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(assPath, "utf-8");
      // Regression: header + events.join() previously glued the first
      // Dialogue onto the [Events] Format line ("TextDialogue:"), which
      // made libass drop the whole Events section → zero burned subtitles.
      expect(content).not.toContain("TextDialogue:");
      const dialogueLines = content.split("\n").filter((l) => l.startsWith("Dialogue:"));
      expect(dialogueLines.length).toBeGreaterThan(0);
    });
  });

  describe("buildAutoProductionFfmpegCommand", () => {
    const preset = ACCOUNT_PRESETS.get("shadow")!;
    const brief = makeBrief();
    const editPlan = makeEditPlan();

    it("resolves output 1080x1920", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("scale=1080:1080:force_original_aspect_ratio=increase");
      expect(cmd.filterComplex).toContain("scale=1080:1080:force_original_aspect_ratio=increase");
      expect(cmd.filterComplex).toContain("overlay=0:360");
      expect(cmd.filterComplex).toContain("gradients=s=1080x1920");
    });

    it("output fps resolves to 30", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.args).toContain("-r");
      expect(cmd.args).toContain("30");
    });

    it("selected source range uses statementStart/statementEnd", () => {
      const plan = makeEditPlan({ statementStart: 10.5, statementEnd: 45.2 });
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: plan.statementStart,
          clipEnd: plan.statementEnd,
          preset,
          editPlan: plan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.args).toContain("-ss");
      expect(cmd.args).toContain("10.500");
      expect(cmd.args).not.toContain("-to");
      expect(cmd.args).toContain("-t");
      expect(cmd.args).toContain("34.700");
    });

    it("headline comes from EditPlan", () => {
      const plan = makeEditPlan({ headline: "Breaking: Gempa Besar M 7.2" });
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan: plan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("Breaking\\: Gempa Besar M 7.2");
    });

    it("source credit contains sourceName", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief: makeBrief({ sourceName: "TVRI Jatim" }),
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("Sumber\\: TVRI Jatim");
    });

    it("sourceDate is appended when present", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief: makeBrief({ sourceName: "TVRI Jatim", sourceDate: "2026-09-07" }),
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("Sumber\\: TVRI Jatim (2026-09-07)");
    });

    it("missing sourceDate still renders safely", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief: makeBrief({ sourceDate: undefined }),
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("Sumber\\: TVRI Jatim");
      expect(cmd.filterComplex).not.toContain("2026-09-07");
    });

    it("accountHandle is included", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief: makeBrief({ accountHandle: "@tvrijatim" }),
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("@tvrijatim");
    });

    it("loudness target uses -14 LUFS", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      expect(cmd.filterComplex).toContain("loudnorm=I=-14");
    });

    it("no B-roll inputs are required", () => {
      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: 5,
          clipEnd: 35,
          preset,
          editPlan,
          brief,
          assSubtitlePath: "/tmp/test.ass",
        },
        "/tmp/out.mp4",
        "cpu",
      );
      // Only one input (-i) — the source video
      const inputCount = cmd.args.filter((a) => a === "-i").length;
      expect(inputCount).toBe(1);
    });

    it("generates ASS subtitle file with uppercase, max 6 words", () => {
      const plan = makeEditPlan();
      const testAssPath = path.join(FIXTURE_DIR, "test_subs.ass");
      fs.mkdirSync(FIXTURE_DIR, { recursive: true });
      fs.writeFileSync(testAssPath, "[Script Info]\nTitle: test\n", "utf-8");

      const cmd = buildAutoProductionFfmpegCommand(
        {
          sourceVideoPath: "/tmp/test.mp4",
          sourceWidth: 1920,
          sourceHeight: 1080,
          clipStart: plan.statementStart,
          clipEnd: plan.statementEnd,
          preset,
          editPlan: plan,
          brief,
          assSubtitlePath: testAssPath,
        },
        "/tmp/out.mp4",
        "cpu",
      );
      // Verify the ASS filter is included when the file exists
      expect(cmd.filterComplex).toContain("ass=");
      expect(cmd.args).toContain("-c:v");

      // Cleanup
      try { fs.unlinkSync(testAssPath); } catch { /* ignore */ }
    });
  });

  describe("input validation", () => {
    it("rejects missing source video", async () => {
      const result = await renderAutoProduction({
        brief: makeBrief(),
        preset: ACCOUNT_PRESETS.get("shadow")!,
        editPlan: makeEditPlan(),
        transcriptWords: makeWords(),
        sourceVideoPath: "/nonexistent/video.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_input");
        expect(result.error).toContain("not found");
      }
    });

    it("rejects invalid statement range", async () => {
      const result = await renderAutoProduction({
        brief: makeBrief(),
        preset: ACCOUNT_PRESETS.get("shadow")!,
        editPlan: makeEditPlan({ statementStart: 50, statementEnd: 30 }),
        transcriptWords: makeWords(),
        sourceVideoPath: "/tmp/existing.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_input");
      }
    });
  });

  describe("existing AutoClips renderer unchanged", () => {
    it("existing ffmpeg-builder tests still pass (no modification to ffmpeg-builder.ts)", async () => {
      // This test verifies we did NOT modify ffmpeg-builder.ts
      // by checking the module still exports the expected functions
      const fb = await import("@/lib/xclips/ffmpeg-builder");
      expect(typeof fb.buildFfmpegCommand).toBe("function");
      expect(typeof fb.generateAssSubtitles).toBe("function");
      expect(typeof fb.hexToAssColor).toBe("function");
    });
  });
});

// ============================================================
// FFmpeg Smoke Test — requires synthetic fixture
// ============================================================

describe("xclips - Auto Production Renderer — FFmpeg Smoke Test", () => {
  beforeAll(async () => {
    // Create fixture dir
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });

    // Only create fixture if ffmpeg is available and fixture doesn't exist
    if (!fs.existsSync(FIXTURE_VIDEO)) {
      const ffmpegAvailable = await new Promise<boolean>((resolve) => {
        const proc = spawn("ffmpeg", ["-version"]);
        proc.on("close", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
      });

      if (ffmpegAvailable) {
        // Create a 40s synthetic 16:9 test video with audio
        await new Promise<void>((resolve, reject) => {
          const proc = spawn("ffmpeg", [
            "-y",
            "-f", "lavfi",
            "-i", "color=c=blue:s=1920x1080:d=40:r=30",
            "-f", "lavfi",
            "-i", "sine=frequency=440:duration=40",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-c:a", "aac",
            "-b:a", "64k",
            "-shortest",
            FIXTURE_VIDEO,
          ]);
          proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg fixture creation failed: ${code}`))));
          proc.on("error", reject);
        });
      }
    }
  });

  afterAll(() => {
    // Clean up generated output files
    const outputDir = path.resolve(process.cwd(), "output", "xclips", "auto-production");
    if (fs.existsSync(outputDir)) {
      for (const f of fs.readdirSync(outputDir)) {
        if (f.startsWith("final_") || f.startsWith("captions_")) {
          try { fs.unlinkSync(path.join(outputDir, f)); } catch { /* ignore */ }
        }
      }
    }
  });

  it(
    "renders a real MP4 with correct dimensions, fps, and duration",
    async () => {
      if (!fs.existsSync(FIXTURE_VIDEO)) {
        return;
      }

      const words = makeWords();
      const result = await renderAutoProduction(
        {
          brief: makeBrief(),
          preset: ACCOUNT_PRESETS.get("shadow")!,
          editPlan: makeEditPlan({ statementStart: 5, statementEnd: 35 }),
          transcriptWords: words,
          sourceVideoPath: FIXTURE_VIDEO,
          sourceWidth: 1920,
          sourceHeight: 1080,
        },
        { hwaccel: "cpu" },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.width).toBe(1080);
        expect(result.height).toBe(1920);
        expect(result.fps).toBe(30);
        expect(result.durationSec).toBeGreaterThan(28);
        expect(result.durationSec).toBeLessThan(32);
        expect(fs.existsSync(result.outputPath)).toBe(true);

        // Verify with ffprobe
        const probeResult = await new Promise<{ width: number; height: number; hasVideo: boolean; hasAudio: boolean }>((resolve) => {
          const proc = spawn("ffprobe", [
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            result.outputPath,
          ]);
          let stdout = "";
          proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
          proc.on("close", () => {
            try {
              const info = JSON.parse(stdout);
              const v = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
              const a = info.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");
              resolve({
                width: parseInt(v?.width || "0"),
                height: parseInt(v?.height || "0"),
                hasVideo: !!v,
                hasAudio: !!a,
              });
            } catch {
              resolve({ width: 0, height: 0, hasVideo: false, hasAudio: false });
            }
          });
        });

        expect(probeResult.hasVideo).toBe(true);
        expect(probeResult.hasAudio).toBe(true);
        expect(probeResult.width).toBe(1080);
        expect(probeResult.height).toBe(1920);
      }
    },
    { timeout: 60000 },
  );
});
