import { describe, it, expect } from "bun:test";
import { buildFfmpegCommand } from "@/lib/xclips/ffmpeg-builder";

describe("xclips - FFmpeg Filter Complex Builder", () => {
  it("should generate valid 9:16 blurred background filter_complex and PTS resets", () => {
    const { args, filterComplex } = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 10.0,
        clipEnd: 50.0,
        keepIntervals: [
          { start: 0, end: 15.0, duration: 15.0 },
          { start: 16.5, end: 40.0, duration: 23.5 },
        ],
        layoutMode: "blur_bg",
      },
      "C:/test/output.mp4",
      "cpu"
    );

    // Verify PTS and asetpts are present
    expect(filterComplex).toContain("setpts=PTS-STARTPTS");
    expect(filterComplex).toContain("asetpts=PTS-STARTPTS");

    // Verify concat is present for multiple segments
    expect(filterComplex).toContain("concat=n=2:v=1:a=0");

    // Verify optimized pyramid blur_bg filter components
    expect(filterComplex).toContain("boxblur=4:1");
    expect(filterComplex).toContain("overlay=(W-w)/2:(H-h)/2");

    // Verify loudnorm is applied
    expect(filterComplex).toContain("loudnorm=");

    // Verify args structure and fast-seeking before -i
    expect(args).toContain("-ss");
    expect(args).toContain("-to");
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("-preset");
    expect(args).toContain("veryfast");
  });

  it("should generate valid 9:16 center_crop filter_complex with pan offset", () => {
    const { filterComplex } = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0.0,
        clipEnd: 30.0,
        keepIntervals: [{ start: 0, end: 30.0, duration: 30.0 }],
        layoutMode: "center_crop",
        panOffsetX: 0.25,
      },
      "C:/test/output_crop.mp4",
      "cpu"
    );

    expect(filterComplex).toContain("crop=1080:1920:");
    expect(filterComplex).toContain("0.25");
  });

  it("should select nvenc encoder when hardware acceleration is set to nvenc", () => {
    const { args } = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0.0,
        clipEnd: 30.0,
        keepIntervals: [{ start: 0, end: 30.0, duration: 30.0 }],
        layoutMode: "blur_bg",
      },
      "C:/test/output_nvenc.mp4",
      "nvenc"
    );

    expect(args).toContain("h264_nvenc");
    expect(args).toContain("-cq");
  });

  it("should convert hex colors to ASS color format accurately", () => {
    const { hexToAssColor } = require("@/lib/xclips/ffmpeg-builder");
    expect(hexToAssColor("#FFFFFF")).toBe("&H00FFFFFF");
    expect(hexToAssColor("#FACC15")).toBe("&H0015CCFA");
    expect(hexToAssColor("#000000", "80")).toBe("&H80000000");
  });

  it("should generate valid ASS subtitles for plain (standard) and hormozi (karaoke) presets", () => {
    const { generateAssSubtitles } = require("@/lib/xclips/ffmpeg-builder");
    const fs = require("fs");
    const path = require("path");

    const words = [
      { word: "Halo", start: 1.0, end: 1.5 },
      { word: "semua", start: 1.6, end: 2.1 },
      { word: "selamat", start: 2.2, end: 2.7 },
      { word: "datang", start: 2.8, end: 3.4 },
    ];

    const testAssPath = path.resolve(process.cwd(), "vault", "xclips", "test_subs.ass");

    // Test Plain preset
    const plainRes = generateAssSubtitles(
      words,
      0.0,
      5.0,
      {
        preset: "plain",
        fontFamily: "Inter",
        fontSize: 38,
        primaryColor: "#FFFFFF",
        highlightColor: "#FFFFFF",
        outlineColor: "#000000",
        outlineWidth: 2,
        boxColor: "#000000",
        boxOpacity: 0.0,
        allCaps: false,
        autoEmoji: false,
        positionY: 82,
        karaokeEnabled: false,
      },
      testAssPath
    );

    expect(plainRes.success).toBe(true);
    const plainContent = fs.readFileSync(testAssPath, "utf-8");
    expect(plainContent).toContain("Style: Default,Inter,38,&H00FFFFFF");
    expect(plainContent).toContain("\\an5\\pos(");
    expect(plainContent).toContain("Halo semua selamat datang");
    expect(plainContent).not.toContain("{\\kf}");

    // Test Hormozi preset with position and rotation
    const hormoziRes = generateAssSubtitles(
      words,
      0.0,
      5.0,
      {
        preset: "hormozi",
        fontFamily: "Impact",
        fontSize: 44,
        primaryColor: "#FFFFFF",
        highlightColor: "#FACC15",
        outlineColor: "#000000",
        outlineWidth: 3.5,
        boxColor: "#000000",
        boxOpacity: 0.0,
        allCaps: true,
        autoEmoji: false,
        positionX: 50,
        positionY: 78,
        rotation: 12,
        karaokeEnabled: true,
      },
      testAssPath
    );

    expect(hormoziRes.success).toBe(true);
    const hormoziContent = fs.readFileSync(testAssPath, "utf-8");
    expect(hormoziContent).toContain("Style: Default,Impact,44,&H00FFFFFF");
    expect(hormoziContent).toContain("\\frz12");
    expect(hormoziContent).toContain("{\\k");
    expect(hormoziContent).toContain("HALO");

    // Clean up
    if (fs.existsSync(testAssPath)) fs.unlinkSync(testAssPath);
  });

  it("should not include ass filter when subtitles are disabled or path is omitted", () => {
    const { args, filterComplex } = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0.0,
        clipEnd: 20.0,
        keepIntervals: [{ start: 0, end: 20.0, duration: 20.0 }],
        layoutMode: "blur_bg",
        assSubtitlePath: undefined, // Subtitle disabled
      },
      "C:/test/output_no_sub.mp4",
      "cpu"
    );

    // Filter complex should not contain ass filter
    expect(filterComplex).not.toContain("ass=");
    expect(filterComplex).not.toContain("[v_subbed]");

    // Map flag should map [v_framed] directly
    expect(args).toContain("-map");
    expect(args).toContain("[v_framed]");
  });

  it("should resolve correct dimensions and generate valid commands for all standard aspect ratios (9:16, 1:1, 4:5, 16:9)", () => {
    const { getDimensionsForAspectRatio } = require("@/lib/xclips/ffmpeg-builder");

    expect(getDimensionsForAspectRatio("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(getDimensionsForAspectRatio("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(getDimensionsForAspectRatio("4:5")).toEqual({ width: 1080, height: 1350 });
    expect(getDimensionsForAspectRatio("16:9")).toEqual({ width: 1920, height: 1080 });

    // Test 1:1 Square (Instagram Feed)
    const squareCmd = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0,
        clipEnd: 15,
        keepIntervals: [{ start: 0, end: 15, duration: 15 }],
        aspectRatio: "1:1",
        layoutMode: "center_crop",
      },
      "C:/test/output_square.mp4",
      "cpu"
    );
    expect(squareCmd.filterComplex).toContain("crop=1080:1080:");

    // Test 4:5 Portrait (IG Feed Portrait)
    const portraitCmd = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0,
        clipEnd: 15,
        keepIntervals: [{ start: 0, end: 15, duration: 15 }],
        aspectRatio: "4:5",
        layoutMode: "blur_bg",
      },
      "C:/test/output_portrait.mp4",
      "cpu"
    );
    expect(portraitCmd.filterComplex).toContain("scale=1080:1350");

    // Test 16:9 Landscape (YouTube) with Split Screen side-by-side (hstack)
    const landscapeSplitCmd = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0,
        clipEnd: 15,
        keepIntervals: [{ start: 0, end: 15, duration: 15 }],
        aspectRatio: "16:9",
        layoutMode: "split_screen",
      },
      "C:/test/output_landscape.mp4",
      "cpu"
    );
    expect(landscapeSplitCmd.filterComplex).toContain("hstack=inputs=2");
    expect(landscapeSplitCmd.filterComplex).toContain("scale=960:1080");
  });

  it("should apply video transform (scale, panX, panY, rotation) in filter_complex", () => {
    const transformCmd = buildFfmpegCommand(
      {
        sourceVideo: "C:/test/sample.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 0,
        clipEnd: 15,
        keepIntervals: [{ start: 0, end: 15, duration: 15 }],
        aspectRatio: "9:16",
        layoutMode: "blur_bg",
        videoScale: 1.5,
        videoPanX: 0.25,
        videoPanY: -0.15,
        videoRotation: 15,
      },
      "C:/test/output_transform.mp4",
      "cpu"
    );

    // Verify scale zoom
    expect(transformCmd.filterComplex).toContain("scale=trunc(iw*1.50/2)*2");
    // Verify rotation
    expect(transformCmd.filterComplex).toContain("rotate=0.2618");
    // Verify overlay with pan offset
    expect(transformCmd.filterComplex).toContain("overlay=(W-w)/2 + (0.087*W):(H-h)/2 + (-0.052*H)");
  });

  it("should generate correct hardware encoder args for qsv, nvenc, and amf", () => {
    const baseOptions = {
      sourceVideo: "C:/test/sample.mp4",
      sourceWidth: 1920,
      sourceHeight: 1080,
      clipStart: 0,
      clipEnd: 10,
      keepIntervals: [{ start: 0, end: 10, duration: 10 }],
      layoutMode: "blur_bg" as const,
    };

    const qsvCmd = buildFfmpegCommand(baseOptions, "C:/test/out.mp4", "qsv");
    expect(qsvCmd.args).toContain("-c:v");
    expect(qsvCmd.args).toContain("h264_qsv");
    expect(qsvCmd.args).toContain("-global_quality");

    const nvencCmd = buildFfmpegCommand(baseOptions, "C:/test/out.mp4", "nvenc");
    expect(nvencCmd.args).toContain("-c:v");
    expect(nvencCmd.args).toContain("h264_nvenc");
    expect(nvencCmd.args).toContain("-cq");

    const amfCmd = buildFfmpegCommand(baseOptions, "C:/test/out.mp4", "amf");
    expect(amfCmd.args).toContain("-c:v");
    expect(amfCmd.args).toContain("h264_amf");
    expect(amfCmd.args).toContain("-quality");
  });

  it("should detect available hardware profile on host system dynamically", async () => {
    const { detectHardwareProfile, resetHardwareProfileCacheForTesting } = require("@/lib/xclips/queue");
    resetHardwareProfileCacheForTesting();

    const profile = await detectHardwareProfile();
    expect(profile).toBeDefined();
    expect(profile.encoder).toBeDefined();
    expect(["nvenc", "qsv", "videotoolbox", "amf", "cpu"]).toContain(profile.encoder);
    expect(["nvidia", "intel_qsv", "amd_amf", "apple_silicon", "cpu"]).toContain(profile.deviceType);
    expect(profile.label).toBeTruthy();
    expect(profile.cpuCores).toBeGreaterThan(0);
  }, 10000);
});



