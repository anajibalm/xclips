"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  TextField,
  LinearProgress,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Alert,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import YouTubeIcon from "@mui/icons-material/YouTube";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useStudioStore } from "../store/useStudioStore";
import { AiProviderType, XclipsTranscript } from "@/lib/xclips/types";

export type ModelCategory = "multimodal" | "transcribe";

interface TranscribeModelOption {
  id: string;
  name: string;
  provider: AiProviderType;
  category: ModelCategory;
  description: string;
}

interface ProviderGroup {
  provider: AiProviderType;
  label: string;
  models: TranscribeModelOption[];
}

const PROVIDER_TRANSCRIBE_GROUPS: ProviderGroup[] = [
  {
    provider: "kieai",
    label: "KIE AI (Multimodal Audio)",
    models: [
      {
        id: "gemini-3-6-flash",
        name: "gemini-3-6-flash",
        provider: "kieai",
        category: "multimodal",
        description: "High-speed balanced multimodal transcribe (Recommended)",
      },
      {
        id: "gemini-3-7-flash",
        name: "gemini-3-7-flash",
        provider: "kieai",
        category: "multimodal",
        description: "Multimodal audio native reasoning + word timestamps",
      },
    ],
  },
  {
    provider: "gemini",
    label: "Google Gemini (Multimodal Audio)",
    models: [
      {
        id: "gemini-3.5-transcribe",
        name: "gemini-3.5-transcribe",
        provider: "gemini",
        category: "multimodal",
        description: "Gemini 3.5 dedicated audio transcribe model",
      },
      {
        id: "gemini-3.7-flash",
        name: "gemini-3.7-flash",
        provider: "gemini",
        category: "multimodal",
        description: "Fast multimodal audio processing with high precision",
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "gemini-3.1-pro-preview",
        provider: "gemini",
        category: "multimodal",
        description: "Pro reasoning multimodal audio transcribe",
      },
      {
        id: "gemini-3.6-flash",
        name: "gemini-3.6-flash",
        provider: "gemini",
        category: "multimodal",
        description: "Balanced speed & accuracy multimodal transcribe",
      },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI (Audio Transcribe)",
    models: [
      {
        id: "gpt-transcribe",
        name: "gpt-transcribe",
        provider: "openai",
        category: "transcribe",
        description: "OpenAI high-speed Speech-to-Text transcriber",
      },
      {
        id: "whisper-1",
        name: "whisper-1",
        provider: "openai",
        category: "transcribe",
        description: "Industry-standard OpenAI Whisper Speech-to-Text",
      },
      {
        id: "gpt-4o-transcribe",
        name: "gpt-4o-transcribe",
        provider: "openai",
        category: "multimodal",
        description: "GPT-4o multimodal audio reasoning & transcription",
      },
      {
        id: "gpt-4o-mini-transcribe",
        name: "gpt-4o-mini-transcribe",
        provider: "openai",
        category: "multimodal",
        description: "Lightweight GPT-4o mini audio transcription",
      },
    ],
  },
];

export function GenerateSubtitleModal() {
  const isOpen = useStudioStore((s) => s.isGenerateSubtitleModalOpen);
  const setIsOpen = useStudioStore((s) => s.setIsGenerateSubtitleModalOpen);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const project = useStudioStore((s) => s.project);
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const isFetchingYtSubtitles = useStudioStore((s) => s.isFetchingYtSubtitles);
  const availableTranscribeModels = useStudioStore((s) => s.availableTranscribeModels);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const subtitleTracks = useStudioStore((s) => s.subtitleTracks);
  const activeTranscript = useStudioStore((s) => s.transcript);
  const fetchAiSettings = useStudioStore((s) => s.fetchAiSettings);

  const handleTranscribe = useStudioStore((s) => s.handleTranscribe);
  const handleFetchYouTubeSubtitles = useStudioStore((s) => s.handleFetchYouTubeSubtitles);
  const handleSwitchSubtitleTrack = useStudioStore((s) => s.handleSwitchSubtitleTrack);
  const handleDeleteSubtitleTrack = useStudioStore((s) => s.handleDeleteSubtitleTrack);

  const [mode, setMode] = useState<"ai" | "youtube">("ai");
  // Composite model identifier: `${provider}:${modelId}`
  const [selectedCompositeValue, setSelectedCompositeValue] = useState<string>("kieai:gemini-3-7-flash");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<XclipsTranscript | null>(null);
  const [isDeletingTrack, setIsDeletingTrack] = useState<boolean>(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  const isYouTubeProject =
    project?.sourceType === "youtube" ||
    (project?.sourcePath && /youtube|youtu\.be|\[[a-zA-Z0-9_-]{11}\]/i.test(project.sourcePath));

  const isBusy = isTranscribing || isFetchingYtSubtitles;

  // Strict per-provider API key check (no cross-provider leaks)
  const hasProviderApiKey = (p: AiProviderType): boolean => {
    let settings = aiSettings;
    if (!settings && typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("xclips_ai_settings_cache");
        if (cached) settings = JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    // 1. Direct provider key in apiKeys map
    const directKey = settings?.apiKeys?.[p];
    if (directKey && directKey.trim().length > 0) return true;

    // 2. Active provider matching p with root apiKey
    if (settings?.provider === p && settings?.apiKey && settings.apiKey.trim().length > 0) {
      return true;
    }

    return false;
  };

  // Dynamically compute groups combining base presets + configured transcribe model + fetched models
  const computedGroups = useMemo(() => {
    const groups: ProviderGroup[] = JSON.parse(JSON.stringify(PROVIDER_TRANSCRIBE_GROUPS));

    // Incorporate configured transcribeModel from AI Settings
    if (aiSettings?.transcribeModel && aiSettings.transcribeModel.trim()) {
      const modelId = aiSettings.transcribeModel.trim();
      const currentProv = aiSettings.provider || "kieai";
      const targetGroup = groups.find((g) => g.provider === currentProv) || groups[0];

      const alreadyExists = groups.some((g) => g.models.some((m) => m.id === modelId));
      if (!alreadyExists && targetGroup) {
        const isMulti = modelId.includes("gemini") || modelId.includes("4o");
        targetGroup.models.push({
          id: modelId,
          name: modelId,
          provider: currentProv,
          category: isMulti ? "multimodal" : "transcribe",
          description: isMulti ? "Multimodal audio model" : "Dedicated transcribe model",
        });
      }
    }

    return groups;
  }, [aiSettings]);

  // Extract currently selected provider and model ID
  const { selectedProvider, selectedModelId } = useMemo(() => {
    if (selectedCompositeValue && selectedCompositeValue.includes(":")) {
      const [prov, ...rest] = selectedCompositeValue.split(":");
      return {
        selectedProvider: prov as AiProviderType,
        selectedModelId: rest.join(":"),
      };
    }
    return {
      selectedProvider: (aiSettings?.provider || "kieai") as AiProviderType,
      selectedModelId: selectedCompositeValue || "gemini-3-7-flash",
    };
  }, [selectedCompositeValue, aiSettings]);

  const isCurrentSelectedProviderHasKey = hasProviderApiKey(selectedProvider);

  // Auto-fill sequential Track-N label & pick best initial model on modal open transition
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      prevIsOpenRef.current = true;
      fetchAiSettings();
      if (!isBusy) {
        setModalError(null);
        setProgress(0);
        setProgressStage("");
      }

      // Sequential Track label
      let maxNum = subtitleTracks.length;
      for (const t of subtitleTracks) {
        const match = t.label?.match(/^Track-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= maxNum) maxNum = num;
        }
      }
      setCustomLabel(`Track-${maxNum + 1}`);

      // Pick default model: Check active provider in aiSettings first
      const activeProv = aiSettings?.provider || "openai";
      const configuredModel = aiSettings?.transcribeModel;
      let initialComposite = "";

      // 1. Try active provider's configured model or first model
      const activeGroup = computedGroups.find((g) => g.provider === activeProv);
      if (activeGroup && hasProviderApiKey(activeProv)) {
        const matchedModel = activeGroup.models.find((m) => m.id === configuredModel) || activeGroup.models[0];
        if (matchedModel) {
          initialComposite = `${activeProv}:${matchedModel.id}`;
        }
      }

      // 2. Otherwise search other groups that have active API keys
      if (!initialComposite) {
        for (const group of computedGroups) {
          if (hasProviderApiKey(group.provider) && group.models.length > 0) {
            initialComposite = `${group.provider}:${group.models[0].id}`;
            break;
          }
        }
      }

      // 3. Fallback default
      if (!initialComposite) {
        initialComposite = `${activeProv}:${configuredModel || (activeProv === "openai" ? "gpt-transcribe" : "gemini-3-7-flash")}`;
      }

      setSelectedCompositeValue(initialComposite);
    } else if (!isOpen) {
      prevIsOpenRef.current = false;
    }
  }, [isOpen]);

  // Smooth progress animation while busy (monotonic, strictly increasing)
  useEffect(() => {
    if (isBusy) {
      setProgress((prev) => (prev <= 0 ? 15 : prev));
      setProgressStage(mode === "youtube" ? "Downloading YouTube subtitles..." : "Extracting audio & preparing payload...");
      const startTime = Date.now();

      progressTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (mode === "youtube") {
          if (elapsed < 2) {
            setProgress((prev) => Math.max(prev, Math.min(50, 15 + elapsed * 20)));
            setProgressStage("Downloading CC subtitle file...");
          } else {
            setProgress((prev) => Math.max(prev, Math.min(92, 50 + (elapsed - 2) * 8)));
            setProgressStage("Parsing word timestamps...");
          }
        } else {
          if (elapsed < 3) {
            setProgress((prev) => Math.max(prev, Math.min(32, 15 + elapsed * 6)));
            setProgressStage("Extracting & compressing local audio...");
          } else if (elapsed < 18) {
            setProgress((prev) => Math.max(prev, Math.min(76, 32 + (elapsed - 3) * 3)));
            setProgressStage("Transcribing word-level speech...");
          } else if (elapsed < 45) {
            setProgress((prev) => Math.max(prev, Math.min(94, 76 + (elapsed - 18) * 0.7)));
            setProgressStage("Processing timestamps & segmentation...");
          } else {
            setProgress((prev) => Math.max(prev, Math.min(98, 94 + (elapsed - 45) * 0.1)));
            setProgressStage("Saving new subtitle track...");
          }
        }
      }, 250);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isBusy, mode]);

  const handleClose = () => {
    if (isBusy) return;
    setIsOpen(false);
  };

  const handleStart = async () => {
    setModalError(null);
    if (mode === "youtube") {
      const res = await handleFetchYouTubeSubtitles();
      if (res && !res.ok) {
        setProgress(0);
        setModalError(res.message || "Failed to load YouTube subtitles. Ensure the video has closed captions.");
      }
    } else {
      const label = customLabel.trim() || `Track-${subtitleTracks.length + 1}`;
      const res = await handleTranscribe(selectedModelId, label, selectedProvider);
      if (res && !res.ok) {
        setProgress(0);
        setModalError(res.message || "Failed to run AI transcription. Check your connection or API Key.");
      }
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#121216",
            backgroundImage: "none",
            color: "#f4f4f5",
            border: "1px solid #27272a",
            borderRadius: 2.5,
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1.5,
          borderBottom: "1px solid #1f1f23",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: 1.5,
              bgcolor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              display: "flex",
            }}
          >
            <SubtitlesIcon sx={{ fontSize: "1.25rem" }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#ffffff" }}>
            Generate New Subtitles
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={isBusy} size="small" sx={{ color: "#71717a", "&:hover": { color: "#ffffff" } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Error Alert */}
        {modalError && (
          <Alert
            severity="error"
            onClose={() => setModalError(null)}
            sx={{
              bgcolor: "rgba(239, 68, 68, 0.12)",
              color: "#fca5a5",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "0.78rem",
              borderRadius: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#f87171", mb: 0.3 }}>
              Subtitle Processing Failed
            </Typography>
            {modalError}
          </Alert>
        )}

        {/* Source Mode Toggle */}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            fullWidth
            variant={mode === "ai" ? "contained" : "outlined"}
            startIcon={<AutoAwesomeIcon sx={{ color: mode === "ai" ? "#ffffff" : "#60a5fa" }} />}
            onClick={() => { setMode("ai"); setModalError(null); }}
            disabled={isBusy}
            sx={{
              py: 1.2,
              borderRadius: 1.5,
              bgcolor: mode === "ai" ? "#2563eb" : "#18181c",
              borderColor: mode === "ai" ? "#3b82f6" : "#27272a",
              color: mode === "ai" ? "#ffffff" : "#a1a1aa",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": {
                bgcolor: mode === "ai" ? "#1d4ed8" : "#202026",
                borderColor: mode === "ai" ? "#60a5fa" : "#3f3f46",
              },
            }}
          >
            AI Audio Transcribe
          </Button>

          {isYouTubeProject && (
            <Button
              fullWidth
              variant={mode === "youtube" ? "contained" : "outlined"}
              startIcon={<YouTubeIcon sx={{ color: mode === "youtube" ? "#ffffff" : "#ef4444" }} />}
              onClick={() => { setMode("youtube"); setModalError(null); }}
              disabled={isBusy}
              sx={{
                py: 1.2,
                borderRadius: 1.5,
                bgcolor: mode === "youtube" ? "#dc2626" : "#18181c",
                borderColor: mode === "youtube" ? "#ef4444" : "#27272a",
                color: mode === "youtube" ? "#ffffff" : "#a1a1aa",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": {
                  bgcolor: mode === "youtube" ? "#b91c1c" : "#202026",
                  borderColor: mode === "youtube" ? "#f87171" : "#3f3f46",
                },
              }}
            >
              YouTube CC (Original)
            </Button>
          )}
        </Box>

        {/* AI Options */}
        {mode === "ai" ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: "#a1a1aa", "&.Mui-focused": { color: "#3b82f6" } }}>AI Transcribe Model</InputLabel>
              <Select
                value={selectedCompositeValue}
                label="AI Transcribe Model"
                disabled={isBusy}
                onChange={(e) => setSelectedCompositeValue(e.target.value)}
                renderValue={(val) => {
                  const valueStr = val as string;
                  const [prov, ...rest] = valueStr.includes(":") ? valueStr.split(":") : [aiSettings?.provider || "kieai", valueStr];
                  const modelId = rest.join(":") || valueStr;
                  const group = computedGroups.find((g) => g.provider === prov);
                  const model = group?.models.find((m) => m.id === modelId) || computedGroups.flatMap(g => g.models).find(m => m.id === modelId);

                  const isMultimodal = model?.category === "multimodal" || modelId.includes("gemini") || modelId.includes("4o");

                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", overflow: "hidden" }}>
                      {isMultimodal ? (
                        <Tooltip title="Model AI Multimodal Audio (Native Audio + Reasoning)">
                          <Box sx={{ display: "flex", alignItems: "center", color: "#60a5fa" }}>
                            <AutoAwesomeIcon sx={{ fontSize: "1.1rem" }} />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Model Khusus Transkripsi Suara (Dedicated Speech-to-Text)">
                          <Box sx={{ display: "flex", alignItems: "center", color: "#34d399" }}>
                            <RecordVoiceOverIcon sx={{ fontSize: "1.1rem" }} />
                          </Box>
                        </Tooltip>
                      )}
                      <Typography variant="body2" sx={{ color: "#ffffff", fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {model?.name || modelId}
                      </Typography>
                      <Chip
                        label={isMultimodal ? "Multimodal" : "Speech-to-Text"}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          bgcolor: isMultimodal ? "rgba(59, 130, 246, 0.18)" : "rgba(16, 185, 129, 0.18)",
                          color: isMultimodal ? "#93c5fd" : "#6ee7b7",
                          border: isMultimodal ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                          borderRadius: 0.8,
                        }}
                      />
                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem", ml: "auto", mr: 0.5, whiteSpace: "nowrap" }}>
                        {group?.label.split(" ")[0] || prov}
                      </Typography>
                    </Box>
                  );
                }}
                sx={{
                  bgcolor: "#18181c",
                  color: "#ffffff",
                  borderRadius: 1.2,
                  "& fieldset": { borderColor: "#27272a" },
                  "&:hover fieldset": { borderColor: "#3f3f46" },
                  "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                }}
              >
                {computedGroups.map((group) => {
                  const hasKey = hasProviderApiKey(group.provider);
                  return [
                    <ListSubheader
                      key={`header-${group.provider}`}
                      sx={{
                        bgcolor: "#141418",
                        color: "#93c5fd",
                        fontWeight: 800,
                        fontSize: "0.72rem",
                        lineHeight: "28px",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        borderBottom: "1px solid #27272a",
                      }}
                    >
                      {group.label}
                    </ListSubheader>,
                    ...group.models.map((m) => {
                      const isDisabled = !hasKey;

                      return (
                        <MenuItem
                          key={`${group.provider}:${m.id}`}
                          value={`${group.provider}:${m.id}`}
                          disabled={isDisabled || isBusy}
                          sx={{
                            color: isDisabled ? "#71717a" : "#f4f4f5",
                            fontSize: "0.8rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            py: 1,
                            px: 2,
                            "&.Mui-disabled": { opacity: 0.45 },
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                            {m.category === "multimodal" ? (
                              <AutoAwesomeIcon sx={{ fontSize: "1rem", color: isDisabled ? "#52525b" : "#60a5fa" }} />
                            ) : (
                              <RecordVoiceOverIcon sx={{ fontSize: "1rem", color: isDisabled ? "#52525b" : "#34d399" }} />
                            )}
                            <Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem", color: isDisabled ? "#71717a" : "#ffffff" }}>
                                  {m.name}
                                </Typography>
                                <Chip
                                  label={m.category === "multimodal" ? "Multimodal" : "Speech-to-Text"}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    bgcolor: m.category === "multimodal" ? "rgba(59, 130, 246, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                    color: m.category === "multimodal" ? "#93c5fd" : "#6ee7b7",
                                    borderRadius: 0.6,
                                  }}
                                />
                              </Box>
                              {m.description && (
                                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem", display: "block" }}>
                                  {m.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          {isDisabled ? (
                            <Chip
                              icon={<VpnKeyIcon sx={{ fontSize: "0.7rem !important", color: "#f87171" }} />}
                              label="API Key belum diisi"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                bgcolor: "rgba(239, 68, 68, 0.15)",
                                color: "#fca5a5",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                borderRadius: 0.8,
                                ml: 1,
                              }}
                            />
                          ) : (
                            <Chip
                              label="Ready"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                bgcolor: "rgba(34, 197, 94, 0.12)",
                                color: "#86efac",
                                borderRadius: 0.6,
                                ml: 1,
                              }}
                            />
                          )}
                        </MenuItem>
                      );
                    }),
                  ];
                })}
              </Select>
            </FormControl>

            {/* Model Legend & Quick API Key Button */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5, mt: -0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: "0.85rem", color: "#60a5fa" }} />
                  <Typography variant="caption" sx={{ color: "#93c5fd", fontSize: "0.7rem", fontWeight: 600 }}>
                    Multimodal Audio
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <RecordVoiceOverIcon sx={{ fontSize: "0.85rem", color: "#34d399" }} />
                  <Typography variant="caption" sx={{ color: "#6ee7b7", fontSize: "0.7rem", fontWeight: 600 }}>
                    Khusus Transkripsi (STT)
                  </Typography>
                </Box>
              </Box>

              {!isCurrentSelectedProviderHasKey && (
                <Button
                  size="small"
                  startIcon={<VpnKeyIcon sx={{ fontSize: "0.75rem" }} />}
                  onClick={() => setAiSettingsModalOpen(true)}
                  sx={{
                    fontSize: "0.7rem",
                    py: 0.3,
                    px: 1.2,
                    color: "#f87171",
                    textTransform: "none",
                    fontWeight: 700,
                    bgcolor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 1,
                    "&:hover": { bgcolor: "rgba(239, 68, 68, 0.22)" },
                  }}
                >
                  Atur API Key
                </Button>
              )}
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Track Label"
              placeholder={`Track-${subtitleTracks.length + 1}`}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              disabled={isBusy}
              slotProps={{
                inputLabel: { sx: { color: "#a1a1aa", "&.Mui-focused": { color: "#3b82f6" } } },
              }}
              sx={{
                "& .MuiInputBase-input": { color: "#ffffff" },
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#18181c",
                  borderRadius: 1.2,
                  "& fieldset": { borderColor: "#27272a" },
                  "&:hover fieldset": { borderColor: "#3f3f46" },
                  "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                },
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ color: "#fca5a5", fontWeight: 600 }}>
              Fetch Original YouTube Closed Captions (CC)
            </Typography>
            <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
              The system will download official or auto-generated CC subtitles directly from YouTube if available.
            </Typography>
          </Box>
        )}

        {/* Progress Percentage Indicator */}
        {isBusy && (
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: "#141418",
              border: "1px solid #27272a",
              display: "flex",
              flexDirection: "column",
              gap: 1.2,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" sx={{ color: "#ffffff", fontWeight: 700, fontSize: "0.82rem" }}>
                {progressStage}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: mode === "youtube" ? "#f87171" : "#60a5fa",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  fontSize: "0.84rem",
                }}
              >
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: "#27272a",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 3,
                  bgcolor: mode === "youtube" ? "#ef4444" : "#3b82f6",
                  transition: "transform 0.25s ease",
                },
              }}
            />
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem" }}>
              {mode === "youtube"
                ? "Downloading and extracting YouTube CC subtitles..."
                : `Using model ${selectedModelId}. Please wait a few moments...`}
            </Typography>
          </Box>
        )}

        {/* Existing Subtitle Tracks List */}
        {subtitleTracks.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Divider sx={{ borderColor: "#27272a", mb: 1.5 }} />
            <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Saved Subtitle Tracks ({subtitleTracks.length})
            </Typography>

            <List dense sx={{ mt: 0.5, bgcolor: "#18181c", borderRadius: 1.5, border: "1px solid #27272a", p: 0.5 }}>
              {subtitleTracks.map((track) => {
                const isActive = activeTranscript?.id === track.id || track.isActive;
                return (
                  <ListItem
                    key={track.id}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      bgcolor: isActive ? "rgba(59, 130, 246, 0.12)" : "transparent",
                      border: isActive ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
                      "&:hover": { bgcolor: isActive ? "rgba(59, 130, 246, 0.18)" : "#202026" },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: isActive ? "#60a5fa" : "#ffffff", fontSize: "0.82rem" }}>
                            {track.label || (track.sourceType === "youtube_cc" ? "YouTube CC" : "AI Generated Subtitles")}
                          </Typography>
                          {isActive && (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: "0.8rem !important", color: "#60a5fa" }} />}
                              label="Active"
                              size="small"
                              sx={{ height: 18, fontSize: "0.65rem", bgcolor: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem" }}>
                          Created on {new Date(track.createdAt).toLocaleDateString()}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      {!isActive ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSwitchSubtitleTrack(track.id)}
                            disabled={isBusy || isDeletingTrack}
                            sx={{
                              fontSize: "0.7rem",
                              py: 0.2,
                              px: 1,
                              borderRadius: 1,
                              borderColor: "#3f3f46",
                              color: "#e4e4e7",
                              textTransform: "none",
                              "&:hover": { borderColor: "#3b82f6", color: "#60a5fa" },
                            }}
                          >
                            Apply
                          </Button>
                          <Tooltip title="Delete this track">
                            <IconButton
                              size="small"
                              onClick={() => setTrackToDelete(track)}
                              disabled={isBusy || isDeletingTrack}
                              sx={{ color: "#71717a", "&:hover": { color: "#ef4444" } }}
                            >
                              <DeleteIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : null}
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, borderTop: "1px solid #1f1f23", gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={isBusy}
          sx={{ color: "#a1a1aa", textTransform: "none", fontWeight: 600, "&:hover": { color: "#ffffff" } }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={isBusy || (mode === "ai" && !isCurrentSelectedProviderHasKey)}
          startIcon={isBusy ? undefined : <AutoAwesomeIcon />}
          sx={{
            bgcolor: mode === "youtube" ? "#dc2626" : "#2563eb",
            color: "#ffffff",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: 1.5,
            px: 2.5,
            "&:hover": {
              bgcolor: mode === "youtube" ? "#b91c1c" : "#1d4ed8",
            },
            "&.Mui-disabled": {
              bgcolor: "#27272a",
              color: "#71717a",
            },
          }}
        >
          {isBusy ? "Processing..." : modalError ? "Try Again" : mode === "youtube" ? "Fetch YT Subtitles" : "Start AI Transcribe"}
        </Button>
      </DialogActions>

      {/* Delete Track Confirmation Dialog inside Modal */}
      <Dialog
        open={Boolean(trackToDelete)}
        onClose={() => !isDeletingTrack && setTrackToDelete(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121216",
              color: "#ffffff",
              borderRadius: 1.5,
              border: "1px solid #27272a",
              backgroundImage: "none",
              p: 0.5,
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: "rgba(239, 68, 68, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <WarningAmberIcon sx={{ color: "#ef4444", fontSize: "1.3rem" }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#fafafa" }}>
              Delete Subtitle Track?
            </Typography>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              Confirm Track Deletion
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 1.5 }}>
          <Typography variant="body2" sx={{ color: "#d4d4d8", fontSize: "0.82rem", lineHeight: 1.5 }}>
            Are you sure you want to delete track{" "}
            <strong style={{ color: "#ffffff" }}>
              "{trackToDelete?.label || (trackToDelete?.sourceType === "youtube_cc" ? "YouTube Subtitles (CC)" : "Track")}"
            </strong>
            ?
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "#a1a1aa", mt: 1, fontSize: "0.74rem" }}>
            This action is permanent. All words and timing adjustments on this track will be removed from the project.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={isDeletingTrack}
            onClick={() => setTrackToDelete(null)}
            sx={{
              borderColor: "#27272a",
              color: "#a1a1aa",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.78rem",
              "&:hover": { borderColor: "#3f3f46", color: "#ffffff" },
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={isDeletingTrack}
            startIcon={isDeletingTrack ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <DeleteIcon fontSize="small" />}
            onClick={async () => {
              if (!trackToDelete) return;
              setIsDeletingTrack(true);
              try {
                await handleDeleteSubtitleTrack(trackToDelete.id);
                setTrackToDelete(null);
              } finally {
                setIsDeletingTrack(false);
              }
            }}
            sx={{
              bgcolor: "#ef4444",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              borderRadius: 0.8,
              "&:hover": { bgcolor: "#dc2626" },
            }}
          >
            {isDeletingTrack ? "Deleting..." : "Delete Track"}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
