import { z } from "zod";

// ============================================================
// Core Data Models & Schemas
// ============================================================

export const WordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(), // in seconds
  end: z.number(), // in seconds
  confidence: z.number().optional().default(1.0),
  isFiller: z.boolean().optional().default(false),
  excluded: z.boolean().optional().default(false),
});

export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const SourceTypeSchema = z.enum(["local", "youtube", "tiktok", "instagram"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const LayoutModeSchema = z.enum(["center_crop", "blur_bg", "split_screen"]);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const ClipStatusSchema = z.enum(["draft", "queued", "rendering", "completed", "failed"]);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

export const SubtitlePresetSchema = z.enum([
  "plain",
  "hormozi",
  "neon",
  "clean_box",
  "minimal",
  "custom",
  "ali",
  "bold_yellow",
  "devin",
  "storyteller",
  "retro_glow",
  "cinematic",
  "cyberpunk",
  "midnight",
  "fire_red",
  "emerald_glow",
  "comic_pop",
  "nordic_minimal",
  "synthwave",
]);
export type SubtitlePreset = z.infer<typeof SubtitlePresetSchema>;

export const SubtitleStyleSchema = z.object({
  enabled: z.boolean().default(true),
  preset: SubtitlePresetSchema.default("plain"),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(42),
  primaryColor: z.string().default("#FFFFFF"), // CSS / UI Hex
  secondaryColor: z.string().optional(),
  highlightColor: z.string().default("#FACC15"), // Yellow hex for active karaoke word
  outlineColor: z.string().default("#000000"), // Outline color
  outlineWidth: z.number().default(2), // Outline width (0-6)
  boxColor: z.string().default("#000000"), // Background box color
  boxOpacity: z.number().default(0.7), // Box opacity (0-1)
  allCaps: z.boolean().default(false),
  textCase: z.enum(["uppercase", "capitalize", "lowercase"]).optional().default("uppercase"),
  autoEmoji: z.boolean().default(false),
  positionY: z.number().default(80), // Percentage from top (e.g. 80%)
  karaokeEnabled: z.boolean().default(true),
});

export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;


export interface XclipsProject {
  id: string;
  name: string;
  sourceType: SourceType;
  sourcePath: string;
  durationSec: number;
  width: number;
  height: number;
  frameRate: number;
  isVfr: boolean;
  normalizedPath?: string;
  audioPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface XclipsTranscript {
  id: string;
  projectId: string;
  language: string;
  rawText: string;
  srtContent: string;
  words: WordTimestamp[];
  createdAt: string;
}

export interface XclipsClip {
  id: string;
  projectId: string;
  transcriptId?: string;
  title: string;
  hookText: string;
  viralScore: number;
  startSec: number;
  endSec: number;
  layoutMode: LayoutMode;
  panOffsetX: number; // -1.0 to 1.0
  subtitleStyle: SubtitleStyle;
  removeFillers: boolean;
  removeSilence: boolean;
  customCuts: Array<{ start: number; end: number }>;
  status: ClipStatus;
  outputPath?: string;
  renderError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  isVfr: boolean;
  hasAudio: boolean;
  audioCodec?: string;
  videoCodec?: string;
}

export interface FillerSegment {
  startSec: number;
  endSec: number;
  text: string;
  type: "filler" | "silence";
}

export interface RenderJob {
  id: string;
  clipId: string;
  projectId: string;
  progress: number;
  status: ClipStatus;
  error?: string;
  outputPath?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================
// AI Multi-Provider & Autoclip Narrative Settings
// ============================================================

export const AiProviderTypeSchema = z.enum(["kieai", "gemini", "openai", "anthropic", "openai_compatible"]);
export type AiProviderType = z.infer<typeof AiProviderTypeSchema>;

export const XclipsAiSettingsSchema = z.object({
  provider: AiProviderTypeSchema.default("kieai"),
  baseUrl: z.string().default("https://api.kie.ai/gemini-3-6-flash-openai/v1"),
  apiKey: z.string().default(""),
  apiKeys: z
    .object({
      kieai: z.string().default(""),
      gemini: z.string().default(""),
      openai: z.string().default(""),
      anthropic: z.string().default(""),
      openai_compatible: z.string().default(""),
    })
    .default({
      kieai: "",
      gemini: "",
      openai: "",
      anthropic: "",
      openai_compatible: "",
    }),
  transcribeModel: z.string().default("gemini-3-7-flash"),
  highlightModel: z.string().default("gemini-3-7-flash"),
  // Autoclip Narrative Options
  topicPrompt: z.string().optional().default(""),
  targetDuration: z.enum(["short", "standard", "long"]).default("standard"), // short: 30-45s, standard: 45-75s, long: 75-120s
  maxClipsCount: z.number().min(1).max(20).default(5),
  strictBoundary: z.boolean().default(true),
});

export type XclipsAiSettings = z.infer<typeof XclipsAiSettingsSchema>;

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
