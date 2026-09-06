import { WordTimestamp } from "./types";

/**
 * Parses time string (HH:MM:SS, MM:SS, or seconds) to seconds number
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const clean = timeStr.trim();
  const parts = clean.split(":").map((p) => parseFloat(p));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0] || 0;
  }
  return 0;
}

/**
 * Formats seconds to HH:MM:SS string
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Sanitizes time string for safe inclusion in filenames (e.g. 00:01:30 -> 00-01-30)
 */
export function sanitizeTimeForFilename(timeStr: string): string {
  return (timeStr || "").replace(/[:\s]+/g, "-");
}

/**
 * Slices an array of WordTimestamp to fit within [startSec, endSec]
 * and re-bases timestamps so the new segment starts at 0.00s.
 */
export function sliceWordsByTimeRange(
  words: WordTimestamp[],
  startSec: number,
  endSec: number
): WordTimestamp[] {
  if (!Array.isArray(words) || words.length === 0) return [];
  if (endSec <= startSec) return [];

  const sliced: WordTimestamp[] = [];
  for (const w of words) {
    // Word overlaps with [startSec, endSec]
    if (w.end > startSec && w.start < endSec) {
      const newStart = Math.max(0, parseFloat((w.start - startSec).toFixed(2)));
      const newEnd = Math.max(newStart + 0.05, parseFloat((w.end - startSec).toFixed(2)));
      sliced.push({
        ...w,
        start: newStart,
        end: newEnd,
      });
    }
  }
  return sliced;
}
