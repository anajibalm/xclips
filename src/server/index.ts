import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

import { cors } from "hono/cors";
import { getEnv } from "../lib/env";
import { httpLogger, generateTraceId } from "../lib/logger";

interface AppVariables {
  traceId: string;
}

const app = new Hono<{ Variables: AppVariables }>();
const env = getEnv();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Trace-Id", "X-Request-Id", "Range"],
    exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type", "X-Trace-Id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);


// 
// Tracing & Request Logger Middleware
app.use("*", async (c, next) => {
  const traceId = c.req.header("X-Trace-Id") || c.req.header("X-Request-Id") || generateTraceId("req");
  c.set("traceId", traceId);
  c.res.headers.set("X-Trace-Id", traceId);

  const start = Date.now();
  const reqMethod = c.req.method;
  const reqPath = c.req.path;
  const isPollingOrStream = reqPath.endsWith("/logs") || reqPath.endsWith("/stream");

  if (!isPollingOrStream) {
    httpLogger.debug({ traceId, method: reqMethod, path: reqPath }, `--> ${reqMethod} ${reqPath}`);
  }

  try {
    await next();
    const durationMs = Date.now() - start;
    const statusCode = c.res.status;

    if (statusCode >= 500) {
      httpLogger.error({ traceId, method: reqMethod, path: reqPath, statusCode, durationMs }, `<-- ${reqMethod} ${reqPath} ${statusCode} (${durationMs}ms)`);
    } else if (statusCode >= 400) {
      httpLogger.warn({ traceId, method: reqMethod, path: reqPath, statusCode, durationMs }, `<-- ${reqMethod} ${reqPath} ${statusCode} (${durationMs}ms)`);
    } else if (!isPollingOrStream) {
      httpLogger.info({ traceId, method: reqMethod, path: reqPath, statusCode, durationMs }, `<-- ${reqMethod} ${reqPath} ${statusCode} (${durationMs}ms)`);
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const errorObj = err instanceof Error ? err : new Error(String(err));
    httpLogger.error(
      {
        traceId,
        method: reqMethod,
        path: reqPath,
        durationMs,
        err: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack,
        },
      },
      `Unhandled error in request ${reqMethod} ${reqPath}: ${errorObj.message}`
    );
    throw err;
  }
});
// 
// Global Error Handler
app.onError((err, c) => {
  const traceId = c.get("traceId") || generateTraceId("err");
  const errorObj = err instanceof Error ? err : new Error(String(err));


  httpLogger.error(
    {
      traceId,
      path: c.req.path,
      method: c.req.method,
      err: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      },
    },
    `Global Exception [${traceId}]: ${errorObj.message}`
  );

  return c.json(
    {
      ok: false,
      message: errorObj.message || "Terjadi kesalahan internal pada server",
      traceId,
    },
    500
  );
});
// 
// --- xclips Routes ---
import { xclipsService } from "../lib/xclips.service";
import { xclipsDb } from "../lib/xclips/xclips-db";
import { AiProviderType, SubtitlePreset } from "../lib/xclips/types";
import { detectHardwareAcceleration, detectHardwareProfile } from "../lib/xclips/queue";
import { extractAudioWav, extractFrameImage } from "../lib/xclips/vfr-probe";
import { getPresetSubtitleStyle } from "../lib/xclips/subtitle-presets";

app.get("/api/xclips/hwaccel", async (c) => {
  const profile = await detectHardwareProfile();
  return c.json({ ok: true, profile, encoder: profile.encoder });
});

app.get("/api/xclips/projects", (c) => {
  try {
    const projects = xclipsDb.getAllProjects();
    return c.json({ ok: true, projects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load xclips projects";
    return c.json({ ok: false, message }, 500);
  }
});

// YouTube Metadata Preview Endpoint
app.post("/api/xclips/youtube/info", async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;
    if (!url) {
      return c.json({ ok: false, message: "YouTube URL is required" }, 400);
    }

    const res = await xclipsService.getYouTubeMetadata(url);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    return c.json({ ok: true, info: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch YouTube metadata";
    return c.json({ ok: false, message }, 500);
  }
});

import {
  DownloadProgress,
  fetchYouTubeInfo,
  downloadYouTubeVideo,
  downloadAudioOnly,
  downloadSubtitleOnly,
  downloadThumbnailOnly,
  registerActiveProcess,
  unregisterActiveProcess,
  cancelActiveProcess,
  isValidMediaUrl,
  parseTimeToSeconds,
  formatSecondsToTime,
} from "../lib/xclips/ytdlp-downloader";
import {
  XclipsProject,
  DownloadRecord,
  DownloaderPlatform,
  DownloaderFormatType,
  DownloaderQuality,
  TimeRange,
} from "../lib/xclips/types";

// Active download tasks progress store
interface DownloadTaskState extends DownloadProgress {
  project?: XclipsProject;
  downloadRecord?: DownloadRecord;
  error?: string;
}
const activeDownloads = new Map<string, DownloadTaskState>();

// YouTube Ingest Async Trigger (Returns Task ID for live progress tracking)
app.post("/api/xclips/youtube/ingest-async", async (c) => {
  try {
    const body = await c.req.json();
    const {
      url,
      quality,
      name,
      downloadSubtitles,
      generateAiSubtitles,
      aiModel,
      subtitleStylePreset,
    } = body as {
      url?: string;
      quality?: any;
      name?: string;
      downloadSubtitles?: boolean;
      generateAiSubtitles?: boolean;
      aiModel?: string;
      subtitleStylePreset?: SubtitlePreset;
    };

    if (!url) {
      return c.json({ ok: false, message: "URL YouTube wajib diisi" }, 400);
    }

    const taskId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    activeDownloads.set(taskId, {
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedStr: "Memulai...",
      etaStr: "--:--",
      status: "downloading",
    });

    // Run async download in background and track progress
    (async () => {
      try {
        const res = await xclipsService.ingestYouTubeUrl(
          url,
          {
            quality,
            customName: name,
            downloadSubtitles: downloadSubtitles ?? true,
          },
          (prog) => {
            const current = activeDownloads.get(taskId);
            activeDownloads.set(taskId, {
              ...current,
              ...prog,
              status: prog.status,
            });
          },
          (eagerProject) => {
            const current = activeDownloads.get(taskId);
            if (current) {
              activeDownloads.set(taskId, {
                ...current,
                project: eagerProject,
              });
            }
          }
        );

        if (!res.success) {
          activeDownloads.set(taskId, {
            percent: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speedStr: "",
            etaStr: "",
            status: "error",
            error: res.error,
          });
          return;
        }

        const project = res.data;

        // Generate AI Subtitles if requested
        if (generateAiSubtitles) {
          activeDownloads.set(taskId, {
            percent: 88,
            downloadedBytes: 0,
            totalBytes: 0,
            speedStr: "",
            etaStr: "AI Transcribing...",
            status: "transcribing",
          });

          const transRes = await xclipsService.transcribeProject(project.id, {
            model: aiModel,
            label: "AI Master Subtitle",
          });

          if (transRes.success) {
            xclipsDb.setActiveTranscript(project.id, transRes.data.id);
          } else {
            httpLogger.warn(
              { projectId: project.id, err: transRes.error },
              "AI Subtitle transcription returned error during ingest"
            );
          }
        }

        // Apply subtitle style preset to masterStyle
        if (subtitleStylePreset) {
          const masterStyleSubtitle = getPresetSubtitleStyle(subtitleStylePreset);
          const currentProj = xclipsDb.getProject(project.id) || project;
          currentProj.masterStyle = {
            ...(currentProj.masterStyle || {}),
            aspectRatio: currentProj.masterStyle?.aspectRatio || "9:16",
            layoutMode: currentProj.masterStyle?.layoutMode || "blur_bg",
            subtitleStyle: masterStyleSubtitle,
          };
          currentProj.masterStyleJson = JSON.stringify(currentProj.masterStyle);
          xclipsDb.saveProject(currentProj);
        }

        activeDownloads.set(taskId, {
          percent: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "completed",
          project: xclipsDb.getProject(project.id) || project,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat download";
        activeDownloads.set(taskId, {
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "error",
          error: msg,
        });
      }
    })();

    return c.json({ ok: true, taskId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start YouTube download";
    return c.json({ ok: false, message }, 500);
  }
});

// YouTube Ingest Progress Polling
app.get("/api/xclips/youtube/progress/:taskId", (c) => {
  const taskId = c.req.param("taskId");
  const task = activeDownloads.get(taskId);
  if (!task) {
    return c.json({ ok: false, message: "Task not found" }, 404);
  }
  return c.json({ ok: true, progress: task });
});

// =============================================================================
// FOOTAGE DOWNLOADER — Universal yt-dlp downloader (YouTube, TikTok, Instagram)
// =============================================================================

/** Detect platform from a URL string */
function detectFootagePlatform(url: string): "youtube" | "tiktok" | "instagram" | "x" | "pinterest" | "unknown" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/twitter\.com|x\.com/i.test(url)) return "x";
  if (/pinterest\.com|pin\.it/i.test(url)) return "pinterest";
  return "unknown";
}

/** POST /api/xclips/footage/info — Fetch video metadata from any yt-dlp supported URL */
app.post("/api/xclips/footage/info", async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body as { url?: string };
    if (!url || typeof url !== "string" || !url.trim()) {
      return c.json({ ok: false, message: "URL is required" }, 400);
    }

    const platform = detectFootagePlatform(url.trim());
    // fetchYouTubeInfo uses --dump-json which works for TikTok and Instagram too
    const res = await xclipsService.getYouTubeMetadata(url.trim());
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    return c.json({ ok: true, platform, info: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch video info";
    return c.json({ ok: false, message }, 500);
  }
});

/** POST /api/xclips/footage/download-async — Start background download, return taskId */
app.post("/api/xclips/footage/download-async", async (c) => {
  try {
    const body = await c.req.json();
    const { url, quality } = body as { url?: string; quality?: "best" | "1080p" | "720p" | "480p" };
    if (!url || typeof url !== "string" || !url.trim()) {
      return c.json({ ok: false, message: "URL is required" }, 400);
    }

    const taskId = `footage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    activeDownloads.set(taskId, {
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedStr: "Starting...",
      etaStr: "--:--",
      status: "downloading",
    });

    // Run async in background
    (async () => {
      try {
        const res = await xclipsService.ingestYouTubeUrl(
          url.trim(),
          { quality: quality ?? "1080p", downloadSubtitles: false },
          (prog) => {
            activeDownloads.set(taskId, { ...prog });
          }
        );

        if (!res.success) {
          activeDownloads.set(taskId, {
            percent: 0, downloadedBytes: 0, totalBytes: 0,
            speedStr: "", etaStr: "",
            status: "error",
            error: res.error,
          });
        } else {
          activeDownloads.set(taskId, {
            percent: 100, downloadedBytes: 0, totalBytes: 0,
            speedStr: "", etaStr: "",
            status: "completed",
            project: res.data,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Download failed";
        activeDownloads.set(taskId, {
          percent: 0, downloadedBytes: 0, totalBytes: 0,
          speedStr: "", etaStr: "",
          status: "error",
          error: msg,
        });
      }
    })();

    return c.json({ ok: true, taskId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start download";
    return c.json({ ok: false, message }, 500);
  }
});

/** GET /api/xclips/footage/progress/:taskId — Poll download progress */
app.get("/api/xclips/footage/progress/:taskId", (c) => {
  const taskId = c.req.param("taskId");
  const task = activeDownloads.get(taskId);
  if (!task) {
    return c.json({ ok: false, message: "Task not found" }, 404);
  }
  return c.json({ ok: true, progress: task });
});

// =============================================================================
// DEDICATED MULTIPLATFORM DOWNLOADER API ROUTES (/api/xclips/downloader/*)
// =============================================================================

function detectPlatformHelper(url: string): DownloaderPlatform {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/twitter\.com|x\.com/i.test(url)) return "x";
  if (/pinterest\.com|pin\.it/i.test(url)) return "pinterest";
  return "generic";
}

/** POST /api/xclips/downloader/info — Instant metadata preview */
app.post("/api/xclips/downloader/info", async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body as { url?: string };
    if (!url || typeof url !== "string" || !url.trim()) {
      return c.json({ ok: false, message: "URL wajib diisi" }, 400);
    }

    const platform = detectPlatformHelper(url.trim());
    const res = await fetchYouTubeInfo(url.trim());
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    return c.json({ ok: true, platform, info: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengambil metadata video";
    return c.json({ ok: false, message }, 500);
  }
});

/** POST /api/xclips/downloader/start — Async multi-format download trigger */
app.post("/api/xclips/downloader/start", async (c) => {
  try {
    const body = await c.req.json();
    const {
      url,
      formatType = "video",
      quality = "1080p",
      downloadSubtitles = false,
      customName,
      timeRange,
    } = body as {
      url?: string;
      formatType?: DownloaderFormatType;
      quality?: DownloaderQuality;
      downloadSubtitles?: boolean;
      customName?: string;
      timeRange?: TimeRange;
    };

    if (!url || typeof url !== "string" || !url.trim()) {
      return c.json({ ok: false, message: "URL wajib diisi" }, 400);
    }

    const platform = detectPlatformHelper(url.trim());
    const taskId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const outputDir = path.resolve(process.cwd(), "vault", "xclips", "downloads");
    fs.mkdirSync(outputDir, { recursive: true });

    // Validate timeRange option for direct splitting (YouTube only)
    let validTimeRange: TimeRange | undefined = undefined;
    if (timeRange && typeof timeRange === "object" && platform === "youtube") {
      const sSec = parseTimeToSeconds(timeRange.start);
      const eSec = parseTimeToSeconds(timeRange.end);
      if (eSec > sSec && sSec >= 0) {
        validTimeRange = {
          start: formatSecondsToTime(sSec),
          end: formatSecondsToTime(eSec),
        };
      }
    }

    // Initial in-memory state
    activeDownloads.set(taskId, {
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedStr: "Memulai...",
      etaStr: "--:--",
      status: "downloading",
    });

    // Initial database record
    const rangeTag = validTimeRange ? ` [${validTimeRange.start}-${validTimeRange.end}]` : "";
    const initialRecord: DownloadRecord = {
      id: taskId,
      platform,
      url: url.trim(),
      title: (customName || "Mengunduh media...") + rangeTag,
      author: "",
      durationSec: validTimeRange
        ? Math.max(1, Math.round(parseTimeToSeconds(validTimeRange.end) - parseTimeToSeconds(validTimeRange.start)))
        : 0,
      thumbnailUrl: "",
      formatType,
      quality,
      filePath: "",
      fileSizeBytes: 0,
      status: "downloading",
      createdAt: new Date().toISOString(),
      rawJson: validTimeRange ? JSON.stringify({ timeRange: validTimeRange }) : undefined,
      timeRange: validTimeRange,
    };
    xclipsDb.addDownloadRecord(initialRecord);

    // Run async in background
    (async () => {
      try {
        let downloadResult:
          | { success: true; data: { filePath: string; info: any } }
          | { success: false; error: string };

        if (formatType === "audio") {
          downloadResult = await downloadAudioOnly(
            {
              url: url.trim(),
              outputDir,
              format: (quality as "mp3" | "m4a" | "wav") || "mp3",
              customName,
              timeRange: validTimeRange,
            },
            (prog) => {
              activeDownloads.set(taskId, { ...prog });
            },
            (proc) => registerActiveProcess(taskId, proc)
          );
        } else if (formatType === "subtitle") {
          downloadResult = await downloadSubtitleOnly(
            {
              url: url.trim(),
              outputDir,
              subFormat: (quality as "srt" | "vtt" | "txt") || "srt",
              customName,
            },
            (prog) => {
              activeDownloads.set(taskId, { ...prog });
            },
            (proc) => registerActiveProcess(taskId, proc)
          );
        } else if (formatType === "thumbnail") {
          downloadResult = await downloadThumbnailOnly(
            {
              url: url.trim(),
              outputDir,
              customName,
            },
            (prog) => {
              activeDownloads.set(taskId, { ...prog });
            }
          );
        } else {
          // Video download
          const vidRes = await downloadYouTubeVideo(
            {
              url: url.trim(),
              outputDir,
              quality: quality as any,
              downloadSubtitles,
              timeRange: validTimeRange,
            },
            (prog) => {
              activeDownloads.set(taskId, { ...prog });
            },
            (proc) => registerActiveProcess(taskId, proc)
          );
          if (vidRes.success) {
            downloadResult = {
              success: true,
              data: { filePath: vidRes.data.videoPath, info: vidRes.data.info },
            };
          } else {
            downloadResult = { success: false, error: vidRes.error };
          }
        }

        unregisterActiveProcess(taskId);

        if (!downloadResult.success) {
          activeDownloads.set(taskId, {
            percent: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speedStr: "",
            etaStr: "",
            status: "error",
            error: downloadResult.error,
          });
          xclipsDb.updateDownloadRecord(taskId, {
            status: "error",
            error: downloadResult.error,
          });
        } else {
          const finalFile = downloadResult.data.filePath;
          let fileSizeBytes = 0;
          try {
            fileSizeBytes = fs.statSync(finalFile).size;
          } catch {
            // non-fatal
          }

          const info = downloadResult.data.info;
          const baseTitle = info?.title || customName || path.basename(finalFile);
          const finalTitle = validTimeRange && !baseTitle.includes(validTimeRange.start)
            ? `${baseTitle}${rangeTag}`
            : baseTitle;

          const isImg = info?.mediaType === "image" || /\.(jpg|jpeg|png|webp)$/i.test(finalFile);
          const resolvedFormatType: DownloaderFormatType = isImg ? "image" : formatType;

          xclipsDb.updateDownloadRecord(taskId, {
            status: "completed",
            filePath: finalFile,
            fileSizeBytes,
            title: finalTitle,
            author: info?.uploader || info?.channel || "",
            durationSec: isImg ? 0 : (info?.duration || 0),
            thumbnailUrl: info?.thumbnail || "",
            formatType: resolvedFormatType,
          });

          const completedRecord = xclipsDb.getDownloadRecordById(taskId);
          activeDownloads.set(taskId, {
            percent: 100,
            downloadedBytes: fileSizeBytes,
            totalBytes: fileSizeBytes,
            speedStr: "",
            etaStr: "",
            status: "completed",
            downloadRecord: completedRecord || undefined,
          });
        }
      } catch (err: unknown) {
        unregisterActiveProcess(taskId);
        const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengunduh";
        activeDownloads.set(taskId, {
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "error",
          error: msg,
        });
        xclipsDb.updateDownloadRecord(taskId, {
          status: "error",
          error: msg,
        });
      }
    })();

    return c.json({ ok: true, taskId, recordId: taskId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memulai proses download";
    return c.json({ ok: false, message }, 500);
  }
});

/** GET /api/xclips/downloader/tasks/active — Get all active background download tasks */
app.get("/api/xclips/downloader/tasks/active", (c) => {
  const activeTasks: { taskId: string; progress: DownloadTaskState }[] = [];
  for (const [taskId, state] of activeDownloads.entries()) {
    if (state.status === "downloading" || state.status === "merging") {
      activeTasks.push({ taskId, progress: state });
    }
  }
  return c.json({ ok: true, tasks: activeTasks });
});

/** GET /api/xclips/downloader/progress/:taskId — Polling download status */
app.get("/api/xclips/downloader/progress/:taskId", (c) => {
  const taskId = c.req.param("taskId");
  const inMem = activeDownloads.get(taskId);
  if (inMem) {
    return c.json({ ok: true, progress: inMem });
  }

  // Fallback to database record
  const record = xclipsDb.getDownloadRecordById(taskId);
  if (record) {
    return c.json({
      ok: true,
      progress: {
        percent: record.status === "completed" ? 100 : 0,
        downloadedBytes: record.fileSizeBytes,
        totalBytes: record.fileSizeBytes,
        speedStr: "",
        etaStr: "",
        status: record.status,
        error: record.error,
        downloadRecord: record,
      },
    });
  }

  return c.json({ ok: false, message: "Task tidak ditemukan" }, 404);
});

/** POST /api/xclips/downloader/cancel/:taskId — Cancel active download task */
app.post("/api/xclips/downloader/cancel/:taskId", (c) => {
  const taskId = c.req.param("taskId");
  cancelActiveProcess(taskId);
  activeDownloads.set(taskId, {
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedStr: "",
    etaStr: "",
    status: "error",
    error: "Download dibatalkan oleh pengguna",
  });
  xclipsDb.updateDownloadRecord(taskId, {
    status: "error",
    error: "Download dibatalkan oleh pengguna",
  });
  return c.json({ ok: true, message: "Download berhasil dibatalkan" });
});

/** GET /api/xclips/downloader/history — Get download records */
app.get("/api/xclips/downloader/history", (c) => {
  try {
    const platform = c.req.query("platform");
    const formatType = c.req.query("formatType");
    const search = c.req.query("search");

    const records = xclipsDb.getDownloadRecords({ platform, formatType, search });
    const recordsWithExistence = records.map((r) => ({
      ...r,
      exists: r.filePath ? fs.existsSync(r.filePath) : false,
    }));

    return c.json({ ok: true, records: recordsWithExistence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat riwayat unduhan";
    return c.json({ ok: false, message }, 500);
  }
});

/** DELETE /api/xclips/downloader/history/:id — Delete download record and file */
app.delete("/api/xclips/downloader/history/:id", (c) => {
  try {
    const id = c.req.param("id");
    const record = xclipsDb.getDownloadRecordById(id);
    if (!record) {
      return c.json({ ok: false, message: "Riwayat download tidak ditemukan" }, 404);
    }

    if (record.filePath && fs.existsSync(record.filePath)) {
      try {
        fs.unlinkSync(record.filePath);
      } catch {
        // non-fatal
      }
    }

    xclipsDb.deleteDownloadRecord(id);
    return c.json({ ok: true, message: "File dan riwayat berhasil dihapus" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus riwayat";
    return c.json({ ok: false, message }, 500);
  }
});

/** GET /api/xclips/downloader/file/:id — Stream or download media file */
app.get("/api/xclips/downloader/file/:id", (c) => {
  const id = c.req.param("id");
  const record = xclipsDb.getDownloadRecordById(id);
  if (!record || !record.filePath || !fs.existsSync(record.filePath)) {
    return c.text("File media tidak ditemukan", 404);
  }

  const stat = fs.statSync(record.filePath);
  const ext = path.extname(record.filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".srt": "text/plain; charset=utf-8",
    ".vtt": "text/vtt; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const isDownload = c.req.query("download") === "1";

  const range = c.req.header("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const stream = fs.createReadStream(record.filePath, { start, end });

    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = fs.createReadStream(record.filePath);
  const headers: Record<string, string> = {
    "Content-Length": String(stat.size),
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
  };
  if (isDownload) {
    const filename = path.basename(record.filePath);
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(filename)}"`;
  }

  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers,
  });
});

/** POST /api/xclips/downloader/open-folder — Open file location in Windows Explorer */
app.post("/api/xclips/downloader/open-folder", async (c) => {
  try {
    const body = await c.req.json();
    const { id, filePath } = body as { id?: string; filePath?: string };

    let targetPath = filePath;
    if (!targetPath && id) {
      const record = xclipsDb.getDownloadRecordById(id);
      if (record?.filePath) {
        targetPath = record.filePath;
      }
    }

    if (!targetPath) {
      targetPath = path.resolve(process.cwd(), "vault", "xclips", "downloads");
    }

    const absolutePath = path.resolve(targetPath);
    if (!fs.existsSync(absolutePath)) {
      return c.json({ ok: false, message: "File atau folder tidak ditemukan" }, 404);
    }

    const isFile = fs.statSync(absolutePath).isFile();
    const cmd =
      process.platform === "win32"
        ? (isFile ? `explorer.exe /select,"${absolutePath}"` : `explorer.exe "${absolutePath}"`)
        : (process.platform === "darwin" ? `open -R "${absolutePath}"` : `xdg-open "${path.dirname(absolutePath)}"`);

    exec(cmd, (err) => {
      if (err) {
        httpLogger.warn({ err: err.message, path: absolutePath }, "Failed to launch file explorer");
      }
    });

    return c.json({ ok: true, message: "File explorer berhasil dibuka" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuka file explorer";
    return c.json({ ok: false, message }, 500);
  }
});

/** POST /api/xclips/downloader/create-project/:id — Convert downloaded video into xClips project */
app.post("/api/xclips/downloader/create-project/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const record = xclipsDb.getDownloadRecordById(id);
    if (!record) {
      return c.json({ ok: false, message: "Riwayat download tidak ditemukan" }, 404);
    }

    if (!record.filePath || !fs.existsSync(record.filePath)) {
      return c.json({ ok: false, message: "File fisik video tidak ditemukan pada storage lokal" }, 404);
    }

    if (record.formatType !== "video") {
      return c.json({ ok: false, message: "Hanya format video yang dapat dibuka di xClips Studio" }, 400);
    }

    const res = await xclipsService.ingestLocalFile(record.filePath, record.title);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    return c.json({ ok: true, project: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat project dari file video";
    return c.json({ ok: false, message }, 500);
  }
});


/** POST /api/xclips/open-in-explorer — Open folder or select file in OS File Explorer */
app.post("/api/xclips/open-in-explorer", async (c) => {
  try {
    const body = await c.req.json();
    const { path: targetPath, projectId } = body as { path?: string; projectId?: string };

    let resolvedPath = targetPath;
    if (!resolvedPath && projectId) {
      const project = xclipsDb.getProject(projectId);
      if (project?.sourcePath) {
        resolvedPath = project.sourcePath;
      }
    }

    if (!resolvedPath) {
      return c.json({ ok: false, message: "Path or projectId required" }, 400);
    }

    const absolutePath = path.resolve(resolvedPath);
    if (!fs.existsSync(absolutePath)) {
      return c.json({ ok: false, message: "File or directory not found" }, 404);
    }

    const isFile = fs.statSync(absolutePath).isFile();
    const cmd =
      process.platform === "win32"
        ? (isFile ? `explorer.exe /select,"${absolutePath}"` : `explorer.exe "${absolutePath}"`)
        : (process.platform === "darwin" ? `open -R "${absolutePath}"` : `xdg-open "${path.dirname(absolutePath)}"`);

    exec(cmd, (err) => {
      if (err) {
        httpLogger.warn({ err: err.message, path: absolutePath }, "Failed to launch file explorer");
      }
    });

    return c.json({ ok: true, message: "File explorer opened" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to open explorer";
    return c.json({ ok: false, message }, 500);
  }
});


// YouTube Ingest Endpoint (Direct Synchronous fallback)
app.post("/api/xclips/youtube/ingest", async (c) => {
  try {
    const body = await c.req.json();
    const { url, quality, name, downloadSubtitles } = body;
    if (!url) {
      return c.json({ ok: false, message: "URL YouTube wajib diisi" }, 400);
    }

    const res = await xclipsService.ingestYouTubeUrl(url, {
      quality,
      customName: name,
      downloadSubtitles: downloadSubtitles ?? true,
    });

    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    return c.json({ ok: true, project: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to download YouTube video";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/projects/ingest", async (c) => {
  try {
    const body = await c.req.json();
    const {
      sourcePath,
      name,
      generateAiSubtitles,
      aiModel,
      subtitleStylePreset,
    } = body as {
      sourcePath?: string;
      name?: string;
      generateAiSubtitles?: boolean;
      aiModel?: string;
      subtitleStylePreset?: SubtitlePreset;
    };

    if (!sourcePath) {
      return c.json({ ok: false, message: "sourcePath is required" }, 400);
    }

    const res = await xclipsService.ingestLocalFile(sourcePath, name);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }

    const project = res.data;

    // Generate AI Subtitles if requested
    if (generateAiSubtitles) {
      const transRes = await xclipsService.transcribeProject(project.id, {
        model: aiModel,
        label: "AI Master Subtitle",
      });
      if (transRes.success) {
        xclipsDb.setActiveTranscript(project.id, transRes.data.id);
      } else {
        httpLogger.warn(
          { projectId: project.id, err: transRes.error },
          "AI Subtitle transcription failed during local media ingest"
        );
      }
    }

    // Apply subtitle style preset to masterStyle
    if (subtitleStylePreset) {
      const masterStyleSubtitle = getPresetSubtitleStyle(subtitleStylePreset);
      const currentProj = xclipsDb.getProject(project.id) || project;
      currentProj.masterStyle = {
        ...(currentProj.masterStyle || {}),
        aspectRatio: currentProj.masterStyle?.aspectRatio || "9:16",
        layoutMode: currentProj.masterStyle?.layoutMode || "blur_bg",
        subtitleStyle: masterStyleSubtitle,
      };
      currentProj.masterStyleJson = JSON.stringify(currentProj.masterStyle);
      xclipsDb.saveProject(currentProj);
    }

    const finalProject = xclipsDb.getProject(project.id) || project;
    return c.json({ ok: true, project: finalProject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import media file";
    return c.json({ ok: false, message }, 500);
  }
});

// --- Media Streaming Route (HTTP 206 Partial Content Range for Video Player) ---
app.get("/api/xclips/media/:id/stream", (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.text("Project not found", 404);

  const videoPath = project.normalizedPath || project.sourcePath;
  if (!fs.existsSync(videoPath)) return c.text("Video file not found on disk", 404);

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = c.req.header("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = typeof Bun !== "undefined"
      ? Bun.file(videoPath).slice(start, end + 1)
      : (fs.createReadStream(videoPath, { start, end }) as any);

    return new Response(file as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } else {
    const file = typeof Bun !== "undefined"
      ? Bun.file(videoPath)
      : (fs.createReadStream(videoPath) as any);

    return new Response(file as any, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      },
    });
  }
});

// Rendered Clip Streaming Route
app.get("/api/xclips/clips/:id/stream", (c) => {
  const id = c.req.param("id");
  const clip = xclipsDb.getClip(id);
  if (!clip || !clip.outputPath || !fs.existsSync(clip.outputPath)) {
    return c.text("Klip tidak ditemukan atau belum selesai dirender", 404);
  }

  const stat = fs.statSync(clip.outputPath);
  const fileSize = stat.size;
  const range = c.req.header("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = typeof Bun !== "undefined"
      ? Bun.file(clip.outputPath).slice(start, end + 1)
      : (fs.createReadStream(clip.outputPath, { start, end }) as any);

    return new Response(file as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } else {
    const file = typeof Bun !== "undefined"
      ? Bun.file(clip.outputPath)
      : (fs.createReadStream(clip.outputPath) as any);

    return new Response(file as any, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      },
    });
  }
});

// Project Process Logs Endpoint (Optimized Fast Tail Reading)
app.get("/api/xclips/projects/:id/logs", (c) => {
  const id = c.req.param("id");
  const logFile = path.resolve(process.cwd(), "logs", "app.log");
  if (!fs.existsSync(logFile)) {
    return c.json({ ok: true, logs: [] });
  }

  let fd: number | null = null;
  try {
    const stats = fs.statSync(logFile);
    if (stats.size === 0) {
      return c.json({ ok: true, logs: [] });
    }

    // Read only the last 256 KB of the log file for instant tail performance
    const maxReadBytes = Math.min(stats.size, 256 * 1024);
    const buffer = Buffer.alloc(maxReadBytes);
    fd = fs.openSync(logFile, "r");
    fs.readSync(fd, buffer, 0, maxReadBytes, stats.size - maxReadBytes);
    fs.closeSync(fd);
    fd = null;

    const raw = buffer.toString("utf-8");
    const lines = raw.trim().split("\n");
    const entries: any[] = [];

    for (let i = lines.length - 1; i >= 0 && entries.length < 150; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        // Exclude internal HTTP server access logs so polling /logs doesn't pollute process logs
        if (parsed.module === "http:server") continue;

        if (
          parsed.projectId === id ||
          parsed.url?.includes(id) ||
          parsed.outputDir?.includes(id) ||
          parsed.msg?.includes(id) ||
          parsed.module?.startsWith("media:") ||
          parsed.module?.startsWith("ai:") ||
          parsed.module?.startsWith("db:") ||
          parsed.module?.startsWith("ffmpeg:") ||
          parsed.module?.startsWith("filler:")
        ) {
          entries.push(parsed);
        }
      } catch {
        // ignore incomplete/malformed line at tail start
      }
    }

    return c.json({ ok: true, logs: entries.reverse() });
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* no-op */ }
    }
    return c.json({ ok: true, logs: [] });
  }
});

// Clear Logs Endpoint
app.delete("/api/xclips/projects/:id/logs", (c) => {
  const logFile = path.resolve(process.cwd(), "logs", "app.log");
  try {
    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, "");
    }
    return c.json({ ok: true, message: "Logs cleared successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to clear logs";
    return c.json({ ok: false, message: msg }, 500);
  }
});




function extractYouTubeId(sourcePath: string): string | null {
  if (!sourcePath) return null;
  const bracketMatch = sourcePath.match(/\[([a-zA-Z0-9_-]{11})\]/);
  if (bracketMatch) return bracketMatch[1];
  const urlMatch = sourcePath.match(/(?:v=|\/|be\/)([a-zA-Z0-9_-]{11})/);
  if (urlMatch) return urlMatch[1];
  return null;
}

// --- Project Assets Endpoint ---
app.get("/api/xclips/projects/:id/assets", async (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.json({ ok: false, message: "Project not found" }, 404);

  const transcript = xclipsDb.getTranscript(id);
  const videoPath = project.normalizedPath || project.sourcePath;
  const videoExists = fs.existsSync(videoPath);
  const videoStat = videoExists ? fs.statSync(videoPath) : null;

  // Audio path
  const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
  const audioPath = project.audioPath || path.join(cacheDir, "audio_16k.wav");
  const audioExists = fs.existsSync(audioPath);
  const audioStat = audioExists ? fs.statSync(audioPath) : null;

  // YouTube Thumbnail resolution
  const youtubeId = extractYouTubeId(project.sourcePath);
  const isYouTube = Boolean(youtubeId);
  const thumbPath = path.join(cacheDir, "thumbnail.jpg");

  // Auto-fetch YouTube thumbnail to cache if not exists
  if (!fs.existsSync(thumbPath) && youtubeId) {
    try {
      let ytRes = await fetch(`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`);
      if (!ytRes.ok) {
        ytRes = await fetch(`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`);
      }
      if (ytRes.ok) {
        fs.mkdirSync(cacheDir, { recursive: true });
        const arrayBuf = await ytRes.arrayBuffer();
        fs.writeFileSync(thumbPath, Buffer.from(arrayBuf));
      }
    } catch (err) {
      console.error("Failed to auto-fetch YouTube thumbnail in assets:", err);
    }
  }

  const thumbExists = fs.existsSync(thumbPath);
  const thumbStat = thumbExists ? fs.statSync(thumbPath) : null;

  // SRT file
  const srtContent = transcript?.srtContent || "";
  const srtExists = srtContent.length > 0;
  const srtBytes = Buffer.byteLength(srtContent, "utf-8");

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return c.json({
    ok: true,
    assets: {
      video: {
        name: path.basename(videoPath),
        path: videoPath,
        exists: videoExists,
        sizeBytes: videoStat?.size || 0,
        sizeFormatted: formatBytes(videoStat?.size || 0),
        width: project.width,
        height: project.height,
        fps: project.frameRate,
        isVfr: project.isVfr,
        durationSec: project.durationSec,
        format: "video/mp4",
        streamUrl: `/api/xclips/media/${id}/stream`,
        downloadUrl: `/api/xclips/media/${id}/download?type=video`,
      },
      audio: {
        name: audioExists ? path.basename(audioPath) : "audio_16k.wav",
        path: audioPath,
        exists: audioExists,
        sizeBytes: audioStat?.size || 0,
        sizeFormatted: formatBytes(audioStat?.size || 0),
        sampleRate: "16,000 Hz",
        channels: "1 (Mono)",
        format: "audio/wav",
        streamUrl: `/api/xclips/media/${id}/audio`,
        downloadUrl: `/api/xclips/media/${id}/download?type=audio`,
      },
      srt: {
        name: `${project.name.replace(/[^\w\s-]/gi, "").trim().slice(0, 30) || "subtitle"}.srt`,
        exists: srtExists,
        sizeBytes: srtBytes,
        sizeFormatted: formatBytes(srtBytes),
        lineCount: srtContent ? srtContent.split("\n\n").length : 0,
        wordCount: transcript?.words?.length || 0,
        language: transcript?.language || "id",
        content: srtContent,
        rawText: transcript?.rawText || "",
        downloadUrl: `/api/xclips/media/${id}/download?type=srt`,
      },
      thumbnail: {
        name: isYouTube ? `youtube_cover_${youtubeId}.jpg` : "thumbnail.jpg",
        path: thumbPath,
        exists: thumbExists,
        sizeBytes: thumbStat?.size || 0,
        sizeFormatted: formatBytes(thumbStat?.size || 0),
        url: `/api/xclips/media/${id}/thumbnail`,
        downloadUrl: `/api/xclips/media/${id}/download?type=thumbnail`,
        isYouTube,
        youtubeId: youtubeId || undefined,
        youtubeUrl: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
        youtubeThumbnailUrl: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg` : undefined,
      },
    },
  });
});

// Audio streaming route
// Audio streaming route with CORS & Partial Content support
app.get("/api/xclips/media/:id/audio", async (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.text("Project not found", 404);

  const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
  let audioPath = project.audioPath || path.join(cacheDir, "audio_16k.wav");

  if (!fs.existsSync(audioPath)) {
    const videoPath = project.normalizedPath || project.sourcePath;
    if (fs.existsSync(videoPath)) {
      const res = await extractAudioWav(videoPath, audioPath);
      if (!res.success) return c.text("Failed to extract audio", 500);
      audioPath = res.data;
    } else {
      return c.text("Audio not found", 404);
    }
  }

  const stat = fs.statSync(audioPath);
  const fileSize = stat.size;
  const range = c.req.header("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = typeof Bun !== "undefined"
      ? Bun.file(audioPath).slice(start, end + 1)
      : (fs.createReadStream(audioPath, { start, end }) as any);

    return new Response(file as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "audio/wav",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const file = typeof Bun !== "undefined"
    ? Bun.file(audioPath)
    : (fs.createReadStream(audioPath) as any);

  return new Response(file as any, {
    status: 200,
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
});

// Thumbnail Image Streaming & Auto-generation Route with CORS
app.get("/api/xclips/media/:id/thumbnail", async (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.text("Proyek tidak ditemukan", 404);

  const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
  const thumbPath = path.join(cacheDir, "thumbnail.jpg");

  if (!fs.existsSync(thumbPath)) {
    // 1. If YouTube, try downloading official YouTube high-res thumbnail first
    const youtubeId = extractYouTubeId(project.sourcePath);
    if (youtubeId) {
      try {
        let ytRes = await fetch(`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`);
        if (!ytRes.ok) {
          ytRes = await fetch(`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`);
        }
        if (ytRes.ok) {
          fs.mkdirSync(cacheDir, { recursive: true });
          const arrayBuf = await ytRes.arrayBuffer();
          fs.writeFileSync(thumbPath, Buffer.from(arrayBuf));
        }
      } catch (err) {
        console.error("Failed to fetch YouTube thumbnail:", err);
      }
    }

    // 2. Fallback to video frame capture if not downloaded
    if (!fs.existsSync(thumbPath)) {
      const videoPath = project.normalizedPath || project.sourcePath;
      if (fs.existsSync(videoPath)) {
        const res = await extractFrameImage(videoPath, thumbPath, 1.0);
        if (!res.success) return c.text("Failed to extract thumbnail", 500);
      } else {
        return c.text("Thumbnail not found", 404);
      }
    }
  }

  const stat = fs.statSync(thumbPath);
  const file = typeof Bun !== "undefined"
    ? Bun.file(thumbPath)
    : (fs.createReadStream(thumbPath) as any);

  return new Response(file as any, {
    status: 200,
    headers: {
      "Content-Length": stat.size.toString(),
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
});



// Thumbnail capture at specific second
app.post("/api/xclips/media/:id/thumbnail/capture", async (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.json({ ok: false, message: "Project not found" }, 404);

  try {
    const body = await c.req.json();
    const timeSec = typeof body?.timeSec === "number" ? body.timeSec : 1.0;
    const videoPath = project.normalizedPath || project.sourcePath;
    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
    const thumbPath = path.join(cacheDir, "thumbnail.jpg");

    const res = await extractFrameImage(videoPath, thumbPath, timeSec);
    if (res.success) {
      return c.json({ ok: true, message: "Thumbnail captured successfully", timeSec });
    }
    return c.json({ ok: false, message: res.error }, 500);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error capturing thumbnail";
    return c.json({ ok: false, message: msg }, 500);
  }
});

// Universal Download Asset Route
app.get("/api/xclips/media/:id/download", async (c) => {
  const id = c.req.param("id");
  const type = c.req.query("type") || "video";
  const project = xclipsDb.getProject(id);
  if (!project) return c.text("Project not found", 404);

  if (type === "srt") {
    const transcript = xclipsDb.getTranscript(id);
    const srtContent = transcript?.srtContent || "";
    const filename = `${project.name.replace(/[^\w\s-]/gi, "").trim() || "subtitles"}.srt`;
    return new Response(srtContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (type === "audio") {
    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
    let audioPath = project.audioPath || path.join(cacheDir, "audio_16k.wav");
    if (!fs.existsSync(audioPath)) {
      const videoPath = project.normalizedPath || project.sourcePath;
      if (fs.existsSync(videoPath)) {
        await extractAudioWav(videoPath, audioPath);
      }
    }
    if (fs.existsSync(audioPath)) {
      const stat = fs.statSync(audioPath);
      const filename = `${project.name.replace(/[^\w\s-]/gi, "").trim() || "audio"}.wav`;
      const file = typeof Bun !== "undefined" ? Bun.file(audioPath) : (fs.createReadStream(audioPath) as any);
      return new Response(file as any, {
        status: 200,
        headers: {
          "Content-Length": stat.size.toString(),
          "Content-Type": "audio/wav",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  if (type === "thumbnail") {
    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", id);
    const thumbPath = path.join(cacheDir, "thumbnail.jpg");
    if (!fs.existsSync(thumbPath)) {
      const videoPath = project.normalizedPath || project.sourcePath;
      if (fs.existsSync(videoPath)) {
        await extractFrameImage(videoPath, thumbPath, 1.0);
      }
    }
    if (fs.existsSync(thumbPath)) {
      const stat = fs.statSync(thumbPath);
      const filename = `${project.name.replace(/[^\w\s-]/gi, "").trim() || "thumbnail"}.jpg`;
      const file = typeof Bun !== "undefined" ? Bun.file(thumbPath) : (fs.createReadStream(thumbPath) as any);
      return new Response(file as any, {
        status: 200,
        headers: {
          "Content-Length": stat.size.toString(),
          "Content-Type": "image/jpeg",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  // Default: Video
  const videoPath = project.normalizedPath || project.sourcePath;
  if (fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    const filename = `${project.name.replace(/[^\w\s-]/gi, "").trim() || "video"}.mp4`;
    const file = typeof Bun !== "undefined" ? Bun.file(videoPath) : (fs.createReadStream(videoPath) as any);
    return new Response(file as any, {
      status: 200,
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return c.text("File not found", 404);
});

app.get("/api/xclips/projects/:id", (c) => {
  const id = c.req.param("id");
  const project = xclipsDb.getProject(id);
  if (!project) return c.json({ ok: false, message: "Project not found" }, 404);

  const transcript = xclipsDb.getTranscript(id);
  const clips = xclipsDb.getClips(id);

  return c.json({ ok: true, project, transcript, clips });
});

app.put("/api/xclips/projects/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = xclipsDb.getProject(id);
    if (!existing) return c.json({ ok: false, message: "Project not found" }, 404);

    const body = await c.req.json();
    const updatedProject: XclipsProject = {
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    xclipsDb.saveProject(updatedProject);
    return c.json({ ok: true, project: updatedProject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return c.json({ ok: false, message }, 500);
  }
});

app.delete("/api/xclips/projects/:id", (c) => {
  const id = c.req.param("id");
  const deleted = xclipsDb.deleteProject(id);
  return c.json({ ok: deleted });
});



// --- xclips AI Settings & Models Routes ---
app.get("/api/xclips/settings", (c) => {
  const settings = xclipsService.getAiSettings();
  return c.json({ ok: true, settings });
});

app.post("/api/xclips/settings", async (c) => {
  try {
    const body = await c.req.json();
    const res = xclipsService.saveAiSettings(body);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }
    return c.json({ ok: true, settings: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save configuration";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/ai/models", async (c) => {
  try {
    const body = await c.req.json();
    const { provider, baseUrl, apiKey } = body;
    const res = await xclipsService.fetchAvailableModels(provider, baseUrl, apiKey);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }
    return c.json({ ok: true, models: res.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch models list";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/settings/test-key", async (c) => {
  try {
    const body = await c.req.json();
    const { provider, baseUrl, apiKey, model } = body;
    const res = await xclipsService.validateApiKey(provider, baseUrl, apiKey, model);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }
    return c.json({ ok: true, message: res.data.message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to validate API Key";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/ai/validate", async (c) => {
  try {
    const body = await c.req.json();
    const { provider, baseUrl, apiKey, model } = body;
    const res = await xclipsService.validateApiKey(provider, baseUrl, apiKey, model);
    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }
    return c.json({ ok: true, data: res.data, message: res.data.message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to validate API Key";
    return c.json({ ok: false, message }, 500);
  }
});

// AI-Powered Topic Detection using Requesty Light Model Helper
app.post("/api/xclips/ai/detect-topic", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { projectId, title, transcriptText, lightModel, outputLanguage } = body as {
      projectId?: string;
      title?: string;
      transcriptText?: string;
      lightModel?: string;
      outputLanguage?: string;
    };

    const res = await xclipsService.detectNarrativeTopic({
      projectId,
      title,
      transcriptText,
      lightModel,
      outputLanguage,
    });

    if (!res.success) {
      return c.json({ ok: false, message: res.error }, 400);
    }
    return c.json({ ok: true, data: res.data, topicPrompt: res.data.topicPrompt, model: res.data.modelUsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to detect topic";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/projects/:id/transcribe", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { apiKey, model, label, provider } = body as { apiKey?: string; model?: string; label?: string; provider?: AiProviderType };

  const res = await xclipsService.transcribeProject(id, { apiKey, model, label, provider });
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, transcript: res.data });
});

app.post("/api/xclips/projects/:id/subtitles/youtube", async (c) => {
  const id = c.req.param("id");
  const res = await xclipsService.fetchYouTubeSubtitles(id);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, transcript: res.data });
});

app.get("/api/xclips/projects/:id/subtitles", (c) => {
  const id = c.req.param("id");
  const res = xclipsService.getProjectSubtitles(id);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, subtitles: res.data });
});

app.post("/api/xclips/projects/:id/subtitles/switch", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { transcriptId } = body as { transcriptId: string };
  if (!transcriptId) return c.json({ ok: false, message: "transcriptId is required" }, 400);

  const res = xclipsService.switchActiveSubtitle(id, transcriptId);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, transcript: res.data });
});

app.delete("/api/xclips/projects/:id/subtitles/:trackId", (c) => {
  const id = c.req.param("id");
  const trackId = c.req.param("trackId");
  const res = xclipsService.deleteProjectSubtitle(id, trackId);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, remaining: res.data.remaining, active: res.data.active });
});

app.put("/api/xclips/projects/:id/transcript", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { words, transcriptId } = body as { words?: any[]; transcriptId?: string };
  if (!words || !Array.isArray(words)) {
    return c.json({ ok: false, message: "Invalid transcript words array" }, 400);
  }

  const res = xclipsService.saveTranscriptWords(id, words, transcriptId);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, transcript: res.data });
});

app.post("/api/xclips/projects/:id/discover", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const res = await xclipsService.discoverHighlights(id, body);
  if (!res.success) {
    return c.json({ ok: false, message: res.error }, 400);
  }
  return c.json({ ok: true, clips: res.data });
});

app.post("/api/xclips/clips", async (c) => {
  try {
    const clip = await c.req.json();
    if (!clip.id || !clip.projectId) {
      return c.json({ ok: false, message: "Invalid clip object" }, 400);
    }
    xclipsDb.saveClip(clip);
    return c.json({ ok: true, clip });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save clip";
    return c.json({ ok: false, message }, 500);
  }
});

app.put("/api/xclips/clips/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const clip = await c.req.json();
    if (!clip || !clip.id || clip.id !== id) {
      return c.json({ ok: false, message: "Invalid clip payload" }, 400);
    }
    xclipsDb.saveClip(clip);
    return c.json({ ok: true, clip });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update clip";
    return c.json({ ok: false, message }, 500);
  }
});

app.delete("/api/xclips/clips/:id", (c) => {
  const id = c.req.param("id");
  const deleted = xclipsDb.deleteClip(id);
  return c.json({ ok: deleted });
});

app.delete("/api/xclips/projects/:id/clips", (c) => {
  const id = c.req.param("id");
  const deleted = xclipsDb.deleteAllClips(id);
  return c.json({ ok: deleted });
});

app.post("/api/xclips/clips/:id/render", async (c) => {
  const id = c.req.param("id");
  const clip = xclipsDb.getClip(id);
  if (!clip) return c.json({ ok: false, message: "Clip not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as {
    resolution?: string;
    bitrate?: string;
    format?: string;
  };

  const job = xclipsService.enqueueRender(clip.id, clip.projectId, body);
  return c.json({ ok: true, job });
});

app.get("/api/xclips/jobs/:id", (c) => {
  const id = c.req.param("id");
  const job = xclipsDb.getJob(id);
  if (!job) return c.json({ ok: false, message: "Job not found" }, 404);
  return c.json({ ok: true, job });
});

// ── Storage Management Endpoints ──────────────────────────────

app.get("/api/xclips/storage/stats", (c) => {
  try {
    const stats = xclipsService.getStorageStats();
    const projectStorage = xclipsService.getProjectStorageMap();
    return c.json({ ok: true, stats, projectStorage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch storage stats";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/storage/clean-cache", (c) => {
  try {
    const result = xclipsService.cleanAllCache();
    return c.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clean cache";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/storage/clean-downloads", (c) => {
  try {
    const result = xclipsService.cleanAllDownloads();
    return c.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clean downloads";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/storage/clean-orphans", (c) => {
  try {
    const result = xclipsService.cleanOrphanedFiles();
    return c.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clean orphaned files";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/storage/compact-db", (c) => {
  try {
    const result = xclipsService.compactDatabase();
    return c.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compact database";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/storage/clean-project/:id", (c) => {
  const id = c.req.param("id");
  try {
    const result = xclipsService.cleanProjectStorage(id);
    return c.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clean project storage";
    return c.json({ ok: false, message }, 500);
  }
});

app.get("/api/xclips/projects/:id/export", (c) => {
  const id = c.req.param("id");
  try {
    const result = xclipsService.exportProjectBundle(id);
    if (!result.success) {
      return c.json({ ok: false, message: result.error }, 404);
    }
    return c.json({ ok: true, bundle: result.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to export project";
    return c.json({ ok: false, message }, 500);
  }
});

app.post("/api/xclips/projects/import", async (c) => {
  try {
    const body = await c.req.json();
    const bundle = body.bundle || body;
    if (!bundle.project || !bundle.project.name) {
      return c.json({ ok: false, message: "Invalid project bundle format" }, 400);
    }
    const result = xclipsService.importProjectBundle(bundle);
    if (!result.success) {
      return c.json({ ok: false, message: result.error }, 500);
    }
    return c.json({ ok: true, projectId: result.data.projectId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import project";
    return c.json({ ok: false, message }, 500);
  }
});

// Start Server
const port = env.PORT_API;
console.log(`[Hono API] Starting on http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port,
});
