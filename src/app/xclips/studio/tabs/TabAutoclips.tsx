import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import TuneIcon from "@mui/icons-material/Tune";
import PsychologyIcon from "@mui/icons-material/Psychology";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useStudioStore } from "../store/useStudioStore";
import { formatTime } from "../types/studio.types";
import { AiProviderType, HOOK_FORMULAS } from "@/lib/xclips/types";
import { GenerateAutoClipModal } from "../modals/GenerateAutoClipModal";

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
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const isDiscovering = useStudioStore((s) => s.isDiscovering);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const setIsGenerateAutoClipModalOpen = useStudioStore((s) => s.setIsGenerateAutoClipModalOpen);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const handleSeek = useStudioStore((s) => s.handleSeek);
  const handleDeleteAllClips = useStudioStore((s) => s.handleDeleteAllClips);
  const handleDeleteClip = useStudioStore((s) => s.handleDeleteClip);

  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  const currentProvider = (aiSettings?.provider || "kieai") as AiProviderType;
  const currentFormula = HOOK_FORMULAS.find((f) => f.id === aiSettings?.hookFormula) || HOOK_FORMULAS[0];

  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    await handleDeleteAllClips();
    setIsDeletingAll(false);
    setConfirmDeleteAllOpen(false);
  };

  return (
    <Box>
      <GenerateAutoClipModal />

      {/* Confirmation Dialog for Delete All Clips */}
      <Dialog
        open={confirmDeleteAllOpen}
        onClose={() => !isDeletingAll && setConfirmDeleteAllOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 1.5,
              color: "#fafafa",
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700, fontSize: "1rem", pb: 1 }}>
          <WarningAmberIcon sx={{ color: "#ef4444" }} />
          Hapus Semua Clip?
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body2" sx={{ color: "#a1a1aa", lineHeight: 1.5 }}>
            Tindakan ini akan menghapus semua <strong style={{ color: "#ffffff" }}>{clips.length} clip</strong> yang telah dihasilkan untuk project ini secara permanen dari database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setConfirmDeleteAllOpen(false)}
            disabled={isDeletingAll}
            sx={{ textTransform: "none", color: "#a1a1aa", borderColor: "#3f3f46" }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            onClick={handleConfirmDeleteAll}
            disabled={isDeletingAll}
            startIcon={
              isDeletingAll ? (
                <CircularProgress size={14} sx={{ color: "#ffffff" }} />
              ) : (
                <DeleteSweepIcon fontSize="small" />
              )
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isDeletingAll ? "Menghapus..." : "Ya, Hapus Semua"}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.95rem" }}>
              Autoclip Engine
            </Typography>
            <Chip
              icon={<TuneIcon sx={{ fontSize: "0.75rem !important", color: "#3b82f6 !important" }} />}
              onClick={() => setAiSettingsModalOpen(true)}
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
                cursor: "pointer",
                userSelect: "none",
                "&:hover": { bgcolor: "rgba(59, 130, 246, 0.2)" },
              }}
            />
            {aiSettings?.hookFormula && aiSettings.hookFormula !== "auto" && (
              <Chip
                icon={<PsychologyIcon sx={{ fontSize: "0.75rem !important", color: "#f87171 !important" }} />}
                label={currentFormula.name}
                size="small"
                sx={{
                  bgcolor: "rgba(224, 57, 43, 0.12)",
                  border: "1px solid rgba(224, 57, 43, 0.3)",
                  color: "#f87171",
                  borderRadius: 1,
                  height: 22,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  userSelect: "none",
                }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", display: "block", mt: 0.3 }}>
            Automatically discover and produce dynamic 9:16 short clips from the master video.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {clips.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon fontSize="small" />}
              onClick={() => setConfirmDeleteAllOpen(true)}
              disabled={isDiscovering || isTranscribing || isDeletingAll}
              sx={{
                fontWeight: 700,
                textTransform: "none",
                borderColor: "rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                borderRadius: 1,
                px: 1.5,
                "&:hover": {
                  borderColor: "#ef4444",
                  bgcolor: "rgba(239, 68, 68, 0.08)",
                },
              }}
            >
              Delete All Clips
            </Button>
          )}

          <Button
            variant="contained"
            size="small"
            startIcon={
              isDiscovering || isTranscribing ? (
                <CircularProgress size={14} sx={{ color: "#ffffff" }} />
              ) : (
                <BoltIcon />
              )
            }
            onClick={() => setIsGenerateAutoClipModalOpen(true)}
            disabled={isDiscovering || isTranscribing}
            sx={{
              bgcolor: "#3b82f6",
              fontWeight: 800,
              textTransform: "none",
              px: 2,
              borderRadius: 1,
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            {isTranscribing
              ? "Transcribing..."
              : isDiscovering
              ? "Scanning Clips..."
              : "Generate Clips"}
          </Button>
        </Box>
      </Box>

      {clips.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1 }}>
          <BoltIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1.5 }} />
          <Typography variant="body2" sx={{ color: "#71717a", mb: 1, maxWidth: 360, mx: "auto" }}>
            No clips generated yet. Click <strong style={{ color: "#ffffff" }}>Generate Clips</strong> to create video segments.
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
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
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClip(clip.id);
                        }}
                        sx={{
                          p: 0.3,
                          color: "#71717a",
                          "&:hover": { color: "#ef4444", bgcolor: "rgba(239, 68, 68, 0.1)" },
                        }}
                        title="Delete this clip"
                      >
                        <DeleteIcon sx={{ fontSize: "0.95rem" }} />
                      </IconButton>
                    </Box>
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
