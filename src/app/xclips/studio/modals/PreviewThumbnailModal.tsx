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
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";

export function PreviewThumbnailModal() {
  const previewThumbnailOpen = useStudioStore((s) => s.previewThumbnailOpen);
  const setPreviewThumbnailOpen = useStudioStore((s) => s.setPreviewThumbnailOpen);
  const projectId = useStudioStore((s) => s.projectId);
  const thumbTimestamp = useStudioStore((s) => s.thumbTimestamp);

  if (!previewThumbnailOpen || !projectId) return null;

  return (
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
          <CameraAltIcon sx={{ color: "#ef4444" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa" }}>
            Cover / Captured Frame Preview
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setPreviewThumbnailOpen(false)} sx={{ color: "#a1a1aa" }}>
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
          <Box
            component="img"
            src={projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail?t=${thumbTimestamp}` : undefined}
            alt="Thumbnail"
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<FileDownloadIcon />}
          component="a"
          href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=thumbnail`}
          download
          sx={{ bgcolor: "#ef4444", textTransform: "none", fontWeight: 800 }}
        >
          Download JPEG
        </Button>
        <Button variant="outlined" size="small" onClick={() => setPreviewThumbnailOpen(false)} sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
