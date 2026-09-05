"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  LinearProgress,
  IconButton,
  Alert,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  InputAdornment,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import DownloadIcon from "@mui/icons-material/Download";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import YouTubeIcon from "@mui/icons-material/YouTube";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import ImageIcon from "@mui/icons-material/Image";
import ClearIcon from "@mui/icons-material/Clear";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import CancelIcon from "@mui/icons-material/Cancel";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { apiFetch } from "@/lib/api-client";
import {
  DownloadRecord,
  DownloaderPlatform,
  DownloaderFormatType,
  DownloaderQuality,
  XclipsProject,
} from "@/lib/xclips/types";
import { YouTubeVideoInfo, DownloadProgress, parseTimeToSeconds, formatSecondsToTime } from "@/lib/xclips/ytdlp-downloader";
import { MediaPreviewModal } from "./components/MediaPreviewModal";

interface ActiveTaskItem {
  taskId: string;
  title: string;
  platform: DownloaderPlatform;
  formatType: DownloaderFormatType;
  quality: DownloaderQuality;
  progress: DownloadProgress;
}

export default function MultiplatformDownloaderPage() {
  const router = useRouter();

  // Input states
  const [url, setUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<DownloaderPlatform>("generic");
  const [customName, setCustomName] = useState("");

  // Download Configuration Options (Dropdowns)
  const [formatType, setFormatType] = useState<DownloaderFormatType>("video");
  const [videoQuality, setVideoQuality] = useState<DownloaderQuality>("1080p");
  const [audioQuality, setAudioQuality] = useState<DownloaderQuality>("mp3");
  const [subQuality, setSubQuality] = useState<DownloaderQuality>("srt");
  const [downloadSubtitles, setDownloadSubtitles] = useState(true);

  // Direct Splitter states (YouTube time-range cutting)
  const [enableSplitter, setEnableSplitter] = useState(false);
  const [splitStart, setSplitStart] = useState("00:00:00");
  const [splitEnd, setSplitEnd] = useState("00:01:00");

  // Metadata Preview states
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Active Multi-Task Queue State
  const [activeTasks, setActiveTasks] = useState<Map<string, ActiveTaskItem>>(new Map());
  const activePollRef = useRef<NodeJS.Timeout | null>(null);

  // Download Library / History States
  const [historyRecords, setHistoryRecords] = useState<(DownloadRecord & { exists: boolean })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal & Dialog States
  const [previewRecord, setPreviewRecord] = useState<DownloadRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<DownloadRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);

  // Notification Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  // Strict check for 3 supported platforms (YouTube, TikTok, Instagram)
  const isSupportedPlatform = (inputUrl: string): boolean => {
    if (!inputUrl) return false;
    const trimmed = inputUrl.trim();
    if (!trimmed.includes("http://") && !trimmed.includes("https://")) return false;
    return /youtube\.com|youtu\.be|tiktok\.com|instagram\.com/i.test(trimmed);
  };

  // Detect platform automatically from URL
  const detectPlatform = (inputUrl: string): DownloaderPlatform => {
    if (!inputUrl) return "generic";
    if (/youtube\.com|youtu\.be/i.test(inputUrl)) return "youtube";
    if (/tiktok\.com/i.test(inputUrl)) return "tiktok";
    if (/instagram\.com/i.test(inputUrl)) return "instagram";
    return "generic";
  };

  // Handle URL change
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setDetectedPlatform(detectPlatform(newUrl));
    setInfoError(null);

    const trimmed = newUrl.trim();
    if (!trimmed) {
      setValidationError(null);
      setVideoInfo(null);
    } else if (trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes(".")) {
      if (!isSupportedPlatform(trimmed)) {
        setValidationError("Unsupported URL. Please enter a valid YouTube, TikTok, or Instagram link.");
        setVideoInfo(null);
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleUrlChange(text.trim());
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to read clipboard content", severity: "error" });
    }
  };

  // Load Download History
  const loadHistory = async () => {
    setLoadingHistory(true);
    const params = new URLSearchParams();
    if (filterPlatform !== "all") params.append("platform", filterPlatform);
    if (filterFormat !== "all") params.append("formatType", filterFormat);
    if (searchQuery.trim()) params.append("search", searchQuery.trim());

    const res = await apiFetch<{ ok: boolean; records: (DownloadRecord & { exists: boolean })[] }>(
      `/api/xclips/downloader/history?${params.toString()}`
    );

    if (res.ok && res.data?.records) {
      setHistoryRecords(res.data.records);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadHistory();
  }, [filterFormat, filterPlatform, searchQuery]);

  // Debounced fetch metadata when valid URL is entered
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || (!trimmed.includes("http://") && !trimmed.includes("https://"))) {
      setVideoInfo(null);
      setInfoError(null);
      if (trimmed && (trimmed.includes(".") || trimmed.length > 5)) {
        if (!isSupportedPlatform(trimmed)) {
          setValidationError("Unsupported URL. Please enter a valid YouTube, TikTok, or Instagram link.");
        }
      } else {
        setValidationError(null);
      }
      return;
    }

    if (!isSupportedPlatform(trimmed)) {
      setVideoInfo(null);
      setInfoError(null);
      setValidationError("Unsupported URL. Only YouTube, TikTok, and Instagram links are supported.");
      return;
    }

    setValidationError(null);

    const timer = setTimeout(async () => {
      setFetchingInfo(true);
      setInfoError(null);

      const res = await apiFetch<{ ok: boolean; platform: DownloaderPlatform; info: YouTubeVideoInfo }>(
        "/api/xclips/downloader/info",
        {
          method: "POST",
          body: JSON.stringify({ url: trimmed }),
        }
      );

      if (res.ok && res.data?.info) {
        setVideoInfo(res.data.info);
        if (res.data.platform) setDetectedPlatform(res.data.platform);
        setCustomName(res.data.info.title);
        const dur = res.data.info.duration || 0;
        setSplitStart("00:00:00");
        if (dur > 0) {
          setSplitEnd(formatSecondsToTime(Math.min(dur, 60)));
        } else {
          setSplitEnd("00:01:00");
        }
      } else {
        setVideoInfo(null);
        setInfoError(res.message || "Failed to fetch video metadata. Please verify the URL.");
      }
      setFetchingInfo(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [url]);

  // Active Tasks Polling Loop
  useEffect(() => {
    if (activeTasks.size === 0) {
      if (activePollRef.current) clearInterval(activePollRef.current);
      return;
    }

    activePollRef.current = setInterval(async () => {
      const taskIds = Array.from(activeTasks.keys());
      for (const taskId of taskIds) {
        const progRes = await apiFetch<{
          ok: boolean;
          progress: DownloadProgress & { downloadRecord?: DownloadRecord; project?: XclipsProject; error?: string };
        }>(`/api/xclips/downloader/progress/${taskId}`);

        if (progRes.ok && progRes.data?.progress) {
          const prog = progRes.data.progress;
          if (prog.status === "completed") {
            setActiveTasks((prev) => {
              const next = new Map(prev);
              next.delete(taskId);
              return next;
            });
            loadHistory();
            setSnackbar({
              open: true,
              message: "Download complete and saved to vault storage.",
              severity: "success",
            });

            // If project was created, redirect to studio
            if (prog.project?.id) {
              const projId = prog.project.id;
              setTimeout(() => {
                router.push(`/xclips/studio?id=${projId}`);
              }, 400);
            }
          } else if (prog.status === "error") {
            setActiveTasks((prev) => {
              const next = new Map(prev);
              next.delete(taskId);
              return next;
            });
            loadHistory();
            setSnackbar({
              open: true,
              message: prog.error || "Download failed",
              severity: "error",
            });
          } else {
            // Update progress
            setActiveTasks((prev) => {
              const next = new Map(prev);
              const curr = next.get(taskId);
              if (curr) {
                next.set(taskId, { ...curr, progress: prog });
              }
              return next;
            });
          }
        }
      }
    }, 350);

    return () => {
      if (activePollRef.current) clearInterval(activePollRef.current);
    };
  }, [activeTasks.size]);

  // Add quick duration to splitEnd
  const handleAddSplitDuration = (secondsToAdd: number) => {
    const s = parseTimeToSeconds(splitStart);
    let target = s + secondsToAdd;
    if (videoInfo?.duration && target > videoInfo.duration) {
      target = videoInfo.duration;
    }
    setSplitEnd(formatSecondsToTime(target));
  };

  // Start Download from Selected Dropdown Configuration
  const handleStartDownload = async (sendToStudio: boolean = false) => {
    if (!url.trim()) return;

    if (!isSupportedPlatform(url)) {
      setSnackbar({
        open: true,
        message: "Unsupported URL. Only YouTube, TikTok, and Instagram links are supported.",
        severity: "error",
      });
      return;
    }

    let timeRangePayload: { start: string; end: string } | undefined = undefined;
    if (enableSplitter && detectedPlatform === "youtube" && (formatType === "video" || formatType === "audio")) {
      const sSec = parseTimeToSeconds(splitStart);
      const eSec = parseTimeToSeconds(splitEnd);
      if (eSec <= sSec) {
        setSnackbar({
          open: true,
          message: "Waktu selesai (End) harus lebih besar dari waktu mulai (Start).",
          severity: "error",
        });
        return;
      }
      if (videoInfo?.duration && eSec > videoInfo.duration + 5) {
        setSnackbar({
          open: true,
          message: `Waktu selesai (${splitEnd}) melebihi durasi video (${formatDuration(videoInfo.duration)}).`,
          severity: "error",
        });
        return;
      }
      timeRangePayload = {
        start: formatSecondsToTime(sSec),
        end: formatSecondsToTime(eSec),
      };
    }

    const rangeTag = timeRangePayload ? ` [${timeRangePayload.start}-${timeRangePayload.end}]` : "";
    const currentTitle = (videoInfo?.title || customName.trim() || "Downloading media...") + rangeTag;
    const activeQuality =
      formatType === "video" ? videoQuality : formatType === "audio" ? audioQuality : subQuality;

    const res = await apiFetch<{ ok: boolean; taskId: string; recordId: string }>(
      "/api/xclips/downloader/start",
      {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          formatType,
          quality: activeQuality,
          downloadSubtitles: formatType === "video" ? downloadSubtitles : false,
          customName: customName.trim() || undefined,
          sendToStudio,
          timeRange: timeRangePayload,
        }),
      }
    );

    if (!res.ok || !res.data?.taskId) {
      setSnackbar({ open: true, message: res.message || "Failed to start download", severity: "error" });
      return;
    }

    const taskId = res.data.taskId;
    const newTask: ActiveTaskItem = {
      taskId,
      title: currentTitle,
      platform: detectedPlatform,
      formatType,
      quality: activeQuality,
      progress: {
        percent: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedStr: "Starting...",
        etaStr: "--:--",
        status: "downloading",
      },
    };

    setActiveTasks((prev) => new Map(prev).set(taskId, newTask));
    setSnackbar({
      open: true,
      message: sendToStudio
        ? "Downloading video and preparing Studio workspace..."
        : `Downloading ${formatType.toUpperCase()} (${activeQuality.toUpperCase()})...`,
      severity: "info",
    });
  };

  // Cancel Download Task
  const handleCancelTask = async (taskId: string) => {
    await apiFetch(`/api/xclips/downloader/cancel/${taskId}`, { method: "POST" });
    setActiveTasks((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    setSnackbar({ open: true, message: "Download cancelled", severity: "info" });
    loadHistory();
  };

  // Open in OS File Explorer
  const handleOpenFolder = async (record: DownloadRecord) => {
    const res = await apiFetch<{ ok: boolean; message: string }>("/api/xclips/downloader/open-folder", {
      method: "POST",
      body: JSON.stringify({ id: record.id, filePath: record.filePath }),
    });
    if (res.ok) {
      setSnackbar({ open: true, message: "File Explorer opened", severity: "success" });
    } else {
      setSnackbar({ open: true, message: res.message || "Failed to open folder", severity: "error" });
    }
  };

  // Convert to xClips Studio Project
  const handleCreateProject = async (record: DownloadRecord) => {
    setCreatingProjectId(record.id);
    const res = await apiFetch<{ ok: boolean; project: XclipsProject }>(
      `/api/xclips/downloader/create-project/${record.id}`,
      { method: "POST" }
    );
    setCreatingProjectId(null);

    if (res.ok && res.data?.project) {
      const projId = res.data.project.id;
      setSnackbar({ open: true, message: "Project created. Redirecting to Studio...", severity: "success" });
      setTimeout(() => {
        router.push(`/xclips/studio?id=${projId}`);
      }, 400);
    } else {
      setSnackbar({ open: true, message: res.message || "Failed to create project from video", severity: "error" });
    }
  };

  // Delete Record & File
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    const res = await apiFetch(`/api/xclips/downloader/history/${recordToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setRecordToDelete(null);

    if (res.ok) {
      setSnackbar({ open: true, message: "Media deleted permanently from vault", severity: "success" });
      loadHistory();
    } else {
      setSnackbar({ open: true, message: res.message || "Failed to delete media", severity: "error" });
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const calculateTotalVaultSize = () => {
    return historyRecords.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);
  };

  const renderPlatformBadge = (platform: DownloaderPlatform) => {
    if (platform === "youtube") {
      return (
        <Chip
          icon={<YouTubeIcon sx={{ color: "#ef4444 !important", fontSize: "0.95rem !important" }} />}
          label="YouTube"
          size="small"
          sx={{ bgcolor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", fontWeight: 700, borderRadius: 0.8, height: 22 }}
        />
      );
    }
    if (platform === "tiktok") {
      return (
        <Chip
          label="TikTok"
          size="small"
          sx={{ bgcolor: "rgba(6, 182, 212, 0.12)", color: "#67e8f9", fontWeight: 700, borderRadius: 0.8, height: 22 }}
        />
      );
    }
    if (platform === "instagram") {
      return (
        <Chip
          label="Instagram"
          size="small"
          sx={{ bgcolor: "rgba(236, 72, 153, 0.12)", color: "#f472b6", fontWeight: 700, borderRadius: 0.8, height: 22 }}
        />
      );
    }
    return (
      <Chip
        icon={<VideoLibraryIcon sx={{ fontSize: "0.85rem !important", color: "#a1a1aa !important" }} />}
        label="Universal"
        size="small"
        sx={{ bgcolor: "#27272a", color: "#a1a1aa", fontWeight: 600, borderRadius: 0.8, height: 22 }}
      />
    );
  };

  return (
    <Box sx={{ py: 2, maxWidth: 1400, mx: "auto" }}>
      {/* ===== HEADER NAVIGATION ===== */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.8 }}>
          <IconButton
            onClick={() => router.push("/xclips")}
            sx={{
              bgcolor: "#141418",
              color: "#f4f4f5",
              border: "1px solid #27272a",
              borderRadius: 1.2,
              p: 0.9,
              "&:hover": { bgcolor: "#27272a" },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <DownloadIcon sx={{ color: "#3b82f6", fontSize: 26 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                Universal Media Downloader
              </Typography>
              <Chip
                label="Studio Pro"
                size="small"
                sx={{
                  bgcolor: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  height: 20,
                  borderRadius: 0.6,
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: "#71717a" }}>
              YouTube · TikTok (No Watermark) · Instagram Reels · Fast 4K Video, MP3 &amp; Subtitle Extraction
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          {activeTasks.size > 0 && (
            <Chip
              icon={<CircularProgress size={12} sx={{ color: "#3b82f6 !important" }} />}
              label={`${activeTasks.size} Downloading...`}
              sx={{
                bgcolor: "rgba(59, 130, 246, 0.12)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                fontWeight: 700,
                fontSize: "0.78rem",
                borderRadius: 1,
              }}
            />
          )}
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => router.push("/xclips/settings")}
            sx={{
              borderColor: "#27272a",
              color: "#e4e4e7",
              bgcolor: "#141418",
              fontWeight: 600,
              fontSize: "0.82rem",
              textTransform: "none",
              borderRadius: 1,
              "&:hover": { borderColor: "#3f3f46", bgcolor: "#27272a" },
            }}
          >
            Vault Storage
          </Button>
          <Button
            variant="contained"
            startIcon={<MovieFilterIcon />}
            onClick={() => router.push("/xclips")}
            sx={{
              bgcolor: "#27272a",
              color: "#f4f4f5",
              fontWeight: 700,
              fontSize: "0.82rem",
              textTransform: "none",
              borderRadius: 1,
              "&:hover": { bgcolor: "#3f3f46" },
            }}
          >
            Studio Dashboard
          </Button>
        </Box>
      </Box>

      {/* ===== SPOTLIGHT UNIFIED COMMAND HERO BAR ===== */}
      <Card
        sx={{
          bgcolor: "#121215",
          border: "1px solid #27272a",
          borderRadius: 2.5,
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
          mb: 3.5,
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          {/* Main Input Row */}
          <Box sx={{ display: "flex", gap: 1.2, alignItems: "center" }}>
            <TextField
              fullWidth
              placeholder="Paste YouTube, TikTok, or Instagram media URL here..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) {
                  handleStartDownload(false);
                }
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ pl: 0.5 }}>
                      {fetchingInfo ? (
                        <CircularProgress size={18} sx={{ color: "#3b82f6" }} />
                      ) : detectedPlatform === "youtube" ? (
                        <YouTubeIcon sx={{ color: "#ef4444", fontSize: 22 }} />
                      ) : detectedPlatform === "tiktok" ? (
                        <Typography sx={{ fontWeight: 800, color: "#06b6d4", fontSize: "0.82rem" }}>TT</Typography>
                      ) : detectedPlatform === "instagram" ? (
                        <Typography sx={{ fontWeight: 800, color: "#ec4899", fontSize: "0.82rem" }}>IG</Typography>
                      ) : (
                        <DownloadIcon sx={{ color: "#71717a", fontSize: 20 }} />
                      )}
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end" sx={{ gap: 0.5 }}>
                      {url && (
                        <IconButton size="small" onClick={() => handleUrlChange("")} sx={{ color: "#71717a" }}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentPasteIcon sx={{ fontSize: "0.85rem !important" }} />}
                        onClick={handlePaste}
                        sx={{
                          borderColor: "#27272a",
                          color: "#a1a1aa",
                          bgcolor: "#18181b",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "none",
                          borderRadius: 1,
                          py: 0.5,
                          px: 1.2,
                          "&:hover": { borderColor: "#3f3f46", color: "#f4f4f5", bgcolor: "#27272a" },
                        }}
                      >
                        Paste
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#18181b",
                  borderRadius: 1.8,
                  fontSize: "0.95rem",
                  color: "#f4f4f5",
                  height: 52,
                  "& fieldset": { borderColor: "#27272a" },
                  "&:hover fieldset": { borderColor: "#3f3f46" },
                  "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                },
              }}
            />
          </Box>

          {/* Unsupported URL Alert */}
          {validationError && (
            <Alert severity="error" sx={{ mt: 2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", py: 0.5 }}>
              {validationError}
            </Alert>
          )}

          {/* Info Error */}
          {infoError && (
            <Alert severity="warning" sx={{ mt: 2, bgcolor: "rgba(234, 179, 8, 0.1)", color: "#fde047", py: 0.5 }}>
              {infoError}
            </Alert>
          )}

          {/* ===== COLLAPSIBLE CONFIGURATION OPTIONS & METADATA ===== */}
          <Collapse in={Boolean(isSupportedPlatform(url) && (videoInfo || fetchingInfo))} timeout={300}>
            <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #1f1f23" }}>
              {/* Media Preview Card */}
              {videoInfo && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 1.5,
                    bgcolor: "#18181b",
                    borderRadius: 1.5,
                    border: "1px solid #27272a",
                    mb: 2.5,
                  }}
                >
                  {videoInfo.thumbnail && (
                    <Box
                      sx={{
                        width: 100,
                        height: 56,
                        borderRadius: 1,
                        overflow: "hidden",
                        flexShrink: 0,
                        position: "relative",
                        bgcolor: "#000",
                      }}
                    >
                      <img
                        src={videoInfo.thumbnail}
                        alt={videoInfo.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {videoInfo.duration > 0 && (
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 3,
                            right: 3,
                            bgcolor: "rgba(0,0,0,0.85)",
                            px: 0.6,
                            py: 0.1,
                            borderRadius: 0.5,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          {formatDuration(videoInfo.duration)}
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
                      {renderPlatformBadge(detectedPlatform)}
                      <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                        {videoInfo.uploader || videoInfo.channel || "Creator"}
                      </Typography>
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        color: "#f4f4f5",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.3,
                      }}
                    >
                      {videoInfo.title}
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    variant="text"
                    href={url}
                    target="_blank"
                    endIcon={<OpenInNewIcon sx={{ fontSize: "0.75rem !important" }} />}
                    sx={{ color: "#60a5fa", textTransform: "none", fontSize: "0.75rem", flexShrink: 0 }}
                  >
                    Open Link
                  </Button>
                </Box>
              )}

              {/* ===== DROPDOWN OPTIONS FORM ===== */}
              <Grid container spacing={2} sx={{ alignItems: "center", mb: 2.5 }}>
                {/* 1. Format Type Dropdown */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: "#a1a1aa" }}>Media Format</InputLabel>
                    <Select
                      value={formatType}
                      label="Media Format"
                      onChange={(e) => setFormatType(e.target.value as DownloaderFormatType)}
                      sx={{
                        bgcolor: "#18181b",
                        color: "#f4f4f5",
                        borderRadius: 1.2,
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                      }}
                    >
                      <MenuItem value="video">Video (MP4)</MenuItem>
                      <MenuItem value="audio">Audio Only (MP3 / WAV)</MenuItem>
                      <MenuItem value="subtitle">Subtitle Track (SRT / VTT)</MenuItem>
                      <MenuItem value="thumbnail">Cover Thumbnail (JPG)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* 2. Adaptive Quality Dropdown */}
                {formatType === "video" && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: "#a1a1aa" }}>Video Quality</InputLabel>
                      <Select
                        value={videoQuality}
                        label="Video Quality"
                        onChange={(e) => setVideoQuality(e.target.value as DownloaderQuality)}
                        sx={{
                          bgcolor: "#18181b",
                          color: "#f4f4f5",
                          borderRadius: 1.2,
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                        }}
                      >
                        <MenuItem value="1080p">Full HD 1080p (Recommended)</MenuItem>
                        <MenuItem value="4k">Ultra HD 4K (2160p)</MenuItem>
                        <MenuItem value="1440p">Quad HD 2K (1440p)</MenuItem>
                        <MenuItem value="720p">HD 720p (Fast &amp; Light)</MenuItem>
                        <MenuItem value="480p">SD 480p (Compact)</MenuItem>
                        <MenuItem value="best">Best Original Source</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {formatType === "audio" && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: "#a1a1aa" }}>Audio Quality</InputLabel>
                      <Select
                        value={audioQuality}
                        label="Audio Quality"
                        onChange={(e) => setAudioQuality(e.target.value as DownloaderQuality)}
                        sx={{
                          bgcolor: "#18181b",
                          color: "#f4f4f5",
                          borderRadius: 1.2,
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                        }}
                      >
                        <MenuItem value="mp3">MP3 — 320 kbps (Universal HQ)</MenuItem>
                        <MenuItem value="m4a">M4A — AAC 256 kbps (Apple Standard)</MenuItem>
                        <MenuItem value="wav">WAV — 16-bit Lossless Studio</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {formatType === "subtitle" && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: "#a1a1aa" }}>Subtitle Format</InputLabel>
                      <Select
                        value={subQuality}
                        label="Subtitle Format"
                        onChange={(e) => setSubQuality(e.target.value as DownloaderQuality)}
                        sx={{
                          bgcolor: "#18181b",
                          color: "#f4f4f5",
                          borderRadius: 1.2,
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                        }}
                      >
                        <MenuItem value="srt">SRT — SubRip Subtitle Track</MenuItem>
                        <MenuItem value="vtt">VTT — WebVTT Timed Text</MenuItem>
                        <MenuItem value="txt">TXT — Clean Transcript</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {formatType === "thumbnail" && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="body2" sx={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                      Downloads high-resolution cover image (.JPG) directly to your vault.
                    </Typography>
                  </Grid>
                )}

                {/* 3. Subtitles Switch (for Video) */}
                {formatType === "video" && (
                  <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={downloadSubtitles}
                          onChange={(e) => setDownloadSubtitles(e.target.checked)}
                          size="small"
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: "#3b82f6" },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#3b82f6" },
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ color: "#e4e4e7", fontSize: "0.82rem" }}>
                          Include Subtitles &amp; Closed Captions (.srt)
                        </Typography>
                      }
                    />
                  </Grid>
                )}
              </Grid>

              {/* 4. Direct Splitter Section (YouTube Video & Audio Only) */}
              {detectedPlatform === "youtube" && (formatType === "video" || formatType === "audio") && (
                <Box
                  sx={{
                    mb: 2.8,
                    p: 2,
                    bgcolor: enableSplitter ? "rgba(59, 130, 246, 0.06)" : "#141418",
                    border: "1px solid",
                    borderColor: enableSplitter ? "rgba(59, 130, 246, 0.45)" : "#27272a",
                    borderRadius: 2,
                    transition: "all 0.25s ease",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={enableSplitter}
                          onChange={(e) => setEnableSplitter(e.target.checked)}
                          size="small"
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": { color: "#3b82f6" },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#3b82f6" },
                          }}
                        />
                      }
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5", fontSize: "0.88rem" }}>
                            ✂️ Direct Splitter (Potong Rentang Waktu Stream)
                          </Typography>
                          <Chip
                            label="Frame-Accurate"
                            size="small"
                            sx={{
                              bgcolor: "rgba(59, 130, 246, 0.18)",
                              color: "#60a5fa",
                              fontWeight: 700,
                              fontSize: "0.68rem",
                              height: 19,
                              borderRadius: 0.6,
                            }}
                          />
                        </Box>
                      }
                    />
                    <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.75rem" }}>
                      Hanya mengunduh fragment rentang waktu langsung dari YouTube. Hemat kuota &amp; penyimpanan disk.
                    </Typography>
                  </Box>

                  <Collapse in={enableSplitter} timeout={250}>
                    <Box sx={{ mt: 2, pt: 1.8, borderTop: "1px dashed rgba(59, 130, 246, 0.25)" }}>
                      <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
                        {/* Start Time Input */}
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Mulai (Start)"
                            value={splitStart}
                            onChange={(e) => setSplitStart(e.target.value)}
                            placeholder="00:00:00"
                            helperText="Format HH:MM:SS atau MM:SS"
                            slotProps={{
                              input: {
                                sx: { bgcolor: "#18181b", color: "#f4f4f5", fontSize: "0.85rem", borderRadius: 1.2 },
                              },
                              formHelperText: { sx: { color: "#71717a", fontSize: "0.7rem" } },
                              inputLabel: { sx: { color: "#a1a1aa" } },
                            }}
                          />
                        </Grid>

                        {/* End Time Input */}
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Selesai (End)"
                            value={splitEnd}
                            onChange={(e) => setSplitEnd(e.target.value)}
                            placeholder="00:01:00"
                            helperText="Format HH:MM:SS atau MM:SS"
                            slotProps={{
                              input: {
                                sx: { bgcolor: "#18181b", color: "#f4f4f5", fontSize: "0.85rem", borderRadius: 1.2 },
                              },
                              formHelperText: { sx: { color: "#71717a", fontSize: "0.7rem" } },
                              inputLabel: { sx: { color: "#a1a1aa" } },
                            }}
                          />
                        </Grid>

                        {/* Quick Presets & Badges */}
                        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap", mb: 1 }}>
                            <Typography variant="caption" sx={{ color: "#a1a1aa", mr: 0.5, fontWeight: 600 }}>
                              Tambah Durasi:
                            </Typography>
                            {[
                              { label: "+30s", sec: 30 },
                              { label: "+1m", sec: 60 },
                              { label: "+3m", sec: 180 },
                              { label: "+5m", sec: 300 },
                              { label: "+10m", sec: 600 },
                            ].map((btn) => (
                              <Button
                                key={btn.label}
                                size="small"
                                variant="outlined"
                                onClick={() => handleAddSplitDuration(btn.sec)}
                                sx={{
                                  py: 0.2,
                                  px: 1,
                                  minWidth: "auto",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  borderColor: "#27272a",
                                  color: "#cbd5e1",
                                  bgcolor: "#18181b",
                                  borderRadius: 0.8,
                                  textTransform: "none",
                                  "&:hover": { borderColor: "#3b82f6", color: "#60a5fa", bgcolor: "rgba(59, 130, 246, 0.1)" },
                                }}
                              >
                                {btn.label}
                              </Button>
                            ))}
                          </Box>

                          {/* Duration and Bandwidth badges */}
                          {(() => {
                            const sSec = parseTimeToSeconds(splitStart);
                            const eSec = parseTimeToSeconds(splitEnd);
                            const clipSec = Math.max(0, eSec - sSec);
                            const isInvalid = eSec <= sSec;
                            const isOver = Boolean(videoInfo?.duration && eSec > videoInfo.duration + 5);

                            return (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                {isInvalid ? (
                                  <Typography variant="caption" sx={{ color: "#ef4444", fontWeight: 700 }}>
                                    ⚠️ Waktu selesai harus lebih besar dari waktu mulai
                                  </Typography>
                                ) : (
                                  <>
                                    <Chip
                                      label={`⏱️ Durasi Segmen: ${formatDuration(clipSec)}`}
                                      size="small"
                                      sx={{ bgcolor: "#27272a", color: "#e2e8f0", fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                                    />
                                    {videoInfo?.duration && videoInfo.duration > clipSec && (
                                      <Chip
                                        label={`⚡ Hemat Bandwidth ~${Math.round((1 - clipSec / videoInfo.duration) * 100)}%`}
                                        size="small"
                                        sx={{
                                          bgcolor: "rgba(16, 185, 129, 0.15)",
                                          color: "#34d399",
                                          fontWeight: 700,
                                          fontSize: "0.72rem",
                                          height: 22,
                                        }}
                                      />
                                    )}
                                    {isOver && (
                                      <Typography variant="caption" sx={{ color: "#f59e0b", fontWeight: 600 }}>
                                        (Melebihi durasi video {formatDuration(videoInfo!.duration)})
                                      </Typography>
                                    )}
                                  </>
                                )}
                              </Box>
                            );
                          })()}
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* Action Buttons Row */}
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  startIcon={<FileDownloadIcon />}
                  onClick={() => handleStartDownload(false)}
                  disabled={!url.trim()}
                  sx={{
                    bgcolor: "#3b82f6",
                    color: "#ffffff",
                    fontWeight: 700,
                    textTransform: "none",
                    borderRadius: 1.2,
                    fontSize: "0.88rem",
                    py: 1,
                    px: 3,
                    boxShadow: "0 2px 12px rgba(59, 130, 246, 0.35)",
                    "&:hover": { bgcolor: "#2563eb" },
                    "&.Mui-disabled": { bgcolor: "#27272a", color: "#71717a" },
                  }}
                >
                  Download Media
                </Button>

                {formatType === "video" && (
                  <Button
                    variant="contained"
                    startIcon={<MovieFilterIcon />}
                    onClick={() => handleStartDownload(true)}
                    disabled={!url.trim()}
                    sx={{
                      bgcolor: "#4f46e5",
                      color: "#ffffff",
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: 1.2,
                      fontSize: "0.88rem",
                      py: 1,
                      px: 2.5,
                      boxShadow: "0 2px 12px rgba(79, 70, 229, 0.35)",
                      "&:hover": { bgcolor: "#4338ca" },
                      "&.Mui-disabled": { bgcolor: "#27272a", color: "#71717a" },
                    }}
                  >
                    Send to Studio
                  </Button>
                )}
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* ===== ACTIVE MULTI-TASK QUEUE MONITOR ===== */}
      {activeTasks.size > 0 && (
        <Card
          sx={{
            bgcolor: "#141418",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            borderRadius: 2,
            p: 2,
            mb: 3.5,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} sx={{ color: "#3b82f6" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#60a5fa" }}>
                Active Download Queue ({activeTasks.size})
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {Array.from(activeTasks.values()).map((task) => (
              <Box
                key={task.taskId}
                sx={{
                  p: 1.5,
                  bgcolor: "#18181b",
                  borderRadius: 1.5,
                  border: "1px solid #27272a",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8, gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: "#f4f4f5",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: { xs: 200, sm: 400 },
                    }}
                  >
                    {task.title}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.78rem" }}>
                      {task.progress.totalSizeStr ? `${task.progress.totalSizeStr} · ` : ""}
                      {task.progress.speedStr} {task.progress.etaStr && `· ETA ${task.progress.etaStr}`}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCancelTask(task.taskId)}
                      sx={{ color: "#f87171", p: 0.3 }}
                      title="Cancel Download"
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={task.progress.percent}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: "#27272a",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: "#3b82f6",
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Card>
      )}

      {/* ===== MEDIA VAULT & DOWNLOAD HISTORY ===== */}
      <Box sx={{ mb: 4 }}>
        {/* Control Toolbar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <VideoLibraryIcon sx={{ color: "#3b82f6", fontSize: 22 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
              Media Vault &amp; History
            </Typography>
            <Chip
              label={`${historyRecords.length} Items · ${formatFileSize(calculateTotalVaultSize())}`}
              size="small"
              sx={{ bgcolor: "#18181b", color: "#a1a1aa", border: "1px solid #27272a", fontWeight: 700, fontSize: "0.72rem" }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {/* Search filter */}
            <TextField
              size="small"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "#71717a" }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: 180,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#141418",
                  borderRadius: 1,
                  fontSize: "0.8rem",
                  color: "#f4f4f5",
                  height: 36,
                  "& fieldset": { borderColor: "#27272a" },
                },
              }}
            />

            {/* Platform Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                sx={{
                  bgcolor: "#141418",
                  color: "#f4f4f5",
                  borderRadius: 1,
                  fontSize: "0.8rem",
                  height: 36,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                }}
              >
                <MenuItem value="all">All Platforms</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="tiktok">TikTok</MenuItem>
                <MenuItem value="instagram">Instagram</MenuItem>
              </Select>
            </FormControl>

            {/* Format Filter */}
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={filterFormat}
                onChange={(e) => setFilterFormat(e.target.value)}
                sx={{
                  bgcolor: "#141418",
                  color: "#f4f4f5",
                  borderRadius: 1,
                  fontSize: "0.8rem",
                  height: 36,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                }}
              >
                <MenuItem value="all">All Formats</MenuItem>
                <MenuItem value="video">Video (MP4)</MenuItem>
                <MenuItem value="audio">Audio (MP3)</MenuItem>
                <MenuItem value="subtitle">Subtitle</MenuItem>
                <MenuItem value="thumbnail">Thumbnail</MenuItem>
              </Select>
            </FormControl>

            {/* View Mode Toggle Switcher */}
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, next) => {
                if (next) setViewMode(next);
              }}
              sx={{
                bgcolor: "#141418",
                border: "1px solid #27272a",
                borderRadius: 1,
                height: 36,
                "& .MuiToggleButton-root": {
                  color: "#71717a",
                  borderColor: "#27272a",
                  px: 1,
                  "&.Mui-selected": { color: "#3b82f6", bgcolor: "rgba(59, 130, 246, 0.12)" },
                },
              }}
            >
              <ToggleButton value="grid" title="Visual Grid View">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" title="Dense Table View">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            <IconButton onClick={loadHistory} sx={{ bgcolor: "#141418", color: "#a1a1aa", borderRadius: 1, p: 0.8 }} title="Refresh">
              {loadingHistory ? <CircularProgress size={16} sx={{ color: "#3b82f6" }} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {/* Empty State */}
        {loadingHistory ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={30} sx={{ color: "#3b82f6" }} />
          </Box>
        ) : historyRecords.length === 0 ? (
          <Card sx={{ bgcolor: "#121215", border: "1px dashed #27272a", borderRadius: 2, p: 5, textAlign: "center" }}>
            <DownloadIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#a1a1aa", mb: 0.3 }}>
              No media downloads yet
            </Typography>
            <Typography variant="body2" sx={{ color: "#71717a" }}>
              Paste a video URL in the command bar above to start downloading.
            </Typography>
          </Card>
        ) : viewMode === "grid" ? (
          /* ===== VIEW 1: VISUAL CARD GRID ===== */
          <Grid container spacing={2}>
            {historyRecords.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
                <Card
                  sx={{
                    bgcolor: "#121215",
                    border: "1px solid #27272a",
                    borderRadius: 1.8,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "#3f3f46", transform: "translateY(-2px)" },
                  }}
                >
                  {/* Media Cover / Preview Header */}
                  <Box sx={{ position: "relative", width: "100%", height: 140, bgcolor: "#09090b" }}>
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#3f3f46",
                        }}
                      >
                        {item.formatType === "audio" ? (
                          <AudiotrackIcon sx={{ fontSize: 42 }} />
                        ) : item.formatType === "subtitle" ? (
                          <SubtitlesIcon sx={{ fontSize: 42 }} />
                        ) : (
                          <MovieFilterIcon sx={{ fontSize: 42 }} />
                        )}
                      </Box>
                    )}

                    {/* Platform Badge Overlay */}
                    <Box sx={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 0.5, alignItems: "center" }}>
                      <Chip
                        label={item.platform.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: "rgba(0,0,0,0.8)",
                          color:
                            item.platform === "youtube"
                              ? "#fca5a5"
                              : item.platform === "tiktok"
                              ? "#67e8f9"
                              : item.platform === "instagram"
                              ? "#f472b6"
                              : "#e4e4e7",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          height: 18,
                          backdropFilter: "blur(4px)",
                          borderRadius: 0.6,
                        }}
                      />
                      {(item.timeRange || item.title.includes("[SPLIT_")) && (
                        <Chip
                          label={
                            item.timeRange
                              ? `✂️ ${item.timeRange.start}-${item.timeRange.end}`
                              : "✂️ SPLIT"
                          }
                          size="small"
                          sx={{
                            bgcolor: "rgba(59, 130, 246, 0.85)",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "0.65rem",
                            height: 18,
                            backdropFilter: "blur(4px)",
                            borderRadius: 0.6,
                          }}
                        />
                      )}
                    </Box>

                    {/* Duration / Format Badge Overlay */}
                    <Box sx={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 0.5 }}>
                      {item.durationSec > 0 && (
                        <Box
                          sx={{
                            bgcolor: "rgba(0,0,0,0.85)",
                            color: "#ffffff",
                            px: 0.6,
                            py: 0.1,
                            borderRadius: 0.6,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                          }}
                        >
                          {formatDuration(item.durationSec)}
                        </Box>
                      )}
                      <Box
                        sx={{
                          bgcolor: "#3b82f6",
                          color: "#ffffff",
                          px: 0.6,
                          py: 0.1,
                          borderRadius: 0.6,
                          fontSize: "0.65rem",
                          fontWeight: 800,
                        }}
                      >
                        {item.formatType.toUpperCase()} ({item.quality})
                      </Box>
                    </Box>

                    {/* Quick Play Overlay */}
                    <IconButton
                      onClick={() => setPreviewRecord(item)}
                      sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        bgcolor: "rgba(0, 0, 0, 0.6)",
                        color: "#ffffff",
                        "&:hover": { bgcolor: "#3b82f6", transform: "translate(-50%, -50%) scale(1.1)" },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <PlayCircleIcon sx={{ fontSize: 32 }} />
                    </IconButton>
                  </Box>

                  {/* Card Content */}
                  <CardContent sx={{ p: 1.5, flexGrow: 1, display: "flex", flexDirection: "column" }}>
                    <Typography
                      variant="body2"
                      title={item.title}
                      sx={{
                        fontWeight: 700,
                        color: "#f4f4f5",
                        mb: 0.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.3,
                        fontSize: "0.85rem",
                      }}
                    >
                      {item.title}
                    </Typography>

                    <Typography variant="caption" sx={{ color: "#71717a", mb: 1, display: "block", fontSize: "0.72rem" }}>
                      {item.author || "Creator"} · {formatFileSize(item.fileSizeBytes)}
                    </Typography>

                    <Box sx={{ mt: "auto", pt: 1, borderTop: "1px solid #1f1f23", display: "flex", gap: 0.8 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlayCircleIcon sx={{ fontSize: "0.9rem !important" }} />}
                        onClick={() => setPreviewRecord(item)}
                        sx={{
                          flex: 1,
                          borderColor: "#27272a",
                          color: "#e4e4e7",
                          bgcolor: "#141418",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          textTransform: "none",
                          borderRadius: 0.8,
                          py: 0.3,
                          "&:hover": { borderColor: "#3f3f46", bgcolor: "#27272a" },
                        }}
                      >
                        Preview
                      </Button>

                      <Tooltip title="Show in File Explorer">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenFolder(item)}
                          sx={{
                            border: "1px solid #27272a",
                            color: "#a1a1aa",
                            borderRadius: 0.8,
                            p: 0.5,
                            "&:hover": { borderColor: "#3f3f46", color: "#f4f4f5", bgcolor: "#27272a" },
                          }}
                        >
                          <FolderOpenIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Download to Browser">
                        <IconButton
                          size="small"
                          component="a"
                          href={`/api/xclips/downloader/file/${item.id}?download=1`}
                          download
                          sx={{
                            border: "1px solid #27272a",
                            color: "#a1a1aa",
                            borderRadius: 0.8,
                            p: 0.5,
                            "&:hover": { borderColor: "#3f3f46", color: "#f4f4f5", bgcolor: "#27272a" },
                          }}
                        >
                          <DownloadIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>

                      {item.formatType === "video" && (
                        <Tooltip title="Open in xClips Studio">
                          <IconButton
                            size="small"
                            onClick={() => handleCreateProject(item)}
                            disabled={creatingProjectId === item.id}
                            sx={{
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              bgcolor: "rgba(59, 130, 246, 0.1)",
                              color: "#60a5fa",
                              borderRadius: 0.8,
                              p: 0.5,
                              "&:hover": { bgcolor: "#3b82f6", color: "#ffffff" },
                            }}
                          >
                            {creatingProjectId === item.id ? (
                              <CircularProgress size={14} sx={{ color: "#60a5fa" }} />
                            ) : (
                              <MovieFilterIcon sx={{ fontSize: "1rem" }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}

                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => setRecordToDelete(item)}
                          sx={{
                            border: "1px solid #27272a",
                            color: "#71717a",
                            borderRadius: 0.8,
                            p: 0.5,
                            "&:hover": { borderColor: "rgba(239, 68, 68, 0.4)", color: "#f87171", bgcolor: "rgba(239, 68, 68, 0.1)" },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          /* ===== VIEW 2: DENSE TABLE VIEW ===== */
          <TableContainer
            sx={{
              bgcolor: "#121215",
              border: "1px solid #27272a",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: "#18181b" }}>
                <TableRow>
                  <TableCell sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Media</TableCell>
                  <TableCell sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Platform</TableCell>
                  <TableCell sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Format &amp; Quality</TableCell>
                  <TableCell sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Size</TableCell>
                  <TableCell sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Duration</TableCell>
                  <TableCell align="right" sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.78rem" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRecords.map((item) => (
                  <TableRow key={item.id} sx={{ "&:hover": { bgcolor: "#18181b" }, borderBottom: "1px solid #1f1f23" }}>
                    <TableCell sx={{ color: "#f4f4f5", py: 1.2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        {item.thumbnailUrl && (
                          <Box sx={{ width: 48, height: 28, borderRadius: 0.6, overflow: "hidden", flexShrink: 0, bgcolor: "#000" }}>
                            <img src={item.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </Box>
                        )}
                        <Box sx={{ minWidth: 0, maxWidth: 380 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {item.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.7rem" }}>
                            {item.author || "Creator"}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 1.2 }}>
                      {renderPlatformBadge(item.platform)}
                    </TableCell>

                    <TableCell sx={{ py: 1.2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                        <Chip
                          label={`${item.formatType.toUpperCase()} (${item.quality})`}
                          size="small"
                          sx={{ bgcolor: "#27272a", color: "#e4e4e7", fontWeight: 700, fontSize: "0.68rem", height: 20 }}
                        />
                        {(item.timeRange || item.title.includes("[SPLIT_")) && (
                          <Chip
                            label={
                              item.timeRange
                                ? `✂️ ${item.timeRange.start}-${item.timeRange.end}`
                                : "✂️ SPLIT"
                            }
                            size="small"
                            sx={{
                              bgcolor: "rgba(59, 130, 246, 0.15)",
                              color: "#60a5fa",
                              fontWeight: 700,
                              fontSize: "0.65rem",
                              height: 20,
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    <TableCell sx={{ color: "#a1a1aa", fontSize: "0.8rem", py: 1.2 }}>
                      {formatFileSize(item.fileSizeBytes)}
                    </TableCell>

                    <TableCell sx={{ color: "#a1a1aa", fontSize: "0.8rem", py: 1.2 }}>
                      {item.durationSec > 0 ? formatDuration(item.durationSec) : "—"}
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1.2 }}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.8 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setPreviewRecord(item)}
                          sx={{
                            borderColor: "#27272a",
                            color: "#e4e4e7",
                            bgcolor: "#18181b",
                            fontSize: "0.72rem",
                            textTransform: "none",
                            py: 0.2,
                            px: 1,
                            borderRadius: 0.6,
                            "&:hover": { bgcolor: "#27272a" },
                          }}
                        >
                          Play
                        </Button>

                        <Tooltip title="Show in File Explorer">
                          <IconButton size="small" onClick={() => handleOpenFolder(item)} sx={{ color: "#a1a1aa", p: 0.4 }}>
                            <FolderOpenIcon sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Download to Browser">
                          <IconButton
                            size="small"
                            component="a"
                            href={`/api/xclips/downloader/file/${item.id}?download=1`}
                            download
                            sx={{ color: "#a1a1aa", p: 0.4 }}
                          >
                            <DownloadIcon sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>

                        {item.formatType === "video" && (
                          <Tooltip title="Open in Studio">
                            <IconButton
                              size="small"
                              onClick={() => handleCreateProject(item)}
                              sx={{ color: "#60a5fa", p: 0.4 }}
                            >
                              <MovieFilterIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setRecordToDelete(item)} sx={{ color: "#71717a", p: 0.4 }}>
                            <DeleteIcon sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ===== MEDIA PREVIEW MODAL ===== */}
      <MediaPreviewModal
        open={Boolean(previewRecord)}
        onClose={() => setPreviewRecord(null)}
        record={previewRecord}
        onOpenFolder={handleOpenFolder}
        onCreateProject={handleCreateProject}
        creatingProject={Boolean(creatingProjectId)}
      />

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog
        open={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#121215",
              color: "#f4f4f5",
              border: "1px solid #27272a",
              borderRadius: 2,
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Media from Vault?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
            The physical file on disk (<code style={{ color: "#fca5a5" }}>{recordToDelete?.filePath}</code>) and its vault record will be deleted permanently.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecordToDelete(null)} sx={{ color: "#a1a1aa", textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
            sx={{ fontWeight: 700, textTransform: "none", borderRadius: 1 }}
          >
            {deleting ? "Deleting..." : "Yes, Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== NOTIFICATION SNACKBAR ===== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{
            width: "100%",
            bgcolor: snackbar.severity === "success" ? "#10b981" : snackbar.severity === "error" ? "#ef4444" : "#18181b",
            color: "#ffffff",
            fontWeight: 600,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
