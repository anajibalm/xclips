import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  ProductionBrief,
  AccountPreset,
  EditPlan,
} from "@/lib/xclips/auto-production-types";
import { WordTimestamp, Result } from "@/lib/xclips/types";
import { hexToAssColor, formatAssTime } from "@/lib/xclips/ffmpeg-builder";
import { segmentPhrases } from "@/lib/xclips/phrase-segmentation";
import { detectHardwareAcceleration, HardwareEncoder } from "@/lib/xclips/queue";

// ============================================================
// Auto Production Renderer — Slice 3
// ============================================================

// --- Types ----------------------------------------------------------------

export interface RenderAutoProductionInput {
  brief: ProductionBrief;
  preset: AccountPreset;
  editPlan: EditPlan;
  transcriptWords: WordTimestamp[];
  sourceVideoPath: string;
  sourceWidth: number;
  sourceHeight: number;
}

export interface RenderAutoProductionResult {
  success: true;
  outputPath: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}

export interface RenderAutoProductionFailure {
  success: false;
  error: string;
  stage: RenderStage;
}

export type RenderResult =
  | RenderAutoProductionResult
  | RenderAutoProductionFailure;

export type RenderStage =
  | "validate_input"
  | "generate_subtitles"
  | "build_command"
  | "ffmpeg_render"
  | "verify_output";

// --- Constants ------------------------------------------------------------

const DEFAULT_FPS = 30;

// --- Helpers ---------------------------------------------------------------

/** Escape a string for use inside FFmpeg drawtext text= field */
export function escapeDrawText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%");
}

/** Build caption ASS subtitle content for Auto Production (non-karaoke, uppercase, ≤6 words) */
export function buildAutoProductionAss(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
  preset: AccountPreset,
  outputPath: string,
): Result<string> {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const { width: playResX, height: playResY } = { width: preset.width, height: preset.height };
    const capStyle = preset.captionStyle;

    // Filter words to clip bounds, exclude fillers
    const clipWords = words.filter(
      (w) => !w.excluded && !w.isFiller && w.start >= clipStart && w.end <= clipEnd,
    );

    if (clipWords.length === 0) {
      // Write empty valid ASS file
      const header = buildAssHeader(playResX, playResY, capStyle);
      fs.writeFileSync(outputPath, header + "\n", "utf-8");
      return { success: true, data: outputPath };
    }

    // Group words into phrases using unified phrase-segmentation engine
    const phrases = segmentPhrases(clipWords, {
      maxWords: capStyle.maxWordsPerPhrase,
    });

    // Position: lower-middle safe area
    const posX = Math.round(playResX / 2);
    const posY = Math.round(playResY * 0.72);
    const transformTag = `{\\an5\\pos(${posX},${posY})}`;

    const events: string[] = [];
    for (const phrase of phrases) {
      if (phrase.words.length === 0) continue;
      const phraseStart = Math.max(0, phrase.startSec - clipStart);
      const phraseEnd = Math.max(phraseStart + 0.5, phrase.endSec - clipStart);
      const displayText = capStyle.uppercase ? phrase.text.toUpperCase() : phrase.text;
      events.push(
        `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${transformTag}${escapeDrawText(displayText)}`,
      );
    }

    const header = buildAssHeader(playResX, playResY, capStyle);
    const content = header + "\n" + events.join("\n") + "\n";
    fs.writeFileSync(outputPath, content, "utf-8");
    return { success: true, data: outputPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate Auto Production ASS subtitles";
    return { success: false, error: msg };
  }
}

function buildAssHeader(
  playResX: number,
  playResY: number,
  capStyle: { fontFamily: string; fontSizePx: number; color: string; outlineColor: string; outlineWidthPx: number },
): string {
  // ASS color format: &HAABBGGRR (alpha, blue, green, red)
  const assPrimaryColor = hexToAssColor(capStyle.color);
  const assOutlineColor = hexToAssColor(capStyle.outlineColor);

  return `[Script Info]
Title: xClips Auto Production Subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${capStyle.fontFamily},${capStyle.fontSizePx},${assPrimaryColor},${assPrimaryColor},${assOutlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,${capStyle.outlineWidthPx},2,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
}

// --- Main Entry Point -----------------------------------------------------

export async function renderAutoProduction(
  input: RenderAutoProductionInput,
  options?: { outputDir?: string; hwaccel?: HardwareEncoder },
): Promise<RenderResult> {
  // 1. Validate inputs
  const validationError = validateInput(input);
  if (validationError) return validationError;

  const { brief, preset, editPlan, transcriptWords, sourceVideoPath, sourceWidth, sourceHeight } =
    input;
  const outputDir =
    options?.outputDir ??
    path.resolve(process.cwd(), "output", "xclips", "auto-production");
  fs.mkdirSync(outputDir, { recursive: true });

  // 2. Generate ASS subtitles
  const assPath = path.join(outputDir, `captions_${Date.now()}.ass`);
  const assResult = buildAutoProductionAss(
    transcriptWords,
    editPlan.statementStart,
    editPlan.statementEnd,
    preset,
    assPath,
  );
  if (!assResult.success) {
    return { success: false, error: assResult.error, stage: "generate_subtitles" };
  }

  // 3. Detect hardware acceleration
  const hwaccel = options?.hwaccel ?? (await detectHardwareAcceleration());

  // 4. Build FFmpeg command
  const outputPath = path.join(outputDir, `final_${Date.now()}.mp4`);
  const command = buildAutoProductionFfmpegCommand(
    {
      sourceVideoPath,
      sourceWidth,
      sourceHeight,
      clipStart: editPlan.statementStart,
      clipEnd: editPlan.statementEnd,
      preset,
      editPlan,
      brief,
      assSubtitlePath: assPath,
    },
    outputPath,
    hwaccel,
  );

  // 5. Execute FFmpeg
  const renderResult = await executeFfmpeg(command, outputPath);
  if (!renderResult.success) {
    return { success: false, error: renderResult.error, stage: "ffmpeg_render" };
  }

  // 6. Verify output
  const verifyResult = await verifyOutput(outputPath, preset);
  if (!verifyResult.success) {
    return { success: false, error: verifyResult.error, stage: "verify_output" };
  }

  // Cleanup temp ASS file
  try { fs.unlinkSync(assPath); } catch { /* ignore */ }

  return {
    success: true,
    outputPath,
    durationSec: verifyResult.data.durationSec,
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
  };
}

// --- Input Validation -----------------------------------------------------

function validateInput(
  input: RenderAutoProductionInput,
): RenderResult | null {
  if (!input.sourceVideoPath || !fs.existsSync(input.sourceVideoPath)) {
    return { success: false, error: `Source video not found: ${input.sourceVideoPath}`, stage: "validate_input" };
  }
  if (!input.editPlan) {
    return { success: false, error: "EditPlan is required", stage: "validate_input" };
  }
  if (input.editPlan.statementEnd <= input.editPlan.statementStart) {
    return {
      success: false,
      error: `Invalid statement range: ${input.editPlan.statementStart}-${input.editPlan.statementEnd}`,
      stage: "validate_input",
    };
  }
  if (!input.preset) {
    return { success: false, error: "AccountPreset is required", stage: "validate_input" };
  }
  return null;
}

// --- FFmpeg Command Builder -----------------------------------------------

interface AutoProductionFfmpegOptions {
  sourceVideoPath: string;
  sourceWidth: number;
  sourceHeight: number;
  clipStart: number;
  clipEnd: number;
  preset: AccountPreset;
  editPlan: EditPlan;
  brief: ProductionBrief;
  assSubtitlePath: string;
}

interface FfmpegCommand {
  args: string[];
  filterComplex: string;
}

export function buildAutoProductionFfmpegCommand(
  opts: AutoProductionFfmpegOptions,
  outputPath: string,
  hwaccel: HardwareEncoder = "cpu",
): FfmpegCommand {
  const { sourceVideoPath, sourceWidth, sourceHeight, clipStart, clipEnd, preset, editPlan, brief, assSubtitlePath } = opts;
  const { width: targetW, height: targetH } = { width: preset.width, height: preset.height };
  const targetFps = preset.fps || DEFAULT_FPS;
  const duration = clipEnd - clipStart;

  const filterChains: string[] = [];

  // --- Video Pipeline ---

  // 1. Scale source to fit within target canvas (letterbox/pad approach)
  //    preserve_aspect_ratio=decrease ensures no cropping
  //    pad adds black bars to fill exact target dimensions
  filterChains.push(
    `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
    `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black[v_padded]`,
  );

  // 2. Headline overlay (top safe zone)
  const headlineText = escapeDrawText(editPlan.headline);
  const headlineFontSize = preset.headlineStyle.fontSizePx;
  const headlineY = preset.safeZone.topPx;

  filterChains.push(
    `[v_padded]drawtext=text='${headlineText}':` +
    `fontsize=${headlineFontSize}:fontcolor=${preset.headlineStyle.color}:` +
    `x=(w-text_w)/2:y=${headlineY}:` +
    `box=1:boxcolor=black@0.7:boxborderw=12` +
    `[v_headline]`,
  );

  // 3. Source credit overlay (bottom-left)
  const creditText = brief.sourceDate
    ? `Sumber: ${brief.sourceName} (${brief.sourceDate})`
    : `Sumber: ${brief.sourceName}`;
  const creditEscaped = escapeDrawText(creditText);
  const creditY = targetH - preset.safeZone.bottomPx - 30;

  filterChains.push(
    `[v_headline]drawtext=text='${creditEscaped}':` +
    `fontsize=28:fontcolor=white:` +
    `x=${preset.safeZone.leftPx}:y=${creditY}:` +
    `box=1:boxcolor=black@0.6:boxborderw=6` +
    `[v_credit]`,
  );

  // 4. Handle overlay (bottom-right)
  const handleEscaped = escapeDrawText(brief.accountHandle);
  const handleY = targetH - preset.safeZone.bottomPx - 30;

  filterChains.push(
    `[v_credit]drawtext=text='${handleEscaped}':` +
    `fontsize=28:fontcolor=white:` +
    `x=w-text_w-${preset.safeZone.rightPx}:y=${handleY}:` +
    `box=1:boxcolor=black@0.6:boxborderw=6` +
    `[v_with_text]`,
  );

  // 5. Burn-in ASS subtitles
  let finalVideoLabel = "[v_with_text]";
  if (fs.existsSync(assSubtitlePath)) {
    const escapedAss = assSubtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    filterChains.push(`[v_with_text]ass='${escapedAss}'[v_subbed]`);
    finalVideoLabel = "[v_subbed]";
  }

  // --- Audio Pipeline ---

  // Loudness normalization to preset target (e.g. -14 LUFS)
  const loudnessTarget = preset.loudnessTargetLu;
  filterChains.push(
    `[0:a]loudnorm=I=${loudnessTarget}:TP=-1.5:LRA=11[a_final]`,
  );

  const filterComplex = filterChains.join(";");

  // --- Encoder Selection ---
  let videoEncoder = "libx264";
  let encoderArgs: string[] = ["-preset", "veryfast", "-crf", "19", "-threads", "0"];

  if (hwaccel === "nvenc") {
    videoEncoder = "h264_nvenc";
    encoderArgs = ["-preset", "p4", "-cq", "20"];
  } else if (hwaccel === "videotoolbox") {
    videoEncoder = "h264_videotoolbox";
    encoderArgs = ["-q:v", "65"];
  } else if (hwaccel === "qsv") {
    videoEncoder = "h264_qsv";
    encoderArgs = ["-global_quality", "20"];
  } else if (hwaccel === "amf") {
    videoEncoder = "h264_amf";
    encoderArgs = ["-quality", "speed"];
  }

  // --- Build Args ---
  const args: string[] = [
    "-y",
    "-ss", clipStart.toFixed(3),
    "-i", sourceVideoPath,
    "-filter_complex", filterComplex,
    "-map", finalVideoLabel,
    "-map", "[a_final]",
    "-c:v", videoEncoder,
    ...encoderArgs,
    "-r", String(targetFps),
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", duration.toFixed(3),
    outputPath,
  ];

  return { args, filterComplex };
}

// --- FFmpeg Execution -----------------------------------------------------

const FFMPEG_TIMEOUT_MS = 120_000;
const FFPROBE_TIMEOUT_MS = 30_000;

function executeFfmpeg(
  command: FfmpegCommand,
  outputPath: string,
): Promise<Result<void>> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", command.args);
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        resolve({ success: false, error: "FFmpeg render timed out" });
      }
    }, FFMPEG_TIMEOUT_MS);

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath)) {
        const stat = fs.statSync(outputPath);
        if (stat.size > 0) {
          resolve({ success: true, data: undefined });
          return;
        }
      }
      // Cleanup partial file
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
      }
      resolve({
        success: false,
        error: `FFmpeg error (code ${code}): ${stderr.slice(-500)}`,
      });
    });

    proc.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
      }
      resolve({ success: false, error: `FFmpeg spawn error: ${err.message}` });
    });
  });
}

// --- Output Verification --------------------------------------------------

async function verifyOutput(
  outputPath: string,
  preset: AccountPreset,
): Promise<Result<{ durationSec: number }>> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      outputPath,
    ]);
    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        resolve({ success: false, error: "ffprobe timed out" });
      }
    }, FFPROBE_TIMEOUT_MS);

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: `ffprobe failed (code ${code})` });
        return;
      }
      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams?.find(
          (s: { codec_type: string }) => s.codec_type === "video",
        );
        const audioStream = info.streams?.find(
          (s: { codec_type: string }) => s.codec_type === "audio",
        );

        if (!videoStream) {
          resolve({ success: false, error: "No video stream found in output" });
          return;
        }
        if (!audioStream) {
          resolve({ success: false, error: "No audio stream found in output" });
          return;
        }

        const w = parseInt(videoStream.width);
        const h = parseInt(videoStream.height);
        if (w !== preset.width || h !== preset.height) {
          resolve({
            success: false,
            error: `Output dimensions ${w}x${h} do not match preset ${preset.width}x${preset.height}`,
          });
          return;
        }

        const durationSec = parseFloat(info.format?.duration || "0");
        resolve({ success: true, data: { durationSec } });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to parse ffprobe output";
        resolve({ success: false, error: msg });
      }
    });

    proc.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, error: `ffprobe spawn error: ${err.message}` });
    });
  });
}
