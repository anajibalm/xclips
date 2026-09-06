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
  Divider,
  Link,
  SvgIcon,
  SvgIconProps,
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
import InstagramIcon from "@mui/icons-material/Instagram";
import PinterestIcon from "@mui/icons-material/Pinterest";
import XIcon from "@mui/icons-material/X";
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ReplayIcon from "@mui/icons-material/Replay";

import { apiFetch } from "@/lib/api-client";
import {
  DownloadRecord,
  DownloaderPlatform,
  DownloaderFormatType,
  DownloaderQuality,
  XclipsProject,
  YouTubeVideoInfo,
  DownloadProgress,
} from "@/lib/xclips/types";
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/xclips/time-utils";
import { MediaPreviewModal } from "./components/MediaPreviewModal";

function TikTokIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ color: "#00f2fe", ...props.sx }}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.78 4.54 6.27 6.27 0 0 0 1.93-4.53V8.89a8.28 8.28 0 0 0 4.88 1.58V7.02a4.84 4.84 0 0 1-.72-.33Z" />
    </SvgIcon>
  );
}

interface ActiveTaskItem {
  taskId: string;
  title: string;
  platform: DownloaderPlatform;
  formatType: DownloaderFormatType;
  quality: DownloaderQuality;
  progress: DownloadProgress;
  status: "downloading" | "completed" | "error";
  downloadRecord?: DownloadRecord;
  error?: string;
  targetUrl: string;
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

  // Download Library / History States (Default: Table View)
  const [historyRecords, setHistoryRecords] = useState<(DownloadRecord & { exists: boolean })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
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

  // Strict check for supported platforms (YouTube, TikTok, Instagram, X/Twitter, Pinterest)
  const isSupportedPlatform = (inputUrl: string): boolean => {
    if (!inputUrl) return false;
    const trimmed = inputUrl.trim();
    if (!trimmed.includes("http://") && !trimmed.includes("https://")) return false;
    return /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|pinterest\.com|pin\.it/i.test(trimmed);
  };

  // Detect platform automatically from URL
  const detectPlatform = (inputUrl: string): DownloaderPlatform => {
    if (!inputUrl) return "generic";
    if (/youtube\.com|youtu\.be/i.test(inputUrl)) return "youtube";
    if (/tiktok\.com/i.test(inputUrl)) return "tiktok";
    if (/instagram\.com/i.test(inputUrl)) return "instagram";
    if (/twitter\.com|x\.com/i.test(inputUrl)) return "x";
    if (/pinterest\.com|pin\.it/i.test(inputUrl)) return "pinterest";
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
        setValidationError("Unsupported URL. Please enter a YouTube, TikTok, Instagram, X.com, or Pinterest link.");
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
      setSnackbar({ open: true, message: "Failed to read clipboard text", severity: "error" });
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
          setValidationError("Unsupported URL. Please enter a YouTube, TikTok, Instagram, X.com, or Pinterest link.");
        }
      } else {
        setValidationError(null);
      }
      return;
    }

    if (!isSupportedPlatform(trimmed)) {
      setVideoInfo(null);
      setInfoError(null);
      setValidationError("Unsupported URL. Please enter a YouTube, TikTok, Instagram, X.com, or Pinterest link.");
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
        const info = res.data.info;
        setVideoInfo(info);
        if (res.data.platform) setDetectedPlatform(res.data.platform);
        setCustomName(info.title);

        // If media is photo/image, auto set formatType to image
        if (info.mediaType === "image") {
          setFormatType("image");
        } else if (formatType === "image") {
          setFormatType("video");
        }

        const dur = info.duration || 0;
        setSplitStart("00:00:00");
        if (dur > 0) {
          setSplitEnd(formatSecondsToTime(Math.min(dur, 60)));
        } else {
          setSplitEnd("00:01:00");
        }
      } else {
        setVideoInfo(null);
        setInfoError(res.message || "Failed to retrieve media information. Ensure the URL is publicly accessible.");
      }
      setFetchingInfo(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [url]);

  // Active Tasks Polling Loop
  useEffect(() => {
    const hasDownloading = Array.from(activeTasks.values()).some((t) => t.status === "downloading");
    if (!hasDownloading) {
      if (activePollRef.current) clearInterval(activePollRef.current);
      return;
    }

    activePollRef.current = setInterval(async () => {
      const downloadingTasks = Array.from(activeTasks.values()).filter((t) => t.status === "downloading");
      for (const task of downloadingTasks) {
        const taskId = task.taskId;
        const progRes = await apiFetch<{
          ok: boolean;
          progress: DownloadProgress & { downloadRecord?: DownloadRecord; project?: XclipsProject; error?: string };
        }>(`/api/xclips/downloader/progress/${taskId}`);

        if (progRes.ok && progRes.data?.progress) {
          const prog = progRes.data.progress;
          if (prog.status === "completed") {
            setActiveTasks((prev) => {
              const next = new Map(prev);
              const curr = next.get(taskId);
              if (curr) {
                next.set(taskId, {
                  ...curr,
                  status: "completed",
                  progress: prog,
                  downloadRecord: prog.downloadRecord,
                });
              }
              return next;
            });
            loadHistory();
            setSnackbar({
              open: true,
              message: "Download completed and saved to Media Vault.",
              severity: "success",
            });

            if (prog.project?.id) {
              const projId = prog.project.id;
              setTimeout(() => {
                router.push(`/xclips/studio?id=${projId}`);
              }, 400);
            }
          } else if (prog.status === "error") {
            setActiveTasks((prev) => {
              const next = new Map(prev);
              const curr = next.get(taskId);
              if (curr) {
                next.set(taskId, {
                  ...curr,
                  status: "error",
                  error: prog.error || "Failed to download media",
                });
              }
              return next;
            });
            loadHistory();
            setSnackbar({
              open: true,
              message: prog.error || "Failed to download media",
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
    }, 400);

    return () => {
      if (activePollRef.current) clearInterval(activePollRef.current);
    };
  }, [activeTasks]);

  // Add quick duration to splitEnd
  const handleAddSplitDuration = (secondsToAdd: number) => {
    const s = parseTimeToSeconds(splitStart);
    let target = s + secondsToAdd;
    if (videoInfo?.duration && target > videoInfo.duration) {
      target = videoInfo.duration;
    }
    setSplitEnd(formatSecondsToTime(target));
  };

  // Start Download from Selected Configuration
  const handleStartDownload = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || url).trim();
    if (!targetUrl) return;

    if (!isSupportedPlatform(targetUrl)) {
      setSnackbar({
        open: true,
        message: "Unsupported URL. Only YouTube, TikTok, Instagram, X.com, and Pinterest are supported.",
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
          message: "End time must be greater than start time.",
          severity: "error",
        });
        return;
      }
      if (videoInfo?.duration && eSec > videoInfo.duration + 5) {
        setSnackbar({
          open: true,
          message: `End time (${splitEnd}) exceeds video duration (${formatDuration(videoInfo.duration)}).`,
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
          url: targetUrl,
          formatType,
          quality: activeQuality,
          downloadSubtitles: formatType === "video" ? downloadSubtitles : false,
          customName: customName.trim() || undefined,
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
      status: "downloading",
      targetUrl,
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
      message: `Downloading ${formatType.toUpperCase()} (${activeQuality.toUpperCase()})...`,
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

  // Dismiss finished/error task from Queue
  const handleDismissTask = (taskId: string) => {
    setActiveTasks((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  };

  // Clear all completed tasks from Queue
  const handleClearFinishedTasks = () => {
    setActiveTasks((prev) => {
      const next = new Map();
      for (const [k, v] of prev.entries()) {
        if (v.status === "downloading") {
          next.set(k, v);
        }
      }
      return next;
    });
  };

  // Open in OS File Explorer
  const handleOpenFolder = async (record: DownloadRecord) => {
    const res = await apiFetch<{ ok: boolean; message: string }>("/api/xclips/downloader/open-folder", {
      method: "POST",
      body: JSON.stringify({ id: record.id, filePath: record.filePath }),
    });
    if (res.ok) {
      setSnackbar({ open: true, message: "File Explorer opened successfully", severity: "success" });
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
      setSnackbar({ open: true, message: "Project created. Opening Studio...", severity: "success" });
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
      setSnackbar({ open: true, message: "Media successfully deleted from vault", severity: "success" });
      loadHistory();
    } else {
      setSnackbar({ open: true, message: res.message || "Failed to delete history record", severity: "error" });
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
          icon={<YouTubeIcon sx={{ color: "#ef4444 !important", fontSize: "0.85rem !important" }} />}
          label="YouTube"
          size="small"
          sx={{ bgcolor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", fontWeight: 700, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
        />
      );
    }
    if (platform === "tiktok") {
      return (
        <Chip
          icon={<TikTokIcon sx={{ fontSize: "0.85rem !important" }} />}
          label="TikTok"
          size="small"
          sx={{ bgcolor: "rgba(6, 182, 212, 0.12)", color: "#67e8f9", fontWeight: 700, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
        />
      );
    }
    if (platform === "instagram") {
      return (
        <Chip
          icon={<InstagramIcon sx={{ color: "#ec4899 !important", fontSize: "0.85rem !important" }} />}
          label="Instagram"
          size="small"
          sx={{ bgcolor: "rgba(236, 72, 153, 0.12)", color: "#f472b6", fontWeight: 700, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
        />
      );
    }
    if (platform === "x") {
      return (
        <Chip
          icon={<XIcon sx={{ color: "#ffffff !important", fontSize: "0.8rem !important" }} />}
          label="𝕏"
          size="small"
          sx={{ bgcolor: "rgba(255, 255, 255, 0.12)", color: "#ffffff", fontWeight: 700, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
        />
      );
    }
    if (platform === "pinterest") {
      return (
        <Chip
          icon={<PinterestIcon sx={{ color: "#e60023 !important", fontSize: "0.85rem !important" }} />}
          label="Pinterest"
          size="small"
          sx={{ bgcolor: "rgba(230, 0, 35, 0.15)", color: "#f87171", fontWeight: 700, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
        />
      );
    }
    return (
      <Chip
        icon={<VideoLibraryIcon sx={{ fontSize: "0.8rem !important", color: "#a1a1aa !important" }} />}
        label="Universal"
        size="small"
        sx={{ bgcolor: "#27272a", color: "#a1a1aa", fontWeight: 600, borderRadius: 0.8, height: 20, fontSize: "0.65rem" }}
      />
    );
  };

  const getPlatformIcon = (platform: DownloaderPlatform, size?: number) => {
    const s = size || 20;
    if (platform === "youtube") return <YouTubeIcon sx={{ color: "#ef4444", fontSize: s * 1.15 }} />;
    if (platform === "tiktok") return <TikTokIcon sx={{ fontSize: s * 0.95 }} />;
    if (platform === "instagram") return <InstagramIcon sx={{ color: "#ec4899", fontSize: s }} />;
    if (platform === "x") return <XIcon sx={{ color: "#f4f4f5", fontSize: s * 0.9 }} />;
    if (platform === "pinterest") return <PinterestIcon sx={{ color: "#e60023", fontSize: s }} />;
    return <VideoLibraryIcon sx={{ color: "#71717a", fontSize: s }} />;
  };

  const getSourceAccount = (item: DownloadRecord): { text: string; url: string } => {
    const rawUrl = item.url || "";
    const author = (item.author || "").trim();

    // 1. TikTok: https://www.tiktok.com/@username/video/...
    if (item.platform === "tiktok" || rawUrl.includes("tiktok.com")) {
      const match = rawUrl.match(/tiktok\.com\/(@[^/?#]+)/i);
      if (match) {
        const handle = match[1];
        return { text: handle, url: `https://www.tiktok.com/${handle}` };
      }
      if (author) {
        const handle = author.startsWith("@") ? author : `@${author}`;
        return { text: handle, url: `https://www.tiktok.com/${handle}` };
      }
      return { text: "@tiktok", url: rawUrl || "https://www.tiktok.com" };
    }

    // 2. X / Twitter: https://x.com/username/status/... or twitter.com/...
    if (item.platform === "x" || rawUrl.includes("twitter.com") || rawUrl.includes("x.com")) {
      const match = rawUrl.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/status/i);
      if (match && match[1].toLowerCase() !== "i") {
        const handle = `@${match[1]}`;
        return { text: handle, url: `https://x.com/${match[1]}` };
      }
      if (author) {
        const handle = author.startsWith("@") ? author : `@${author}`;
        return { text: handle, url: `https://x.com/${handle.replace(/^@/, "")}` };
      }
      return { text: "@x", url: rawUrl || "https://x.com" };
    }

    // 3. Instagram: https://www.instagram.com/username/ or /p/...
    if (item.platform === "instagram" || rawUrl.includes("instagram.com")) {
      const match = rawUrl.match(/instagram\.com\/([A-Za-z0-9_.]+)(?:\/reel|\/p|\/tv)?/i);
      if (match && !["reel", "reels", "p", "tv", "stories", "explore"].includes(match[1].toLowerCase())) {
        const handle = `@${match[1]}`;
        return { text: handle, url: `https://www.instagram.com/${match[1]}` };
      }
      if (author) {
        const handle = author.startsWith("@") ? author : `@${author}`;
        return { text: handle, url: `https://www.instagram.com/${handle.replace(/^@/, "")}` };
      }
      return { text: "@instagram", url: rawUrl || "https://www.instagram.com" };
    }

    // 4. YouTube: https://www.youtube.com/@channel or channel in author
    if (item.platform === "youtube" || rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be")) {
      const channelMatch = rawUrl.match(/youtube\.com\/(@[^/?#]+)/i);
      if (channelMatch) {
        return { text: channelMatch[1], url: `https://www.youtube.com/${channelMatch[1]}` };
      }
      if (author) {
        const display = author.startsWith("@") ? author : `@${author}`;
        return { text: display, url: rawUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(author)}` };
      }
      return { text: "YouTube Source", url: rawUrl || "https://www.youtube.com" };
    }

    // 5. Pinterest: https://www.pinterest.com/username/...
    if (item.platform === "pinterest" || rawUrl.includes("pinterest.com") || rawUrl.includes("pin.it")) {
      const match = rawUrl.match(/pinterest\.[a-z.]+\/([A-Za-z0-9_]+)\//i);
      if (match && !["pin", "search", "ideas"].includes(match[1].toLowerCase())) {
        return { text: `@${match[1]}`, url: `https://www.pinterest.com/${match[1]}` };
      }
      if (author) {
        return { text: author.startsWith("@") ? author : `@${author}`, url: `https://www.pinterest.com/${author.replace(/^@/, "")}` };
      }
      return { text: "Pinterest Source", url: rawUrl || "https://www.pinterest.com" };
    }

    if (author) {
      return { text: author.startsWith("@") ? author : `@${author}`, url: rawUrl || "#" };
    }
    return { text: "Source", url: rawUrl || "#" };
  };

  const activeDownloadingCount = Array.from(activeTasks.values()).filter((t) => t.status === "downloading").length;

  return (
    <Box
      sx={{
        height: "100vh",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        maxWidth: 1600,
        mx: "auto",
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1.5, sm: 2 },
        boxSizing: "border-box",
      }}
    >
      {/* ===== HEADER NAVIGATION ===== */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
          flexShrink: 0,
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
              <DownloadIcon sx={{ color: "#3b82f6", fontSize: 24 }} />
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
              YouTube · TikTok · Instagram · 𝕏 (Twitter) · Pinterest · 4K Video, MP3 &amp; High-Res Photo Extraction
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          {activeDownloadingCount > 0 && (
            <Chip
              icon={<CircularProgress size={12} sx={{ color: "#3b82f6 !important" }} />}
              label={`${activeDownloadingCount} Downloading...`}
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

      {/* ===== 2-COLUMN MAIN STUDIO LAYOUT: 50% (Left) : 50% (Right) WITH SUBTLE DIVIDER ===== */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          flexGrow: 1,
          minHeight: 0,
          height: "100%",
          alignItems: "stretch",
          overflow: "hidden",
          gap: { xs: 2, md: 2.5 },
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ========================================================================= */}
        {/* LEFT COLUMN: COMMAND INPUT + SETTINGS + QUEUE MONITOR (50% Width)         */}
        {/* ========================================================================= */}
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            flex: { xs: "none", md: "1 1 50%" },
            width: { xs: "100%", md: "50%" },
            maxWidth: { xs: "100%", md: "50%" },
            pr: { md: 2.5 },
            borderRight: { md: "1px solid rgba(255, 255, 255, 0.08)" },
            overflowY: "auto",
            overflowX: "hidden",
            boxSizing: "border-box",
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": { bgcolor: "#27272a", borderRadius: 3 },
            "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#3f3f46" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              pb: 2,
            }}
          >
            {/* CARD 1: INPUT & SETTINGS FORM */}
            <Card
              sx={{
                bgcolor: "#121215",
                border: "1px solid #27272a",
                borderRadius: 2.5,
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                {/* Main Input Row */}
                <TextField
                  fullWidth
                  placeholder="Paste YouTube, TikTok, Instagram, X (Twitter), or Pinterest link..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url.trim()) {
                      handleStartDownload();
                    }
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start" sx={{ pl: 0.5 }}>
                          {fetchingInfo ? (
                            <CircularProgress size={18} sx={{ color: "#3b82f6" }} />
                          ) : url.trim() && detectedPlatform !== "generic" ? (
                            getPlatformIcon(detectedPlatform)
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
                              py: 0.4,
                              px: 1,
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
                      fontSize: "0.92rem",
                      color: "#f4f4f5",
                      height: 50,
                      "& fieldset": { borderColor: "#27272a" },
                      "&:hover fieldset": { borderColor: "#3f3f46" },
                      "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                    },
                  }}
                />

                {/* Validation Error Alert */}
                {validationError && (
                  <Alert severity="error" sx={{ mt: 1.5, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", py: 0.3, fontSize: "0.8rem" }}>
                    {validationError}
                  </Alert>
                )}

                {/* Info Error */}
                {infoError && (
                  <Alert severity="warning" sx={{ mt: 1.5, bgcolor: "rgba(234, 179, 8, 0.1)", color: "#fde047", py: 0.3, fontSize: "0.8rem" }}>
                    {infoError}
                  </Alert>
                )}

                {/* Collapsible Metadata Preview & Settings */}
                <Collapse in={Boolean(isSupportedPlatform(url) && (videoInfo || fetchingInfo))} timeout={300}>
                  <Box sx={{ mt: 2.2, pt: 2, borderTop: "1px solid #1f1f23" }}>
                    {/* Media Preview Card */}
                    {videoInfo && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.8,
                          p: 1.5,
                          bgcolor: "#18181b",
                          borderRadius: 1.8,
                          border: "1px solid #27272a",
                          mb: 2.2,
                        }}
                      >
                        {videoInfo.thumbnail && (
                          <Box
                            sx={{
                              width: 100,
                              height: 60,
                              borderRadius: 1.2,
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
                            {videoInfo.duration > 0 ? (
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
                            ) : videoInfo.mediaType === "image" ? (
                              <Box
                                sx={{
                                  position: "absolute",
                                  bottom: 3,
                                  right: 3,
                                  bgcolor: "rgba(59, 130, 246, 0.85)",
                                  px: 0.6,
                                  py: 0.1,
                                  borderRadius: 0.5,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  color: "#fff",
                                }}
                              >
                                PHOTO
                              </Box>
                            ) : null}
                          </Box>
                        )}

                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
                            {renderPlatformBadge(detectedPlatform)}
                            <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.75rem" }} noWrap>
                              {videoInfo.uploader || videoInfo.channel || "Creator"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: "#f4f4f5",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: 1.3,
                              fontSize: "0.85rem",
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

                    {/* Download Settings Form (Grid layout for wide 8-col area) */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {/* Format Type Dropdown */}
                      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Media Format</InputLabel>
                          <Select
                            value={formatType}
                            label="Media Format"
                            onChange={(e) => setFormatType(e.target.value as DownloaderFormatType)}
                            sx={{
                              bgcolor: "#18181b",
                              color: "#f4f4f5",
                              borderRadius: 1.2,
                              fontSize: "0.85rem",
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
                            }}
                          >
                            <MenuItem value="video">Video (MP4)</MenuItem>
                            <MenuItem value="audio">Audio Only (MP3 / WAV)</MenuItem>
                            <MenuItem value="image">Photo / Image (JPG / PNG)</MenuItem>
                            <MenuItem value="subtitle">Subtitle Track (SRT / VTT)</MenuItem>
                            <MenuItem value="thumbnail">Cover Thumbnail (JPG)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* Adaptive Quality Dropdown */}
                      {formatType === "video" && (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel sx={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Video Quality</InputLabel>
                            <Select
                              value={videoQuality}
                              label="Video Quality"
                              onChange={(e) => setVideoQuality(e.target.value as DownloaderQuality)}
                              sx={{
                                bgcolor: "#18181b",
                                color: "#f4f4f5",
                                borderRadius: 1.2,
                                fontSize: "0.85rem",
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                              }}
                            >
                              <MenuItem value="1080p">Full HD 1080p (Recommended)</MenuItem>
                              <MenuItem value="4k">Ultra HD 4K (2160p)</MenuItem>
                              <MenuItem value="1440p">Quad HD 2K (1440p)</MenuItem>
                              <MenuItem value="720p">HD 720p (Fast &amp; Lightweight)</MenuItem>
                              <MenuItem value="480p">SD 480p (Compact)</MenuItem>
                              <MenuItem value="best">Best Original Source</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {formatType === "audio" && (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel sx={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Audio Quality</InputLabel>
                            <Select
                              value={audioQuality}
                              label="Audio Quality"
                              onChange={(e) => setAudioQuality(e.target.value as DownloaderQuality)}
                              sx={{
                                bgcolor: "#18181b",
                                color: "#f4f4f5",
                                borderRadius: 1.2,
                                fontSize: "0.85rem",
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
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
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel sx={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Subtitle Format</InputLabel>
                            <Select
                              value={subQuality}
                              label="Subtitle Format"
                              onChange={(e) => setSubQuality(e.target.value as DownloaderQuality)}
                              sx={{
                                bgcolor: "#18181b",
                                color: "#f4f4f5",
                                borderRadius: 1.2,
                                fontSize: "0.85rem",
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                              }}
                            >
                              <MenuItem value="srt">SRT — SubRip Subtitle Track</MenuItem>
                              <MenuItem value="vtt">VTT — WebVTT Timed Text</MenuItem>
                              <MenuItem value="txt">TXT — Clean Transcript</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {/* Custom Filename */}
                      <Grid size={{ xs: 12, sm: 6, md: formatType === "image" || formatType === "thumbnail" ? 8 : 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Custom File Name (Optional)"
                          placeholder="File name when saved..."
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          slotProps={{
                            input: {
                              sx: { bgcolor: "#18181b", color: "#f4f4f5", fontSize: "0.85rem", borderRadius: 1.2 },
                            },
                            inputLabel: { sx: { color: "#a1a1aa", fontSize: "0.85rem" } },
                          }}
                        />
                      </Grid>

                      {/* YouTube Specific Options: Subtitles & Splitter */}
                      {detectedPlatform === "youtube" && formatType === "video" && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Box sx={{ bgcolor: "#18181b", p: 1, px: 1.5, borderRadius: 1.2, border: "1px solid #27272a", height: "100%", display: "flex", alignItems: "center" }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={downloadSubtitles}
                                  onChange={(e) => setDownloadSubtitles(e.target.checked)}
                                  sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#3b82f6" } }}
                                />
                              }
                              label={<Typography sx={{ fontSize: "0.8rem", color: "#e4e4e7" }}>Auto Download Subtitles (SRT)</Typography>}
                            />
                          </Box>
                        </Grid>
                      )}

                      {detectedPlatform === "youtube" && (formatType === "video" || formatType === "audio") && (
                        <Grid size={{ xs: 12 }}>
                          <Box sx={{ bgcolor: "#18181b", p: 1.5, borderRadius: 1.2, border: "1px solid #27272a" }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={enableSplitter}
                                  onChange={(e) => setEnableSplitter(e.target.checked)}
                                  sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#3b82f6" } }}
                                />
                              }
                              label={<Typography sx={{ fontSize: "0.8rem", color: "#e4e4e7" }}>Direct Splitter (Cut Time Range)</Typography>}
                            />
                            <Collapse in={enableSplitter}>
                              <Box sx={{ pt: 1.5, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                                <TextField
                                  size="small"
                                  label="Start"
                                  value={splitStart}
                                  onChange={(e) => setSplitStart(e.target.value)}
                                  placeholder="00:00:00"
                                  slotProps={{ input: { sx: { fontSize: "0.82rem", color: "#fff" } } }}
                                  sx={{ width: 130 }}
                                />
                                <TextField
                                  size="small"
                                  label="End"
                                  value={splitEnd}
                                  onChange={(e) => setSplitEnd(e.target.value)}
                                  placeholder="00:01:00"
                                  slotProps={{ input: { sx: { fontSize: "0.82rem", color: "#fff" } } }}
                                  sx={{ width: 130 }}
                                />
                                <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                                  {[
                                    { label: "+30s", sec: 30 },
                                    { label: "+1m", sec: 60 },
                                    { label: "+3m", sec: 180 },
                                    { label: "+5m", sec: 300 },
                                  ].map((btn) => (
                                    <Button
                                      key={btn.label}
                                      size="small"
                                      variant="outlined"
                                      onClick={() => handleAddSplitDuration(btn.sec)}
                                      sx={{
                                        py: 0.3,
                                        px: 1,
                                        minWidth: "auto",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        borderColor: "#27272a",
                                        color: "#cbd5e1",
                                        bgcolor: "#18181b",
                                        borderRadius: 0.8,
                                        textTransform: "none",
                                      }}
                                    >
                                      {btn.label}
                                    </Button>
                                  ))}
                                </Box>
                              </Box>
                            </Collapse>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {/* Action Buttons Row */}
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                      <Button
                        variant="contained"
                        startIcon={
                          url.trim() && detectedPlatform !== "generic" ? (
                            getPlatformIcon(detectedPlatform)
                          ) : (
                            <FileDownloadIcon />
                          )
                        }
                        onClick={() => handleStartDownload()}
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
                          boxShadow: "0 2px 10px rgba(59, 130, 246, 0.35)",
                          "&:hover": { bgcolor: "#2563eb" },
                          "&.Mui-disabled": { bgcolor: "#27272a", color: "#71717a" },
                        }}
                      >
                        {url.trim() && detectedPlatform !== "generic"
                          ? `Download from ${
                              detectedPlatform === "x"
                                ? "𝕏"
                                : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)
                            }`
                          : "Download Media"}
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>

            {/* CARD 2: ACTIVE & RECENT DOWNLOAD QUEUE MONITOR */}
            <Card
              sx={{
                bgcolor: "#121215",
                border: "1px solid #27272a",
                borderRadius: 2.5,
                p: 2,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {activeDownloadingCount > 0 ? (
                    <CircularProgress size={16} sx={{ color: "#3b82f6" }} />
                  ) : (
                    <DownloadIcon sx={{ color: "#a1a1aa", fontSize: 18 }} />
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: activeDownloadingCount > 0 ? "#60a5fa" : "#e4e4e7" }}>
                    Download Queue ({activeTasks.size})
                  </Typography>
                </Box>
                {activeTasks.size > 0 && activeDownloadingCount === 0 && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleClearFinishedTasks}
                    sx={{ color: "#71717a", textTransform: "none", fontSize: "0.72rem", p: 0.3 }}
                  >
                    Clear Finished
                  </Button>
                )}
              </Box>

              {activeTasks.size === 0 ? (
                <Box sx={{ py: 2.5, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.75rem" }}>
                    Download queue is empty. Paste a link above to start downloading.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                  {Array.from(activeTasks.values()).map((task) => (
                    <Box
                      key={task.taskId}
                      sx={{
                        p: 1.4,
                        bgcolor: "#18181b",
                        borderRadius: 1.5,
                        border:
                          task.status === "completed"
                            ? "1px solid rgba(34, 197, 94, 0.3)"
                            : task.status === "error"
                            ? "1px solid rgba(239, 68, 68, 0.3)"
                            : "1px solid #27272a",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6, gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0, flexGrow: 1, overflow: "hidden" }}>
                          {task.status === "completed" ? (
                            <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 16, flexShrink: 0 }} />
                          ) : task.status === "error" ? (
                            <ErrorIcon sx={{ color: "#ef4444", fontSize: 16, flexShrink: 0 }} />
                          ) : (
                            <CircularProgress size={12} sx={{ color: "#3b82f6", flexShrink: 0 }} />
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: "#f4f4f5",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.8rem",
                              display: "block",
                              minWidth: 0,
                              maxWidth: "100%",
                            }}
                          >
                            {task.title}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                          {task.status === "downloading" && (
                            <IconButton
                              size="small"
                              onClick={() => handleCancelTask(task.taskId)}
                              sx={{ color: "#f87171", p: 0.3 }}
                              title="Cancel"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          )}
                          {task.status === "completed" && (
                            <>
                              {task.downloadRecord && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setPreviewRecord(task.downloadRecord!)}
                                  sx={{
                                    py: 0.1,
                                    px: 0.8,
                                    fontSize: "0.68rem",
                                    color: "#22c55e",
                                    borderColor: "rgba(34, 197, 94, 0.4)",
                                    textTransform: "none",
                                    minWidth: "auto",
                                    "&:hover": { bgcolor: "rgba(34, 197, 94, 0.1)" },
                                  }}
                                >
                                  View in Vault
                                </Button>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => handleDismissTask(task.taskId)}
                                sx={{ color: "#71717a", p: 0.2 }}
                                title="Dismiss"
                              >
                                <ClearIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </>
                          )}
                          {task.status === "error" && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => handleStartDownload(task.targetUrl)}
                                sx={{ color: "#60a5fa", p: 0.2 }}
                                title="Retry"
                              >
                                <ReplayIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDismissTask(task.taskId)}
                                sx={{ color: "#71717a", p: 0.2 }}
                                title="Dismiss"
                              >
                                <ClearIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>

                      {task.status === "downloading" ? (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={task.progress.percent}
                            sx={{
                              height: 5,
                              borderRadius: 2.5,
                              bgcolor: "#27272a",
                              mb: 0.5,
                              "& .MuiLinearProgress-bar": {
                                bgcolor: "#3b82f6",
                                borderRadius: 2.5,
                              },
                            }}
                          />
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.7rem" }}>
                              {task.progress.totalSizeStr ? `${task.progress.totalSizeStr} · ` : ""}
                              {task.progress.speedStr}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.7rem" }}>
                              {task.progress.percent}% {task.progress.etaStr && `· ETA ${task.progress.etaStr}`}
                            </Typography>
                          </Box>
                        </>
                      ) : task.status === "completed" ? (
                        <Typography variant="caption" sx={{ color: "#86efac", fontSize: "0.7rem", fontWeight: 600 }}>
                          ✓ Download completed (100%)
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: "#fca5a5", fontSize: "0.7rem" }} noWrap>
                          Failed: {task.error || "Network error"}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Card>
          </Box>
        </Box>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: MEDIA VAULT & DOWNLOAD HISTORY (50% Width)                  */}
        {/* ========================================================================= */}
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            flex: { xs: "none", md: "1 1 50%" },
            width: { xs: "100%", md: "50%" },
            maxWidth: { xs: "100%", md: "50%" },
            pl: { md: 0 },
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {/* Control Toolbar (Fixed top within column) */}
          <Card
            sx={{
              flexShrink: 0,
              bgcolor: "#121215",
              border: "1px solid #27272a",
              borderRadius: 2,
              p: 1.5,
              mb: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                mb: 1.2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <VideoLibraryIcon sx={{ color: "#3b82f6", fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: "0.85rem" }}>
                  Media Vault
                </Typography>
                <Chip
                  label={`${historyRecords.length} Items · ${formatFileSize(calculateTotalVaultSize())}`}
                  size="small"
                  sx={{ bgcolor: "#18181b", color: "#a1a1aa", border: "1px solid #27272a", fontWeight: 700, fontSize: "0.68rem", height: 20 }}
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                {/* View Mode Toggle Switcher */}
                <ToggleButtonGroup
                  size="small"
                  value={viewMode}
                  exclusive
                  onChange={(_, next) => {
                    if (next) setViewMode(next);
                  }}
                  sx={{
                    bgcolor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 1,
                    height: 28,
                    "& .MuiToggleButton-root": {
                      color: "#71717a",
                      borderColor: "#27272a",
                      px: 0.6,
                      py: 0.2,
                      "&.Mui-selected": { color: "#3b82f6", bgcolor: "rgba(59, 130, 246, 0.12)" },
                    },
                  }}
                >
                  <ToggleButton value="table" title="Table View">
                    <ViewListIcon sx={{ fontSize: 16 }} />
                  </ToggleButton>
                  <ToggleButton value="grid" title="Grid View">
                    <ViewModuleIcon sx={{ fontSize: 16 }} />
                  </ToggleButton>
                </ToggleButtonGroup>

                <IconButton onClick={loadHistory} sx={{ bgcolor: "#18181b", color: "#a1a1aa", borderRadius: 1, p: 0.5 }} title="Refresh">
                  {loadingHistory ? <CircularProgress size={12} sx={{ color: "#3b82f6" }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Box>
            </Box>

            {/* Filters & Search Row */}
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
                  flexGrow: 1,
                  minWidth: 140,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "#18181b",
                    borderRadius: 1,
                    fontSize: "0.78rem",
                    color: "#f4f4f5",
                    height: 32,
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
                    bgcolor: "#18181b",
                    color: "#f4f4f5",
                    borderRadius: 1,
                    fontSize: "0.78rem",
                    height: 32,
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                  }}
                >
                  <MenuItem value="all">All Platforms</MenuItem>
                  <MenuItem value="youtube">YouTube</MenuItem>
                  <MenuItem value="tiktok">TikTok</MenuItem>
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="x">𝕏 / Twitter</MenuItem>
                  <MenuItem value="pinterest">Pinterest</MenuItem>
                </Select>
              </FormControl>

              {/* Format Filter */}
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <Select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  sx={{
                    bgcolor: "#18181b",
                    color: "#f4f4f5",
                    borderRadius: 1,
                    fontSize: "0.78rem",
                    height: 32,
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                  }}
                >
                  <MenuItem value="all">All Formats</MenuItem>
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="audio">Audio</MenuItem>
                  <MenuItem value="image">Photo / Image</MenuItem>
                  <MenuItem value="subtitle">Subtitle</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Card>

          {/* Download Results Scrolling Container (Independent Scroll) */}
          <Box
            sx={{
              flexGrow: 1,
              minHeight: 0,
              minWidth: 0,
              width: "100%",
              maxWidth: "100%",
              overflowY: "auto",
              overflowX: "hidden",
              pr: 0.5,
              pb: 2,
              boxSizing: "border-box",
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#27272a", borderRadius: 3 },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#3f3f46" },
            }}
          >
            {/* Empty State */}
            {loadingHistory ? (
              <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={24} sx={{ color: "#3b82f6" }} />
              </Box>
            ) : historyRecords.length === 0 ? (
              <Card sx={{ bgcolor: "#121215", border: "1px dashed #27272a", borderRadius: 2, p: 4, textAlign: "center" }}>
                <DownloadIcon sx={{ fontSize: 32, color: "#3f3f46", mb: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#a1a1aa", mb: 0.3, fontSize: "0.82rem" }}>
                  No media in vault yet
                </Typography>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
                  Paste a link on the left to start downloading.
                </Typography>
              </Card>
            ) : viewMode === "table" ? (
              /* ===== VIEW 1 (DEFAULT): COMPACT TABLE VIEW WITH THUMBNAILS ===== */
              <TableContainer
                component={Card}
                sx={{
                  bgcolor: "#141418",
                  border: "1px solid #27272a",
                  borderRadius: 2,
                  width: "100%",
                  maxWidth: "100%",
                  overflowX: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: "calc(100% - 116px)" }} />
                    <col style={{ width: "116px" }} />
                  </colgroup>
                  <TableBody>
                    {historyRecords.map((item) => (
                      <TableRow
                        key={item.id}
                        sx={{
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.03)" },
                          borderBottom: "1px solid #1f1f23",
                        }}
                      >
                        {/* Thumbnail & Title Cell */}
                        <TableCell sx={{ borderBottom: "none", py: 1, px: 1, overflow: "hidden", minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0, overflow: "hidden" }}>
                            {/* Small Thumbnail */}
                            <Box
                              onClick={() => item.exists && setPreviewRecord(item)}
                              sx={{
                                width: 44,
                                height: 28,
                                borderRadius: 0.8,
                                overflow: "hidden",
                                flexShrink: 0,
                                bgcolor: "#09090b",
                                border: "1px solid #27272a",
                                position: "relative",
                                cursor: item.exists ? "pointer" : "default",
                              }}
                            >
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.title}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {item.formatType === "audio" ? (
                                    <AudiotrackIcon sx={{ fontSize: 14, color: "#71717a" }} />
                                  ) : item.formatType === "image" ? (
                                    <ImageIcon sx={{ fontSize: 14, color: "#71717a" }} />
                                  ) : (
                                    <VideoLibraryIcon sx={{ fontSize: 14, color: "#71717a" }} />
                                  )}
                                </Box>
                              )}
                            </Box>

                            {/* Title & Subtitle */}
                            <Box sx={{ minWidth: 0, flexGrow: 1, overflow: "hidden" }}>
                              {/* Title line with social media icon on the left */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0, width: "100%", overflow: "hidden" }}>
                                <Box sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
                                  {getPlatformIcon(item.platform, 14)}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: "0.76rem",
                                    color: "#f4f4f5",
                                    lineHeight: 1.25,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    display: "block",
                                    flexGrow: 1,
                                    minWidth: 0,
                                    cursor: item.exists ? "pointer" : "default",
                                  }}
                                  onClick={() => item.exists && setPreviewRecord(item)}
                                  title={item.title}
                                >
                                  {item.title}
                                </Typography>
                              </Box>

                              {/* Subtitle line: Source Link on the left of VIDEO · SIZE */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.3, overflow: "hidden", minWidth: 0 }}>
                                {(() => {
                                  const src = getSourceAccount(item);
                                  return (
                                    <Link
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{
                                        color: "#38bdf8",
                                        fontSize: "0.66rem",
                                        fontWeight: 600,
                                        textDecoration: "none",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        maxWidth: { xs: 110, sm: 170 },
                                        display: "inline-block",
                                        flexShrink: 0,
                                        "&:hover": {
                                          color: "#7dd3fc",
                                          textDecoration: "underline",
                                        },
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      title={`Source Account: ${src.text}`}
                                    >
                                      {src.text}
                                    </Link>
                                  );
                                })()}
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#71717a",
                                    fontSize: "0.66rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                  }}
                                >
                                  · {item.formatType.toUpperCase()} · {formatFileSize(item.fileSizeBytes)}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Actions Cell */}
                        <TableCell sx={{ borderBottom: "none", textAlign: "right", py: 1, px: 0.8, width: 116, minWidth: 116, maxWidth: 116, whiteSpace: "nowrap" }}>
                          <Box sx={{ display: "flex", gap: 0.2, justifyContent: "flex-end", alignItems: "center" }}>
                            {item.exists && (
                              <IconButton
                                size="small"
                                onClick={() => setPreviewRecord(item)}
                                sx={{ color: "#38bdf8", p: 0.3 }}
                                title="Play / Preview"
                              >
                                <PlayCircleIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                            {item.exists && (
                              <IconButton
                                size="small"
                                onClick={() => handleOpenFolder(item)}
                                sx={{ color: "#a1a1aa", p: 0.3 }}
                                title="Open Folder"
                              >
                                <FolderOpenIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            )}
                            {item.formatType === "video" && item.exists && (
                              <IconButton
                                size="small"
                                onClick={() => handleCreateProject(item)}
                                sx={{ color: "#a78bfa", p: 0.3 }}
                                title="Send to Studio"
                              >
                                <MovieFilterIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              onClick={() => setRecordToDelete(item)}
                              sx={{ color: "#71717a", p: 0.3, "&:hover": { color: "#f87171" } }}
                              title="Delete"
                            >
                              <DeleteIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              /* ===== VIEW 2: COMPACT CARD GRID (2 Columns in 6:6 layout) ===== */
              <Grid container spacing={1.5} sx={{ width: "100%", m: 0 }}>
                {historyRecords.map((item) => (
                  <Grid key={item.id} size={{ xs: 12, sm: 6 }} sx={{ minWidth: 0, maxWidth: "100%" }}>
                    <Card
                      sx={{
                        height: "100%",
                        width: "100%",
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "#141418",
                        border: "1px solid #27272a",
                        borderRadius: 1.8,
                        overflow: "hidden",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: "#3f3f46" },
                      }}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          paddingTop: "52%",
                          bgcolor: "#09090b",
                          cursor: item.exists ? "pointer" : "default",
                        }}
                        onClick={() => item.exists && setPreviewRecord(item)}
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "#18181b",
                            }}
                          >
                            <VideoLibraryIcon sx={{ fontSize: 28, color: "#71717a" }} />
                          </Box>
                        )}

                        <Box
                          sx={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            bgcolor: "rgba(0, 0, 0, 0.75)",
                            backdropFilter: "blur(4px)",
                            borderRadius: 0.8,
                            p: 0.4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {getPlatformIcon(item.platform, 13)}
                        </Box>

                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 5,
                            right: 5,
                            bgcolor: "rgba(0,0,0,0.85)",
                            color: "#fff",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            px: 0.6,
                            py: 0.1,
                            borderRadius: 0.5,
                          }}
                        >
                          {item.durationSec > 0
                            ? formatDuration(item.durationSec)
                            : item.formatType === "image"
                            ? "PHOTO"
                            : "FILE"}
                        </Box>
                      </Box>

                      <CardContent sx={{ p: 1.2, flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mb: 0.4, minWidth: 0, width: "100%", overflow: "hidden" }}>
                          <Box sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
                            {getPlatformIcon(item.platform, 14)}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: "#f4f4f5",
                              fontSize: "0.78rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                              flexGrow: 1,
                              minWidth: 0,
                              maxWidth: "100%",
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8, minWidth: 0 }}>
                          {(() => {
                            const src = getSourceAccount(item);
                            return (
                              <Link
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: "#38bdf8",
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "65%",
                                  "&:hover": {
                                    color: "#7dd3fc",
                                    textDecoration: "underline",
                                  },
                                }}
                                title={`Source: ${src.text}`}
                              >
                                {src.text}
                              </Link>
                            );
                          })()}
                          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem", flexShrink: 0 }}>
                            {formatFileSize(item.fileSizeBytes)}
                          </Typography>
                        </Box>

                        <Box sx={{ mt: "auto" }}>
                          <Divider sx={{ borderColor: "#27272a", mb: 0.8 }} />

                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box sx={{ display: "flex", gap: 0.3 }}>
                              {item.exists && (
                                <IconButton size="small" onClick={() => setPreviewRecord(item)} sx={{ color: "#38bdf8", p: 0.4 }} title="Preview">
                                  <PlayCircleIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              )}
                              {item.exists && (
                                <IconButton size="small" onClick={() => handleOpenFolder(item)} sx={{ color: "#a1a1aa", p: 0.4 }} title="Open Folder">
                                  <FolderOpenIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              )}
                            </Box>

                            <Box sx={{ display: "flex", gap: 0.3, alignItems: "center" }}>
                              {item.formatType === "video" && item.exists && (
                                <IconButton size="small" onClick={() => handleCreateProject(item)} sx={{ color: "#a78bfa", p: 0.4 }} title="Send to Studio">
                                  <MovieFilterIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              )}
                              <IconButton size="small" onClick={() => setRecordToDelete(item)} sx={{ color: "#71717a", p: 0.4, "&:hover": { color: "#f87171" } }} title="Delete">
                                <DeleteIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>

      {/* ===== MODAL: MEDIA PREVIEW & PLAYER ===== */}
      <MediaPreviewModal
        open={Boolean(previewRecord)}
        onClose={() => setPreviewRecord(null)}
        record={previewRecord}
        onOpenFolder={handleOpenFolder}
        onCreateProject={handleCreateProject}
        creatingProject={creatingProjectId === previewRecord?.id}
      />

      {/* ===== DIALOG: DELETE CONFIRMATION ===== */}
      <Dialog
        open={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        slotProps={{
          paper: { sx: { bgcolor: "#18181b", color: "#f4f4f5", border: "1px solid #27272a", borderRadius: 2 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "1rem" }}>Delete Media from Vault?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
            Media file "{recordToDelete?.title}" will be permanently deleted from local disk storage. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecordToDelete(null)} sx={{ color: "#a1a1aa", textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {deleting ? <CircularProgress size={16} /> : "Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== NOTIFICATION SNACKBAR ===== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{
            bgcolor: snackbar.severity === "success" ? "#14532d" : snackbar.severity === "error" ? "#7f1d1d" : "#1e293b",
            color: "#f8fafc",
            fontWeight: 600,
            borderRadius: 1.5,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
