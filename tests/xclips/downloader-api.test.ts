import { describe, it, expect } from "bun:test";
import {
  isValidYouTubeUrl,
  isTikTokUrl,
  isInstagramUrl,
  isValidMediaUrl,
  getQualitySelectorArgs,
} from "@/lib/xclips/ytdlp-downloader";
import { XclipsDatabase } from "@/lib/xclips/xclips-db";

describe("xclips - Downloader API & Multiplatform Pipeline", () => {
  it("should classify platforms accurately for routing", () => {
    function detectPlatformHelper(url: string) {
      if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
      if (/tiktok\.com/i.test(url)) return "tiktok";
      if (/instagram\.com/i.test(url)) return "instagram";
      return "generic";
    }

    expect(detectPlatformHelper("https://www.youtube.com/watch?v=xyz123")).toBe("youtube");
    expect(detectPlatformHelper("https://youtu.be/xyz123")).toBe("youtube");
    expect(detectPlatformHelper("https://www.tiktok.com/@user/video/987654")).toBe("tiktok");
    expect(detectPlatformHelper("https://www.instagram.com/reel/abc123/")).toBe("instagram");
    expect(detectPlatformHelper("https://twitter.com/user/status/123456")).toBe("generic");
  });

  it("should store and query multi-format download history records", () => {
    const db = new XclipsDatabase(":memory:");

    const videoRecord = {
      id: "dl_1",
      platform: "youtube" as const,
      url: "https://www.youtube.com/watch?v=sample",
      title: "Sample Video",
      author: "TechChannel",
      durationSec: 300,
      thumbnailUrl: "https://img.youtube.com/vi/sample/hqdefault.jpg",
      formatType: "video" as const,
      quality: "1080p" as const,
      filePath: "/vault/downloads/sample.mp4",
      fileSizeBytes: 50000000,
      status: "completed" as const,
      createdAt: "2026-09-02T12:00:00.000Z",
    };

    const audioRecord = {
      id: "dl_2",
      platform: "tiktok" as const,
      url: "https://www.tiktok.com/@user/video/sample",
      title: "Audio Track",
      author: "SoundCreator",
      durationSec: 45,
      thumbnailUrl: "https://img.tiktok.com/cover.jpg",
      formatType: "audio" as const,
      quality: "mp3" as const,
      filePath: "/vault/downloads/audio.mp3",
      fileSizeBytes: 1500000,
      status: "completed" as const,
      createdAt: "2026-09-02T12:05:00.000Z",
    };

    const subRecord = {
      id: "dl_3",
      platform: "youtube" as const,
      url: "https://www.youtube.com/watch?v=sample",
      title: "Subtitles Track",
      author: "TechChannel",
      durationSec: 300,
      thumbnailUrl: "",
      formatType: "subtitle" as const,
      quality: "srt" as const,
      filePath: "/vault/downloads/sub.srt",
      fileSizeBytes: 12000,
      status: "completed" as const,
      createdAt: "2026-09-02T12:10:00.000Z",
    };

    db.addDownloadRecord(videoRecord);
    db.addDownloadRecord(audioRecord);
    db.addDownloadRecord(subRecord);

    expect(db.getDownloadRecords().length).toBe(3);
    expect(db.getDownloadRecords({ platform: "youtube" }).length).toBe(2);
    expect(db.getDownloadRecords({ formatType: "audio" }).length).toBe(1);
    expect(db.getDownloadRecords({ search: "Audio" }).length).toBe(1);

    db.close();
  });

  it("should configure 4K and 1440p quality presets properly", () => {
    const q4k = getQualitySelectorArgs("4k");
    expect(q4k.formatSelector).toContain("2160");
    expect(q4k.formatSort).toContain("res:2160");

    const q1440 = getQualitySelectorArgs("1440p");
    expect(q1440.formatSelector).toContain("1440");
    expect(q1440.formatSort).toContain("res:1440");
  });

  it("should preserve and retrieve timeRange in download records", () => {
    const db = new XclipsDatabase(":memory:");

    const splitRecord = {
      id: "dl_split_1",
      platform: "youtube" as const,
      url: "https://www.youtube.com/watch?v=sample",
      title: "Podcast Segment [00:05:00-00:08:30]",
      author: "Host",
      durationSec: 210,
      thumbnailUrl: "",
      formatType: "video" as const,
      quality: "1080p" as const,
      filePath: "/vault/downloads/[SPLIT_00-05-00_00-08-30] Podcast.mp4",
      fileSizeBytes: 25000000,
      status: "completed" as const,
      createdAt: "2026-09-04T12:00:00.000Z",
      rawJson: JSON.stringify({ timeRange: { start: "00:05:00", end: "00:08:30" } }),
    };

    db.addDownloadRecord(splitRecord);

    const fetched = db.getDownloadRecordById("dl_split_1");
    expect(fetched).not.toBeNull();
    expect(fetched?.timeRange).toEqual({ start: "00:05:00", end: "00:08:30" });

    const records = db.getDownloadRecords();
    expect(records[0].timeRange).toEqual({ start: "00:05:00", end: "00:08:30" });

    db.close();
  });
});
