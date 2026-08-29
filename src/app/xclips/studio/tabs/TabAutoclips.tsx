import React from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Grid,
  Card,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import { useStudioStore } from "../store/useStudioStore";
import { formatTime } from "../types/studio.types";
import { AiProviderType } from "@/lib/xclips/types";

const PROVIDER_LABELS: Record<AiProviderType, string> = {
  kieai: "KIE AI",
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
  openai_compatible: "Custom",
};

export function TabAutoclips() {
  const clips = useStudioStore((s) => s.clips);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const setSelectedClip = useStudioStore((s) => s.setSelectedClip);
  const transcript = useStudioStore((s) => s.transcript);
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const isDiscovering = useStudioStore((s) => s.isDiscovering);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const fetchAiSettings = useStudioStore((s) => s.fetchAiSettings);
  const handleTranscribe = useStudioStore((s) => s.handleTranscribe);
  const handleDiscoverHighlights = useStudioStore((s) => s.handleDiscoverHighlights);
  const handleSeek = useStudioStore((s) => s.handleSeek);

  const currentProvider = (aiSettings?.provider || "kieai") as AiProviderType;

  return (
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
                    {PROVIDER_LABELS[currentProvider] || currentProvider.toUpperCase()}
                  </strong>
                  {" · "}
                  <span style={{ fontFamily: "monospace", color: "#e4e4e7" }}>
                    {aiSettings?.highlightModel || aiSettings?.transcribeModel || "gemini-3-7-flash"}
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
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
                      <Chip
                        label={clip.aspectRatio || "9:16"}
                        size="small"
                        sx={{
                          bgcolor: "rgba(59, 130, 246, 0.12)",
                          color: "#60a5fa",
                          fontWeight: 800,
                          fontSize: "0.65rem",
                          height: 20,
                          borderRadius: 0.8,
                          border: "1px solid rgba(59, 130, 246, 0.25)",
                        }}
                      />
                    </Box>
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
  );
}
