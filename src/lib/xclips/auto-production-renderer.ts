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
import { segmentPhrases, isNonSpeechCaptionCue, remapWordsToKeepTimeline } from "@/lib/xclips/phrase-segmentation";
import { detectHardwareAcceleration, HardwareEncoder } from "@/lib/xclips/queue";
import { fitAutoProductionHeadline, resolveAutoProductionFooter } from "@/lib/xclips/auto-production-headline";
import { buildSourceTransformFilter, getBakomLayout, BACKGROUND_GRADIENT_END_COLOR, BACKGROUND_GRADIENT_MID_COLOR, BACKGROUND_TEXTURE_BOTTOM_COLOR, BACKGROUND_TEXTURE_OVERLAY_OPACITY, BACKGROUND_TEXTURE_TOP_COLOR, HEADLINE_ACCENT_BAR_GAP, HEADLINE_ACCENT_BAR_WIDTH, HEADLINE_ENTER_DURATION_SEC, HEADLINE_ENTER_OFFSET_Y, HEADLINE_RED_BAR_COLOR, type ContentType } from "@/lib/xclips/auto-production-bakom-layout";
import type { TrustedRenderResult } from "@/lib/xclips/production-trust";

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
  contentType?: ContentType;
}

export interface RenderAutoProductionResult {
  success: true;
  outputPath: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  trustedRenderResult?: TrustedRenderResult;
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

/** Minimum on-screen time for a caption cue, capped by the clip end. */
const MIN_CUE_DURATION_SEC = 0.5;

// --- Helpers ---------------------------------------------------------------

/**
 * Order-aware clip window. Walks the transcript in sequence and returns
 * words from the first one ending after `clipStart` up to and including the
 * first one reaching `clipEnd`. Selecting purely by timestamp overlap is
 * unsafe: CC tracks emit non-monotonic timings, so a word occurring later in
 * the transcript can carry an earlier timestamp and leak past the boundary.
 */
export function selectClipWords(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
): WordTimestamp[] {
  const startIndex = words.findIndex((w) => w.end > clipStart);
  if (startIndex === -1) return [];
  for (let i = startIndex; i < words.length; i++) {
    if (words[i].end >= clipEnd) return words.slice(startIndex, i + 1);
  }
  return words.slice(startIndex);
}

/**
 * Deterministic start boundary guard. Walks backward from `rawStart` in
 * TIMESTAMP ORDER (not transcript order — CC tracks are non-monotonic) and
 * returns a corrected start time that begins on a sentence boundary. The
 * guard moves the start BACKWARD only — it never advances past rawStart.
 *
 * Preferred boundary: a word ending with `.`, `?`, or `!`.
 * Fallback boundary: a timing gap > `gapThresholdSec` between consecutive
 * words, indicating a natural pause.
 *
 * If neither boundary is found within `maxLookbackSec`, returns rawStart.
 */
export function findStartBoundary(
  words: WordTimestamp[],
  rawStart: number,
  maxLookbackSec = 10,
  gapThresholdSec = 1.2,
): number {
  if (words.length === 0) return rawStart;

  // Sort by timestamp to get the physical speaking order.
  const sorted = [...words].sort((a, b) => a.start - b.start);

  // Find the first word whose start >= rawStart.
  const anchorIdx = sorted.findIndex((w) => w.start >= rawStart);
  if (anchorIdx <= 0) return rawStart;

  // Walk backward from anchorIdx-1 toward the beginning.
  const minIdx = Math.max(0, anchorIdx - 40); // word-count guard
  const earliestAllowed = Math.max(0, rawStart - maxLookbackSec);

  for (let i = anchorIdx - 1; i >= minIdx; i--) {
    // Sentence boundary: word ends with . ? !
    const text = sorted[i].word.trim();
    if (/[.?!]$/.test(text)) {
      // Use the word's END time, not the next word's START (which may
      // overlap backward due to CC timestamp non-monotonicity).
      return sorted[i].end;
    }

    // Gap boundary: a pause between this word and the next one.
    const gap = sorted[i + 1].start - sorted[i].end;
    if (gap >= gapThresholdSec) {
      return sorted[i].end;
    }

    // Stop if we would exceed the time bound (checked AFTER gap/sentence
    // checks so that a real boundary at the time-bound edge is still found).
    if (sorted[i].start < earliestAllowed) break;
  }

  return rawStart;
}

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

    // Select words by TRANSCRIPT ORDER, not by timestamp overlap: YouTube CC
    // timings are not guaranteed monotonic, so a later word can carry an
    // earlier timestamp and leak past the statement boundary. The window runs
    // from the first word ending after clipStart to the first word (in order)
    // reaching clipEnd, inclusive.
    const clipWords = selectClipWords(words, clipStart, clipEnd).filter(
      (w) => !w.excluded && !w.isFiller && !isNonSpeechCaptionCue(w.word),
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
    const posY = getBakomLayout(preset).captionTop;
    const transformTag = `{\\an8\\pos(${posX},${posY})}`;

    // Hard invariant for every emitted event: 0 <= start < end <= clipDuration.
    // The minimum display duration may never extend a cue past the clip end.
    const clipDuration = clipEnd - clipStart;
    const events: string[] = [];
    let previousEndSec = 0;
    for (const phrase of phrases) {
      if (phrase.words.length === 0) continue;
      const phraseStart = Math.max(previousEndSec, Math.max(0, phrase.startSec - clipStart));
      if (phraseStart >= clipDuration) continue;
      const phraseEnd = Math.min(
        clipDuration,
        Math.max(phraseStart + MIN_CUE_DURATION_SEC, phrase.endSec - clipStart),
      );
      if (phraseEnd <= phraseStart) continue;
      const displayText = capStyle.uppercase ? phrase.text.toUpperCase() : phrase.text;
      events.push(
        `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${transformTag}${escapeDrawText(displayText)}`,
      );
      previousEndSec = phraseEnd;
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
  const keepIntervals = editPlan.keepIntervals ?? [{ start: 0, end: editPlan.statementEnd - editPlan.statementStart, duration: editPlan.statementEnd - editPlan.statementStart }];
  const remappedWords = remapWordsToKeepTimeline(transcriptWords, keepIntervals, editPlan.statementStart);
  const renderedDuration = keepIntervals.reduce((sum, interval) => sum + interval.duration, 0);
  const assResult = buildAutoProductionAss(
    remappedWords,
    0,
    renderedDuration,
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
      keepIntervals,
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

/**
 * ARCH.1 / ARCH.1R NOTE: this renderer implements the S1 visual spine (legacy
 * red accent bar, S1 canvas). It is NOT the accepted S3 official BAKOM
 * presentation (V1/V3/V4/V5/V10). It therefore MUST NOT claim
 * `official_bakom` renderer authority. Until a reusable canonical official
 * presentation renderer exists, production render trust is BLOCKED and this
 * renderer's output is preview-only.
 */
export const RENDERER_AUTHORITY_ID = "s1_visual_spine" as const;
export const RENDERER_IS_OFFICIAL_BAKOM = false;

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
  keepIntervals?: Array<{ start: number; end: number; duration: number }>;
  contentType?: ContentType;
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
  const { sourceVideoPath, sourceWidth, sourceHeight, clipStart, clipEnd, preset, editPlan, brief, assSubtitlePath, contentType = "default" } = opts;
  const { width: targetW, height: targetH } = { width: preset.width, height: preset.height };
  const targetFps = preset.fps || DEFAULT_FPS;
  const keepIntervals = opts.keepIntervals ?? [{ start: 0, end: clipEnd - clipStart, duration: clipEnd - clipStart }];
  const duration = keepIntervals.reduce((sum, interval) => sum + interval.duration, 0);

  const filterChains: string[] = [];

  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  for (let i = 0; i < keepIntervals.length; i++) {
    const interval = keepIntervals[i];
    filterChains.push(`[0:v]trim=start=${interval.start.toFixed(3)}:end=${interval.end.toFixed(3)},setpts=PTS-STARTPTS[v_cut_${i}]`);
    filterChains.push(`[0:a]atrim=start=${interval.start.toFixed(3)}:end=${interval.end.toFixed(3)},asetpts=PTS-STARTPTS[a_cut_${i}]`);
    videoLabels.push(`[v_cut_${i}]`);
    audioLabels.push(`[a_cut_${i}]`);
  }
  if (keepIntervals.length > 1) {
    filterChains.push(`${videoLabels.join("")}concat=n=${keepIntervals.length}:v=1:a=0[v_concatenated]`);
    filterChains.push(`${audioLabels.join("")}concat=n=${keepIntervals.length}:v=0:a=1[a_concatenated]`);
  } else {
    filterChains.push(`${videoLabels[0]}copy[v_concatenated]`);
    filterChains.push(`${audioLabels[0]}acopy[a_concatenated]`);
  }

  // --- Video Pipeline ---

  // 1. Deterministic neutral editorial canvas (S1 visual spine): fixed
  //    achromatic radial gradient + vignette. No grid, noise, randomness,
  //    per-pixel expressions, or tinted texture; identical pixels every render.
  const layout = getBakomLayout(preset);
  filterChains.push(
    `gradients=s=${targetW}x${targetH}:c0=${BACKGROUND_TEXTURE_BOTTOM_COLOR}:c1=${BACKGROUND_TEXTURE_TOP_COLOR}:c2=${BACKGROUND_GRADIENT_MID_COLOR}:c3=${BACKGROUND_GRADIENT_END_COLOR}:x0=540:y0=800:x1=1080:y1=1800:nb_colors=4:type=radial:speed=0:r=${targetFps}:d=${duration.toFixed(3)},` +
    `vignette=angle=PI/5:mode=forward,` +
    `format=yuv420p[v_bg]`,
  );
  filterChains.push(buildSourceTransformFilter("[v_concatenated]", "[v_broll]", layout, targetW, targetH, "default", sourceWidth, sourceHeight, contentType, false));
  filterChains.push(`[v_bg][v_broll]overlay=0:${layout.mediaTop}:shortest=1[v_composited]`);

  // 2. Headline overlay (top safe zone)
  const headlineLayout = fitAutoProductionHeadline(editPlan.headline, preset);
  let headlineInput = "[v_composited]";
  const headlineOverlay = `[v_headline_overlay]`;
  filterChains.push(
    `${headlineInput}drawbox=x=0:y=${layout.headlineTop - 12}:w=${targetW}:h=${layout.headlineAreaHeight}:color=black@${BACKGROUND_TEXTURE_OVERLAY_OPACITY}:t=fill${headlineOverlay}`,
  );
  // Netflix-style vertical red accent bar LEFT of the headline (restored
  // lineage). Permanent for the whole clip; spans the headline area.
  const headlineTextLeft = layout.safeMarginX + HEADLINE_ACCENT_BAR_WIDTH + HEADLINE_ACCENT_BAR_GAP;
  const accentOutput = "[v_headline_accent]";
  filterChains.push(
    `${headlineOverlay}drawbox=x=${layout.safeMarginX}:y=${layout.headlineTop}:w=${HEADLINE_ACCENT_BAR_WIDTH}:h=${layout.headlineAreaHeight - 24}:color=${HEADLINE_RED_BAR_COLOR}:t=fill${accentOutput}`,
  );
  headlineInput = accentOutput;
  headlineLayout.lines.forEach((line, index) => {
    const output = `[v_headline_${index}]`;
    const headlineY = layout.headlineTop + index * (headlineLayout.fontSizePx + headlineLayout.lineSpacingPx);
    filterChains.push(
      `${headlineInput}drawtext=text='${escapeDrawText(line)}':` +
      `fontsize=${headlineLayout.fontSizePx}:fontcolor=${preset.headlineStyle.color}:` +
      `x=${headlineTextLeft}:y='${headlineY}+${HEADLINE_ENTER_OFFSET_Y}*(1-min(t/${HEADLINE_ENTER_DURATION_SEC},1))':alpha='if(lt(t,${HEADLINE_ENTER_DURATION_SEC}),t/${HEADLINE_ENTER_DURATION_SEC},1)':box=0${output}`,
    );
    headlineInput = output;
  });

  // 3. Footer (single baseline): source left-anchored, handle right-anchored.
  //    resolveAutoProductionFooter guarantees sourceRight + gap <= handleLeft.
  const footerLayout = resolveAutoProductionFooter(
    brief.sourceDate ? `Sumber: ${brief.sourceName} (${brief.sourceDate})` : `Sumber: ${brief.sourceName}`,
    brief.accountHandle,
    { canvasWidth: targetW, safeMarginX: layout.safeMarginX, fontSizePx: layout.sourceFontSize },
  );
  const creditEscaped = escapeDrawText(footerLayout.sourceText);
  const creditY = targetH - layout.sourceBottomOffset;

  filterChains.push(
    `${headlineInput}drawtext=text='${creditEscaped}':` +
    `fontsize=${layout.sourceFontSize}:fontcolor=white:` +
    `x=${layout.safeMarginX}:y=${creditY}:` +
    `box=1:boxcolor=black@0.6:boxborderw=6` +
    `[v_credit]`,
  );

  // 4. Handle overlay (bottom-right)
  const handleEscaped = escapeDrawText(footerLayout.handleText);
  const handleY = targetH - layout.sourceBottomOffset;

  filterChains.push(
    `[v_credit]drawtext=text='${handleEscaped}':` +
    `fontsize=${layout.sourceFontSize}:fontcolor=white:` +
    `x=w-text_w-${layout.safeMarginX}:y=${handleY}:` +
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
    `[a_concatenated]loudnorm=I=${loudnessTarget}:TP=-1.5:LRA=11[a_final]`,
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
