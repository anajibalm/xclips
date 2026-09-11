import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { brollAt, dissolveAssembly, validateBrollPlacements, type BrollPlacement } from "@/lib/xclips/bakom-enrichment";
import {
  BAKOM_CREDIT,
  BAKOM_GOLD,
  BAKOM_HEADLINE,
  BAKOM_INTRO,
  BAKOM_NAVY,
  BAKOM_SUBTITLE,
  BAKOM_V5,
  BAKOM_V10,
  endcardChannelLines,
  endcardCtaLayout,
  layoutHookBlock,
  layoutHookRule,
  layoutSubtitleTextTopY,
  splitEmphasis,
  verifySpeechCoverage,
  type SourceCreditMeta,
  type SpeechWord,
} from "@/lib/xclips/bakom-presentation";

// ============================================================
// Official BAKOM sequential renderer (S3 finalization)
//
// One visual source of truth: every number comes from
// bakom-presentation.ts, which transcribes bakom-reels-system.html.
// This module owns only execution: environment font files, text
// measurement, FFmpeg orchestration, sequential low-memory strategy.
//
// Timeline (output): V1 intro [0,3) over a frozen source frame with no
// source speech, then the full source range shifted by the intro, then
// the mandatory 4s V10 end card. Subtitle is a persistent layer: cues
// render whenever active, including inside the V5 window.
//
// Dependencies: node + python3/PIL (metrics + V5 card) + ffmpeg/ffprobe.
// Decoupled from the trust architecture: S3-local result type below.
// No service, finalizer, or S6 modules involved.
// ============================================================

const run = promisify(execFile);
const execOpts = { maxBuffer: 1024 * 1024 * 8 };
export const ENDCARD_TIMEOUT_MS = 60_000;

/** V5 entrance per HTML motion table: fade + 16px slide over 260ms. */
export const V5_FADE_SEC = 0.26;
export const V5_SLIDE_PX = 16;

export interface OfficialBakomCue { start: number; end: number; text: string; emphasis?: string; }
export interface OfficialBakomRenderInput {
  sourceVideoPath: string;
  sourceStart: number;
  sourceEnd: number;
  headline: string;
  cues: OfficialBakomCue[];
  /** Legacy single-concept credit; prefer creditMeta (separate concepts). */
  credit: string;
  creditMeta?: SourceCreditMeta;
  /** Absolute source-timed words; when provided, uncovered speech fails closed. */
  transcriptWords?: SpeechWord[];
  outputPath: string;
  v5?: { start: number; end: number; name: string; role: string };
  framingMode?: "FIELD_FIT_BG" | "TALKING_HEAD_SAFE";
  /**
   * S4 enrichment: program-relative B-roll slots (same convention as cues).
   * Visual switches to the placement material; main-program audio is untouched.
   * Absent/empty = S3 behavior, byte-identical.
   */
  brollPlacements?: BrollPlacement[];
  /**
   * Speech->endcard cross-dissolve seconds (video only; audio stays
   * concatenated and untouched). Absent/0 = legacy hard cut, byte-identical.
   */
  endcardDissolveSec?: number;
}

/** S3-local render result. Plain data, no trust capability attached. */
export interface OfficialBakomRenderResult {
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  sourceStart: number;
  sourceEnd: number;
  introSec: number;
  rendererVersion: string;
}

/** Deterministic render method record for the manifest. */
export type FontMetricsMethod = "pil-ttf" | "fallback";
let fontMetricsMethod: FontMetricsMethod = "pil-ttf";
export function getFontMetricsMethod(): FontMetricsMethod {
  return fontMetricsMethod;
}

export function getRenderEnv(): { fontDir: string; fontMetricsMethod: FontMetricsMethod } {
  return { fontDir: process.env.XCLIPS_FONT_DIR ?? "", fontMetricsMethod };
}

function q(value: string): string { return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "’"); }

/** Resolve a TTF from XCLIPS_FONT_DIR. Fail closed with a clear error. */
export function resolveFontFile(name: string): string {
  const dir = process.env.XCLIPS_FONT_DIR ?? "";
  if (!dir) {
    throw new Error("XCLIPS_FONT_DIR is not set: official BAKOM render needs Nunito Sans + Plus Jakarta Sans TTFs (fail closed, no fallback fonts)");
  }
  const full = join(dir, name);
  if (!existsSync(full)) {
    throw new Error(`font missing: ${full} (XCLIPS_FONT_DIR=${dir}; fail closed)`);
  }
  return full;
}

function fontFiles(): { text: string; medium: string; italic: string; head: string } {
  return {
    text: resolveFontFile("nunito-sans-800.ttf"),
    medium: resolveFontFile("nunito-sans-500.ttf"),
    italic: resolveFontFile("nunito-sans-italic-500.ttf"),
    head: resolveFontFile("plus-jakarta-sans-800-latin.ttf"),
  };
}

const measureCache = new Map<string, number>();
async function measureTextPx(fontFile: string, text: string, sizePx: number): Promise<number | null> {
  const key = `${fontFile}|${sizePx}|${text}`;
  const hit = measureCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const { stdout } = await run(
      "python3",
      ["-c", "import sys; from PIL import ImageFont; f = ImageFont.truetype(sys.argv[1], int(sys.argv[2])); sys.stdout.write(str(f.getlength(sys.argv[3])))", fontFile, String(sizePx), text],
      execOpts,
    );
    const value = Number(stdout.trim());
    if (!Number.isFinite(value) || value < 0) return null;
    measureCache.set(key, value);
    return value;
  } catch {
    fontMetricsMethod = "fallback";
    return null;
  }
}

function base(mode: "FIELD_FIT_BG" | "TALKING_HEAD_SAFE" = "FIELD_FIT_BG"): string {
  if (mode === "TALKING_HEAD_SAFE") {
    return "split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=12,eq=brightness=-0.34:saturation=0.45[bgf];[fg]crop=iw*0.675:ih:(iw-ow)/2:0,scale=960:800[fgf];[bgf][fgf]overlay=60:400,setsar=1,fps=30,format=yuv420p";
  }
  return "split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=22,eq=brightness=-0.22:saturation=0.65[bgf];[fg]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2:black[fgf];[bgf][fgf]overlay=60:650,setsar=1,fps=30,format=yuv420p";
}

function creditFilter(input: string, fonts: { italic: string }): string {
  return `drawtext=fontfile=${fonts.italic}:text='${q(input)}':fontsize=${BAKOM_CREDIT.sizePx}:fontcolor=${BAKOM_CREDIT.color}:x=w-text_w-${BAKOM_CREDIT.textRightInsetPx}:y=${BAKOM_CREDIT.textTopY}:box=1:boxcolor=${BAKOM_CREDIT.boxFill}@${BAKOM_CREDIT.boxOpacity}:boxborderw=${BAKOM_CREDIT.boxPadPx}`;
}

function wrapCueLines(text: string): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { const next = `${line} ${word}`.trim(); if (line && next.length > BAKOM_SUBTITLE.maxCharsPerLine) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  return lines.slice(0, BAKOM_SUBTITLE.maxLines);
}

/**
 * V3 subtitle + V4 one-phrase emphasis from the shared spec (persistent
 * layer: no ownership windows here, the planner decides when it is active).
 */
async function subtitle(text: string, emphasis: string | undefined, fonts: { text: string }): Promise<string[]> {
  const lines = wrapCueLines(text);
  const filters: string[] = [];
  const maxLine = lines.reduce((a, b) => (a.length >= b.length ? a : b), "");
  const boxW = maxLine ? await measureTextPx(fonts.text, maxLine, BAKOM_SUBTITLE.sizePx) : null;
  if (boxW === null) {
    fontMetricsMethod = "fallback";
    for (const ln of lines) {
      const color = emphasis && ln.includes(emphasis) ? BAKOM_GOLD : "#FFFFFF";
      filters.push(`drawtext=fontfile=${fonts.text}:text='${q(ln)}':fontsize=${BAKOM_SUBTITLE.sizePx}:fontcolor=${color}:x=(w-text_w)/2:y=1394:box=1:boxcolor=#122B4E@0.88:boxborderw=33`);
    }
    return filters;
  }
  const boxH = lines.length * BAKOM_SUBTITLE.leadingPx + Math.round(BAKOM_SUBTITLE.padPx * 1.6);
  const boxWpx = Math.min(BAKOM_HEADLINE.fitWidthPx, Math.round(boxW)) + BAKOM_SUBTITLE.padPx * 2;
  const boxX = Math.round((1080 - boxWpx) / 2);
  const boxY = BAKOM_SUBTITLE.blockBottomEdgeY - boxH;
  filters.push(`drawbox=x=${boxX}:y=${boxY}:w=${boxWpx}:h=${boxH}:color=${BAKOM_NAVY}@${BAKOM_SUBTITLE.blockOpacity}:t=fill`);
  const topY = layoutSubtitleTextTopY(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const y = topY + i * BAKOM_SUBTITLE.leadingPx;
    const seg = emphasis ? splitEmphasis(ln, emphasis) : null;
    if (!seg || (!seg.pre && !seg.post)) {
      const color = seg ? BAKOM_GOLD : "#FFFFFF";
      filters.push(`drawtext=fontfile=${fonts.text}:text='${q(ln)}':fontsize=${BAKOM_SUBTITLE.sizePx}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`);
      continue;
    }
    const wPre = await measureTextPx(fonts.text, seg.pre, BAKOM_SUBTITLE.sizePx);
    const wHi = await measureTextPx(fonts.text, seg.hi, BAKOM_SUBTITLE.sizePx);
    const wPost = await measureTextPx(fonts.text, seg.post, BAKOM_SUBTITLE.sizePx);
    if (wPre === null || wHi === null || wPost === null) {
      fontMetricsMethod = "fallback";
      filters.push(`drawtext=fontfile=${fonts.text}:text='${q(ln)}':fontsize=${BAKOM_SUBTITLE.sizePx}:fontcolor=${BAKOM_GOLD}:x=(w-text_w)/2:y=${y}`);
      continue;
    }
    const x0 = Math.round(((1080 - (wPre + wHi + wPost)) / 2) * 10) / 10;
    const parts: Array<[string, number, string]> = [[seg.pre, x0, "#FFFFFF"], [seg.hi, x0 + wPre, BAKOM_GOLD], [seg.post, x0 + wPre + wHi, "#FFFFFF"]];
    for (const [part, x, color] of parts) {
      if (!part) continue;
      filters.push(`drawtext=fontfile=${fonts.text}:text='${q(part)}':fontsize=${BAKOM_SUBTITLE.sizePx}:fontcolor=${color}:x=${Math.round(x * 10) / 10}:y=${y}`);
    }
  }
  return filters;
}

/** V1 hook from the shared spec (fitted Jakarta, dynamic block, gold rule). */
async function hook(text: string, fonts: { head: string }): Promise<string[]> {
  const fitted = await fitLines({ text, probe: text.split(/\s+/).slice(0, 3).join(" "), maxW: BAKOM_HEADLINE.fitWidthPx, min: BAKOM_HEADLINE.fitMin, max: BAKOM_HEADLINE.fitMax, maxLines: BAKOM_HEADLINE.maxLines, fontFile: fonts.head });
  if (!fitted) {
    fontMetricsMethod = "fallback";
    const words = text.split(/\s+/); const lines: string[] = []; let line = "";
    for (const word of words) { const next = `${line} ${word}`.trim(); if (line && next.length > 25) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line);
    return lines.slice(0, 3).map((ln) => `drawtext=fontfile=${fonts.head}:text='${q(ln)}':fontsize=75:line_spacing=10:fontcolor=${BAKOM_GOLD}:x=90:y=1230`);
  }
  const layout = layoutHookBlock(fitted.lines, fitted.size);
  const filters: string[] = [
    `drawbox=x=${layout.box.x}:y=${layout.box.y}:w=${layout.box.w}:h=${layout.box.h}:color=black@${BAKOM_SUBTITLE.blockOpacity}:t=fill`,
  ];
  for (let i = 0; i < fitted.lines.length; i++) {
    filters.push(`drawtext=fontfile=${fonts.head}:text='${q(fitted.lines[i])}':fontsize=${fitted.size}:fontcolor=${layout.lineColors[i]}:x=${layout.textX}:y=${layout.textTopY + i * layout.lead}`);
  }
  let longest = 0;
  for (const ln of fitted.lines) longest = Math.max(longest, (await measureTextPx(fonts.head, ln, fitted.size)) ?? 0);
  const rule = layoutHookRule(longest, layout.textTopY, fitted.lines.length, layout.lead);
  filters.push(`drawbox=x=${rule.x}:y=${rule.y}:w=${rule.w}:h=${rule.h}:color=${BAKOM_GOLD}:t=fill`);
  return filters;
}

/**
 * V5 entrance motion per the HTML motion table (fade + 16px slide, 260ms).
 * Overlay timestamps restart at 0 for every V5 segment, so elapsed global
 * time inside the window is folded into numeric constants here. Pure.
 */
export function v5Motion(elapsedSec: number): { fadeFilter: string | null; overlayY: string } {
  const elapsed = Math.max(0, elapsedSec);
  if (elapsed >= V5_FADE_SEC) return { fadeFilter: null, overlayY: "0" };
  const remain = V5_FADE_SEC - elapsed;
  const rise = V5_SLIDE_PX * (1 - elapsed / V5_FADE_SEC);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    fadeFilter: `fade=t=in:st=0:d=${r3(remain)}:alpha=1`,
    overlayY: `${r3(rise)}*(1-min(t/${r3(remain)}\\,1))`,
  };
}

/**
 * Render the V5 lower-third card to a full-canvas transparent PNG.
 * All geometry/text comes from argv (shared spec owns the numbers); this
 * process only rasterizes. Deterministic for identical inputs.
 */
async function renderV5Card(name: string, role: string, fonts: { text: string; medium: string }, outPath: string): Promise<void> {
  const payload = JSON.stringify({
    out: outPath,
    block: { ...BAKOM_V5.block, fill: [18, 43, 78, 224] },
    bar: { ...BAKOM_V5.accentBar, fill: [230, 191, 112, 255] },
    name: { text: name, x: BAKOM_V5.name.x, y: BAKOM_V5.name.y, size: BAKOM_V5.name.sizePx, font: fonts.text, fill: [255, 255, 255, 255] },
    role: { text: role, x: BAKOM_V5.role.x, y: BAKOM_V5.role.y, size: BAKOM_V5.role.sizePx, font: fonts.medium, fill: [230, 191, 112, 255] },
  });
  const script = [
    "import sys, json",
    "from PIL import Image, ImageDraw, ImageFont",
    "p = json.loads(sys.argv[1])",
    "img = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))",
    "d = ImageDraw.Draw(img)",
    "b = p['block']; d.rounded_rectangle([b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']], radius=b['radius'], fill=tuple(b['fill']))",
    "r = p['bar']; d.rectangle([r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']], fill=tuple(r['fill']))",
    "n = p['name']; d.text((n['x'], n['y']), n['text'], font=ImageFont.truetype(n['font'], n['size']), fill=tuple(n['fill']), anchor='la')",
    "t = p['role']; d.text((t['x'], t['y']), t['text'], font=ImageFont.truetype(t['font'], t['size']), fill=tuple(t['fill']), anchor='la')",
    "img.save(p['out'])",
  ].join("\n");
  await run("python3", ["-c", script, payload], execOpts);
}

export interface PlannedSegment {
  start: number;
  end: number;
  sourceStart: number | null;
  kinds: Array<"intro" | "hook" | "speech" | "subtitle" | "v5" | "broll">;
  cue?: OfficialBakomCue;
  v5Active: boolean;
  /** Set only on segments fully inside a B-roll slot. Audio stays main-program. */
  broll?: { sourcePath: string; sourceStart: number; sourceEnd: number };
}

/**
 * Output-timeline segmentation (pure). V1 intro owns [0, intro); source
 * plays shifted after it; cue and V5 boundaries split source segments so a
 * segment never straddles an overlay edge. Subtitle is a persistent layer:
 * any segment covered by a cue carries it, including inside V5.
 */
export function planSegments(input: OfficialBakomRenderInput): PlannedSegment[] {
  const intro = BAKOM_INTRO.durationSec;
  const speechDur = input.sourceEnd - input.sourceStart;
  if (!(speechDur > 0)) throw new Error("sourceEnd must exceed sourceStart");
  const points = new Set<number>([intro]);
  if (input.v5) {
    if (!(input.v5.end > input.v5.start)) throw new Error("v5.end must exceed v5.start");
    points.add(intro + input.v5.start);
    points.add(intro + input.v5.end);
  }
  const placements = input.brollPlacements ?? [];
  for (const p of placements) {
    points.add(intro + p.programStart);
    points.add(intro + p.programEnd);
  }
  for (const c of input.cues) {
    if (!(c.end > c.start)) throw new Error("cue end must exceed cue start");
    points.add(intro + c.start);
    points.add(intro + c.end);
  }
  points.add(intro + speechDur);
  const sorted = [...points].sort((a, b) => a - b);
  const segs: PlannedSegment[] = [
    { start: 0, end: intro, sourceStart: null, kinds: ["intro", "hook"], cue: undefined, v5Active: false },
  ];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = Math.max(sorted[i], intro);
    const e = sorted[i + 1];
    if (e <= s + 1e-9) continue;
    const relS = s - intro;
    const relE = e - intro;
    const cue = input.cues.find((c) => c.start <= relS + 0.001 && c.end >= relE - 0.001);
    const v5Active = !!input.v5 && relS + 0.001 >= input.v5.start && relE <= input.v5.end + 0.001;
    const kinds: PlannedSegment["kinds"] = ["speech"];
    if (cue) kinds.push("subtitle");
    if (v5Active) kinds.push("v5");
    // B-roll tags only segments fully inside a slot; subtitle lookup by
    // program time is unchanged, so captions persist over B-roll.
    const slot = brollAt(placements, (relS + relE) / 2);
    const inside = slot && relS + 0.001 >= slot.programStart && relE <= slot.programEnd + 0.001 ? slot : null;
    if (inside && v5Active) throw new Error("broll+v5 overlap unsupported (fail closed)");
    if (inside) kinds.push("broll");
    segs.push({
      start: s,
      end: e,
      sourceStart: input.sourceStart + (s - intro),
      kinds,
      cue,
      v5Active,
      ...(inside ? { broll: { sourcePath: inside.sourcePath, sourceStart: inside.sourceStart + (s - intro - inside.programStart), sourceEnd: inside.sourceEnd } } : {}),
    });
  }
  return segs;
}

async function assertEndcardDuration(outputPath: string): Promise<void> {
  const probe = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", outputPath,
  ], execOpts);
  const duration = Number(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration < 3.9 || duration > 4.1) {
    throw new Error(`Endcard duration outside 3.9-4.1s: ${duration}`);
  }
}

/**
 * Segment/intermediate codec: video as final, audio LOSSLESS PCM.
 * Audio is encoded exactly once, at final assembly after mastering
 * (single AAC encode). Per-segment AAC would add generational loss plus
 * encoder padding that pollutes the gated loudness measurement.
 */
const SEGMENT_CODEC_ARGS = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-threads", "1", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2"];

export interface LoudnessMeasured {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
}

/** First loudnorm pass: analyze only. MUST use the same I/TP/LRA as the
 * second pass — measured_thresh/offset are target-dependent, so measuring
 * with defaults (I=-24) then applying at I=-14 corrupts the gain and
 * undershoots by ~2 LU (S3 proof measured -15.98). Throws fail-closed. */
export async function measureLoudness(mediaPath: string): Promise<LoudnessMeasured> {
  const probed = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", mediaPath, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], execOpts);
  const text = probed.stderr ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`loudness measurement produced no JSON for ${mediaPath}`);
  const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, string>;
  const measured: LoudnessMeasured = {
    inputI: Number(parsed.input_i),
    inputTp: Number(parsed.input_tp),
    inputLra: Number(parsed.input_lra),
    inputThresh: Number(parsed.input_thresh),
    targetOffset: Number(parsed.target_offset),
  };
  if (![measured.inputI, measured.inputTp, measured.inputLra, measured.inputThresh, measured.targetOffset].every(Number.isFinite)) {
    throw new Error(`loudness measurement unparsable for ${mediaPath}`);
  }
  return measured;
}

/** Second pass: measured values at target params (I=-14 LUFS, TP=-1.5, LRA=11).
 * linear=true only REQUESTS linear normalization when conditions allow;
 * FFmpeg falls back to dynamic when the integrated change would exceed the
 * target TP or the LRA condition fails. Pure linear is impossible on this
 * fixture (input I -21.42 / TP -3.71 to I -14 / TP -1.5 needs +7.4 gain,
 * peaks would hit +3.7), so expect dynamic fallback honoring TP. Truth is
 * the post-AAC measurement, not this flag. */
export function loudnormSecondPass(m: LoudnessMeasured): string {
  return `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.inputI}:measured_TP=${m.inputTp}:measured_LRA=${m.inputLra}:measured_thresh=${m.inputThresh}:offset=${m.targetOffset}:linear=true`;
}

function exactLengthArgs(dur: number): { frames: string; stamp: string } {
  // Video is whole frames (ceil); audio is padded/trimmed to that SAME grid
  // so A/V match per segment. Nominal-time audio would drift up to a frame
  // per segment behind ceiled video (measured -0.2s over 23 segments).
  const frames = Math.max(1, Math.round(dur * 30));
  return { frames: String(frames), stamp: (frames / 30).toFixed(3) };
}

async function introSegment(input: OfficialBakomRenderInput, dir: string, freezePng: string, creditText: string, fonts: { head: string; italic: string }): Promise<string> {
  const output = `${dir}/seg-intro.mp4`;
  const dur = BAKOM_INTRO.durationSec;
  const { frames, stamp } = exactLengthArgs(dur);
  const overlays = [...(await hook(input.headline, fonts))];
  const args = ["-y", "-threads", "1", "-loop", "1", "-framerate", "30", "-t", stamp, "-i", freezePng, "-f", "lavfi", "-t", stamp, "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", "", "-map", "[v]", "-map", "1:a", "-frames:v", frames, "-af", `apad=whole_dur=${stamp},atrim=0:${stamp}`, ...SEGMENT_CODEC_ARGS, output];
  args[args.indexOf("-filter_complex") + 1] = `[0:v]${base(input.framingMode)},${overlays.join(",")},${creditFilter(creditText, fonts)},format=yuv420p[v]`;
  await run("ffmpeg", args, execOpts);
  return output;
}

async function sourceSegment(
  input: OfficialBakomRenderInput,
  dir: string,
  index: number,
  seg: PlannedSegment,
  creditText: string,
  fonts: { text: string; medium: string; italic: string; head: string },
  cardPng: string | null,
): Promise<string> {
  const output = `${dir}/seg-${String(index).padStart(3, "0")}.mp4`;
  const dur = seg.end - seg.start;
  const absolute = seg.sourceStart ?? input.sourceStart;
  const { frames, stamp } = exactLengthArgs(dur);
  const overlays: string[] = [];
  if (seg.cue) overlays.push(...(await subtitle(seg.cue.text, seg.cue.emphasis, fonts)));
  const extraInputs: string[] = [];
  let overlayTail = "";
  // S4 enrichment: visual comes from the placement material, audio stays on
  // the main program (input 0). Caption/credit overlays apply unchanged.
  let videoInput = "0:v";
  if (seg.broll) {
    if (!existsSync(seg.broll.sourcePath)) throw new Error(`B-roll source not found: ${seg.broll.sourcePath}`);
    // Never read past the validated material end; segment padding covers any slack.
    const fetchDur = Math.min(dur + 0.25, Math.max(dur, seg.broll.sourceEnd - seg.broll.sourceStart));
    extraInputs.push("-ss", seg.broll.sourceStart.toFixed(3), "-t", fetchDur.toFixed(3), "-i", seg.broll.sourcePath);
    videoInput = "1:v";
  }
  if (seg.v5Active && input.v5 && cardPng) {
    extraInputs.push("-loop", "1", "-framerate", "30", "-t", stamp, "-i", cardPng);
    const motion = v5Motion(seg.start - (BAKOM_INTRO.durationSec + input.v5.start));
    const chain = motion.fadeFilter ? `[1:v]format=yuva420p,${motion.fadeFilter}[v5f]` : `[1:v]format=yuva420p[v5f]`;
    overlayTail = `,${chain},[bg][v5f]overlay=x=0:y='${motion.overlayY}':eof_action=pass[v]`;
  }
  const args = ["-y", "-threads", "1", "-filter_threads", "1", "-filter_complex_threads", "1", "-ss", absolute.toFixed(3), "-t", (dur + 0.25).toFixed(3), "-i", input.sourceVideoPath, ...extraInputs, "-filter_complex", "", "-map", "[v]", "-map", "0:a", "-frames:v", frames, "-af", `apad=whole_dur=${stamp},atrim=0:${stamp}`, ...SEGMENT_CODEC_ARGS, output];
  args[args.indexOf("-filter_complex") + 1] =
    `[${videoInput}]${base(input.framingMode)},${overlays.length > 0 ? `${overlays.join(",")},` : ""}${creditFilter(creditText, fonts)},format=yuv420p[bg]${overlayTail || ",[bg]copy[v]"}`;
  await run("ffmpeg", args, execOpts);
  return output;
}

function resolveCreditText(input: OfficialBakomRenderInput): string {
  if (input.creditMeta) {
    if (!input.creditMeta.sourceName.trim() || !input.creditMeta.publisherHandle.trim()) {
      throw new Error("creditMeta needs non-empty sourceName and publisherHandle (fail closed; never fabricate)");
    }
    return `${BAKOM_CREDIT.labelPrefix}: ${input.creditMeta.sourceName.trim()}`;
  }
  return input.credit;
}

export interface EndcardContent {
  headline: string;
  publisherHandle: string;
  sourceName: string;
  sourceDate?: string;
}

function resolveEndcardContent(input: OfficialBakomRenderInput): EndcardContent {
  const meta = input.creditMeta;
  if (!meta || !meta.sourceName.trim() || !meta.publisherHandle.trim()) {
    throw new Error("dynamic endcard needs creditMeta with sourceName + publisherHandle (fail closed; never split a merged string or fabricate)");
  }
  return { headline: input.headline, publisherHandle: meta.publisherHandle.trim(), sourceName: meta.sourceName.trim(), ...(meta.sourceDate?.trim() ? { sourceDate: meta.sourceDate.trim() } : {}) };
}

/** Text-free V10 background (radial navy per HTML darkBg + fixed-seed grain).
 * Deterministic for identical inputs; carries no headline or fixture. */
async function renderEndcardBackground(dir: string): Promise<string> {
  const out = `${dir}/v10bg.png`;
  const script = [
    "import sys, random",
    "from PIL import Image",
    "out = sys.argv[1]",
    "mask = Image.radial_gradient('L').resize((1080, 1920))",
    "mask = mask.point(lambda v: int(v * 0.85))",
    "bg = Image.composite(Image.new('RGB', (1080, 1920), (18, 43, 78)), Image.new('RGB', (1080, 1920), (0, 0, 0)), mask)",
    "rng = random.Random(42)",
    "noise = Image.frombytes('L', (1080, 1920), rng.randbytes(1080 * 1920))",
    "bg.paste((255, 255, 255), mask=noise.point(lambda v: 24 if v > 243 else 0))",
    "bg.save(out)",
  ].join("\n");
  await run("python3", ["-c", script, out], execOpts);
  return out;
}

/**
 * Dynamic V10 end card: background asset + portal-rendered inputs only.
 * CTA fits 96..60 single-line; a longer headline wraps to two lines at 60
 * (documented deviation, manifest-logged). Positions follow HTML V10 with
 * the block centered on 760 for the wrapped case.
 */
export async function buildEndcardVideo(args: { dir: string; content: EndcardContent; fonts: { head: string; text: string; italic: string }; outputPath: string }): Promise<void> {
  const { dir, content, fonts, outputPath } = args;
  if (!content.headline.trim() || !content.publisherHandle.trim() || !content.sourceName.trim()) {
    throw new Error("dynamic endcard needs headline, publisherHandle, sourceName (fail closed; never fabricate)");
  }
  const maxW = 1080 - 90 * 2;
  const fitted = await fitLines({ text: content.headline, probe: content.headline, maxW, min: BAKOM_V10.ctaFitMin, max: BAKOM_V10.ctaFitMax, maxLines: 2, fontFile: fonts.head });
  if (!fitted) throw new Error("endcard CTA measurement unavailable (fail closed; no unmeasured headline)");
  const layout = endcardCtaLayout(fitted.lines.length, fitted.size);
  const [chan1, chan2] = endcardChannelLines(content.publisherHandle, content.sourceName, content.sourceDate);
  const cx = "(w-text_w)/2";
  const filters: string[] = [];
  fitted.lines.forEach((ln, i) => {
    filters.push(`drawtext=fontfile=${fonts.head}:text='${q(ln)}':fontsize=${fitted.size}:fontcolor=${BAKOM_GOLD}:x=${cx}:y=${layout.topY + i * layout.lead}`);
  });
  filters.push(`drawbox=x=${540 - 110}:y=${layout.ruleY}:w=220:h=5:color=${BAKOM_GOLD}:t=fill`);
  [chan1, chan2].forEach((ln, i) => {
    filters.push(`drawtext=fontfile=${fonts.text}:text='${q(ln)}':fontsize=34:fontcolor=#F2F2F2:x=${cx}:y=${layout.channelsY + i * 46}`);
  });
  const lx = 540 - 120;
  const ly = 1180;
  filters.push(`drawbox=x=${lx}:y=${ly}:w=7:h=88:color=${BAKOM_GOLD}:t=fill`);
  (["Badan", "Komunikasi", "Pemerintah"] as const).forEach((ln, i) => {
    filters.push(`drawtext=fontfile=${fonts.text}:text='${q(ln)}':fontsize=25:fontcolor=#FFFFFF:x=${lx + 18}:y=${ly - 2 + i * 26}`);
  });
  filters.push(`drawtext=fontfile=${fonts.text}:text='REPUBLIK INDONESIA':fontsize=14:fontcolor=#FFFFFF:x=${lx + 18}:y=${ly + 76}`);
  filters.push(`drawtext=fontfile=${fonts.italic}:text='${q(`Sumber: ${content.sourceName}`)}':fontsize=26:fontcolor=#B3B3B3:x=${cx}:y=1360`);
  const bg = await renderEndcardBackground(dir);
  await run("ffmpeg", ["-y", "-threads", "1", "-filter_complex_threads", "1", "-loop", "1", "-framerate", "30", "-i", bg, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `[0:v]${filters.join(",")},format=yuv420p[v]`, "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-threads", "1", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-t", "4", "-shortest", outputPath], execOpts);
}

/** Async measured fit+wrap twin (hook CTA pattern). Null when unmeasurable. */
async function fitLines(opts: { text: string; probe: string; maxW: number; min: number; max: number; maxLines: number; fontFile: string }): Promise<{ size: number; lines: string[] } | null> {
  const wMax = await measureTextPx(opts.fontFile, opts.probe, opts.max);
  if (wMax === null) return null;
  let size = Math.max(opts.min, Math.min(opts.max, Math.floor((opts.max * opts.maxW) / wMax)));
  for (;;) {
    const w = await measureTextPx(opts.fontFile, opts.probe, size);
    if (w === null) return null;
    if (w <= opts.maxW || size <= opts.min) break;
    size--;
  }
  const words = opts.text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current) {
      const w = await measureTextPx(opts.fontFile, candidate, size);
      if (w === null) return null;
      if (w > opts.maxW) {
        lines.push(current);
        current = word;
        if (lines.length === opts.maxLines) break;
        continue;
      }
    }
    current = candidate;
  }
  if (current && lines.length < opts.maxLines) lines.push(current);
  return { size, lines: lines.slice(0, opts.maxLines) };
}

export async function renderOfficialBakomSequential(input: OfficialBakomRenderInput): Promise<OfficialBakomRenderResult> {
  if (!existsSync(input.sourceVideoPath)) throw new Error(`Source not found: ${input.sourceVideoPath}`);
  if (input.brollPlacements && input.brollPlacements.length > 0) {
    validateBrollPlacements(input.brollPlacements, input.sourceEnd - input.sourceStart);
    for (const p of input.brollPlacements) {
      if (!existsSync(p.sourcePath)) throw new Error(`B-roll source not found: ${p.sourcePath}`);
    }
  }
  if (input.endcardDissolveSec !== undefined && input.endcardDissolveSec !== 0 && !(input.endcardDissolveSec > 0)) {
    throw new Error(`endcardDissolveSec must be positive (0 keeps the legacy hard cut): ${input.endcardDissolveSec}`);
  }
  const fonts = fontFiles();
  const creditText = resolveCreditText(input);
  if (input.transcriptWords && input.transcriptWords.length > 0) {
    // Honest coverage: ONLY caption cues cover spoken words. V5/V4/credit
    // never substitute subtitles; V1/V10 need no window because their audio
    // is generated silence (no source words can exist there by construction).
    const toAbs = (rel: number) => input.sourceStart + rel;
    const windows = input.cues.map((c) => ({ start: toAbs(c.start), end: toAbs(c.end), kind: "cue" }));
    const coverage = verifySpeechCoverage(input.transcriptWords, windows, { start: input.sourceStart, end: input.sourceEnd });
    if (!coverage.ok) {
      throw new Error(`speech without caption cue: ${coverage.gaps.map((g) => `${g.start.toFixed(2)}-${g.end.toFixed(2)}s [${g.words.join(" ")}]`).join("; ")}`);
    }
  }
  const dir = `${input.outputPath}.segments`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const freezePng = `${dir}/intro-freeze.png`;
  await run("ffmpeg", ["-y", "-v", "error", "-ss", input.sourceStart.toFixed(3), "-i", input.sourceVideoPath, "-frames:v", "1", freezePng], execOpts);
  let cardPng: string | null = null;
  if (input.v5) {
    cardPng = `${dir}/v5card.png`;
    await renderV5Card(input.v5.name, input.v5.role, fonts, cardPng);
  }
  const plan = planSegments(input);
  const files: string[] = [await introSegment(input, dir, freezePng, creditText, fonts)];
  let speechIndex = 0;
  for (const seg of plan) {
    if (seg.sourceStart === null) continue;
    files.push(await sourceSegment(input, dir, speechIndex++, seg, creditText, fonts, cardPng));
  }
  const list = `${dir}/concat.txt`;
  await writeFile(list, files.map((f) => `file '${f.split("/").pop()}'`).join("\n"));
  const speech = `${dir}/speech.mp4`;
  await run("ffmpeg", ["-y", "-threads", "1", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", speech], execOpts);
  const endcard = `${dir}/endcard.mp4`;
  await buildEndcardVideo({ dir, content: resolveEndcardContent(input), fonts, outputPath: endcard });
  await assertEndcardDuration(endcard);
  // Single normalization on the final assembled program (not per segment):
  // join speech + endcard losslessly first, measure that exact mix, then
  // encode audio exactly once at final assembly.
  const assembledList = `${dir}/assemble-concat.txt`;
  await writeFile(assembledList, `file 'speech.mp4'\nfile 'endcard.mp4'\n`);
  const assembled = `${dir}/assembled.mp4`;
  await run("ffmpeg", ["-y", "-threads", "1", "-f", "concat", "-safe", "0", "-i", assembledList, "-c", "copy", assembled], execOpts);
  const loudness = await measureLoudness(assembled);
  // Strict CFR assembly re-encode: concat-copy preserves per-file timestamp
  // drift (91ms gap measured at the V10 joint). Re-encoding pins video to
  // exact 30fps CFR and pulls audio onto the same clock.
  // Strict CFR assembly re-encode: concat-copy preserves per-file timestamp
  // drift (91ms gap measured at the V10 joint). Re-encoding pins video to
  // exact 30fps CFR and pulls audio onto the same clock. This is the single
  // lossy audio encode: everything upstream is lossless PCM.
  const finalList = `${dir}/final-concat.txt`;
  await writeFile(finalList, `file 'assembled.mp4'\n`);
  const dissolveSec = input.endcardDissolveSec ?? 0;
  if (dissolveSec > 0) {
    // S4 dissolve WITHOUT xfade: xfade silently drops the second input on
    // concat-copy timestamp drift, and trim is unreliable on assembled
    // timelines. The joint is rebuilt from clean single-encode files only:
    // last speech seg (kept part + alpha-faded tail) overlaid with the
    // alpha-faded endcard head, then concatenated. Audio mastering stays on
    // the untouched assembled mix, exactly like the legacy path.
    const speechProbe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=nw=1:nk=1", speech], execOpts);
    const speechVideoSec = Number(speechProbe.stdout.trim());
    if (!Number.isFinite(speechVideoSec)) throw new Error("cannot probe speech video duration for dissolve");
    const cardProbe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=nw=1:nk=1", endcard], execOpts);
    const endcardVideoSec = Number(cardProbe.stdout.trim());
    if (!Number.isFinite(endcardVideoSec)) throw new Error("cannot probe endcard video duration for dissolve");
    const dasm = dissolveAssembly({ speechVideoSec, endcardSec: endcardVideoSec, dissolveSec });
    const lastSeg = files[files.length - 1];
    const lastProbe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=nw=1:nk=1", lastSeg], execOpts);
    const lastDur = Number(lastProbe.stdout.trim());
    const keepDur = lastDur - dissolveSec;
    if (!Number.isFinite(keepDur) || keepDur <= 1) throw new Error(`last speech segment too short for dissolve: ${lastDur}`);
    const fx = (n: string) => `${dir}/dissolve-${n}.mp4`;
    await run("ffmpeg", ["-y", "-threads", "1", "-i", lastSeg, "-t", keepDur.toFixed(3), ...SEGMENT_CODEC_ARGS, fx("kept")], execOpts);
    // Fades and overlay run in ONE graph: intermediate encodes would strip
    // the alpha channel and freeze the blend. Single encode to x264 here.
    await run("ffmpeg", ["-y", "-threads", "1", "-sseof", `-${dissolveSec.toFixed(3)}`, "-i", lastSeg, "-t", dissolveSec.toFixed(3), "-i", endcard,
      "-filter_complex", `[0:v]format=yuva420p,fade=t=out:st=0:d=${dissolveSec}:alpha=1[va];[1:v]format=yuva420p,fade=t=in:st=0:d=${dissolveSec}:alpha=1[vb];[va][vb]overlay=eof_action=pass,format=yuv420p[v]`,
      "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-threads", "1", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-shortest", fx("x")], execOpts);
    await run("ffmpeg", ["-y", "-threads", "1", "-ss", dissolveSec.toFixed(3), "-i", endcard, ...SEGMENT_CODEC_ARGS, fx("tailcard")], execOpts);
    const videoList = `${dir}/dissolve-video.txt`;
    const videoFiles = [...files.slice(0, -1).map((f) => f.split("/").pop() as string), "dissolve-kept.mp4", "dissolve-x.mp4", "dissolve-tailcard.mp4"];
    await writeFile(videoList, videoFiles.map((f) => `file '${f}'`).join("\n"));
    const dissolvedVideo = `${dir}/dissolved-video.mp4`;
    await run("ffmpeg", ["-y", "-threads", "1", "-f", "concat", "-safe", "0", "-i", videoList, "-c", "copy", dissolvedVideo], execOpts);
    await run("ffmpeg", ["-y", "-threads", "1", "-i", dissolvedVideo, "-i", assembled, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-threads", "1", "-r", "30", "-fps_mode", "cfr", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-af", `${loudnormSecondPass(loudness)},aresample=44100:async=1`, "-shortest", input.outputPath], execOpts);
    // Fail closed: dissolved video must match the tested dissolve math.
    const dissolvedProbe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=nw=1:nk=1", input.outputPath], execOpts);
    const dissolvedDur = Number(dissolvedProbe.stdout.trim());
    if (!Number.isFinite(dissolvedDur) || Math.abs(dissolvedDur - dasm.outputVideoSec) > 0.15) {
      throw new Error(`dissolve output duration ${dissolvedDur} diverges from assembly math ${dasm.outputVideoSec}`);
    }
  } else {
  await run("ffmpeg", ["-y", "-threads", "1", "-f", "concat", "-safe", "0", "-i", finalList, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", "30", "-fps_mode", "cfr", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-af", `${loudnormSecondPass(loudness)},aresample=44100:async=1`, "-shortest", input.outputPath], execOpts);
  }
  const probe = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "default=nw=1:nk=1", input.outputPath], execOpts);
  const [w, h] = probe.stdout.trim().split("\n").map(Number);
  if (w !== 1080 || h !== 1920) throw new Error(`proof output geometry unexpected: ${w}x${h}`);
  return {
    outputPath: input.outputPath,
    width: w,
    height: h,
    fps: 30,
    durationSec: input.sourceEnd - input.sourceStart + BAKOM_INTRO.durationSec + BAKOM_V10.appendSec,
    sourceStart: input.sourceStart,
    sourceEnd: input.sourceEnd,
    introSec: BAKOM_INTRO.durationSec,
    rendererVersion: "official-bakom-sequential-2",
  };
}
