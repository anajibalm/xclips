import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import { WordTimestamp } from "@/lib/xclips/types";

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

function formatAudioTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function AudioWaveformPlayer({
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
          const energy = 0.65 * barPeak + 0.35 * barRms;
          rawPeaks[i] = energy;

          if (energy > globalMax) globalMax = energy;
          if (energy < globalMin) globalMin = energy;
        }

        const threshold = Math.max(0.012, globalMin + 0.06 * (globalMax - globalMin));
        const dynamicRange = Math.max(0.001, globalMax - threshold);

        const processedPeaks: number[] = new Array(NUM_BARS);
        for (let i = 0; i < NUM_BARS; i++) {
          const raw = rawPeaks[i];
          if (raw <= threshold) {
            processedPeaks[i] = 0.04;
          } else {
            const norm = Math.min(1.0, (raw - threshold) / dynamicRange);
            processedPeaks[i] = 0.06 + 0.94 * Math.pow(norm, 1.5);
          }
        }

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
          setError(`Failed to load audio visualization: ${msg}`);
        }
      }
    };

    loadAndProcessAudio();

    return () => {
      isMounted = false;
    };
  }, [audioUrl, retryKey, durationSec]);

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

  const handleJumpToNextFiller = () => {
    if (fillerMarkers.length === 0) return;
    const nextFiller = fillerMarkers.find((f) => f.startSec > audioCurrentTime + 0.1) || fillerMarkers[0];
    seekToTime(nextFiller.startSec);
  };

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

    if (showFillers && fillerMarkers.length > 0 && audioTotalDuration > 0) {
      fillerMarkers.forEach((f) => {
        const startX = (f.startSec / audioTotalDuration) * width;
        const endX = Math.max(startX + 4, (f.endSec / audioTotalDuration) * width);
        ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
        ctx.fillRect(startX, 0, endX - startX, height);
      });
    }

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + barGap);
      const barHeight = Math.max(4, peaks[i] * height * 0.88);
      const y = (height - barHeight) / 2;

      const isPassed = x <= currentX;
      ctx.fillStyle = isPassed ? "#10b981" : "#334155";
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [peaks, audioCurrentTime, audioTotalDuration, showFillers, fillerMarkers]);

  return (
    <Box sx={{ p: 2, bgcolor: "#141418", borderRadius: 1.5, border: "1px solid #27272a" }}>
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        style={{ display: "none" }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<RecordVoiceOverIcon sx={{ fontSize: "0.85rem !important", color: "#10b981" }} />}
            label="Speech Envelope (RMS)"
            size="small"
            sx={{ bgcolor: "rgba(16, 185, 129, 0.12)", color: "#34d399", fontWeight: 700, fontSize: "0.68rem" }}
          />

          {fillerMarkers.length > 0 && (
            <Tooltip title="Click to jump to next filler word">
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
            label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.7rem" }}>Highlight Fillers</Typography>}
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
          <Box sx={{ display: "flex", alignItems: "center", mechanical: "center", justifyContent: "center", gap: 1 }}>
            <CircularProgress size={16} sx={{ color: "#10b981" }} />
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              Analyzing vocals & isolating audio waveform...
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
              Retry
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
