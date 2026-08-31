"use client";

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
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import { useStudioStore } from "../store/useStudioStore";
import { LogItem } from "../types/studio.types";

const getLevelInfo = (lvl?: unknown) => {
  const num = Number(lvl);
  if (isNaN(num)) return { label: "INFO", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" };
  if (num >= 50) return { label: "ERROR", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)" };
  if (num >= 40) return { label: "WARN", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)" };
  if (num >= 30) return { label: "INFO", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" };
  return { label: "DEBUG", color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)" };
};

// High-Performance Terminal Log Row
const TerminalLogRow = memo(({ item, timeStr }: { item: LogItem; timeStr: string }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lvlInfo = getLevelInfo(item.level);
  const msg = ((item.msg || item.message || "") as string).trim();
  const mod = item.module ? String(item.module) : "";

  // Check if there are extra metadata properties worth inspecting
  const extraKeys = Object.keys(item).filter(
    (k) => !["time", "timestamp", "level", "msg", "message", "pid", "hostname"].includes(k)
  );
  const hasExtra = extraKeys.length > 0 || Boolean(item.err);

  const handleCopyLine = (e: React.MouseEvent) => {
    e.stopPropagation();
    const errText = item.err
      ? ` | err: ${typeof item.err === "string" ? item.err : JSON.stringify(item.err)}`
      : "";
    const rawLine = `[${timeStr}] [${lvlInfo.label}] ${mod ? `[${mod}] ` : ""}${msg}${errText}`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(rawLine);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        fontSize: "0.74rem",
        lineHeight: 1.5,
        py: 0.35,
        px: 0.8,
        borderRadius: 0.6,
        transition: "background-color 0.1s ease",
        bgcolor: expanded ? "rgba(255, 255, 255, 0.03)" : "transparent",
        "&:hover": {
          bgcolor: "rgba(255, 255, 255, 0.05)",
          "& .terminal-row-actions": { opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          {/* Timestamp */}
          <span style={{ color: "#64748b", flexShrink: 0, userSelect: "none" }}>{timeStr}</span>

          {/* Level Tag */}
          <span
            style={{
              color: lvlInfo.color,
              backgroundColor: lvlInfo.bg,
              padding: "0 4px",
              borderRadius: "3px",
              fontWeight: 700,
              fontSize: "0.68rem",
              flexShrink: 0,
            }}
          >
            {lvlInfo.label}
          </span>

          {/* Module Name */}
          {mod && (
            <span style={{ color: "#818cf8", fontWeight: 600, flexShrink: 0 }}>
              [{mod}]
            </span>
          )}

          {/* Message Content */}
          <span
            style={{
              color: lvlInfo.label === "ERROR" ? "#fca5a5" : "#e2e8f0",
              wordBreak: "break-word",
              flex: 1,
            }}
          >
            {msg}
            {item.err && typeof item.err === "string" ? (
              <span style={{ color: "#f87171", marginLeft: 6 }}>— {item.err}</span>
            ) : null}
          </span>
        </Box>

        {/* Hover Action Buttons */}
        <Box
          className="terminal-row-actions"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.4,
            opacity: copied || expanded ? 1 : 0,
            transition: "opacity 0.15s ease",
            flexShrink: 0,
          }}
        >
          {hasExtra && (
            <Tooltip title={expanded ? "Collapse details" : "Inspect payload"} placement="left">
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  p: 0.25,
                  color: expanded ? "#38bdf8" : "#64748b",
                  "&:hover": { color: "#f8fafc", bgcolor: "#27272a" },
                }}
              >
                {expanded ? (
                  <UnfoldLessIcon sx={{ fontSize: "0.85rem" }} />
                ) : (
                  <UnfoldMoreIcon sx={{ fontSize: "0.85rem" }} />
                )}
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={copied ? "Copied!" : "Copy line"} placement="left">
            <IconButton
              size="small"
              onClick={handleCopyLine}
              sx={{
                p: 0.25,
                color: copied ? "#10b981" : "#64748b",
                bgcolor: copied ? "rgba(16, 185, 129, 0.15)" : "transparent",
                borderRadius: 0.5,
                "&:hover": {
                  color: copied ? "#10b981" : "#f8fafc",
                  bgcolor: copied ? "rgba(16, 185, 129, 0.2)" : "#27272a",
                },
              }}
            >
              {copied ? <CheckIcon sx={{ fontSize: "0.8rem" }} /> : <ContentCopyIcon sx={{ fontSize: "0.8rem" }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Expanded JSON Inspector */}
      {expanded && (
        <Box
          sx={{
            mt: 0.6,
            mb: 0.4,
            p: 1.2,
            bgcolor: "#050508",
            border: "1px solid #1e293b",
            borderRadius: 1,
            color: "#94a3b8",
            fontSize: "0.7rem",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(item, null, 2)}
        </Box>
      )}
    </Box>
  );
});
TerminalLogRow.displayName = "TerminalLogRow";

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
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-refresh logs timer (optimized to 3s)
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, fetchLogs]);

  // Fast Memoized Filtering
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return logs.filter((item) => {
      // 1. Level Filter
      if (logsFilter !== "ALL") {
        const lvlName = getLevelInfo(item.level).label;
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

  // Instant scroll to bottom when new logs arrive (without heavy smooth reflow)
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    if (next && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Terminal Window Header Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 1.5,
          py: 0.8,
          bgcolor: "#111116",
          border: "1px solid #27272a",
          borderBottom: "none",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        {/* Terminal Title & Window Dots */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box sx={{ display: "flex", gap: 0.6, userSelect: "none" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ef4444" }} />
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#f59e0b" }} />
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#10b981" }} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <TerminalIcon sx={{ color: "#38bdf8", fontSize: "1.05rem" }} />
            <Typography
              variant="subtitle2"
              sx={{
                color: "#f4f4f5",
                fontWeight: 700,
                fontSize: "0.82rem",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              xclips.log
            </Typography>
            <Chip
              label={`${filteredLogs.length} events`}
              size="small"
              sx={{
                bgcolor: "rgba(56, 189, 248, 0.12)",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "0.65rem",
                height: 18,
                borderRadius: 0.6,
              }}
            />
          </Box>
        </Box>

        {/* Action Controls */}
        <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#38bdf8" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#38bdf8" },
                }}
              />
            }
            label={
              <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.72rem", fontFamily: "monospace" }}>
                Live (3s)
              </Typography>
            }
            sx={{ m: 0, mr: 0.5 }}
          />

          <Tooltip title={`Auto-scroll: ${autoScroll ? "ON (click to pause)" : "OFF (click to enable)"}`}>
            <IconButton
              size="small"
              onClick={handleToggleAutoScroll}
              sx={{
                color: autoScroll ? "#38bdf8" : "#64748b",
                bgcolor: autoScroll ? "rgba(56, 189, 248, 0.12)" : "transparent",
                borderRadius: 0.8,
                p: 0.5,
                "&:hover": { color: "#ffffff", bgcolor: "#1e293b" },
              }}
            >
              <VerticalAlignBottomIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh Logs">
            <IconButton
              size="small"
              onClick={() => fetchLogs()}
              sx={{ color: "#94a3b8", "&:hover": { color: "#ffffff", bgcolor: "#1e293b" }, p: 0.5 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Copy all logs to clipboard">
            <Button
              size="small"
              variant="outlined"
              startIcon={copiedLogs ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              sx={{
                color: copiedLogs ? "#10b981" : "#94a3b8",
                borderColor: copiedLogs ? "#10b981" : "#27272a",
                textTransform: "none",
                fontSize: "0.7rem",
                fontFamily: "monospace",
                borderRadius: 0.8,
                py: 0.2,
                px: 1,
                bgcolor: copiedLogs ? "rgba(16, 185, 129, 0.08)" : "transparent",
                "&:hover": { borderColor: "#3f3f46", color: "#ffffff", bgcolor: "#18181b" },
              }}
            >
              {copiedLogs ? "Copied!" : "Copy All"}
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
              fontSize: "0.7rem",
              fontFamily: "monospace",
              borderRadius: 0.8,
              py: 0.2,
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

      {/* Filter and Search Sub-bar */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          px: 1.5,
          py: 0.8,
          bgcolor: "#0c0c10",
          borderLeft: "1px solid #27272a",
          borderRight: "1px solid #27272a",
          borderBottom: "1px solid #1e293b",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Level Filters */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((filterName) => {
            const isSelected = logsFilter === filterName;
            return (
              <Chip
                key={filterName}
                label={filterName}
                size="small"
                onClick={() => setLogsFilter(filterName)}
                sx={{
                  bgcolor: isSelected ? "#2563eb" : "#141418",
                  color: isSelected ? "#ffffff" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.66rem",
                  fontFamily: "monospace",
                  height: 22,
                  borderRadius: 0.6,
                  cursor: "pointer",
                  border: isSelected ? "1px solid #3b82f6" : "1px solid #27272a",
                  "&:hover": { borderColor: "#3f3f46" },
                }}
              />
            );
          })}
        </Box>

        {/* Search Field */}
        <TextField
          size="small"
          placeholder="grep search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#64748b", fontSize: "0.9rem" }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery("")}
                    sx={{ color: "#64748b", p: 0.2, "&:hover": { color: "#fafafa" } }}
                  >
                    <CloseIcon sx={{ fontSize: "0.8rem" }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                height: 26,
                fontSize: "0.72rem",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#f8fafc",
                bgcolor: "#141418",
                borderRadius: 0.6,
                "& fieldset": { borderColor: "#27272a" },
                "&:hover fieldset": { borderColor: "#3f3f46" },
                "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
              },
            },
          }}
          sx={{ flex: 1, minWidth: 160 }}
        />
      </Box>

      {/* Terminal Output Console */}
      <Box
        ref={logContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto",
          p: 1,
          bgcolor: "#07070a",
          border: "1px solid #27272a",
          borderTop: "none",
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 0.15,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "#27272a", borderRadius: 3 },
          "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#3f3f46" },
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 8,
              gap: 1,
            }}
          >
            <TerminalIcon sx={{ color: "#334155", fontSize: "2.2rem" }} />
            <Typography
              variant="caption"
              sx={{ color: "#64748b", textAlign: "center", fontFamily: "monospace" }}
            >
              {searchQuery
                ? "grep: No matching log lines found."
                : "No log activity recorded yet. Logs will stream here in real-time."}
            </Typography>
            {searchQuery && (
              <Button
                size="small"
                variant="text"
                onClick={() => setSearchQuery("")}
                sx={{
                  color: "#38bdf8",
                  fontSize: "0.72rem",
                  textTransform: "none",
                  py: 0,
                  fontFamily: "monospace",
                }}
              >
                Clear filter
              </Button>
            )}
          </Box>
        ) : (
          filteredLogs.map((item, idx) => {
            const timeVal =
              (item as { time?: unknown; timestamp?: unknown }).time ||
              (item as { time?: unknown; timestamp?: unknown }).timestamp;
            const timeStr = timeVal
              ? new Date(typeof timeVal === "number" ? timeVal : String(timeVal)).toLocaleTimeString("en-US", {
                  hour12: false,
                })
              : "--:--:--";

            const rowKey = `${timeVal || "log"}_${item.msg || ""}_${idx}`;

            return <TerminalLogRow key={rowKey} item={item} timeStr={timeStr} />;
          })
        )}
      </Box>
    </Box>
  );
}
