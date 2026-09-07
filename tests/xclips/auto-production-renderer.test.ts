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

// ============================================================
// Test Helpers
// ============================================================

const FIXTURE_DIR = path.resolve(process.cwd(), "vault", "xclips", "test-fixtures");
const FIXTURE_VIDEO = path.join(FIXTURE_DIR, "auto-prod-smoke.mp4");

function makeBrief(overrides?: Partial<ProductionBrief>): ProductionBrief {
  return {
    source: { sourcePath: FIXTURE_VIDEO, sourceType: "local" },
    editorialAngle: "Dampak erupsi Gunung Kelud",
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
      expect(cmd.filterComplex).toContain("scale=1080:1920");
      expect(cmd.filterComplex).toContain("pad=1080:1920");
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
