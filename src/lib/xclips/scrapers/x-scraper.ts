import { Result, YouTubeVideoInfo } from "@/lib/xclips/types";
import { ytdlpLogger } from "@/lib/logger";

export interface XMediaResult extends YouTubeVideoInfo {
  mediaType: "video" | "image";
  directMediaUrl: string;
}

/**
 * Checks if a given string is a valid X.com / Twitter URL
 */
export function isXUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return /(?:twitter\.com|x\.com)\/(?:[A-Za-z0-9_]+)\/status\/(\d+)/i.test(url.trim());
}

/**
 * Extracts Tweet ID from X/Twitter URL
 */
export function extractTweetId(url: string): string | null {
  const match = url.trim().match(/(?:twitter\.com|x\.com)\/(?:[A-Za-z0-9_]+)\/status\/(\d+)/i);
  return match ? match[1] : null;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/**
 * Scrapes metadata and direct stream/photo URLs from X.com / Twitter from scratch
 * using public syndication endpoint with automatic vxtwitter/fxtwitter backup.
 */
export async function fetchXInfo(url: string): Promise<Result<XMediaResult>> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return { success: false, error: "Format URL X/Twitter tidak valid (tweet status ID tidak ditemukan)" };
  }

  // 1. Try Twitter Syndication API (CDN JSON)
  try {
    const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;
    const res = await fetch(syndicationUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && (data.text !== undefined || data.video || data.mediaDetails)) {
        const title = (data.text || "X / Twitter Media").replace(/\n+/g, " ").trim().slice(0, 100);
        const author = data.user?.name || data.user?.screen_name || "X Creator";
        const uploader = data.user?.screen_name ? `@${data.user.screen_name}` : author;
        const thumbnail =
          data.video?.poster ||
          data.mediaDetails?.[0]?.media_url_https ||
          data.photos?.[0]?.url ||
          data.user?.profile_image_url_https ||
          "";

        // Check if there is a video
        let videoUrl: string | null = null;
        let highestBitrate = -1;

        // Video variants from data.video.variants
        const variants = data.video?.variants || [];
        for (const v of variants) {
          if (v.type === "video/mp4" || v.src?.includes(".mp4")) {
            const bitrate = v.bitrate || 0;
            if (bitrate > highestBitrate) {
              highestBitrate = bitrate;
              videoUrl = v.src;
            }
          }
        }

        // Check mediaDetails if video not found yet
        if (!videoUrl && Array.isArray(data.mediaDetails)) {
          for (const md of data.mediaDetails) {
            const mdVariants = md.video_info?.variants || [];
            for (const v of mdVariants) {
              if (v.content_type === "video/mp4" || v.url?.includes(".mp4")) {
                const bitrate = v.bitrate || 0;
                if (bitrate > highestBitrate) {
                  highestBitrate = bitrate;
                  videoUrl = v.url;
                }
              }
            }
          }
        }

        if (videoUrl) {
          const duration = Math.round((data.video?.durationMillis || 0) / 1000);
          ytdlpLogger.info({ tweetId, title, videoUrl }, "X video scraped successfully via Syndication");
          return {
            success: true,
            data: {
              id: tweetId,
              title,
              duration,
              thumbnail,
              uploader,
              channel: uploader,
              description: data.text || "",
              webpageUrl: url.trim(),
              mediaType: "video",
              directMediaUrl: videoUrl,
            },
          };
        }

        // If no video, check for Photos/Images
        const photoUrl =
          data.photos?.[0]?.url ||
          data.mediaDetails?.[0]?.media_url_https ||
          thumbnail;

        if (photoUrl) {
          // Request highest quality image (:orig)
          const highResPhoto = photoUrl.replace(/name=\w+/, "name=orig");
          ytdlpLogger.info({ tweetId, title, highResPhoto }, "X image scraped successfully via Syndication");
          return {
            success: true,
            data: {
              id: tweetId,
              title,
              duration: 0,
              thumbnail: photoUrl,
              uploader,
              channel: uploader,
              description: data.text || "",
              webpageUrl: url.trim(),
              mediaType: "image",
              directMediaUrl: highResPhoto,
            },
          };
        }
      }
    }
  } catch (err) {
    ytdlpLogger.warn({ tweetId, err: String(err) }, "X syndication scrape failed, trying secondary fx/vxtwitter");
  }

  // 2. Secondary Strategy: vxTwitter / fxTwitter API endpoint
  try {
    const fxUrl = `https://api.vxtwitter.com/Twitter/status/${tweetId}`;
    const res = await fetch(fxUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data) {
        const title = (data.text || "X / Twitter Media").replace(/\n+/g, " ").trim().slice(0, 100);
        const uploader = data.user_screen_name ? `@${data.user_screen_name}` : (data.user_name || "X Creator");
        const author = data.user_name || uploader;

        // Check media_extended
        const extended = Array.isArray(data.media_extended) ? data.media_extended : [];
        const videoMedia = extended.find((m: any) => m.type === "video" || m.url?.includes(".mp4"));

        if (videoMedia) {
          const duration = Math.round((videoMedia.duration_millis || 0) / 1000);
          return {
            success: true,
            data: {
              id: tweetId,
              title,
              duration,
              thumbnail: videoMedia.thumbnail_url || data.mediaURLs?.[0] || "",
              uploader,
              channel: uploader,
              description: data.text || "",
              webpageUrl: url.trim(),
              mediaType: "video",
              directMediaUrl: videoMedia.url,
            },
          };
        }

        // Check mediaURLs for video or image
        if (Array.isArray(data.mediaURLs) && data.mediaURLs.length > 0) {
          const firstMedia = data.mediaURLs[0];
          const isVideo = firstMedia.includes(".mp4") || firstMedia.includes("/video/");
          return {
            success: true,
            data: {
              id: tweetId,
              title,
              duration: 0,
              thumbnail: firstMedia,
              uploader,
              channel: uploader,
              description: data.text || "",
              webpageUrl: url.trim(),
              mediaType: isVideo ? "video" : "image",
              directMediaUrl: firstMedia,
            },
          };
        }
      }
    }
  } catch (err) {
    ytdlpLogger.warn({ tweetId, err: String(err) }, "Secondary X scraper also failed");
  }

  return {
    success: false,
    error: "Gagal mengekstrak media dari link X.com/Twitter. Konten mungkin privat atau tidak memuat media.",
  };
}
