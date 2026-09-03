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
  ListSubheader,
  Alert,
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
import LanguageIcon from "@mui/icons-material/Language";
import SettingsIcon from "@mui/icons-material/Settings";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useStudioStore } from "../store/useStudioStore";
import { apiFetch } from "@/lib/api-client";
import { formatTime } from "../types/studio.types";
import { AiProviderType, HOOK_FORMULAS, HookFormulaId, SUPPORTED_OUTPUT_LANGUAGES, AI_PROVIDER_MODELS } from "@/lib/xclips/types";

const LOCAL_STORAGE_TOPIC_KEY = "xclips_last_topic_prompt";

const PROVIDER_NAMES: Record<AiProviderType, string> = {
  kieai: "KIE AI",
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
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
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);

  // Local Form States
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>("kieai");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3-7-flash-openai");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [selectedFormula, setSelectedFormula] = useState<HookFormulaId>("auto");
  const [topicPrompt, setTopicPrompt] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<"short" | "standard" | "long" | "extended">("standard");
  const [selectedMaxClips, setSelectedMaxClips] = useState<number>(5);
  const [isDetectingTopic, setIsDetectingTopic] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const videoDurationSec = project?.durationSec || 0;

  const isProviderConfigured = (prov: AiProviderType): boolean => {
    if (!aiSettings) return false;
    const keyInMap = aiSettings.apiKeys?.[prov];
    if (keyInMap && keyInMap.trim().length > 0) return true;
    if (aiSettings.provider === prov && aiSettings.apiKey && aiSettings.apiKey.trim().length > 0) return true;
    return false;
  };

  // Initialize or restore state when modal opens
  useEffect(() => {
    if (isGenerateAutoClipModalOpen) {
      if (aiSettings) {
        const prov = (aiSettings.provider || "kieai") as AiProviderType;
        setSelectedProvider(prov);
        const defaultModel = aiSettings.highlightModel || "gemini-3-7-flash-openai";
        setSelectedModel(defaultModel);
        setSelectedLanguage(aiSettings.outputLanguage || "auto");
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
    : 5;

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

  const handleTopicChange = (newVal: string) => {
    setTopicPrompt(newVal);
    try {
      localStorage.setItem(LOCAL_STORAGE_TOPIC_KEY, newVal);
    } catch {
      // Ignore
    }
  };

  const handleApplyPreset = (presetPrompt: string) => {
    handleTopicChange(presetPrompt);
  };

  const handleDetectTopic = async () => {
    if (!project) return;
    setIsDetectingTopic(true);

    try {
      const res = await apiFetch<{ ok: boolean; topicPrompt?: string; message?: string }>(
        "/api/xclips/ai/detect-topic",
        {
          method: "POST",
          body: JSON.stringify({
            projectId: project.id,
            title: project.name,
            transcriptText: transcript?.rawText || "",
            lightModel: aiSettings?.lightModel || "muse-glimmer-30b",
            outputLanguage: selectedLanguage,
          }),
        }
      );

      if (res.ok && res.data?.topicPrompt) {
        handleTopicChange(res.data.topicPrompt);
      }
    } catch {
      // Ignore
    } finally {
      setIsDetectingTopic(false);
    }
  };

  const handleStartGeneration = async () => {
    setIsGenerateAutoClipModalOpen(false);
    if (aiSettings) {
      await saveAiSettings({
        ...aiSettings,
        provider: selectedProvider,
        highlightModel: selectedModel,
        hookFormula: selectedFormula,
        topicPrompt,
        targetDuration: selectedDuration,
        maxClipsCount: selectedMaxClips,
        outputLanguage: selectedLanguage,
      });
    }

    await handleDiscoverHighlights({
      provider: selectedProvider,
      model: selectedModel,
      hookFormula: selectedFormula,
      topicPrompt,
      targetDuration: selectedDuration,
      maxClipsCount: selectedMaxClips,
      transcriptId: selectedTrackId || transcript?.id,
      outputLanguage: selectedLanguage,
    });
  };

  const activeFormulaDetails = HOOK_FORMULAS.find((f) => f.id === selectedFormula) || HOOK_FORMULAS[0];

  return (
    <Dialog
      open={isGenerateAutoClipModalOpen}
      onClose={() => !isDiscovering && !isTranscribing && setIsGenerateAutoClipModalOpen(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#09090b",
            border: "1px solid #27272a",
            borderRadius: 1.5,
            backgroundImage: "none",
            color: "#fafafa",
          },
        },
      }}
    >
      <DialogTitle sx={{ px: 2.5, pt: 2, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1f1f24" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FlashOnIcon sx={{ color: "#3b82f6", fontSize: "1.2rem" }} />
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem", color: "#ffffff" }}>
              Generate AutoClips (Viral Studio)
            </Typography>
            <Chip
              label={PROVIDER_NAMES[selectedProvider]}
              size="small"
              sx={{
                bgcolor: "rgba(59, 130, 246, 0.12)",
                color: "#60a5fa",
                fontWeight: 700,
                fontSize: "0.68rem",
                height: 20,
                borderRadius: 0.8,
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.75rem", display: "block" }}>
            Select your preferred AI engine and narrative style to generate viral content.
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setIsGenerateAutoClipModalOpen(false)}
          disabled={isDiscovering || isTranscribing}
          sx={{ color: "#71717a", "&:hover": { color: "#ffffff", bgcolor: "#1f1f24" } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pb: 2.5, pt: "24px !important", display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* SECTION 1: AI MODEL, OUTPUT LANGUAGE & HOOK FORMULA */}
        <Grid container spacing={2}>
          {/* AI Model Selector */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <TuneIcon sx={{ fontSize: "0.9rem", color: "#3b82f6" }} />
                  <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                    AI Model
                  </Typography>
                </Box>
                <Chip
                  label={PROVIDER_NAMES[selectedProvider]}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    bgcolor: isProviderConfigured(selectedProvider) ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: isProviderConfigured(selectedProvider) ? "#34d399" : "#f87171",
                    border: `1px solid ${isProviderConfigured(selectedProvider) ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  }}
                />
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={`${selectedProvider}::${selectedModel}`}
                  onChange={(e) => {
                    const parts = (e.target.value as string).split("::");
                    if (parts.length === 2) {
                      setSelectedProvider(parts[0] as AiProviderType);
                      setSelectedModel(parts[1]);
                    }
                  }}
                  disabled={isDiscovering || isTranscribing}
                  sx={{
                    bgcolor: "#14141a",
                    color: "#ffffff",
                    borderRadius: 1,
                    fontSize: "0.8rem",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                  }}
                  MenuProps={{
                    slotProps: {
                      paper: {
                        sx: {
                          bgcolor: "#14141a",
                          border: "1px solid #27272a",
                          color: "#ffffff",
                          maxHeight: 380,
                          "& .MuiList-root": {
                            py: 0,
                          },
                        },
                      },
                    },
                  }}
                >
                  {(["kieai", "openai", "anthropic", "gemini"] as AiProviderType[]).map((prov) => {
                    const configured = isProviderConfigured(prov);
                    const models = AI_PROVIDER_MODELS[prov]?.filter((m) => !m.isTranscribe) || [];
                    if (models.length === 0) return null;

                    return [
                      <ListSubheader
                        key={`header-${prov}`}
                        sx={{
                          bgcolor: "#1e1e28",
                          color: configured ? "#93c5fd" : "#a1a1aa",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.03em",
                          lineHeight: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          px: 1.5,
                          borderTop: "1px solid #27272a",
                          borderBottom: "1px solid #27272a",
                          "&:first-of-type": {
                            borderTop: "none",
                          },
                        }}
                      >
                        <span>{PROVIDER_NAMES[prov]}</span>
                        <Chip
                          label={configured ? "Key Configured" : "Key Not Set"}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            bgcolor: configured ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)",
                            color: configured ? "#34d399" : "#f87171",
                          }}
                        />
                      </ListSubheader>,
                      ...models.map((m) => (
                        <MenuItem
                          key={`${prov}::${m.id}`}
                          value={`${prov}::${m.id}`}
                          sx={{
                            fontSize: "0.78rem",
                            py: 0.8,
                            px: 1.8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            "&.Mui-selected": {
                              bgcolor: "rgba(59, 130, 246, 0.18)",
                              color: "#60a5fa",
                              fontWeight: 700,
                            },
                            "&:hover": {
                              bgcolor: "#242432",
                            },
                          }}
                        >
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.15, minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.79rem", fontWeight: m.recommended ? 700 : 500 }}>
                              {m.name}
                            </Typography>
                            {m.desc && (
                              <Typography variant="caption" sx={{ fontSize: "0.66rem", color: "#71717a", whiteSpace: "normal" }}>
                                {m.desc}
                              </Typography>
                            )}
                          </Box>
                          {m.recommended && (
                            <Chip
                              label="Best"
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                bgcolor: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </MenuItem>
                      )),
                    ];
                  })}
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                  Provider: <strong style={{ color: "#93c5fd" }}>{PROVIDER_NAMES[selectedProvider]}</strong>
                </Typography>
                {!isProviderConfigured(selectedProvider) && (
                  <Button
                    size="small"
                    startIcon={<SettingsIcon sx={{ fontSize: "0.75rem !important" }} />}
                    onClick={() => setAiSettingsModalOpen(true)}
                    sx={{
                      p: 0,
                      minWidth: "auto",
                      textTransform: "none",
                      fontSize: "0.68rem",
                      color: "#f87171",
                      fontWeight: 700,
                      "&:hover": { textDecoration: "underline", bgcolor: "transparent" },
                    }}
                  >
                    Set Key
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Output Language Selector */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <LanguageIcon sx={{ fontSize: "0.9rem", color: "#10b981" }} />
                <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                  Output Language
                </Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
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
                  {SUPPORTED_OUTPUT_LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                Title, Hook &amp; Summary
              </Typography>
            </Box>
          </Grid>

          {/* Hook Matrix Formula Dropdown */}
          <Grid size={{ xs: 12 }}>
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
                      <span style={{ fontWeight: 700 }}>{formula.name}</span>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.2 }}>
                <Chip
                  label={activeFormulaDetails.emotion}
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
                onClick={handleDetectTopic}
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
