"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DownloadIcon from "@mui/icons-material/Download";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import YouTubeIcon from "@mui/icons-material/YouTube";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import ImageIcon from "@mui/icons-material/Image";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import { DownloadRecord } from "@/lib/xclips/types";

import { getApiBaseUrl } from "@/lib/api-client";

interface MediaPreviewModalProps {
  open: boolean;
  onClose: () => void;
  record: DownloadRecord | null;
  onOpenFolder: (record: DownloadRecord) => void;
  onCreateProject?: (record: DownloadRecord) => void;
  creatingProject?: boolean;
}

export function MediaPreviewModal({
  open,
  onClose,
  record,
  onOpenFolder,
  onCreateProject,
  creatingProject = false,
}: MediaPreviewModalProps) {
  const [subtitleText, setSubtitleText] = useState<string>("");
  const [loadingSub, setLoadingSub] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [record?.id]);

  useEffect(() => {
    if (open && record && record.formatType === "subtitle") {
      setLoadingSub(true);
      fetch(`${getApiBaseUrl()}/api/xclips/downloader/file/${record.id}`)
        .then((res) => res.text())
        .then((txt) => {
          setSubtitleText(txt);
          setLoadingSub(false);
        })
        .catch(() => {
          setSubtitleText("Failed to load subtitle text content.");
          setLoadingSub(false);
        });
    }
  }, [open, record]);

  if (!record) return null;

  const fileStreamUrl = `${getApiBaseUrl()}/api/xclips/downloader/file/${record.id}`;
  const downloadUrl = `${getApiBaseUrl()}/api/xclips/downloader/file/${record.id}?download=1`;

  const getPlatformBadge = () => {
    if (record.platform === "youtube") {
      return (
        <Chip
          icon={<YouTubeIcon sx={{ color: "#ef4444 !important", fontSize: "1rem !important" }} />}
          label="YouTube"
          size="small"
          sx={{ bgcolor: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", fontWeight: 700, borderRadius: 1 }}
        />
      );
    }
    if (record.platform === "tiktok") {
      return (
        <Chip
          label="TikTok"
          size="small"
          sx={{ bgcolor: "rgba(6, 182, 212, 0.15)", color: "#67e8f9", fontWeight: 700, borderRadius: 1 }}
        />
      );
    }
    if (record.platform === "instagram") {
      return (
        <Chip
          label="Instagram"
          size="small"
          sx={{ bgcolor: "rgba(236, 72, 153, 0.15)", color: "#f472b6", fontWeight: 700, borderRadius: 1 }}
        />
      );
    }
    if (record.platform === "x") {
      return (
        <Chip
          label="𝕏 / Twitter"
          size="small"
          sx={{ bgcolor: "rgba(255, 255, 255, 0.12)", color: "#ffffff", fontWeight: 700, borderRadius: 1 }}
        />
      );
    }
    if (record.platform === "pinterest") {
      return (
        <Chip
          label="Pinterest"
          size="small"
          sx={{ bgcolor: "rgba(230, 0, 35, 0.18)", color: "#f87171", fontWeight: 700, borderRadius: 1 }}
        />
      );
    }
    return (
      <Chip
        icon={<VideoLibraryIcon sx={{ fontSize: "0.9rem !important", color: "#a1a1aa !important" }} />}
        label="Universal Media"
        size="small"
        sx={{ bgcolor: "#27272a", color: "#a1a1aa", fontWeight: 600, borderRadius: 1 }}
      />
    );
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#121215",
            color: "#f4f4f5",
            border: "1px solid #27272a",
            borderRadius: 2.5,
            overflow: "hidden",
          },
        },
      }}
    >
      {/* Modal Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #27272a",
          py: 1.8,
          px: 2.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, overflow: "hidden", pr: 2 }}>
          {getPlatformBadge()}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {record.title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "#a1a1aa" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Modal Content / Player */}
      <DialogContent sx={{ p: 2.5, bgcolor: "#09090b" }}>
        {/* Video Player */}
        {record.formatType === "video" && (
          <Box
            sx={{
              width: "100%",
              maxHeight: "55vh",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              bgcolor: "#000000",
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid #27272a",
            }}
          >
            {videoError ? (
              <Box sx={{ p: 4, textAlign: "center", maxWidth: 450 }}>
                <Typography variant="body2" sx={{ color: "#ef4444", mb: 1, fontWeight: 700 }}>
                  Failed to play video stream.
                </Typography>
                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                  The video codec or format might not be natively supported by the browser player. You can still &quot;Show in Folder&quot; or &quot;Download to Browser&quot;.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setVideoError(false)}
                  sx={{ borderColor: "#3f3f46", color: "#e4e4e7", fontSize: "0.75rem", textTransform: "none" }}
                >
                  Retry Playback
                </Button>
              </Box>
            ) : (
              <video
                src={fileStreamUrl}
                controls
                autoPlay
                crossOrigin="anonymous"
                onError={() => setVideoError(true)}
                style={{
                  width: "100%",
                  maxHeight: "55vh",
                  objectFit: "contain",
                  outline: "none",
                }}
              />
            )}
          </Box>
        )}

        {/* Audio Player */}
        {record.formatType === "audio" && (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              bgcolor: "#18181b",
              borderRadius: 2,
              border: "1px solid #27272a",
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                bgcolor: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <AudiotrackIcon sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {record.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 3 }}>
              {record.author || "Audio Track"} · {record.quality.toUpperCase()} · {formatFileSize(record.fileSizeBytes)}
            </Typography>
            <audio
              src={fileStreamUrl}
              controls
              autoPlay
              crossOrigin="anonymous"
              style={{ width: "100%", maxWidth: 500, outline: "none" }}
            />
          </Box>
        )}

        {/* Image / Thumbnail Preview */}
        {(record.formatType === "thumbnail" || record.formatType === "image") && (
          <Box
            sx={{
              width: "100%",
              maxHeight: "55vh",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              bgcolor: "#000000",
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid #27272a",
            }}
          >
            <img
              src={fileStreamUrl}
              alt={record.title}
              style={{
                maxWidth: "100%",
                maxHeight: "55vh",
                objectFit: "contain",
              }}
            />
          </Box>
        )}

        {/* Subtitle Viewer */}
        {record.formatType === "subtitle" && (
          <Box
            sx={{
              p: 2.5,
              bgcolor: "#18181b",
              borderRadius: 2,
              border: "1px solid #27272a",
              maxHeight: "50vh",
              overflowY: "auto",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <SubtitlesIcon sx={{ color: "#10b981", fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#10b981" }}>
                Subtitle Content ({record.quality.toUpperCase()})
              </Typography>
            </Box>
            {loadingSub ? (
              <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={24} sx={{ color: "#10b981" }} />
              </Box>
            ) : (
              <Typography
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  m: 0,
                }}
              >
                {subtitleText || "No subtitle text available."}
              </Typography>
            )}
          </Box>
        )}

        {/* Media Meta Details Bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 2,
            pt: 1.5,
            borderTop: "1px solid #1f1f23",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.82rem", color: "#a1a1aa" }}>
            <span>
              Format: <strong style={{ color: "#e4e4e7" }}>{record.formatType.toUpperCase()} ({record.quality})</strong>
            </span>
            <span>
              Size: <strong style={{ color: "#e4e4e7" }}>{formatFileSize(record.fileSizeBytes)}</strong>
            </span>
            {record.durationSec > 0 && (
              <span>
                Duration: <strong style={{ color: "#e4e4e7" }}>{Math.floor(record.durationSec / 60)}m {Math.round(record.durationSec % 60)}s</strong>
              </span>
            )}
          </Box>
          <Button
            size="small"
            variant="text"
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: "0.85rem !important" }} />}
            sx={{ color: "#60a5fa", textTransform: "none", fontSize: "0.8rem", p: 0 }}
          >
            Open Source Link
          </Button>
        </Box>
      </DialogContent>

      {/* Modal Actions */}
      <DialogActions sx={{ px: 2.5, py: 1.8, borderTop: "1px solid #27272a", bgcolor: "#121215", gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => onOpenFolder(record)}
          sx={{
            borderColor: "#27272a",
            color: "#e4e4e7",
            bgcolor: "#18181b",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 1,
            "&:hover": { borderColor: "#3f3f46", bgcolor: "#27272a" },
          }}
        >
          Show in Folder
        </Button>

        <Button
          variant="outlined"
          component="a"
          href={downloadUrl}
          download
          startIcon={<DownloadIcon />}
          sx={{
            borderColor: "#27272a",
            color: "#e4e4e7",
            bgcolor: "#18181b",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 1,
            "&:hover": { borderColor: "#3f3f46", bgcolor: "#27272a" },
          }}
        >
          Download to Browser
        </Button>

        {record.formatType === "video" && onCreateProject && (
          <Button
            variant="contained"
            startIcon={creatingProject ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <MovieFilterIcon />}
            onClick={() => onCreateProject(record)}
            disabled={creatingProject}
            sx={{
              bgcolor: "#3b82f6",
              color: "#ffffff",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1,
              px: 2.2,
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            {creatingProject ? "Opening Studio..." : "Send to xClips Studio"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
