import * as fs from "fs";
import * as path from "path";
import type { Result } from "@/lib/xclips/types";

// ============================================================
// BAKOM official presentation primitives (S3.2, deterministic)
// Source: bakom-reels-system.html (video grammar) +
// bakom-layout-library.html (static tokens). No donor styling.
// ============================================================

export const BAKOM_GOLD = "#E6BF70";
export const BAKOM_GOLD_DEEP = "#AA8544";
export const BAKOM_NAVY = "#122B4E";
export const BAKOM_BLUE = "#154277";
export const BAKOM_WHITE = "#FFFFFF";
export const BAKOM_LIGHT = "#F2F2F2";
export const BAKOM_GREY = "#B3B3B3";
export const BAKOM_BLACK = "#000000";

/** Production renders must never show safe-zone debug guides. */
export const BAKOM_SAFE_ZONE_GUIDE_VISIBLE = false;
/** Legacy S1 red accent is not part of the official system. */
export const BAKOM_LEGACY_RED = "#D71920";

export const BAKOM_CANVAS = { width: 1080, height: 1920 } as const;
export const BAKOM_SAFE_ZONE = { topPx: 250, bottomPx: 420, marginX: 90 } as const;

export const BAKOM_SUBTITLE = {
  fontFamily: "Nunito Sans",
  fontWeight: 800,
  sizePx: 52,
  leadingPx: 58,
  maxLines: 2,
  maxCharsPerLine: 32,
  textColor: BAKOM_WHITE,
  highlightColor: BAKOM_GOLD,
  blockColor: BAKOM_NAVY,
  blockOpacity: 0.88,
  blockBottomEdgeY: 1500,
  /** HTML T.sub.pad: fitted-box horizontal pad and vertical rhythm source. */
  padPx: 30,
  minDurationSec: 1.2,
  maxDurationSec: 3.5,
  fadeInMs: 120,
  fadeOutMs: 100,
} as const;

export const BAKOM_HOOK = { fitMin: 75, fitMax: 104, maxLines: 3, blockBottomEdgeY: 1500 } as const;

/**
 * V1 hook headline record, transcribed from bakom-reels-system.html V1.
 * HTML wins over earlier approximations: headline face is Plus Jakarta Sans
 * (Brown Pro substitute, see HTML footer), first line gold with remaining
 * lines grey, and a gold rule below the text sized to the longest line.
 */
export const BAKOM_HEADLINE = {
  fontFamily: '"Plus Jakarta Sans"',
  fontName: "Brown Pro ExtraBold",
  fitMin: BAKOM_HOOK.fitMin,
  fitMax: BAKOM_HOOK.fitMax,
  maxLines: BAKOM_HOOK.maxLines,
  /** HTML V1 maxW = W - 2*90 - 60. */
  fitWidthPx: 840,
  blockBottomEdgeY: BAKOM_HOOK.blockBottomEdgeY,
  textX: 90,
  textTopPad: 40,
  blockBottomPad: 96,
  firstLineColor: BAKOM_GOLD,
  restColor: BAKOM_GREY,
  ruleThickness: 5,
  ruleGap: 10,
} as const;

export const BAKOM_V5 = {
  block: { x: 66, y: 1090, w: 760, h: 150, radius: 12 },
  accentBar: { x: 90, y: 1112, w: 7, h: 106 },
  name: { sizePx: 46, weight: 800, x: 114, y: 1118 },
  role: { sizePx: 32, weight: 500, x: 114, y: 1176 },
  enterSec: 0.26,
  slidePx: 16,
  visibleSec: 3.5,
  windowSec: [3.0, 6.5] as const,
} as const;

export const BAKOM_V10 = { appendSec: 4.0, ctaFitMin: 60, ctaFitMax: 96, centerY: 760 } as const;

/**
 * V10 channel lines from separated metadata concepts. The handle and the
 * footage source are never merged into one model field; this composes only
 * the display lines. The endcard background carries no headline or fixture.
 */
export function endcardChannelLines(handle: string, sourceName: string, sourceDate?: string): [string, string] {
  const date = (sourceDate ?? "").trim();
  return [
    `Informasi resmi: ${handle}`,
    date ? `Sumber footage: ${sourceName} · ${date}` : `Sumber footage: ${sourceName}`,
  ];
}

export interface EndcardCtaLayout {
  topY: number;
  lead: number;
  ruleY: number;
  channelsY: number;
}

/**
 * HTML V10 CTA geometry generalized for line count. Single line collapses
 * exactly to HTML (top 760, rule +26, channels +70); wrapped lines center
 * the block on 760 instead. Offsets stay HTML-derived, never invented.
 */
export function endcardCtaLayout(lineCount: number, sizePx: number): EndcardCtaLayout {
  const lines = Math.max(1, Math.floor(lineCount));
  const lead = sizePx - 3;
  const topY = lines <= 1 ? BAKOM_V10.centerY : BAKOM_V10.centerY - lead;
  return { topY, lead, ruleY: topY + lines * lead + 26, channelsY: topY + lines * lead + 70 };
}

/**
 * V1 intro: the hook owns output [0, 3s) over a frozen source frame with no
 * source speech (bakom-reels-system.html timeline 0-3 dtk). Source video and
 * audio start after the intro; source content is shifted, never cut.
 */
export const BAKOM_INTRO = { durationSec: 3.0 } as const;

/**
 * Top-right source credit, transcribed from bakom-reels-system.html credit().
 * HTML geometry: text top at safeTop + 16 + 3 with right inset margin + 14;
 * box is black 55% padded around the text. Earlier renderer drafts placed
 * this inside the 250px platform safe zone; HTML places it below the line.
 */
export const BAKOM_CREDIT = {
  fontFamily: '"Nunito Sans"',
  italic: true,
  weight: 500,
  sizePx: 24,
  color: BAKOM_LIGHT,
  boxFill: BAKOM_BLACK,
  boxOpacity: 0.55,
  /** Persistent source label never mixes in the publisher handle. */
  labelPrefix: "Sumber",
  textTopY: 269,
  boxTopY: 262,
  textRightInsetPx: 104,
  boxPadPx: 14,
} as const;

export const BAKOM_V6 = {
  block: { x: 66, y: 880, w: 948, h: 404, radius: 16 },
  number: { sizePx: 230, x: 90, y: 920 },
  ruleOffsetY: 286,
  label: { sizePx: 40, weight: 700, x: 90, yOffset: 312 },
  countUpMs: 700,
} as const;

export const BAKOM_V7 = {
  block: { x: 66, w: 948, bottomEdgeY: 1500, radius: 16 },
  quote: { sizePx: 48, leadingPx: 56, weight: 700 },
  ruleWidth: 160,
  attribution: { sizePx: 30, weight: 700 },
} as const;

export const BAKOM_V8 = {
  y: 390,
  x: 66,
  height: 62,
  radius: 10,
  bar: { x: 90, w: 6, h: 34 },
  text: { sizePx: 30, weight: 700, xOffset: 20, yOffset: 16 },
} as const;

export const BAKOM_V9 = {
  block: { x: 66, y: 760, w: 948, h: 470, radius: 16 },
  caption: { sizePx: 34, weight: 800 },
} as const;

export const BAKOM_V2 = {
  gradient: { fromY: 760, toY: 1500, endOpacity: 0.82 },
  headlineTopPad: 70,
} as const;

/** Production subtitle replacement policy: V5/V7 own their window. */
export const BAKOM_V5_SUBTITLE_POLICY = "replace_while_active" as const;

export type BakomModuleType =
  | "hook"
  | "subtitle"
  | "subtitle_emphasis"
  | "lower_third"
  | "stat"
  | "quote"
  | "location"
  | "map"
  | "end_card";

export interface BakomModuleRenderRequest {
  type: BakomModuleType;
  content: Record<string, string>;
  start: number;
  end: number;
}

export interface BakomModuleSpec {
  type: BakomModuleType;
  sourceHtmlFunction: string;
  replacesSubtitle: boolean;
  geometry: Record<string, number | string>;
}

/** All 10 official modules registered with source function + subtitle behavior. */
export const BAKOM_MODULES: Record<string, BakomModuleSpec> = {
  v1: { type: "hook", sourceHtmlFunction: "V1 hook block", replacesSubtitle: false, geometry: { x: 66, bottomEdgeY: 1500 } },
  v2: { type: "hook", sourceHtmlFunction: "V2 hook gradient", replacesSubtitle: false, geometry: { fromY: 760, toY: 1500 } },
  v3: { type: "subtitle", sourceHtmlFunction: "subtitle()", replacesSubtitle: false, geometry: { bottomEdgeY: 1500 } },
  v4: { type: "subtitle_emphasis", sourceHtmlFunction: "subtitle(text,hi)", replacesSubtitle: false, geometry: { bottomEdgeY: 1500 } },
  v5: { type: "lower_third", sourceHtmlFunction: "V5 lower third", replacesSubtitle: true, geometry: { ...BAKOM_V5.block } },
  v6: { type: "stat", sourceHtmlFunction: "V6 stat", replacesSubtitle: false, geometry: { ...BAKOM_V6.block } },
  v7: { type: "quote", sourceHtmlFunction: "V7 quote", replacesSubtitle: true, geometry: { x: 66, bottomEdgeY: 1500 } },
  v8: { type: "location", sourceHtmlFunction: "V8 location", replacesSubtitle: false, geometry: { x: 66, y: 390 } },
  v9: { type: "map", sourceHtmlFunction: "V9 map", replacesSubtitle: false, geometry: { ...BAKOM_V9.block } },
  v10: { type: "end_card", sourceHtmlFunction: "V10 end card", replacesSubtitle: false, geometry: { centerY: 760 } },
};

export function getBakomModuleSpec(id: string): BakomModuleSpec {
  const spec = BAKOM_MODULES[id.toLowerCase()];
  if (!spec) throw new Error(`Unknown BAKOM module: ${id}`);
  return spec;
}

/**
 * ONE deterministic production entry point for official modules.
 * Returns renderable geometry + text layers; no framework, no registry
 * beyond the frozen V1-V10 table. Throws on unknown type or missing content.
 */
export interface BakomTextLayer {
  text: string;
  x: number;
  y: number;
  sizePx: number;
  weight: number;
  color: string;
}

export interface BakomModuleJob {
  moduleId: string;
  type: BakomModuleType;
  start: number;
  end: number;
  replacesSubtitle: boolean;
  box?: { x: number; y: number; w: number; h: number; radius: number; fill: string; opacity: number };
  accentBar?: { x: number; y: number; w: number; h: number; color: string };
  textLayers: BakomTextLayer[];
}

function requireContent(content: Record<string, string>, key: string, moduleId: string): string {
  const value = (content[key] ?? "").trim();
  if (!value) throw new Error(`Module ${moduleId} requires content.${key}`);
  return value;
}

export function renderBakomModule(request: BakomModuleRenderRequest): BakomModuleJob {
  const { type, content, start, end } = request;
  if (!(end > start)) throw new Error(`Module ${type} requires end > start`);
  switch (type) {
    case "hook": {
      const headline = requireContent(content, "headline", "hook");
      return {
        moduleId: "v1",
        type,
        start,
        end,
        replacesSubtitle: false,
        box: { x: 66, y: 1500 - 312, w: 948, h: 312, radius: 16, fill: BAKOM_BLACK, opacity: 0.88 },
        textLayers: [{ text: headline, x: 90, y: 1500 - 312 + 40, sizePx: 75, weight: 800, color: BAKOM_GOLD }],
      };
    }
    case "subtitle":
      return { moduleId: "v3", type, start, end, replacesSubtitle: false, textLayers: [] };
    case "subtitle_emphasis": {
      const phrase = requireContent(content, "phrase", "subtitle_emphasis");
      return { moduleId: "v4", type, start, end, replacesSubtitle: false, textLayers: [{ text: phrase, x: 0, y: 0, sizePx: 52, weight: 800, color: BAKOM_GOLD }] };
    }
    case "lower_third": {
      const name = requireContent(content, "name", "lower_third");
      const role = requireContent(content, "role", "lower_third");
      return {
        moduleId: "v5",
        type,
        start,
        end,
        replacesSubtitle: true,
        box: { ...BAKOM_V5.block, fill: BAKOM_NAVY, opacity: 0.88, radius: 12 },
        accentBar: { ...BAKOM_V5.accentBar, color: BAKOM_GOLD },
        textLayers: [
          { text: name, x: BAKOM_V5.name.x, y: BAKOM_V5.name.y, sizePx: BAKOM_V5.name.sizePx, weight: 800, color: BAKOM_WHITE },
          { text: role, x: BAKOM_V5.role.x, y: BAKOM_V5.role.y, sizePx: BAKOM_V5.role.sizePx, weight: 500, color: BAKOM_GOLD },
        ],
      };
    }
    case "stat": {
      const value = requireContent(content, "value", "stat");
      const label = requireContent(content, "label", "stat");
      return {
        moduleId: "v6",
        type,
        start,
        end,
        replacesSubtitle: false,
        box: { ...BAKOM_V6.block, fill: BAKOM_BLACK, opacity: 0.88, radius: 16 },
        textLayers: [
          { text: value, x: BAKOM_V6.number.x, y: BAKOM_V6.number.y, sizePx: BAKOM_V6.number.sizePx, weight: 800, color: BAKOM_GOLD },
          { text: label, x: BAKOM_V6.label.x, y: BAKOM_V6.number.y + BAKOM_V6.label.yOffset, sizePx: BAKOM_V6.label.sizePx, weight: 700, color: BAKOM_WHITE },
        ],
      };
    }
    case "quote": {
      const quote = requireContent(content, "quote", "quote");
      const attribution = requireContent(content, "attribution", "quote");
      return {
        moduleId: "v7",
        type,
        start,
        end,
        replacesSubtitle: true,
        box: { x: BAKOM_V7.block.x, y: BAKOM_SUBTITLE.blockBottomEdgeY - 220, w: BAKOM_V7.block.w, h: 220, radius: 16, fill: BAKOM_NAVY, opacity: 0.88 },
        textLayers: [
          { text: quote, x: 90, y: BAKOM_SUBTITLE.blockBottomEdgeY - 180, sizePx: BAKOM_V7.quote.sizePx, weight: 700, color: BAKOM_WHITE },
          { text: attribution, x: 90, y: BAKOM_SUBTITLE.blockBottomEdgeY - 60, sizePx: BAKOM_V7.attribution.sizePx, weight: 700, color: BAKOM_GOLD },
        ],
      };
    }
    case "location": {
      const label = requireContent(content, "label", "location");
      return {
        moduleId: "v8",
        type,
        start,
        end,
        replacesSubtitle: false,
        box: { x: BAKOM_V8.x, y: BAKOM_V8.y, w: 66 + label.length * 18 + 68, h: BAKOM_V8.height, radius: 10, fill: BAKOM_BLACK, opacity: 0.88 },
        accentBar: { x: BAKOM_V8.bar.x, y: BAKOM_V8.y + 14, w: BAKOM_V8.bar.w, h: BAKOM_V8.bar.h, color: BAKOM_GOLD },
        textLayers: [{ text: label, x: BAKOM_V8.x + BAKOM_V8.text.xOffset, y: BAKOM_V8.y + BAKOM_V8.text.yOffset, sizePx: BAKOM_V8.text.sizePx, weight: 700, color: BAKOM_WHITE }],
      };
    }
    case "map": {
      const caption = requireContent(content, "caption", "map");
      return {
        moduleId: "v9",
        type,
        start,
        end,
        replacesSubtitle: false,
        box: { ...BAKOM_V9.block, fill: BAKOM_NAVY, opacity: 0.88, radius: 16 },
        textLayers: [{ text: caption, x: 100, y: 760 + 470 - 62, sizePx: BAKOM_V9.caption.sizePx, weight: 800, color: BAKOM_WHITE }],
      };
    }
    case "end_card":
      return { moduleId: "v10", type, start, end, replacesSubtitle: false, textLayers: [] };
    default:
      throw new Error(`Unsupported BAKOM module type: ${type as string}`);
  }
}

/**
 * Deterministic V6 count-up: linear 0 → final over durationMs (official HTML
 * specifies 700ms with no easing, so linear is recorded as the fallback).
 * Stable at final afterwards. Pure function, frame-renderable.
 */
export function countUpValue(finalValue: number, elapsedMs: number, durationMs: number = BAKOM_V6.countUpMs): number {
  if (!(elapsedMs > 0)) return 0;
  if (elapsedMs >= durationMs) return finalValue;
  return (finalValue * elapsedMs) / durationMs;
}

/**
 * Subtitle suppression windows from an event plan: lower_third and quote
 * own their window (replace_while_active). Hook/end_card never suppress.
 */
export function subtitleSuppressionWindows(
  events: Array<{ type: VisualEventType; start: number; end: number }>,
): Array<{ start: number; end: number }> {
  return events
    .filter((event) => event.type === "lower_third" || event.type === "quote")
    .map((event) => ({ start: event.start, end: event.end }));
}

/**
 * V8 eligibility: location label is mandatory for field footage only.
 * Never fabricate location/date for indoor studio/meeting footage.
 */
export function isLocationRequired(fieldFootage: boolean): boolean {
  return fieldFootage === true;
}

export interface CueWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleCue {
  text: string;
  startSec: number;
  endSec: number;
  words?: CueWord[];
}

export type PresentationMode = "official" | "hybrid";

/** Only official and hybrid exist. Anything else throws. */
export function parsePresentationMode(value: string): PresentationMode {
  if (value === "official" || value === "hybrid") return value;
  throw new Error(`Unsupported presentation mode: ${value}`);
}

export type VisualEventType = "hook" | "lower_third" | "quote" | "end_card";

export interface VisualEvent {
  type: VisualEventType;
  start: number;
  end: number;
  name?: string;
  role?: string;
}

/**
 * One event plan drives both modes. Hook owns 0-3s, lower third owns 3-6.5s,
 * end card appends after speech. Modes differ only in spatial rendering.
 */
export function buildS3EventTimeline(speechDurationSec: number): VisualEvent[] {
  return [
    { type: "hook", start: 0, end: 3.0 },
    {
      type: "lower_third",
      start: 3.0,
      end: 6.5,
      name: "Prabowo Subianto",
      role: "Presiden Republik Indonesia",
    },
    { type: "end_card", start: speechDurationSec, end: speechDurationSec + BAKOM_V10.appendSec },
  ];
}

/** Hybrid framed composition zones (official styling, S2 readability layout). */
export const BAKOM_HYBRID = {
  headlineTop: 120,
  headlineLeft: 66,
  mediaTop: 440,
  mediaLeft: 60,
  mediaSize: 960,
  captionTop: 1476,
} as const;

/**
 * Source credit as separate concepts. sourceName (footage owner) and
 * publisherHandle (publishing account) must never be merged into one model
 * field; sourceDate is optional and must never be fabricated when unavailable.
 */
export interface SourceCreditMeta {
  sourceName: string;
  publisherHandle: string;
  sourceDate?: string;
}

/** Display composition only; the concepts stay separate in code + manifest. */
export function formatSourceCredit(meta: SourceCreditMeta): string {
  return `${meta.sourceName} · ${meta.publisherHandle}`;
}

export interface SpeechWord {
  word: string;
  start: number;
  end: number;
}

export interface CoverageWindow {
  start: number;
  end: number;
  kind: string;
}

export interface SpeechCoverage {
  ok: boolean;
  gaps: Array<{ start: number; end: number; words: string[] }>;
}

/**
 * Fail-closed speech coverage: every word overlapping bounds must overlap at
 * least one window (caption cue or accepted non-subtitle window such as the
 * V1 intro / V5 replace window), within tolerance for boundary snap.
 * Missing cues surface as merged gap intervals with their words; a natural
 * pause carries no words and therefore never fails. Pure function.
 */
export function verifySpeechCoverage(
  words: SpeechWord[],
  windows: CoverageWindow[],
  bounds: { start: number; end: number },
  toleranceSec = 0.25,
): SpeechCoverage {
  const tol = Math.max(0, toleranceSec);
  const uncovered = words.filter(
    (w) =>
      w.end > bounds.start &&
      w.start < bounds.end &&
      !windows.some((win) => w.start < win.end + tol && w.end > win.start - tol),
  );
  if (uncovered.length === 0) return { ok: true, gaps: [] };
  const gaps: Array<{ start: number; end: number; words: string[] }> = [];
  for (const w of uncovered) {
    const last = gaps[gaps.length - 1];
    if (last && w.start <= last.end + tol) {
      last.end = Math.max(last.end, w.end);
      last.words.push(w.word);
    } else {
      gaps.push({ start: w.start, end: w.end, words: [w.word] });
    }
  }
  return { ok: false, gaps };
}

/** Official Title Case for subtitle text (S2 words arrive UPPERMOUTH from CC). */
export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) || part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/**
 * Group ordered words into subtitle cues of at most maxChars characters and
 * maxLines lines. Word order and per-word timing are preserved; only cue
 * grouping changes.
 */
export function wrapCueWords(
  words: CueWord[],
  maxChars: number = BAKOM_SUBTITLE.maxCharsPerLine,
  maxLines: number = BAKOM_SUBTITLE.maxLines,
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let current: CueWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    cues.push({
      text: current.map((w) => w.word).join(" "),
      startSec: current[0].start,
      endSec: current[current.length - 1].end,
    });
    current = [];
  };
  for (const word of words) {
    const candidate = current.length === 0 ? word.word : `${current.map((w) => w.word).join(" ")} ${word.word}`;
    if (current.length > 0 && (candidate.length > maxChars || countWrappedLines([...current, word], maxChars) > maxLines)) flush();
    current.push(word);
  }
  flush();
  return cues;
}

/** Greedy line count for a word list at maxChars (mirrors wrapCueWords). */
export function countWrappedLines(words: CueWord[], maxChars: number): number {
  let lines = 0;
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word.word}` : word.word;
    if (current && candidate.length > maxChars) {
      lines++;
      current = word.word;
    } else {
      current = candidate;
    }
  }
  if (current) lines++;
  return lines;
}

/** Attach each cue's own words (used for word-boundary splits). */
export function cueWords(cue: SubtitleCue, words: CueWord[]): CueWord[] {
  if (cue.words && cue.words.length > 0) return cue.words;
  return words.filter((w) => w.start >= cue.startSec - 1e-6 && w.end <= cue.endSec + 1e-6);
}

/** Raw whisper.cpp item text. A leading space marks a word boundary; items
 * without one continue the previous word (re+aksi = reaksi). */
export interface RawWord {
  text: string;
  start: number;
  end: number;
}

export interface JoinedWord {
  word: string;
  start: number;
  end: number;
}

const ALNUM_END = /[\p{L}\p{N}]$/u;
const ALNUM_START = /^[\p{L}\p{N}]/u;

/** Join subword fragments into real words via raw boundary spaces. Pure. */
export function reconstructWords(items: RawWord[]): JoinedWord[] {
  const out: JoinedWord[] = [];
  for (const item of items) {
    const text = item.text;
    if (!text || !text.trim()) continue;
    const last = out[out.length - 1];
    if (last && !text.startsWith(" ") && !text.startsWith("\t") && ALNUM_END.test(last.word) && ALNUM_START.test(text.trimStart())) {
      last.word += text.trimStart();
      last.end = item.end;
    } else {
      out.push({ word: text.trim(), start: item.start, end: item.end });
    }
  }
  return out;
}

export interface TimedCue {
  text: string;
  start: number;
  end: number;
  provenance: "accepted" | "derived";
  skippedTokens?: string[];
  spellingVariants?: string[];
}

const normToken = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Time accepted cue texts against true word timing, then cover remaining
 * spoken runs with transcript-derived cues. Character-sequential matching
 * absorbs subword fragmentation and colloquial joins (disana = di+sana).
 * Accepted texts keep their wording; spans come from physical word times.
 * A cue whose first token is absent may skip exactly one leading token
 * (flagged, never silent); anything else unmatched fails closed. Untiled
 * lexical runs become Title Case cues (transcription, never invention).
 */
export function buildTimedCues(acceptedTexts: string[], items: RawWord[]): TimedCue[] {
  const words = reconstructWords(items);
  const lexical = words.filter((w) => normToken(w.word).length > 0);
  const hay = lexical.map((w) => normToken(w.word)).join("");
  const cum: number[] = [];
  let acc = 0;
  for (const w of lexical) {
    cum.push(acc);
    acc += normToken(w.word).length;
  }
  const spanFor = (from: number, to: number): { start: number; end: number } => {
    let first = lexical.length - 1;
    let last = 0;
    for (let i = 0; i < lexical.length; i++) {
      const s = cum[i];
      const e = s + normToken(lexical[i].word).length;
      if (e > from) first = Math.min(first, i);
      if (s < to) last = Math.max(last, i);
    }
    return { start: lexical[first].start, end: lexical[last].end };
  };
  const findFrom = (needle: string, searchFrom: number, prevEnd: number): number => {
    let at = hay.indexOf(needle, searchFrom);
    while (at !== -1) {
      if (at + needle.length > prevEnd) return at;
      at = hay.indexOf(needle, at + 1);
    }
    return -1;
  };
  interface Match { start: number; end: number; text: string; provenance: "accepted"; skippedTokens?: string[]; spellingVariants?: string[] }
  const matches: Match[] = [];
  let cursor = 0;
  let prevEnd = -1;
  let prevStart = 0;
  const tokenBounds = (tokens: string[]): Array<{ start: number; end: number }> => {
    const out: Array<{ start: number; end: number }> = [];
    let at = 0;
    for (const token of tokens) {
      out.push({ start: at, end: at + token.length });
      at += token.length;
    }
    return out;
  };
  for (const raw of acceptedTexts) {
    const tokens = raw.split(/\s+/).map(normToken).filter(Boolean);
    if (tokens.length === 0) throw new Error(`accepted cue has no lexical content: ${JSON.stringify(raw)}`);
    // CC-derived texts occasionally carry discourse particles with no audio
    // behind them, or standard spellings of colloquial pronunciations.
    // At most one unmatched token per cue is skipped (flagged), or one
    // single-character spelling variant is accepted (flagged); anything
    // beyond that fails closed.
    const bounds = tokenBounds(tokens);
    let needle = tokens.join("");
    let skipped: string[] = [];
    let variants: string[] = [];
    let at = findFrom(needle, prevStart, prevEnd);
    if (at === -1) {
      outer: for (let s = Math.max(prevStart, 0); s + needle.length <= hay.length; s++) {
        let mismatches = 0;
        let mismatchAt = -1;
        for (let i = 0; i < needle.length; i++) {
          if (hay[s + i] !== needle[i]) {
            mismatches++;
            mismatchAt = i;
            if (mismatches > 1) break;
          }
        }
        if (mismatches === 1 && s + needle.length > prevEnd) {
          const token = bounds.find((b) => mismatchAt >= b.start && mismatchAt < b.end);
          const spoken = token ? hay.slice(s + token.start, s + token.end) : hay[s + mismatchAt];
          variants = [`${tokens[bounds.indexOf(token!)]}→${spoken}`];
          at = s;
          break outer;
        }
      }
    }
    if (at === -1 && tokens.length > 1) {
      for (let drop = 0; drop < tokens.length && at === -1; drop++) {
        const kept = tokens.filter((_, i) => i !== drop);
        const cand = findFrom(kept.join(""), prevStart, prevEnd);
        if (cand !== -1) {
          at = cand;
          needle = kept.join("");
          skipped = [tokens[drop]];
        }
      }
    }
    if (at === -1) throw new Error(`accepted cue unmatched in true words: ${JSON.stringify(raw)}`);
    const span = spanFor(at, at + needle.length);
    matches.push({ start: span.start, end: span.end, text: raw, provenance: "accepted", ...(skipped.length > 0 ? { skippedTokens: skipped } : {}), ...(variants.length > 0 ? { spellingVariants: variants } : {}) });
    cursor = at;
    prevEnd = at + needle.length;
    prevStart = at;
  }
  void cursor;
  // Accepted texts may share boundary words (e.g. "Yang" closing one cue and
  // opening the next). The physical word exists once: assign it to the first
  // claimant in time order and clip followers to that boundary. Clipped edges
  // stay true word boundaries; a collapsed span fails closed.
  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].start < matches[i - 1].end - 1e-9) {
      matches[i] = { ...matches[i], start: matches[i - 1].end };
      if (matches[i].start >= matches[i].end - 1e-9) {
        throw new Error(`accepted cue timing collapsed after de-overlap: ${JSON.stringify(matches[i].text)}`);
      }
    }
  }
  const consumed: Array<{ start: number; end: number }> = matches.map((m) => ({ start: m.start, end: m.end }));
  const covered = (idx: number): boolean =>
    consumed.some((c) => lexical[idx].start < c.end - 1e-6 && lexical[idx].end > c.start + 1e-6);
  const out: TimedCue[] = matches.map((m) => ({ text: m.text, start: m.start, end: m.end, provenance: m.provenance as "accepted", ...(m.skippedTokens ? { skippedTokens: m.skippedTokens } : {}), ...(m.spellingVariants ? { spellingVariants: m.spellingVariants } : {}) }));
  let run: JoinedWord[] = [];
  const flush = () => {
    if (run.length === 0) return;
    for (const cue of wrapCueWords(run.map((w) => ({ word: w.word, start: w.start, end: w.end })))) {
      out.push({ text: toTitleCase(cue.text), start: cue.startSec, end: cue.endSec, provenance: "derived" });
    }
    run = [];
  };
  for (let i = 0; i < lexical.length; i++) {
    if (covered(i)) flush();
    else run.push(lexical[i]);
  }
  flush();
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

/** Drop cues overlapping any suppression window (hook ownership, V5 no-stack rule). */
export function suppressCuesDuring(
  cues: SubtitleCue[],
  windows: Array<{ start: number; end: number }>,
): SubtitleCue[] {
  return cues.filter(
    (cue) => !windows.some((window) => cue.startSec < window.end && cue.endSec > window.start),
  );
}

/**
 * Enforce official cue durations: extend short cues (clamped to next cue),
 * split long cues AT ALIGNED WORD BOUNDARIES. Word timing itself is never
 * altered, and no synthetic midpoint timing is ever invented: the split
 * falls on the end/start of real words, falling back to midpoint only when
 * word timings are unavailable.
 */
export function enforceCueDurations(
  cues: SubtitleCue[],
  minSec: number = BAKOM_SUBTITLE.minDurationSec,
  maxSec: number = BAKOM_SUBTITLE.maxDurationSec,
  words: CueWord[] = [],
): SubtitleCue[] {
  const out: SubtitleCue[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const nextStart = i + 1 < cues.length ? cues[i + 1].startSec : Number.POSITIVE_INFINITY;
    const end = Math.min(Math.max(cue.endSec, cue.startSec + minSec), nextStart);
    if (end - cue.startSec <= maxSec || cue.text.split(/\s+/).length <= 1) {
      out.push({ ...cue, endSec: end });
      continue;
    }
    const tokens = cue.text.split(/\s+/);
    const half = Math.ceil(tokens.length / 2);
    const cueWordList = cueWords(cue, words);
    // Word-boundary split only: never invent a synthetic midpoint. Without
    // aligned words the cue stays whole (duration rule yields to timing truth).
    if (cueWordList.length !== tokens.length || half <= 0 || half >= cueWordList.length) {
      out.push({ ...cue, endSec: end });
      continue;
    }
    const firstEnd = cueWordList[half - 1].end;
    const secondStart = Math.max(firstEnd, cueWordList[half].start);
    out.push({ text: tokens.slice(0, half).join(" "), startSec: cue.startSec, endSec: firstEnd });
    out.push({ text: tokens.slice(half).join(" "), startSec: secondStart, endSec: end });
  }
  return out;
}

/** Fit headline size in [min,max] so the first three words fit maxWidth. */
export function fitHeadlineSize(
  text: string,
  maxWidth: number,
  measure: (text: string, sizePx: number) => number,
  min: number = BAKOM_HOOK.fitMin,
  max: number = BAKOM_HOOK.fitMax,
): number {
  const probe = text.split(/\s+/).slice(0, 3).join(" ");
  let size = max;
  while (size > min && measure(probe, size) > maxWidth) size--;
  return size;
}

/**
 * HTML subtitle text-top for a cue with lineCount lines.
 * HTML subtitle(): box height = lines * 58 + pad * 1.6 pinned to bottom edge
 * y 1500, text top = box top + pad * 0.8. Single line -> 1418.
 */
export function layoutSubtitleTextTopY(lineCount: number): number {
  const lines = Math.max(1, Math.floor(lineCount));
  const boxH = lines * BAKOM_SUBTITLE.leadingPx + Math.round(BAKOM_SUBTITLE.padPx * 1.6);
  return BAKOM_SUBTITLE.blockBottomEdgeY - boxH + Math.round(BAKOM_SUBTITLE.padPx * 0.8);
}

export interface HookBlockLayout {
  box: { x: number; y: number; w: number; h: number };
  textX: number;
  textTopY: number;
  lead: number;
  lineColors: string[];
}

/**
 * HTML V1 hook block geometry for already-wrapped lines at a fitted size.
 * HTML V1: block height = lines * (size - 3) + 96 pinned to bottom edge 1500,
 * text at x 90 / block top + 40, first line gold with the rest grey.
 * Line wrapping and fitting stay with the caller (see fitHeadlineSize and
 * wrapByMeasure); this function owns only the geometry truth.
 */
export function layoutHookBlock(lines: string[], sizePx: number): HookBlockLayout {
  const lead = sizePx - 3;
  const boxH = lines.length * lead + BAKOM_HEADLINE.blockBottomPad;
  const boxY = BAKOM_HEADLINE.blockBottomEdgeY - boxH;
  return {
    box: { x: 66, y: boxY, w: 948, h: boxH },
    textX: BAKOM_HEADLINE.textX,
    textTopY: boxY + BAKOM_HEADLINE.textTopPad,
    lead,
    lineColors: lines.map((_, index) =>
      index === 0 ? BAKOM_HEADLINE.firstLineColor : BAKOM_HEADLINE.restColor,
    ),
  };
}

/**
 * HTML V1 gold rule below the hook text: thickness 5, gap 10 under the last
 * baseline row, width = longest rendered line capped at the fit width.
 */
export function layoutHookRule(
  longestLineWidthPx: number,
  textTopY: number,
  lineCount: number,
  lead: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: BAKOM_HEADLINE.textX,
    y: textTopY + lineCount * lead + BAKOM_HEADLINE.ruleGap,
    w: Math.min(Math.round(longestLineWidthPx), BAKOM_HEADLINE.fitWidthPx),
    h: BAKOM_HEADLINE.ruleThickness,
  };
}

/**
 * HTML measured-width wrap: greedy by rendered width (canvas measureText),
 * capped at maxLines exactly like HTML wrap(...).slice(0, N).
 */
export function wrapByMeasure(
  text: string,
  maxWidthPx: number,
  measure: (text: string) => number,
  maxLines: number = BAKOM_HEADLINE.maxLines,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, Math.max(1, maxLines));
}

/**
 * HTML-exact emphasis split: case-sensitive first occurrence per line, mirroring
 * HTML subtitle() String.indexOf semantics. (The ASS writer's case-insensitive
 * applySubtitleEmphasis is a separate legacy path and is intentionally untouched.)
 */
export function splitEmphasis(
  line: string,
  phrase: string,
): { pre: string; hi: string; post: string } | null {
  const clean = phrase.trim();
  if (!clean) return null;
  const index = line.indexOf(clean);
  if (index === -1) return null;
  return {
    pre: line.slice(0, index),
    hi: line.slice(index, index + clean.length),
    post: line.slice(index + clean.length),
  };
}

function assColor(hex: string, alpha01: number): string {
  const clean = hex.replace("#", "");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const alpha = Math.round((1 - alpha01) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${alpha}${b}${g}${r}`;
}

/**
 * Apply V4 single-phrase gold emphasis to Title Case cue text. Returns text
 * with libass primary-colour overrides around the FIRST case-insensitive
 * occurrence only — at most one highlighted phrase per video. No geometry or
 * timing change; same V3 subtitle system.
 */
export function applySubtitleEmphasis(cueText: string, phrase: string): string {
  const clean = phrase.trim();
  if (!clean) return cueText;
  const index = cueText.toLowerCase().indexOf(clean.toLowerCase());
  if (index === -1) return cueText;
  const before = cueText.slice(0, index);
  const match = cueText.slice(index, index + clean.length);
  const after = cueText.slice(index + clean.length);
  return `${before}{\\1c${assColor(BAKOM_GOLD, 1)}}${match}{\\1c${assColor(BAKOM_WHITE, 1)}}${after}`;
}

/**
 * Deterministic official-style ASS writer. BorderStyle 3 gives the fitted
 * navy box; Alignment 2 bottom-center with MarginV pins its bottom edge at
 * the official block bottom (1500). No karaoke, no restyle. Optional
 * `emphasis` renders V4 gold on the first matching phrase only.
 */
export function buildBakomAss(
  cues: SubtitleCue[],
  outputPath: string,
  emphasis?: string,
): Result<string> {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const marginV = BAKOM_CANVAS.height - BAKOM_SUBTITLE.blockBottomEdgeY;
    const header = `[Script Info]
Title: BAKOM Official Subtitles
ScriptType: v4.00+
PlayResX: ${BAKOM_CANVAS.width}
PlayResY: ${BAKOM_CANVAS.height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Nunito Sans,${BAKOM_SUBTITLE.sizePx},${assColor(BAKOM_WHITE, 1)},${assColor(BAKOM_GOLD, 1)},${assColor(BAKOM_BLACK, 1)},${assColor(BAKOM_NAVY, BAKOM_SUBTITLE.blockOpacity)},-1,0,0,0,100,100,0,0,3,0,0,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const fmt = (sec: number): string => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const cs = Math.floor((sec % 1) * 100);
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    };
    const titled = cues.map((cue) => toTitleCase(cue.text));
    const emphasisIndex =
      emphasis && emphasis.trim()
        ? titled.findIndex((text) => text.toLowerCase().includes(emphasis.trim().toLowerCase()))
        : -1;
    const events = titled.map((text, index) => {
      const body = index === emphasisIndex ? applySubtitleEmphasis(text, emphasis!.trim()) : text;
      const cue = cues[index];
      return `Dialogue: 0,${fmt(cue.startSec)},${fmt(cue.endSec)},Default,,0,0,0,,{\\fad(${BAKOM_SUBTITLE.fadeInMs},${BAKOM_SUBTITLE.fadeOutMs})}${body}`;
    });
    fs.writeFileSync(outputPath, `${header}${events.join("\n")}\n`, "utf-8");
    return { success: true, data: outputPath };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "ASS write failed" };
  }
}
