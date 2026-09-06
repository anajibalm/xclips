import { Result, YouTubeVideoInfo } from "@/lib/xclips/types";
import { ytdlpLogger } from "@/lib/logger";

export interface PinterestMediaResult extends YouTubeVideoInfo {
  mediaType: "video" | "image";
  directMediaUrl: string;
}

/**
 * Checks if a given string is a valid Pinterest URL
 */
export function isPinterestUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return /(?:pinterest\.com\/pin\/|pin\.it\/)/i.test(url.trim());
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/**
 * Unescapes basic HTML entities in string
 */
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Resolves shortlink like pin.it to canonical pinterest.com URL
 */
export async function resolvePinterestUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!/pin\.it/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const res = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    return res.url || trimmed;
  } catch (err) {
    ytdlpLogger.warn({ url: trimmed, err: String(err) }, "Failed to resolve pin.it redirect, using original");
    return trimmed;
  }
}

/**
 * Scrapes metadata and direct MP4/JPG from Pinterest pin from scratch
 */
export async function fetchPinterestInfo(rawUrl: string): Promise<Result<PinterestMediaResult>> {
  try {
    const canonicalUrl = await resolvePinterestUrl(rawUrl);
    const pinIdMatch = canonicalUrl.match(/\/pin\/(\d+)/i);
    const pinId = pinIdMatch ? pinIdMatch[1] : `${Date.now()}`;

    // Fetch HTML page
    const res = await fetch(canonicalUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { success: false, error: `Pinterest merespon dengan status HTTP ${res.status}` };
    }

    const html = await res.text();

    let title = "Pinterest Pin";
    let description = "";
    let uploader = "Pinterest Creator";
    let videoUrl: string | null = null;
    let imageUrl: string | null = null;
    let duration = 0;

    // 1. Try to extract JSON from __PWS_DATA__
    const pwsMatch = html.match(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (pwsMatch && pwsMatch[1]) {
      try {
        const pwsJson = JSON.parse(pwsMatch[1]);
        const pinsObj = pwsJson?.props?.initialReduxState?.pins || {};
        const pinData = pinsObj[pinId] || Object.values(pinsObj)[0] as any;

        if (pinData) {
          title = pinData.title || pinData.grid_title || pinData.rich_metadata?.title || title;
          description = pinData.description || pinData.rich_metadata?.description || "";
          uploader = pinData.pinner?.full_name || pinData.pinner?.username || uploader;

          // Check video list
          const videoList = pinData.videos?.video_list;
          if (videoList && typeof videoList === "object") {
            // Find highest quality MP4: V_720P, V_EXP7, or any mp4
            const sortedKeys = ["V_1080P", "V_720P", "V_EXP7", "V_EXP6", "V_EXP5", "V_EXP4", "V_EXP3"];
            for (const k of sortedKeys) {
              if (videoList[k]?.url && videoList[k].url.includes(".mp4")) {
                videoUrl = videoList[k].url;
                duration = Math.round(videoList[k].duration / 1000) || 0;
                break;
              }
            }
            if (!videoUrl) {
              for (const item of Object.values(videoList) as any[]) {
                if (item?.url && item.url.includes(".mp4")) {
                  videoUrl = item.url;
                  duration = Math.round((item.duration || 0) / 1000);
                  break;
                }
              }
            }
          }

          // Check high-res image
          if (pinData.images?.orig?.url) {
            imageUrl = pinData.images.orig.url;
          } else if (pinData.images && Object.values(pinData.images).length > 0) {
            const firstImg = Object.values(pinData.images)[0] as any;
            imageUrl = firstImg?.url || null;
          }
        }
      } catch (err) {
        ytdlpLogger.warn({ pinId, err: String(err) }, "Failed to parse __PWS_DATA__ JSON");
      }
    }

    // 2. Fallback: Parse OpenGraph & LD+JSON meta tags
    if (!videoUrl) {
      const ogVideoMatch =
        html.match(/<meta\s+property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:video(?::secure_url)?["']/i);
      if (ogVideoMatch && ogVideoMatch[1] && ogVideoMatch[1].includes(".mp4")) {
        videoUrl = unescapeHtml(ogVideoMatch[1]);
      }
    }

    if (!imageUrl) {
      const ogImgMatch =
        html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
      if (ogImgMatch && ogImgMatch[1]) {
        imageUrl = unescapeHtml(ogImgMatch[1]);
      }
    }

    if (title === "Pinterest Pin") {
      const ogTitleMatch =
        html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = unescapeHtml(ogTitleMatch[1]).replace(/\s*\|\s*Pinterest.*$/i, "").trim();
      }
    }

    // Determine final media
    if (videoUrl) {
      ytdlpLogger.info({ pinId, title, videoUrl }, "Pinterest video scraped successfully from scratch");
      return {
        success: true,
        data: {
          id: pinId,
          title: title.slice(0, 100),
          duration,
          thumbnail: imageUrl || "",
          uploader,
          channel: uploader,
          description,
          webpageUrl: canonicalUrl,
          mediaType: "video",
          directMediaUrl: videoUrl,
        },
      };
    }

    if (imageUrl) {
      // Ensure highest quality by replacing 736x or others with originals if applicable
      const highRes = imageUrl.replace(/\/\d+x\//, "/originals/");
      ytdlpLogger.info({ pinId, title, highRes }, "Pinterest image pin scraped successfully from scratch");
      return {
        success: true,
        data: {
          id: pinId,
          title: title.slice(0, 100),
          duration: 0,
          thumbnail: imageUrl,
          uploader,
          channel: uploader,
          description,
          webpageUrl: canonicalUrl,
          mediaType: "image",
          directMediaUrl: highRes,
        },
      };
    }

    return {
      success: false,
      error: "Tidak dapat menemukan stream video atau gambar pada pin Pinterest ini.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ytdlpLogger.error({ rawUrl, err: msg }, "Pinterest scraper exception");
    return { success: false, error: `Gagal membaca media Pinterest: ${msg}` };
  }
}
