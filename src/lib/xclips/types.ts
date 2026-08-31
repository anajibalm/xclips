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
  breakAfter: z.boolean().optional(),
});

export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const SourceTypeSchema = z.enum(["local", "youtube", "tiktok", "instagram"]);
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
  boxWidthMode: z.enum(["auto", "custom"]).optional().default("auto"),
  boxWidth: z.number().optional().default(85), // Width percentage (20-100%)
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
  aspectRatio?: AspectRatio; // default 9:16
  layoutMode: LayoutMode;
  panOffsetX: number; // -1.0 to 1.0
  videoScale?: number; // 0.5 to 3.0 (default 1.0)
  videoPanX?: number; // -1.0 to 1.0 (default 0)
  videoPanY?: number; // -1.0 to 1.0 (default 0)
  videoRotation?: number; // -180 to 180 (default 0)
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
