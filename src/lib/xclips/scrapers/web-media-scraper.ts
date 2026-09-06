import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Result, YouTubeVideoInfo, DownloadProgress } from "@/lib/xclips/types";
import { ytdlpLogger } from "@/lib/logger";
import {
  findFfmpegBinary,
  findYtDlpBinary,
  downloadDirectStreamMedia,
  downloadGenericYtDlpVideo,
  YouTubeDownloadOptions,
  YouTubeDownloadResult,
} from "../ytdlp-downloader";

export interface WebMediaResult extends YouTubeVideoInfo {
  mediaType: "video";
  directMediaUrl: string;
  filesize?: number;
  domain: string;
  isHls?: boolean;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const KNOWN_SOCIAL_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "instagr.am",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "pin.it",
];

/**
 * Checks if a URL belongs to a general web video / media site outside known social media
 */
export function isWebMediaUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;

  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    const isSocial = KNOWN_SOCIAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    return !isSocial;
  } catch {
    return false;
  }
}

/**
 * Checks if a given string is a direct video media file URL
 */
export function isDirectVideoFileUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return /\.(mp4|webm|mov|mkv|m4v|avi|ts|flv|m3u8)(\?.*)?$/i.test(trimmed);
}

/**
 * Extracts a clean domain and title from a media URL
 */
export function extractWebMediaDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "Web Video";
  }
}

/**
 * Extracts a clean title from a URL path or filename
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const basename = pathname.substring(pathname.lastIndexOf("/") + 1);
    const cleanName = decodeURIComponent(basename)
      .replace(/\.(mp4|webm|mov|mkv|m4v|avi|ts|flv|m3u8)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return cleanName || "Web Video Media";
  } catch {
    return "Web Video Media";
  }
}

/**
 * Probes duration and filesize for a direct stream URL via ffprobe or HEAD request
 */
async function probeMediaDetails(
  streamUrl: string,
  referer?: string
): Promise<{ duration: number; filesize?: number }> {
  let filesize: number | undefined = undefined;

  // 1. HEAD request
  try {
    const headRes = await fetch(streamUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": USER_AGENT,
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (headRes.ok) {
      const cl = headRes.headers.get("content-length");
      if (cl) filesize = Number(cl);
    }
  } catch {
    // Continue to ffprobe
  }

  // 2. ffprobe
  const ffmpeg = findFfmpegBinary();
  const ffprobeCmd = ffmpeg ? ffmpeg.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1") : "ffprobe";

  try {
    const duration = await new Promise<number>((resolve) => {
      const headers = referer
        ? `Referer: ${referer}\r\nUser-Agent: ${USER_AGENT}\r\n`
        : `User-Agent: ${USER_AGENT}\r\n`;

      const proc = spawn(
        ffprobeCmd,
        [
          "-headers",
          headers,
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          streamUrl,
        ],
        { windowsHide: true }
      );

      let stdout = "";
      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // ignore
        }
        resolve(0);
      }, 7000);

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on("close", (code: number | null) => {
        clearTimeout(timer);
        if (code === 0 && stdout) {
          try {
            const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
            const durSec = Math.round(Number(parsed.format?.duration || 0));
            resolve(durSec > 0 ? durSec : 0);
            return;
          } catch {
            // ignore
          }
        }
        resolve(0);
      });

      proc.on("error", () => {
        clearTimeout(timer);
        resolve(0);
      });
    });

    return { duration, filesize };
  } catch {
    return { duration: 0, filesize };
  }
}

/**
 * Universal scraper for extracting video media from websites outside well-known social media.
 * Supports direct video URLs, HTML5 video/source elements, OpenGraph metadata,
 * and multi-stage player embeds (such as StreamRizz/Vidoy).
 */
export async function fetchWebMediaInfo(url: string): Promise<Result<WebMediaResult>> {
  const cleanUrl = url.trim();
  const domain = extractWebMediaDomain(cleanUrl);
  const id = `web_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // --------------------------------------------------------------------------
  // Strategy 1: Direct Video / Stream File URL (.mp4, .webm, .m3u8, etc.)
  // --------------------------------------------------------------------------
  if (isDirectVideoFileUrl(cleanUrl)) {
    const title = extractTitleFromUrl(cleanUrl);
    const isHls = /\.m3u8(\?.*)?$/i.test(cleanUrl);
    const { duration, filesize } = await probeMediaDetails(cleanUrl);

    ytdlpLogger.info({ url: cleanUrl, domain, title, isHls }, "Direct web media file detected");

    return {
      success: true,
      data: {
        id,
        title,
        duration,
        thumbnail: "",
        uploader: domain,
        channel: domain,
        description: `Direct media file from ${domain}`,
        webpageUrl: cleanUrl,
        mediaType: "video",
        directMediaUrl: cleanUrl,
        filesize,
        domain,
        isHls,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Strategy 2: Webpage Inspection (HTML5 video, OpenGraph, Embedded Players)
  // --------------------------------------------------------------------------
  try {
    const origin = new URL(cleanUrl).origin;
    const pageRes = await fetch(cleanUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: origin,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) {
      return { success: false, error: `Gagal memuat halaman web (HTTP ${pageRes.status})` };
    }

    const pageHtml = await pageRes.text();

    // Extract title
    const ogTitleMatch = pageHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const htmlTitleMatch = pageHtml.match(/<title>([^<]+)<\/title>/i);
    let title = (ogTitleMatch ? ogTitleMatch[1] : htmlTitleMatch ? htmlTitleMatch[1] : extractTitleFromUrl(cleanUrl)).trim();

    // Extract thumbnail
    const ogImageMatch = pageHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const posterMatch = pageHtml.match(/poster=["']([^"']+)["']/i);
    let thumbnail = ogImageMatch ? ogImageMatch[1] : posterMatch ? posterMatch[1] : "";

    // Extract author
    const authorMatch =
      pageHtml.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ||
      pageHtml.match(/AUTHOR_USERNAME\s*=\s*["']([^"']+)["']/i);
    const author = authorMatch ? authorMatch[1].trim() : domain;

    let directMediaUrl: string | null = null;
    let refererForStream = origin;

    // Check OpenGraph video
    const ogVideoMatch =
      pageHtml.match(/<meta\s+property=["']og:video(?::secure_url|:url)?["']\s+content=["']([^"']+)["']/i);
    if (ogVideoMatch && !ogVideoMatch[1].includes("embed") && /\.(mp4|webm|m3u8)/i.test(ogVideoMatch[1])) {
      directMediaUrl = ogVideoMatch[1];
    }

    // Check HTML5 <source> or <video> tag
    if (!directMediaUrl) {
      const sourceMatch = pageHtml.match(/<source\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
      if (sourceMatch && /\.(mp4|webm|m3u8)/i.test(sourceMatch[1])) {
        directMediaUrl = sourceMatch[1].replace(/&amp;/g, "&");
      }
    }

    // Check Multi-Stage Embed Player Architecture (StreamRizz, Vidoy, and iframe players)
    if (!directMediaUrl) {
      const iframeIdMatch = pageHtml.match(/var\s+iframeId\s*=\s*['"]([^'"]+)['"]/i);
      const embedTokenMatch = pageHtml.match(/var\s+embedToken\s*=\s*['"]([^'"]+)['"]/i);

      let playerUrl = "";

      if (iframeIdMatch && embedTokenMatch) {
        const iframeUrl = `${origin}/ip129jk?id=${iframeIdMatch[1]}&t=${embedTokenMatch[1]}`;
        try {
          const iframeRes = await fetch(iframeUrl, {
            headers: { "User-Agent": USER_AGENT, Referer: cleanUrl },
            signal: AbortSignal.timeout(12000),
          });
          if (iframeRes.ok) {
            const iframeHtml = await iframeRes.text();
            const playerPathMatch =
              iframeHtml.match(/playerPath\s*=\s*["']([^"']+)["']/i) ||
              iframeHtml.match(/href=["'](https?:\/\/[^"']*stream\.php[^"']*)["']/i);
            if (playerPathMatch) {
              playerUrl = playerPathMatch[1].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
            }
          }
        } catch {
          // continue
        }
      }

      // Check fallback playerPath inside main HTML
      if (!playerUrl) {
        const directPlayerMatch =
          pageHtml.match(/playerPath\s*=\s*["']([^"']+)["']/i) ||
          pageHtml.match(/href=["'](https?:\/\/[^"']*stream\.php[^"']*)["']/i);
        if (directPlayerMatch) {
          playerUrl = directPlayerMatch[1].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
        } else if (cleanUrl.includes("stream.php")) {
          playerUrl = cleanUrl;
        }
      }

      if (playerUrl) {
        try {
          const playerRes = await fetch(playerUrl, {
            headers: { "User-Agent": USER_AGENT, Referer: origin },
            signal: AbortSignal.timeout(12000),
          });
          if (playerRes.ok) {
            const playerHtml = await playerRes.text();

            const pSource = playerHtml.match(/<source\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
            if (pSource) {
              directMediaUrl = pSource[1].replace(/&amp;/g, "&");
              refererForStream = origin;
            }

            const pPoster = playerHtml.match(/poster=["']([^"']+)["']/i);
            if (pPoster && !thumbnail) {
              thumbnail = pPoster[1];
            }

            const vTitle = playerHtml.match(/title:\s*["']([^"']+)["']/i);
            if (vTitle && vTitle[1].trim()) {
              title = vTitle[1].trim();
            }
          }
        } catch {
          // continue
        }
      }
    }

    // Check any direct stream URL regex match in scripts
    if (!directMediaUrl) {
      const genericStreamMatch = pageHtml.match(/https?:\/\/[^"'\s\\]+\.(?:mp4|webm|m3u8)[^"'\s\\]*/i);
      if (genericStreamMatch) {
        directMediaUrl = genericStreamMatch[0].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
      }
    }

    // If directMediaUrl was resolved via scratch heuristics
    if (directMediaUrl) {
      const isHls = /\.m3u8(\?.*)?$/i.test(directMediaUrl);
      const { duration, filesize } = await probeMediaDetails(directMediaUrl, refererForStream);

      ytdlpLogger.info(
        { url: cleanUrl, domain, title, directMediaUrl, duration, filesize, isHls },
        "Web media video metadata extracted successfully via scratch scraper"
      );

      return {
        success: true,
        data: {
          id,
          title,
          duration,
          thumbnail,
          uploader: author,
          channel: domain,
          description: `Web Video from ${domain} — ${title}`,
          webpageUrl: cleanUrl,
          mediaType: "video",
          directMediaUrl,
          filesize,
          domain,
          isHls,
        },
      };
    }

    // ------------------------------------------------------------------------
    // Strategy 3: yt-dlp Generic Fallback
    // ------------------------------------------------------------------------
    const ytdlp = findYtDlpBinary();
    const fallbackRes = await new Promise<Result<WebMediaResult>>((resolve) => {
      const proc = spawn(
        ytdlp,
        ["--dump-json", "--no-download", "--no-warnings", "--ignore-errors", cleanUrl],
        { windowsHide: true }
      );

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // ignore
        }
        resolve({ success: false, error: "Timeout saat mengambil metadata web media (30s)" });
      }, 30000);

      proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout);
            resolve({
              success: true,
              data: {
                id: data.id || id,
                title: data.title || title,
                duration: Math.round(data.duration || 0),
                thumbnail: data.thumbnail || thumbnail,
                uploader: data.uploader || author,
                channel: data.channel || domain,
                description: data.description || "",
                webpageUrl: cleanUrl,
                mediaType: "video",
                directMediaUrl: data.url || cleanUrl,
                filesize: data.filesize || data.filesize_approx,
                domain,
              },
            });
            return;
          } catch (e) {
            // ignore
          }
        }
        resolve({
          success: false,
          error: `Media video tidak ditemukan pada tautan website (${cleanUrl})`,
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ success: false, error: `Gagal menjalankan yt-dlp: ${err.message}` });
      });
    });

    return fallbackRes;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    ytdlpLogger.error({ url: cleanUrl, err: errorMsg }, "Failed to extract web media info");
    return { success: false, error: `Gagal mengekstrak media video web: ${errorMsg}` };
  }
}

/**
 * Universal downloader for web video media (direct streams, HLS playlists, or yt-dlp fallback)
 */
export async function downloadWebMediaVideo(
  options: YouTubeDownloadOptions,
  onProgress?: (progress: DownloadProgress) => void,
  onProcSpawn?: (proc: ChildProcess) => void
): Promise<Result<YouTubeDownloadResult>> {
  const { url, outputDir } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  const infoRes = await fetchWebMediaInfo(url);
  if (infoRes.success && infoRes.data.directMediaUrl) {
    const d = infoRes.data;
    const safeTitle = (d.title || "Web Video").replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
    const domain = d.domain || extractWebMediaDomain(url);
    const origin = url.startsWith("http") ? new URL(url).origin : "";

    let ext = "mp4";
    const extMatch = d.directMediaUrl.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    if (extMatch && extMatch[1] && !["m3u8", "php"].includes(extMatch[1].toLowerCase())) {
      ext = extMatch[1].toLowerCase();
    }

    const filename = `${safeTitle} [${d.id}].${ext}`;
    const filePath = path.join(outputDir, filename);

    // If it's a direct stream (non-HLS)
    if (!d.isHls) {
      const headers = origin ? { Referer: origin } : undefined;
      const dlRes = await downloadDirectStreamMedia(d.directMediaUrl, filePath, onProgress, headers);
      if (dlRes.success) {
        ytdlpLogger.info({ url, filePath, domain }, "Web media downloaded successfully via direct stream");
        return {
          success: true,
          data: {
            videoPath: filePath,
            info: d,
          },
        };
      }
      ytdlpLogger.warn({ url, err: dlRes.error }, "Direct stream download failed, attempting generic fallback");
    }
  }

  // Fallback to generic yt-dlp downloader
  return downloadGenericYtDlpVideo(options, onProgress, onProcSpawn);
}
