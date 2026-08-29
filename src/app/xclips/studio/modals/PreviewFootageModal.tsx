import React from "react";
import { useRouter } from "next/navigation";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";
import { formatTime } from "../types/studio.types";
import { XclipsProject } from "@/lib/xclips/types";

interface PreviewFootageModalProps {
  item: XclipsProject | null;
  onClose: () => void;
}

export function PreviewFootageModal({ item, onClose }: PreviewFootageModalProps) {
  const router = useRouter();
  const projectId = useStudioStore((s) => s.projectId);

  if (!item) return null;

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
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
            {item.name || "Preview Footage"}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#a1a1aa" }}>
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
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            controls
            autoPlay
            src={item?.id ? `${getApiBaseUrl()}/api/xclips/media/${item.id}/stream` : undefined}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={`Platform: ${(item.sourceType || "broll").toUpperCase()}`} size="small" sx={{ bgcolor: "#18181b", color: "#60a5fa", fontWeight: 700 }} />
          <Chip label={`Resolution: ${item.width}x${item.height}`} size="small" sx={{ bgcolor: "#18181b", color: "#fafafa", fontWeight: 700 }} />
          <Chip label={`FPS: ${item.frameRate} fps`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
          <Chip label={`Duration: ${formatTime(item.durationSec || 0)}`} size="small" sx={{ bgcolor: "#18181b", color: "#a1a1aa" }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        {item.id !== projectId && (
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              const fid = item.id;
              onClose();
              router.push(`/xclips/studio?id=${fid}`);
            }}
            sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800 }}
          >
            Open in Studio
          </Button>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          component="a"
          href={`${getApiBaseUrl()}/api/xclips/media/${item.id}/download?type=video`}
          download
          sx={{ color: "#60a5fa", borderColor: "#3b82f6", textTransform: "none", fontSize: "0.75rem" }}
        >
          Download MP4
        </Button>
        <Button variant="outlined" size="small" onClick={onClose} sx={{ color: "#a1a1aa", borderColor: "#3f3f46", textTransform: "none" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
