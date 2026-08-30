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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import YouTubeIcon from "@mui/icons-material/YouTube";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useStudioStore } from "../store/useStudioStore";
import { AiProviderType } from "@/lib/xclips/types";

interface TranscribeModelOption {
  id: string;
  name: string;
  provider: AiProviderType;
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
      { id: "gemini-3-7-flash", name: "gemini-3-7-flash", provider: "kieai" },
    ],
  },
  {
    provider: "gemini",
    label: "Google Gemini (Multimodal Audio)",
    models: [
      { id: "gemini-3.5-transcribe", name: "gemini-3.5-transcribe", provider: "gemini" },
      { id: "gemini-3.7-flash", name: "gemini-3.7-flash", provider: "gemini" },
      { id: "gemini-3.1-pro-preview", name: "gemini-3.1-pro-preview", provider: "gemini" },
      { id: "gemini-3.6-flash", name: "gemini-3.6-flash", provider: "gemini" },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI (Audio Transcribe)",
    models: [
      { id: "gpt-transcribe", name: "gpt-transcribe", provider: "openai" },
      { id: "gpt-4o-transcribe", name: "gpt-4o-transcribe", provider: "openai" },
      { id: "gpt-4o-mini-transcribe", name: "gpt-4o-mini-transcribe", provider: "openai" },
      { id: "whisper-1", name: "whisper-1", provider: "openai" },
    ],
  },
  {
    provider: "openai_compatible",
    label: "Custom (OpenAI Compatible)",
    models: [
      { id: "gpt-transcribe", name: "gpt-transcribe", provider: "openai_compatible" },
      { id: "gpt-4o-transcribe", name: "gpt-4o-transcribe", provider: "openai_compatible" },
      { id: "gpt-4o-mini-transcribe", name: "gpt-4o-mini-transcribe", provider: "openai_compatible" },
      { id: "whisper-1", name: "whisper-1", provider: "openai_compatible" },
    ],
  },
];

export function GenerateSubtitleModal() {
  const isOpen = useStudioStore((s) => s.isGenerateSubtitleModalOpen);
  const setIsOpen = useStudioStore((s) => s.setIsGenerateSubtitleModalOpen);
  const project = useStudioStore((s) => s.project);
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const isFetchingYtSubtitles = useStudioStore((s) => s.isFetchingYtSubtitles);
  const availableTranscribeModels = useStudioStore((s) => s.availableTranscribeModels);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const subtitleTracks = useStudioStore((s) => s.subtitleTracks);
  const activeTranscript = useStudioStore((s) => s.transcript);

  const handleTranscribe = useStudioStore((s) => s.handleTranscribe);
  const handleFetchYouTubeSubtitles = useStudioStore((s) => s.handleFetchYouTubeSubtitles);
  const handleSwitchSubtitleTrack = useStudioStore((s) => s.handleSwitchSubtitleTrack);
  const handleDeleteSubtitleTrack = useStudioStore((s) => s.handleDeleteSubtitleTrack);

  const [mode, setMode] = useState<"ai" | "youtube">("ai");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3-7-flash");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isYouTubeProject =
    project?.sourceType === "youtube" ||
    (project?.sourcePath && /youtube|youtu\.be|\[[a-zA-Z0-9_-]{11}\]/i.test(project.sourcePath));

  const isBusy = isTranscribing || isFetchingYtSubtitles;

  const hasProviderApiKey = (p: AiProviderType): boolean => {
    const pKey = aiSettings?.apiKeys?.[p];
    if (pKey && pKey.trim().length > 0) return true;
    if (aiSettings?.provider === p && aiSettings?.apiKey && aiSettings.apiKey.trim().length > 0) return true;
    return false;
  };

  // Dynamically compute groups combining base presets + configured transcribe model + fetched models
  const computedGroups = useMemo(() => {
    const groups: ProviderGroup[] = JSON.parse(JSON.stringify(PROVIDER_TRANSCRIBE_GROUPS));

    // Incorporate configured transcribeModel from AI Settings if custom
    if (aiSettings?.transcribeModel && aiSettings.transcribeModel.trim()) {
      const customModelId = aiSettings.transcribeModel.trim();
      const currentProv = aiSettings.provider || "openai_compatible";
      const targetGroup = groups.find((g) => g.provider === currentProv) || groups[groups.length - 1];

      const alreadyExists = groups.some((g) => g.models.some((m) => m.id === customModelId));
      if (!alreadyExists && targetGroup) {
        targetGroup.models.push({
          id: customModelId,
          name: customModelId,
          provider: currentProv,
        });
      }
    }

    // Incorporate any dynamic models fetched from API
    if (availableTranscribeModels && availableTranscribeModels.length > 0) {
      const currentProv = aiSettings?.provider || "openai_compatible";
      const targetGroup = groups.find((g) => g.provider === currentProv) || groups[groups.length - 1];

      for (const fetchedModel of availableTranscribeModels) {
        const alreadyExists = groups.some((g) => g.models.some((m) => m.id === fetchedModel));
        if (!alreadyExists && targetGroup) {
          targetGroup.models.push({
            id: fetchedModel,
            name: fetchedModel,
            provider: currentProv,
          });
        }
      }
    }

    return groups;
  }, [aiSettings, availableTranscribeModels]);

  // Auto-fill sequential Track-N label & pick best initial model on open
  useEffect(() => {
    if (isOpen) {
      setModalError(null);
      setProgress(0);
      setProgressStage("");

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

      // Pick default model that is configured and supports audio
      const currentConfiguredModel = aiSettings?.transcribeModel;
      let validInitialModel = "";

      for (const group of computedGroups) {
        const hasKey = hasProviderApiKey(group.provider);
        if (hasKey) {
          for (const m of group.models) {
            if (!validInitialModel) validInitialModel = m.id;
            if (m.id === currentConfiguredModel) {
              validInitialModel = m.id;
              break;
            }
          }
        }
      }

      setSelectedModel(validInitialModel || currentConfiguredModel || "gemini-3-7-flash");
    }
  }, [isOpen, subtitleTracks, aiSettings, computedGroups]);

  // Smooth progress animation while busy
  useEffect(() => {
    if (isBusy) {
      setProgress(12);
      setProgressStage(mode === "youtube" ? "Mengunduh subtitle YouTube..." : "Mengekstrak audio & mempersiapkan payload...");
      const startTime = Date.now();

      progressTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (mode === "youtube") {
          if (elapsed < 2) {
            setProgress(Math.min(50, 15 + elapsed * 20));
            setProgressStage("Mengunduh berkas subtitle CC...");
          } else {
            setProgress(Math.min(92, 50 + (elapsed - 2) * 8));
            setProgressStage("Mem-parsing word timestamps...");
          }
        } else {
          if (elapsed < 3) {
            setProgress(Math.min(30, 12 + elapsed * 6));
            setProgressStage("Mengekstrak & mengompresi audio lokal...");
          } else if (elapsed < 18) {
            setProgress(Math.min(75, 30 + (elapsed - 3) * 3));
            setProgressStage(`Mentranskripsi kata-per-kata (${selectedModel})...`);
          } else if (elapsed < 35) {
            setProgress(Math.min(92, 75 + (elapsed - 18) * 1.0));
            setProgressStage("Memproses timestamp & segmentasi kata...");
          } else {
            setProgress(Math.min(98, 92 + (elapsed - 35) * 0.2));
            setProgressStage("Menyimpan track subtitle baru...");
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
  }, [isBusy, mode, selectedModel]);

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
        setModalError(res.message || "Gagal memuat subtitle YouTube. Pastikan video memiliki closed captions.");
      }
    } else {
      const label = customLabel.trim() || `Track-${subtitleTracks.length + 1}`;
      let targetProvider: AiProviderType | undefined;
      for (const group of computedGroups) {
        if (group.models.some((m) => m.id === selectedModel)) {
          targetProvider = group.provider;
          break;
        }
      }
      const res = await handleTranscribe(selectedModel, label, targetProvider);
      if (res && !res.ok) {
        setProgress(0);
        setModalError(res.message || "Gagal melakukan transkripsi AI. Periksa koneksi atau API Key Anda.");
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
              Gagal Memproses Subtitle
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
                value={selectedModel}
                label="AI Transcribe Model"
                disabled={isBusy}
                onChange={(e) => setSelectedModel(e.target.value)}
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
                          key={`${group.provider}-${m.id}`}
                          value={m.id}
                          disabled={isDisabled || isBusy}
                          sx={{
                            color: isDisabled ? "#71717a" : "#f4f4f5",
                            fontSize: "0.78rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            py: 0.8,
                            px: 2,
                            "&.Mui-disabled": { opacity: 0.5 },
                          }}
                        >
                          <span>{m.name}</span>
                          {isDisabled && (
                            <Chip
                              label="API Key belum diisi"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                bgcolor: "rgba(239, 68, 68, 0.15)",
                                color: "#fca5a5",
                                borderRadius: 0.8,
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
              Mengambil Subtitle Asli YouTube (Closed Captions)
            </Typography>
            <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
              Sistem akan memuat file .srt subtitle resmi atau auto-generated langsung dari YouTube jika tersedia.
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
                ? "Mengunduh dan mengekstrak subtitle YouTube CC..."
                : `Menggunakan model ${selectedModel}. Mohon tunggu beberapa detik...`}
            </Typography>
          </Box>
        )}

        {/* Existing Subtitle Tracks List */}
        {subtitleTracks.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Divider sx={{ borderColor: "#27272a", mb: 1.5 }} />
            <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Track Subtitle Tersimpan ({subtitleTracks.length})
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
                          {track.words?.length || 0} kata • {new Date(track.createdAt).toLocaleDateString()}
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
                            disabled={isBusy}
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
                            Gunakan
                          </Button>
                          <Tooltip title="Hapus track ini">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteSubtitleTrack(track.id)}
                              disabled={isBusy}
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
          Tutup
        </Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={isBusy}
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
          }}
        >
          {isBusy ? "Memproses..." : modalError ? "Coba Lagi" : mode === "youtube" ? "Ambil Subtitle YT" : "Mulai Transkrip AI"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
