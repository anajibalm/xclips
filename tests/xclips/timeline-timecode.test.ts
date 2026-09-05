import { describe, it, expect } from "bun:test";
import { formatTime, formatTimecodeWithFrames } from "@/app/xclips/studio/types/studio.types";

describe("xclips - Studio Timeline Timecode & Master Cut Tooltip Spec", () => {
  it("should format timecode with frames accurately for standard 30 fps", () => {
    // 0 seconds -> 00:00:00:00
    expect(formatTimecodeWithFrames(0, 30)).toBe("00:00:00:00");

    // 5.5 seconds at 30fps -> 5 seconds + 15 frames
    expect(formatTimecodeWithFrames(5.5, 30)).toBe("00:00:05:15");

    // 65.2 seconds at 30fps -> 1 min, 5 sec, 6 frames
    expect(formatTimecodeWithFrames(65.2, 30)).toBe("00:01:05:06");

    // 3661 seconds at 30fps -> 1 hr, 1 min, 1 sec, 0 frames
    expect(formatTimecodeWithFrames(3661, 30)).toBe("01:01:01:00");
  });

  it("should respect custom project frame rates (24fps, 60fps)", () => {
    // 1.5 seconds at 24fps -> 1 sec + 12 frames
    expect(formatTimecodeWithFrames(1.5, 24)).toBe("00:00:01:12");

    // 1.5 seconds at 60fps -> 1 sec + 30 frames
    expect(formatTimecodeWithFrames(1.5, 60)).toBe("00:00:01:30");
  });

  it("should calculate relative clip timecode accurately from master cut segment", () => {
    const clipStartSec = 120.0; // 02:00
    const clipEndSec = 150.0;   // 02:30
    const clipDuration = clipEndSec - clipStartSec; // 30.0s
    const fps = 30;

    // When playback is right at clip start (120s master)
    const currentMaster1 = 120.0;
    const relTime1 = Math.max(0, Math.min(clipDuration, currentMaster1 - clipStartSec));
    expect(relTime1).toBe(0);
    expect(formatTimecodeWithFrames(relTime1, fps)).toBe("00:00:00:00");

    // When playback is midway through clip (135.5s master)
    const currentMaster2 = 135.5;
    const relTime2 = Math.max(0, Math.min(clipDuration, currentMaster2 - clipStartSec));
    expect(relTime2).toBe(15.5);
    expect(formatTimecodeWithFrames(relTime2, fps)).toBe("00:00:15:15");

    // When playback reaches end of clip (150s master)
    const currentMaster3 = 150.0;
    const relTime3 = Math.max(0, Math.min(clipDuration, currentMaster3 - clipStartSec));
    expect(relTime3).toBe(30.0);
    expect(formatTimecodeWithFrames(relTime3, fps)).toBe("00:00:30:00");

    // Total duration displayed for clip
    expect(formatTimecodeWithFrames(clipDuration, fps)).toBe("00:00:30:00");
  });

  it("should generate master cut tooltip string correctly matching user specification", () => {
    const clipStartSec = 120.0;
    const clipEndSec = 150.0;
    const masterDurationSec = 600.0; // 10 minutes
    const fps = 30;

    const startTc = formatTimecodeWithFrames(clipStartSec, fps);
    const endTc = formatTimecodeWithFrames(clipEndSec, fps);
    const masterDurFormatted = formatTime(masterDurationSec);

    const tooltip = `Master Cut: ${startTc} - ${endTc} (Durasi Master: ${masterDurFormatted})`;
    expect(tooltip).toBe("Master Cut: 00:02:00:00 - 00:02:30:00 (Durasi Master: 10:00)");
  });
});
