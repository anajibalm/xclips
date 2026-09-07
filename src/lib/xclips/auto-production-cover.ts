import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  AccountPreset,
  EditPlan,
} from "@/lib/xclips/auto-production-types";
import { escapeDrawText } from "@/lib/xclips/auto-production-renderer";
import { Result } from "@/lib/xclips/types";

// ============================================================
// Auto Production Cover — Slice 4
// ============================================================

// --- Types ----------------------------------------------------------------

export interface GenerateCoverInput {
  sourceVideoPath: string;
  sourceWidth: number;
  sourceHeight: number;
  editPlan: EditPlan;
  preset: AccountPreset;
}

export interface GenerateCoverSuccess {
  success: true;
  coverPath: string;
  width: number;
  height: number;
}

export interface GenerateCoverFailure {
  success: false;
  error: string;
  stage: CoverStage;
}

export type CoverResult = GenerateCoverSuccess | GenerateCoverFailure;

export type CoverStage =
  | "resolve_frame"
  | "build_command"
  | "ffmpeg_extract"
  | "ffmpeg_compose";

// --- Entry Point ----------------------------------------------------------

export async function generateAutoProductionCover(
  input: GenerateCoverInput,
  outputDir: string,
): Promise<CoverResult> {
  const { sourceVideoPath, sourceWidth, sourceHeight, editPlan, preset } = input;

  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Resolve the frame timestamp to extract
  const timestamp = resolveCoverFrameTimestamp(editPlan);

  // 2. Extract frame as raw BMP (lossless intermediate)
  const rawFramePath = path.join(outputDir, `_cover_raw_${Date.now()}.bmp`);
  const extractResult = await extractFrame(sourceVideoPath, timestamp, rawFramePath);
  if (!extractResult.success) {
    cleanupFile(rawFramePath);
    return { success: false, error: extractResult.error, stage: "ffmpeg_extract" };
  }

  // 3. Compose final cover: scale/pad + headline overlay
  const coverPath = path.join(outputDir, `cover_${Date.now()}.jpg`);
  const composeResult = await composeCover(rawFramePath, coverPath, editPlan, preset);
  cleanupFile(rawFramePath);

  if (!composeResult.success) {
    cleanupFile(coverPath);
    return { success: false, error: composeResult.error, stage: "ffmpeg_compose" };
  }

  return { success: true, coverPath, width: preset.width, height: preset.height };
}

// --- Frame Resolution -----------------------------------------------------

function resolveCoverFrameTimestamp(
  editPlan: EditPlan,
): number {
  // Always use deterministic midpoint of selected statement.
  // thumbnailSourceFrame semantics are intentionally unresolved — do not derive
  // a timestamp from it until its contract is explicitly defined.
  const statementDuration = editPlan.statementEnd - editPlan.statementStart;
  return editPlan.statementStart + statementDuration / 2;
}

// --- FFmpeg Helpers -------------------------------------------------------

function extractFrame(
  sourceVideoPath: string,
  timestamp: number,
  outputPath: string,
): Promise<Result<void>> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-ss", timestamp.toFixed(3),
      "-i", sourceVideoPath,
      "-frames:v", "1",
      "-q:v", "2",
      outputPath,
    ]);
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        resolve({ success: false, error: "Frame extraction timed out" });
      }
    }, 30_000);

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, data: undefined });
      } else {
        resolve({ success: false, error: `Frame extraction failed (code ${code}): ${stderr.slice(-300)}` });
      }
    });

    proc.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, error: `Frame extraction spawn error: ${err.message}` });
    });
  });
}

function composeCover(
  rawFramePath: string,
  outputPath: string,
  editPlan: EditPlan,
  preset: AccountPreset,
): Promise<Result<void>> {
  return new Promise((resolve) => {
    const { width: targetW, height: targetH } = preset;
    const headlineText = escapeDrawText(editPlan.headline);
    const headlineFontSize = preset.headlineStyle.fontSizePx;
    const headlineY = preset.safeZone.topPx;

    const filterComplex =
      `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
      `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,` +
      `drawtext=text='${headlineText}':` +
      `fontsize=${headlineFontSize}:fontcolor=${preset.headlineStyle.color}:` +
      `x=(w-text_w)/2:y=${headlineY}:` +
      `box=1:boxcolor=black@0.7:boxborderw=12`;

    const proc = spawn("ffmpeg", [
      "-y",
      "-i", rawFramePath,
      "-filter_complex", filterComplex,
      "-frames:v", "1",
      "-q:v", "2",
      outputPath,
    ]);
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        resolve({ success: false, error: "Cover composition timed out" });
      }
    }, 30_000);

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, data: undefined });
      } else {
        resolve({ success: false, error: `Cover composition failed (code ${code}): ${stderr.slice(-300)}` });
      }
    });

    proc.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, error: `Cover composition spawn error: ${err.message}` });
    });
  });
}

// --- Utilities -----------------------------------------------------------

function cleanupFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}
