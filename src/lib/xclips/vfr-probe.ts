import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { ProbeResult, Result } from "@/lib/xclips/types";
import { mediaLogger } from "@/lib/logger";


/**
 * Execute ffprobe to analyze video metadata, stream info, and frame rate consistency (VFR vs CFR)
 */
export async function probeMedia(filePath: string): Promise<Result<ProbeResult>> {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File tidak ditemukan: ${filePath}` };
  }

  return new Promise((resolve) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];

    const proc = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        mediaLogger.error({ filePath, code, stderr: stderr.slice(0, 500) }, "ffprobe execution failed");
        return resolve({
          success: false,
          error: `ffprobe gagal (exit ${code}): ${stderr}`,
        });
      }

      try {
        const metadata = JSON.parse(stdout);
        const videoStream = metadata.streams?.find(
          (s: { codec_type?: string }) => s.codec_type === "video"
        );
        const audioStream = metadata.streams?.find(
          (s: { codec_type?: string }) => s.codec_type === "audio"
        );

        const duration = parseFloat(
          metadata.format?.duration || videoStream?.duration || audioStream?.duration || "0"
        );
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;

        // Determine FPS and check for VFR (Variable Frame Rate)
        let fps = 30.0;
        let isVfr = false;

        if (videoStream) {
          const rFps = parseFraction(videoStream.r_frame_rate);
          const avgFps = parseFraction(videoStream.avg_frame_rate);

          fps = avgFps > 0 ? avgFps : rFps > 0 ? rFps : 30.0;

          // If r_frame_rate differs significantly from avg_frame_rate, or timecode indicates VFR
          if (rFps > 0 && avgFps > 0 && Math.abs(rFps - avgFps) > 0.05) {
            isVfr = true;
          }
        }

        const probeData: ProbeResult = {
          duration,
          width,
          height,
          fps: Math.round(fps * 100) / 100,
          isVfr,
          hasAudio: !!audioStream,
          audioCodec: audioStream?.codec_name,
          videoCodec: videoStream?.codec_name,
        };

        mediaLogger.info({ filePath, probeData }, "Media probed successfully");
        resolve({ success: true, data: probeData });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal mengurai metadata ffprobe";
        mediaLogger.error({ filePath, err: msg }, "Failed to parse ffprobe JSON output");
        resolve({ success: false, error: msg });
      }
    });

    proc.on("error", (err) => {
      mediaLogger.error({ filePath, err: err.message }, "Error spawning ffprobe process");
      resolve({
        success: false,
        error: `Gagal menjalankan ffprobe: ${err.message}. Pastikan ffmpeg/ffprobe terpasang.`,
      });
    });
  });
}

/**
 * Normalizes a VFR video to Constant Frame Rate (CFR) to prevent A/V drift when cutting
 */
export async function normalizeToCfr(
  sourcePath: string,
  outputPath: string,
  targetFps: number = 30.0
): Promise<Result<string>> {
  mediaLogger.info({ sourcePath, outputPath, targetFps }, "Normalizing VFR video to CFR");
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Use fast CFR re-mux / transcode with -vsync cfr or -fps_mode cfr
    const args = [
      "-y",
      "-i",
      sourcePath,
      "-fps_mode",
      "cfr",
      "-r",
      targetFps.toString(),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "18",
      "-c:a",
      "copy",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        mediaLogger.info({ sourcePath, outputPath }, "CFR normalization finished successfully");
        resolve({ success: true, data: outputPath });
      } else {
        mediaLogger.error({ sourcePath, outputPath, code, stderr: stderr.slice(-500) }, "CFR normalization failed");
        resolve({
          success: false,
          error: `Gagal normalisasi CFR: ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on("error", (err) => {
      mediaLogger.error({ sourcePath, err: err.message }, "Error executing CFR normalization process");
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Extracts 16kHz mono WAV audio from video for fast transcription
 */
export async function extractAudioWav(
  sourcePath: string,
  outputPath: string
): Promise<Result<string>> {
  mediaLogger.debug({ sourcePath, outputPath }, "Extracting 16kHz mono WAV audio");
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const args = [
      "-y",
      "-i",
      sourcePath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        mediaLogger.info({ sourcePath, outputPath }, "WAV audio extracted successfully");
        resolve({ success: true, data: outputPath });
      } else {
        mediaLogger.error({ sourcePath, outputPath, code, stderr: stderr.slice(-500) }, "WAV audio extraction failed");
        resolve({
          success: false,
          error: `Gagal ekstrak audio: ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on("error", (err) => {
      mediaLogger.error({ sourcePath, err: err.message }, "Error executing audio extraction process");
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Extracts a lightweight compressed audio file (16kHz mono MP3) for fast AI transcription
 */
export async function extractCompressedAudio(
  sourcePath: string,
  outputPath: string,
  bitrate: string = "48k"
): Promise<Result<string>> {
  mediaLogger.debug({ sourcePath, outputPath, bitrate }, "Extracting compressed audio for AI transcription");
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const args = [
      "-y",
      "-i",
      sourcePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      bitrate,
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        mediaLogger.info({ sourcePath, outputPath }, "Compressed audio extracted successfully");
        resolve({ success: true, data: outputPath });
      } else {
        mediaLogger.error({ sourcePath, outputPath, code, stderr: stderr.slice(-500) }, "Compressed audio extraction failed");
        resolve({
          success: false,
          error: `Gagal ekstrak audio terkompresi: ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on("error", (err) => {
      mediaLogger.error({ sourcePath, err: err.message }, "Error executing compressed audio extraction");
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Extracts a specific audio slice/segment with compression for long audio chunking
 */
export async function extractAudioSegment(
  sourcePath: string,
  outputPath: string,
  startSec: number,
  durationSec: number
): Promise<Result<string>> {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const args = [
      "-y",
      "-ss",
      startSec.toFixed(2),
      "-t",
      durationSec.toFixed(2),
      "-i",
      sourcePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, data: outputPath });
      } else {
        resolve({
          success: false,
          error: `Gagal ekstrak audio chunk: ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}


/**
 * Extracts a high-quality JPEG frame from video at the specified timecode
 */
export async function extractFrameImage(
  sourcePath: string,
  outputPath: string,
  timeSec: number = 1.0
): Promise<Result<string>> {
  mediaLogger.debug({ sourcePath, outputPath, timeSec }, "Extracting frame image from video");
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const args = [
      "-y",
      "-ss",
      timeSec.toFixed(2),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        mediaLogger.info({ sourcePath, outputPath, timeSec }, "Frame image extracted successfully");
        resolve({ success: true, data: outputPath });
      } else {
        mediaLogger.error({ sourcePath, outputPath, code, stderr: stderr.slice(-500) }, "Frame extraction failed");
        resolve({
          success: false,
          error: `Gagal ekstrak thumbnail: ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on("error", (err) => {
      mediaLogger.error({ sourcePath, err: err.message }, "Error executing frame extraction process");
      resolve({ success: false, error: err.message });
    });
  });
}

function parseFraction(fracStr?: string): number {
  if (!fracStr) return 0;
  const parts = fracStr.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den !== 0 ? num / den : 0;
  }
  return parseFloat(fracStr) || 0;
}

