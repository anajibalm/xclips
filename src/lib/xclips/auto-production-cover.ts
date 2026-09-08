import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  AccountPreset,
  EditPlan,
} from "@/lib/xclips/auto-production-types";
import { escapeDrawText } from "@/lib/xclips/auto-production-renderer";
import { Result } from "@/lib/xclips/types";
import { fitAutoProductionHeadline } from "@/lib/xclips/auto-production-headline";
import { buildSourceTransformFilter, getBakomLayout, HEADLINE_ACCENT_BAR_GAP, HEADLINE_ACCENT_BAR_WIDTH, type ContentType } from "@/lib/xclips/auto-production-bakom-layout";

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
  contentType?: ContentType;
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
  const { sourceVideoPath, sourceWidth, sourceHeight, editPlan, preset, contentType = "default" } = input;

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
  const composeResult = await composeCover(rawFramePath, coverPath, editPlan, preset, sourceWidth, sourceHeight, contentType);
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

export function buildAutoProductionCoverFilter(
  editPlan: EditPlan,
  preset: AccountPreset,
  sourceWidth = 0,
  sourceHeight = 0,
  contentType: ContentType = "default",
): string {
  const { width: targetW, height: targetH } = preset;
  const layout = getBakomLayout(preset);
  const headlineLayout = fitAutoProductionHeadline(editPlan.headline, preset);
  let filter = buildSourceTransformFilter("[0:v]", "[v_cover]", layout, targetW, targetH, "default", sourceWidth, sourceHeight, contentType) +
    `;[v_cover]drawbox=x=0:y=${layout.headlineTop - 12}:w=${targetW}:h=${layout.headlineAreaHeight}:color=black@0.7:t=fill` +
    `,drawbox=x=${layout.safeMarginX}:y=${layout.headlineTop}:w=${HEADLINE_ACCENT_BAR_WIDTH}:h=${layout.headlineAreaHeight - 24}:color=${layout.headlineAccentColor}:t=fill`;
  headlineLayout.lines.forEach((line, index) => {
    const headlineY = layout.headlineTop + index * (headlineLayout.fontSizePx + headlineLayout.lineSpacingPx);
    filter += `,drawtext=text='${escapeDrawText(line)}':` +
      `fontsize=${headlineLayout.fontSizePx}:fontcolor=${preset.headlineStyle.color}:` +
      `x=${layout.safeMarginX + HEADLINE_ACCENT_BAR_WIDTH + HEADLINE_ACCENT_BAR_GAP}:y=${headlineY}:box=0`;
  });
  return filter;
}

function composeCover(
  rawFramePath: string,
  outputPath: string,
  editPlan: EditPlan,
  preset: AccountPreset,
  sourceWidth: number,
  sourceHeight: number,
  contentType: ContentType,
): Promise<Result<void>> {
  return new Promise((resolve) => {
    const filterComplex = buildAutoProductionCoverFilter(editPlan, preset, sourceWidth, sourceHeight, contentType);

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
