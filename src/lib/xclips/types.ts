import { z } from "zod";

// ============================================================
// Core Data Models & Schemas
// ============================================================

export const WordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().optional().default(1.0),
  isFiller: z.boolean().optional().default(false),
  excluded: z.boolean().optional().default(false),
  breakAfter: z.boolean().optional(),
});

export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const SourceTypeSchema = z.enum(["local", "youtube", "tiktok", "instagram", "x", "pinterest", "web_media"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const AspectRatioSchema = z.enum(["9:16", "1:1", "4:5", "16:9"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const LayoutModeSchema = z.enum(["center_crop", "blur_bg", "split_screen"]);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const ClipStatusSchema = z.enum(["draft", "queued", "rendering", "completed", "failed"]);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

export const SubtitlePresetSchema = z.enum([
  "plain",
  "hormozi",
  "beast",
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
  fontSize: z.number().min(0).max(999).default(44),
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
  positionX: z.number().optional().default(50), // Percentage from left (0-100%, 50% = center)
  positionY: z.number().optional().default(80), // Percentage from top (0-100%, 80% = lower-third)
  rotation: z.number().optional().default(0), // Rotation angle in degrees (-360 to 360)
  boxWidthMode: z.enum(["auto", "custom"]).optional().default("custom"),
  boxWidth: z.number().optional().default(76), // Width percentage (20-100%)
  scaleX: z.number().optional().default(1),
  scaleY: z.number().optional().default(1),
  karaokeEnabled: z.boolean().default(true),
});

export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;


export interface MasterStyleConfig {
  aspectRatio?: AspectRatio;
  layoutMode?: LayoutMode;
  panOffsetX?: number;
  videoScale?: number;
  videoPanX?: number;
  videoPanY?: number;
  videoRotation?: number;
  subtitleStyle?: SubtitleStyle;
}

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
  masterStyleJson?: string;
  masterStyle?: MasterStyleConfig;
  /** Original platform metadata (yt-dlp info: title, channel, description, url, etc.) */
  sourceMeta?: {
    videoId?: string;
    title?: string;
    channel?: string;
    uploader?: string;
    description?: string;
    webpageUrl?: string;
    thumbnail?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface XclipsTranscript {
  id: string;
  projectId: string;
  label?: string;
  sourceType?: "youtube_cc" | "ai" | "custom";
  isActive?: boolean;
  language: string;
  rawText: string;
  srtContent: string;
  words: WordTimestamp[];
  createdAt: string;
  updatedAt?: string;
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
  aspectRatio?: AspectRatio;
  layoutMode: LayoutMode;
  panOffsetX: number;
  videoScale?: number;
  videoPanX?: number;
  videoPanY?: number;
  videoRotation?: number;
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
  createdAt?: string;
  updatedAt?: string;
  resolution?: string;
  bitrate?: string;
  format?: string;
}

// ============================================================
// AI Multi-Provider & Autoclip Narrative Settings
// ============================================================

export const AiProviderTypeSchema = z.enum(["kieai", "gemini", "openai", "anthropic"]);
export type AiProviderType = z.infer<typeof AiProviderTypeSchema>;
export const CustomProviderProtocolSchema = z.enum(["openai-compatible", "claude-compatible"]);
export type CustomProviderProtocol = z.infer<typeof CustomProviderProtocolSchema>;
export const CustomProviderSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), protocol: CustomProviderProtocolSchema,
  baseUrl: z.string().url(), apiKey: z.string().min(1), plannerModel: z.string().min(1),
  visionModel: z.string().optional(), imageModel: z.string().optional(),
  apiKeyConfigured: z.boolean().optional(),
});
export type CustomProvider = z.infer<typeof CustomProviderSchema>;

export const HOOK_FORMULAS = [
  { id: "auto", name: "Auto (AI Best Fit)", sub: "Smart Virality & Retention Engine", emotion: "Optimal for All Topics" },
  { id: "none", name: "No Specific Formula", sub: "Natural Context Segments", emotion: "Neutral / Documentary" },
  { id: "01_myth_buster", name: "01. Myth Buster", sub: "Common Myths Debunked", emotion: "Enlightened, Surprised" },
  { id: "02_data_speaks", name: "02. Data Speaks", sub: "Eye-Opening Numbers & Stats", emotion: "Amazed, Conscious" },
  { id: "03_hidden_right", name: "03. Hidden Right", sub: "Overlooked Rights & Opportunities", emotion: "Relieved, Empowered" },
  { id: "04_silent_risk", name: "04. Silent Risk", sub: "Hidden Dangers & Warnings", emotion: "Alert, Concerned" },
  { id: "05_speed_proof", name: "05. Speed Proof", sub: "Remarkable Rapid Progress", emotion: "Positively Surprised, Impressed" },
  { id: "06_local_hero", name: "06. Local Hero", sub: "Small Grassroots, Massive Impact", emotion: "Proud, Inspired" },
  { id: "07_little_known", name: "07. Little-Known", sub: "Behind-the-Scenes Insights", emotion: "Enlightened, Curious" },
  { id: "08_plot_twist", name: "08. Plot Twist", sub: "Unexpected Contrarian Truth", emotion: "Shocked, Understanding" },
  { id: "09_honest_talk", name: "09. Honest Talk", sub: "Candid Confession & Solution", emotion: "Trusting, Relatable" },
  { id: "10_not_your_fault", name: "10. Not Your Fault", sub: "Empathetic Clarity & Guidance", emotion: "Relieved, Supported" },
  { id: "11_step_by_step", name: "11. Step by Step", sub: "Actionable Practical Walkthrough", emotion: "Supported, Empowered" },
  { id: "12_surprising_link", name: "12. Surprising Link", sub: "Unexpected Analogy & Comparison", emotion: "Reframed, Intrigued" },
  { id: "13_near_future", name: "13. Near Future", sub: "Upcoming Roadmap & Vision", emotion: "Hopeful, Enthusiastic" },
  { id: "14_are_you_in", name: "14. Are You In?", sub: "Direct Audience Qualification", emotion: "Relevant, Self-Aware" },
  { id: "15_ripple_effect", name: "15. Ripple Effect", sub: "Domino Effect of Single Action", emotion: "Motivated, Empowered" },
] as const;

export type HookFormulaId = typeof HOOK_FORMULAS[number]["id"];

export const REQUESTY_LIGHT_MODELS = [
  { id: "muse-glimmer-30b", name: "Muse Glimmer 30B (Default)", desc: "Balanced & fast lightweight helper" },
  { id: "gemma-4-31b-it", name: "Gemma 4 31B IT", desc: "Multilingual & structured topic synthesis" },
  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", desc: "Advanced reasoning & high-retention cues" },
] as const;

export type RequestyLightModelId = typeof REQUESTY_LIGHT_MODELS[number]["id"];

// ============================================================
// AI Provider Model Catalog
// ============================================================

export interface AiModelDefinition {
  id: string;
  name: string;
  provider: AiProviderType;
  desc?: string;
  recommended?: boolean;
  isTranscribe?: boolean;
}

export const AI_PROVIDER_MODELS: Record<AiProviderType, AiModelDefinition[]> = {
  kieai: [
    { id: "gemini-3-7-flash-openai", name: "Gemini 3.7 Flash OpenAI (Priority)", provider: "kieai", desc: "Fast & high precision via OpenAI format", recommended: true },
    { id: "gemini-3-7-flash", name: "Gemini 3.7 Flash", provider: "kieai", desc: "Native Google Gemini 3.7 Flash engine" },
    { id: "gemini-3-6-flash-openai", name: "Gemini 3.6 Flash OpenAI (Priority)", provider: "kieai", desc: "Ultra-fast & cost-efficient" },
    { id: "gemini-3-6-flash", name: "Gemini 3.6 Flash", provider: "kieai", desc: "Native Google Gemini 3.6 Flash engine" },
    { id: "gpt-5-6-luna", name: "GPT 5.6 Luna", provider: "kieai", desc: "Advanced reasoning & viral hook synthesis" },
    { id: "gpt-5-6-terra", name: "GPT 5.6 Terra", provider: "kieai", desc: "Deep context comprehension" },
    { id: "gpt-5-6-sol", name: "GPT 5.6 Sol", provider: "kieai", desc: "Speed & creative narrative structuring" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5", provider: "kieai", desc: "Top-tier storytelling & nuance analysis" },
    { id: "claude-opus-4-8", name: "Claude Opus 4.8", provider: "kieai", desc: "Extended reasoning depth" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Omni)", provider: "openai", desc: "Flagship multimodal intelligence, fast & accurate", recommended: true },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", desc: "Ultra-fast & cost-efficient omni model" },
    { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", provider: "openai", desc: "Advanced reasoning & viral hook synthesis" },
    { id: "gpt-5.6-terra", name: "GPT 5.6 Terra", provider: "openai", desc: "Deep context comprehension & nuanced analysis" },
    { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", provider: "openai", desc: "Fast & creative narrative structuring" },
    { id: "o3-mini", name: "o3-mini", provider: "openai", desc: "Advanced reasoning STEM & narrative model" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", desc: "High-capability legacy model" },
    { id: "gpt-transcribe", name: "GPT Transcribe", provider: "openai", desc: "Speech recognition & transcript mapping", isTranscribe: true },
    { id: "gpt-image-2-2026-04-21", name: "GPT Image 2", provider: "openai", desc: "Image analysis & generation" },
    { id: "whisper-1", name: "Whisper 1", provider: "openai", desc: "Official audio transcription standard", isTranscribe: true },
  ],
  anthropic: [
    { id: "claude-fable-5", name: "Claude Fable 5", provider: "anthropic", desc: "Creative storytelling & engagement hooks", recommended: true },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic", desc: "State-of-the-art narrative intelligence" },
    { id: "claude-opus-5", name: "Claude Opus 5", provider: "anthropic", desc: "Max reasoning & complex transcript synthesis" },
    { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "anthropic", desc: "Instant & efficient processing" },
  ],
  gemini: [
    { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", provider: "gemini", desc: "Google DeepMind official high-speed model", recommended: true },
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "gemini", desc: "Fast & reliable transcript analysis" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", provider: "gemini", desc: "Long context reasoning" },
    { id: "gemini-3.5-transcribe", name: "Gemini 3.5 Transcribe", provider: "gemini", desc: "Audio transcription engine", isTranscribe: true },
  ],
};

export const XclipsAiSettingsSchema = z.object({
  provider: AiProviderTypeSchema.default("kieai"),
  baseUrl: z.string().default("https://api.kie.ai"),
  apiKey: z.string().default(""),
  apiKeys: z
    .object({
      kieai: z.string().default(""),
      gemini: z.string().default(""),
      openai: z.string().default(""),
      anthropic: z.string().default(""),
    })
    .default({
      kieai: "",
      gemini: "",
      openai: "",
      anthropic: "",
    }),
  transcribeModel: z.string().default("gemini-3-7-flash"),
  highlightModel: z.string().default("gemini-3-7-flash"),
  thumbnailImageModel: z.string().default("gpt-image-2.5-sunburst"),
  customProviders: z.array(CustomProviderSchema).default([]),
  activeCustomProviderId: z.string().nullable().default(null),
  lightModel: z.string().default("muse-glimmer-30b"), // Built-in Requesty helper model
  // Autoclip Narrative Options
  topicPrompt: z.string().optional().default(""),
  hookFormula: z.string().optional().default("auto"),
  targetDuration: z.enum(["short", "standard", "long", "extended"]).default("standard"), // short: 30-45s, standard: 45-75s, long: 75-120s, extended: 120-180s (~3 min)
  maxClipsCount: z.number().min(1).max(20).default(5),
  strictBoundary: z.boolean().default(true),
  outputLanguage: z.string().default("auto"), // "auto" | "id" | "en" | "es" | "ja" | "ko" | "ar" | "de" | "fr"
});

export type XclipsAiSettings = z.infer<typeof XclipsAiSettingsSchema>;

export interface SupportedLanguage {
  code: string;
  label: string;
  name: string;
}

export const SUPPORTED_OUTPUT_LANGUAGES: SupportedLanguage[] = [
  { code: "auto", label: "Auto-Detect (Ikuti Transkrip)", name: "Auto-Detect (Match Transcript)" },
  { code: "id", label: "Bahasa Indonesia", name: "Indonesian" },
  { code: "en", label: "English", name: "English" },
  { code: "es", label: "Español", name: "Spanish" },
  { code: "ja", label: "日本語 (Japanese)", name: "Japanese" },
  { code: "ko", label: "한국어 (Korean)", name: "Korean" },
  { code: "ar", label: "العربية (Arabic)", name: "Arabic" },
  { code: "de", label: "Deutsch", name: "German" },
  { code: "fr", label: "Français", name: "French" },
];

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// Storage & Cache Management Types
// ============================================================

export interface StorageStats {
  cacheSize: number;
  cacheFileCount: number;
  downloadsSize: number;
  downloadsFileCount: number;
  databaseSize: number;
  totalSize: number;
  orphanCount: number;
}

export interface ProjectStorage {
  projectId: string;
  projectName: string;
  cacheSize: number;
  downloadsSize: number;
  totalSize: number;
  isOrphan: boolean;
}

export interface CleanResult {
  freedBytes: number;
  deletedCount: number;
}

// ============================================================
// Multiplatform Downloader Types
// ============================================================

export type DownloaderPlatform = "youtube" | "tiktok" | "instagram" | "x" | "pinterest" | "web_media" | "generic";
export type DownloaderFormatType = "video" | "audio" | "subtitle" | "thumbnail" | "image";
export type DownloaderQuality =
  | "4k"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "best"
  | "mp3"
  | "m4a"
  | "wav"
  | "srt"
  | "vtt"
  | "txt"
  | "thumb";

export interface TimeRange {
  start: string; // "HH:MM:SS" or "MM:SS" or numeric seconds as string
  end: string;   // "HH:MM:SS" or "MM:SS" or numeric seconds as string
}

export interface DownloadRecord {
  id: string;
  platform: DownloaderPlatform;
  url: string;
  title: string;
  author: string;
  durationSec: number;
  thumbnailUrl: string;
  formatType: DownloaderFormatType;
  quality: DownloaderQuality;
  filePath: string;
  fileSizeBytes: number;
  status: "downloading" | "completed" | "error";
  error?: string;
  createdAt: string;
  rawJson?: string;
  timeRange?: TimeRange;
}

export interface DownloaderOptions {
  url: string;
  formatType: DownloaderFormatType;
  quality: DownloaderQuality;
  downloadSubtitles?: boolean;
  customName?: string;
  outputDir?: string;
  timeRange?: TimeRange;
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader: string;
  channel: string;
  description: string;
  webpageUrl: string;
  mediaType?: "video" | "image";
  directMediaUrl?: string;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  totalSizeStr?: string;
  speedStr: string;
  etaStr: string;
  status: "downloading" | "merging" | "transcribing" | "completed" | "error";
}
