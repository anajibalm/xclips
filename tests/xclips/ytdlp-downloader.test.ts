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

    const line3 = "[Merger] Merging formats into 'video.mp4'";
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

  it("should resolve dual-axis bounds and format sort for all download qualities (1080p, 720p, 480p, best)", () => {
    const { getQualitySelectorArgs } = require("@/lib/xclips/ytdlp-downloader");

    const q1080 = getQualitySelectorArgs("1080p");
    expect(q1080.formatSelector).toContain("height<=1080][width<=1920]");
    expect(q1080.formatSelector).toContain("width<=1080][height<=1920]");
    expect(q1080.formatSort).toBe("res:1080,fps,vcodec:h264,acodec:m4a");

    const q720 = getQualitySelectorArgs("720p");
    expect(q720.formatSelector).toContain("height<=720][width<=1280]");
    expect(q720.formatSelector).toContain("width<=720][height<=1280]");
    expect(q720.formatSort).toBe("res:720,fps,vcodec:h264,acodec:m4a");

    const q480 = getQualitySelectorArgs("480p");
    expect(q480.formatSelector).toContain("height<=480][width<=854]");
    expect(q480.formatSort).toBe("res:480,fps,vcodec:h264,acodec:m4a");

    const qBest = getQualitySelectorArgs("best");
    expect(qBest.formatSelector).toBe("bv*+ba/b");
    expect(qBest.formatSort).toBe("res,fps,vcodec:h264,acodec:m4a");

    const q4k = getQualitySelectorArgs("4k");
    expect(q4k.formatSelector).toContain("height<=2160][width<=3840]");
    expect(q4k.formatSort).toBe("res:2160,fps,vcodec:h264,acodec:m4a");

    const q1440 = getQualitySelectorArgs("1440p");
    expect(q1440.formatSelector).toContain("height<=1440][width<=2560]");
    expect(q1440.formatSort).toBe("res:1440,fps,vcodec:h264,acodec:m4a");
  });

  it("should handle process registration and cancellation cleanly", () => {
    const { registerActiveProcess, cancelActiveProcess } = require("@/lib/xclips/ytdlp-downloader");

    let killed = false;
    const fakeProc = {
      kill: () => {
        killed = true;
      },
    };

    registerActiveProcess("task_test_123", fakeProc as any);
    const result = cancelActiveProcess("task_test_123");
    expect(result).toBe(true);
    expect(killed).toBe(true);

    const nonExistent = cancelActiveProcess("task_non_existent");
    expect(nonExistent).toBe(false);
  });

  it("should parse various time string formats to seconds accurately", () => {
    const { parseTimeToSeconds } = require("@/lib/xclips/ytdlp-downloader");

    expect(parseTimeToSeconds("00:01:30")).toBe(90);
    expect(parseTimeToSeconds("01:23:45")).toBe(5025);
    expect(parseTimeToSeconds("05:30")).toBe(330);
    expect(parseTimeToSeconds("45")).toBe(45);
    expect(parseTimeToSeconds("120.5")).toBe(120.5);

    // Boundary & error cases
    expect(parseTimeToSeconds("")).toBe(0);
    expect(parseTimeToSeconds("invalid:time")).toBe(0);
    expect(parseTimeToSeconds(null as any)).toBe(0);
  });

  it("should format seconds to HH:MM:SS string accurately", () => {
    const { formatSecondsToTime, sanitizeTimeForFilename } = require("@/lib/xclips/ytdlp-downloader");

    expect(formatSecondsToTime(90)).toBe("00:01:30");
    expect(formatSecondsToTime(5025)).toBe("01:23:45");
    expect(formatSecondsToTime(0)).toBe("00:00:00");
    expect(formatSecondsToTime(-15)).toBe("00:00:00");

    expect(sanitizeTimeForFilename("00:01:30")).toBe("00-01-30");
    expect(sanitizeTimeForFilename("01:23:45")).toBe("01-23-45");
  });

  it("should accurately slice and re-base word timestamps to 0s for direct splitting", () => {
    const { sliceWordsByTimeRange } = require("@/lib/xclips/ytdlp-downloader");
    const sampleWords = [
      { word: "A", start: 1.0, end: 2.0, confidence: 0.95, isFiller: false, excluded: false },
      { word: "B", start: 2.5, end: 4.0, confidence: 0.95, isFiller: false, excluded: false },
      { word: "C", start: 4.5, end: 6.0, confidence: 0.95, isFiller: false, excluded: false },
      { word: "D", start: 6.5, end: 8.0, confidence: 0.95, isFiller: false, excluded: false },
      { word: "E", start: 8.5, end: 9.5, confidence: 0.95, isFiller: false, excluded: false },
    ];

    // Slice range: 2.0s to 7.0s
    const sliced = sliceWordsByTimeRange(sampleWords, 2.0, 7.0);
    expect(sliced.length).toBe(3); // B, C, D

    // Verify word B re-based from 2.5s -> 0.5s
    expect(sliced[0].word).toBe("B");
    expect(sliced[0].start).toBe(0.5);
    expect(sliced[0].end).toBe(2.0);

    // Verify word C re-based from 4.5s -> 2.5s
    expect(sliced[1].word).toBe("C");
    expect(sliced[1].start).toBe(2.5);
    expect(sliced[1].end).toBe(4.0);

    // Verify word D re-based from 6.5s -> 4.5s
    expect(sliced[2].word).toBe("D");
    expect(sliced[2].start).toBe(4.5);
    expect(sliced[2].end).toBe(6.0);

    // Boundary cases: invalid ranges return empty array
    expect(sliceWordsByTimeRange(sampleWords, 10.0, 5.0)).toEqual([]);
    expect(sliceWordsByTimeRange([], 0, 10)).toEqual([]);
  });

  it("should provide multi-fragment network acceleration arguments", () => {
    const { getNetworkAccelerationArgs } = require("@/lib/xclips/ytdlp-downloader");
    const flags = getNetworkAccelerationArgs();

    expect(flags).toContain("--concurrent-fragments");
    expect(flags).toContain("5");
    expect(flags).toContain("--buffer-size");
    expect(flags).toContain("16M");
  });

  it("should handle fetchYouTubeSubtitlesQuick gracefully on invalid URL", async () => {
    const { fetchYouTubeSubtitlesQuick } = require("@/lib/xclips/ytdlp-downloader");
    const res = await fetchYouTubeSubtitlesQuick("not-a-youtube-url", "vault/xclips/cache/test_quick");
    expect(res.success).toBe(true);
    expect(res.data).toBeNull();
  });
});

