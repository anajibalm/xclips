import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { RenderJob, Result } from "@/lib/xclips/types";
import { xclipsDb } from "@/lib/xclips/xclips-db";
import { buildFfmpegCommand, generateAssSubtitles } from "@/lib/xclips/ffmpeg-builder";
import { calculateKeepIntervals } from "@/lib/xclips/filler-detector";
import { remapWordsToKeepTimeline } from "@/lib/xclips/phrase-segmentation";
import { queueLogger, ffmpegLogger } from "@/lib/logger";


import * as os from "os";

export type HardwareEncoder = "nvenc" | "videotoolbox" | "qsv" | "amf" | "cpu";

export interface HardwareProfile {
  encoder: HardwareEncoder;
  label: string;
  deviceType: "nvidia" | "intel_qsv" | "amd_amf" | "apple_silicon" | "cpu";
  cpuModel: string;
  cpuCores: number;
  description: string;
}

let cachedHardwareProfile: HardwareProfile | null = null;
let cachedHwAccel: HardwareEncoder | null = null;

export function resetHardwareProfileCacheForTesting() {
  cachedHardwareProfile = null;
  cachedHwAccel = null;
}

/**
 * Detects supported hardware acceleration profile on the host system by actively verifying
 * 1-frame encoding execution, adapting dynamically to NVIDIA GPU, Intel QSV, AMD AMF, Apple Silicon, or Multi-Core CPU.
 */
export async function detectHardwareProfile(): Promise<HardwareProfile> {
  if (cachedHardwareProfile) return cachedHardwareProfile;

  const testEncoder = (encoder: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const proc = spawn("ffmpeg", [
        "-f",
        "lavfi",
        "-i",
        "color=s=128x128:d=0.04",
        "-c:v",
        encoder,
        "-f",
        "null",
        "-",
      ]);

      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // ignore kill error
        }
        resolve(false);
      }, 1500);

      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      proc.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  };

  const cpuModel = os.cpus()[0]?.model?.trim() || "Multi-core CPU";
  const cpuCores = os.cpus().length || 4;
  const platform = os.platform();

  try {
    // 1. Check NVIDIA NVENC (GPU acceleration for NVIDIA RTX / GTX on Windows / Linux)
    if (await testEncoder("h264_nvenc")) {
      cachedHardwareProfile = {
        encoder: "nvenc",
        label: "NVIDIA NVENC (GPU Hardware Acceleration)",
        deviceType: "nvidia",
        cpuModel,
        cpuCores,
        description: "Akselerasi GPU ultra-cepat melalui dedicated NVENC engine",
      };
      cachedHwAccel = "nvenc";
      ffmpegLogger.info(cachedHardwareProfile, "Hardware acceleration profile: NVIDIA NVENC detected");
      return cachedHardwareProfile;
    }

    // 2. Check Intel Quick Sync Video (QSV) (Hardware acceleration for Intel Core / Iris / Arc iGPU/dGPU)
    if (await testEncoder("h264_qsv")) {
      cachedHardwareProfile = {
        encoder: "qsv",
        label: "Intel Quick Sync Video (QSV Hardware Acceleration)",
        deviceType: "intel_qsv",
        cpuModel,
        cpuCores,
        description: "Akselerasi hardware cepat melalui Intel Quick Sync Video (iGPU/dGPU)",
      };
      cachedHwAccel = "qsv";
      ffmpegLogger.info(cachedHardwareProfile, "Hardware acceleration profile: Intel QSV detected");
      return cachedHardwareProfile;
    }

    // 3. Check Apple Silicon VideoToolbox (Hardware acceleration for Mac M1/M2/M3/M4)
    if (platform === "darwin" && (await testEncoder("h264_videotoolbox"))) {
      cachedHardwareProfile = {
        encoder: "videotoolbox",
        label: "Apple VideoToolbox (Hardware Acceleration)",
        deviceType: "apple_silicon",
        cpuModel,
        cpuCores,
        description: "Akselerasi native Apple Silicon Media Engine pada macOS",
      };
      cachedHwAccel = "videotoolbox";
      ffmpegLogger.info(cachedHardwareProfile, "Hardware acceleration profile: Apple VideoToolbox detected");
      return cachedHardwareProfile;
    }

    // 4. Check AMD AMF (Hardware acceleration for AMD Radeon GPUs)
    if (await testEncoder("h264_amf")) {
      cachedHardwareProfile = {
        encoder: "amf",
        label: "AMD AMF (Radeon Hardware Acceleration)",
        deviceType: "amd_amf",
        cpuModel,
        cpuCores,
        description: "Akselerasi hardware GPU melalui AMD Advanced Media Framework",
      };
      cachedHwAccel = "amf";
      ffmpegLogger.info(cachedHardwareProfile, "Hardware acceleration profile: AMD AMF detected");
      return cachedHardwareProfile;
    }

    // 5. Optimized Multi-threaded CPU libx264
    cachedHardwareProfile = {
      encoder: "cpu",
      label: `${cpuModel} (${cpuCores} Threads - libx264 AVX2)`,
      deviceType: "cpu",
      cpuModel,
      cpuCores,
      description: `Optimasi multi-threading CPU (${cpuCores} threads) dengan akurasi visual 100% tanpa distorsi`,
    };
    cachedHwAccel = "cpu";
  } catch (err: unknown) {
    cachedHardwareProfile = {
      encoder: "cpu",
      label: `${cpuModel} (${cpuCores} Threads - libx264)`,
      deviceType: "cpu",
      cpuModel,
      cpuCores,
      description: "Fallback CPU multi-threading encoder",
    };
    cachedHwAccel = "cpu";
  }

  ffmpegLogger.info(cachedHardwareProfile, "Hardware acceleration profile verified");
  return cachedHardwareProfile;
}

export async function detectHardwareAcceleration(): Promise<HardwareEncoder> {
  const profile = await detectHardwareProfile();
  return profile.encoder;
}


class JobQueueManager {
  private maxConcurrent = os.cpus().length >= 12 ? 2 : 1;
  private runningJobs = 0;
  private queue: string[] = [];

  enqueue(clipId: string, projectId: string, options?: { resolution?: string; bitrate?: string; format?: string }): RenderJob {
    const existingJob = xclipsDb.getActiveJobForClip(clipId);
    if (existingJob) {
      queueLogger.info(
        { jobId: existingJob.id, clipId, projectId, status: existingJob.status },
        "Active render job already exists for clip, reusing existing job"
      );
      return existingJob;
    }

    const now = new Date().toISOString();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: RenderJob = {
      id: jobId,
      clipId,
      projectId,
      progress: 0,
      status: "queued",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      resolution: options?.resolution,
      bitrate: options?.bitrate,
      format: options?.format,
    };

    queueLogger.info({ jobId, clipId, projectId, queueLength: this.queue.length + 1 }, "New render job enqueued");
    xclipsDb.saveJob(job);
    this.queue.push(jobId);
    this.processNext();

    return job;
  }

  private async processNext() {
    if (this.runningJobs >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift();
    if (!jobId) return;

    const job = xclipsDb.getJob(jobId);
    if (!job) return;

    this.runningJobs++;
    job.status = "rendering";
    job.progress = 5;
    xclipsDb.saveJob(job);
    queueLogger.info({ jobId, clipId: job.clipId, runningJobs: this.runningJobs }, "Processing render job");

    try {
      await this.executeRender(job);
      queueLogger.info({ jobId, clipId: job.clipId, outputPath: job.outputPath }, "Render job finished successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Render error";
      const stack = err instanceof Error ? err.stack : undefined;
      job.status = "failed";
      job.error = msg;
      xclipsDb.saveJob(job);
      queueLogger.error({ jobId, clipId: job.clipId, err: msg, stack }, "Render job failed");
    } finally {
      this.runningJobs--;
      this.processNext();
    }
  }

  private async executeRender(job: RenderJob): Promise<void> {
    const clip = xclipsDb.getClip(job.clipId);
    const project = xclipsDb.getProject(job.projectId);

    if (!clip || !project) {
      throw new Error(`Klip (${job.clipId}) atau Proyek (${job.projectId}) tidak ditemukan`);
    }

    const transcript =
      (clip.transcriptId ? xclipsDb.getTranscript(job.projectId, clip.transcriptId) : null) ||
      xclipsDb.getTranscript(job.projectId);

    const outputDir = path.resolve(process.cwd(), "output", "xclips", project.id);
    fs.mkdirSync(outputDir, { recursive: true });

    // Sanitize project name and clip title to be 100% safe on Windows, Linux, and macOS
    const safeProjectName = (project.name || "video")
      .replace(/[\/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    const safeTitle = (clip.title || clip.hookText || "clip")
      .replace(/[\/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 30);
    const fileExt = job.format === "mov" ? "mov" : "mp4";
    const outputFileName = `${safeProjectName}_${clip.id}_${safeTitle}.${fileExt}`;
    const finalOutputPath = path.join(outputDir, outputFileName);
    const assSubtitlePath = path.join(outputDir, `${clip.id}_subtitles.ass`);

    // Step 1: Calculate keep intervals (cut fillers & custom exclusions)
    const exclusions: Array<{ startSec: number; endSec: number }> = [];
    if (clip.removeFillers && transcript) {
      for (const w of transcript.words) {
        if (w.isFiller && w.start >= clip.startSec && w.end <= clip.endSec) {
          exclusions.push({ startSec: w.start, endSec: w.end });
        }
      }
    }
    for (const cut of clip.customCuts) {
      exclusions.push({ startSec: cut.start, endSec: cut.end });
    }

    const keepIntervals = calculateKeepIntervals(
      clip.startSec,
      clip.endSec,
      exclusions
    );
    ffmpegLogger.debug({ clipId: clip.id, exclusionsCount: exclusions.length, intervalsCount: keepIntervals.length }, "Calculated non-destructive keep intervals");

    // Step 2: Generate ASS Subtitles (remap words to keepIntervals timeline to eliminate A/V drift)
    const isSubtitlesEnabled = clip.subtitleStyle?.enabled !== false;
    let actualAssPath: string | undefined = undefined;

    if (isSubtitlesEnabled && transcript && transcript.words.length > 0) {
      // Remap words to the concatenated output timeline
      const remappedWords = remapWordsToKeepTimeline(transcript.words, keepIntervals, clip.startSec);
      const totalRenderedSec = keepIntervals.reduce((acc, k) => acc + (k.duration ?? Math.max(0, k.end - k.start)), 0);

      generateAssSubtitles(
        remappedWords,
        0, // remapped words start at 0 (rendered video origin)
        totalRenderedSec,
        clip.subtitleStyle,
        assSubtitlePath,
        clip.aspectRatio
      );
      if (fs.existsSync(assSubtitlePath)) {
        actualAssPath = assSubtitlePath;
        ffmpegLogger.debug({ clipId: clip.id, assSubtitlePath, wordsCount: remappedWords.length }, "Generated .ass karaoke subtitles synced with keep-intervals");
      }
    } else {
      ffmpegLogger.debug({ clipId: clip.id, enabled: isSubtitlesEnabled }, "Subtitles disabled or no transcript words, skipping ASS burn-in");
    }

    // Step 3: Detect HW Acceleration
    const hwaccel = await detectHardwareAcceleration();

    // Parse target resolution override if specified in job options
    let targetWidth: number | undefined;
    let targetHeight: number | undefined;
    if (job.resolution && job.resolution.includes("x")) {
      const parts = job.resolution.split("x").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        targetWidth = parts[0];
        targetHeight = parts[1];
      }
    }

    // Step 4: Build ffmpeg command runner with automatic fallback
    const sourceVideo = project.normalizedPath || project.sourcePath;

    const runFfmpeg = (currentHw: HardwareEncoder): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const { args } = buildFfmpegCommand(
          {
            sourceVideo,
            sourceWidth: project.width,
            sourceHeight: project.height,
            clipStart: clip.startSec,
            clipEnd: clip.endSec,
            keepIntervals,
            aspectRatio: clip.aspectRatio || "9:16",
            layoutMode: clip.layoutMode,
            panOffsetX: clip.panOffsetX,
            assSubtitlePath: actualAssPath,
            targetWidth,
            targetHeight,
          },
          finalOutputPath,
          currentHw
        );

        ffmpegLogger.info(
          { jobId: job.id, clipId: clip.id, hwaccel: currentHw, output: finalOutputPath, argsCount: args.length },
          "Spawning FFmpeg process"
        );

        const proc = spawn("ffmpeg", args);
        let stderr = "";

        proc.stderr.on("data", (data) => {
          const str = data.toString();
          stderr += str;
          // Progress parsing
          const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const mins = parseInt(timeMatch[2]);
            const secs = parseFloat(timeMatch[3]);
            const currentSecs = hours * 3600 + mins * 60 + secs;
            const targetDuration = clip.endSec - clip.startSec;
            if (targetDuration > 0) {
              const pct = Math.min(95, Math.max(10, Math.round((currentSecs / targetDuration) * 90)));
              if (pct !== job.progress) {
                job.progress = pct;
                xclipsDb.saveJob(job);
              }
            }
          }
        });

        proc.on("close", (code) => {
          if (code === 0 && fs.existsSync(finalOutputPath)) {
            const stat = fs.statSync(finalOutputPath);
            if (stat.size > 0) {
              job.progress = 100;
              job.status = "completed";
              job.outputPath = finalOutputPath;
              job.completedAt = new Date().toISOString();
              xclipsDb.saveJob(job);

              clip.status = "completed";
              clip.outputPath = finalOutputPath;
              xclipsDb.saveClip(clip);

              ffmpegLogger.info(
                { jobId: job.id, clipId: clip.id, finalOutputPath, sizeBytes: stat.size },
                "FFmpeg render process completed successfully"
              );
              return resolve();
            }
          }

          // Clean up 0-byte or corrupted file if render failed
          if (fs.existsSync(finalOutputPath)) {
            try {
              fs.unlinkSync(finalOutputPath);
            } catch {
              // ignore
            }
          }

          ffmpegLogger.error({ jobId: job.id, clipId: clip.id, code, stderr: stderr.slice(-1000) }, "FFmpeg execution failed");
          reject(new Error(`FFmpeg error (code ${code}): ${stderr.slice(-300)}`));
        });

        proc.on("error", (err) => {
          if (fs.existsSync(finalOutputPath)) {
            try {
              fs.unlinkSync(finalOutputPath);
            } catch {
              // ignore
            }
          }
          ffmpegLogger.error({ jobId: job.id, clipId: clip.id, err: err.message }, "FFmpeg process spawn error");
          reject(err);
        });
      });
    };

    // Step 5: Execute ffmpeg with hardware acceleration and automatic CPU fallback
    try {
      await runFfmpeg(hwaccel);
    } catch (hwError) {
      if (hwaccel !== "cpu") {
        ffmpegLogger.warn(
          { jobId: job.id, hwaccel, err: hwError instanceof Error ? hwError.message : String(hwError) },
          "Hardware accelerated render failed; falling back to CPU encoder (libx264)"
        );
        job.progress = 5;
        xclipsDb.saveJob(job);
        await runFfmpeg("cpu");
      } else {
        throw hwError;
      }
    } finally {
      // Auto-clean temporary ASS subtitle file to conserve disk space
      if (actualAssPath && fs.existsSync(actualAssPath)) {
        try {
          fs.unlinkSync(actualAssPath);
        } catch {
          // ignore
        }
      }
    }
  }
}

export const renderQueue = new JobQueueManager();

