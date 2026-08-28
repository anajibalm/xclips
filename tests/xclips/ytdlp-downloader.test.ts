import { describe, it, expect } from "bun:test";
import {
  isValidYouTubeUrl,
  isTikTokUrl,
  isInstagramUrl,
  isValidMediaUrl,
  parseYtDlpProgressLine,
  parseSrtToWords,
} from "@/lib/xclips/ytdlp-downloader";

describe("xclips - Media Downloader & Parser (YouTube, TikTok, Instagram)", () => {
  it("should validate YouTube URLs accurately", () => {
    expect(isValidYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeUrl("http://youtube.com/watch?v=dQw4w9WgXcQ&t=120s")).toBe(true);
    expect(isValidYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(true);

    expect(isValidYouTubeUrl("https://vimeo.com/12345678")).toBe(false);
    expect(isValidYouTubeUrl("https://tiktok.com/@user/video/123")).toBe(false);
    expect(isValidYouTubeUrl("not-a-url")).toBe(false);
    expect(isValidYouTubeUrl("")).toBe(false);
  });

  it("should validate TikTok and Instagram URLs accurately", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@imanke22/video/7678542631722437906")).toBe(true);
    expect(isTikTokUrl("https://vm.tiktok.com/ZMxxxxxx/")).toBe(true);
    expect(isTikTokUrl("https://vt.tiktok.com/ZSxxxxxx/")).toBe(true);
    expect(isTikTokUrl("https://youtube.com/watch?v=123")).toBe(false);

    expect(isInstagramUrl("https://www.instagram.com/reel/Cxxxxxx/")).toBe(true);
    expect(isInstagramUrl("https://instagram.com/p/Cxxxxxx/")).toBe(true);
    expect(isInstagramUrl("https://tiktok.com/@user/video/123")).toBe(false);

    expect(isValidMediaUrl("https://www.tiktok.com/@imanke22/video/7678542631722437906")).toBe(true);
    expect(isValidMediaUrl("https://www.instagram.com/reel/Cxxxxxx/")).toBe(true);
    expect(isValidMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isValidMediaUrl("not-a-valid-url")).toBe(false);
  });

  it("should parse yt-dlp stdout progress lines correctly", () => {
    const line1 = "[download]  45.2% of ~ 120.50MiB at 4.25MiB/s ETA 00:15";
    const res1 = parseYtDlpProgressLine(line1);
    expect(res1).not.toBeNull();
    expect(res1?.percent).toBe(45.2);
    expect(res1?.totalSizeStr).toBe("~ 120.50MiB");
    expect(res1?.speedStr).toBe("4.25MiB/s");
    expect(res1?.etaStr).toBe("00:15");
    expect(res1?.status).toBe("downloading");

    const line2 = "[download]  100% of 15.20MiB in 00:03";
    const res2 = parseYtDlpProgressLine(line2);
    expect(res2).not.toBeNull();
    expect(res2?.percent).toBe(100);
    expect(res2?.totalSizeStr).toBe("15.20MiB");
    expect(res2?.status).toBe("merging");

    const line3 = "[Merger] Merging formats into '[FULL] video.mp4'";
    const res3 = parseYtDlpProgressLine(line3);
    expect(res3).not.toBeNull();
    expect(res3?.status).toBe("merging");

    const line4 = "Some generic stdout log without progress";
    const res4 = parseYtDlpProgressLine(line4);
    expect(res4).toBeNull();
  });

  it("should parse SRT subtitle content into structured word timestamps", () => {
    const sampleSrt = `1
00:00:01,000 --> 00:00:03,000
Halo selamat pagi teman

2
00:00:03,500 --> 00:00:06,000
Hari ini kita bahas AI`;

    const words = parseSrtToWords(sampleSrt);
    expect(words.length).toBe(9); // 4 words + 5 words

    expect(words[0].word).toBe("Halo");
    expect(words[0].start).toBe(1.0);
    expect(words[3].word).toBe("teman");

    expect(words[4].word).toBe("Hari");
    expect(words[4].start).toBe(3.5);
    expect(words[8].word).toBe("AI");
  });
});
