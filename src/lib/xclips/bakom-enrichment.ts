/**
 * BAKOM enrichment (S4 functional): source-internal factual B-roll overlay.
 *
 * Minimal adapter in the shape of ordered-material selection: placements map
 * program time to a provenanced material interval. Pure module, no ffmpeg.
 * Audio is NEVER touched here; the renderer keeps mapping main-program audio
 * while switching only the visual during a placement. A placement without
 * complete provenance is rejected fail-closed: material cannot be used
 * without provenance.
 */

export interface MaterialProvenance {
  materialId: string;
  sourceVideoId: string;
  sourceUrl: string;
  publisher: string;
  /** Original material interval in source seconds. */
  sourceStart: number;
  sourceEnd: number;
  selectionReason: string;
}

export interface BrollPlacement {
  /** Program-relative seconds (same convention as cues: 0 = sourceStart). */
  programStart: number;
  programEnd: number;
  /** Visual source for this slot; audio always stays on the main program. */
  sourcePath: string;
  sourceStart: number;
  sourceEnd: number;
  reason: string;
  provenance: MaterialProvenance;
}

const FRAME_TOL = 1 / 30 + 1e-9;

function fail(why: string): never {
  throw new Error(`broll placement rejected: ${why}`);
}

/**
 * Validate placements against the program. Throws fail-closed on: empty or
 * inverted spans, slots outside [0, programDur], overlapping slots, visual
 * duration mismatch beyond one frame, or incomplete provenance.
 */
export function validateBrollPlacements(placements: BrollPlacement[], programDur: number): BrollPlacement[] {
  if (!(programDur > 0)) fail("programDur must be positive");
  const sorted = [...placements].sort((a, b) => a.programStart - b.programStart);
  for (const p of sorted) {
    if (!(p.programEnd > p.programStart)) fail(`empty program slot [${p.programStart},${p.programEnd}]`);
    if (!(p.sourceEnd > p.sourceStart)) fail(`empty material span for slot [${p.programStart},${p.programEnd}]`);
    if (p.programStart < 0 || p.programEnd > programDur + 1e-9) {
      fail(`slot [${p.programStart},${p.programEnd}] outside program [0,${programDur}]`);
    }
    const slotDur = p.programEnd - p.programStart;
    const matDur = p.sourceEnd - p.sourceStart;
    if (Math.abs(slotDur - matDur) > FRAME_TOL) {
      fail(`visual/audio duration mismatch: slot ${slotDur.toFixed(3)}s vs material ${matDur.toFixed(3)}s`);
    }
    if (!p.sourcePath.trim()) fail("sourcePath missing");
    if (!p.reason.trim()) fail("reason missing");
    const prov = p.provenance;
    if (!prov) fail("provenance missing: material cannot be used without provenance");
    for (const [k, v] of [["materialId", prov.materialId], ["sourceVideoId", prov.sourceVideoId], ["sourceUrl", prov.sourceUrl], ["publisher", prov.publisher], ["selectionReason", prov.selectionReason]] as const) {
      if (!v || !v.trim()) fail(`provenance.${k} missing`);
    }
    if (!(prov.sourceEnd > prov.sourceStart)) fail("provenance source span empty");
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].programStart < sorted[i - 1].programEnd - 1e-9) {
      fail(`overlapping slots [${sorted[i - 1].programStart},${sorted[i - 1].programEnd}] and [${sorted[i].programStart},${sorted[i].programEnd}]`);
    }
  }
  return sorted;
}

/** Placement covering program-relative time t, or null on main footage. */
export function brollAt(placements: BrollPlacement[], t: number): BrollPlacement | null {
  for (const p of placements) {
    if (t + 1e-9 >= p.programStart && t < p.programEnd - 1e-9) return p;
  }
  return null;
}

export interface NativeSrtCue {
  start: number;
  end: number;
  text: string;
}

function parseSrtTime(value: string): number {
  const match = value.match(/^(\d+):(\d+):(\d+),(\d+)$/);
  if (!match) throw new Error(`invalid SRT timestamp: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

/** Build readable cues from native SRT spans mapped into program time. */
export function buildNativeSrtCues(srtText: string, sourceStart: number, sourceEnd: number, maxWords = 6): NativeSrtCue[] {
  if (!(sourceEnd > sourceStart) || !(maxWords >= 2)) throw new Error("invalid native SRT cue bounds");
  const lines: Array<{ start: number; end: number; text: string }> = [];
  for (const block of srtText.split(/\n\s*\n/)) {
    const parts = block.trim().split("\n");
    const timing = parts[1]?.match(/^(\S+)\s+-->\s+(\S+)$/);
    if (!timing || parts.length < 3) continue;
    const start = parseSrtTime(timing[1]);
    const end = parseSrtTime(timing[2]);
    if (start >= sourceStart && start < sourceEnd && end > start) {
      lines.push({ start, end: Math.min(end, sourceEnd), text: parts.slice(2).join(" ").replace(/\s+/g, " ").trim() });
    }
  }
  if (lines.length === 0) throw new Error("native SRT has no cue inside source bounds");
  lines[0].start = sourceStart;
  for (let i = 0; i < lines.length - 1; i++) lines[i].end = Math.min(lines[i].end, lines[i + 1].start);

  const cues: NativeSrtCue[] = [];
  const roundMs = (value: number) => Math.round(value * 1000) / 1000;
  for (const line of lines.filter((item) => item.end > item.start)) {
    const words = line.text.split(" ").filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords));
    while (chunks.length > 1 && chunks.at(-1)!.length === 1) chunks.at(-1)!.unshift(chunks.at(-2)!.pop()!);
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let cursor = line.start;
    for (const chunk of chunks) {
      const end = cursor + (line.end - line.start) * chunk.length / totalWords;
      cues.push({ start: roundMs(cursor - sourceStart), end: roundMs(end - sourceStart), text: chunk.join(" ") });
      cursor = end;
    }
    cues[cues.length - 1].end = roundMs(line.end - sourceStart);
  }
  return cues;
}

export interface DissolveAssembly {
  /** xfade offset: transition starts this far into the speech video. */
  offset: number;
  /** Resulting video duration: speech + endcard - dissolve. */
  outputVideoSec: number;
}

/**
 * Pure math for the speech->endcard cross-dissolve. Throws fail-closed on
 * non-positive dissolve or a dissolve longer than either side.
 */
export function dissolveAssembly(input: { speechVideoSec: number; endcardSec: number; dissolveSec: number }): DissolveAssembly {
  const { speechVideoSec, endcardSec, dissolveSec } = input;
  if (!(dissolveSec > 0)) fail("dissolveSec must be positive (0 keeps the legacy hard cut)");
  if (!(speechVideoSec > 0) || !(endcardSec > 0)) fail("speech and endcard durations must be positive");
  if (dissolveSec >= Math.min(speechVideoSec, endcardSec)) {
    fail(`dissolve ${dissolveSec}s exceeds speech ${speechVideoSec}s / endcard ${endcardSec}s`);
  }
  return { offset: speechVideoSec - dissolveSec, outputVideoSec: speechVideoSec + endcardSec - dissolveSec };
}
