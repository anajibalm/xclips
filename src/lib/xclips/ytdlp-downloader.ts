import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Result, WordTimestamp } from "@/lib/xclips/types";
import { ytdlpLogger } from "@/lib/logger";



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
  status: "downloading" | "merging" | "completed" | "error";
}

export interface YouTubeDownloadOptions {
  url: string;
  outputDir: string;
  quality?: "best" | "1080p" | "720p" | "480p";
  downloadSubtitles?: boolean;
}

export interface YouTubeDownloadResult {
  videoPath: string;
  srtPath?: string;
  info: YouTubeVideoInfo;
}

/**
 * Finds the yt-dlp binary on the system
 */
export function findYtDlpBinary(): string {
  const customCandidates = [
    "yt-dlp",
    "yt-dlp.exe",
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
      "--extractor-args",
      "youtube:player_client=android,web",
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
  onProgress?: (progress: DownloadProgress) => void
): Promise<Result<YouTubeDownloadResult>> {
  const { url, outputDir, quality = "1080p" } = options;
  fs.mkdirSync(outputDir, { recursive: true });
  const ytdlp = findYtDlpBinary();

  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }
  const info = infoRes.data;

  let formatSelector = "bestvideo+bestaudio/best";
  if (quality === "1080p") {
    formatSelector = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";
  } else if (quality === "720p") {
    formatSelector = "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
  } else if (quality === "480p") {
    formatSelector = "bestvideo[height<=480]+bestaudio/best[height<=480]/best";
  }

  const outputTemplate = path.join(outputDir, "[FULL] %(title)s [%(id)s].%(ext)s");
  const args = [
    "-i",
    "--no-warnings",
    "--ignore-errors",
    "-f",
    formatSelector,
    "--merge-output-format",
    "mp4",
    "-o",
    outputTemplate,
    url.trim(),
  ];

  ytdlpLogger.info({ url, outputDir, quality }, "Starting generic media video download with yt-dlp");

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, { windowsHide: true });
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
  onProgress?: (progress: DownloadProgress) => void
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
    return downloadGenericYtDlpVideo(options, onProgress);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const ytdlp = findYtDlpBinary();

  // 1. Fetch info first
  const infoRes = await fetchYouTubeInfo(url);
  if (!infoRes.success) {
    return { success: false, error: infoRes.error };
  }

  const info = infoRes.data;

  // 2. Select format string with fallback to best
  let formatSelector = "bestvideo+bestaudio/best";
  if (quality === "1080p") {
    formatSelector = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";
  } else if (quality === "720p") {
    formatSelector = "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
  } else if (quality === "480p") {
    formatSelector = "bestvideo[height<=480]+bestaudio/best[height<=480]/best";
  }

  const outputTemplate = path.join(outputDir, "[FULL] %(title)s [%(id)s].%(ext)s");

  const args = [
    "-i",
    "--no-warnings",
    "--extractor-args",
    "youtube:player_client=android,web",
    "--ignore-errors",
    "-f",
    formatSelector,
    "--merge-output-format",
    "mp4",
    "-o",
    outputTemplate,
  ];

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

  ytdlpLogger.info({ url, outputDir, quality, downloadSubtitles, formatSelector }, "Starting YouTube video download with yt-dlp");

  return new Promise((resolve) => {
    const proc = spawn(ytdlp, args, {
      windowsHide: true,
    });

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
      const mp4File = files.find((f) => f.endsWith(".mp4") && f.includes(info.id));
      const srtFile = files.find((f) => f.endsWith(".srt") && f.includes(info.id));

      if (!mp4File) {
        // Fallback: search for any mp4 in outputDir
        const anyMp4 = files.find((f) => f.endsWith(".mp4"));
        if (!anyMp4) {
          ytdlpLogger.error({ url, outputDir, files }, "No MP4 video file found in output directory after download");
          return resolve({ success: false, error: "File video tidak ditemukan setelah download selesai." });
        }
        ytdlpLogger.info({ url, videoPath: anyMp4, srtPath: srtFile }, "YouTube video download finished (fallback file matched)");
        return resolve({
          success: true,
          data: {
            videoPath: path.join(outputDir, anyMp4),
            srtPath: srtFile ? path.join(outputDir, srtFile) : undefined,
            info,
          },
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

      ytdlpLogger.info({ url, videoPath: mp4File, srtPath: srtFile }, "YouTube video download completed successfully");
      resolve({
        success: true,
        data: {
          videoPath: path.join(outputDir, mp4File),
          srtPath: srtFile ? path.join(outputDir, srtFile) : undefined,
          info,
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
 * Converts a standard .srt subtitle file into structured WordTimestamp[]
 */
export function parseSrtToWords(srtContent: string): WordTimestamp[] {
  if (!srtContent || typeof srtContent !== "string") return [];

  const entries = srtContent.split(/\r?\n\r?\n/);
  const words: WordTimestamp[] = [];

  for (const block of entries) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) continue;

    // Find timecode line (e.g. 00:00:01,234 --> 00:00:04,567)
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;

    const timeParts = timeLine.split("-->").map((s) => s.trim());
    if (timeParts.length !== 2) continue;

    const startSec = srtTimestampToSec(timeParts[0]);
    const endSec = srtTimestampToSec(timeParts[1]);

    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    const fullText = textLines.join(" ").replace(/<[^>]+>/g, "").trim(); // strip HTML tags if any

    if (!fullText) continue;

    const tokenWords = fullText.split(/\s+/).filter(Boolean);
    if (tokenWords.length === 0) continue;

    const duration = Math.max(0.1, endSec - startSec);
    const perWordDuration = duration / tokenWords.length;

    tokenWords.forEach((wordText, i) => {
      const wStart = startSec + i * perWordDuration;
      const wEnd = wStart + perWordDuration;
      words.push({
        word: wordText,
        start: parseFloat(wStart.toFixed(2)),
        end: parseFloat(wEnd.toFixed(2)),
        confidence: 0.95,
        isFiller: false,
        excluded: false,
      });
    });
  }

  return words;
}

function srtTimestampToSec(ts: string): number {
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
