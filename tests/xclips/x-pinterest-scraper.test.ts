import { describe, it, expect, mock, spyOn } from "bun:test";
import { isXUrl, extractTweetId, fetchXInfo } from "@/lib/xclips/scrapers/x-scraper";
import { isPinterestUrl, resolvePinterestUrl, fetchPinterestInfo } from "@/lib/xclips/scrapers/pinterest-scraper";
import { isValidMediaUrl } from "@/lib/xclips/ytdlp-downloader";

describe("xclips - X.com & Pinterest Scratch Extractors Spec", () => {
  describe("X.com / Twitter URL Parser & Validator", () => {
    it("should validate valid X and Twitter post URLs correctly", () => {
      expect(isXUrl("https://x.com/elonmusk/status/1831411234567890123")).toBe(true);
      expect(isXUrl("https://twitter.com/OpenAI/status/1780000000000000000?s=20")).toBe(true);
      expect(isXUrl("http://x.com/user_123/status/99999999")).toBe(true);
      expect(isXUrl("https://www.twitter.com/NASA/status/123456789")).toBe(true);
    });

    it("should reject non-X URLs and non-status profile URLs", () => {
      expect(isXUrl("https://x.com/elonmusk")).toBe(false);
      expect(isXUrl("https://twitter.com/explore")).toBe(false);
      expect(isXUrl("https://youtube.com/watch?v=123")).toBe(false);
      expect(isXUrl("")).toBe(false);
      expect(isXUrl("invalid-string")).toBe(false);
    });

    it("should extract Tweet ID accurately", () => {
      expect(extractTweetId("https://x.com/user/status/1831411234567890123")).toBe("1831411234567890123");
      expect(extractTweetId("https://twitter.com/user/status/456789?ref=share")).toBe("456789");
      expect(extractTweetId("https://x.com/home")).toBeNull();
      expect(extractTweetId("")).toBeNull();
    });
  });

  describe("Pinterest URL Parser & Validator", () => {
    it("should validate valid Pinterest pin URLs and shortlinks", () => {
      expect(isPinterestUrl("https://www.pinterest.com/pin/123456789012345678/")).toBe(true);
      expect(isPinterestUrl("https://pinterest.com/pin/987654321/")).toBe(true);
      expect(isPinterestUrl("https://pin.it/5AbCdEf")).toBe(true);
      expect(isPinterestUrl("http://pin.it/7xYz901")).toBe(true);
    });

    it("should reject invalid Pinterest URLs", () => {
      expect(isPinterestUrl("https://www.pinterest.com/search/pins/?q=nature")).toBe(false);
      expect(isPinterestUrl("https://www.pinterest.com/username/")).toBe(false);
      expect(isPinterestUrl("https://tiktok.com/@user/123")).toBe(false);
      expect(isPinterestUrl("")).toBe(false);
    });

    it("should resolve non-shortlink URLs without network fetch", async () => {
      const canonical = "https://www.pinterest.com/pin/123456789/";
      const resolved = await resolvePinterestUrl(canonical);
      expect(resolved).toBe(canonical);
    });
  });

  describe("Unified isValidMediaUrl Compatibility", () => {
    it("should accept YouTube, TikTok, Instagram, X.com, and Pinterest in isValidMediaUrl", () => {
      expect(isValidMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
      expect(isValidMediaUrl("https://www.tiktok.com/@creator/video/1234567890")).toBe(true);
      expect(isValidMediaUrl("https://www.instagram.com/reel/Cxxxxxx/")).toBe(true);
      expect(isValidMediaUrl("https://x.com/developer/status/1820000000000000000")).toBe(true);
      expect(isValidMediaUrl("https://pin.it/4kLMNOP")).toBe(true);
      expect(isValidMediaUrl("https://pinterest.com/pin/1122334455/")).toBe(true);
    });

    it("should reject empty or non-URL strings", () => {
      expect(isValidMediaUrl("")).toBe(false);
      expect(isValidMediaUrl("   ")).toBe(false);
      expect(isValidMediaUrl("random-text-without-protocol")).toBe(false);
    });
  });

  describe("X Extractor Error Paths & Contracts", () => {
    it("should return clean error on invalid status ID without throwing exception", async () => {
      const res = await fetchXInfo("https://x.com/user/invalid");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Format URL X/Twitter tidak valid");
      }
    });

    it("should handle syndication JSON with video variants accurately", async () => {
      // Mock global fetch for syndication endpoint
      const originalFetch = globalThis.fetch;
      const mockFetch = mock(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes("syndication.twimg.com/tweet-result")) {
          return new Response(
            JSON.stringify({
              text: "Amazing viral clip demonstration",
              user: { name: "Test Creator", screen_name: "test_creator" },
              video: {
                poster: "https://pbs.twimg.com/media/poster.jpg",
                durationMillis: 15000,
                variants: [
                  { type: "video/mp4", src: "https://video.twimg.com/test_low.mp4", bitrate: 500000 },
                  { type: "video/mp4", src: "https://video.twimg.com/test_high.mp4", bitrate: 2176000 },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input);
      });

      globalThis.fetch = mockFetch as any;
      try {
        const res = await fetchXInfo("https://x.com/test_creator/status/123456789");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Amazing viral clip demonstration");
          expect(res.data.uploader).toBe("@test_creator");
          expect(res.data.mediaType).toBe("video");
          expect(res.data.directMediaUrl).toBe("https://video.twimg.com/test_high.mp4");
          expect(res.data.duration).toBe(15);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should handle photo tweets and request highest resolution (:orig)", async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = mock(async (input: any) => {
        const urlStr = String(input);
        if (urlStr.includes("syndication.twimg.com/tweet-result")) {
          return new Response(
            JSON.stringify({
              text: "Stunning high-res photography",
              user: { name: "Photo Creator", screen_name: "photo_artist" },
              photos: [{ url: "https://pbs.twimg.com/media/sample_photo.jpg?name=small" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input);
      });

      globalThis.fetch = mockFetch as any;
      try {
        const res = await fetchXInfo("https://x.com/photo_artist/status/987654321");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.mediaType).toBe("image");
          expect(res.data.directMediaUrl).toContain("name=orig");
          expect(res.data.duration).toBe(0);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Pinterest Extractor Error Paths & Contracts", () => {
    it("should return clean error on non-200 HTTP response", async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = mock(async (input: any) => {
        return new Response("Not Found", { status: 404 });
      });

      globalThis.fetch = mockFetch as any;
      try {
        const res = await fetchPinterestInfo("https://www.pinterest.com/pin/999999999999999999/");
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toContain("404");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should parse video pin from HTML __PWS_DATA__ correctly", async () => {
      const originalFetch = globalThis.fetch;
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Pinterest Aesthetic Video</title></head>
        <body>
          <script id="__PWS_DATA__" type="application/json">
          {
            "props": {
              "initialReduxState": {
                "pins": {
                  "12345": {
                    "title": "Inspiring Cinematic Edit",
                    "description": "Short form video inspiration",
                    "pinner": { "full_name": "Studio Creator", "username": "studiocreator" },
                    "videos": {
                      "video_list": {
                        "V_720P": { "url": "https://v.pinimg.com/videos/mc/720p/test_pin_video.mp4", "duration": 12000 }
                      }
                    },
                    "images": {
                      "orig": { "url": "https://i.pinimg.com/originals/poster.jpg" }
                    }
                  }
                }
              }
            }
          }
          </script>
        </body>
        </html>
      `;

      const mockFetch = mock(async (input: any) => {
        return new Response(sampleHtml, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      globalThis.fetch = mockFetch as any;
      try {
        const res = await fetchPinterestInfo("https://www.pinterest.com/pin/12345/");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Inspiring Cinematic Edit");
          expect(res.data.mediaType).toBe("video");
          expect(res.data.directMediaUrl).toBe("https://v.pinimg.com/videos/mc/720p/test_pin_video.mp4");
          expect(res.data.duration).toBe(12);
          expect(res.data.uploader).toBe("Studio Creator");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should parse image pin and transform to original high-res URL", async () => {
      const originalFetch = globalThis.fetch;
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="Minimalist Design Board" />
          <meta property="og:image" content="https://i.pinimg.com/736x/ab/cd/ef/minimal.jpg" />
        </head>
        <body></body>
        </html>
      `;

      const mockFetch = mock(async (input: any) => {
        return new Response(sampleHtml, { status: 200, headers: { "Content-Type": "text/html" } });
      });

      globalThis.fetch = mockFetch as any;
      try {
        const res = await fetchPinterestInfo("https://www.pinterest.com/pin/55555/");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Minimalist Design Board");
          expect(res.data.mediaType).toBe("image");
          expect(res.data.directMediaUrl).toContain("/originals/");
          expect(res.data.duration).toBe(0);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
