import React, { useState } from "react";
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
  Divider,
  LinearProgress,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CircularProgress from "@mui/material/CircularProgress";
import { useStudioStore } from "../store/useStudioStore";
import { formatTime } from "../types/studio.types";

export function ExportModal() {
  const exportModalOpen = useStudioStore((s) => s.exportModalOpen);
  const setExportModalOpen = useStudioStore((s) => s.setExportModalOpen);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const renderStatus = useStudioStore((s) => s.renderStatus);
  const renderProgress = useStudioStore((s) => s.renderProgress);
  const handleRender = useStudioStore((s) => s.handleRender);
  const handleOpenInExplorer = useStudioStore((s) => s.handleOpenInExplorer);

  const aspectRatio = selectedClip?.aspectRatio || "9:16";

  const resolutionOptions =
    aspectRatio === "1:1"
      ? [
          { id: "1080x1080", label: "1080x1080 (1:1 Square FHD)" },
          { id: "720x720", label: "720x720 (1:1 Square HD)" },
          { id: "2160x2160", label: "2160x2160 (1:1 4K UHD)" },
        ]
      : aspectRatio === "4:5"
      ? [
          { id: "1080x1350", label: "1080x1350 (4:5 Portrait FHD)" },
          { id: "720x900", label: "720x900 (4:5 Portrait HD)" },
          { id: "2160x2700", label: "2160x2700 (4:5 4K UHD)" },
        ]
      : aspectRatio === "16:9"
      ? [
          { id: "1920x1080", label: "1920x1080 (16:9 Landscape FHD)" },
          { id: "1280x720", label: "1280x720 (16:9 Landscape HD)" },
          { id: "3840x2160", label: "3840x2160 (16:9 4K UHD)" },
        ]
      : [
          { id: "1080x1920", label: "1080x1920 (9:16 Vertical FHD)" },
          { id: "720x1280", label: "720x1280 (9:16 Vertical HD)" },
          { id: "2160x3840", label: "2160x3840 (9:16 4K UHD)" },
        ];

  const [exportResolution, setExportResolution] = useState<string>(resolutionOptions[0].id);
  const [exportBitrate, setExportBitrate] = useState<"8M" | "5M" | "3M">("8M");
  const [exportFormat, setExportFormat] = useState<"mp4" | "mov">("mp4");

  const isRendering = renderStatus === "rendering";

  return (
    <Dialog
      open={exportModalOpen}
      onClose={() => !isRendering && setExportModalOpen(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#121216",
            backgroundImage: "none",
            border: "1px solid #27272a",
            borderRadius: 1.5,
            color: "#fafafa",
            boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #27272a",
          px: 2.5,
          py: 1.8,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
            }}
          >
            <FileDownloadIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#fafafa" }}>
              Export Video Clip
            </Typography>
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
              Render FFmpeg &amp; Subtitle Burn-In Lokal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={aspectRatio}
            size="small"
            sx={{
              bgcolor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              fontWeight: 800,
              fontSize: "0.7rem",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              height: 22,
            }}
          />
          <IconButton
            size="small"
            onClick={() => setExportModalOpen(false)}
            disabled={isRendering}
            sx={{ color: "#71717a", "&:hover": { color: "#ffffff", bgcolor: "#18181b" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {!selectedClip ? (
          <Alert severity="warning" sx={{ bgcolor: "rgba(234, 179, 8, 0.1)", color: "#facc15", borderRadius: 1 }}>
            Select a clip in the <strong>Autoclip</strong> tab before exporting.
          </Alert>
        ) : (
          <>
            {/* Clip Info Summary Card */}
            <Box
              sx={{
                p: 1.5,
                mb: 2.5,
                bgcolor: "#18181c",
                borderRadius: 1,
                border: "1px solid #27272a",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0, pr: 1.5 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: "#fafafa", fontSize: "0.85rem" }}>
                  {selectedClip.title || selectedClip.hookText || "Clip Target"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#71717a", display: "block" }}>
                  Duration: {formatTime(selectedClip.startSec)} - {formatTime(selectedClip.endSec)} ({(selectedClip.endSec - selectedClip.startSec).toFixed(1)}s) &bull; Layout: {selectedClip.layoutMode}
                </Typography>
              </Box>
              <Chip
                label={`Viral Score ${selectedClip.viralScore}`}
                size="small"
                sx={{
                  bgcolor: selectedClip.viralScore >= 80 ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                  color: selectedClip.viralScore >= 80 ? "#34d399" : "#60a5fa",
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  border: `1px solid ${selectedClip.viralScore >= 80 ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                }}
              />
            </Box>

            {/* Option 1: Output Resolution */}
            <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
              1. Output Resolution ({aspectRatio})
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2.2, flexWrap: "wrap" }}>
              {resolutionOptions.map((res) => (
                <Button
                  key={res.id}
                  variant={exportResolution === res.id ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setExportResolution(res.id)}
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
              2. Target Bitrate
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2.2 }}>
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
              3. Container Format
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
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

            {/* Rendering Progress Indicator */}
            {isRendering && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#18181c", borderRadius: 1, border: "1px solid #3b82f6" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="body2" sx={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.82rem" }}>
                    Rendering video locally...
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#93c5fd", fontWeight: 800, fontFamily: "monospace" }}>
                    {renderProgress}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={renderProgress}
                  sx={{
                    bgcolor: "#27272a",
                    height: 8,
                    borderRadius: 1,
                    "& .MuiLinearProgress-bar": { bgcolor: "#3b82f6" },
                  }}
                />
              </Box>
            )}

            {/* Render Complete Notification */}
            {selectedClip.status === "completed" && selectedClip.outputPath && !isRendering && (
              <Alert
                severity="success"
                icon={<CheckCircleIcon />}
                action={
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<FolderOpenIcon fontSize="small" />}
                    onClick={() => handleOpenInExplorer(selectedClip.outputPath)}
                    sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem" }}
                  >
                    Open Folder
                  </Button>
                }
                sx={{
                  mb: 1,
                  bgcolor: "rgba(16, 185, 129, 0.12)",
                  color: "#34d399",
                  borderRadius: 1,
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                Render completed! File ready: <code style={{ fontSize: "0.75rem" }}>{selectedClip.outputPath}</code>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <Divider sx={{ borderColor: "#27272a" }} />

      <DialogActions sx={{ px: 2.5, py: 1.8, gap: 1 }}>
        <Button
          size="small"
          onClick={() => setExportModalOpen(false)}
          disabled={isRendering}
          sx={{
            color: "#a1a1aa",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            "&:hover": { color: "#ffffff", bgcolor: "#18181b" },
          }}
        >
          Close
        </Button>

        {selectedClip && (
          <Button
            variant="contained"
            size="small"
            startIcon={isRendering ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <FileDownloadIcon />}
            onClick={handleRender}
            disabled={isRendering}
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
            {isRendering ? "Rendering..." : `Render & Export ${aspectRatio} Video`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
