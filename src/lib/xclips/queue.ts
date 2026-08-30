import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { RenderJob, Result } from "@/lib/xclips/types";
import { xclipsDb } from "@/lib/xclips/xclips-db";
import { buildFfmpegCommand, generateAssSubtitles } from "@/lib/xclips/ffmpeg-builder";
import { calculateKeepIntervals } from "@/lib/xclips/filler-detector";
import { remapWordsToKeepTimeline } from "@/lib/xclips/phrase-segmentation";
import { queueLogger, ffmpegLogger } from "@/lib/logger";


type HardwareEncoder = "nvenc" | "qsv" | "amf" | "cpu";

let cachedHwAccel: HardwareEncoder | null = null;

/**
 * Detects supported hardware acceleration on the host system
 */
export async function detectHardwareAcceleration(): Promise<HardwareEncoder> {
  if (cachedHwAccel) return cachedHwAccel;

  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-encoders"]);
    let stdout = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", () => {
      if (stdout.includes("h264_nvenc")) {
        cachedHwAccel = "nvenc";
      } else if (stdout.includes("h264_qsv")) {
        cachedHwAccel = "qsv";
      } else if (stdout.includes("h264_amf")) {
        cachedHwAccel = "amf";
      } else {
        cachedHwAccel = "cpu";
      }
      ffmpegLogger.info({ encoder: cachedHwAccel }, "Hardware acceleration encoder detected");
      resolve(cachedHwAccel);
    });

    proc.on("error", (err) => {
      ffmpegLogger.warn({ err: err.message }, "Failed to probe ffmpeg encoders, falling back to CPU");
      cachedHwAccel = "cpu";
      resolve("cpu");
    });
  });
}


class JobQueueManager {
  private maxConcurrent = 2;
  private runningJobs = 0;
  private queue: string[] = [];

  enqueue(clipId: string, projectId: string): RenderJob {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: RenderJob = {
      id: jobId,
      clipId,
      projectId,
      progress: 0,
      status: "queued",
      startedAt: new Date().toISOString(),
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

    const safeTitle = clip.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const outputFileName = `${project.name}_${clip.id}_${safeTitle}.mp4`;
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

    // Step 4: Build ffmpeg command
    const sourceVideo = project.normalizedPath || project.sourcePath;
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
      },
      finalOutputPath,
      hwaccel
    );

    ffmpegLogger.info({ jobId: job.id, clipId: clip.id, hwaccel, output: finalOutputPath, argsCount: args.length }, "Spawning FFmpeg process");

    // Step 5: Execute ffmpeg
    await new Promise<void>((resolve, reject) => {
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
          job.progress = 100;
          job.status = "completed";
          job.outputPath = finalOutputPath;
          job.completedAt = new Date().toISOString();
          xclipsDb.saveJob(job);

          clip.status = "completed";
          clip.outputPath = finalOutputPath;
          xclipsDb.saveClip(clip);

          ffmpegLogger.info({ jobId: job.id, clipId: clip.id, finalOutputPath }, "FFmpeg render process completed successfully");
          resolve();
        } else {
          ffmpegLogger.error({ jobId: job.id, clipId: clip.id, code, stderr: stderr.slice(-1000) }, "FFmpeg execution failed");
          reject(new Error(`FFmpeg error (code ${code}): ${stderr.slice(-300)}`));
        }
      });

      proc.on("error", (err) => {
        ffmpegLogger.error({ jobId: job.id, clipId: clip.id, err: err.message }, "FFmpeg process spawn error");
        reject(err);
      });
    });
  }
}

export const renderQueue = new JobQueueManager();

