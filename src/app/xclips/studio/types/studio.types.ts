import { SubtitleStyle, SubtitlePreset, WordTimestamp } from "@/lib/xclips/types";
export {
  DEFAULT_SUBTITLE_STYLE,
  PRESET_STYLES,
  SUBTITLE_PRESET_OPTIONS,
  getPresetSubtitleStyle,
} from "@/lib/xclips/subtitle-presets";

export interface GoogleFontOption {
  id: string;
  name: string;
  category: "Display" | "Sans-Serif" | "Serif" | "Monospace";
  weights: string[];
}

export const GOOGLE_FONTS_CATALOG: GoogleFontOption[] = [
  { id: "Inter", name: "Inter", category: "Sans-Serif", weights: ["400", "700", "900"] },
  { id: "Montserrat", name: "Montserrat", category: "Sans-Serif", weights: ["400", "700", "900"] },
  { id: "Poppins", name: "Poppins", category: "Sans-Serif", weights: ["400", "700", "900"] },
  { id: "Bebas Neue", name: "Bebas Neue", category: "Display", weights: ["400"] },
  { id: "Anton", name: "Anton", category: "Display", weights: ["400"] },
  { id: "Roboto", name: "Roboto", category: "Sans-Serif", weights: ["400", "700", "900"] },
  { id: "Oswald", name: "Oswald", category: "Sans-Serif", weights: ["400", "700"] },
  { id: "Playfair Display", name: "Playfair Display", category: "Serif", weights: ["700", "900"] },
  { id: "Raleway", name: "Raleway", category: "Sans-Serif", weights: ["700", "900"] },
  { id: "Merriweather", name: "Merriweather", category: "Serif", weights: ["700", "900"] },
  { id: "Lato", name: "Lato", category: "Sans-Serif", weights: ["700", "900"] },
  { id: "Nunito", name: "Nunito", category: "Sans-Serif", weights: ["700", "900"] },
  { id: "Rubik", name: "Rubik", category: "Sans-Serif", weights: ["700", "900"] },
  { id: "Space Grotesk", name: "Space Grotesk", category: "Sans-Serif", weights: ["700"] },
  { id: "Bungee", name: "Bungee", category: "Display", weights: ["400"] },
  { id: "Archivo Black", name: "Archivo Black", category: "Display", weights: ["400"] },
  { id: "Syne", name: "Syne", category: "Display", weights: ["700", "800"] },
  { id: "Fira Code", name: "Fira Code", category: "Monospace", weights: ["700"] },
  { id: "Outfit", name: "Outfit", category: "Sans-Serif", weights: ["700", "900"] },
  { id: "Lexend", name: "Lexend", category: "Sans-Serif", weights: ["700", "800"] },
];


export const ITEM_BASE_HEIGHT = 44;
export const ITEM_EXPANDED_HEIGHT = 96;

export interface LogItem {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  module?: string;
  message: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface ProjectAssets {
  projectId: string;
  projectName: string;
  hasSource: boolean;
  hasNormalized: boolean;
  hasAudio: boolean;
  hasThumbnail: boolean;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  videoStreamUrl?: string;
  audioStreamUrl?: string;
  clipsCount: number;
}

export interface FootageProgress {
  percent: number;
  speedStr: string;
  etaStr: string;
  totalSizeStr?: string;
  status: string;
}

export type { PhraseSegment } from "@/lib/xclips/phrase-segmentation";

export const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const formatTimecodeWithFrames = (seconds: number, fps = 30): string => {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
};

export const hexToAssColor = (hex: string, alpha: string = "00"): string => {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `&H${alpha}${b}${g}${r}&`.toUpperCase();
  }
  return `&H${alpha}FFFFFF&`;
};

