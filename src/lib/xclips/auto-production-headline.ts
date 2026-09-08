import type { AccountPreset } from "@/lib/xclips/auto-production-types";
import { getBakomLayout } from "@/lib/xclips/auto-production-bakom-layout";

export interface HeadlineLayout {
  text: string;
  lines: string[];
  fontSizePx: number;
  maxWidthPx: number;
  lineSpacingPx: number;
  truncated: boolean;
}

const MIN_HEADLINE_FONT_SIZE = 28;
const HEADLINE_GLYPH_WIDTH = 0.62;
const HEADLINE_LINE_SPACING = 8;
const WEAK_LINE_END_WORDS = new Set(["dan", "atau", "yang", "untuk", "dari", "dengan"]);

function estimateLineWidth(text: string, fontSizePx: number): number {
  return [...text].reduce((width, char) => {
    const factor = char === " " ? 0.32 : /[ilI.,'():]/.test(char) ? 0.3 : HEADLINE_GLYPH_WIDTH;
    return width + factor * fontSizePx;
  }, 0);
}

function wrapHeadline(text: string, fontSizePx: number, maxWidthPx: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimateLineWidth(candidate, fontSizePx) > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function chooseBalancedWrap(words: string[], fontSizePx: number, maxWidthPx: number, maxLines: number): string[] {
  const candidates: string[][] = [];

  const visit = (start: number, lines: string[]): void => {
    if (lines.length === maxLines - 1) {
      const last = words.slice(start).join(" ");
      if (last && estimateLineWidth(last, fontSizePx) <= maxWidthPx) candidates.push([...lines, last]);
      return;
    }
    for (let end = start + 1; end < words.length; end += 1) {
      const line = words.slice(start, end).join(" ");
      if (estimateLineWidth(line, fontSizePx) > maxWidthPx) break;
      visit(end, [...lines, line]);
    }
  };

  visit(0, []);
  if (candidates.length === 0) return wrapHeadline(words.join(" "), fontSizePx, maxWidthPx);

  return candidates.sort((a, b) => {
    const score = (lines: string[]) => {
      const widths = lines.map((line) => estimateLineWidth(line, fontSizePx));
      const average = widths.reduce((sum, width) => sum + width, 0) / widths.length;
      const variance = widths.reduce((sum, width) => sum + (width - average) ** 2, 0);
      const orphanPenalty = lines.at(-1)!.split(" ").length === 1 ? maxWidthPx ** 2 : 0;
      const weakLineEndPenalty = lines
        .slice(0, -1)
        .reduce((penalty, line) => WEAK_LINE_END_WORDS.has(line.split(" ").at(-1)!.toLowerCase()) ? penalty + maxWidthPx ** 2 : penalty, 0);
      return variance + orphanPenalty + weakLineEndPenalty;
    };
    return score(a) - score(b);
  })[0];
}

export function fitAutoProductionHeadline(
  headline: string,
  preset: AccountPreset,
): HeadlineLayout {
  const layout = getBakomLayout(preset);
  const maxWidthPx = layout.headlineMaxWidth;
  let fontSizePx = Math.max(MIN_HEADLINE_FONT_SIZE, preset.headlineStyle.fontSizePx);
  const words = headline.trim().split(/\s+/).filter(Boolean);
  let lines = wrapHeadline(headline, fontSizePx, maxWidthPx);

  while (fontSizePx > MIN_HEADLINE_FONT_SIZE && lines.some((line) => estimateLineWidth(line, fontSizePx) > maxWidthPx)) {
    fontSizePx -= 1;
    lines = wrapHeadline(headline, fontSizePx, maxWidthPx);
  }

  if (lines.length > 1 && lines.length <= layout.headlineMaxLines) {
    lines = chooseBalancedWrap(words, fontSizePx, maxWidthPx, lines.length);
  }

  let truncated = false;
  if (lines.length > layout.headlineMaxLines) {
    truncated = true;
    lines = lines.slice(0, layout.headlineMaxLines);
    let last = lines[lines.length - 1].trim();
    while (last && estimateLineWidth(`${last}...`, fontSizePx) > maxWidthPx) {
      last = last.split(/\s+/).slice(0, -1).join(" ");
    }
    lines[lines.length - 1] = `${last}...`;
  }

  return {
    text: lines.join("\\n"),
    lines,
    fontSizePx,
    maxWidthPx,
    lineSpacingPx: layout.headlineLineSpacing || HEADLINE_LINE_SPACING,
    truncated,
  };
}
