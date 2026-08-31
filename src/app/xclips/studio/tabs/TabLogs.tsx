import React, { useEffect, useState, useMemo, useRef, memo } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
  TextField,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import TerminalIcon from "@mui/icons-material/Terminal";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";
import { useStudioStore } from "../store/useStudioStore";
import { LogItem } from "../types/studio.types";

interface HumanizedLog {
  category: string;
  categoryColor: string;
  friendlyMsg: string;
  detail?: string;
  tag?: string;
}

// In-memory weak cache to prevent re-humanizing identical log items
const humanizeCache = new WeakMap<object, HumanizedLog>();

function humanizeLogItem(item: LogItem): HumanizedLog {
  if (humanizeCache.has(item)) {
    return humanizeCache.get(item)!;
  }

  const msg = ((item.msg || item.message || "") as string).trim();
  const mod = (item.module || "").toLowerCase();
  const lvl = Number(item.level) || 30;
  let result: HumanizedLog;

  // 1. Error / Failure handling
  if (
    lvl >= 50 ||
    msg.toLowerCase().includes("failed") ||
    msg.toLowerCase().includes("error") ||
    item.err
  ) {
    const rawErr = item.err
      ? typeof item.err === "string"
        ? item.err
        : (item.err as { message?: string }).message || JSON.stringify(item.err)
      : msg;

    let friendlyErr = rawErr;
    if (rawErr.toLowerCase().includes("api key") || rawErr.includes("401") || rawErr.includes("403")) {
      friendlyErr = "Invalid API Key credentials or access denied. Please verify your API Key in AI Settings.";
    } else if (rawErr.toLowerCase().includes("quota") || rawErr.includes("429")) {
      friendlyErr = "API rate limit or quota exceeded. Please wait a moment or switch to another model.";
    } else if (rawErr.toLowerCase().includes("network") || rawErr.toLowerCase().includes("timeout") || rawErr.toLowerCase().includes("fetch failed")) {
      friendlyErr = "Connection to API server failed or timed out while processing request.";
    }

    result = {
      category: "System Issue",
      categoryColor: "#ef4444",
      friendlyMsg: friendlyErr,
      detail: msg !== friendlyErr ? msg : (item.module ? `Module: ${item.module}` : undefined),
      tag: "FAILED",
    };
  } else if (msg.includes("Saved xclips AI settings") || mod.includes("settings")) {
    // 2. AI Settings & Configuration
    const provider = item.provider ? String(item.provider).toUpperCase() : "AI";
    const model = item.highlightModel || item.model ? ` · Model: ${item.highlightModel || item.model}` : "";
    result = {
      category: "AI Configuration",
      categoryColor: "#8b5cf6",
      friendlyMsg: `AI settings successfully updated and saved (Provider: ${provider}${model}).`,
      tag: "CONFIG",
    };
  } else if (
    msg.toLowerCase().includes("transcribe") ||
    mod.includes("transcribe") ||
    msg.toLowerCase().includes("audio wav") ||
    msg.toLowerCase().includes("speech")
  ) {
    // 3. Audio Transcription
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("parsed")) {
      result = {
        category: "Audio Transcription",
        categoryColor: "#10b981",
        friendlyMsg: "Word-level transcription and timestamps completed. Subtitles synchronized and ready to edit.",
        tag: "DONE",
      };
    } else {
      const provider = item.provider ? ` via ${item.provider}` : "";
      result = {
        category: "Audio Transcription",
        categoryColor: "#3b82f6",
        friendlyMsg: `Extracting audio stream and mapping word-level speech for master video${provider}...`,
        tag: "PROCESSING",
      };
    }
  } else if (
    msg.toLowerCase().includes("highlight") ||
    msg.toLowerCase().includes("discover") ||
    mod.includes("chunker") ||
    msg.toLowerCase().includes("viral")
  ) {
    // 4. Highlight & Viral Clip Discovery
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("ranked") || msg.toLowerCase().includes("success")) {
      const count = item.count || item.totalClips || (Array.isArray(item.clips) ? item.clips.length : "");
      result = {
        category: "Clip Discovery",
        categoryColor: "#10b981",
        friendlyMsg: `AI successfully discovered ${count ? `${count} ` : ""}highlight segments with high virality scores.`,
        tag: "DONE",
      };
    } else {
      result = {
        category: "Clip Discovery",
        categoryColor: "#3b82f6",
        friendlyMsg: "AI is analyzing transcript narrative to identify opening hooks and peak moments...",
        tag: "PROCESSING",
      };
    }
  } else if (
    msg.toLowerCase().includes("download") ||
    mod.includes("ytdlp") ||
    mod.includes("downloader") ||
    msg.toLowerCase().includes("ingest")
  ) {
    // 5. Media Downloader & Ingestion
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("finished")) {
      result = {
        category: "Media Ingestion",
        categoryColor: "#10b981",
        friendlyMsg: "Media file downloaded successfully and saved to Assets Library.",
        detail: item.title ? `Title: ${String(item.title)}` : (item.url ? `Source: ${String(item.url)}` : undefined),
        tag: "SUCCESS",
      };
    } else if (item.percent !== undefined) {
      result = {
        category: "Media Ingestion",
        categoryColor: "#3b82f6",
        friendlyMsg: `Downloading media stream (${item.percent}%)...`,
        detail: item.speedStr ? `Speed: ${item.speedStr} | ETA: ${item.etaStr || "--:--"}` : undefined,
        tag: "DOWNLOADING",
      };
    } else {
      result = {
        category: "Media Ingestion",
        categoryColor: "#3b82f6",
        friendlyMsg: "Starting media video download from source URL...",
        detail: item.url ? `URL: ${String(item.url)}` : undefined,
        tag: "DOWNLOADING",
      };
    }
  } else if (
    msg.toLowerCase().includes("render") ||
    mod.includes("ffmpeg") ||
    mod.includes("queue") ||
    msg.toLowerCase().includes("export")
  ) {
    // 6. Video Rendering & Export
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("finished") || msg.toLowerCase().includes("done")) {
      result = {
        category: "Video Rendering",
        categoryColor: "#10b981",
        friendlyMsg: "Video render completed! High-quality video is ready for export.",
        detail: item.outputPath ? `Output: ${String(item.outputPath)}` : undefined,
        tag: "DONE",
      };
    } else {
      result = {
        category: "Video Rendering",
        categoryColor: "#3b82f6",
        friendlyMsg: "Processing video layout framing, background scaling, and karaoke subtitle burn-in...",
        detail: item.filterPreset ? `Preset: ${String(item.filterPreset)}` : undefined,
        tag: "RENDERING",
      };
    }
  } else if (msg.toLowerCase().includes("filler") || mod.includes("filler")) {
    // 7. Audio Cleanup
    result = {
      category: "Audio Cleanup",
      categoryColor: "#06b6d4",
      friendlyMsg: "Scanning silent pauses and filler words ('um', 'uh', 'hmm') to optimize audience retention.",
      tag: "OPTIMIZATION",
    };
  } else if (msg.toLowerCase().includes("subtitle") || mod.includes("subtitle") || msg.includes("ass")) {
    // 8. Subtitle Styling
    result = {
      category: "Subtitle Styling",
      categoryColor: "#f59e0b",
      friendlyMsg: "Synchronizing subtitle typography layout, custom fonts, and word highlight animations.",
      tag: "SUBTITLES",
    };
  } else if (lvl >= 40 || msg.toLowerCase().includes("warn")) {
    // 9. Warnings
    result = {
      category: "Warning",
      categoryColor: "#f59e0b",
      friendlyMsg: msg || "System warning during execution pipeline.",
      detail: item.err ? String(item.err) : undefined,
      tag: "WARNING",
    };
  } else {
    // 10. General Informative Activity
    result = {
      category: "System Activity",
      categoryColor: "#3b82f6",
      friendlyMsg: msg || "System operation executed successfully.",
      detail: item.module ? `Module: ${String(item.module)}` : undefined,
      tag: "INFO",
    };
  }

  humanizeCache.set(item, result);
  return result;
}

const getLevelLabel = (lvl?: unknown): string => {
  const num = Number(lvl);
  if (isNaN(num)) return "INFO";
  if (num >= 50) return "ERROR";
  if (num >= 40) return "WARN";
  if (num >= 30) return "INFO";
  return "DEBUG";
};

// Memoized Single Log Row for Visual Stream Mode
const LogCardRow = memo(({ item, timeStr }: { item: LogItem; timeStr: string }) => {
  const h = humanizeLogItem(item);
  const [copied, setCopied] = useState(false);

  const handleCopyItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts: string[] = [`[${timeStr}] [${h.category}${h.tag ? ` · ${h.tag}` : ""}]`];
    if (h.friendlyMsg) parts.push(h.friendlyMsg);
    if (h.detail) parts.push(`Detail: ${h.detail}`);
    if (item.err) {
      const errStr = typeof item.err === "string" ? item.err : JSON.stringify(item.err, null, 2);
      parts.push(`Error: ${errStr}`);
    }
    const textToCopy = parts.join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Box
      sx={{
        px: 1.4,
        py: 0.9,
        bgcolor: "#121217",
        borderRadius: 1,
        borderLeft: `3px solid ${h.categoryColor}`,
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        borderRight: "1px solid rgba(255, 255, 255, 0.04)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 0.35,
        transition: "background-color 0.12s ease, border-color 0.12s ease",
        "&:hover": {
          bgcolor: "#181820",
          "& .card-copy-btn": { opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
        <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
          <Chip
            label={h.category}
            size="small"
            sx={{
              bgcolor: `${h.categoryColor}18`,
              color: h.categoryColor,
              border: `1px solid ${h.categoryColor}40`,
              fontWeight: 800,
              fontSize: "0.65rem",
              height: 20,
              borderRadius: 0.6,
              px: 0.4,
            }}
          />
          {h.tag && (
            <span style={{ color: "#71717a", fontSize: "0.65rem", fontWeight: 700 }}>
              · {h.tag}
            </span>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <span style={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace" }}>
            {timeStr}
          </span>
          <Tooltip title={copied ? "Copied to clipboard!" : "Copy log entry"} placement="top">
            <IconButton
              className="card-copy-btn"
              size="small"
              onClick={handleCopyItem}
              sx={{
                p: 0.35,
                color: copied ? "#10b981" : "#71717a",
                bgcolor: copied ? "rgba(16, 185, 129, 0.12)" : "transparent",
                borderRadius: 0.6,
                opacity: copied ? 1 : 0.6,
                transition: "all 0.15s ease",
                "&:hover": {
                  color: copied ? "#10b981" : "#ffffff",
                  bgcolor: copied ? "rgba(16, 185, 129, 0.2)" : "#27272a",
                },
              }}
            >
              {copied ? <CheckIcon sx={{ fontSize: "0.85rem" }} /> : <ContentCopyIcon sx={{ fontSize: "0.85rem" }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Typography sx={{ color: "#f4f4f5", fontWeight: 600, fontSize: "0.8rem", lineHeight: 1.4 }}>
        {h.friendlyMsg}
      </Typography>

      {h.detail && (
        <Typography sx={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace", wordBreak: "break-all" }}>
          {h.detail}
        </Typography>
      )}
    </Box>
  );
});
LogCardRow.displayName = "LogCardRow";

// Memoized Single Log Row for Terminal Mode
const LogTerminalRow = memo(({ item, timeStr }: { item: LogItem; timeStr: string }) => {
  const [copied, setCopied] = useState(false);
  const lvlName = getLevelLabel(item.level);
  const lvlColor =
    lvlName === "ERROR" ? "#ef4444" :
    lvlName === "WARN" ? "#f59e0b" :
    lvlName === "DEBUG" ? "#a855f7" :
    "#38bdf8";

  const msg = ((item.msg || item.message || "") as string).trim();
  const mod = item.module ? `[${item.module}]` : "";

  const handleCopyLine = (e: React.MouseEvent) => {
    e.stopPropagation();
    const errText = item.err ? ` - ${typeof item.err === "string" ? item.err : JSON.stringify(item.err)}` : "";
    const rawLine = `[${timeStr}] [${lvlName}] ${mod ? mod + " " : ""}${msg}${errText}`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(rawLine);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: "0.72rem",
        lineHeight: 1.45,
        py: 0.25,
        px: 0.6,
        borderRadius: 0.5,
        transition: "background-color 0.1s ease",
        "&:hover": {
          bgcolor: "rgba(255, 255, 255, 0.05)",
          "& .terminal-copy-btn": { opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flex: 1, minWidth: 0 }}>
        <span style={{ color: "#52525b", flexShrink: 0 }}>{timeStr}</span>
        <span style={{ color: lvlColor, fontWeight: 700, flexShrink: 0, minWidth: 46 }}>[{lvlName}]</span>
        {mod && <span style={{ color: "#818cf8", flexShrink: 0 }}>{mod}</span>}
        <span style={{ color: "#e4e4e7", wordBreak: "break-word", flex: 1 }}>
          {msg}
          {item.err && typeof item.err === "string" ? ` - ${item.err}` : ""}
        </span>
      </Box>

      <Tooltip title={copied ? "Copied!" : "Copy log line"} placement="left">
        <IconButton
          className="terminal-copy-btn"
          size="small"
          onClick={handleCopyLine}
          sx={{
            opacity: copied ? 1 : 0,
            transition: "opacity 0.15s ease, background-color 0.15s ease",
            p: 0.3,
            color: copied ? "#10b981" : "#71717a",
            bgcolor: copied ? "rgba(16, 185, 129, 0.12)" : "transparent",
            borderRadius: 0.5,
            flexShrink: 0,
            "&:hover": {
              color: copied ? "#10b981" : "#fafafa",
              bgcolor: copied ? "rgba(16, 185, 129, 0.2)" : "#27272a",
            },
          }}
        >
          {copied ? <CheckIcon sx={{ fontSize: "0.8rem" }} /> : <ContentCopyIcon sx={{ fontSize: "0.8rem" }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});
LogTerminalRow.displayName = "LogTerminalRow";

export function TabLogs() {
  const logs = useStudioStore((s) => s.logs);
  const logsFilter = useStudioStore((s) => s.logsFilter);
  const setLogsFilter = useStudioStore((s) => s.setLogsFilter);
  const autoRefreshLogs = useStudioStore((s) => s.autoRefreshLogs);
  const setAutoRefreshLogs = useStudioStore((s) => s.setAutoRefreshLogs);
  const copiedLogs = useStudioStore((s) => s.copiedLogs);
  const fetchLogs = useStudioStore((s) => s.fetchLogs);
  const handleCopyLogs = useStudioStore((s) => s.handleCopyLogs);
  const handleClearLogs = useStudioStore((s) => s.handleClearLogs);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"stream" | "terminal">("stream");
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-refresh logs timer
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, fetchLogs]);

  // Fast Memoized Filtering
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return logs.filter((item) => {
      // 1. Level Filter
      if (logsFilter !== "ALL") {
        const lvlName = getLevelLabel(item.level);
        if (lvlName !== logsFilter) return false;
      }

      // 2. Keyword Search
      if (q) {
        const msg = String(item.msg || item.message || "").toLowerCase();
        const mod = String(item.module || "").toLowerCase();
        const err = item.err ? String(JSON.stringify(item.err)).toLowerCase() : "";
        if (!msg.includes(q) && !mod.includes(q) && !err.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, logsFilter, searchQuery]);

  // Auto-scroll to bottom when new logs arrive (if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const handleToggleAutoScroll = () => {
    const nextState = !autoScroll;
    setAutoScroll(nextState);
    if (nextState && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top Controls Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.9rem" }}>
            Process Logs ({filteredLogs.length}{filteredLogs.length !== logs.length ? ` / ${logs.length}` : ""})
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
              />
            }
            label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.72rem" }}>Live (2s)</Typography>}
          />

          <Tooltip title={`Auto-scroll: ${autoScroll ? "ON (click to pause)" : "OFF (click to enable)"}`}>
            <IconButton
              size="small"
              onClick={handleToggleAutoScroll}
              sx={{
                color: autoScroll ? "#00e5ff" : "#71717a",
                bgcolor: autoScroll ? "rgba(0, 229, 255, 0.1)" : "transparent",
                borderRadius: 0.8,
                p: 0.6,
                "&:hover": { color: "#ffffff", bgcolor: "#18181b" },
              }}
            >
              <VerticalAlignBottomIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Switch View Mode (Stream vs Terminal)">
            <IconButton
              size="small"
              onClick={() => setViewMode((prev) => (prev === "stream" ? "terminal" : "stream"))}
              sx={{
                color: viewMode === "terminal" ? "#00e5ff" : "#a1a1aa",
                bgcolor: viewMode === "terminal" ? "rgba(0, 229, 255, 0.1)" : "transparent",
                borderRadius: 0.8,
                p: 0.6,
                "&:hover": { color: "#ffffff", bgcolor: "#18181b" },
              }}
            >
              {viewMode === "stream" ? <TerminalIcon fontSize="small" /> : <ViewAgendaIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh Logs Now">
            <IconButton
              size="small"
              onClick={() => fetchLogs()}
              sx={{ color: "#a1a1aa", "&:hover": { color: "#ffffff", bgcolor: "#18181b" }, p: 0.6 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Copy all logs in JSON format">
            <Button
              size="small"
              variant="outlined"
              startIcon={copiedLogs ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              sx={{
                color: copiedLogs ? "#10b981" : "#a1a1aa",
                borderColor: copiedLogs ? "#10b981" : "#27272a",
                textTransform: "none",
                fontSize: "0.72rem",
                borderRadius: 0.8,
                py: 0.3,
                px: 1,
                bgcolor: copiedLogs ? "rgba(16, 185, 129, 0.08)" : "transparent",
                "&:hover": { borderColor: "#3f3f46", color: "#ffffff", bgcolor: "#18181b" },
              }}
            >
              {copiedLogs ? "Copied All!" : "Copy All"}
            </Button>
          </Tooltip>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            sx={{
              color: "#f87171",
              borderColor: "rgba(239, 68, 68, 0.3)",
              textTransform: "none",
              fontSize: "0.72rem",
              borderRadius: 0.8,
              py: 0.3,
              px: 1,
              "&:hover": {
                borderColor: "#ef4444",
                bgcolor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
              },
            }}
          >
            Clear
          </Button>
        </Box>
      </Box>

      {/* Filter and Quick Search Bar */}
      <Box sx={{ display: "flex", gap: 1, mb: 1.2, alignItems: "center", flexWrap: "wrap" }}>
        {/* Level Filters */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((filterName) => (
            <Chip
              key={filterName}
              label={filterName}
              size="small"
              onClick={() => setLogsFilter(filterName)}
              sx={{
                bgcolor: logsFilter === filterName ? "#3b82f6" : "#141418",
                color: logsFilter === filterName ? "#ffffff" : "#a1a1aa",
                fontWeight: 700,
                fontSize: "0.68rem",
                height: 24,
                borderRadius: 0.6,
                cursor: "pointer",
                border: logsFilter === filterName ? "1px solid #3b82f6" : "1px solid #27272a",
                "&:hover": { borderColor: "#3f3f46" },
              }}
            />
          ))}
        </Box>

        {/* Search Field */}
        <TextField
          size="small"
          placeholder="Filter logs by keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#71717a", fontSize: "0.95rem" }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery("")}
                    sx={{ color: "#71717a", p: 0.2, "&:hover": { color: "#fafafa" } }}
                  >
                    <CloseIcon sx={{ fontSize: "0.85rem" }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                height: 28,
                fontSize: "0.75rem",
                color: "#fafafa",
                bgcolor: "#141418",
                borderRadius: 0.6,
                "& fieldset": { borderColor: "#27272a" },
                "&:hover fieldset": { borderColor: "#3f3f46" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
              },
            },
          }}
          sx={{ flex: 1, minWidth: 160 }}
        />
      </Box>

      {/* High-Performance Log Stream Container */}
      <Box
        ref={logContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto",
          p: 1.2,
          bgcolor: viewMode === "terminal" ? "#060608" : "#09090b",
          borderRadius: 1,
          border: "1px solid #27272a",
          display: "flex",
          flexDirection: "column",
          gap: viewMode === "terminal" ? 0.2 : 0.7,
          fontFamily: viewMode === "terminal" ? "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" : "inherit",
          scrollBehavior: autoScroll ? "smooth" : "auto",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "#27272a", borderRadius: 3 },
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, gap: 1 }}>
            <TerminalIcon sx={{ color: "#3f3f46", fontSize: "2rem" }} />
            <Typography variant="caption" sx={{ color: "#71717a", textAlign: "center" }}>
              {searchQuery ? "No matching logs found for your search query." : "No log activity recorded for this project yet."}
            </Typography>
            {searchQuery && (
              <Button
                size="small"
                variant="text"
                onClick={() => setSearchQuery("")}
                sx={{ color: "#3b82f6", fontSize: "0.72rem", textTransform: "none", py: 0 }}
              >
                Clear search filter
              </Button>
            )}
          </Box>
        ) : (
          filteredLogs.map((item, idx) => {
            const timeVal = (item as { time?: unknown; timestamp?: unknown }).time || (item as { time?: unknown; timestamp?: unknown }).timestamp;
            const timeStr = timeVal
              ? new Date(typeof timeVal === "number" ? timeVal : String(timeVal)).toLocaleTimeString("en-US", { hour12: false })
              : "--:--:--";

            const rowKey = `${timeVal || "log"}_${item.msg || ""}_${idx}`;

            return viewMode === "terminal" ? (
              <LogTerminalRow key={rowKey} item={item} timeStr={timeStr} />
            ) : (
              <LogCardRow key={rowKey} item={item} timeStr={timeStr} />
            );
          })
        )}
      </Box>
    </Box>
  );
}

