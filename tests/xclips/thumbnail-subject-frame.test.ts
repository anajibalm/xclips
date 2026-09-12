import { describe, expect, it } from "bun:test";
import { extractThumbnailSubjectFrame } from "@/lib/xclips/thumbnail-subject-frame";

describe("S6-T thumbnail boundaries", () => {
  it("rejects missing source before invoking FFmpeg", async () => {
    const result = await extractThumbnailSubjectFrame({
      sourceVideoPath: "/tmp/does-not-exist.mp4",
      outputDir: "/tmp/s6-t",
      timestampSec: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid subject timestamp", async () => {
    const result = await extractThumbnailSubjectFrame({
      sourceVideoPath: "/tmp/does-not-exist.mp4",
      outputDir: "/tmp/s6-t",
      timestampSec: -1,
    });
    expect(result.success).toBe(false);
  });

});
