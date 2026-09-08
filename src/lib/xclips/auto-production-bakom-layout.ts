import type { AccountPreset } from "@/lib/xclips/auto-production-types";

export interface BakomLayout {
  canvasWidth: number;
  canvasHeight: number;
  safeMarginX: number;
  headlineTop: number;
  headlineMaxWidth: number;
  headlineMaxLines: number;
  headlineAreaHeight: number;
  headlineFontSize: number;
  headlineColor: string;
  headlineAccentColor: string;
  headlineLineSpacing: number;
  mediaTop: number;
  mediaWidth: number;
  mediaHeight: number;
  captionTop: number;
  sourceBottomOffset: number;
  sourceFontSize: number;
  brandingSlot: { x: number; y: number; width: number; height: number };
}

export type SourceOrientation = "landscape" | "portrait" | "square" | "other";
export type SourceTransformStrategy = "default" | "wawancara_1_frame_utuh";
export const SUBTITLE_BOTTOM_MARGIN_IN_BROLL = 90;
export const HEADLINE_ACCENT_BAR_WIDTH = 12;
export const HEADLINE_ACCENT_BAR_GAP = 12;
export const HEADLINE_ENTER_DURATION_SEC = 0.3;
export const HEADLINE_ENTER_OFFSET_Y = 12;

export interface SourceTransformConfig {
  fitMode: "cover" | "contain";
  cropAnchor: "center";
  zoomLevel: number;
}

export const BAKOM_LAYOUT: Omit<BakomLayout, "headlineFontSize" | "headlineColor"> = {
  canvasWidth: 1080, canvasHeight: 1920, safeMarginX: 48,
  headlineTop: 120, headlineMaxWidth: 984, headlineMaxLines: 3,
  headlineAreaHeight: 220, headlineAccentColor: "#D71920", headlineLineSpacing: 10,
  mediaTop: 360, mediaWidth: 1080, mediaHeight: 1080,
  captionTop: 1476, sourceBottomOffset: 150, sourceFontSize: 28,
  brandingSlot: { x: 872, y: 120, width: 160, height: 72 },
};

export const SOURCE_TRANSFORM_PRESETS = {
  news_talking_head: { fitMode: "cover", cropAnchor: "center", zoomLevel: 1.2 },
  monolog_1_wajah: { fitMode: "cover", cropAnchor: "center", zoomLevel: 1.15 },
  wawancara_1_frame_utuh: { fitMode: "contain", cropAnchor: "center", zoomLevel: 1 },
  broll_tanpa_wajah: { fitMode: "cover", cropAnchor: "center", zoomLevel: 1 },
  default: { fitMode: "cover", cropAnchor: "center", zoomLevel: 1 },
} as const;
export type ContentType = keyof typeof SOURCE_TRANSFORM_PRESETS;

export function getBakomLayout(preset: AccountPreset): BakomLayout {
  return {
    ...BAKOM_LAYOUT,
    headlineFontSize: preset.headlineStyle.fontSizePx,
    headlineColor: preset.headlineStyle.color,
  };
}

export function resolveSourceOrientation(width: number, height: number): SourceOrientation {
  if (!(width > 0) || !(height > 0)) return "other";
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

export function resolveSourceTransform(
  strategy: SourceTransformStrategy = "default",
  sourceOrientation: SourceOrientation = "other",
  contentType: ContentType = "default",
): SourceTransformConfig {
  const selected = strategy === "wawancara_1_frame_utuh"
    ? SOURCE_TRANSFORM_PRESETS.wawancara_1_frame_utuh
    : SOURCE_TRANSFORM_PRESETS[contentType] || SOURCE_TRANSFORM_PRESETS.default;
  return { ...selected };
}

export function buildSourceTransformFilter(
  inputLabel: string,
  outputLabel: string,
  layout: BakomLayout,
  targetWidth: number,
  targetHeight: number,
  strategy: SourceTransformStrategy = "default",
  sourceWidth?: number,
  sourceHeight?: number,
  contentType: ContentType = "default",
): string {
  const sourceOrientation = resolveSourceOrientation(sourceWidth || 0, sourceHeight || 0);
  const transform = resolveSourceTransform(strategy, sourceOrientation, contentType);
  const scaleMode = transform.fitMode === "contain" ? "decrease" : "increase";
  const scaledWidth = Math.round(layout.mediaWidth * transform.zoomLevel);
  const scaledHeight = Math.round(layout.mediaHeight * transform.zoomLevel);
  const source = `${inputLabel}scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=${scaleMode}`;
  const fit = transform.fitMode === "contain"
    ? `pad=${layout.mediaWidth}:${layout.mediaHeight}:(ow-iw)/2:(oh-ih)/2:black`
    : `crop=${layout.mediaWidth}:${layout.mediaHeight}:(iw-ow)/2:(ih-oh)/2`;
  return `${source},${fit},pad=${targetWidth}:${targetHeight}:0:${layout.mediaTop}:black${outputLabel}`;
}
