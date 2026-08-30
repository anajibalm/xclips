import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Grid,
  TextField,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BoltIcon from "@mui/icons-material/Bolt";
import TuneIcon from "@mui/icons-material/Tune";
import PsychologyIcon from "@mui/icons-material/Psychology";
import TimerIcon from "@mui/icons-material/Timer";
import FilterNoneIcon from "@mui/icons-material/FilterNone";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ClearIcon from "@mui/icons-material/Clear";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { useStudioStore } from "../store/useStudioStore";
import { apiFetch } from "@/lib/api-client";
import { formatTime } from "../types/studio.types";
import { AiProviderType, HOOK_FORMULAS, HookFormulaId } from "@/lib/xclips/types";

const LOCAL_STORAGE_TOPIC_KEY = "xclips_last_topic_prompt";

const PROVIDER_NAMES: Record<AiProviderType, string> = {
  kieai: "KIE AI",
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
  openai_compatible: "Custom Provider",
};

const POPULAR_TOPIC_PRESETS = [
  { id: "insights", label: "Key Insights", prompt: "Focus on the most valuable actionable insights, frameworks, and key lessons." },
  { id: "contrarian", label: "Contrarian Take", prompt: "Focus on controversial viewpoints, myth-busting arguments, and counter-intuitive insights." },
  { id: "story", label: "Story Climax", prompt: "Focus on engaging personal stories, emotional turning points, and dramatic narrative peaks." },
  { id: "step_by_step", label: "Step-by-Step", prompt: "Focus on practical step-by-step instructions, implementation tips, and how-to workflows." },
  { id: "mistakes", label: "Mistakes to Avoid", prompt: "Focus on major pitfalls, critical warnings, and expensive mistakes to avoid." },
  { id: "punchlines", label: "High-Energy", prompt: "Focus on the highest-energy soundbites, memorable punchlines, and powerful quotes." },
];

interface DurationOption {
  id: "short" | "standard" | "long" | "extended";
  label: string;
  sub: string;
  minMasterSec: number;
  avgSec: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { id: "short", label: "Short", sub: "30-45s", minMasterSec: 30, avgSec: 37.5 },
  { id: "standard", label: "Standard", sub: "45-75s", minMasterSec: 45, avgSec: 60 },
  { id: "long", label: "Long", sub: "75-120s", minMasterSec: 75, avgSec: 95 },
  { id: "extended", label: "~3 Min", sub: "120-180s", minMasterSec: 120, avgSec: 150 },
];

export function GenerateAutoClipModal() {
  const isGenerateAutoClipModalOpen = useStudioStore((s) => s.isGenerateAutoClipModalOpen);
  const setIsGenerateAutoClipModalOpen = useStudioStore((s) => s.setIsGenerateAutoClipModalOpen);
  const project = useStudioStore((s) => s.project);
  const transcript = useStudioStore((s) => s.transcript);
  const subtitleTracks = useStudioStore((s) => s.subtitleTracks);
  const isDiscovering = useStudioStore((s) => s.isDiscovering);
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const saveAiSettings = useStudioStore((s) => s.saveAiSettings);
  const handleDiscoverHighlights = useStudioStore((s) => s.handleDiscoverHighlights);

  // Local Form States
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>("kieai");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3-7-flash");
  const [selectedFormula, setSelectedFormula] = useState<HookFormulaId>("auto");
  const [topicPrompt, setTopicPrompt] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<"short" | "standard" | "long" | "extended">("standard");
  const [selectedMaxClips, setSelectedMaxClips] = useState<number>(5);
  const [isDetectingTopic, setIsDetectingTopic] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const videoDurationSec = project?.durationSec || 0;

  // Initialize or restore state when modal opens
  useEffect(() => {
    if (isGenerateAutoClipModalOpen) {
      if (aiSettings) {
        setSelectedProvider(aiSettings.provider || "kieai");
        setSelectedModel(aiSettings.highlightModel || "gemini-3-7-flash");
        setSelectedFormula((aiSettings.hookFormula as HookFormulaId) || "auto");
        setSelectedDuration(aiSettings.targetDuration || "standard");
        setSelectedMaxClips(aiSettings.maxClipsCount || 5);
      }

      // Load autosaved topic prompt from localStorage if available
      try {
        const savedTopic = localStorage.getItem(LOCAL_STORAGE_TOPIC_KEY);
        if (savedTopic && savedTopic.trim()) {
          setTopicPrompt(savedTopic);
        } else if (aiSettings?.topicPrompt) {
          setTopicPrompt(aiSettings.topicPrompt);
        }
      } catch {
        // Ignore localStorage error
      }

      // Default the track selection to the currently active transcript
      setSelectedTrackId(transcript?.id || "");
    }
  }, [isGenerateAutoClipModalOpen, aiSettings, transcript]);

  // Synchronize target duration and max clips constraints based on video duration
  const activeDurationConfig = DURATION_OPTIONS.find((d) => d.id === selectedDuration) || DURATION_OPTIONS[1];
  const maxPossibleClips = videoDurationSec > 0
    ? Math.max(1, Math.floor(videoDurationSec / activeDurationConfig.avgSec))
    : 10;

  // If current duration exceeds video length, downgrade to standard or short
  useEffect(() => {
    if (videoDurationSec > 0 && videoDurationSec < activeDurationConfig.minMasterSec) {
      const validOpt = [...DURATION_OPTIONS].reverse().find((d) => d.minMasterSec <= videoDurationSec);
      if (validOpt) {
        setSelectedDuration(validOpt.id);
      }
    }
  }, [videoDurationSec, activeDurationConfig.minMasterSec]);

  // If current maxClips exceeds maxPossibleClips, adjust downward
  useEffect(() => {
    if (videoDurationSec > 0 && selectedMaxClips > maxPossibleClips) {
      setSelectedMaxClips(Math.max(1, maxPossibleClips));
    }
  }, [maxPossibleClips, selectedMaxClips, videoDurationSec]);

  const handleTopicChange = (val: string) => {
    setTopicPrompt(val);
    try {
      localStorage.setItem(LOCAL_STORAGE_TOPIC_KEY, val);
    } catch {
      // Ignore
    }
  };

  const handleAutoDetectTopic = async () => {
    setIsDetectingTopic(true);
    try {
      const res = await apiFetch<{ ok: boolean; topicPrompt?: string; model?: string }>("/api/xclips/ai/detect-topic", {
        method: "POST",
        body: JSON.stringify({
          projectId: project?.id,
          title: project?.name,
          transcriptText: transcript?.rawText,
          lightModel: aiSettings?.lightModel || "muse-glimmer-30b",
        }),
      });

      if (res.ok && res.data?.topicPrompt) {
        handleTopicChange(res.data.topicPrompt);
        setIsDetectingTopic(false);
        return;
      }
    } catch {
      // Ignore network errors and continue to local fallback
    } finally {
      setIsDetectingTopic(false);
    }

    // Client-side local heuristic fallback
    let detectedTheme = "";
    if (project?.name) {
      const cleanName = project.name
        .replace(/\.(mp4|mkv|webm|mov|avi)$/i, "")
        .replace(/\[[a-zA-Z0-9_-]{11}\]/g, "")
        .replace(/[_-]/g, " ")
        .trim();
      if (cleanName && cleanName.length > 2) {
        detectedTheme = cleanName;
      }
    }

    if (!detectedTheme && transcript?.rawText) {
      const words = transcript.rawText
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4);

      const stopwords = new Set([
        "about", "their", "there", "which", "would", "could", "should",
        "dalam", "dengan", "untuk", "adalah", "karena", "mereka", "secara", "seperti",
        "video", "youtube", "clips", "hello", "welcome", "thanks"
      ]);
      const freq: Record<string, number> = {};
      words.forEach((w) => {
        if (!stopwords.has(w)) {
          freq[w] = (freq[w] || 0) + 1;
        }
      });
      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);

      if (topKeywords.length > 0) {
        detectedTheme = topKeywords.join(", ");
      }
    }

    const autoPrompt = detectedTheme
      ? `Focus on core takeaways, key strategies, and high-impact discussions regarding "${detectedTheme}".`
      : "Focus on key insights, memorable soundbites, and actionable takeaways from this video.";

    handleTopicChange(autoPrompt);
  };

  const handleStartGeneration = async () => {
    // Persist settings
    if (aiSettings) {
      const updatedSettings = {
        ...aiSettings,
        provider: selectedProvider,
        highlightModel: selectedModel,
        hookFormula: selectedFormula,
        topicPrompt,
        targetDuration: selectedDuration,
        maxClipsCount: selectedMaxClips,
      };
      saveAiSettings(updatedSettings);
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_TOPIC_KEY, topicPrompt);
    } catch {
      // Ignore
    }

    // Trigger AI pipeline
    await handleDiscoverHighlights({
      provider: selectedProvider,
      model: selectedModel,
      topicPrompt,
      hookFormula: selectedFormula,
      targetDuration: selectedDuration,
      maxClipsCount: selectedMaxClips,
      transcriptId: selectedTrackId || undefined,
    });
  };

  const activeFormulaDetails = HOOK_FORMULAS.find((f) => f.id === selectedFormula) || HOOK_FORMULAS[0];

  return (
    <Dialog
      open={isGenerateAutoClipModalOpen}
      onClose={() => !isDiscovering && !isTranscribing && setIsGenerateAutoClipModalOpen(false)}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#121216",
            backgroundImage: "none",
            border: "1px solid #27272a",
            borderRadius: 1.5,
            color: "#fafafa",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
          },
        },
      }}
    >
      {/* Modal Header */}
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: 2.5, pb: 1.8, borderBottom: "1px solid #1f1f26" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
            <BoltIcon sx={{ color: "#3b82f6", fontSize: "1.35rem" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "1rem", letterSpacing: "-0.01em" }}>
              Generate Clips
            </Typography>
            <Chip
              label={PROVIDER_NAMES[selectedProvider] || selectedProvider.toUpperCase()}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.68rem",
                fontWeight: 800,
                bgcolor: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 0.8,
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.75rem", display: "block" }}>
            Select viral hook formula, target narrative prompt, and synchronize clip duration with master video.
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setIsGenerateAutoClipModalOpen(false)}
          disabled={isDiscovering || isTranscribing}
          sx={{ color: "#71717a", "&:hover": { color: "#ffffff", bgcolor: "#1f1f26" } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pb: 2.5, pt: "24px !important", display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* SECTION 1: AI MODEL & HOOK FORMULA */}
        <Grid container spacing={2}>
          {/* AI Model Selector */}
          <Grid size={{ xs: 12, sm: 5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <TuneIcon sx={{ fontSize: "0.9rem", color: "#3b82f6" }} />
                <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                  AI Narrative &amp; Highlight Model
                </Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isDiscovering || isTranscribing}
                  sx={{
                    bgcolor: "#14141a",
                    color: "#ffffff",
                    borderRadius: 1,
                    fontSize: "0.8rem",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                  }}
                >
                  <MenuItem value="gemini-3-7-flash">Gemini 3.7 Flash (Recommended)</MenuItem>
                  <MenuItem value="gemini-3-6-flash">Gemini 3.6 Flash</MenuItem>
                  <MenuItem value="gpt-5.6-luna">GPT 5.6 Luna</MenuItem>
                  <MenuItem value="gpt-5-6-terra">GPT 5.6 Terra</MenuItem>
                  <MenuItem value="claude-sonnet-5">Claude Sonnet 5</MenuItem>
                  <MenuItem value="gpt-4o">GPT-4o</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                Processed via {PROVIDER_NAMES[selectedProvider]} provider.
              </Typography>
            </Box>
          </Grid>

          {/* Hook Matrix Formula Dropdown */}
          <Grid size={{ xs: 12, sm: 7 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <PsychologyIcon sx={{ fontSize: "0.9rem", color: "#e0392b" }} />
                <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                  Hook Matrix
                </Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedFormula}
                  onChange={(e) => setSelectedFormula(e.target.value as HookFormulaId)}
                  disabled={isDiscovering || isTranscribing}
                  sx={{
                    bgcolor: "#14141a",
                    color: "#ffffff",
                    borderRadius: 1,
                    fontSize: "0.8rem",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                  }}
                >
                  {HOOK_FORMULAS.map((formula) => (
                    <MenuItem key={formula.id} value={formula.id}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                        <span style={{ fontWeight: 700 }}>{formula.name}</span>
                        <span style={{ fontSize: "0.7rem", color: "#71717a" }}>{formula.sub}</span>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.2 }}>
                <Chip
                  label={`Target Emotion: ${activeFormulaDetails.emotion}`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(224, 57, 43, 0.12)",
                    color: "#f87171",
                    fontSize: "0.68rem",
                    height: 20,
                    borderRadius: 0.8,
                    border: "1px solid rgba(224, 57, 43, 0.25)",
                  }}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* SECTION 1.5: SOURCE TRANSCRIPT TRACK SELECTION */}
        {subtitleTracks.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <SubtitlesIcon sx={{ fontSize: "0.9rem", color: "#22d3ee" }} />
              <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                Source Transcript Track
              </Typography>
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={selectedTrackId || (subtitleTracks[0]?.id ?? "")}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                disabled={isDiscovering || isTranscribing}
                renderValue={(selected) => {
                  const track = subtitleTracks.find((t) => t.id === selected);
                  if (!track) return <span style={{ color: "#71717a" }}>Select transcript track...</span>;
                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {track.sourceType === "youtube_cc" ? (
                        <YouTubeIcon sx={{ fontSize: "1rem", color: "#ef4444" }} />
                      ) : (
                        <AutoAwesomeIcon sx={{ fontSize: "1rem", color: "#a855f7" }} />
                      )}
                      <span style={{ fontWeight: 700, color: "#ffffff" }}>
                        {track.label || (track.sourceType === "youtube_cc" ? "YouTube CC" : "AI Subtitle")}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#71717a" }}>
                        {track.words?.length || 0} words
                      </span>
                    </Box>
                  );
                }}
                sx={{
                  bgcolor: "#14141a",
                  color: "#ffffff",
                  borderRadius: 1,
                  fontSize: "0.8rem",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                }}
              >
                {subtitleTracks.map((track) => (
                  <MenuItem
                    key={track.id}
                    value={track.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {track.sourceType === "youtube_cc" ? (
                        <YouTubeIcon sx={{ fontSize: "1rem", color: "#ef4444" }} />
                      ) : (
                        <AutoAwesomeIcon sx={{ fontSize: "1rem", color: "#a855f7" }} />
                      )}
                      <span>{track.label || (track.sourceType === "youtube_cc" ? "YouTube CC" : "AI Subtitle")}</span>
                    </Box>
                    <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                      {track.words?.length || 0} words
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
              The selected track's words and timing are used for clip discovery and subtitle burn-in.
            </Typography>
          </Box>
        )}

        {/* SECTION 2: TARGET TOPIC / NARRATIVE PROMPT (AUTOSAVED) */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <FlashOnIcon sx={{ fontSize: "0.9rem", color: "#facc15" }} />
              <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                Target Topic / Narrative Prompt (Optional)
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleAutoDetectTopic}
                disabled={isDiscovering || isTranscribing || isDetectingTopic}
                startIcon={
                  isDetectingTopic ? (
                    <CircularProgress size={12} sx={{ color: "#60a5fa" }} />
                  ) : (
                    <AutoAwesomeIcon sx={{ fontSize: "0.85rem", color: "#60a5fa" }} />
                  )
                }
                sx={{
                  py: 0.2,
                  px: 1,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: 0.8,
                  borderColor: "rgba(59, 130, 246, 0.4)",
                  color: "#93c5fd",
                  bgcolor: "rgba(59, 130, 246, 0.08)",
                  "&:hover": {
                    borderColor: "#3b82f6",
                    bgcolor: "rgba(59, 130, 246, 0.18)",
                  },
                }}
              >
                {isDetectingTopic ? "Detecting..." : "Auto-Detect from Video"}
              </Button>
              {topicPrompt.trim().length > 0 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handleTopicChange("")}
                  startIcon={<ClearIcon sx={{ fontSize: "0.75rem" }} />}
                  sx={{
                    py: 0.2,
                    px: 0.8,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "none",
                    color: "#71717a",
                    "&:hover": { color: "#ef4444" },
                  }}
                >
                  Clear
                </Button>
              )}
              <Chip
                label="Autosaved"
                size="small"
                sx={{
                  bgcolor: "rgba(34, 197, 94, 0.12)",
                  color: "#4ade80",
                  fontSize: "0.65rem",
                  height: 18,
                  borderRadius: 0.6,
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              />
            </Box>
          </Box>

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2.2}
            placeholder="e.g. Focus on key risk management insights, market structure analysis, or motivational takeaways..."
            value={topicPrompt}
            onChange={(e) => handleTopicChange(e.target.value)}
            disabled={isDiscovering || isTranscribing}
            sx={{
              "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: 0.8 },
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0d0d10",
                borderRadius: 1,
                "& fieldset": { borderColor: "#27272a" },
                "&:hover fieldset": { borderColor: "#3f3f46" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
              },
            }}
          />

          {/* Quick Topic Preset Suggestion Chips */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap", mt: 0.2 }}>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem", fontWeight: 600, mr: 0.4 }}>
              Quick Suggestions:
            </Typography>
            {POPULAR_TOPIC_PRESETS.map((preset) => {
              const isSelected = topicPrompt === preset.prompt;
              return (
                <Chip
                  key={preset.id}
                  label={preset.label}
                  size="small"
                  onClick={() => handleTopicChange(preset.prompt)}
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: isSelected ? 700 : 500,
                    height: 22,
                    cursor: "pointer",
                    bgcolor: isSelected ? "rgba(59, 130, 246, 0.2)" : "#141418",
                    color: isSelected ? "#60a5fa" : "#a1a1aa",
                    border: isSelected ? "1px solid #3b82f6" : "1px solid #27272a",
                    borderRadius: 0.6,
                    "&:hover": {
                      bgcolor: "rgba(59, 130, 246, 0.12)",
                      color: "#ffffff",
                      borderColor: "#3f3f46",
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* SECTION 3: TARGET DURATION & SMART MAX CLIPS CONSTRAINT */}
        <Grid container spacing={2}>
          {/* Target Duration */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.8 }}>
              <TimerIcon sx={{ fontSize: "0.9rem", color: "#60a5fa" }} />
              <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                Target Duration per Clip
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 0.6 }}>
              {DURATION_OPTIONS.map((dur) => {
                const isSel = selectedDuration === dur.id;
                const isDisabled = videoDurationSec > 0 && videoDurationSec < dur.minMasterSec;

                return (
                  <Tooltip
                    key={dur.id}
                    title={isDisabled ? `Video (${formatTime(videoDurationSec)}) is shorter than ${dur.minMasterSec}s` : ""}
                    placement="top"
                  >
                    <Box
                      onClick={() => !isDisabled && setSelectedDuration(dur.id)}
                      sx={{
                        flex: 1,
                        py: 1,
                        px: 0.4,
                        textAlign: "center",
                        borderRadius: 0.8,
                        border: isSel ? "1.5px solid #3b82f6" : "1px solid #23232b",
                        bgcolor: isSel ? "rgba(59, 130, 246, 0.12)" : "#141418",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.35 : 1,
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: isDisabled ? "#23232b" : isSel ? "#3b82f6" : "#3f3f46",
                        },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.72rem", color: isSel ? "#ffffff" : "#d4d4d8" }}>
                        {dur.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isSel ? "#93c5fd" : "#71717a", fontSize: "0.62rem", display: "block" }}>
                        {dur.sub}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Grid>

          {/* Max Clips Constraint */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <FilterNoneIcon sx={{ fontSize: "0.9rem", color: "#a78bfa" }} />
                <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                  Maximum Clips Count
                </Typography>
              </Box>
              {videoDurationSec > 0 && (
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.68rem" }}>
                  Max: ~{maxPossibleClips} clips
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {[1, 2, 3, 5, 8, 12].map((num) => {
                const isSel = selectedMaxClips === num;
                const isDisabled = videoDurationSec > 0 && num > maxPossibleClips && num !== 1;

                return (
                  <Button
                    key={num}
                    variant={isSel ? "contained" : "outlined"}
                    size="small"
                    disabled={isDisabled || isDiscovering || isTranscribing}
                    onClick={() => setSelectedMaxClips(num)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      p: 0.6,
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      bgcolor: isSel ? "#3b82f6" : "#141418",
                      borderColor: isSel ? "#3b82f6" : "#23232b",
                      color: isSel ? "#ffffff" : isDisabled ? "#52525b" : "#a1a1aa",
                    }}
                  >
                    {num}
                  </Button>
                );
              })}
            </Box>
          </Grid>
        </Grid>

        {/* Informative Synchronized Banner */}
        <Box
          sx={{
            p: 1.2,
            px: 1.6,
            bgcolor: "#111116",
            border: "1px solid #23232b",
            borderRadius: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              Master Duration: <strong style={{ color: "#ffffff" }}>{videoDurationSec > 0 ? formatTime(videoDurationSec) : "Calculating..."}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              · Target: <strong style={{ color: "#93c5fd" }}>{activeDurationConfig.label} ({activeDurationConfig.sub})</strong>
            </Typography>
          </Box>
          {!transcript && (
            <Chip
              label="Auto-Transcribe Active"
              size="small"
              sx={{
                bgcolor: "rgba(234, 179, 8, 0.12)",
                color: "#facc15",
                fontSize: "0.65rem",
                height: 20,
                borderRadius: 0.6,
                border: "1px solid rgba(234, 179, 8, 0.25)",
              }}
            />
          )}
        </Box>
      </DialogContent>

      {/* Modal Actions */}
      <DialogActions sx={{ p: 2, px: 2.5, borderTop: "1px solid #1f1f26", display: "flex", justifyContent: "space-between" }}>
        <Button
          onClick={() => setIsGenerateAutoClipModalOpen(false)}
          disabled={isDiscovering || isTranscribing}
          sx={{ color: "#a1a1aa", textTransform: "none", fontWeight: 700, fontSize: "0.8rem", "&:hover": { color: "#ffffff" } }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleStartGeneration}
          disabled={isDiscovering || isTranscribing}
          startIcon={
            isDiscovering || isTranscribing ? (
              <CircularProgress size={14} sx={{ color: "#ffffff" }} />
            ) : (
              <BoltIcon />
            )
          }
          sx={{
            bgcolor: "#3b82f6",
            fontWeight: 800,
            textTransform: "none",
            px: 2.5,
            py: 0.8,
            borderRadius: 1,
            fontSize: "0.82rem",
            "&:hover": { bgcolor: "#2563eb" },
          }}
        >
          {isTranscribing
            ? "Transcribing Audio..."
            : isDiscovering
            ? "Scanning & Analyzing Clips..."
            : "Start Scan & Generate Clips"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
