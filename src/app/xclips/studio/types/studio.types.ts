import { SubtitleStyle, SubtitlePreset, WordTimestamp } from "@/lib/xclips/types";

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

export const PRESET_STYLES: Record<string, Partial<SubtitleStyle>> = {
  plain: {
    fontFamily: "Inter",
    fontSize: 40,
    primaryColor: "#FFFFFF",
    secondaryColor: "#FACC15",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 2.0,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: false,
    allCaps: false,
    enabled: true,
  },
  hormozi: {
    fontFamily: "Anton",
    fontSize: 48,
    primaryColor: "#FFFFFF",
    secondaryColor: "#FACC15",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 3.5,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: true,
    allCaps: true,
    enabled: true,
  },
  neon: {
    fontFamily: "Syne",
    fontSize: 42,
    primaryColor: "#F472B6",
    secondaryColor: "#A855F7",
    highlightColor: "#A855F7",
    outlineColor: "#581C87",
    outlineWidth: 3.0,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: true,
    allCaps: true,
    enabled: true,
  },
  clean_box: {
    fontFamily: "Inter",
    fontSize: 38,
    primaryColor: "#FFFFFF",
    secondaryColor: "#38BDF8",
    highlightColor: "#38BDF8",
    outlineColor: "#000000",
    outlineWidth: 0,
    boxColor: "#000000",
    boxOpacity: 0.8,
    karaokeEnabled: true,
    allCaps: false,
    enabled: true,
  },
  minimal: {
    fontFamily: "Inter",
    fontSize: 36,
    primaryColor: "#F4F4F5",
    secondaryColor: "#E4E4E7",
    highlightColor: "#FFFFFF",
    outlineColor: "#18181B",
    outlineWidth: 2.0,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: false,
    allCaps: false,
    enabled: true,
  },
  devin: {
    fontFamily: "Fira Code",
    fontSize: 38,
    primaryColor: "#22D3EE",
    secondaryColor: "#F43F5E",
    highlightColor: "#F43F5E",
    outlineColor: "#082F49",
    outlineWidth: 2.5,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: true,
    allCaps: false,
    enabled: true,
  },
  ali: {
    fontFamily: "Merriweather",
    fontSize: 34,
    primaryColor: "#FEF08A",
    secondaryColor: "#FFFFFF",
    highlightColor: "#FEF08A",
    outlineColor: "#451A03",
    outlineWidth: 2.0,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: false,
    allCaps: false,
    enabled: true,
  },
  custom: {
    fontFamily: "Inter",
    fontSize: 40,
    primaryColor: "#FFFFFF",
    secondaryColor: "#3B82F6",
    highlightColor: "#3B82F6",
    outlineColor: "#000000",
    outlineWidth: 3.0,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: true,
    allCaps: false,
    enabled: true,
  },
};

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

export interface PhraseSegment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  words: WordTimestamp[];
}

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

