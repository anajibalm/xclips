import { spawn } from "child_process";
import { WordTimestamp, FillerSegment, Result } from "@/lib/xclips/types";

// ============================================================
// INDONESIAN FILLER WORD REGEX PATTERNS (Token-Level Boundaries)
// ============================================================
export const INDONESIAN_FILLER_PATTERNS: RegExp[] = [
  /^(e+|e{2,})$/i, // e, ee, eee
  /^(a+|a{2,})$/i, // a, aa, aaa
  /^(hm+m*)$/i, // hm, hmm, hmmm
  /^(eh+)$/i, // eh, ehh
  /^(ha+)$/i, // ha, haa
  /^anu$/i, // anu
  /^katakanlah$/i, // katakanlah
];

// Multi-word phrase fillers (checked across adjacent tokens)
export const MULTIWORD_FILLER_PHRASES: string[] = [
  "begitu ya ya",
  "gitu ya ya",
  "ya kan gitu",
  "jadi gitu",
  "apa namanya",
];

export const DEFAULT_SILENCE_MIN_DURATION = 1.0; // 1.0 seconds
export const DEFAULT_SILENCE_THRESHOLD_DB = -35; // -35 dB

/**
 * Detects Indonesian filler words at the token level
 */
export function detectTokenFillers(words: WordTimestamp[]): FillerSegment[] {
  const fillers: FillerSegment[] = [];
  const minDuration = 0.25; // seconds

  for (let i = 0; i < words.length; i++) {
    const wordObj = words[i];
    const cleanWord = wordObj.word.trim().toLowerCase().replace(/[.,!?;:"'()]/g, "");

    if (!cleanWord) continue;

    let isMatch = false;

    // Check single-token patterns
    for (const pattern of INDONESIAN_FILLER_PATTERNS) {
      if (pattern.test(cleanWord)) {
        isMatch = true;
        break;
      }
    }

    // Check multi-word phrase patterns (lookahead up to 3 words)
    if (!isMatch) {
      for (const phrase of MULTIWORD_FILLER_PHRASES) {
        const phraseWords = phrase.split(" ");
        if (i + phraseWords.length <= words.length) {
          const subTokens = words
            .slice(i, i + phraseWords.length)
            .map((w) => w.word.trim().toLowerCase().replace(/[.,!?;:"'()]/g, ""))
            .join(" ");

          if (subTokens === phrase) {
            const startSec = words[i].start;
            const endSec = words[i + phraseWords.length - 1].end;
            if (endSec - startSec >= minDuration) {
              fillers.push({
                startSec,
                endSec,
                text: phrase,
                type: "filler",
              });
              // Mark the tokens as filler
              for (let k = 0; k < phraseWords.length; k++) {
                words[i + k].isFiller = true;
              }
            }
            i += phraseWords.length - 1;
            isMatch = true;
            break;
          }
        }
      }
    }

    if (!wordObj.isFiller) {
      wordObj.isFiller = false;
    }

    if (isMatch && !words[i].isFiller) {
      const dur = wordObj.end - wordObj.start;
      if (dur >= minDuration) {
        wordObj.isFiller = true;
        fillers.push({
          startSec: wordObj.start,
          endSec: wordObj.end,
          text: wordObj.word,
          type: "filler",
        });
      }
    }
  }

  return fillers;
}

/**
 * Detects silent intervals using ffmpeg silencedetect filter
 */
export async function detectSilences(
  sourcePath: string,
  startSec: number = 0,
  endSec: number = 99999,
  minDurationSec: number = DEFAULT_SILENCE_MIN_DURATION,
  thresholdDb: number = DEFAULT_SILENCE_THRESHOLD_DB
): Promise<Result<FillerSegment[]>> {
  return new Promise((resolve) => {
    const args = ["-i", sourcePath];

    if (startSec > 0) {
      args.push("-ss", startSec.toString());
    }
    if (endSec < 99999) {
      args.push("-t", (endSec - startSec).toString());
    }

    args.push(
      "-af",
      `silencedetect=noise=${thresholdDb}dB:d=${minDurationSec}`,
      "-f",
      "null",
      "-"
    );

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return resolve({
          success: false,
          error: `Deteksi hening gagal: ${stderr.slice(-300)}`,
        });
      }

      const silences: FillerSegment[] = [];
      const lines = stderr.split("\n");

      let currentStart: number | null = null;

      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        if (startMatch) {
          currentStart = parseFloat(startMatch[1]) + startSec;
        }

        const endMatch = line.match(/silence_end:\s*([\d.]+)/);
        if (endMatch && currentStart !== null) {
          const currentEnd = parseFloat(endMatch[1]) + startSec;
          const dur = currentEnd - currentStart;
          if (dur >= minDurationSec) {
            silences.push({
              startSec: currentStart,
              endSec: currentEnd,
              text: `[silence ${dur.toFixed(1)}s]`,
              type: "silence",
            });
          }
          currentStart = null;
        }
      }

      resolve({ success: true, data: silences });
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Merges overlapping or adjacent exclusion segments (fillers & silences)
 * and calculates the remaining "keep" intervals
 */
export function calculateKeepIntervals(
  clipStart: number,
  clipEnd: number,
  exclusions: Array<{ startSec: number; endSec: number }>
): Array<{ start: number; end: number; duration: number }> {
  const clipDuration = clipEnd - clipStart;
  if (clipDuration <= 0) return [];

  // Filter exclusions to only those within clip range, and convert to relative offsets
  const relativeCuts: Array<{ start: number; end: number }> = [];

  for (const exc of exclusions) {
    const relStart = Math.max(0, exc.startSec - clipStart);
    const relEnd = Math.min(clipDuration, exc.endSec - clipStart);
    if (relEnd > relStart && relEnd - relStart >= 0.15) {
      relativeCuts.push({ start: relStart, end: relEnd });
    }
  }

  // Sort by start
  relativeCuts.sort((a, b) => a.start - b.start);

  // Merge overlapping cuts
  const mergedCuts: Array<{ start: number; end: number }> = [];
  for (const cut of relativeCuts) {
    if (mergedCuts.length === 0) {
      mergedCuts.push({ ...cut });
    } else {
      const prev = mergedCuts[mergedCuts.length - 1];
      if (cut.start <= prev.end + 0.05) {
        prev.end = Math.max(prev.end, cut.end);
      } else {
        mergedCuts.push({ ...cut });
      }
    }
  }

  // Invert cuts to get keep intervals
  const keepIntervals: Array<{ start: number; end: number; duration: number }> = [];
  let prevEnd = 0;

  for (const cut of mergedCuts) {
    if (cut.start > prevEnd + 0.1) {
      keepIntervals.push({
        start: prevEnd,
        end: cut.start,
        duration: cut.start - prevEnd,
      });
    }
    prevEnd = cut.end;
  }

  if (prevEnd < clipDuration - 0.1) {
    keepIntervals.push({
      start: prevEnd,
      end: clipDuration,
      duration: clipDuration - prevEnd,
    });
  }

  // If all content would be cut, fallback to keeping the entire clip
  if (keepIntervals.length === 0) {
    return [{ start: 0, end: clipDuration, duration: clipDuration }];
  }

  return keepIntervals;
}
