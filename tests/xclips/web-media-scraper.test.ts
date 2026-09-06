import { describe, it, expect, mock } from "bun:test";
import {
  isWebMediaUrl,
  isDirectVideoFileUrl,
  extractWebMediaDomain,
  extractTitleFromUrl,
  fetchWebMediaInfo,
} from "@/lib/xclips/scrapers/web-media-scraper";
import { isValidMediaUrl } from "@/lib/xclips/ytdlp-downloader";

describe("xclips - Universal Web Media Video Scraper Spec", () => {
  describe("Web Media URL Parser & Domain Extractor", () => {
    it("should classify non-social media website URLs as web media", () => {
      expect(isWebMediaUrl("https://streamrizz.com/e/rpktxj2x4zko")).toBe(true);
      expect(isWebMediaUrl("https://vimeo.com/123456789")).toBe(true);
      expect(isWebMediaUrl("https://dailymotion.com/video/x7xxxx")).toBe(true);
      expect(isWebMediaUrl("https://news.ycombinator.com/item?id=123")).toBe(true);
      expect(isWebMediaUrl("https://cdn.example.org/videos/lecture.mp4")).toBe(true);
    });

    it("should not classify major social media URLs as generic web media", () => {
      expect(isWebMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
      expect(isWebMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
      expect(isWebMediaUrl("https://www.tiktok.com/@user/video/123")).toBe(false);
      expect(isWebMediaUrl("https://instagram.com/reel/123")).toBe(false);
      expect(isWebMediaUrl("https://x.com/user/status/123")).toBe(false);
      expect(isWebMediaUrl("https://twitter.com/user/status/123")).toBe(false);
      expect(isWebMediaUrl("https://pinterest.com/pin/123")).toBe(false);
    });

    it("should extract domain names cleanly", () => {
      expect(extractWebMediaDomain("https://streamrizz.com/e/rpktxj2x4zko")).toBe("streamrizz.com");
      expect(extractWebMediaDomain("https://www.my-video-host.co.uk/watch/99")).toBe("my-video-host.co.uk");
      expect(extractWebMediaDomain("invalid")).toBe("Web Video");
    });
  });

  describe("Direct Video Media File Validator & Parser", () => {
    it("should detect direct video file URLs correctly", () => {
      expect(isDirectVideoFileUrl("https://example.com/videos/sample.mp4")).toBe(true);
      expect(isDirectVideoFileUrl("https://cdn.site.org/media/clip.webm?token=123")).toBe(true);
      expect(isDirectVideoFileUrl("http://storage.net/assets/render.mov")).toBe(true);
      expect(isDirectVideoFileUrl("https://domain.com/files/recording.mkv")).toBe(true);
      expect(isDirectVideoFileUrl("https://streaming.com/live/playlist.m3u8")).toBe(true);
    });

    it("should reject non-video files and web pages", () => {
      expect(isDirectVideoFileUrl("https://example.com/image.png")).toBe(false);
      expect(isDirectVideoFileUrl("https://example.com/document.pdf")).toBe(false);
      expect(isDirectVideoFileUrl("https://example.com/page.html")).toBe(false);
      expect(isDirectVideoFileUrl("")).toBe(false);
    });

    it("should extract clean title from direct video URLs", () => {
      expect(extractTitleFromUrl("https://example.com/videos/Viral_Cooking_Recipe_2026.mp4")).toBe(
        "Viral Cooking Recipe 2026"
      );
      expect(extractTitleFromUrl("https://cdn.org/raw%20footage%20clip.webm?download=1")).toBe(
        "raw footage clip"
      );
      expect(extractTitleFromUrl("")).toBe("Web Video Media");
    });
  });

  describe("Unified isValidMediaUrl Compatibility", () => {
    it("should accept YouTube, TikTok, Instagram, X.com, Pinterest, and arbitrary Web Media URLs", () => {
      expect(isValidMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
      expect(isValidMediaUrl("https://www.tiktok.com/@creator/video/1234567890")).toBe(true);
      expect(isValidMediaUrl("https://www.instagram.com/reel/Cxxxxxx/")).toBe(true);
      expect(isValidMediaUrl("https://x.com/developer/status/1820000000000000000")).toBe(true);
      expect(isValidMediaUrl("https://pin.it/4kLMNOP")).toBe(true);
      expect(isValidMediaUrl("https://streamrizz.com/e/rpktxj2x4zko")).toBe(true);
      expect(isValidMediaUrl("https://any-website.com/watch/video-id-123")).toBe(true);
      expect(isValidMediaUrl("https://example.com/direct_sample.mp4")).toBe(true);
    });

    it("should reject empty or non-URL strings", () => {
      expect(isValidMediaUrl("")).toBe(false);
      expect(isValidMediaUrl("   ")).toBe(false);
      expect(isValidMediaUrl("just a string")).toBe(false);
    });
  });

  describe("Web Media Extractor Scraper Tests & Mocking", () => {
    it("should extract metadata from direct video file URLs directly", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: { "Content-Length": "10485760", "Content-Type": "video/mp4" },
        });
      }) as unknown as typeof fetch;

      try {
        const res = await fetchWebMediaInfo("https://mycdn.org/videos/Cool_Clip.mp4");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Cool Clip");
          expect(res.data.directMediaUrl).toBe("https://mycdn.org/videos/Cool_Clip.mp4");
          expect(res.data.domain).toBe("mycdn.org");
          expect(res.data.mediaType).toBe("video");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should extract video from HTML5 video source and OpenGraph tags", async () => {
      const originalFetch = globalThis.fetch;
      const htmlPage = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Stunning Nature Documentary</title>
            <meta property="og:title" content="Stunning Nature Documentary" />
            <meta property="og:image" content="https://wildlife.org/poster.jpg" />
          </head>
          <body>
            <video controls poster="https://wildlife.org/poster.jpg">
              <source src="https://wildlife.org/media/nature_1080p.mp4" type="video/mp4" />
            </video>
          </body>
        </html>
      `;

      globalThis.fetch = mock(async (reqUrl: string | URL | Request) => {
        const urlStr = typeof reqUrl === "string" ? reqUrl : reqUrl.toString();
        if (urlStr.includes("wildlife.org/watch")) {
          return new Response(htmlPage, { status: 200, headers: { "Content-Type": "text/html" } });
        }
        return new Response(null, { status: 200, headers: { "Content-Length": "20000000" } });
      }) as unknown as typeof fetch;

      try {
        const res = await fetchWebMediaInfo("https://wildlife.org/watch/123");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Stunning Nature Documentary");
          expect(res.data.directMediaUrl).toBe("https://wildlife.org/media/nature_1080p.mp4");
          expect(res.data.thumbnail).toBe("https://wildlife.org/poster.jpg");
          expect(res.data.domain).toBe("wildlife.org");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should extract video from multi-stage player embed (StreamRizz/Vidoy style)", async () => {
      const originalFetch = globalThis.fetch;
      const fakeEmbedHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Awesome Cinematic Drone Shot.mp4</title></head>
          <body>
            <script>
              var iframeId = 'dummyIframe123';
              var embedToken = 'dummyToken456';
              const AUTHOR_USERNAME = "dronepilot";
            </script>
          </body>
        </html>
      `;
      const fakeIframeHtml = `
        <html>
          <head>
            <link rel="prefetch" href="https://streamrizz.com/stream.php?bucket=cdn&id=dummy123&t=token">
          </head>
          <body>
            <script>
              const playerPath = "https://streamrizz.com/stream.php?bucket=cdn\\u0026id=dummy123\\u0026t=token";
            </script>
          </body>
        </html>
      `;
      const fakePlayerHtml = `
        <html>
          <head>
            <script>
              const VPLAYER = {
                id: "dummy123",
                title: "Awesome Cinematic Drone Shot.mp4"
              };
            </script>
          </head>
          <body>
            <video id="player" poster="https://i.streamrizz.com/image/dummy123.jpg">
              <source src="https://cdn-video.overfetch.video/drone_1080p.mp4" />
            </video>
          </body>
        </html>
      `;

      globalThis.fetch = mock(async (reqUrl: string | URL | Request) => {
        const urlStr = typeof reqUrl === "string" ? reqUrl : reqUrl.toString();
        if (urlStr.includes("/e/")) {
          return new Response(fakeEmbedHtml, { status: 200, headers: { "Content-Type": "text/html" } });
        }
        if (urlStr.includes("/ip129jk")) {
          return new Response(fakeIframeHtml, { status: 200, headers: { "Content-Type": "text/html" } });
        }
        if (urlStr.includes("stream.php")) {
          return new Response(fakePlayerHtml, { status: 200, headers: { "Content-Type": "text/html" } });
        }
        return new Response(null, { status: 200, headers: { "Content-Length": "1234567" } });
      }) as unknown as typeof fetch;

      try {
        const res = await fetchWebMediaInfo("https://streamrizz.com/e/dummy123");
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.title).toBe("Awesome Cinematic Drone Shot.mp4");
          expect(res.data.directMediaUrl).toBe("https://cdn-video.overfetch.video/drone_1080p.mp4");
          expect(res.data.thumbnail).toBe("https://i.streamrizz.com/image/dummy123.jpg");
          expect(res.data.uploader).toBe("dronepilot");
          expect(res.data.domain).toBe("streamrizz.com");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should return clean error on non-200 HTTP response without throwing", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(async () => {
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      try {
        const res = await fetchWebMediaInfo("https://broken-site.com/video/999");
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toContain("HTTP 404");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
