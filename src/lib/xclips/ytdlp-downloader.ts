import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Result, WordTimestamp, TimeRange } from "@/lib/xclips/types";
import { generateSrtFromWords } from "@/lib/xclips/phrase-segmentation";
import { ytdlpLogger } from "@/lib/logger";

// Active ChildProcess registry for cancellation
const activeProcessMap = new Map<string, ChildProcess>();

export function registerActiveProcess(taskId: string, proc: ChildProcess) {
  activeProcessMap.set(taskId, proc);
}

export function unregisterActiveProcess(taskId: string) {
  activeProcessMap.delete(taskId);
}

export function cancelActiveProcess(taskId: string): boolean {
  const proc = activeProcessMap.get(taskId);
  if (proc) {
    try {
      proc.kill();
    } catch {
      // ignore
    }
    activeProcessMap.delete(taskId);
    return true;
  }
  return false;
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader: string;
  channel: string;
  description: string;
  webpageUrl: string;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  totalSizeStr?: string;
  speedStr: string;
  etaStr: string;
  status: "downloading" | "merging" | "transcribing" | "completed" | "error";
}

export interface YouTubeDownloadOptions {
  url: string;
  outputDir: string;
  quality?: "best" | "4k" | "2160p" | "1440p" | "2k" | "1080p" | "720p" | "480p";
  downloadSubtitles?: boolean;
  timeRange?: TimeRange;
}

export interface YouTubeDownloadResult {
  videoPath: string;
  srtPath?: string;
  info: YouTubeVideoInfo;
}

/**
 * Parses time string (HH:MM:SS, MM:SS, or seconds) to seconds number
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const clean = timeStr.trim();
  const parts = clean.split(":").map((p) => parseFloat(p));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0] || 0;
  }
  return 0;
}

/**
 * Formats seconds to HH:MM:SS string
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Sanitizes time string for safe inclusion in filenames (e.g. 00:01:30 -> 00-01-30)
 */
export function sanitizeTimeForFilename(timeStr: string): string {
  return (timeStr || "").replace(/[:\s]+/g, "-");
}

/**
 * Slices an array of WordTimestamp to fit within [startSec, endSec]
 * and re-bases timestamps so the new segment starts at 0.00s.
 */
export function sliceWordsByTimeRange(
  words: WordTimestamp[],
  startSec: number,
  endSec: number
): WordTimestamp[] {
  if (!Array.isArray(words) || words.length === 0) return [];
  if (endSec <= startSec) return [];

  const sliced: WordTimestamp[] = [];
  for (const w of words) {
    // Word overlaps with [startSec, endSec]
    if (w.end > startSec && w.start < endSec) {
      const newStart = Math.max(0, parseFloat((w.start - startSec).toFixed(2)));
      const newEnd = Math.max(newStart + 0.05, parseFloat((w.end - startSec).toFixed(2)));
      sliced.push({
        ...w,
        start: newStart,
        end: newEnd,
      });
    }
  }
  return sliced;
}


/**
 * Finds the yt-dlp binary on the system
 */
export function findYtDlpBinary(): string {
  const customCandidates = [
    "yt-dlp",
    "yt-dlp.exe",
    "C:\\Users\\precore\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\yt-dlp.exe",
    "C:\\Users\\precore\\AppData\\Local\\Programs\\Python\\Python314\\Scripts\\yt-dlp.exe",
    "C:\\Users\\precore\\AppData\\Local\\Programs\\Python\\Python313\\Scripts\\yt-dlp.exe",
    "C:\\Users\\precore\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe",
    "C:\\Program Files\\yt-dlp\\yt-dlp.exe",
  ];

  for (const candidate of customCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "yt-dlp";
}

/**
 * Finds the ffmpeg binary on the system for yt-dlp stream muxing
 */
export function findFfmpegBinary(): string | undefined {
  const customCandidates = [
    "C:\\Users\\precore\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe",
    "ffmpeg.exe",
    "ffmpeg",
    "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
  ];

  for (const candidate of customCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Resolves format selector and format sort arguments for target download quality.
 * Accurately supports both landscape (16:9) and portrait/vertical (9:16 Shorts) videos.
 */
export function getQualitySelectorArgs(
  quality?: "best" | "4k" | "2160p" | "1440p" | "2k" | "1080p" | "720p" | "480p"
): { formatSelector: string; formatSort: string } {
  if (quality === "4k" || quality === "2160p") {
    return {
      formatSelector:
        "bv*[height<=2160][width<=3840]+ba/bv*[width<=2160][height<=3840]+ba/bv*[height<=2160]+ba/bv*[width<=2160]+ba/bv*+ba/b",
      formatSort: "res:2160,fps,vcodec:h264,acodec:m4a",
    };
  } else if (quality === "1440p" || quality === "2k") {
    return {
      formatSelector:
        "bv*[height<=1440][width<=2560]+ba/bv*[width<=1440][height<=2560]+ba/bv*[height<=1440]+ba/bv*[width<=1440]+ba/bv*+ba/b",
      formatSort: "res:1440,fps,vcodec:h264,acodec:m4a",
    };
  } else if (quality === "1080p") {
    return {
      formatSelector:
        "bv*[height<=1080][width<=1920]+ba/bv*[width<=1080][height<=1920]+ba/bv*[height<=1080]+ba/bv*[width<=1080]+ba/bv*+ba/b",
      formatSort: "res:1080,fps,vcodec:h264,acodec:m4a",
    };
  } else if (quality === "720p") {
    return {
      formatSelector:
        "bv*[height<=720][width<=1280]+ba/bv*[width<=720][height<=1280]+ba/bv*[height<=720]+ba/bv*[width<=720]+ba/bv*+ba/b",
      formatSort: "res:720,fps,vcodec:h264,acodec:m4a",
    };
  } else if (quality === "480p") {
    return {
      formatSelector:
        "bv*[height<=480][width<=854]+ba/bv*[width<=480][height<=854]+ba/bv*[height<=480]+ba/bv*[width<=480]+ba/bv*+ba/b",
      formatSort: "res:480,fps,vcodec:h264,acodec:m4a",
    };
  } else {
    // "best"
    return {
      formatSelector: "bv*+ba/b",
      formatSort: "res,fps,vcodec:h264,acodec:m4a",
    };
  }
}

/**
 * Checks if a given string is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]{11}/i;
  return ytRegex.test(url.trim());
}

/**
 * Checks if a given string is a valid TikTok URL
 */
export function isTikTokUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return /(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(url.trim());
}

/**
 * Checks if a given string is a valid Instagram URL
 */
export function isInstagramUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return /(instagram\.com|instagr\.am)/i.test(url.trim());
}

/**
 * Checks if a given string is a valid supported media URL (YouTube, TikTok, Instagram, or any HTTP video)
 */
export function isValidMediaUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (isValidYouTubeUrl(trimmed) || isTikTokUrl(trimmed) || isInstagramUrl(trimmed)) {
    return true;
  }
  return /^https?:\/\/.+/i.test(trimmed);
}

/**
 * Fetches quick metadata for a TikTok video using TikWM API (fallback to yt-dlp)
 */
export async function fetchTikTokInfo(url: string): Promise<Result<YouTubeVideoInfo>> {
  try {
    const cleanUrl = url.split("?")[0].trim();
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: {
        id?: string;
        title?: string;
        duration?: number;
        cover?: string;
        origin_cover?: string;
        author?: { nickname?: string; unique_id?: string };
        play?: string;
      };
    };

    if (json.code === 0 && json.data) {
      const d = json.data;
      const info: YouTubeVideoInfo = {
        id: d.id || `${Date.now()}`,
        title: d.title || "TikTok Video",
        duration: Number(d.duration) || 0,
        thumbnail: d.cover || d.origin_cover || "",
        uploader: d.author?.nickname || d.author?.unique_id || "TikTok Creator",
        channel: d.author?.unique_id || d.author?.nickname || "TikTok Creator",
        description: d.title || "",
        webpageUrl: url.trim(),
      };
      ytdlpLogger.info({ id: info.id, title: info.title }, "TikTok metadata fetched via TikWM API");
      return { success: true, data: info };
    }
  } catch (err: unknown) {
    ytdlpLogger.warn({ err: err instanceof Error ? err.message : String(err) }, "TikWM fetch failed, falling back to yt-dlp");
  }

  return fetchGenericYtDlpInfo(url);
}

/**
 * Fetches quick metadata for any generic media URL via yt-dlp
 */
export async function fetchGenericYtDlpInfo(url: string): Promise<Result<YouTubeVideoInfo>> {
  const ytdlp = findYtDlpBinary();
  ytdlpLogger.debug({ url, ytdlp }, "Spawning yt-dlp to fetch generic video metadata");

  return new Promise((resolve) => {
    const args = [
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--js-runtimes",
      "node",
      "--remote-components",
      "ejs:github",
      "--ignore-errors",
      url.trim(),
    ];
    let stdoutData = "";
    let stderrData = "";

    const proc = spawn(ytdlp, args, { windowsHide: true });
    const timeout = setTimeout(() => {
      proc.kill();
      ytdlpLogger.error({ url }, "Timeout fetching video metadata (60s)");
      resolve({ success: false, error: "Timeout saat mengambil metadata video (60s)" });
    }, 60000);

    proc.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdoutData.trim()) {
        ytdlpLogger.error({ url, code, stderr: stderrData.slice(0, 500) }, "yt-dlp failed to fetch metadata");
        return resolve({
          success: false,
          error: `Gagal membaca info video: ${stderrData.slice(0, 300) || "Unknown error"}`,
        });
      }

      try {
        const json = JSON.parse(stdoutData);
        const info: YouTubeVideoInfo = {
          id: json.id || "",
          title: json.title || "Untitled Video",
          duration: Number(json.duration) || 0,
          thumbnail: json.thumbnail || (json.thumbnails && json.thumbnails[0]?.url) || "",
          uploader: json.uploader || json.channel || "Unknown Creator",
          channel: json.channel || json.uploader || "Unknown Creator",
          description: (json.description || "").slice(0, 300),
          webpageUrl: json.webpage_url || url,
        };
        ytdlpLogger.info({ id: info.id, title: info.title, duration: info.duration, channel: info.channel }, "Video metadata fetched successfully via yt-dlp");
        resolve({ success: true, data: info });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "JSON parse error";
        ytdlpLogger.error({ url, err: msg }, "Failed to parse yt-dlp JSON output");
        resolve({ success: false, error: `Gagal mem-parsing metadata video: ${msg}` });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      ytdlpLogger.error({ url, err: err.message, ytdlp }, "Error spawning yt-dlp process");
      resolve({
        success: false,
        error: `Gagal menjalankan yt-dlp (${ytdlp}): ${err.message}. Pastikan yt-dlp terinstall.`,
      });
    });
  });
}

/**
 * Fetches quick metadata for a YouTube/TikTok/Instagram video without downloading media
 */
export async function fetchYouTubeInfo(url: string): Promise<Result<YouTubeVideoInfo>> {
  if (!isValidMediaUrl(url)) {
    ytdlpLogger.warn({ url }, "Invalid media URL provided to fetchYouTubeInfo");
    return { success: false, error: "URL media tidak valid" };
  }

  // Handle TikTok separately with fast TikWM API
  if (isTikTokUrl(url)) {
    return fetchTikTokInfo(url);
  }

  // If not YouTube, use generic yt-dlp extractor
  if (!isValidYouTubeUrl(url)) {
    return fetchGenericYtDlpInfo(url);
  }

  const ytdlp = findYtDlpBinary();
  ytdlpLogger.debug({ url, ytdlp }, "Spawning yt-dlp to fetch YouTube video metadata");

  return new Promise((resolve) => {
    const args = [
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--js-runtimes",
      "node",
      "--remote-components",
      "ejs:github",
      "--ignore-errors",
      url.trim(),
    ];
    let stdoutData = "";
    let stderrData = "";

    const proc = spawn(ytdlp, args, {
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      proc.kill();
      ytdlpLogger.error({ url }, "Timeout fetching YouTube metadata (60s)");
      resolve({ success: false, error: "Timeout saat mengambil metadata YouTube (60s)" });
    }, 60000);

    proc.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdoutData.trim()) {
        ytdlpLogger.error({ url, code, stderr: stderrData.slice(0, 500) }, "yt-dlp failed to fetch metadata");
        return resolve({
          success: false,
          error: `Gagal membaca info video: ${stderrData.slice(0, 300) || "Unknown error"}`,
        });
      }

      try {
        const json = JSON.parse(stdoutData);
        const info: YouTubeVideoInfo = {
          id: json.id || "",
          title: json.title || "Untitled Video",
          duration: Number(json.duration) || 0,
          thumbnail: json.thumbnail || (json.thumbnails && json.thumbnails[0]?.url) || "",
          uploader: json.uploader || json.channel || "Unknown Creator",
          channel: json.channel || json.uploader || "Unknown Creator",
          description: (json.description || "").slice(0, 300),
          webpageUrl: json.webpage_url || url,
        };
        ytdlpLogger.info({ id: info.id, title: info.title, duration: info.duration, channel: info.channel }, "YouTube metadata fetched successfully");
        resolve({ success: true, data: info });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "JSON parse error";
        ytdlpLogger.error({ url, err: msg }, "Failed to parse yt-dlp JSON output");
        resolve({ success: false, error: `Gagal mem-parsing metadata video: ${msg}` });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      ytdlpLogger.error({ url, err: err.message, ytdlp }, "Error spawning yt-dlp process");
      resolve({
        success: false,
        error: `Gagal menjalankan yt-dlp (${ytdlp}): ${err.message}. Pastikan yt-dlp terinstall.`,
      });
    });
  });
}


/**
 * Parses raw stdout lines from yt-dlp to extract download progress
 */
export function parseYtDlpProgressLine(line: string): Partial<DownloadProgress> | null {
  // Typical yt-dlp line:
  // [download]  45.2% of ~ 120.50MiB at 4.25MiB/s ETA 00:15
  // [download]  100% of 15.20MiB in 00:03
  // [Merger] Merging formats into "..."
  if (line.includes("[download]")) {
    const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
    const sizeMatch = line.match(/of\s+(~?\s*[\d.]+\s*(?:KiB|MiB|GiB|TiB|B|KB|MB|GB|TB))/i);
    const speedMatch = line.match(/at\s+([\d.]+\s*\w+\/s)/i);
    const etaMatch = line.match(/ETA\s+([\d:]+)/i);

    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      return {
        percent,
        totalSizeStr: sizeMatch ? sizeMatch[1].trim() : "",
        speedStr: speedMatch ? speedMatch[1].trim() : "",
        etaStr: etaMatch ? etaMatch[1].trim() : "",
        status: percent >= 100 ? "merging" : "downloading",
      };
    }
  }

  if (line.includes("[Merger]") || line.includes("Merging formats")) {
    return {
      percent: 99,
      status: "merging",
    };
  }

  return null;
}

/**
 * Direct TikTok video downloader without watermark via TikWM API (fallback to yt-dlp)
 */
export async function downloadTikTokVideo(
  options: YouTubeDownloadOptions,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Result<YouTubeDownloadResult>> {
  const { url, outputDir } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    const cleanUrl = url.split("?")[0].trim();
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as {
      code?: number;
      data?: {
        id?: string;
        title?: string;
        duration?: number;
        cover?: string;
        origin_cover?: string;
        author?: { nickname?: string; unique_id?: string };
        play?: string;
      };
    };

    if (json.code === 0 && json.data?.play) {
      const d = json.data;
      const id = d.id || `${Date.now()}`;
      const title = (d.title || "TikTok Video").replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
      const videoFilename = `[FULL] ${title} [${id}].mp4`;
      const videoPath = path.join(outputDir, videoFilename);

      const info: YouTubeVideoInfo = {
        id,
        title: d.title || "TikTok Video",
        duration: Number(d.duration) || 0,
        thumbnail: d.cover || d.origin_cover || "",
        uploader: d.author?.nickname || d.author?.unique_id || "TikTok Creator",
        channel: d.author?.unique_id || "TikTok Creator",
        description: d.title || "",
        webpageUrl: url.trim(),
      };

      let playUrl = d.play || "";
      if (!playUrl) {
        throw new Error("No playable TikTok video stream URL found in metadata");
      }
      if (playUrl.startsWith("//")) playUrl = `https:${playUrl}`;
      else if (playUrl.startsWith("/")) playUrl = `https://www.tikwm.com${playUrl}`;

      const vidRes = await fetch(playUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(120000),
      });

      if (!vidRes.ok || !vidRes.body) {
        throw new Error(`Failed to stream TikTok video (HTTP ${vidRes.status})`);
      }

      const totalBytes = Number(vidRes.headers.get("content-length")) || 0;
      let downloadedBytes = 0;
      const reader = vidRes.body.getReader();
      const chunks: Uint8Array[] = [];
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          downloadedBytes += value.length;
          if (onProgress && totalBytes > 0) {
            const percent = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
            const elapsedSec = (Date.now() - startTime) / 1000;
            const speedBytesPerSec = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
            const speedMb = (speedBytesPerSec / (1024 * 1024)).toFixed(1);
            const remainingBytes = totalBytes - downloadedBytes;
            const etaSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
            onProgress({
              percent,
              downloadedBytes,
              totalBytes,
              totalSizeStr: totalBytes > 0 ? `${totalMb} MiB` : "",
              speedStr: `${speedMb} MB/s`,
              etaStr: `${Math.floor(etaSec / 60)}:${(etaSec % 60).toString().padStart(2, "0")}`,
              status: "downloading",
            });
          }
        }
      }

      fs.writeFileSync(videoPath, Buffer.concat(chunks));

      // Download thumbnail if available
      if (info.thumbnail) {
        try {
          const thumbRes = await fetch(info.thumbnail, { signal: AbortSignal.timeout(10000) });
          if (thumbRes.ok && thumbRes.body) {
            const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
            fs.writeFileSync(path.join(outputDir, "thumbnail.jpg"), thumbBuffer);
          }
        } catch {
          // non-fatal
        }
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          downloadedBytes,
          totalBytes,
          speedStr: "",
          etaStr: "",
          status: "completed",
        });
      }

      ytdlpLogger.info({ url, videoPath }, "TikTok video downloaded successfully via direct stream");
      return {
        success: true,
        data: {
          videoPath,
          info,
        },
      };
    }
  } catch (err: unknown) {
    ytdlpLogger.warn({ err: err instanceof Error ? err.message : String(err) }, "TikWM direct stream failed, falling back to yt-dlp");
  }

  return downloadGenericYtDlpVideo(options, onProgress);
}

/**
 * Generic media video downloader using yt-dlp (works for Instagram and other platforms)
 */
export async function downloadGenericYtDlpVideo(
  options: YouTubeDownloadOptions,
  onProgress?: (progress: DownloadProgress) => void,
  onProcSpawn?: (proc: ChildProcess) => void
): Promise<Result<YouTubeDownloadResult>> {
  const { url, outputDir, quality = "1080p" } = options;
  fs.mkdirSync(outputDir, { recursive: true });
  const ytdlp = findYtDlpBinary();

  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }
  const info = infoRes.data;

  const { formatSelector, formatSort } = getQualitySelectorArgs(quality);
  const ffmpeg = findFfmpegBinary();

  const outputTemplate = path.join(outputDir, "[FULL] %(title)s [%(id)s].%(ext)s");
  const args = [
    "-i",
    "--no-warnings",
    "--ignore-errors",
    "-f",
    formatSelector,
    "--format-sort",
    formatSort,
    "--merge-output-format",
    "mp4",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "-o",
    outputTemplate,
  ];

  if (ffmpeg) {
    args.push("--ffmpeg-location", ffmpeg);
  }

  args.push(url.trim());

  ytdlpLogger.info({ url, outputDir, quality }, "Starting generic media video download with yt-dlp");

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, { windowsHide: true });
    if (onProcSpawn) onProcSpawn(proc);
    let stderrData = "";

    proc.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseYtDlpProgressLine(line);
        if (parsed && onProgress) {
          onProgress({
            percent: parsed.percent ?? 0,
            downloadedBytes: 0,
            totalBytes: 0,
            totalSizeStr: parsed.totalSizeStr ?? "",
            speedStr: parsed.speedStr ?? "",
            etaStr: parsed.etaStr ?? "",
            status: parsed.status || "downloading",
          });
        }
      }
    });

    proc.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        ytdlpLogger.error({ url, code, stderr: stderrData.slice(0, 1000) }, "Media video download failed");
        return resolve({
          success: false,
          error: `Download media gagal (code ${code}): ${stderrData.slice(0, 300) || "Unknown error"}`,
        });
      }

      const files = fs.readdirSync(outputDir);
      const mp4File = files.find((f) => f.endsWith(".mp4") && (f.includes(info.id) || f.startsWith("[FULL]")));
      const anyMp4 = mp4File || files.find((f) => f.endsWith(".mp4"));

      if (!anyMp4) {
        return resolve({ success: false, error: "File video tidak ditemukan setelah download selesai." });
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "completed",
        });
      }

      ytdlpLogger.info({ url, videoPath: anyMp4 }, "Media video download completed successfully");
      resolve({
        success: true,
        data: {
          videoPath: path.join(outputDir, anyMp4),
          info,
        },
      });
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: `Gagal menjalankan yt-dlp: ${err.message}` });
    });
  });
}

/**
 * Downloads a video from YouTube, TikTok, or Instagram with live progress feedback
 */
export async function downloadYouTubeVideo(
  options: YouTubeDownloadOptions,
  onProgress?: (progress: DownloadProgress) => void,
  onProcSpawn?: (proc: ChildProcess) => void
): Promise<Result<YouTubeDownloadResult>> {
  const { url, outputDir, quality = "1080p", downloadSubtitles = true } = options;

  if (!isValidMediaUrl(url)) {
    return { success: false, error: "URL media tidak valid" };
  }

  // If TikTok, use optimized direct TikTok downloader
  if (isTikTokUrl(url)) {
    return downloadTikTokVideo(options, onProgress);
  }

  // If Instagram or generic, use generic downloader
  if (!isValidYouTubeUrl(url)) {
    return downloadGenericYtDlpVideo(options, onProgress, onProcSpawn);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const ytdlp = findYtDlpBinary();

  // 1. Fetch info first
  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }

  const info = infoRes.data;

  // 2. Select format string & format sort with dual-axis dimension bounds
  const { formatSelector, formatSort } = getQualitySelectorArgs(quality);
  const ffmpeg = findFfmpegBinary();

  // Check timeRange option for direct splitting
  const startSec = options.timeRange?.start ? parseTimeToSeconds(options.timeRange.start) : 0;
  const endSec = options.timeRange?.end ? parseTimeToSeconds(options.timeRange.end) : 0;
  const hasTimeRange = Boolean(options.timeRange && endSec > startSec);

  const startFormatted = formatSecondsToTime(startSec);
  const endFormatted = formatSecondsToTime(endSec);
  const startSafe = sanitizeTimeForFilename(startFormatted);
  const endSafe = sanitizeTimeForFilename(endFormatted);

  const outputTemplate = hasTimeRange
    ? path.join(outputDir, `[SPLIT_${startSafe}_${endSafe}] %(title)s [%(id)s].%(ext)s`)
    : path.join(outputDir, "[FULL] %(title)s [%(id)s].%(ext)s");

  const args = [
    "-i",
    "--no-warnings",
    "--ignore-errors",
    "-f",
    formatSelector,
    "--format-sort",
    formatSort,
    "--merge-output-format",
    "mp4",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "-o",
    outputTemplate,
  ];

  if (hasTimeRange) {
    args.push(
      "--download-sections",
      `*${startFormatted}-${endFormatted}`,
      "--force-keyframes-at-cuts"
    );
  }

  if (ffmpeg) {
    args.push("--ffmpeg-location", ffmpeg);
  }

  if (downloadSubtitles) {
    args.push(
      "--write-subs",
      "--write-auto-subs",
      "--sub-lang",
      "id,id-orig,en,en-orig",
      "--sub-format",
      "srt"
    );
  }

  args.push(url.trim());

  ytdlpLogger.info(
    { url, outputDir, quality, downloadSubtitles, formatSelector, hasTimeRange, timeRange: options.timeRange },
    "Starting YouTube video download with yt-dlp"
  );

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, {
      windowsHide: true,
    });
    if (onProcSpawn) onProcSpawn(proc);

    let stderrData = "";

    proc.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseYtDlpProgressLine(line);
        if (parsed && onProgress) {
          onProgress({
            percent: parsed.percent ?? 0,
            downloadedBytes: 0,
            totalBytes: 0,
            totalSizeStr: parsed.totalSizeStr ?? "",
            speedStr: parsed.speedStr ?? "",
            etaStr: parsed.etaStr ?? "",
            status: parsed.status || "downloading",
          });
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        ytdlpLogger.error({ url, code, stderr: stderrData.slice(0, 1000) }, "YouTube video download failed");
        return resolve({
          success: false,
          error: `Download YouTube gagal (code ${code}): ${stderrData.slice(0, 300) || "Unknown error"}`,
        });
      }

      // Find the downloaded MP4 and SRT files
      const files = fs.readdirSync(outputDir);
      const mp4File = files.find(
        (f) => f.endsWith(".mp4") && (f.includes(info.id) || f.startsWith("[SPLIT_") || f.startsWith("[FULL]"))
      );
      const srtFile = files.find(
        (f) => f.endsWith(".srt") && (f.includes(info.id) || f.startsWith("[SPLIT_") || f.startsWith("[FULL]"))
      );

      if (!mp4File) {
        // Fallback: search for any mp4 in outputDir
        const anyMp4 = files.find((f) => f.endsWith(".mp4"));
        if (!anyMp4) {
          ytdlpLogger.error({ url, outputDir, files }, "No MP4 video file found in output directory after download");
          return resolve({ success: false, error: "File video tidak ditemukan setelah download selesai." });
        }
        ytdlpLogger.info({ url, videoPath: anyMp4, srtPath: srtFile }, "YouTube video download finished (fallback file matched)");
        
        const finalInfo: YouTubeVideoInfo = hasTimeRange
          ? { ...info, duration: Math.max(1, Math.round(endSec - startSec)) }
          : info;

        return resolve({
          success: true,
          data: {
            videoPath: path.join(outputDir, anyMp4),
            srtPath: srtFile ? path.join(outputDir, srtFile) : undefined,
            info: finalInfo,
          },
        });
      }

      // If timeRange was applied and we downloaded subtitles, slice and re-base the SRT file
      if (srtFile && hasTimeRange) {
        try {
          const srtFullPath = path.join(outputDir, srtFile);
          const rawSrt = fs.readFileSync(srtFullPath, "utf-8");
          const origWords = parseSrtToWords(rawSrt);
          if (origWords.length > 0) {
            const sliced = sliceWordsByTimeRange(origWords, startSec, endSec);
            const newSrt = generateSrtFromWords(sliced);
            fs.writeFileSync(srtFullPath, newSrt, "utf-8");
            ytdlpLogger.info(
              { origWords: origWords.length, slicedWords: sliced.length, srtFile },
              "SRT subtitle file sliced and re-based to match timeRange"
            );
          }
        } catch (err: unknown) {
          ytdlpLogger.warn({ err: err instanceof Error ? err.message : String(err) }, "Failed to slice SRT file for timeRange");
        }
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "completed",
        });
      }

      const finalInfo: YouTubeVideoInfo = hasTimeRange
        ? { ...info, duration: Math.max(1, Math.round(endSec - startSec)) }
        : info;

      ytdlpLogger.info({ url, videoPath: mp4File, srtPath: srtFile }, "YouTube video download completed successfully");
      resolve({
        success: true,
        data: {
          videoPath: path.join(outputDir, mp4File),
          srtPath: srtFile ? path.join(outputDir, srtFile) : undefined,
          info: finalInfo,
        },
      });
    });

    proc.on("error", (err) => {
      ytdlpLogger.error({ url, err: err.message, ytdlp }, "Error running yt-dlp download process");
      resolve({
        success: false,
        error: `Gagal menjalankan yt-dlp proses: ${err.message}`,
      });
    });
  });

}

/**
 * Converts a standard .srt or .vtt subtitle file into structured WordTimestamp[]
 */
export function parseSrtToWords(srtContent: string): WordTimestamp[] {
  if (!srtContent || typeof srtContent !== "string") return [];

  // Strip WebVTT headers and notes if present (from start to first blank line)
  const cleanContent = srtContent
    .replace(/^WEBVTT[\s\S]*?(?:\r?\n\r?\n)/i, "")
    .replace(/NOTE\s+[\s\S]*?(?:\r?\n\r?\n|$)/gi, "");

  const entries = cleanContent.split(/\r?\n\r?\n/);
  const words: WordTimestamp[] = [];

  for (const block of entries) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 1) continue;

    // Find timecode line (e.g. 00:00:01,234 --> 00:00:04,567 or 00:01.234 --> 00:04.567 line:0%)
    const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const timeParts = timeLine.split("-->").map((s) => s.trim().split(/\s+/)[0]);
    if (timeParts.length < 2) continue;

    const startSec = srtTimestampToSec(timeParts[0]);
    const endSec = srtTimestampToSec(timeParts[1]);

    if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) continue;

    const textLines = lines.slice(timeLineIndex + 1);
    const fullText = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "") // strip HTML & WebVTT voice/karaoke tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    if (!fullText) continue;

    const tokenWords = fullText.split(/\s+/).filter(Boolean);
    if (tokenWords.length === 0) continue;

    const duration = Math.max(0.1, endSec - startSec);
    const perWordDuration = duration / tokenWords.length;

    tokenWords.forEach((wordText, i) => {
      const wStart = startSec + i * perWordDuration;
      const wEnd = wStart + perWordDuration;

      // Avoid immediate duplicate words at exactly overlapping timestamps (common in auto-CC rollups)
      const prevWord = words[words.length - 1];
      const isDuplicate =
        prevWord &&
        prevWord.word.toLowerCase() === wordText.toLowerCase() &&
        Math.abs(prevWord.start - wStart) < 0.08;

      if (!isDuplicate) {
        words.push({
          word: wordText,
          start: parseFloat(wStart.toFixed(2)),
          end: parseFloat(wEnd.toFixed(2)),
          confidence: 0.95,
          isFiller: false,
          excluded: false,
        });
      }
    });
  }

  return words;
}

function srtTimestampToSec(ts: string): number {
  if (!ts) return 0;
  const clean = ts.replace(",", ".").trim();
  const parts = clean.split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(clean) || 0;
}

/**
 * Downloads audio-only stream and transcodes to target audio format (mp3, m4a, wav)
 */
export async function downloadAudioOnly(
  options: {
    url: string;
    outputDir: string;
    format?: "mp3" | "m4a" | "wav";
    customName?: string;
    timeRange?: TimeRange;
  },
  onProgress?: (progress: DownloadProgress) => void,
  onProcSpawn?: (proc: ChildProcess) => void
): Promise<Result<{ filePath: string; info: YouTubeVideoInfo }>> {
  const { url, outputDir, format = "mp3", customName, timeRange } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }
  const info = infoRes.data;
  const ytdlp = findYtDlpBinary();
  const ffmpeg = findFfmpegBinary();

  // Check timeRange option for direct splitting
  const startSec = timeRange?.start ? parseTimeToSeconds(timeRange.start) : 0;
  const endSec = timeRange?.end ? parseTimeToSeconds(timeRange.end) : 0;
  const hasTimeRange = Boolean(timeRange && endSec > startSec);

  const startFormatted = formatSecondsToTime(startSec);
  const endFormatted = formatSecondsToTime(endSec);
  const startSafe = sanitizeTimeForFilename(startFormatted);
  const endSafe = sanitizeTimeForFilename(endFormatted);

  const titleSafe = (customName || info.title).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 100);
  const outputTemplate = hasTimeRange
    ? path.join(outputDir, `[SPLIT_${startSafe}_${endSafe}_AUDIO] ${titleSafe} [${info.id}].%(ext)s`)
    : path.join(outputDir, `[AUDIO] ${titleSafe} [${info.id}].%(ext)s`);

  const args = [
    "-i",
    "--no-warnings",
    "--ignore-errors",
    "-x",
    "--audio-format",
    format,
    "--audio-quality",
    "0",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "-o",
    outputTemplate,
  ];

  if (hasTimeRange) {
    args.push(
      "--download-sections",
      `*${startFormatted}-${endFormatted}`,
      "--force-keyframes-at-cuts"
    );
  }

  if (ffmpeg) {
    args.push("--ffmpeg-location", ffmpeg);
  }

  args.push(url.trim());
  ytdlpLogger.info({ url, outputDir, format, hasTimeRange, timeRange }, "Starting audio-only download with yt-dlp");

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, { windowsHide: true });
    if (onProcSpawn) onProcSpawn(proc);

    let stderrData = "";

    proc.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseYtDlpProgressLine(line);
        if (parsed && onProgress) {
          onProgress({
            percent: parsed.percent ?? 0,
            downloadedBytes: 0,
            totalBytes: 0,
            totalSizeStr: parsed.totalSizeStr ?? "",
            speedStr: parsed.speedStr ?? "",
            etaStr: parsed.etaStr ?? "",
            status: parsed.status || "downloading",
          });
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        ytdlpLogger.error({ url, code, stderr: stderrData.slice(0, 1000) }, "Audio download failed");
        return resolve({
          success: false,
          error: `Download audio gagal (code ${code}): ${stderrData.slice(0, 300) || "Unknown error"}`,
        });
      }

      const files = fs.readdirSync(outputDir);
      const audioFile = files.find(
        (f) =>
          f.endsWith(`.${format}`) &&
          (f.includes(info.id) || f.startsWith("[SPLIT_") || f.startsWith("[AUDIO]"))
      );
      const anyAudio = audioFile || files.find((f) => f.endsWith(`.${format}`));

      if (!anyAudio) {
        return resolve({
          success: false,
          error: `File audio (.${format}) tidak ditemukan setelah download selesai.`,
        });
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "completed",
        });
      }

      const filePath = path.join(outputDir, anyAudio);
      const finalInfo: YouTubeVideoInfo = hasTimeRange
        ? { ...info, duration: Math.max(1, Math.round(endSec - startSec)) }
        : info;

      ytdlpLogger.info({ url, filePath }, "Audio download completed successfully");
      resolve({
        success: true,
        data: { filePath, info: finalInfo },
      });
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: `Gagal menjalankan proses download audio: ${err.message}` });
    });
  });
}

/**
 * Downloads subtitles only (SRT, VTT, or plain text TXT)
 */
export async function downloadSubtitleOnly(
  options: {
    url: string;
    outputDir: string;
    subFormat?: "srt" | "vtt" | "txt";
    customName?: string;
  },
  onProgress?: (progress: DownloadProgress) => void,
  onProcSpawn?: (proc: ChildProcess) => void
): Promise<Result<{ filePath: string; info: YouTubeVideoInfo }>> {
  const { url, outputDir, subFormat = "srt", customName } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }
  const info = infoRes.data;
  const ytdlp = findYtDlpBinary();

  const titleSafe = (customName || info.title).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 100);
  const outputTemplate = path.join(outputDir, `[SUB] ${titleSafe} [${info.id}].%(ext)s`);

  const downloadExt = subFormat === "txt" ? "srt" : subFormat;
  const args = [
    "--skip-download",
    "--no-warnings",
    "--ignore-errors",
    "--write-subs",
    "--write-auto-subs",
    "--sub-lang",
    "id,id-orig,en,en-orig,all",
    "--sub-format",
    downloadExt,
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "-o",
    outputTemplate,
    url.trim(),
  ];

  ytdlpLogger.info({ url, outputDir, subFormat }, "Starting subtitle download with yt-dlp");

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, { windowsHide: true });
    if (onProcSpawn) onProcSpawn(proc);

    let stderrData = "";

    proc.stdout.on("data", (chunk) => {
      if (onProgress) {
        onProgress({
          percent: 50,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "downloading",
        });
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      const files = fs.readdirSync(outputDir);
      let subFile = files.find(
        (f) =>
          (f.endsWith(".srt") || f.endsWith(".vtt")) &&
          (f.includes(info.id) || f.startsWith("[SUB]"))
      );

      if (!subFile) {
        // Fallback check any subtitle in outputDir
        subFile = files.find((f) => f.endsWith(".srt") || f.endsWith(".vtt"));
      }

      if (!subFile) {
        return resolve({
          success: false,
          error: "Subtitle tidak ditemukan atau video ini tidak memiliki subtitle/closed-captions.",
        });
      }

      let finalFilePath = path.join(outputDir, subFile);

      // If user wants .txt format, convert subtitle text
      if (subFormat === "txt") {
        try {
          const rawContent = fs.readFileSync(finalFilePath, "utf-8");
          const words = parseSrtToWords(rawContent);
          const plainText = words.map((w) => w.word).join(" ");
          const txtFilename = `[SUB] ${titleSafe} [${info.id}].txt`;
          const txtPath = path.join(outputDir, txtFilename);
          fs.writeFileSync(txtPath, plainText, "utf-8");
          finalFilePath = txtPath;
        } catch (err: unknown) {
          ytdlpLogger.warn({ err }, "Failed to convert SRT to TXT, returning raw subtitle");
        }
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          speedStr: "",
          etaStr: "",
          status: "completed",
        });
      }

      resolve({
        success: true,
        data: { filePath: finalFilePath, info },
      });
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: `Gagal menjalankan download subtitle: ${err.message}` });
    });
  });
}

/**
 * Downloads HD cover / thumbnail image directly
 */
export async function downloadThumbnailOnly(
  options: {
    url: string;
    outputDir: string;
    customName?: string;
  },
  onProgress?: (progress: DownloadProgress) => void
): Promise<Result<{ filePath: string; info: YouTubeVideoInfo }>> {
  const { url, outputDir, customName } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }
  const info = infoRes.data;

  if (!info.thumbnail) {
    return { success: false, error: "Thumbnail tidak tersedia untuk video ini." };
  }

  if (onProgress) {
    onProgress({
      percent: 30,
      downloadedBytes: 0,
      totalBytes: 0,
      speedStr: "",
      etaStr: "",
      status: "downloading",
    });
  }

  try {
    const res = await fetch(info.thumbnail, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch thumbnail HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const titleSafe = (customName || info.title).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 100);
    const filename = `[THUMB] ${titleSafe} [${info.id}].jpg`;
    const filePath = path.join(outputDir, filename);

    fs.writeFileSync(filePath, buffer);

    if (onProgress) {
      onProgress({
        percent: 100,
        downloadedBytes: buffer.length,
        totalBytes: buffer.length,
        speedStr: "",
        etaStr: "",
        status: "completed",
      });
    }

    return {
      success: true,
      data: { filePath, info },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Gagal mengunduh thumbnail: ${msg}` };
  }
}


