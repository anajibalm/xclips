import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";

export function PreviewVideoModal() {
  const previewVideoOpen = useStudioStore((s) => s.previewVideoOpen);
  const setPreviewVideoOpen = useStudioStore((s) => s.setPreviewVideoOpen);
  const project = useStudioStore((s) => s.project);
  const projectId = useStudioStore((s) => s.projectId);

  if (!previewVideoOpen || !projectId) return null;

  return (
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
            {project?.name || "Master Video Preview"}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            controls
            autoPlay
            src={projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/stream` : undefined}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
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
          sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800 }}
        >
          Download MP4
        </Button>
        <Button variant="outlined" size="small" onClick={() => setPreviewVideoOpen(false)} sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
