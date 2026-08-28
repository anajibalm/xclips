"use client";

import React, { useEffect, useState, useRef, useMemo, Suspense } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Tabs,
  Tab,
  Slider,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  LinearProgress,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Select,
  FormControl,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StarIcon from "@mui/icons-material/Star";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import MenuIcon from "@mui/icons-material/Menu";
import CropFreeIcon from "@mui/icons-material/CropFree";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import ViewStreamIcon from "@mui/icons-material/ViewStream";

import CropIcon from "@mui/icons-material/Crop";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import TerminalIcon from "@mui/icons-material/Terminal";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveIcon from "@mui/icons-material/Save";
import FontDownloadIcon from "@mui/icons-material/FontDownload";
import SearchIcon from "@mui/icons-material/Search";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PermMediaIcon from "@mui/icons-material/PermMedia";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import SubtitlesOffIcon from "@mui/icons-material/SubtitlesOff";
import ImageIcon from "@mui/icons-material/Image";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CloseIcon from "@mui/icons-material/Close";
import YouTubeIcon from "@mui/icons-material/YouTube";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import WaveSurfer from "wavesurfer.js";


import { apiFetch, getApiBaseUrl } from "@/lib/api-client";
import { FormField } from "@/components/form/FormField";
import {
  XclipsProject,
  XclipsTranscript,
  XclipsClip,
  WordTimestamp,
  LayoutMode,
  SubtitleStyle,
  SubtitlePreset,
  XclipsAiSettings,
  AiProviderType,
} from "@/lib/xclips/types";
import { useRouter, useSearchParams } from "next/navigation";

// Brand Icons
function KieAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

function OpenAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  );
}

function AnthropicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function CustomAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface LogItem {
  level?: number;
  time?: string;
  module?: string;
  msg?: string;
  traceId?: string;
  [key: string]: unknown;
}

interface PhraseSegment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  words: WordTimestamp[];
}

interface ProjectAssets {
  video: {
    name: string;
    path: string;
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    width: number;
    height: number;
    fps: number;
    isVfr: boolean;
    durationSec: number;
    format: string;
    streamUrl: string;
    downloadUrl: string;
  };
  audio: {
    name: string;
    path: string;
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    sampleRate: string;
    channels: string;
    format: string;
    streamUrl: string;
    downloadUrl: string;
  };
  srt: {
    name: string;
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    lineCount: number;
    wordCount: number;
    language: string;
    content: string;
    rawText: string;
    downloadUrl: string;
  };
  thumbnail: {
    name: string;
    path: string;
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    url: string;
    downloadUrl: string;
    isYouTube?: boolean;
    youtubeId?: string;
    youtubeUrl?: string;
    youtubeThumbnailUrl?: string;
  };
}


const GOOGLE_FONTS = [
  "Inter",
  "Montserrat",
  "Poppins",
  "Bebas Neue",
  "Anton",
  "Roboto",
  "Oswald",
  "Playfair Display",
  "Raleway",
  "Merriweather",
  "Lato",
  "Nunito",
  "Rubik",
  "Space Grotesk",
  "Bungee",
  "Archivo Black",
  "Syne",
  "Fira Code",
  "Outfit",
  "Lexend",
];

const PROVIDER_METADATA: Record<
  AiProviderType,
  { label: string; keyTitle: string; getUrl?: string; placeholder: string }
> = {
  kieai: {
    label: "KIE AI",
    keyTitle: "KIE AI API Key",
    getUrl: "https://kie.ai/api-key",
    placeholder: "sk-...",
  },
  gemini: {
    label: "Gemini",
    keyTitle: "Google Gemini API Key",
    getUrl: "https://aistudio.google.com/api-keys",
    placeholder: "AIzaSy...",
  },
  openai: {
    label: "OpenAI",
    keyTitle: "OpenAI API Key",
    getUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-proj-...",
  },
  anthropic: {
    label: "Claude",
    keyTitle: "Anthropic Claude API Key",
    getUrl: "https://platform.claude.com/settings/workspaces/default/keys",
    placeholder: "sk-ant-...",
  },
  openai_compatible: {
    label: "Custom",
    keyTitle: "Custom Provider API Key",
    placeholder: "sk-...",
  },
};

const PRESET_STYLES: Record<SubtitlePreset, Partial<SubtitleStyle>> = {
  plain: {
    enabled: true,
    preset: "plain",
    fontFamily: "Inter",
    fontSize: 38,
    primaryColor: "#FFFFFF",
    highlightColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 2,
    boxColor: "#000000",
    boxOpacity: 0.0,
    allCaps: false,
    textCase: "capitalize",
    karaokeEnabled: false,
    positionY: 82,
  },
  hormozi: {
    enabled: true,
    preset: "hormozi",
    fontFamily: "Anton",
    fontSize: 44,
    primaryColor: "#FFFFFF",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 3.5,
    boxColor: "#000000",
    boxOpacity: 0.0,
    allCaps: true,
    textCase: "uppercase",
    karaokeEnabled: true,
    positionY: 78,
  },
  neon: {
    enabled: true,
    preset: "neon",
    fontFamily: "Montserrat",
    fontSize: 40,
    primaryColor: "#38BDF8",
    highlightColor: "#F43F5E",
    outlineColor: "#09090B",
    outlineWidth: 3,
    boxColor: "#000000",
    boxOpacity: 0.2,
    allCaps: true,
    textCase: "uppercase",
    karaokeEnabled: true,
    positionY: 80,
  },
  clean_box: {
    enabled: true,
    preset: "clean_box",
    fontFamily: "Poppins",
    fontSize: 36,
    primaryColor: "#FFFFFF",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 0,
    boxColor: "#000000",
    boxOpacity: 0.8,
    allCaps: false,
    textCase: "capitalize",
    karaokeEnabled: true,
    positionY: 82,
  },
  minimal: {
    enabled: true,
    preset: "minimal",
    fontFamily: "Inter",
    fontSize: 34,
    primaryColor: "#F4F4F5",
    highlightColor: "#93C5FD",
    outlineColor: "#000000",
    outlineWidth: 1,
    boxColor: "#000000",
    boxOpacity: 0.0,
    allCaps: false,
    textCase: "lowercase",
    karaokeEnabled: false,
    positionY: 85,
  },
  custom: {
    enabled: true,
    preset: "custom",
  },
};

// Search Match Highlighter Component
function renderHighlightedText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: "#facc15",
              color: "#000000",
              fontWeight: 800,
              borderRadius: "3px",
              padding: "0 3px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

interface FillerMarker {
  startSec: number;
  endSec: number;
  word: string;
}

const SINGLE_FILLER_PATTERNS = [
  /^(e+|e{2,})$/i, // e, ee, eee
  /^(a+|a{2,})$/i, // a, aa, aaa
  /^(hm+m*)$/i, // hm, hmm, hmmm
  /^(eh+)$/i, // eh, ehh
  /^(ha+)$/i, // ha, haa
  /^anu$/i, // anu
  /^katakanlah$/i, // katakanlah
  /^um+$/i, // um, umm
  /^uh+$/i, // uh, uhh
];

const MULTI_FILLER_PHRASES = [
  "begitu ya ya",
  "gitu ya ya",
  "ya kan gitu",
  "jadi gitu",
  "apa namanya",
];

function findFillerMarkers(words: WordTimestamp[]): FillerMarker[] {
  const fillers: FillerMarker[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const clean = w.word.trim().toLowerCase().replace(/[.,!?;:"'()]/g, "");

    if (w.isFiller || SINGLE_FILLER_PATTERNS.some((p) => p.test(clean))) {
      fillers.push({ startSec: w.start, endSec: w.end, word: w.word });
      continue;
    }

    for (const phrase of MULTI_FILLER_PHRASES) {
      const parts = phrase.split(" ");
      if (i + parts.length <= words.length) {
        const sub = words
          .slice(i, i + parts.length)
          .map((pw) => pw.word.trim().toLowerCase().replace(/[.,!?;:"'()]/g, ""))
          .join(" ");
        if (sub === phrase) {
          fillers.push({
            startSec: words[i].start,
            endSec: words[i + parts.length - 1].end,
            word: phrase,
          });
          i += parts.length - 1;
          break;
        }
      }
    }
  }
  return fillers;
}

// Pro Audio RMS Speech Envelope Waveform Component
function AudioWaveformPlayer({
  audioUrl,
  durationSec,
  words = [],
  onSeek,
}: {
  audioUrl: string;
  durationSec: number;
  words?: WordTimestamp[];
  onSeek?: (timeSec: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioTotalDuration, setAudioTotalDuration] = useState(durationSec || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showFillers, setShowFillers] = useState(true);
  const [hoveredFiller, setHoveredFiller] = useState<FillerMarker | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  const fillerMarkers = useMemo(() => findFillerMarkers(words), [words]);

  // Decode audio buffer and extract smooth RMS vocal energy envelope
  useEffect(() => {
    if (!audioUrl) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadAndProcessAudio = async () => {
      try {
        const res = await fetch(audioUrl, { mode: "cors", credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const arrayBuf = await res.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);

        if (!isMounted) {
          audioCtx.close();
          return;
        }

        const channelData = audioBuf.getChannelData(0);
        const totalSamples = channelData.length;
        const dur = audioBuf.duration || durationSec || 1;
        setAudioTotalDuration(dur);

        // High resolution 160 bars
        const NUM_BARS = 160;
        const samplesPerBar = Math.floor(totalSamples / NUM_BARS);
        const rawPeaks: number[] = new Array(NUM_BARS);

        let globalMax = 0.0001;
        let globalMin = 1.0;

        for (let i = 0; i < NUM_BARS; i++) {
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, totalSamples);
          let barPeak = 0;
          let sumSquares = 0;

          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > barPeak) barPeak = val;
            sumSquares += val * val;
          }

          const barRms = Math.sqrt(sumSquares / Math.max(1, end - start));
          // 65% Peak + 35% RMS captures punchy vocal dynamics
          const energy = 0.65 * barPeak + 0.35 * barRms;
          rawPeaks[i] = energy;

          if (energy > globalMax) globalMax = energy;
          if (energy < globalMin) globalMin = energy;
        }

        // Adaptive Noise Threshold & Quadratic Dynamic Expansion
        const threshold = Math.max(0.012, globalMin + 0.06 * (globalMax - globalMin));
        const dynamicRange = Math.max(0.001, globalMax - threshold);

        const processedPeaks: number[] = new Array(NUM_BARS);
        for (let i = 0; i < NUM_BARS; i++) {
          const raw = rawPeaks[i];
          if (raw <= threshold) {
            // Pauses/Silences drop to minimal dot
            processedPeaks[i] = 0.04;
          } else {
            const norm = Math.min(1.0, (raw - threshold) / dynamicRange);
            // Power curve (1.5) creates dramatic contrast between quiet valleys and soaring vocal crests
            processedPeaks[i] = 0.06 + 0.94 * Math.pow(norm, 1.5);
          }
        }

        // 3-Point Weighted Smoothing to eliminate harsh single-sample noise while preserving peaks
        const smoothed: number[] = new Array(NUM_BARS);
        for (let i = 0; i < NUM_BARS; i++) {
          const prev = i > 0 ? processedPeaks[i - 1] : processedPeaks[i];
          const curr = processedPeaks[i];
          const next = i < NUM_BARS - 1 ? processedPeaks[i + 1] : processedPeaks[i];
          smoothed[i] = Math.max(0.04, 0.15 * prev + 0.7 * curr + 0.15 * next);
        }

        setPeaks(smoothed);
        setIsLoading(false);
        audioCtx.close();
      } catch (err: unknown) {
        console.error("Audio processing error:", err);
        if (isMounted) {
          setIsLoading(false);
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Gagal memuat visualisasi audio: ${msg}`);
        }
      }
    };

    loadAndProcessAudio();

    return () => {
      isMounted = false;
    };
  }, [audioUrl, retryKey, durationSec]);


  // Sync playback state with HTML5 audio element
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setAudioCurrentTime(t);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const seekToTime = (targetSec: number) => {
    const clamped = Math.max(0, Math.min(audioTotalDuration, targetSec));
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    setAudioCurrentTime(clamped);
    if (onSeek) onSeek(clamped);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || audioTotalDuration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    seekToTime(progress * audioTotalDuration);
  };

  // Jump to next filler word
  const handleJumpToNextFiller = () => {
    if (fillerMarkers.length === 0) return;
    const nextFiller = fillerMarkers.find((f) => f.startSec > audioCurrentTime + 0.1) || fillerMarkers[0];
    seekToTime(nextFiller.startSec);
  };

  // Render high-DPI canvas waveform with filler highlight regions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 400;
    const height = 64;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const numBars = peaks.length;
    const barGap = 1.8;
    const barWidth = (width - (numBars - 1) * barGap) / numBars;
    const currentProgress = audioTotalDuration > 0 ? audioCurrentTime / audioTotalDuration : 0;
    const currentX = currentProgress * width;

    // 1. Draw Filler Highlight Background Regions
    if (showFillers && fillerMarkers.length > 0 && audioTotalDuration > 0) {
      fillerMarkers.forEach((f) => {
        const startX = (f.startSec / audioTotalDuration) * width;
        const endX = Math.max(startX + 8, (f.endSec / audioTotalDuration) * width);
        const regionWidth = endX - startX;

        // Glowing translucent amber backdrop
        ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
        ctx.fillRect(startX, 0, regionWidth, height);

        // Top indicator pill / flag
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.roundRect(startX, 1, Math.min(regionWidth, 24), 4, 2);
        ctx.fill();
      });
    }

    // 2. Draw High-Contrast Speech Waveform Bars
    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap);
      const barH = Math.max(3, peak * (height - 12));
      const y = (height - barH) / 2;
      const barTime = (i / numBars) * audioTotalDuration;

      // Check if this bar falls inside a filler word segment
      const isFillerBar =
        showFillers &&
        fillerMarkers.some((f) => barTime >= f.startSec - 0.2 && barTime <= f.endSec + 0.2);

      const isPlayed = x <= currentX;

      if (isFillerBar) {
        // Vibrant Amber/Orange for Filler Words
        ctx.fillStyle = isPlayed ? "#f59e0b" : "#b45309";
      } else if (isPlayed) {
        // High-Contrast Vibrant Emerald for Played Normal Speech
        ctx.fillStyle = "#10b981";
      } else {
        // Muted Slate Gray for Unplayed Normal Speech
        ctx.fillStyle = "#334155";
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2);
      ctx.fill();
    });

    // 3. Draw Vertical Playhead Line
    if (currentX >= 0 && currentX <= width) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(currentX - 1, 0, 2, height);

      // Playhead top glow dot
      ctx.beginPath();
      ctx.arc(currentX, 5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [peaks, audioCurrentTime, audioTotalDuration, showFillers, fillerMarkers]);

  const formatAudioTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Box sx={{ mt: 1, p: 1.5, bgcolor: "#07070a", borderRadius: 1, border: "1px solid #1f2937" }}>
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        preload="auto"
      />

      {/* Top Banner: Stats & Filler Indicator Counter */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<RecordVoiceOverIcon sx={{ fontSize: "0.85rem !important", color: "#10b981" }} />}
            label="Speech Envelope (RMS)"
            size="small"
            sx={{ bgcolor: "rgba(16, 185, 129, 0.12)", color: "#34d399", fontWeight: 700, fontSize: "0.68rem" }}
          />

          {fillerMarkers.length > 0 && (
            <Tooltip title="Klik untuk melompat ke kata filler berikutnya">
              <Chip
                label={`⚠️ ${fillerMarkers.length} Filler`}
                size="small"
                onClick={handleJumpToNextFiller}
                sx={{
                  bgcolor: "rgba(245, 158, 11, 0.18)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "rgba(245, 158, 11, 0.3)" },
                }}
              />
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showFillers}
                onChange={(e) => setShowFillers(e.target.checked)}
                sx={{
                  "& .Mui-checked": { color: "#f59e0b" },
                  "& .Mui-checked + .MuiSwitch-track": { bgcolor: "#f59e0b" },
                }}
              />
            }
            label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.7rem" }}>Tandai Filler</Typography>}
            sx={{ m: 0 }}
          />
        </Box>
      </Box>

      {/* Waveform Canvas View */}
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          height: 64,
          bgcolor: "#0b0b10",
          borderRadius: 1,
          border: "1px solid #1a1a24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <CircularProgress size={16} sx={{ color: "#10b981" }} />
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              Menganalisis vokal & mengisolasi gelombang suara...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 0.5, textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "#fca5a5", display: "block", mb: 0.5, fontSize: "0.72rem" }}>
              {error}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setRetryKey((k) => k + 1)}
              sx={{ color: "#34d399", borderColor: "#10b981", textTransform: "none", fontSize: "0.68rem", py: 0.1, px: 1 }}
            >
              Coba Lagi
            </Button>
          </Box>
        )}

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: "64px",
            display: isLoading || error ? "none" : "block",
          }}
        />
      </Box>


      {/* Legend & Controls Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <IconButton
            size="small"
            onClick={togglePlay}
            disabled={isLoading || Boolean(error)}
            sx={{ bgcolor: "#10b981", color: "#ffffff", width: 28, height: 28, "&:hover": { bgcolor: "#059669" } }}
          >
            {isPlaying ? <PauseIcon sx={{ fontSize: "1rem" }} /> : <PlayArrowIcon sx={{ fontSize: "1rem" }} />}
          </IconButton>
          <Typography variant="caption" sx={{ color: "#34d399", fontFamily: "monospace", fontWeight: 700, fontSize: "0.78rem" }}>
            {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioTotalDuration)}
          </Typography>
        </Box>

        {/* Legend Indicators */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
            <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.68rem" }}>Vocal</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f59e0b" }} />
            <Typography variant="caption" sx={{ color: "#fbbf24", fontSize: "0.68rem" }}>Filler Word</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#334155" }} />
            <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>Unplayed</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}




const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.96-4.51V8.75a8.16 8.16 0 0 0 4.81 1.57V6.87a4.85 4.85 0 0 1-1-.18z" />
  </svg>
);

function formatTimecodeWithFrames(seconds: number, fps = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id") || "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const virtualScrollRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<XclipsProject | null>(null);
  const [transcript, setTranscript] = useState<XclipsTranscript | null>(null);
  const [clips, setClips] = useState<XclipsClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<XclipsClip | null>(null);

  const [activeTab, setActiveTab] = useState(0); // 0: AI Clips, 1: Subtitle Editor, 2: Framing & Styling, 3: Assets Manager, 4: Export, 5: Logs
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullSourceView, setIsFullSourceView] = useState(false);
  const [playerMenuAnchor, setPlayerMenuAnchor] = useState<null | HTMLElement>(null);



  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);

  // Subtitle Editor state
  const [editableWords, setEditableWords] = useState<WordTimestamp[]>([]);
  const [expandedPhraseId, setExpandedPhraseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScrollToPlayhead, setAutoScrollToPlayhead] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [draggedPhraseIndex, setDraggedPhraseIndex] = useState<number | null>(null);
  const [dragOverPhraseIndex, setDragOverPhraseIndex] = useState<number | null>(null);

  // Assets Manager state
  const [assets, setAssets] = useState<ProjectAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [isCapturingThumb, setIsCapturingThumb] = useState(false);
  const [copiedAssetKey, setCopiedAssetKey] = useState<string | null>(null);
  const [thumbTimestamp, setThumbTimestamp] = useState<number>(Date.now());

  // Preview Modals state
  const [previewVideoOpen, setPreviewVideoOpen] = useState(false);
  const [previewThumbnailOpen, setPreviewThumbnailOpen] = useState(false);

  // Process logs state
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsFilter, setLogsFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG">("ALL");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // B-Roll Downloader & 3-Tab Asset state (inside Assets tab)
  type FootagePlatform = "youtube" | "tiktok" | "instagram" | "unknown";
  const [assetsSubTab, setAssetsSubTab] = useState<"video" | "image" | "files">("video");
  const [footageUrl, setFootageUrl] = useState("");
  const [footagePlatform, setFootagePlatform] = useState<FootagePlatform | null>(null);
  const [footageDownloading, setFootageDownloading] = useState(false);
  const [footageProgress, setFootageProgress] = useState<{ percent: number; speedStr: string; etaStr: string; totalSizeStr?: string; status: string } | null>(null);
  const [footageResult, setFootageResult] = useState<{ projectId: string; videoPath: string } | null>(null);
  const [footageError, setFootageError] = useState<string | null>(null);
  const [, setFootageTaskId] = useState<string | null>(null);
  const [footageList, setFootageList] = useState<XclipsProject[]>([]);
  const [footageListLoading, setFootageListLoading] = useState(false);
  const [footagePreviewItem, setFootagePreviewItem] = useState<XclipsProject | null>(null);

  // Export Settings state
  const [exportResolution, setExportResolution] = useState<"1080x1920" | "720x1280" | "2160x3840">("1080x1920");
  const [exportBitrate, setExportBitrate] = useState<"8M" | "5M" | "3M">("8M");
  const [exportFormat, setExportFormat] = useState<"mp4" | "mov">("mp4");

  // Font Search in Style tab
  const [fontSearch, setFontSearch] = useState("");

  // AI Multi-Provider & Autoclip Narrative Settings
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<XclipsAiSettings>({
    provider: "kieai",
    baseUrl: "https://api.kie.ai/gemini-3-6-flash-openai/v1",
    apiKey: "",
    apiKeys: {
      kieai: "",
      gemini: "",
      openai: "",
      anthropic: "",
      openai_compatible: "",
    },
    transcribeModel: "gemini-3-7-flash",
    highlightModel: "gemini-3-7-flash",
    topicPrompt: "",
    targetDuration: "standard",
    maxClipsCount: 5,
    strictBoundary: true,
  });
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [searchingModels, setSearchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aiModalTab, setAiModalTab] = useState<number>(0);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [testKeyStatus, setTestKeyStatus] = useState<"idle" | "success" | "error">("idle");
  const [testKeyMessage, setTestKeyMessage] = useState<string | null>(null);

  const fetchAiSettings = async () => {
    try {
      const res = await apiFetch<{ ok: boolean; settings: XclipsAiSettings }>("/api/xclips/settings");
      if (res.ok && res.data?.settings) {
        const s = res.data.settings;
        const currentProvider = s.provider || "kieai";
        const resolvedKey = s.apiKeys?.[currentProvider] || s.apiKey || "";
        const completeSettings: XclipsAiSettings = {
          ...s,
          apiKey: resolvedKey,
          apiKeys: s.apiKeys || {
            kieai: "",
            gemini: "",
            openai: "",
            anthropic: "",
            openai_compatible: "",
          },
        };
        setAiSettings(completeSettings);
        if (typeof window !== "undefined") {
          localStorage.setItem("xclips_ai_settings_cache", JSON.stringify(completeSettings));
        }
      }
    } catch {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("xclips_ai_settings_cache");
        if (cached) {
          try {
            setAiSettings(JSON.parse(cached));
          } catch {
            // ignore
          }
        }
      }
    }
  };

  const handleSaveAiSettings = async () => {
    setSavingAiSettings(true);
    const currentProvider = aiSettings.provider;
    const currentKey = (aiSettings.apiKey || aiSettings.apiKeys?.[currentProvider] || "").trim();
    const updatedApiKeys = {
      ...(aiSettings.apiKeys || {
        kieai: "",
        gemini: "",
        openai: "",
        anthropic: "",
        openai_compatible: "",
      }),
      [currentProvider]: currentKey,
    };

    const payload: XclipsAiSettings = {
      ...aiSettings,
      apiKey: currentKey,
      apiKeys: updatedApiKeys,
    };

    try {
      const res = await apiFetch<{ ok: boolean; settings: XclipsAiSettings }>("/api/xclips/settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSavingAiSettings(false);
      if (res.ok && res.data?.settings) {
        const s = res.data.settings;
        const saved: XclipsAiSettings = {
          ...s,
          apiKey: s.apiKeys?.[s.provider] || s.apiKey || "",
          apiKeys: s.apiKeys || updatedApiKeys,
        };
        setAiSettings(saved);
        if (typeof window !== "undefined") {
          localStorage.setItem("xclips_ai_settings_cache", JSON.stringify(saved));
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setAiSettingsModalOpen(false);
      } else {
        alert(res.message || "Gagal menyimpan konfigurasi AI");
      }
    } catch {
      setSavingAiSettings(false);
      alert("Gagal terhubung ke server untuk menyimpan konfigurasi");
    }
  };

  const handleAutoSearchModels = async () => {
    setSearchingModels(true);
    const res = await apiFetch<{ ok: boolean; models: string[] }>("/api/xclips/ai/models", {
      method: "POST",
      body: JSON.stringify({
        provider: aiSettings.provider,
        baseUrl: aiSettings.baseUrl,
        apiKey: aiSettings.apiKey,
      }),
    });
    setSearchingModels(false);
    if (res.ok && res.data?.models) {
      const models = res.data.models;
      setAvailableModels(models);
      if (!aiSettings.highlightModel && models.length > 0) {
        setAiSettings((prev) => ({ ...prev, highlightModel: models[0] }));
      }
      if (!aiSettings.transcribeModel && models.length > 0) {
        setAiSettings((prev) => ({ ...prev, transcribeModel: models[0] }));
      }
    }
  };

  const handleTestApiKey = async () => {
    if (!aiSettings.apiKey) return;
    setTestingApiKey(true);
    setTestKeyStatus("idle");
    setTestKeyMessage(null);
    try {
      const res = await apiFetch<{ ok: boolean; message?: string; data?: { status: string; message: string } }>("/api/xclips/ai/validate", {
        method: "POST",
        body: JSON.stringify({
          provider: aiSettings.provider,
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.highlightModel || aiSettings.transcribeModel,
        }),
      });
      if (res.ok) {
        setTestKeyStatus("success");
        setTestKeyMessage(res.data?.data?.message || "API Key Valid & Terhubung!");
      } else {
        setTestKeyStatus("error");
        setTestKeyMessage(res.data?.message || "API Key Tidak Valid");
      }
    } catch {
      setTestKeyStatus("error");
      setTestKeyMessage("Gagal menghubungi server");
    } finally {
      setTestingApiKey(false);
    }
  };

  const loadProjectData = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch<{
      ok: boolean;
      project: XclipsProject;
      transcript?: XclipsTranscript;
      clips?: XclipsClip[];
    }>(`/api/xclips/projects/${projectId}`);

    if (res.ok && res.data?.project) {
      setProject(res.data.project);
      setTranscript(res.data.transcript || null);
      if (res.data.transcript?.words) {
        setEditableWords(res.data.transcript.words);
      }
      const loadedClips = res.data.clips || [];
      setClips(loadedClips);
      if (loadedClips.length > 0 && !selectedClip) {
        setSelectedClip(loadedClips[0]);
        setCurrentTime(loadedClips[0].startSec);
      }
    }
    setLoading(false);
  };

  const fetchAssets = async () => {
    if (!projectId) return;
    setAssetsLoading(true);
    const res = await apiFetch<{ ok: boolean; assets: ProjectAssets }>(`/api/xclips/projects/${projectId}/assets`);
    if (res.ok && res.data?.assets) {
      setAssets(res.data.assets);
    }
    setAssetsLoading(false);
  };

  const fetchLogs = async () => {
    if (!projectId) return;
    setLogsLoading(true);
    const res = await apiFetch<{ ok: boolean; logs: LogItem[] }>(`/api/xclips/projects/${projectId}/logs`);
    if (res.ok && res.data?.logs) {
      setLogs(res.data.logs);
    }
    setLogsLoading(false);
  };

  const fetchFootageList = async () => {
    setFootageListLoading(true);
    const res = await apiFetch<{ ok: boolean; projects: XclipsProject[] }>("/api/xclips/projects");
    if (res.ok && res.data?.projects) {
      setFootageList(res.data.projects);
    }
    setFootageListLoading(false);
  };

  useEffect(() => {
    loadProjectData();
    fetchAssets();
    fetchLogs();
    fetchFootageList();
    fetchAiSettings();
  }, [projectId]);

  useEffect(() => {
    fetchFootageList();
  }, [assetsSubTab]);

  // Google Font Loader (20 curated fonts) & Initial AI Settings Loader
  useEffect(() => {
    fetchAiSettings();
    const linkId = "xclips-google-fonts";
    if (typeof document !== "undefined" && !document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      const fontFamilies = [
        "Inter:wght@400;700;900",
        "Montserrat:wght@400;700;900",
        "Poppins:wght@400;700;900",
        "Bebas+Neue",
        "Anton",
        "Roboto:wght@400;700;900",
        "Oswald:wght@400;700",
        "Playfair+Display:wght@700;900",
        "Raleway:wght@700;900",
        "Merriweather:wght@700;900",
        "Lato:wght@700;900",
        "Nunito:wght@700;900",
        "Rubik:wght@700;900",
        "Space+Grotesk:wght@700",
        "Bungee",
        "Archivo+Black",
        "Syne:wght@700;800",
        "Fira+Code:wght@700",
        "Outfit:wght@700;900",
        "Lexend:wght@700;800",
      ].join("&family=");
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
      document.head.appendChild(link);
    }
  }, []);

  // --- Footage Downloader Handlers ---
  const detectPlatformFromUrl = (url: string): "youtube" | "tiktok" | "instagram" | "unknown" => {
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/instagram\.com/i.test(url)) return "instagram";
    return "unknown";
  };

  const handleFootageDownload = async (targetUrl?: string) => {
    const downloadUrl = (targetUrl || footageUrl).trim();
    if (!downloadUrl) return;
    setFootageDownloading(true);
    setFootageError(null);
    setFootageResult(null);
    setFootageProgress({ percent: 0, speedStr: "Starting...", etaStr: "--:--", status: "downloading" });

    const res = await apiFetch<{ ok: boolean; taskId: string; message?: string }>(
      "/api/xclips/footage/download-async",
      { method: "POST", body: JSON.stringify({ url: downloadUrl, quality: "best" }) }
    );

    if (!res.ok || !res.data?.taskId) {
      setFootageError((res.data as unknown as { message?: string })?.message ?? "Failed to start download");
      setFootageDownloading(false);
      setFootageProgress(null);
      return;
    }

    const taskId = res.data.taskId;
    setFootageTaskId(taskId);

    // Poll progress every 1.2s
    const pollInterval = setInterval(async () => {
      const prog = await apiFetch<{ ok: boolean; progress: { percent: number; speedStr: string; etaStr: string; totalSizeStr?: string; status: string; project?: XclipsProject; error?: string } }>(
        `/api/xclips/footage/progress/${taskId}`
      );
      if (prog.ok && prog.data?.progress) {
        const p = prog.data.progress;
        setFootageProgress({ percent: p.percent, speedStr: p.speedStr, etaStr: p.etaStr, totalSizeStr: p.totalSizeStr, status: p.status });
        if (p.status === "completed") {
          clearInterval(pollInterval);
          setFootageDownloading(false);
          if (p.project) {
            setFootageResult({ projectId: p.project.id, videoPath: p.project.sourcePath });
            setActionSuccess(`"${p.project.name || "B-Roll"}" downloaded and added to library!`);
            fetchFootageList();
            setAssetsSubTab("video");
            setFootageUrl("");
            setTimeout(() => setActionSuccess(null), 5000);
          }
        } else if (p.status === "error") {
          clearInterval(pollInterval);
          setFootageDownloading(false);
          setFootageError(p.error ?? "Download failed");
          setFootageProgress(null);
        }
      }
    }, 1200);
  };

  const handleOpenInExplorer = async (sourcePath?: string, targetProjectId?: string) => {
    const res = await apiFetch<{ ok: boolean; message?: string }>("/api/xclips/open-in-explorer", {
      method: "POST",
      body: JSON.stringify({ path: sourcePath, projectId: targetProjectId }),
    });
    if (res.ok) {
      setActionSuccess("Opened in File Explorer!");
      setTimeout(() => setActionSuccess(null), 2500);
    } else {
      setActionSuccess((res.data as unknown as { message?: string })?.message || "Failed to open explorer");
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  // Periodic log polling
  useEffect(() => {
    if (!autoRefreshLogs || !projectId) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 2500);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, projectId]);

  // Synchronize HTML5 video element with play/pause state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
    if (bgVideoRef.current) {
      if (isPlaying) {
        bgVideoRef.current.play().catch(() => {});
      } else {
        bgVideoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Global Keyboard Shortcut: Spacebar to toggle Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }
      if (document.activeElement?.getAttribute("contenteditable") === "true") {
        return;
      }
      if (aiSettingsModalOpen || previewVideoOpen || previewThumbnailOpen) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiSettingsModalOpen, previewVideoOpen, previewThumbnailOpen]);

  // Synchronize time when selected clip changes
  useEffect(() => {
    if (selectedClip && videoRef.current) {
      videoRef.current.currentTime = selectedClip.startSec;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = selectedClip.startSec;
      setCurrentTime(selectedClip.startSec);
    }
  }, [selectedClip]);

  // Video timeupdate handler with seamless auto-looping playback
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (selectedClip) {
      if (t >= selectedClip.endSec) {
        videoRef.current.currentTime = selectedClip.startSec;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = selectedClip.startSec;
        setCurrentTime(selectedClip.startSec);
      } else if (t < selectedClip.startSec) {
        videoRef.current.currentTime = selectedClip.startSec;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = selectedClip.startSec;
        setCurrentTime(selectedClip.startSec);
      }
    } else if (project?.durationSec && t >= project.durationSec) {
      videoRef.current.currentTime = 0;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleVideoEnded = () => {
    const start = selectedClip ? selectedClip.startSec : 0;
    if (videoRef.current) videoRef.current.currentTime = start;
    if (bgVideoRef.current) bgVideoRef.current.currentTime = start;
    setCurrentTime(start);
    if (isPlaying) {
      videoRef.current?.play().catch(() => {});
      bgVideoRef.current?.play().catch(() => {});
    }
  };


  const handleSeek = (timeSec: number) => {
    setCurrentTime(timeSec);
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
    }
    if (bgVideoRef.current) {
      bgVideoRef.current.currentTime = timeSec;
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Group editable words into structured phrase segments for CapCut-style editor
  const phraseSegments = useMemo<PhraseSegment[]>(() => {
    const segments: PhraseSegment[] = [];
    let currentWords: WordTimestamp[] = [];

    editableWords.forEach((w, idx) => {
      currentWords.push(w);
      const isEnd =
        currentWords.length >= 6 ||
        w.word.endsWith(".") ||
        w.word.endsWith("?") ||
        w.word.endsWith("!") ||
        idx === editableWords.length - 1;

      if (isEnd && currentWords.length > 0) {
        segments.push({
          id: `phrase_${segments.length}_${currentWords[0].start}`,
          index: segments.length,
          startSec: currentWords[0].start,
          endSec: currentWords[currentWords.length - 1].end,
          text: currentWords.map((cw) => cw.word).join(" "),
          words: [...currentWords],
        });
        currentWords = [];
      }
    });

    return segments;
  }, [editableWords]);

  // Filtered phrase segments based on search
  const filteredPhrases = useMemo(() => {
    if (!searchQuery.trim()) return phraseSegments;
    const q = searchQuery.toLowerCase();
    return phraseSegments.filter((p) => p.text.toLowerCase().includes(q));
  }, [phraseSegments, searchQuery]);

  // Virtualization calculations (Compact 1-row item heights)
  const ITEM_BASE_HEIGHT = 48;
  const ITEM_EXPANDED_HEIGHT = 104;

  const itemPositions = useMemo(() => {
    const positions: { top: number; height: number }[] = [];
    let currentTop = 0;
    filteredPhrases.forEach((p) => {
      const isExpanded = expandedPhraseId === p.id;
      const height = isExpanded ? ITEM_EXPANDED_HEIGHT : ITEM_BASE_HEIGHT;
      positions.push({ top: currentTop, height });
      currentTop += height + 6; // 6px sleek gap
    });
    return { positions, totalHeight: currentTop };
  }, [filteredPhrases, expandedPhraseId]);

  // Find visible slice
  const OVERSCAN = 3;

  const visibleRange = useMemo(() => {
    const { positions } = itemPositions;
    if (positions.length === 0) return { start: 0, end: 0 };

    let start = 0;
    while (start < positions.length && positions[start].top + positions[start].height < scrollTop) {
      start++;
    }
    start = Math.max(0, start - OVERSCAN);

    let end = start;
    while (end < positions.length && positions[end].top < scrollTop + 800) {
      end++;
    }
    end = Math.min(positions.length - 1, end + OVERSCAN);

    return { start, end };
  }, [scrollTop, itemPositions]);

  // Auto-scroll to active playing phrase
  const activePhraseIndex = useMemo(() => {
    return filteredPhrases.findIndex(
      (p) => currentTime >= p.startSec && currentTime <= p.endSec
    );
  }, [filteredPhrases, currentTime]);

  useEffect(() => {
    if (!autoScrollToPlayhead || activePhraseIndex === -1 || !virtualScrollRef.current) return;
    const pos = itemPositions.positions[activePhraseIndex];
    if (!pos) return;

    // Center the item in the viewport
    const containerHeight = virtualScrollRef.current.clientHeight || 450;
    const targetScroll = Math.max(0, pos.top - containerHeight / 2 + pos.height / 2);
    const diff = Math.abs(virtualScrollRef.current.scrollTop - targetScroll);
    if (diff > 140) {
      virtualScrollRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  }, [activePhraseIndex, autoScrollToPlayhead, itemPositions]);

  // Update a phrase's text and distribute timestamps proportionally
  const handleUpdatePhraseText = (phraseIndex: number, newText: string) => {
    const segment = phraseSegments[phraseIndex];
    if (!segment) return;

    const newWordTokens = newText.trim().split(/\s+/).filter(Boolean);
    if (newWordTokens.length === 0) return;

    const dur = segment.endSec - segment.startSec;
    const tokenDur = dur / newWordTokens.length;

    const newWordsForPhrase: WordTimestamp[] = newWordTokens.map((token, i) => ({
      word: token,
      start: Math.round((segment.startSec + i * tokenDur) * 100) / 100,
      end: Math.round((segment.startSec + (i + 1) * tokenDur) * 100) / 100,
      confidence: 1.0,
      isFiller: false,
      excluded: false,
    }));

    // Reconstruct full editable words array
    const updatedFullList: WordTimestamp[] = [];
    phraseSegments.forEach((seg, sIdx) => {
      if (sIdx === phraseIndex) {
        updatedFullList.push(...newWordsForPhrase);
      } else {
        updatedFullList.push(...seg.words);
      }
    });

    setEditableWords(updatedFullList);
  };

  // Reorder phrase segments via drag and drop
  const handleReorderPhrases = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...phraseSegments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Reconstruct full editable words array based on new sequence
    const newWordsList: WordTimestamp[] = [];
    reordered.forEach((seg) => {
      newWordsList.push(...seg.words);
    });
    setEditableWords(newWordsList);
  };

  // Save modified transcript to backend
  const handleSaveTranscript = async () => {
    setIsSavingTranscript(true);
    setActionError(null);
    setActionSuccess(null);

    const res = await apiFetch<{ ok: boolean; transcript: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${projectId}/transcript`,
      {
        method: "PUT",
        body: JSON.stringify({ words: editableWords }),
      }
    );

    setIsSavingTranscript(false);

    if (res.ok && res.data?.transcript) {
      setTranscript(res.data.transcript);
      setActionSuccess("Transkrip & Subtitle berhasil disimpan!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchAssets();
      fetchLogs();
    } else {
      setActionError(res.data?.message || "Gagal menyimpan transkrip");
    }
  };

  // Capture frame as thumbnail from video player current time
  const handleCaptureThumbnail = async () => {
    if (!projectId) return;
    setIsCapturingThumb(true);
    const res = await apiFetch<{ ok: boolean; message: string }>(`/api/xclips/media/${projectId}/thumbnail/capture`, {
      method: "POST",
      body: JSON.stringify({ timeSec: currentTime }),
    });
    setIsCapturingThumb(false);

    if (res.ok) {
      setThumbTimestamp(Date.now());
      setActionSuccess(`Thumbnail berhasil di-capture dari detik ${formatTime(currentTime)}!`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchAssets();
      fetchLogs();
    } else {
      setActionError(res.data?.message || "Gagal mengambil frame thumbnail");
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAssetKey(key);
    setTimeout(() => setCopiedAssetKey(null), 2000);
  };

  // Poll render job progress
  useEffect(() => {
    if (!renderJobId) return;

    const interval = setInterval(async () => {
      const res = await apiFetch<{ ok: boolean; job: { progress: number; status: string; outputPath?: string } }>(
        `/api/xclips/jobs/${renderJobId}`
      );
      if (res.ok && res.data?.job) {
        setRenderProgress(res.data.job.progress);
        setRenderStatus(res.data.job.status);
        if (res.data.job.status === "completed" || res.data.job.status === "failed") {
          clearInterval(interval);
          loadProjectData();
          fetchAssets();
          fetchLogs();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [renderJobId]);

  // Handle Transcribe Trigger
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setActionError(null);
    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${projectId}/transcribe`,
      { method: "POST" }
    );
    setIsTranscribing(false);

    if (res.ok && res.data?.transcript) {
      setTranscript(res.data.transcript);
      setEditableWords(res.data.transcript.words);
      fetchAssets();
      fetchLogs();
      handleDiscoverHighlights();
    } else {
      setActionError(res.data?.message || "Gagal melakukan transkripsi AI");
      fetchLogs();
    }
  };

  // Handle AI Highlight Discovery Trigger
  const handleDiscoverHighlights = async () => {
    setIsDiscovering(true);
    setActionError(null);
    const res = await apiFetch<{ ok: boolean; clips?: XclipsClip[]; message?: string }>(
      `/api/xclips/projects/${projectId}/discover`,
      { method: "POST" }
    );
    setIsDiscovering(false);

    if (res.ok && res.data?.clips) {
      setClips(res.data.clips);
      if (res.data.clips.length > 0) {
        setSelectedClip(res.data.clips[0]);
        handleSeek(res.data.clips[0].startSec);
      }
      fetchLogs();
    } else {
      setActionError(res.data?.message || "Gagal menemukan AI highlight");
      fetchLogs();
    }
  };

  // Handle Save Clip
  const handleSaveClip = async (updated: XclipsClip) => {
    setSelectedClip(updated);
    await apiFetch("/api/xclips/clips", {
      method: "POST",
      body: JSON.stringify(updated),
    });
    setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Cycle through 9:16 layout modes
  const handleCycleLayoutMode = () => {
    if (!selectedClip) return;
    const nextMode: Record<LayoutMode, LayoutMode> = {
      blur_bg: "center_crop",
      center_crop: "split_screen",
      split_screen: "blur_bg",
    };
    handleSaveClip({
      ...selectedClip,
      layoutMode: nextMode[selectedClip.layoutMode] || "blur_bg",
    });
  };

  // Toggle Fullscreen on the Canvas container
  const toggleFullscreen = () => {
    if (!canvasContainerRef.current) return;
    if (!document.fullscreenElement) {
      canvasContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };


  // Apply a subtitle preset
  const handleApplyPreset = (preset: SubtitlePreset) => {
    if (!selectedClip) return;
    const presetOverrides = PRESET_STYLES[preset];
    const newStyle: SubtitleStyle = {
      ...selectedClip.subtitleStyle,
      ...presetOverrides,
      preset,
    };
    handleSaveClip({
      ...selectedClip,
      subtitleStyle: newStyle,
    });
  };

  // Handle Trigger Render
  const handleRender = async () => {
    if (!selectedClip) return;
    setRenderStatus("rendering");
    setRenderProgress(5);

    const res = await apiFetch<{ ok: boolean; job: { id: string } }>(
      `/api/xclips/clips/${selectedClip.id}/render`,
      { method: "POST" }
    );

    if (res.ok && res.data?.job) {
      setRenderJobId(res.data.job.id);
      fetchLogs();
    } else {
      setRenderStatus("failed");
      fetchLogs();
    }
  };

  const handleCopyLogs = () => {
    const raw = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(raw);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Active word in current playback time
  const currentWord = editableWords.find(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  // Active phrase segment in current playback time
  const currentActivePhrase = phraseSegments.find(
    (p) => currentTime >= p.startSec && currentTime <= p.endSec
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  interface HumanizedLog {
    category: string;
    categoryColor: string;
    friendlyMsg: string;
    detail?: string;
    tag?: string;
  }

  const humanizeLogItem = (item: LogItem): HumanizedLog => {
    const msg = (item.msg || "").trim();
    const mod = (item.module || "").toLowerCase();
    const lvl = Number(item.level) || 30;

    // 1. Error / Failure handling
    if (
      lvl >= 50 ||
      msg.toLowerCase().includes("failed") ||
      msg.toLowerCase().includes("error") ||
      item.err
    ) {
      const rawErr = item.err
        ? typeof item.err === "string"
          ? item.err
          : (item.err as { message?: string }).message || JSON.stringify(item.err)
        : msg;

      let friendlyErr = rawErr;
      if (rawErr.toLowerCase().includes("api key") || rawErr.includes("401") || rawErr.includes("403")) {
        friendlyErr = "Kredensial API Key tidak valid atau tidak memiliki akses. Silakan periksa kembali API Key di menu Pengaturan AI.";
      } else if (rawErr.toLowerCase().includes("quota") || rawErr.includes("429")) {
        friendlyErr = "Batas kuota / rate limit API provider telah tercapai. Mohon tunggu sesaat atau beralih ke model lain.";
      } else if (rawErr.toLowerCase().includes("network") || rawErr.toLowerCase().includes("timeout") || rawErr.toLowerCase().includes("fetch failed")) {
        friendlyErr = "Koneksi ke server API terputus atau timeout saat memproses request.";
      }

      return {
        category: "Kendala Sistem",
        categoryColor: "#ef4444",
        friendlyMsg: friendlyErr,
        detail: msg !== friendlyErr ? msg : (item.module ? `Modul: ${item.module}` : undefined),
        tag: "GAGAL",
      };
    }

    // 2. AI Settings & Configuration
    if (msg.includes("Saved xclips AI settings") || mod.includes("settings")) {
      const provider = item.provider ? String(item.provider).toUpperCase() : "AI";
      const model = item.highlightModel || item.model ? ` · Model: ${item.highlightModel || item.model}` : "";
      return {
        category: "Konfigurasi AI",
        categoryColor: "#8b5cf6",
        friendlyMsg: `Pengaturan AI berhasil disimpan dan diperbarui (Provider: ${provider}${model}).`,
        tag: "PENGATURAN",
      };
    }

    // 3. Audio Extraction & Speech-to-Text Transcription
    if (
      msg.toLowerCase().includes("transcribe") ||
      mod.includes("transcribe") ||
      msg.toLowerCase().includes("audio wav") ||
      msg.toLowerCase().includes("speech")
    ) {
      if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("parsed")) {
        return {
          category: "Transkrip Audio",
          categoryColor: "#10b981",
          friendlyMsg: "Transkripsi kata & timestamp selesai. Teks subtitle telah tersinkronisasi dan siap disunting.",
          tag: "SELESAI",
        };
      }
      const provider = item.provider ? ` via ${item.provider}` : "";
      return {
        category: "Transkrip Audio",
        categoryColor: "#3b82f6",
        friendlyMsg: `Mengekstrak suara dan memetakan kata-per-kata video master${provider}...`,
        tag: "PROSES",
      };
    }

    // 4. Highlight & Viral Clip Discovery
    if (
      msg.toLowerCase().includes("highlight") ||
      msg.toLowerCase().includes("discover") ||
      mod.includes("chunker") ||
      msg.toLowerCase().includes("viral")
    ) {
      if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("ranked") || msg.toLowerCase().includes("success")) {
        const count = item.count || item.totalClips || (Array.isArray(item.clips) ? item.clips.length : "");
        return {
          category: "Pencarian Klip",
          categoryColor: "#10b981",
          friendlyMsg: `AI berhasil menemukan ${count ? `${count} ` : ""}segmen momen terbaik dengan skor viralitas tinggi.`,
          tag: "SELESAI",
        };
      }
      return {
        category: "Pencarian Klip",
        categoryColor: "#3b82f6",
        friendlyMsg: "AI sedang menganalisis narasi transkrip untuk mendeteksi hook pembuka dan momen paling menarik...",
        tag: "PROSES",
      };
    }

    // 5. Media Downloader & Ingestion (YouTube, TikTok, Instagram)
    if (
      msg.toLowerCase().includes("download") ||
      mod.includes("ytdlp") ||
      mod.includes("downloader") ||
      msg.toLowerCase().includes("ingest")
    ) {
      if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("finished")) {
        return {
          category: "Unduh Media",
          categoryColor: "#10b981",
          friendlyMsg: "File video berhasil diunduh dan disimpan ke Assets Library.",
          detail: item.title ? `Judul: ${String(item.title)}` : (item.url ? `Sumber: ${String(item.url)}` : undefined),
          tag: "SUKSES",
        };
      }
      if (item.percent !== undefined) {
        return {
          category: "Unduh Media",
          categoryColor: "#3b82f6",
          friendlyMsg: `Sedang mengunduh file media (${item.percent}%)...`,
          detail: item.speedStr ? `Kecepatan: ${item.speedStr} | Sisa Waktu: ${item.etaStr || "--:--"}` : undefined,
          tag: "UNDUH",
        };
      }
      return {
        category: "Unduh Media",
        categoryColor: "#3b82f6",
        friendlyMsg: "Memulai proses pengunduhan media video dari tautan eksternal...",
        detail: item.url ? `URL: ${String(item.url)}` : undefined,
        tag: "UNDUH",
      };
    }

    // 6. Video Rendering & Export (FFmpeg / NVENC)
    if (
      msg.toLowerCase().includes("render") ||
      mod.includes("ffmpeg") ||
      mod.includes("queue") ||
      msg.toLowerCase().includes("export")
    ) {
      if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("finished") || msg.toLowerCase().includes("done")) {
        return {
          category: "Render Video",
          categoryColor: "#10b981",
          friendlyMsg: "Render video vertikal 9:16 selesai! Video kualitas tinggi siap diunduh.",
          detail: item.outputPath ? `Output: ${String(item.outputPath)}` : undefined,
          tag: "SELESAI",
        };
      }
      return {
        category: "Render Video",
        categoryColor: "#3b82f6",
        friendlyMsg: "Memproses pembuatan video vertikal 9:16, penyesuaian layout latar, dan efek karaoke subtitle...",
        detail: item.filterPreset ? `Preset: ${String(item.filterPreset)}` : undefined,
        tag: "RENDER",
      };
    }

    // 7. Filler & Silence Detector
    if (msg.toLowerCase().includes("filler") || mod.includes("filler")) {
      return {
        category: "Pembersihan Audio",
        categoryColor: "#06b6d4",
        friendlyMsg: "Memindai jeda hening dan kata-kata filler ('eh', 'anu', 'hmm') untuk meningkatkan retensi penonton.",
        tag: "OPTIMASI",
      };
    }

    // 8. Subtitles / Style
    if (msg.toLowerCase().includes("subtitle") || mod.includes("subtitle") || msg.includes("ass")) {
      return {
        category: "Gaya Subtitle",
        categoryColor: "#f59e0b",
        friendlyMsg: "Menyinkronkan tata letak teks subtitle, font kustom, dan animasi penyorotan kata.",
        tag: "SUBTITLE",
      };
    }

    // 9. Warnings
    if (lvl >= 40 || msg.toLowerCase().includes("warn")) {
      return {
        category: "Peringatan",
        categoryColor: "#f59e0b",
        friendlyMsg: msg || "Peringatan sistem saat menjalankan tahapan proses.",
        detail: item.err ? String(item.err) : undefined,
        tag: "PERINGATAN",
      };
    }

    // 10. General Informative Activity
    return {
      category: "Aktivitas Sistem",
      categoryColor: "#3b82f6",
      friendlyMsg: msg || "Operasi sistem berhasil dijalankan.",
      detail: item.module ? `Modul: ${String(item.module)}` : undefined,
      tag: "INFO",
    };
  };

  const getLevelLabel = (lvl?: number) => {
    if (!lvl) return "INFO";
    if (lvl >= 50) return "ERROR";
    if (lvl >= 40) return "WARN";
    if (lvl >= 30) return "INFO";
    return "DEBUG";
  };

  const getLevelColor = (lvl?: number) => {
    if (!lvl) return "#3b82f6";
    if (lvl >= 50) return "#ef4444";
    if (lvl >= 40) return "#f59e0b";
    if (lvl >= 30) return "#3b82f6";
    return "#8b5cf6";
  };

  const filteredLogs = logs.filter((item) => {
    if (logsFilter === "ALL") return true;
    const lvlName = getLevelLabel(item.level);
    return lvlName === logsFilter;
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#09090c" }}>
        <CircularProgress size={40} sx={{ color: "#3b82f6", mb: 2 }} />
        <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
          Menyiapkan Workspace Studio & Stream Video...
        </Typography>
      </Box>
    );
  }

  // Use full base URL so HTML5 video connects directly to the Hono media endpoint
  const videoStreamSrc = `${getApiBaseUrl()}/api/xclips/media/${projectId}/stream`;
  const layoutMode = selectedClip?.layoutMode || "blur_bg";
  const panOffset = selectedClip?.panOffsetX || 0;
  const currentStyle: SubtitleStyle = selectedClip?.subtitleStyle || {
    enabled: true,
    preset: "plain",
    fontFamily: "Inter",
    fontSize: 38,
    primaryColor: "#FFFFFF",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 2,
    boxColor: "#000000",
    boxOpacity: 0.0,
    allCaps: false,
    textCase: "capitalize",
    autoEmoji: false,
    positionY: 82,
    karaokeEnabled: false,
  };

  return (
    <Box
      sx={{
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#09090c",
        p: 2,
        boxSizing: "border-box",
        width: "100vw",
      }}
    >
      {/* Top Fixed Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1.5,
          flexShrink: 0,
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton
            onClick={() => router.push("/xclips")}
            sx={{ color: "#a1a1aa", bgcolor: "#18181b", borderRadius: 1, "&:hover": { bgcolor: "#27272a" } }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#fafafa", letterSpacing: "-0.01em", fontSize: "1.05rem" }}>
              {project?.name || "Project Studio"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#71717a" }}>
              Duration: {project ? `${Math.floor(project.durationSec / 60)}m ${Math.round(project.durationSec % 60)}s` : "-"} | Res: {project ? `${project.width}x${project.height}` : "-"} {project?.isVfr ? "| CFR Normalized" : ""}
            </Typography>
          </Box>
        </Box>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 1, flexShrink: 0, py: 0.2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5" }}>
          {actionError}
        </Alert>
      )}

      {actionSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1, flexShrink: 0, py: 0.2, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }}>
          {actionSuccess}
        </Alert>
      )}

      {/* Dual-Pane Studio Body (Fixed 100vh Container) */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0, // Critical for nested scrolling in right panel
          display: "flex",
          gap: 2,
          overflow: "hidden",
        }}
      >
        {/* LEFT PANE: 9:16 PREVIEW & TIMELINE (Fixed Height, No Page Scroll) */}
        <Box
          sx={{
            width: { xs: 300, sm: 320, md: 340, lg: 360 },
            flexShrink: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Card
            sx={{
              height: "100%",
              bgcolor: "#141416",
              border: "1px solid #27272a",
              borderRadius: 1,
              p: 0,
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* 1. Header Bar: Player-Timeline 01 + Hamburger Menu */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 2,
                py: 1.1,
                borderBottom: "1px solid #27272a",
                bgcolor: "#18181b",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "#e4e4e7",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  letterSpacing: "0.01em",
                }}
              >
                {selectedClip
                  ? `Player-Timeline ${(clips.findIndex((c) => c.id === selectedClip.id) + 1).toString().padStart(2, "0")}`
                  : (project?.name || "Player-Timeline 01")}
              </Typography>


              <IconButton
                size="small"
                onClick={(e) => setPlayerMenuAnchor(e.currentTarget)}
                sx={{ color: "#71717a", p: 0.4, "&:hover": { color: "#ffffff" } }}
              >
                <MenuIcon sx={{ fontSize: "1.15rem" }} />
              </IconButton>

              <Menu
                anchorEl={playerMenuAnchor}
                open={Boolean(playerMenuAnchor)}
                onClose={() => setPlayerMenuAnchor(null)}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: "#18181b",
                      border: "1px solid #27272a",
                      color: "#e4e4e7",
                      borderRadius: 1,
                      minWidth: 180,
                    },
                  },
                }}
              >
                <MenuItem
                  onClick={() => {
                    handleCaptureThumbnail();
                    setPlayerMenuAnchor(null);
                  }}
                  sx={{ fontSize: "0.8rem" }}
                >
                  Capture Current Frame
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPreviewVideoOpen(true);
                    setPlayerMenuAnchor(null);
                  }}
                  sx={{ fontSize: "0.8rem" }}
                >
                  Preview Video RAW
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setActiveTab(2);
                    setPlayerMenuAnchor(null);
                  }}
                  sx={{ fontSize: "0.8rem" }}
                >
                  Open Framing Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setIsMuted(!isMuted);
                    setPlayerMenuAnchor(null);
                  }}
                  sx={{ fontSize: "0.8rem" }}
                >
                  {isMuted ? "Unmute Audio" : "Mute Audio"}
                </MenuItem>
              </Menu>
            </Box>

            {/* 2. Center Canvas Body (9:16 Vertical Video Area) */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                p: 1.5,
                bgcolor: "#0d0d0f",
              }}
            >
              <Box
                ref={canvasContainerRef}
                onClick={togglePlayPause}
                sx={{
                  height: "100%",
                  maxHeight: "100%",
                  aspectRatio: "9/16",
                  bgcolor: "#000000",
                  borderRadius: 1,
                  border: "1px solid #27272a",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 14px 40px rgba(0, 0, 0, 0.8)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  p: 1.5,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  userSelect: "none",
                  "&:hover .canvas-center-action": {
                    opacity: 1,
                    transform: "translate(-50%, -50%) scale(1)",
                  },
                }}
              >
                {/* Floating Central Play / Pause Indicator on Canvas */}
                <Box
                  className="canvas-center-action"
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: isPlaying ? "translate(-50%, -50%) scale(0.85)" : "translate(-50%, -50%) scale(1)",
                    opacity: isPlaying ? 0 : 0.95,
                    zIndex: 15,
                    pointerEvents: "none",
                    bgcolor: "rgba(0, 0, 0, 0.65)",
                    backdropFilter: "blur(6px)",
                    border: "1.5px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "50%",
                    width: 54,
                    height: 54,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.7)",
                    transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {isPlaying ? (
                    <PauseIcon sx={{ fontSize: 28, color: "#ffffff" }} />
                  ) : (
                    <PlayArrowIcon sx={{ fontSize: 32, color: "#ffffff", ml: "3px" }} />
                  )}
                </Box>
                {/* MODE 1: BLUR BACKGROUND (Background layer + crisp foreground) */}
                {layoutMode === "blur_bg" && (
                  <>
                    {/* Blurred Background Video */}
                    <video
                      ref={bgVideoRef}
                      src={videoStreamSrc}
                      muted
                      playsInline
                      onEnded={handleVideoEnded}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "blur(24px) brightness(0.65)",
                        transform: "scale(1.25)",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />

                    {/* Centered 16:9 Foreground Main Video */}
                    <video
                      ref={videoRef}
                      src={videoStreamSrc}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onEnded={handleVideoEnded}
                      muted={isMuted}
                      playsInline
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "100%",
                        maxHeight: "56%",
                        objectFit: "contain",
                        borderRadius: 6,
                        boxShadow: "0 6px 24px rgba(0,0,0,0.9)",
                        zIndex: 2,
                      }}
                    />
                  </>
                )}

                {/* MODE 2: CENTER CROP (Full bleed 9:16 with Speaker Pan Offset) */}
                {layoutMode === "center_crop" && (
                  <video
                    ref={videoRef}
                    src={videoStreamSrc}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onEnded={handleVideoEnded}
                    muted={isMuted}
                    playsInline
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${50 + panOffset * 40}% center`,
                      zIndex: 2,
                    }}
                  />
                )}

                {/* MODE 3: SPLIT SCREEN */}
                {layoutMode === "split_screen" && (
                  <>
                    <video
                      ref={videoRef}
                      src={videoStreamSrc}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onEnded={handleVideoEnded}
                      muted={isMuted}
                      playsInline
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "50%",
                        objectFit: "cover",
                        zIndex: 2,
                        borderBottom: "2px solid #3b82f6",
                      }}
                    />
                    <video
                      src={videoStreamSrc}
                      muted
                      playsInline
                      onEnded={handleVideoEnded}
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        height: "50%",
                        objectFit: "cover",
                        objectPosition: "80% center",
                        zIndex: 1,
                      }}
                    />
                  </>
                )}

                {/* Clean Dynamic Subtitle / Karaoke Caption Overlay with accurate Vertical Position Y */}
                {currentActivePhrase && currentStyle.enabled !== false && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: `${currentStyle.positionY ?? 80}%`,
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "92%",
                      zIndex: 10,
                      bgcolor:
                        (currentStyle.boxOpacity ?? 0) > 0
                          ? `${currentStyle.boxColor || "#000000"}${Math.round((currentStyle.boxOpacity ?? 0.7) * 255).toString(16).padStart(2, "0")}`
                          : "transparent",
                      p: (currentStyle.boxOpacity ?? 0) > 0 ? 0.8 : 0.2,
                      borderRadius: 1,
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: currentStyle.fontFamily || "Inter",
                        fontWeight: currentStyle.preset === "minimal" ? 600 : 900,
                        color: currentStyle.primaryColor || "#FFFFFF",
                        letterSpacing: "0.02em",
                        fontSize: `${Math.round((currentStyle.fontSize || 38) * 0.38)}px`,
                        textTransform:
                          currentStyle.textCase === "uppercase" || currentStyle.allCaps
                            ? "uppercase"
                            : currentStyle.textCase === "capitalize"
                            ? "capitalize"
                            : currentStyle.textCase === "lowercase"
                            ? "lowercase"
                            : "none",
                        textShadow:
                          (currentStyle.outlineWidth ?? 2) > 0
                            ? `0 0 ${currentStyle.outlineWidth}px ${currentStyle.outlineColor || "#000000"}, 0 2px 8px rgba(0,0,0,0.9)`
                            : "none",
                      }}
                    >
                      {currentStyle.karaokeEnabled ? (
                        <span>
                          {currentActivePhrase.words.map((w, idx) => {
                            const isCurrent = currentWord && w.word === currentWord.word && Math.abs(w.start - currentWord.start) < 0.15;
                            return (
                              <span
                                key={idx}
                                style={{
                                  color: isCurrent ? (currentStyle.highlightColor || "#FACC15") : (currentStyle.primaryColor || "#FFFFFF"),
                                  textShadow: isCurrent
                                    ? `0 0 12px ${currentStyle.highlightColor || "#FACC15"}, 0 2px 6px #000000`
                                    : undefined,
                                  fontWeight: isCurrent ? 900 : 700,
                                  marginRight: "4px",
                                  display: "inline-block",
                                }}
                              >
                                {w.word}
                              </span>
                            );
                          })}
                        </span>
                      ) : (
                        <span>{currentActivePhrase.text}</span>
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* 3. Bottom Toolbar & Timeline Scrubber matching user reference */}
            <Box
              sx={{
                width: "100%",
                px: 1.5,
                pt: 0.5,
                pb: 1,
                borderTop: "1px solid #27272a",
                bgcolor: "#141416",
                flexShrink: 0,
              }}
            >
              {/* Slim Cyan Scrubber */}
              <Slider
                size="small"
                min={!isFullSourceView && selectedClip ? selectedClip.startSec : 0}
                max={!isFullSourceView && selectedClip ? selectedClip.endSec : project?.durationSec || 100}
                step={0.05}
                value={currentTime}
                onChange={(_, val) => handleSeek(val as number)}
                sx={{
                  color: "#00e5ff",
                  height: 2.5,
                  py: 0.8,
                  mb: 0.4,
                  "& .MuiSlider-thumb": {
                    width: 10,
                    height: 10,
                    bgcolor: "#00e5ff",
                    "&:hover, &.Mui-focusVisible": {
                      boxShadow: "0 0 0 6px rgba(0, 229, 255, 0.2)",
                    },
                  },
                  "& .MuiSlider-rail": {
                    bgcolor: "#27272a",
                    opacity: 1,
                  },
                }}
              />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {/* Left Side: Timecode + Layout Stream + Play/Pause */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#00e5ff",
                      fontFamily: "sans-serif",
                      fontWeight: 600,
                      fontSize: "0.68rem",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatTimecodeWithFrames(currentTime)}
                  </Typography>

                  <Typography variant="caption" sx={{ color: "#71717a", fontFamily: "sans-serif", fontSize: "0.68rem" }}>
                    /
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{
                      color: "#a1a1aa",
                      fontFamily: "sans-serif",
                      fontWeight: 500,
                      fontSize: "0.68rem",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatTimecodeWithFrames(selectedClip ? selectedClip.endSec : project?.durationSec || 0)}
                  </Typography>


                  <IconButton
                    size="small"
                    onClick={togglePlayPause}
                    sx={{
                      color: "#ffffff",
                      p: 0.3,
                      "&:hover": { color: "#00e5ff", transform: "scale(1.1)" },
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isPlaying ? <PauseIcon sx={{ fontSize: "1.25rem" }} /> : <PlayArrowIcon sx={{ fontSize: "1.25rem" }} />}
                  </IconButton>
                </Box>

                {/* Right Side: 9:16 Badge, Fullscreen Icon */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  {/* 9:16 Aspect Ratio Badge */}
                  <Tooltip title="Vertical Aspect Ratio 9:16">
                    <Box
                      sx={{
                        border: "1px solid #3f3f46",
                        borderRadius: "3px",
                        px: "5px",
                        py: "1px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        color: "#71717a",
                        bgcolor: "#18181b",
                        cursor: "default",
                        userSelect: "none",
                        fontFamily: "sans-serif",
                      }}
                    >
                      9:16
                    </Box>
                  </Tooltip>

                  {/* Fullscreen Icon */}
                  <Tooltip title="Fullscreen">
                    <IconButton
                      size="small"
                      onClick={toggleFullscreen}
                      sx={{ color: "#71717a", p: 0.3, "&:hover": { color: "#00e5ff" } }}
                    >
                      <FullscreenIcon sx={{ fontSize: "1.1rem" }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </Card>


        </Box>

        {/* RIGHT PANE: TABBED INSPECTOR (Only This Panel Is Scrollable) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Card
            sx={{
              height: "100%",
              bgcolor: "#121216",
              border: "1px solid #27272a",
              borderRadius: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{
                flexShrink: 0,
                borderBottom: "1px solid #27272a",
                bgcolor: "#0e0e11",
                "& .MuiTab-root": { color: "#71717a", fontWeight: 700, textTransform: "none", py: 1.2, fontSize: "0.82rem" },
                "& .Mui-selected": { color: "#3b82f6" },
              }}
            >
              <Tab label={`Autoclip (${clips.length})`} />
              <Tab label="Subtitles" />
              <Tab label="Style" />
              <Tab icon={<PermMediaIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" label="Assets" />
              <Tab label="Export" />
              <Tab icon={<TerminalIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Logs" />
            </Tabs>

            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                p: 2.5,
                "&:last-child": { pb: 2.5 },
              }}
            >
              {/* TAB 0: AUTOCLIP DISCOVERY */}
              {activeTab === 0 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, flexWrap: "wrap", gap: 1.5 }}>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.95rem" }}>
                          Autoclip Engine
                        </Typography>
                        <Chip
                          icon={<TuneIcon sx={{ fontSize: "0.75rem !important", color: "#3b82f6 !important" }} />}
                          label={
                            <span>
                              <strong style={{ color: "#93c5fd" }}>
                                {PROVIDER_METADATA[aiSettings.provider]?.label || aiSettings.provider.toUpperCase()}
                              </strong>
                              {" · "}
                              <span style={{ fontFamily: "monospace", color: "#e4e4e7" }}>
                                {aiSettings.highlightModel || aiSettings.transcribeModel || "gemini-3-7-flash"}
                              </span>
                            </span>
                          }
                          size="small"
                          sx={{
                            bgcolor: "rgba(59, 130, 246, 0.12)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            borderRadius: 1,
                            height: 22,
                            fontSize: "0.7rem",
                            userSelect: "none",
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: "#71717a", display: "block", mt: 0.3 }}>
                        Automatically discover and produce dynamic 9:16 short clips from the master video.
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Tooltip title="Configure AI Provider & Narrative Focus" arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            fetchAiSettings();
                            setAiSettingsModalOpen(true);
                          }}
                          sx={{
                            color: "#a1a1aa",
                            bgcolor: "#141418",
                            border: "1px solid #27272a",
                            borderRadius: 1,
                            p: 0.8,
                            "&:hover": { color: "#3b82f6", bgcolor: "#1e1e24", borderColor: "#3f3f46" },
                          }}
                        >
                          <SettingsIcon sx={{ fontSize: "1.1rem" }} />
                        </IconButton>
                      </Tooltip>

                      {!transcript ? (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={isTranscribing ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <AutoFixHighIcon />}
                          onClick={handleTranscribe}
                          disabled={isTranscribing}
                          sx={{ bgcolor: "#3b82f6", fontWeight: 800, textTransform: "none", px: 2, borderRadius: 1, "&:hover": { bgcolor: "#2563eb" } }}
                        >
                          {isTranscribing ? "Transcribing & Scanning..." : "Generate Autoclips"}
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={isDiscovering ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <AutoFixHighIcon />}
                          onClick={handleDiscoverHighlights}
                          disabled={isDiscovering}
                          sx={{ bgcolor: "#3b82f6", fontWeight: 800, textTransform: "none", px: 2, borderRadius: 1, "&:hover": { bgcolor: "#2563eb" } }}
                        >
                          {isDiscovering ? "Scanning Clips..." : "Generate Autoclips"}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {clips.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1 }}>
                      <AutoFixHighIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1.5 }} />
                      <Typography variant="body2" sx={{ color: "#71717a", mb: 1, maxWidth: 360, mx: "auto" }}>
                        No clips generated yet. Click <strong style={{ color: "#ffffff" }}>Generate Autoclips</strong> to create video segments.
                      </Typography>
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {clips.map((clip, idx) => {
                        const isSelected = selectedClip?.id === clip.id;
                        return (
                          <Grid key={clip.id} size={{ xs: 12, sm: 6 }}>
                            <Card
                              onClick={() => {
                                setSelectedClip(clip);
                                handleSeek(clip.startSec);
                              }}
                              sx={{
                                p: 1.8,
                                bgcolor: isSelected ? "rgba(59, 130, 246, 0.08)" : "#141418",
                                border: isSelected ? "1.5px solid #3b82f6" : "1px solid #27272a",
                                borderRadius: 1,
                                cursor: "pointer",
                                "&:hover": { borderColor: isSelected ? "#3b82f6" : "#3f3f46" },
                              }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Chip
                                  label={`Clip #${idx + 1}`}
                                  size="small"
                                  sx={{
                                    bgcolor: "#1e1e24",
                                    color: "#e4e4e7",
                                    fontWeight: 700,
                                    fontSize: "0.68rem",
                                    height: 20,
                                    borderRadius: 0.8,
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace", fontWeight: 700 }}>
                                  {formatTime(clip.startSec)} - {formatTime(clip.endSec)} ({(clip.endSec - clip.startSec).toFixed(1)}s)
                                </Typography>
                              </Box>

                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#fafafa", mb: 0.5, fontSize: "0.85rem" }}>
                                {clip.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 1.5, lineHeight: 1.3 }}>
                                &quot;{clip.hookText}&quot;
                              </Typography>

                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5, borderTop: "1px solid #1f1f24" }}>
                                <Chip
                                  label={clip.status.toUpperCase()}
                                  size="small"
                                  sx={{
                                    bgcolor: clip.status === "completed" ? "rgba(16, 185, 129, 0.15)" : "#222228",
                                    color: clip.status === "completed" ? "#10b981" : "#a1a1aa",
                                    fontSize: "0.65rem",
                                    height: 20,
                                    borderRadius: 0.8,
                                  }}
                                />
                                {isSelected ? (
                                  <Chip label="Selected" size="small" sx={{ bgcolor: "#3b82f6", color: "#fff", fontSize: "0.65rem", height: 20, borderRadius: 0.8, fontWeight: 700 }} />
                                ) : (
                                  <Typography variant="caption" sx={{ color: "#60a5fa", fontSize: "0.72rem", fontWeight: 600 }}>
                                    Select Clip →
                                  </Typography>
                                )}
                              </Box>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </Box>
              )}

              {/* TAB 1: SUBTITLES EDITOR */}
              {activeTab === 1 && (
                <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                  {/* Top Bar: Title, Search, Auto-Scroll toggle & Save Button */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1.5, flexShrink: 0 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.95rem" }}>
                        Subtitles ({phraseSegments.length} Phrases)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a" }}>
                        Edit transcript phrases directly. Click any phrase to seek player to its timecode.
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={autoScrollToPlayhead}
                            onChange={(e) => setAutoScrollToPlayhead(e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption" sx={{ color: "#a1a1aa" }}>Follow Playhead</Typography>}
                      />

                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveTranscript}
                        disabled={isSavingTranscript || editableWords.length === 0}
                        sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800, px: 2, borderRadius: 1 }}
                      >
                        {isSavingTranscript ? "Saving..." : "Save Subtitles"}
                      </Button>
                    </Box>
                  </Box>

                  {/* Search Bar with spellCheck=false */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search words or phrases in transcript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                      mb: 1.5,
                      flexShrink: 0,
                      "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem" },
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "#0d0d10",
                        borderRadius: 1,
                        "& fieldset": { borderColor: searchQuery.trim() ? "#facc15" : "#27272a" },
                        "&:hover fieldset": { borderColor: searchQuery.trim() ? "#facc15" : "#3f3f46" },
                      },
                    }}
                    slotProps={{
                      htmlInput: {
                        spellCheck: false,
                        autoCorrect: "off",
                        autoCapitalize: "none",
                      },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: searchQuery.trim() ? "#facc15" : "#71717a" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  {phraseSegments.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1 }}>
                      <RecordVoiceOverIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1.5 }} />
                      <Typography variant="body2" sx={{ color: "#71717a", mb: 2 }}>
                        Transcript not generated yet. Go to <strong style={{ color: "#ffffff" }}>Autoclip</strong> tab to transcribe.
                      </Typography>
                    </Box>
                  ) : (
                    /* High-Performance Virtualized Container taking full remaining height in right pane */
                    <Box
                      ref={virtualScrollRef}
                      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                      sx={{
                        flex: 1,
                        maxHeight: "calc(100vh - 280px)",
                        overflowY: "auto",
                        position: "relative",
                        bgcolor: "#09090c",
                        p: 1.2,
                        borderRadius: 1,
                        border: "1px solid #27272a",
                        boxSizing: "border-box",
                      }}
                    >
                      {/* Virtual spacer to simulate full scroll height */}
                      <Box sx={{ height: itemPositions.totalHeight, width: "100%", position: "relative" }}>
                        {filteredPhrases
                          .slice(visibleRange.start, visibleRange.end + 1)
                          .map((seg, sliceIdx) => {
                            const actualIndex = visibleRange.start + sliceIdx;
                            const pos = itemPositions.positions[actualIndex];
                            if (!pos) return null;

                            // Strict single active phrase matching currentTime
                            const isTimeActive = currentTime >= seg.startSec && currentTime < seg.endSec;
                            const isActive = isTimeActive;
                            const isDragOver = dragOverPhraseIndex === seg.index;
                            const isBeingDragged = draggedPhraseIndex === seg.index;
                            const hasSearchMatch = searchQuery.trim() && seg.text.toLowerCase().includes(searchQuery.toLowerCase());

                            return (
                              <Box
                                key={seg.id}
                                sx={{
                                  position: "absolute",
                                  top: pos.top,
                                  left: 0,
                                  right: 0,
                                  height: pos.height,
                                  width: "100%",
                                  boxSizing: "border-box",
                                  flexShrink: 0,
                                }}
                              >
                                <Card
                                  onClick={() => handleSeek(seg.startSec)}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverPhraseIndex(seg.index);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverPhraseIndex === seg.index) setDragOverPhraseIndex(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedPhraseIndex !== null && draggedPhraseIndex !== seg.index) {
                                      handleReorderPhrases(draggedPhraseIndex, seg.index);
                                    }
                                    setDraggedPhraseIndex(null);
                                    setDragOverPhraseIndex(null);
                                  }}
                                  sx={{
                                    height: "100%",
                                    p: 0.6,
                                    px: 1,
                                    boxSizing: "border-box",
                                    bgcolor: isDragOver
                                      ? "rgba(59, 130, 246, 0.2)"
                                      : isActive
                                      ? "rgba(59, 130, 246, 0.12)"
                                      : "#121216",
                                    border: isDragOver
                                      ? "2px dashed #3b82f6"
                                      : isActive
                                      ? "1.5px solid #3b82f6"
                                      : hasSearchMatch
                                      ? "1.5px solid rgba(250, 204, 21, 0.6)"
                                      : "1px solid #232328",
                                    borderRadius: 1,
                                    opacity: isBeingDragged ? 0.4 : 1,
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 1,
                                    cursor: "pointer",
                                    "&:hover": { borderColor: isActive ? "#3b82f6" : "#3f3f46" },
                                  }}
                                >
                                  {/* Single Horizontal Row */}
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, width: "100%" }}>
                                    {/* 0. Drag Handle */}
                                    <Box
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", String(seg.index));
                                        setDraggedPhraseIndex(seg.index);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedPhraseIndex(null);
                                        setDragOverPhraseIndex(null);
                                      }}
                                      sx={{
                                        cursor: "grab",
                                        color: "#52525b",
                                        display: "flex",
                                        alignItems: "center",
                                        "&:hover": { color: "#fafafa" },
                                        "&:active": { cursor: "grabbing" },
                                      }}
                                    >
                                      <DragIndicatorIcon sx={{ fontSize: "1.1rem" }} />
                                    </Box>

                                    {/* 1. Index Chip */}
                                    <Chip
                                      label={`#${(seg.index + 1).toString().padStart(2, "0")}`}
                                      size="small"
                                      sx={{
                                        bgcolor: isActive ? "#3b82f6" : "#23232a",
                                        color: "#ffffff",
                                        fontWeight: 800,
                                        fontSize: "0.68rem",
                                        height: 22,
                                        minWidth: 36,
                                        borderRadius: 0.8,
                                      }}
                                    />

                                    {/* 2. Timecode Range */}
                                    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 92, flexShrink: 0 }}>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: isActive ? "#60a5fa" : "#a1a1aa", fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem", lineHeight: 1.2 }}
                                      >
                                        {formatTime(seg.startSec)} - {formatTime(seg.endSec)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.65rem", lineHeight: 1.1 }}>
                                        {(seg.endSec - seg.startSec).toFixed(1)}s
                                      </Typography>
                                    </Box>

                                    {/* 3. Single-line Text Input with Auto-Seek on Focus */}
                                    <TextField
                                      fullWidth
                                      size="small"
                                      variant="outlined"
                                      value={seg.text}
                                      onChange={(e) => handleUpdatePhraseText(seg.index, e.target.value)}
                                      onFocus={() => handleSeek(seg.startSec)}
                                      slotProps={{
                                        htmlInput: {
                                          spellCheck: false,
                                          autoCorrect: "off",
                                          autoCapitalize: "none",
                                        },
                                      }}
                                      sx={{
                                        flex: 1,
                                        "& .MuiInputBase-input": {
                                          color: "#ffffff",
                                          fontSize: "0.85rem",
                                          fontWeight: 600,
                                          py: 0.5,
                                          px: 1,
                                        },
                                        "& .MuiOutlinedInput-root": {
                                          bgcolor: "#18181c",
                                          height: 32,
                                          borderRadius: 0.8,
                                          "& fieldset": { borderColor: isActive ? "#3b82f6" : hasSearchMatch ? "#facc15" : "#27272a" },
                                          "&:hover fieldset": { borderColor: "#3f3f46" },
                                          "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                                        },
                                      }}
                                    />

                                    {/* Search Keyword Highlight Preview Tag */}
                                    {hasSearchMatch && (
                                      <Box
                                        sx={{
                                          display: { xs: "none", md: "flex" },
                                          alignItems: "center",
                                          px: 1,
                                          py: 0.2,
                                          bgcolor: "rgba(250, 204, 21, 0.12)",
                                          border: "1px solid rgba(250, 204, 21, 0.4)",
                                          borderRadius: 0.8,
                                          maxWidth: 180,
                                          overflow: "hidden",
                                          whiteSpace: "nowrap",
                                          textOverflow: "ellipsis",
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#f4f4f5" }}>
                                          {renderHighlightedText(seg.text, searchQuery)}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Card>
                              </Box>
                            );
                          })}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* TAB 2: FRAMING & SUBTITLE STYLE */}
              {activeTab === 2 && (
                <Box>
                  {!selectedClip ? (
                    <Typography variant="body2" sx={{ color: "#71717a", py: 4, textAlign: "center" }}>
                      Select a clip in the Autoclip tab to configure framing and subtitles.
                    </Typography>
                  ) : (
                    <Box>
                      {/* LAYOUT MODES */}
                      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.2, fontSize: "0.9rem" }}>
                        1. Framing Layout (9:16)
                      </Typography>
                      <RadioGroup
                        row
                        value={selectedClip.layoutMode}
                        onChange={(e) =>
                          handleSaveClip({
                            ...selectedClip,
                            layoutMode: e.target.value as LayoutMode,
                          })
                        }
                        sx={{ mb: 2 }}
                      >
                        <FormControlLabel
                          value="blur_bg"
                          control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
                          label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <BlurOnIcon fontSize="small" />
                              <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Blur Background</Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="center_crop"
                          control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
                          label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <CropIcon fontSize="small" />
                              <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Center Crop</Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="split_screen"
                          control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
                          label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <ViewAgendaIcon fontSize="small" />
                              <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Split Screen</Typography>
                            </Box>
                          }
                        />
                      </RadioGroup>

                      {selectedClip.layoutMode === "center_crop" && (
                        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a" }}>
                          <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 0.5, fontWeight: 600 }}>
                            Horizontal Pan Offset ({selectedClip.panOffsetX.toFixed(2)})
                          </Typography>
                          <Slider
                            min={-1.0}
                            max={1.0}
                            step={0.05}
                            value={selectedClip.panOffsetX}
                            onChange={(_, val) =>
                              handleSaveClip({
                                ...selectedClip,
                                panOffsetX: val as number,
                              })
                            }
                            sx={{ color: "#3b82f6" }}
                          />
                        </Box>
                      )}

                      <Divider sx={{ borderColor: "#27272a", my: 2.5 }} />

                      {/* SUBTITLE MASTER TOGGLE */}
                      <Box
                        sx={{
                          p: 1.8,
                          bgcolor: currentStyle.enabled !== false ? "rgba(59, 130, 246, 0.05)" : "#131317",
                          borderRadius: 1,
                          border: currentStyle.enabled !== false ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid #27272a",
                          mb: 2.5,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                          <Box sx={{ p: 0.8, bgcolor: currentStyle.enabled !== false ? "rgba(59, 130, 246, 0.15)" : "#1c1c22", borderRadius: 0.8 }}>
                            {currentStyle.enabled !== false ? (
                              <SubtitlesIcon sx={{ color: "#3b82f6", fontSize: "1.2rem" }} />
                            ) : (
                              <SubtitlesOffIcon sx={{ color: "#71717a", fontSize: "1.2rem" }} />
                            )}
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.88rem" }}>
                              Subtitle &amp; Caption
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem", display: "block" }}>
                              {currentStyle.enabled !== false
                                ? "Teks subtitle aktif dan akan dirender ke video ekspor"
                                : "Subtitle dinonaktifkan — video akan dirender tanpa teks subtitle"}
                            </Typography>
                          </Box>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={currentStyle.enabled !== false}
                              onChange={(e) =>
                                handleSaveClip({
                                  ...selectedClip,
                                  subtitleStyle: { ...currentStyle, enabled: e.target.checked },
                                })
                              }
                              sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 700, color: currentStyle.enabled !== false ? "#3b82f6" : "#71717a" }}>
                              {currentStyle.enabled !== false ? "Aktif" : "Nonaktif"}
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                      </Box>

                      {/* SUBTITLE DISABLED BANNER */}
                      {currentStyle.enabled === false ? (
                        <Box
                          sx={{
                            p: 3.5,
                            bgcolor: "#121216",
                            borderRadius: 1,
                            border: "1px dashed #27272a",
                            textAlign: "center",
                            my: 2,
                          }}
                        >
                          <SubtitlesOffIcon sx={{ fontSize: 36, color: "#71717a", mb: 1 }} />
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "#e4e4e7", mb: 0.5 }}>
                            Subtitle Sedang Dinonaktifkan
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#71717a", maxWidth: 380, display: "block", mx: "auto", mb: 2 }}>
                            Klip ini akan diekspor dalam format bersih tanpa caption. Nyalakan sakelar di atas jika ingin menampilkan dan mengkustomisasi subtitle.
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() =>
                              handleSaveClip({
                                ...selectedClip,
                                subtitleStyle: { ...currentStyle, enabled: true },
                              })
                            }
                            startIcon={<SubtitlesIcon fontSize="small" />}
                            sx={{
                              color: "#60a5fa",
                              borderColor: "#3b82f6",
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              borderRadius: 1,
                              "&:hover": { bgcolor: "rgba(59, 130, 246, 0.1)", borderColor: "#60a5fa" },
                            }}
                          >
                            Aktifkan Subtitle
                          </Button>
                        </Box>
                      ) : (
                        <Box>
                          {/* PRESET SELECTOR WITH LIVE SAMPLE CAPTIONS */}
                          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
                            2. Instant Subtitle Presets
                          </Typography>
                          <Grid container spacing={1.5} sx={{ mb: 3 }}>
                            {[
                              {
                                id: "hormozi",
                                label: "Hormozi Viral",
                                desc: "Bold impact, yellow active glow",
                                sample: (
                                  <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0a0a0c", borderRadius: 0.8, textAlign: "center" }}>
                                    <span style={{ fontFamily: "Anton, Impact", fontSize: "14px", fontWeight: 900, color: "#FACC15", textShadow: "0 0 8px #FACC15, 0 2px 4px #000", textTransform: "uppercase" }}>
                                      DYNAMIC{" "}
                                    </span>
                                    <span style={{ fontFamily: "Anton, Impact", fontSize: "14px", fontWeight: 900, color: "#FFFFFF", textShadow: "0 0 2px #000, 0 2px 4px #000", textTransform: "uppercase" }}>
                                      VIRAL HOOK
                                    </span>
                                  </Box>
                                ),
                              },
                              {
                                id: "neon",
                                label: "Neon Glow",
                                desc: "Cyberpunk cyan & rose purple",
                                sample: (
                                  <Box sx={{ mt: 1, p: 0.8, bgcolor: "#05070d", borderRadius: 0.8, textAlign: "center" }}>
                                    <span style={{ fontFamily: "Montserrat", fontSize: "13px", fontWeight: 900, color: "#F43F5E", textShadow: "0 0 10px #F43F5E", textTransform: "uppercase" }}>
                                      NEON{" "}
                                    </span>
                                    <span style={{ fontFamily: "Montserrat", fontSize: "13px", fontWeight: 900, color: "#38BDF8", textShadow: "0 0 10px #38BDF8", textTransform: "uppercase" }}>
                                      GLOW CAPTION
                                    </span>
                                  </Box>
                                ),
                              },
                              {
                                id: "clean_box",
                                label: "Clean Dark Box",
                                desc: "Translucent backdrop box",
                                sample: (
                                  <Box sx={{ mt: 1, p: 0.8, bgcolor: "#18181b", borderRadius: 0.8, textAlign: "center" }}>
                                    <Box sx={{ display: "inline-block", bgcolor: "rgba(0,0,0,0.85)", px: 1, py: 0.3, borderRadius: 0.8 }}>
                                      <span style={{ fontFamily: "Poppins", fontSize: "12px", fontWeight: 700, color: "#FACC15" }}>Clean </span>
                                      <span style={{ fontFamily: "Poppins", fontSize: "12px", fontWeight: 700, color: "#FFFFFF" }}>Dark Box</span>
                                    </Box>
                                  </Box>
                                ),
                              },
                              {
                                id: "minimal",
                                label: "Minimalist Sans",
                                desc: "Modern soft typography",
                                sample: (
                                  <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0c0c0e", borderRadius: 0.8, textAlign: "center" }}>
                                    <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 600, color: "#93C5FD", letterSpacing: "0.02em" }}>
                                      minimalist{" "}
                                    </span>
                                    <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 600, color: "#F4F4F5", letterSpacing: "0.02em" }}>
                                      typography
                                    </span>
                                  </Box>
                                ),
                              },
                              {
                                id: "plain",
                                label: "Plain / Standard",
                                desc: "Clean white classic subtitle",
                                sample: (
                                  <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0e0e11", borderRadius: 0.8, textAlign: "center" }}>
                                    <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 700, color: "#FFFFFF", textShadow: "0 1px 3px #000" }}>
                                      Standard Clean Subtitle
                                    </span>
                                  </Box>
                                ),
                              },
                            ].map((preset) => {
                              const isCurrent = currentStyle.preset === preset.id;
                              return (
                                <Grid key={preset.id} size={{ xs: 12, sm: 6 }}>
                                  <Card
                                    onClick={() => handleApplyPreset(preset.id as SubtitlePreset)}
                                    sx={{
                                      p: 1.5,
                                      bgcolor: isCurrent ? "rgba(59, 130, 246, 0.1)" : "#141418",
                                      border: isCurrent ? "1.5px solid #3b82f6" : "1px solid #27272a",
                                      borderRadius: 1,
                                      cursor: "pointer",
                                      "&:hover": { borderColor: isCurrent ? "#3b82f6" : "#3f3f46" },
                                    }}
                                  >
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                                        {preset.label}
                                      </Typography>
                                      {isCurrent && (
                                        <Chip label="Active" size="small" sx={{ bgcolor: "#3b82f6", color: "#fff", fontSize: "0.62rem", height: 18, borderRadius: 0.6, fontWeight: 800 }} />
                                      )}
                                    </Box>
                                    <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
                                      {preset.desc}
                                    </Typography>
                                    {preset.sample}
                                  </Card>
                                </Grid>
                              );
                            })}
                          </Grid>

                          <Divider sx={{ borderColor: "#27272a", my: 2 }} />

                          {/* 3. CLOUD FONT SELECTOR (20 GOOGLE FONTS) */}
                          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
                            3. Font Cloud (20 Curated Google Fonts)
                          </Typography>

                          <Box sx={{ mb: 2 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Search fonts (e.g. Anton, Montserrat, Oswald)..."
                              value={fontSearch}
                              onChange={(e) => setFontSearch(e.target.value)}
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <FontDownloadIcon fontSize="small" sx={{ color: "#71717a" }} />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                              sx={{
                                mb: 1.2,
                                "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem" },
                                "& .MuiOutlinedInput-root": { bgcolor: "#0d0d10", borderRadius: 1, "& fieldset": { borderColor: "#27272a" } },
                              }}
                            />

                            {/* Font Chips Cloud Grid */}
                            <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", maxHeight: 150, overflowY: "auto", p: 0.5 }}>
                              {GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(fontSearch.toLowerCase())).map((font) => {
                                const isSelected = currentStyle.fontFamily === font;
                                return (
                                  <Box
                                    key={font}
                                    onClick={() =>
                                      handleSaveClip({
                                        ...selectedClip,
                                        subtitleStyle: { ...currentStyle, fontFamily: font },
                                      })
                                    }
                                    sx={{
                                      px: 1.2,
                                      py: 0.6,
                                      bgcolor: isSelected ? "#3b82f6" : "#18181c",
                                      color: isSelected ? "#ffffff" : "#d4d4d8",
                                      fontFamily: font,
                                      fontWeight: 700,
                                      fontSize: "0.82rem",
                                      borderRadius: 0.8,
                                      border: isSelected ? "1px solid #3b82f6" : "1px solid #27272a",
                                      cursor: "pointer",
                                      userSelect: "none",
                                      "&:hover": { borderColor: "#3f3f46", bgcolor: isSelected ? "#3b82f6" : "#222228" },
                                    }}
                                  >
                                    {font}
                                  </Box>
                                );
                              })}
                            </Box>
                          </Box>

                          {/* 4. TEXT CASE SWITCHER (3 BUTTONS) */}
                          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1, fontSize: "0.9rem" }}>
                            4. Text Case Format
                          </Typography>
                          <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
                            {[
                              { id: "uppercase", label: "UPPERCASE" },
                              { id: "capitalize", label: "Capitalize Words" },
                              { id: "lowercase", label: "lowercase" },
                            ].map((item) => {
                              const isSelected =
                                (currentStyle.textCase === item.id) ||
                                (item.id === "uppercase" && currentStyle.allCaps && !currentStyle.textCase);

                              return (
                                <Button
                                  key={item.id}
                                  variant={isSelected ? "contained" : "outlined"}
                                  size="small"
                                  onClick={() =>
                                    handleSaveClip({
                                      ...selectedClip,
                                      subtitleStyle: {
                                        ...currentStyle,
                                        textCase: item.id as "uppercase" | "capitalize" | "lowercase",
                                        allCaps: item.id === "uppercase",
                                      },
                                    })
                                  }
                                  sx={{
                                    textTransform: "none",
                                    fontWeight: 700,
                                    fontSize: "0.78rem",
                                    borderRadius: 1,
                                    bgcolor: isSelected ? "#3b82f6" : "transparent",
                                    borderColor: isSelected ? "#3b82f6" : "#27272a",
                                    color: isSelected ? "#ffffff" : "#a1a1aa",
                                    "&:hover": { borderColor: "#3f3f46", bgcolor: isSelected ? "#2563eb" : "#18181c" },
                                  }}
                                >
                                  {item.label}
                                </Button>
                              );
                            })}
                          </Box>

                          <Divider sx={{ borderColor: "#27272a", my: 2 }} />

                          {/* 5. COLORS & SLIDERS */}
                          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
                            5. Typography Colors &amp; Position
                          </Typography>

                          <Grid container spacing={2}>
                            {/* Color Customizers */}
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                                    Primary Text Color:
                                  </Typography>
                                  <input
                                    type="color"
                                    value={currentStyle.primaryColor || "#FFFFFF"}
                                    onChange={(e) =>
                                      handleSaveClip({
                                        ...selectedClip,
                                        subtitleStyle: { ...currentStyle, primaryColor: e.target.value },
                                      })
                                    }
                                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                                  />
                                </Box>

                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                                    Karaoke Active Word Color:
                                  </Typography>
                                  <input
                                    type="color"
                                    value={currentStyle.highlightColor || "#FACC15"}
                                    onChange={(e) =>
                                      handleSaveClip({
                                        ...selectedClip,
                                        subtitleStyle: { ...currentStyle, highlightColor: e.target.value },
                                      })
                                    }
                                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                                  />
                                </Box>

                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                                    Outline / Stroke Color:
                                  </Typography>
                                  <input
                                    type="color"
                                    value={currentStyle.outlineColor || "#000000"}
                                    onChange={(e) =>
                                      handleSaveClip({
                                        ...selectedClip,
                                        subtitleStyle: { ...currentStyle, outlineColor: e.target.value },
                                      })
                                    }
                                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                                  />
                                </Box>
                              </Box>
                            </Grid>

                            {/* Sliders */}
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 0.3, fontWeight: 600 }}>
                                  Font Size ({currentStyle.fontSize || 38}px)
                                </Typography>
                                <Slider
                                  min={24}
                                  max={64}
                                  step={1}
                                  value={currentStyle.fontSize || 38}
                                  onChange={(_, val) =>
                                    handleSaveClip({
                                      ...selectedClip,
                                      subtitleStyle: { ...currentStyle, fontSize: val as number },
                                    })
                                  }
                                  sx={{ color: "#3b82f6" }}
                                />
                              </Box>

                              <Box>
                                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 0.3, fontWeight: 600 }}>
                                  Vertical Position Y ({currentStyle.positionY || 80}%)
                                </Typography>
                                <Slider
                                  min={50}
                                  max={95}
                                  step={1}
                                  value={currentStyle.positionY || 80}
                                  onChange={(_, val) =>
                                    handleSaveClip({
                                      ...selectedClip,
                                      subtitleStyle: { ...currentStyle, positionY: val as number },
                                    })
                                  }
                                  sx={{ color: "#3b82f6" }}
                                />
                              </Box>
                            </Grid>
                          </Grid>

                          <Box sx={{ mt: 2 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={currentStyle.karaokeEnabled}
                                  onChange={(e) =>
                                    handleSaveClip({
                                      ...selectedClip,
                                      subtitleStyle: { ...currentStyle, karaokeEnabled: e.target.checked },
                                    })
                                  }
                                  sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                                />
                              }
                              label={<Typography variant="body2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>Karaoke Active Word Highlight</Typography>}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* TAB 3: ASSETS */}
              {activeTab === 3 && (
                <Box>
                  {/* ===== PERMANENT MEDIA DOWNLOADER (ABOVE SUB-TABS) ===== */}
                  <Box sx={{ p: 2, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a", mb: 2.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.9rem" }}>
                        Media Downloader
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.6 }}>
                        {[
                          { id: "youtube", label: "YouTube", color: "#ef4444" },
                          { id: "tiktok", label: "TikTok", color: "#ffffff" },
                          { id: "instagram", label: "Instagram", color: "#e1306c" },
                        ].map((p) => (
                          <Chip
                            key={p.id}
                            label={p.label}
                            size="small"
                            sx={{
                              bgcolor: footagePlatform === p.id ? `${p.color}22` : "#1e1e24",
                              color: footagePlatform === p.id ? p.color : "#71717a",
                              border: `1px solid ${footagePlatform === p.id ? p.color : "#27272a"}`,
                              fontSize: "0.65rem",
                              height: 18,
                              fontWeight: 700,
                              borderRadius: 0.6,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* URL Input Row */}
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Paste YouTube, TikTok, or Instagram video link..."
                        value={footageUrl}
                        onChange={(e) => {
                          setFootageUrl(e.target.value);
                          setFootagePlatform(detectPlatformFromUrl(e.target.value));
                          setFootageError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !footageDownloading && footageUrl.trim()) {
                            handleFootageDownload();
                          }
                        }}
                        slotProps={{
                          htmlInput: { spellCheck: false, autoCorrect: "off", autoCapitalize: "none" },
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <OpenInNewIcon sx={{ color: "#71717a", fontSize: "0.95rem" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: 0.8 },
                          "& .MuiOutlinedInput-root": {
                            bgcolor: "#09090c",
                            borderRadius: 1,
                            "& fieldset": { borderColor: "#27272a" },
                            "&:hover fieldset": { borderColor: "#3f3f46" },
                            "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                          },
                        }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={footageDownloading ? <CircularProgress size={13} sx={{ color: "#ffffff" }} /> : <FileDownloadIcon />}
                        onClick={() => handleFootageDownload()}
                        disabled={footageDownloading || !footageUrl.trim()}
                        sx={{
                          bgcolor: "#3b82f6",
                          textTransform: "none",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          px: 2.2,
                          height: 36,
                          borderRadius: 1,
                          fontSize: "0.82rem",
                          "&:hover": { bgcolor: "#2563eb" },
                        }}
                      >
                        {footageDownloading ? "Downloading..." : "Download"}
                      </Button>
                    </Box>

                    {/* Error Alert */}
                    {footageError && (
                      <Alert severity="error" sx={{ mt: 1.2, py: 0.2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", fontSize: "0.78rem" }} onClose={() => setFootageError(null)}>
                        {footageError}
                      </Alert>
                    )}

                    {/* Progress Bar */}
                    {footageDownloading && footageProgress && (
                      <Box sx={{ mt: 1.5, p: 1.2, bgcolor: "#101014", border: "1px solid #3b82f6", borderRadius: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
                          <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.75rem" }}>
                            {footageProgress.status === "merging" ? "Merging streams..." : `Downloading ${footageProgress.percent.toFixed(1)}%`}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem" }}>
                            {footageProgress.totalSizeStr ? `📦 ${footageProgress.totalSizeStr} · ` : ""}
                            {footageProgress.speedStr} {footageProgress.etaStr && `· ETA ${footageProgress.etaStr}`}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={footageProgress.percent}
                          sx={{ bgcolor: "#27272a", height: 5, borderRadius: 1, "& .MuiLinearProgress-bar": { bgcolor: "#3b82f6" } }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* 3 ASSET SUB-TABS: VIDEO | IMAGE | FILES */}
                  <Box sx={{ display: "flex", gap: 0.8, mb: 2, borderBottom: "1px solid #27272a", pb: 0 }}>
                    {[
                      { id: "video", label: `Video (${1 + footageList.filter((f) => f.id !== projectId).length})` },
                      { id: "image", label: "Image (Cover & Frames)" },
                      { id: "files", label: "Files (SRT, ASS, Audio)" },
                    ].map((tab) => (
                      <Box
                        key={tab.id}
                        onClick={() => setAssetsSubTab(tab.id as "video" | "image" | "files")}
                        sx={{
                          px: 1.5,
                          py: 0.8,
                          fontSize: "0.82rem",
                          fontWeight: assetsSubTab === tab.id ? 800 : 500,
                          color: assetsSubTab === tab.id ? "#3b82f6" : "#71717a",
                          borderBottom: assetsSubTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
                          cursor: "pointer",
                          userSelect: "none",
                          "&:hover": { color: "#e4e4e7" },
                        }}
                      >
                        {tab.label}
                      </Box>
                    ))}
                  </Box>

                  {/* ===== SUB-TAB 1: VIDEO (RAW MASTER + B-ROLLS) ===== */}
                  {assetsSubTab === "video" && (
                    <Box>
                      {/* Master RAW Video Card */}
                      <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, mb: 2.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <VideoFileIcon sx={{ color: "#3b82f6", fontSize: "1.2rem" }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                              Master Raw Video
                            </Typography>
                          </Box>
                          <Chip label={assets?.video.sizeFormatted || "0 MB"} size="small" sx={{ bgcolor: "#1e1e24", color: "#60a5fa", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
                        </Box>

                        <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1.2 }}>
                          Format: <strong style={{ color: "#f4f4f5" }}>{assets?.video.format}</strong> | Res: <strong style={{ color: "#f4f4f5" }}>{assets?.video.width}x{assets?.video.height}</strong> @ {assets?.video.fps} fps | Dur: <strong style={{ color: "#f4f4f5" }}>{formatTime(assets?.video.durationSec || 0)}</strong>
                        </Typography>

                        <Box sx={{ display: "flex", gap: 0.8 }}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => setPreviewVideoOpen(true)}
                            sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<FileDownloadIcon />}
                            component="a"
                            href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=video`}
                            download
                            sx={{ color: "#60a5fa", borderColor: "#3b82f6", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}
                          >
                            Download MP4
                          </Button>
                          {assets?.video.path && (
                            <IconButton
                              size="small"
                              onClick={() => handleOpenInExplorer(assets.video.path, projectId)}
                              title="Show in File Explorer"
                              sx={{ color: "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5, "&:hover": { color: "#60a5fa" } }}
                            >
                              <FolderOpenIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => handleCopyText(assets?.video.path || "", "video_path")}
                            title={copiedAssetKey === "video_path" ? "Copied!" : "Copy Path"}
                            sx={{ color: copiedAssetKey === "video_path" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Card>

                      {/* Downloaded B-Roll Gallery Section */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.85rem" }}>
                          B-Roll Library
                        </Typography>
                        <IconButton size="small" onClick={fetchFootageList} disabled={footageListLoading} sx={{ color: "#a1a1aa" }}>
                          {footageListLoading ? <CircularProgress size={14} sx={{ color: "#3b82f6" }} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                      </Box>

                      {footageList.filter((item) => item.id !== projectId).length === 0 ? (
                        <Box sx={{ py: 4, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1 }}>
                          <VideoFileIcon sx={{ fontSize: 32, color: "#3f3f46", mb: 0.8 }} />
                          <Typography variant="caption" sx={{ color: "#71717a", display: "block" }}>
                            No downloaded B-Roll videos yet. Paste a link in the downloader above to add footage.
                          </Typography>
                        </Box>
                      ) : (
                        <Grid container spacing={1.5}>
                          {footageList.filter((item) => item.id !== projectId).map((item) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
                              <Card
                                onClick={() => setFootagePreviewItem(item)}
                                sx={{
                                  bgcolor: "#141418",
                                  border: "1px solid #27272a",
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  display: "flex",
                                  flexDirection: "column",
                                  cursor: "pointer",
                                  "&:hover": { borderColor: "#3f3f46" },
                                }}
                              >
                                {/* Thumbnail */}
                                <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9", bgcolor: "#000" }}>
                                  <Box
                                    component="img"
                                    src={`${getApiBaseUrl()}/api/xclips/media/${item.id}/thumbnail`}
                                    alt={item.name}
                                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                  <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                                    <Chip
                                      label={item.sourceType ? item.sourceType.toUpperCase() : "B-ROLL"}
                                      size="small"
                                      sx={{ bgcolor: "rgba(0,0,0,0.8)", color: "#fff", fontSize: "0.6rem", height: 18, borderRadius: 0.5, fontWeight: 700 }}
                                    />
                                  </Box>
                                  <Box sx={{ position: "absolute", bottom: 6, right: 6, bgcolor: "rgba(0,0,0,0.8)", color: "#fff", px: 0.6, py: 0.2, borderRadius: 0.5, fontSize: "0.65rem", fontFamily: "monospace" }}>
                                    {formatTime(item.durationSec || 0)}
                                  </Box>
                                </Box>

                                {/* Body */}
                                <Box sx={{ p: 1.2, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#fafafa", fontSize: "0.78rem", mb: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>
                                      {item.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                                      {item.width}x{item.height} • {item.frameRate} fps
                                    </Typography>
                                  </Box>

                                  {/* Action Footer (Preview, Explorer, Download MP4, Copy Path) */}
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.4, pt: 0.8, mt: 0.8, borderTop: "1px solid #1f1f24" }}>
                                    <Tooltip title="Open in File Explorer" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenInExplorer(item.sourcePath, item.id);
                                        }}
                                        sx={{ color: "#a1a1aa", p: 0.4, "&:hover": { color: "#60a5fa" } }}
                                      >
                                        <FolderOpenIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Download MP4" arrow>
                                      <IconButton
                                        size="small"
                                        component="a"
                                        href={`${getApiBaseUrl()}/api/xclips/media/${item.id}/download?type=video`}
                                        download
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{ color: "#a1a1aa", p: 0.4, "&:hover": { color: "#34d399" } }}
                                      >
                                        <FileDownloadIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title={copiedAssetKey === `broll_${item.id}` ? "Copied!" : "Copy Path"} arrow>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyText(item.sourcePath || "", `broll_${item.id}`);
                                        }}
                                        sx={{ color: copiedAssetKey === `broll_${item.id}` ? "#34d399" : "#a1a1aa", p: 0.4 }}
                                      >
                                        <ContentCopyIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </Box>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      )}
                    </Box>
                  )}

                  {/* ===== SUB-TAB 2: IMAGE (THUMBNAILS & FRAME CAPTURES) ===== */}
                  {assetsSubTab === "image" && (
                    <Box>
                      <Card sx={{ p: 2, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <YouTubeIcon sx={{ color: "#ef4444" }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa" }}>
                              Cover Thumbnail &amp; Captured Frames
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CameraAltIcon />}
                            onClick={handleCaptureThumbnail}
                            disabled={isCapturingThumb}
                            sx={{
                              borderColor: "#ef4444",
                              color: "#f87171",
                              textTransform: "none",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              borderRadius: 0.8,
                              "&:hover": { bgcolor: "rgba(239, 68, 68, 0.12)" },
                            }}
                          >
                            {isCapturingThumb ? "Capturing..." : `Capture Frame (${formatTime(currentTime)})`}
                          </Button>
                        </Box>

                        <Box
                          onClick={() => setPreviewThumbnailOpen(true)}
                          sx={{ width: "100%", height: 180, bgcolor: "#000", borderRadius: 1, border: "1px solid #27272a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5, position: "relative", cursor: "pointer" }}
                        >
                          <Box component="img" src={`${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail?t=${thumbTimestamp}`} alt="Cover" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </Box>

                        <Box sx={{ display: "flex", gap: 0.8 }}>
                          <Button variant="contained" size="small" startIcon={<VisibilityIcon />} onClick={() => setPreviewThumbnailOpen(true)} sx={{ bgcolor: "#ef4444", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}>
                            Preview Fullscreen
                          </Button>
                          <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} component="a" href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=thumbnail`} download sx={{ color: "#f87171", borderColor: "#ef4444", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}>
                            Download JPEG
                          </Button>
                          <IconButton size="small" onClick={() => handleCopyText(`${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail`, "thumb_url")} sx={{ color: copiedAssetKey === "thumb_url" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Card>
                    </Box>
                  )}

                  {/* ===== SUB-TAB 3: FILES (SRT, ASS, AUDIO PCM) ===== */}
                  {assetsSubTab === "files" && (
                    <Grid container spacing={2}>
                      {/* SRT Subtitle Card */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <SubtitlesIcon sx={{ color: "#f59e0b", fontSize: "1.1rem" }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                                  SRT Subtitles (.srt)
                                </Typography>
                              </Box>
                              <Chip label={`${assets?.srt.wordCount || 0} Words`} size="small" sx={{ bgcolor: "#1e1e24", color: "#fbbf24", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
                            </Box>
                            <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1 }}>
                              Standard SubRip format compatible with Premiere, Final Cut, and DaVinci Resolve.
                            </Typography>
                          </Box>

                          <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<FileDownloadIcon />}
                              component="a"
                              href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=srt`}
                              download
                              disabled={!assets?.srt.exists}
                              sx={{ bgcolor: "#f59e0b", color: "#000000", textTransform: "none", fontWeight: 800, fontSize: "0.72rem", borderRadius: 0.8, flex: 1, "&:hover": { bgcolor: "#d97706" } }}
                            >
                              Download .SRT
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ContentCopyIcon />}
                              onClick={() => handleCopyText(assets?.srt.content || "", "srt_content")}
                              disabled={!assets?.srt.exists}
                              sx={{ color: "#a1a1aa", borderColor: "#27272a", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8 }}
                            >
                              {copiedAssetKey === "srt_content" ? "Copied!" : "Copy"}
                            </Button>
                          </Box>
                        </Card>
                      </Grid>

                      {/* Audio RAW Track Card */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <AudiotrackIcon sx={{ color: "#10b981", fontSize: "1.1rem" }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                                  Audio RAW Track (16kHz WAV)
                                </Typography>
                              </Box>
                              <Chip label={assets?.audio.sizeFormatted || "0 MB"} size="small" sx={{ bgcolor: "#1e1e24", color: "#34d399", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
                            </Box>
                            <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1 }}>
                              PCM 16-bit Mono isolated audio track normalized for Whisper speech models.
                            </Typography>
                          </Box>

                          <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<FileDownloadIcon />}
                              component="a"
                              href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=audio`}
                              download
                              sx={{ bgcolor: "#10b981", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, flex: 1, "&:hover": { bgcolor: "#059669" } }}
                            >
                              Download WAV
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleCopyText(assets?.audio.path || "", "audio_path")}
                              sx={{ color: copiedAssetKey === "audio_path" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Card>
                      </Grid>
                    </Grid>
                  )}
                </Box>
              )}

              {/* TAB 4: EXPORT */}
              {activeTab === 4 && (
                <Box>
                  {!selectedClip ? (
                    <Typography variant="body2" sx={{ color: "#71717a", py: 4, textAlign: "center" }}>
                      Select a clip in the Autoclip tab first to configure export settings.
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 0.5, fontSize: "0.95rem" }}>
                        Export Video (9:16)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 2.5 }}>
                        Configure resolution, bitrate, and container format for the final render.
                      </Typography>

                      {/* Option 1: Output Resolution */}
                      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
                        Output Resolution
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
                        {[
                          { id: "1080x1920", label: "1080x1920 (9:16 FHD)" },
                          { id: "720x1280", label: "720x1280 (9:16 HD)" },
                          { id: "2160x3840", label: "2160x3840 (4K UHD)" },
                        ].map((res) => (
                          <Button
                            key={res.id}
                            variant={exportResolution === res.id ? "contained" : "outlined"}
                            size="small"
                            onClick={() => setExportResolution(res.id as "1080x1920" | "720x1280" | "2160x3840")}
                            sx={{
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              borderRadius: 1,
                              bgcolor: exportResolution === res.id ? "#3b82f6" : "transparent",
                              borderColor: exportResolution === res.id ? "#3b82f6" : "#27272a",
                              color: exportResolution === res.id ? "#ffffff" : "#a1a1aa",
                              "&:hover": { borderColor: "#3f3f46" },
                            }}
                          >
                            {res.label}
                          </Button>
                        ))}
                      </Box>

                      {/* Option 2: Target Bitrate */}
                      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
                        Target Bitrate
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
                        {[
                          { id: "8M", label: "High (8 Mbps)" },
                          { id: "5M", label: "Medium (5 Mbps)" },
                          { id: "3M", label: "Draft (3 Mbps)" },
                        ].map((br) => (
                          <Button
                            key={br.id}
                            variant={exportBitrate === br.id ? "contained" : "outlined"}
                            size="small"
                            onClick={() => setExportBitrate(br.id as "8M" | "5M" | "3M")}
                            sx={{
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              borderRadius: 1,
                              bgcolor: exportBitrate === br.id ? "#3b82f6" : "transparent",
                              borderColor: exportBitrate === br.id ? "#3b82f6" : "#27272a",
                              color: exportBitrate === br.id ? "#ffffff" : "#a1a1aa",
                              "&:hover": { borderColor: "#3f3f46" },
                            }}
                          >
                            {br.label}
                          </Button>
                        ))}
                      </Box>

                      {/* Option 3: Video Format */}
                      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
                        Container Format
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                        {[
                          { id: "mp4", label: "MP4 (H.264 + AAC)" },
                          { id: "mov", label: "MOV (ProRes)" },
                        ].map((fmt) => (
                          <Button
                            key={fmt.id}
                            variant={exportFormat === fmt.id ? "contained" : "outlined"}
                            size="small"
                            onClick={() => setExportFormat(fmt.id as "mp4" | "mov")}
                            sx={{
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              borderRadius: 1,
                              bgcolor: exportFormat === fmt.id ? "#3b82f6" : "transparent",
                              borderColor: exportFormat === fmt.id ? "#3b82f6" : "#27272a",
                              color: exportFormat === fmt.id ? "#ffffff" : "#a1a1aa",
                              "&:hover": { borderColor: "#3f3f46" },
                            }}
                          >
                            {fmt.label}
                          </Button>
                        ))}
                      </Box>

                      <Divider sx={{ borderColor: "#27272a", my: 2.5 }} />

                      {/* Rendering Progress */}
                      {renderStatus === "rendering" && (
                        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #3b82f6" }}>
                          <Typography variant="body2" sx={{ color: "#60a5fa", fontWeight: 700, mb: 0.8, fontSize: "0.82rem" }}>
                            Rendering video ({renderProgress}%)...
                          </Typography>
                          <LinearProgress variant="determinate" value={renderProgress} sx={{ bgcolor: "#27272a", height: 6, borderRadius: 1 }} />
                        </Box>
                      )}

                      {/* Render Complete Alert */}
                      {selectedClip.status === "completed" && selectedClip.outputPath && (
                        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2.5, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", borderRadius: 1 }}>
                          Render complete! Output ready: <code>{selectedClip.outputPath}</code>
                        </Alert>
                      )}

                      {/* Render Action Button */}
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={<FileDownloadIcon />}
                        onClick={handleRender}
                        disabled={renderStatus === "rendering"}
                        sx={{
                          bgcolor: "#3b82f6",
                          fontWeight: 800,
                          textTransform: "none",
                          px: 3,
                          py: 1,
                          borderRadius: 1,
                          fontSize: "0.85rem",
                          "&:hover": { bgcolor: "#2563eb" },
                        }}
                      >
                        {renderStatus === "rendering" ? "Rendering Video..." : "Render & Export 9:16 Video"}
                      </Button>
                    </Box>
                  )}
                </Box>
              )}

              {/* TAB 5: LOGS */}
              {activeTab === 5 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.9rem" }}>
                        Process Logs ({filteredLogs.length})
                      </Typography>
                      {logsLoading && <CircularProgress size={13} sx={{ color: "#3b82f6" }} />}
                    </Box>

                    <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={autoRefreshLogs}
                            onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.72rem" }}>Live (2s)</Typography>}
                      />
                      <IconButton size="small" onClick={fetchLogs} sx={{ color: "#a1a1aa" }}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon fontSize="small" />}
                        onClick={handleCopyLogs}
                        sx={{ color: "#a1a1aa", borderColor: "#27272a", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.3 }}
                      >
                        {copiedLogs ? "Copied!" : "Copy"}
                      </Button>
                    </Box>
                  </Box>

                  {/* Filter chips */}
                  <Box sx={{ display: "flex", gap: 0.6, mb: 1.5, flexWrap: "wrap" }}>
                    {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((filterName) => (
                      <Chip
                        key={filterName}
                        label={filterName}
                        size="small"
                        onClick={() => setLogsFilter(filterName)}
                        sx={{
                          bgcolor: logsFilter === filterName ? "#3b82f6" : "#141418",
                          color: logsFilter === filterName ? "#ffffff" : "#a1a1aa",
                          fontWeight: 700,
                          fontSize: "0.68rem",
                          height: 20,
                          borderRadius: 0.6,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </Box>

                  {/* Human-Friendly Log Stream Container */}
                  <Box
                    sx={{
                      maxHeight: "calc(100vh - 300px)",
                      overflowY: "auto",
                      p: 1.2,
                      bgcolor: "#09090b",
                      borderRadius: 1,
                      border: "1px solid #27272a",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.8,
                    }}
                  >
                    {filteredLogs.length === 0 ? (
                      <Typography variant="caption" sx={{ color: "#52525b", py: 4, textAlign: "center" }}>
                        Belum ada aktivitas log untuk project ini.
                      </Typography>
                    ) : (
                      filteredLogs.map((item, idx) => {
                        const h = humanizeLogItem(item);
                        const timeStr = item.time
                          ? new Date(typeof item.time === "number" ? item.time : String(item.time)).toLocaleTimeString("id-ID", { hour12: false })
                          : "--:--:--";

                        return (
                          <Box
                            key={idx}
                            sx={{
                              px: 1.4,
                              py: 1,
                              bgcolor: "#121217",
                              borderRadius: 1,
                              borderLeft: `3px solid ${h.categoryColor}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.4,
                              transition: "background-color 0.15s ease",
                              "&:hover": { bgcolor: "#181820" },
                            }}
                          >
                            {/* Header: Category Badge + Tag + Time */}
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                              <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
                                <Chip
                                  label={h.category}
                                  size="small"
                                  sx={{
                                    bgcolor: `${h.categoryColor}18`,
                                    color: h.categoryColor,
                                    border: `1px solid ${h.categoryColor}40`,
                                    fontWeight: 800,
                                    fontSize: "0.65rem",
                                    height: 20,
                                    borderRadius: 0.6,
                                    px: 0.4,
                                  }}
                                />
                                {h.tag && (
                                  <span style={{ color: "#71717a", fontSize: "0.65rem", fontWeight: 700 }}>
                                    · {h.tag}
                                  </span>
                                )}
                              </Box>
                              <span style={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace" }}>
                                {timeStr}
                              </span>
                            </Box>

                            {/* Friendly Main Message */}
                            <Typography sx={{ color: "#f4f4f5", fontWeight: 600, fontSize: "0.8rem", lineHeight: 1.45 }}>
                              {h.friendlyMsg}
                            </Typography>

                            {/* Sub Detail if available */}
                            {h.detail && (
                              <Typography sx={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                                {h.detail}
                              </Typography>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* ========================================================================= */}
      {/* PREVIEW DIALOG 1: RAW MASTER VIDEO (16:9 Full Screen Player) */}
      {/* ========================================================================= */}
      <Dialog
        open={previewVideoOpen}
        onClose={() => setPreviewVideoOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121216",
              color: "#ffffff",
              borderRadius: 1,
              border: "1px solid #27272a",
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VideoFileIcon sx={{ color: "#3b82f6" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa" }}>
              Preview Video Master RAW
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPreviewVideoOpen(false)} sx={{ color: "#a1a1aa" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Box
            sx={{
              width: "100%",
              aspectRatio: "16/9",
              bgcolor: "#000000",
              borderRadius: 1,
              overflow: "hidden",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              controls
              autoPlay
              src={videoStreamSrc}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Box>

          {/* Video Metadata Breakdown */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip label={`Resolution: ${assets?.video.width}x${assets?.video.height}`} size="small" sx={{ bgcolor: "#18181b", color: "#60a5fa", fontWeight: 700 }} />
            <Chip label={`FPS: ${assets?.video.fps} fps`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
            <Chip label={`Duration: ${formatTime(assets?.video.durationSec || 0)}`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
            <Chip label={`Size: ${assets?.video.sizeFormatted}`} size="small" sx={{ bgcolor: "#18181b", color: "#34d399", fontWeight: 700 }} />
            <Chip label={`Format: ${assets?.video.format}`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileDownloadIcon />}
            component="a"
            href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=video`}
            download
            sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 700 }}
          >
            Download Video MP4
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setPreviewVideoOpen(false)}
            sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* PREVIEW DIALOG 2: THUMBNAIL / COVER FULL RESOLUTION */}
      {/* ========================================================================= */}
      <Dialog
        open={previewThumbnailOpen}
        onClose={() => setPreviewThumbnailOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121216",
              color: "#ffffff",
              borderRadius: 1,
              border: "1px solid #27272a",
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <YouTubeIcon sx={{ color: "#ef4444" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa" }}>
              YouTube Thumbnail & Cover Preview
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPreviewThumbnailOpen(false)} sx={{ color: "#a1a1aa" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, textAlign: "center" }}>
          <Box
            sx={{
              width: "100%",
              maxHeight: "65vh",
              bgcolor: "#000000",
              borderRadius: 1,
              overflow: "hidden",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              component="img"
              src={`${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail?t=${thumbTimestamp}`}
              alt="YouTube Full Resolution Cover"
              sx={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
            Resolution: 1280x720 JPEG | Source: {assets?.thumbnail.isYouTube ? `Official YouTube Cover [${assets.thumbnail.youtubeId}]` : "Video Frame"}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          {assets?.thumbnail.youtubeUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              component="a"
              href={assets.thumbnail.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.5)", textTransform: "none" }}
            >
              Open on YouTube
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<CameraAltIcon />}
            onClick={handleCaptureThumbnail}
            disabled={isCapturingThumb}
            sx={{ bgcolor: "#3f3f46", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#52525b" } }}
          >
            {isCapturingThumb ? "Capturing Frame..." : `Capture Frame (${formatTime(currentTime)})`}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileDownloadIcon />}
            component="a"
            href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=thumbnail`}
            download
            sx={{ bgcolor: "#ef4444", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#dc2626" } }}
          >
            Download JPEG
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setPreviewThumbnailOpen(false)}
            sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* PREVIEW DIALOG 3: DOWNLOADED FOOTAGE PLAYER */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(footagePreviewItem)}
        onClose={() => setFootagePreviewItem(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121216",
              color: "#ffffff",
              borderRadius: 1,
              border: "1px solid #27272a",
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VideoFileIcon sx={{ color: "#3b82f6" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa" }}>
              {footagePreviewItem?.name || "Preview Footage"}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFootagePreviewItem(null)} sx={{ color: "#a1a1aa" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          {footagePreviewItem && (
            <Box
              sx={{
                width: "100%",
                aspectRatio: "16/9",
                bgcolor: "#000000",
                borderRadius: 1,
                overflow: "hidden",
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                controls
                autoPlay
                src={`${getApiBaseUrl()}/api/xclips/media/${footagePreviewItem.id}/stream`}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </Box>
          )}

          {footagePreviewItem && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip label={`Platform: ${footagePreviewItem.sourceType.toUpperCase()}`} size="small" sx={{ bgcolor: "#18181b", color: "#60a5fa", fontWeight: 700 }} />
              <Chip label={`Resolution: ${footagePreviewItem.width}x${footagePreviewItem.height}`} size="small" sx={{ bgcolor: "#18181b", color: "#fafafa", fontWeight: 700 }} />
              <Chip label={`FPS: ${footagePreviewItem.frameRate} fps`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
              <Chip label={`Duration: ${formatTime(footagePreviewItem.durationSec || 0)}`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          {footagePreviewItem && (
            <>
              {footagePreviewItem.id !== projectId && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    const fid = footagePreviewItem.id;
                    setFootagePreviewItem(null);
                    router.push(`/xclips/studio?id=${fid}`);
                  }}
                  sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800 }}
                >
                  Open in Studio
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                component="a"
                href={`${getApiBaseUrl()}/api/xclips/media/${footagePreviewItem.id}/download?type=video`}
                download
                sx={{ color: "#60a5fa", borderColor: "#3b82f6", textTransform: "none", fontSize: "0.75rem" }}
              >
                Download MP4
              </Button>
            </>
          )}
          <Button variant="outlined" size="small" onClick={() => setFootagePreviewItem(null)} sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: AI ENGINE & AUTOCLIP CONFIGURATION (PREMIUM & BALANCED) */}
      {/* ========================================================================= */}
      <Dialog
        open={aiSettingsModalOpen}
        onClose={() => !savingAiSettings && setAiSettingsModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121217",
              backgroundImage: "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.05), transparent 70%)",
              color: "#ffffff",
              borderRadius: 1,
              border: "1px solid #27272f",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.8)",
              maxWidth: 620,
            },
          },
        }}
      >
        {/* Header */}
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: 2.5, pb: 1.8, borderBottom: "1px solid #1f1f26" }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
              <TuneIcon sx={{ color: "#3b82f6", fontSize: "1.25rem" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "1rem", letterSpacing: "-0.01em" }}>
                Autoclip &amp; AI Engine Configuration
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.75rem", display: "block" }}>
              Configure LLM providers, model routing, and precision narrative boundaries for highlight discovery.
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAiSettingsModalOpen(false)} sx={{ color: "#71717a", "&:hover": { color: "#ffffff", bgcolor: "#1f1f26" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Navigation Tabs for Modal */}
        <Box sx={{ borderBottom: "1px solid #1f1f26", px: 2.5, bgcolor: "#0f0f14" }}>
          <Tabs
            value={aiModalTab}
            onChange={(_, val) => setAiModalTab(val)}
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                color: "#71717a",
                fontWeight: 700,
                textTransform: "none",
                py: 1,
                fontSize: "0.8rem",
                minHeight: 40,
              },
              "& .Mui-selected": { color: "#3b82f6" },
            }}
          >
            <Tab label="AI Provider & Model" icon={<TuneIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" />
            <Tab label="Content & Narrative Settings" icon={<VideoFileIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" />
          </Tabs>
        </Box>

        <DialogContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* TAB 0: AI PROVIDER & MODEL ROUTING */}
          {aiModalTab === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
              {/* PROVIDER SELECTION (5 PROVIDERS: KIE AI, GEMINI, OPENAI, ANTHROPIC, CUSTOM) */}
              <Box>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8, fontSize: "0.75rem" }}>
                  Pilih AI Provider
                </Typography>
                <Grid container spacing={1}>
                  {[
                    {
                      id: "kieai",
                      label: "KIE AI",
                      icon: <KieAiIcon style={{ color: "#3b82f6", width: 22, height: 22 }} />,
                      defaultUrl: "https://api.kie.ai/gemini-3-6-flash-openai/v1",
                      defaultTranscribe: "gemini-3-7-flash",
                      defaultHighlight: "gemini-3-7-flash",
                      isFixed: true,
                    },
                    {
                      id: "gemini",
                      label: "Gemini",
                      icon: <GeminiIcon style={{ color: "#8E75FF", width: 22, height: 22 }} />,
                      defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
                      defaultTranscribe: "gemini-3.7-flash",
                      defaultHighlight: "gemini-3.7-flash",
                      isFixed: true,
                    },
                    {
                      id: "openai",
                      label: "OpenAI",
                      icon: <OpenAiIcon style={{ color: "#10A37F", width: 22, height: 22 }} />,
                      defaultUrl: "https://api.openai.com/v1",
                      defaultTranscribe: "gpt-5-6-terra",
                      defaultHighlight: "gpt-5-6-terra",
                      isFixed: true,
                    },
                    {
                      id: "anthropic",
                      label: "Claude",
                      icon: <AnthropicIcon style={{ color: "#D97757", width: 22, height: 22 }} />,
                      defaultUrl: "https://api.anthropic.com/v1",
                      defaultTranscribe: "claude-sonnet-5",
                      defaultHighlight: "claude-sonnet-5",
                      isFixed: true,
                    },
                    {
                      id: "openai_compatible",
                      label: "Custom",
                      icon: <CustomAiIcon style={{ color: "#a1a1aa", width: 22, height: 22 }} />,
                      defaultUrl: "https://api.openai.com/v1",
                      defaultTranscribe: "whisper-1",
                      defaultHighlight: "gpt-4o",
                      isFixed: false,
                    },
                  ].map((p) => {
                    const isSelected = aiSettings.provider === p.id;
                    const isConfigured = Boolean(
                      (aiSettings.apiKeys?.[p.id as AiProviderType] && aiSettings.apiKeys[p.id as AiProviderType].trim().length > 0) ||
                      (aiSettings.provider === p.id && aiSettings.apiKey && aiSettings.apiKey.trim().length > 0)
                    );

                    return (
                      <Grid size={{ xs: 6, sm: 2.4 }} key={p.id}>
                        <Box
                          onClick={() => {
                            setAiSettings((prev) => {
                              const nextProvider = p.id as AiProviderType;
                              const providerApiKey = prev.apiKeys?.[nextProvider] || "";
                              return {
                                ...prev,
                                provider: nextProvider,
                                baseUrl: p.defaultUrl,
                                apiKey: providerApiKey,
                                transcribeModel: p.defaultTranscribe,
                                highlightModel: p.defaultHighlight,
                              };
                            });
                            setTestKeyStatus("idle");
                            setTestKeyMessage(null);
                            setAvailableModels([]);
                          }}
                          sx={{
                            p: 1.4,
                            height: "100%",
                            bgcolor: isSelected
                              ? "rgba(59, 130, 246, 0.1)"
                              : isConfigured
                              ? "#16161c"
                              : "#111116",
                            border: isSelected
                              ? "1.5px solid #3b82f6"
                              : isConfigured
                              ? "1px solid #282834"
                              : "1px solid #1c1c24",
                            borderRadius: 1,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            gap: 0.8,
                            transition: "all 0.15s ease",
                            filter: isConfigured || isSelected ? "none" : "grayscale(100%)",
                            opacity: isConfigured || isSelected ? 1 : 0.45,
                            "&:hover": {
                              borderColor: isSelected ? "#3b82f6" : "#3b82f6",
                              bgcolor: isSelected ? "rgba(59, 130, 246, 0.14)" : "#1c1c24",
                              opacity: 1,
                              filter: "none",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              p: 0.6,
                              bgcolor: "#0f0f14",
                              borderRadius: 0.8,
                              border: "1px solid #23232b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {p.icon}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 800,
                              fontSize: "0.78rem",
                              color: isSelected ? "#ffffff" : isConfigured ? "#e4e4e7" : "#71717a",
                              lineHeight: 1.2,
                            }}
                          >
                            {p.label}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              {/* ENDPOINT & CREDENTIALS */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
                {/* Base URL: Render only for Custom (openai_compatible) provider */}
                {aiSettings.provider === "openai_compatible" && (
                  <FormField
                    label="Base URL / API Endpoint"
                    subLabel="Endpoint Kustom (Dapat Diedit)"
                    value={aiSettings.baseUrl}
                    onChange={(e) => setAiSettings((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                )}

                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                  <FormField
                    label={PROVIDER_METADATA[aiSettings.provider]?.keyTitle || "API Key"}
                    subLabel={
                      PROVIDER_METADATA[aiSettings.provider]?.getUrl ? (
                        <Box
                          component="a"
                          href={PROVIDER_METADATA[aiSettings.provider]?.getUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            color: "#60a5fa",
                            textDecoration: "none",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.3,
                            "&:hover": { textDecoration: "underline", color: "#93c5fd" },
                          }}
                        >
                          Get API Key ↗
                        </Box>
                      ) : undefined
                    }
                    type={showApiKey ? "text" : "password"}
                    value={aiSettings.apiKey || aiSettings.apiKeys?.[aiSettings.provider] || ""}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      setTestKeyStatus("idle");
                      setTestKeyMessage(null);
                      setAiSettings((prev) => ({
                        ...prev,
                        apiKey: newKey,
                        apiKeys: {
                          ...(prev.apiKeys || {
                            kieai: "",
                            gemini: "",
                            openai: "",
                            anthropic: "",
                            openai_compatible: "",
                          }),
                          [prev.provider]: newKey,
                        },
                      }));
                    }}
                    placeholder={PROVIDER_METADATA[aiSettings.provider]?.placeholder || "sk-..."}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end" sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                            {/* Check / Test API Key Button */}
                            {testingApiKey ? (
                              <CircularProgress size={16} sx={{ color: "#3b82f6", mr: 0.4 }} />
                            ) : testKeyStatus === "success" ? (
                              <Tooltip title={testKeyMessage || "API Key Valid & Terhubung!"}>
                                <IconButton
                                  size="small"
                                  onClick={handleTestApiKey}
                                  sx={{ color: "#22c55e", p: 0.4, "&:hover": { bgcolor: "rgba(34, 197, 94, 0.1)" } }}
                                >
                                  <CheckCircleIcon sx={{ fontSize: "1.15rem" }} />
                                </IconButton>
                              </Tooltip>
                            ) : testKeyStatus === "error" ? (
                              <Tooltip title={testKeyMessage || "API Key Tidak Valid / Error"}>
                                <IconButton
                                  size="small"
                                  onClick={handleTestApiKey}
                                  sx={{ color: "#ef4444", p: 0.4, "&:hover": { bgcolor: "rgba(239, 68, 68, 0.1)" } }}
                                >
                                  <CloseIcon sx={{ fontSize: "1.15rem" }} />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Test / Check API Key">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={handleTestApiKey}
                                    disabled={!aiSettings.apiKey}
                                    sx={{
                                      color: "#3b82f6",
                                      p: 0.4,
                                      "&:hover": { color: "#60a5fa", bgcolor: "rgba(59, 130, 246, 0.12)" },
                                      "&.Mui-disabled": { color: "#3f3f46" },
                                    }}
                                  >
                                    <PlayArrowIcon sx={{ fontSize: "1.15rem" }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}

                            {/* Eye toggle button */}
                            <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)} sx={{ color: "#71717a", p: 0.4 }}>
                              {showApiKey ? <VisibilityOffIcon sx={{ fontSize: "1.15rem" }} /> : <VisibilityIcon sx={{ fontSize: "1.15rem" }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  {aiSettings.provider === "openai_compatible" && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAutoSearchModels}
                      disabled={searchingModels || !aiSettings.apiKey}
                      startIcon={searchingModels ? <CircularProgress size={13} sx={{ color: "#3b82f6" }} /> : <RefreshIcon fontSize="small" />}
                      sx={{
                        color: "#60a5fa",
                        borderColor: "#3b82f6",
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        whiteSpace: "nowrap",
                        px: 2,
                        height: 38,
                        borderRadius: 1,
                        "&:hover": { bgcolor: "rgba(59, 130, 246, 0.1)", borderColor: "#60a5fa" },
                      }}
                    >
                      {searchingModels ? "Searching..." : "Fetch Models"}
                    </Button>
                  )}
                </Box>

                {/* KIE AI: Unified Model Selector (Dropdown) */}
                {aiSettings.provider === "kieai" && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#d4d4d8",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        Model AI KIE (Transkrip &amp; Pengolahan Narasi)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                        1 Model untuk Transkrip &amp; Narasi
                      </Typography>
                    </Box>

                    <FormControl fullWidth size="small">
                      <Select
                        value={aiSettings.highlightModel || "gemini-3-7-flash"}
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          setAiSettings((prev) => ({
                            ...prev,
                            transcribeModel: selectedVal,
                            highlightModel: selectedVal,
                          }));
                        }}
                        sx={{
                          bgcolor: "#14141a",
                          color: "#ffffff",
                          borderRadius: 1,
                          fontSize: "0.8rem",
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6" },
                        }}
                        MenuProps={{
                          slotProps: {
                            paper: {
                              sx: {
                                bgcolor: "#14141a",
                                border: "1px solid #27272a",
                                borderRadius: 1,
                                color: "#ffffff",
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="gemini-3-7-flash" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Gemini 3.7 Flash
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Multimodal cepat &amp; presisi untuk transkrip kata dan pemetaan narasi
                              </Typography>
                            </Box>
                            <Chip label="gemini-3-7-flash" size="small" sx={{ bgcolor: "#1f1f26", color: "#93c5fd", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="gpt-5-6-terra" sx={{ py: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                GPT 5.6 Terra
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Multimodal reasoning terstruktur untuk penemuan hook &amp; topik viral
                              </Typography>
                            </Box>
                            <Chip label="gpt-5-6-terra" size="small" sx={{ bgcolor: "#1f1f26", color: "#93c5fd", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* OPENAI: 3-Variant GPT 5.6 Selector (Dropdown) */}
                {aiSettings.provider === "openai" && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#d4d4d8",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        Model OpenAI GPT-5.6 (Transkrip &amp; Pengolahan Narasi)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                        3 Varian GPT-5.6
                      </Typography>
                    </Box>

                    <FormControl fullWidth size="small">
                      <Select
                        value={aiSettings.highlightModel || "gpt-5-6-terra"}
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          setAiSettings((prev) => ({
                            ...prev,
                            transcribeModel: selectedVal,
                            highlightModel: selectedVal,
                          }));
                        }}
                        sx={{
                          bgcolor: "#14141a",
                          color: "#ffffff",
                          borderRadius: 1,
                          fontSize: "0.8rem",
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#10a37f" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#10a37f" },
                        }}
                        MenuProps={{
                          slotProps: {
                            paper: {
                              sx: {
                                bgcolor: "#14141a",
                                border: "1px solid #27272a",
                                borderRadius: 1,
                                color: "#ffffff",
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="gpt-5-6-terra" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                GPT 5.6 Terra
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Deep reasoning &amp; analisis narasi mendalam tingkat tinggi
                              </Typography>
                            </Box>
                            <Chip label="gpt-5-6-terra" size="small" sx={{ bgcolor: "#1f1f26", color: "#6ee7b7", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="gpt-5-6-sol" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                GPT 5.6 Sol
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Performa seimbang, presisi ekstraksi narasi, dan kecepatan optimal
                              </Typography>
                            </Box>
                            <Chip label="gpt-5-6-sol" size="small" sx={{ bgcolor: "#1f1f26", color: "#6ee7b7", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="gpt-5-6-luna" sx={{ py: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                GPT 5.6 Luna
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Varian ringan, latensi ultra-rendah untuk scanning segmen cepat
                              </Typography>
                            </Box>
                            <Chip label="gpt-5-6-luna" size="small" sx={{ bgcolor: "#1f1f26", color: "#6ee7b7", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* ANTHROPIC: 4-Model Claude Selector (Dropdown) */}
                {aiSettings.provider === "anthropic" && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#d4d4d8",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        Model Claude (Transkrip &amp; Pengolahan Narasi)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                        4 Varian Sonnet &amp; Opus
                      </Typography>
                    </Box>

                    <FormControl fullWidth size="small">
                      <Select
                        value={aiSettings.highlightModel || "claude-sonnet-5"}
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          setAiSettings((prev) => ({
                            ...prev,
                            transcribeModel: selectedVal,
                            highlightModel: selectedVal,
                          }));
                        }}
                        sx={{
                          bgcolor: "#14141a",
                          color: "#ffffff",
                          borderRadius: 1,
                          fontSize: "0.8rem",
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d97757" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#d97757" },
                        }}
                        MenuProps={{
                          slotProps: {
                            paper: {
                              sx: {
                                bgcolor: "#14141a",
                                border: "1px solid #27272a",
                                borderRadius: 1,
                                color: "#ffffff",
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="claude-sonnet-5" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Claude Sonnet 5
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Generasi mutakhir, seimbang, cepat dan presisi tinggi untuk transkrip &amp; hook
                              </Typography>
                            </Box>
                            <Chip label="claude-sonnet-5" size="small" sx={{ bgcolor: "#1f1f26", color: "#fdba74", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="claude-opus-5" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Claude Opus 5
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Kemampuan kognitif puncak dan penalaran paling mendalam untuk narasi kompleks
                              </Typography>
                            </Box>
                            <Chip label="claude-opus-5" size="small" sx={{ bgcolor: "#1f1f26", color: "#fdba74", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="claude-sonnet-4-6" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Claude Sonnet 4.6
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Performa reasoning tangguh dengan latensi rendah untuk segmentasi klip
                              </Typography>
                            </Box>
                            <Chip label="claude-sonnet-4-6" size="small" sx={{ bgcolor: "#1f1f26", color: "#fdba74", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="claude-opus-4-8" sx={{ py: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Claude Opus 4.8
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Analisis konteks luas dan pemetaan narasi mendalam
                              </Typography>
                            </Box>
                            <Chip label="claude-opus-4-8" size="small" sx={{ bgcolor: "#1f1f26", color: "#fdba74", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* GEMINI: 3-Model Selector (Dropdown) */}
                {aiSettings.provider === "gemini" && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#d4d4d8",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        Model Google Gemini (Transkrip &amp; Pengolahan Narasi)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                        3 Model Gemini
                      </Typography>
                    </Box>

                    <FormControl fullWidth size="small">
                      <Select
                        value={aiSettings.highlightModel || "gemini-3.7-flash"}
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          setAiSettings((prev) => ({
                            ...prev,
                            transcribeModel: selectedVal,
                            highlightModel: selectedVal,
                          }));
                        }}
                        sx={{
                          bgcolor: "#14141a",
                          color: "#ffffff",
                          borderRadius: 1,
                          fontSize: "0.8rem",
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#8E75FF" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#8E75FF" },
                        }}
                        MenuProps={{
                          slotProps: {
                            paper: {
                              sx: {
                                bgcolor: "#14141a",
                                border: "1px solid #27272a",
                                borderRadius: 1,
                                color: "#ffffff",
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="gemini-3.7-flash" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Gemini 3.7 Flash
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Generasi mutakhir, ultra-cepat dengan penalaran hybrid untuk transkripsi &amp; hook
                              </Typography>
                            </Box>
                            <Chip label="gemini-3.7-flash" size="small" sx={{ bgcolor: "#1f1f26", color: "#c4b5fd", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="gemini-3.1-pro-preview" sx={{ py: 1, borderBottom: "1px solid #1f1f26" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Gemini 3.1 Pro Preview
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Analisis narasi mendalam, reasoning tingkat tinggi &amp; pemahaman konteks luas
                              </Typography>
                            </Box>
                            <Chip label="gemini-3.1-pro-preview" size="small" sx={{ bgcolor: "#1f1f26", color: "#c4b5fd", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                        <MenuItem value="gemini-3.6-flash" sx={{ py: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#fafafa" }}>
                                Gemini 3.6 Flash
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", display: "block" }}>
                                Performa kilat berbobot ringan, efisiensi optimal untuk pemindaian klip audio
                              </Typography>
                            </Box>
                            <Chip label="gemini-3.6-flash" size="small" sx={{ bgcolor: "#1f1f26", color: "#c4b5fd", fontFamily: "monospace", fontSize: "0.65rem", height: 20, borderRadius: 0.6, ml: 2 }} />
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* CUSTOM PROVIDER: Dual Model Inputs (OpenAI Compatible) */}
                {aiSettings.provider === "openai_compatible" && (
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormField
                        label="Speech-to-Text Model (Audio)"
                        value={aiSettings.transcribeModel}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, transcribeModel: e.target.value }))}
                        placeholder="gemini-2.0-flash / whisper-1"
                        helperText="Digunakan untuk memproses kata-per-kata"
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormField
                        label="Narrative & Highlight Model (LLM)"
                        value={aiSettings.highlightModel}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, highlightModel: e.target.value }))}
                        placeholder="gpt-4o / gemini-1.5-pro / claude-3-5-sonnet"
                        helperText="Digunakan untuk menemukan topik narasi & hook"
                      />
                    </Grid>
                  </Grid>
                )}

                {/* Quick model chips if fetched (only for Custom provider) */}
                {aiSettings.provider === "openai_compatible" && availableModels.length > 0 && (
                  <Box sx={{ p: 1.2, bgcolor: "#0e0e13", border: "1px solid #23232b", borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 0.6, fontSize: "0.68rem" }}>
                      Model Ditemukan dari Provider ({availableModels.length}):
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", maxHeight: 75, overflowY: "auto" }}>
                      {availableModels.slice(0, 15).map((m) => (
                        <Chip
                          key={m}
                          label={m}
                          size="small"
                          onClick={() =>
                            setAiSettings((prev) => ({
                              ...prev,
                              highlightModel: m,
                              ...(prev.provider === "kieai" ? { transcribeModel: m } : {}),
                            }))
                          }
                          sx={{
                            bgcolor: aiSettings.highlightModel === m ? "#3b82f6" : "#181820",
                            color: aiSettings.highlightModel === m ? "#ffffff" : "#a1a1aa",
                            fontSize: "0.68rem",
                            height: 22,
                            borderRadius: 0.6,
                            cursor: "pointer",
                            "&:hover": { color: "#ffffff", bgcolor: "#282834" },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* TAB 1: CONTENT & NARRATIVE SETTINGS */}
          {aiModalTab === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormField
                label="Target Topic / Narrative Prompt (Opsional)"
                multiline
                rows={3}
                placeholder="Contoh: Fokus pada strategi analisis teknikal, manajemen risiko, atau insight motivasi praktis..."
                value={aiSettings.topicPrompt}
                onChange={(e) => setAiSettings((prev) => ({ ...prev, topicPrompt: e.target.value }))}
                helperText="Mengarahkan AI agar memprioritaskan topik atau poin narasi spesifik dari transkrip."
              />

              {/* Target Duration & Max Clips */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.6 }}>
                    Target Durasi per Klip
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.6 }}>
                    {[
                      { id: "short", label: "Short", sub: "30-45s" },
                      { id: "standard", label: "Standard", sub: "45-75s" },
                      { id: "long", label: "Long", sub: "75-120s" },
                    ].map((dur) => {
                      const isSel = aiSettings.targetDuration === dur.id;
                      return (
                        <Box
                          key={dur.id}
                          onClick={() => setAiSettings((prev) => ({ ...prev, targetDuration: dur.id as "short" | "standard" | "long" }))}
                          sx={{
                            flex: 1,
                            py: 1,
                            px: 0.5,
                            textAlign: "center",
                            borderRadius: 0.8,
                            border: isSel ? "1.5px solid #3b82f6" : "1px solid #23232b",
                            bgcolor: isSel ? "rgba(59, 130, 246, 0.12)" : "#16161c",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            "&:hover": { borderColor: isSel ? "#3b82f6" : "#383844" },
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.74rem", color: isSel ? "#ffffff" : "#d4d4d8" }}>
                            {dur.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: isSel ? "#93c5fd" : "#71717a", fontSize: "0.64rem", display: "block" }}>
                            {dur.sub}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.6 }}>
                    Jumlah Maksimal Klip
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.6 }}>
                    {[3, 5, 8, 10].map((num) => {
                      const isSel = aiSettings.maxClipsCount === num;
                      return (
                        <Box
                          key={num}
                          onClick={() => setAiSettings((prev) => ({ ...prev, maxClipsCount: num }))}
                          sx={{
                            flex: 1,
                            py: 1,
                            textAlign: "center",
                            borderRadius: 0.8,
                            border: isSel ? "1.5px solid #3b82f6" : "1px solid #23232b",
                            bgcolor: isSel ? "rgba(59, 130, 246, 0.12)" : "#16161c",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            "&:hover": { borderColor: isSel ? "#3b82f6" : "#383844" },
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.84rem", color: isSel ? "#ffffff" : "#d4d4d8" }}>
                            {num}
                          </Typography>
                          <Typography variant="caption" sx={{ color: isSel ? "#93c5fd" : "#71717a", fontSize: "0.62rem", display: "block" }}>
                            klip
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Grid>
              </Grid>

              {/* Strict Narrative Boundary Card Switch */}
              <Box
                sx={{
                  p: 1.6,
                  bgcolor: "#16161c",
                  border: "1px solid #23232b",
                  borderRadius: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ color: "#fafafa", fontSize: "0.82rem", fontWeight: 700 }}>
                    Strict Narrative Boundary
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem", display: "block", mt: 0.2 }}>
                    Memastikan klip selalu dimulai dari awal pembukaan gagasan dan ditutup setelah kesimpulan utuh (tidak memotong di tengah kalimat).
                  </Typography>
                </Box>
                <Switch
                  size="small"
                  checked={aiSettings.strictBoundary}
                  onChange={(e) => setAiSettings((prev) => ({ ...prev, strictBoundary: e.target.checked }))}
                  sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        {/* Footer */}
        <DialogActions sx={{ p: 2, px: 2.5, borderTop: "1px solid #1f1f26", justifyContent: "space-between", bgcolor: "#0f0f14" }}>
          <Button
            size="small"
            onClick={() => setAiSettingsModalOpen(false)}
            disabled={savingAiSettings}
            sx={{ color: "#a1a1aa", textTransform: "none", fontSize: "0.8rem", "&:hover": { color: "#ffffff" } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveAiSettings}
            disabled={savingAiSettings}
            startIcon={savingAiSettings ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <CheckIcon />}
            sx={{
              bgcolor: "#3b82f6",
              textTransform: "none",
              fontWeight: 800,
              fontSize: "0.82rem",
              px: 3,
              py: 0.7,
              borderRadius: 1,
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            {savingAiSettings ? "Saving Settings..." : "Save Configuration"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#09090c" }}>
          <CircularProgress size={36} sx={{ color: "#3b82f6" }} />
        </Box>
      }
    >
      <StudioContent />
    </Suspense>
  );
}
