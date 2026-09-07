import { spawn } from "child_process";
import * as fs from "fs";
import {
  ProductionBrief,
  AccountPreset,
  EditPlan,
} from "@/lib/xclips/auto-production-types";
import { Result } from "@/lib/xclips/types";

// ============================================================
// Auto Production QC — Slice 4
// ============================================================

// --- Types ----------------------------------------------------------------

export type QcCheckStatus = "PASS" | "REVIEW" | "FAIL";

export interface QcCheck {
  id: string;
  category: "media" | "contract" | "editorial";
  status: QcCheckStatus;
  message: string;
}

export interface QcResult {
  verdict: "READY" | "NEEDS_REVIEW" | "FAILED";
  checks: QcCheck[];
  passedCount: number;
  reviewCount: number;
  failedCount: number;
}

export interface RunAutoProductionQcInput {
  outputPath: string;
  brief: ProductionBrief;
  preset: AccountPreset;
  editPlan: EditPlan;
  renderWidth: number;
  renderHeight: number;
  renderFps: number;
  renderDurationSec: number;
}

// --- Constants ------------------------------------------------------------

const DURATION_MIN_SEC = 30;
const DURATION_MAX_SEC = 60;

// --- Entry Point ----------------------------------------------------------

export async function runAutoProductionQc(
  input: RunAutoProductionQcInput,
): Promise<QcResult> {
  const checks: QcCheck[] = [];

  // ── Media Checks ────────────────────────────────────────────────────────
  await runMediaChecks(input, checks);

  // ── Contract / Compliance Checks ────────────────────────────────────────
  runContractChecks(input, checks);

  // ── Editorial Signal Checks ─────────────────────────────────────────────
  runEditorialChecks(input.editPlan, checks);

  // ── Verdict ─────────────────────────────────────────────────────────────
  const passedCount = checks.filter((c) => c.status === "PASS").length;
  const reviewCount = checks.filter((c) => c.status === "REVIEW").length;
  const failedCount = checks.filter((c) => c.status === "FAIL").length;

  let verdict: QcResult["verdict"];
  if (failedCount > 0) {
    verdict = "FAILED";
  } else if (reviewCount > 0) {
    verdict = "NEEDS_REVIEW";
  } else {
    verdict = "READY";
  }

  return { verdict, checks, passedCount, reviewCount, failedCount };
}

// --- Media Checks --------------------------------------------------------

async function runMediaChecks(
  input: RunAutoProductionQcInput,
  checks: QcCheck[],
): Promise<void> {
  // 1. File exists and non-zero
  if (!fs.existsSync(input.outputPath)) {
    checks.push({ id: "media_file_exists", category: "media", status: "FAIL", message: "Output file does not exist" });
    return;
  }
  const stat = fs.statSync(input.outputPath);
  if (stat.size === 0) {
    checks.push({ id: "media_file_nonzero", category: "media", status: "FAIL", message: "Output file is empty (0 bytes)" });
    return;
  }
  checks.push({ id: "media_file_exists", category: "media", status: "PASS", message: `Output file exists (${stat.size} bytes)` });

  // 2. Probe with ffprobe
  const probe = await probeOutput(input.outputPath);
  if (!probe.success) {
    checks.push({ id: "media_probe", category: "media", status: "FAIL", message: probe.error });
    return;
  }

  const { videoStream, audioStream, durationSec } = probe.data;

  // Video stream
  if (!videoStream) {
    checks.push({ id: "media_video_stream", category: "media", status: "FAIL", message: "No video stream found" });
  } else {
    checks.push({ id: "media_video_stream", category: "media", status: "PASS", message: "Video stream present" });
  }

  // Audio stream
  if (!audioStream) {
    checks.push({ id: "media_audio_stream", category: "media", status: "FAIL", message: "No audio stream found" });
  } else {
    checks.push({ id: "media_audio_stream", category: "media", status: "PASS", message: "Audio stream present" });
  }

  // Dimensions
  if (videoStream) {
    const w = parseInt(videoStream.width || "0");
    const h = parseInt(videoStream.height || "0");
    if (w !== input.preset.width || h !== input.preset.height) {
      checks.push({ id: "media_dimensions", category: "media", status: "FAIL", message: `Dimensions ${w}x${h} do not match preset ${input.preset.width}x${input.preset.height}` });
    } else {
      checks.push({ id: "media_dimensions", category: "media", status: "PASS", message: `Dimensions ${w}x${h} match preset` });
    }
  }

  // FPS
  if (videoStream) {
    const fpsStr = videoStream.r_frame_rate || "0/1";
    const [num, den] = fpsStr.split("/").map(Number);
    const fps = den ? num / den : 0;
    if (Math.round(fps) !== input.preset.fps) {
      checks.push({ id: "media_fps", category: "media", status: "FAIL", message: `FPS ${fps} does not match preset ${input.preset.fps}` });
    } else {
      checks.push({ id: "media_fps", category: "media", status: "PASS", message: `FPS ${Math.round(fps)} matches preset` });
    }
  }

  // Duration
  if (durationSec < DURATION_MIN_SEC) {
    checks.push({ id: "media_duration", category: "media", status: "FAIL", message: `Duration ${durationSec.toFixed(1)}s is below minimum ${DURATION_MIN_SEC}s` });
  } else if (durationSec > DURATION_MAX_SEC) {
    checks.push({ id: "media_duration", category: "media", status: "FAIL", message: `Duration ${durationSec.toFixed(1)}s exceeds maximum ${DURATION_MAX_SEC}s` });
  } else {
    checks.push({ id: "media_duration", category: "media", status: "PASS", message: `Duration ${durationSec.toFixed(1)}s within ${DURATION_MIN_SEC}-${DURATION_MAX_SEC}s` });
  }
}

// --- Contract / Compliance Checks ----------------------------------------

function runContractChecks(
  input: RunAutoProductionQcInput,
  checks: QcCheck[],
): void {
  // Headline
  if (!input.editPlan.headline || input.editPlan.headline.trim().length === 0) {
    checks.push({ id: "contract_headline", category: "contract", status: "REVIEW", message: "Headline is missing — editorial compliance requires human review" });
  } else {
    checks.push({ id: "contract_headline", category: "contract", status: "PASS", message: `Headline present: "${input.editPlan.headline}"` });
  }

  // sourceName
  if (!input.brief.sourceName || input.brief.sourceName.trim().length === 0) {
    checks.push({ id: "contract_source_name", category: "contract", status: "REVIEW", message: "sourceName is missing — editorial compliance requires human review" });
  } else {
    checks.push({ id: "contract_source_name", category: "contract", status: "PASS", message: `sourceName present: "${input.brief.sourceName}"` });
  }

  // accountHandle
  if (!input.brief.accountHandle || input.brief.accountHandle.trim().length === 0) {
    checks.push({ id: "contract_account_handle", category: "contract", status: "REVIEW", message: "accountHandle is missing — editorial compliance requires human review" });
  } else {
    checks.push({ id: "contract_account_handle", category: "contract", status: "PASS", message: `accountHandle present: "${input.brief.accountHandle}"` });
  }

  // Statement duration
  const statementDuration = input.editPlan.statementEnd - input.editPlan.statementStart;
  if (statementDuration < DURATION_MIN_SEC || statementDuration > DURATION_MAX_SEC) {
    checks.push({ id: "contract_statement_duration", category: "contract", status: "FAIL", message: `Statement duration ${statementDuration.toFixed(1)}s outside ${DURATION_MIN_SEC}-${DURATION_MAX_SEC}s range` });
  } else {
    checks.push({ id: "contract_statement_duration", category: "contract", status: "PASS", message: `Statement duration ${statementDuration.toFixed(1)}s within range` });
  }

  // Preset resolved
  if (!input.preset || !input.preset.id) {
    checks.push({ id: "contract_preset", category: "contract", status: "FAIL", message: "Account preset not resolved" });
  } else {
    checks.push({ id: "contract_preset", category: "contract", status: "PASS", message: `Preset resolved: ${input.preset.id}` });
  }

  // Render completed (output file exists and non-empty — already checked in media, but mark as contract pass)
  if (fs.existsSync(input.outputPath) && fs.statSync(input.outputPath).size > 0) {
    checks.push({ id: "contract_render_completed", category: "contract", status: "PASS", message: "Render completed successfully" });
  } else {
    checks.push({ id: "contract_render_completed", category: "contract", status: "FAIL", message: "Render did not complete" });
  }

  // sourceDate presence — missing is REVIEW, not FAIL
  if (!input.brief.sourceDate || input.brief.sourceDate.trim().length === 0) {
    checks.push({ id: "contract_source_date", category: "contract", status: "REVIEW", message: "sourceDate not provided — editorial compliance requires human review" });
  } else {
    checks.push({ id: "contract_source_date", category: "contract", status: "PASS", message: `sourceDate present: "${input.brief.sourceDate}"` });
  }
}

// --- Editorial Signal Checks ---------------------------------------------

function runEditorialChecks(
  editPlan: EditPlan,
  checks: QcCheck[],
): void {
  // statementSignal
  const stmtSig = editPlan.statementSignal;
  if (stmtSig.confidence === "low") {
    checks.push({ id: "editorial_statement_signal", category: "editorial", status: "REVIEW", message: `Statement signal is "low": ${stmtSig.warnings.join("; ") || "no details"}` });
  } else if (stmtSig.confidence === "review") {
    checks.push({ id: "editorial_statement_signal", category: "editorial", status: "REVIEW", message: `Statement signal requires review: ${stmtSig.warnings.join("; ") || "no details"}` });
  } else {
    checks.push({ id: "editorial_statement_signal", category: "editorial", status: "PASS", message: "Statement signal strong" });
  }

  // headlineSignal
  const hlSig = editPlan.headlineSignal;
  if (hlSig.confidence === "low") {
    checks.push({ id: "editorial_headline_signal", category: "editorial", status: "REVIEW", message: `Headline signal is "low": ${hlSig.warnings.join("; ") || "no details"}` });
  } else if (hlSig.confidence === "review") {
    checks.push({ id: "editorial_headline_signal", category: "editorial", status: "REVIEW", message: `Headline signal requires review: ${hlSig.warnings.join("; ") || "no details"}` });
  } else {
    checks.push({ id: "editorial_headline_signal", category: "editorial", status: "PASS", message: "Headline signal strong" });
  }

  // brollSignal — source-only MVP: no B-roll does not block READY
  const brSig = editPlan.brollSignal;
  if (editPlan.brollPlacements.length === 0) {
    checks.push({ id: "editorial_broll_signal", category: "editorial", status: "PASS", message: "No B-roll placements (source-only MVP — does not block READY)" });
  } else if (brSig.confidence === "low") {
    checks.push({ id: "editorial_broll_signal", category: "editorial", status: "REVIEW", message: `B-roll signal is "low": ${brSig.warnings.join("; ") || "no details"}` });
  } else if (brSig.confidence === "review") {
    checks.push({ id: "editorial_broll_signal", category: "editorial", status: "REVIEW", message: `B-roll signal requires review: ${brSig.warnings.join("; ") || "no details"}` });
  } else {
    checks.push({ id: "editorial_broll_signal", category: "editorial", status: "PASS", message: "B-roll signal strong" });
  }
}

// --- FFprobe Helper ------------------------------------------------------

interface ProbeStreams {
  codec_type: string;
  width?: string;
  height?: string;
  r_frame_rate?: string;
}

interface ProbeData {
  videoStream: ProbeStreams | undefined;
  audioStream: ProbeStreams | undefined;
  durationSec: number;
}

async function probeOutput(
  outputPath: string,
): Promise<Result<ProbeData>> {
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
    }, 30_000);

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
          (s: ProbeStreams) => s.codec_type === "video",
        );
        const audioStream = info.streams?.find(
          (s: ProbeStreams) => s.codec_type === "audio",
        );
        const durationSec = parseFloat(info.format?.duration || "0");
        resolve({ success: true, data: { videoStream, audioStream, durationSec } });
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
