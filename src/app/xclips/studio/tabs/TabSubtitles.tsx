import React, { useRef, useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  Card,
  TextField,
  InputAdornment,
  FormControlLabel,
  Switch,
  CircularProgress,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useStudioStore } from "../store/useStudioStore";
import { useTranscriptVirtualizer } from "../hooks/useTranscriptVirtualizer";
import { formatTime } from "../types/studio.types";
import { GenerateSubtitleModal } from "../modals/GenerateSubtitleModal";

export function TabSubtitles() {
  const virtualScrollRef = useRef<HTMLDivElement>(null);
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);

  const project = useStudioStore((s) => s.project);
  const subtitleOffsetMs = useStudioStore((s) => s.subtitleOffsetMs);
  const setSubtitleOffsetMs = useStudioStore((s) => s.setSubtitleOffsetMs);
  const handleShiftSubtitleOffsetMs = useStudioStore((s) => s.handleShiftSubtitleOffsetMs);
  const handleApplyOffsetPermanently = useStudioStore((s) => s.handleApplyOffsetPermanently);
  const isTranscribing = useStudioStore((s) => s.isTranscribing);
  const isFetchingYtSubtitles = useStudioStore((s) => s.isFetchingYtSubtitles);
  const handleFetchYouTubeSubtitles = useStudioStore((s) => s.handleFetchYouTubeSubtitles);
  const subtitleTracks = useStudioStore((s) => s.subtitleTracks);
  const activeTranscript = useStudioStore((s) => s.transcript);
  const setIsGenerateSubtitleModalOpen = useStudioStore((s) => s.setIsGenerateSubtitleModalOpen);
  const handleSwitchSubtitleTrack = useStudioStore((s) => s.handleSwitchSubtitleTrack);
  const autoSaveStatus = useStudioStore((s) => s.autoSaveStatus);
  const editableWords = useStudioStore((s) => s.editableWords);
  const autoScrollToPlayhead = useStudioStore((s) => s.autoScrollToPlayhead);
  const setAutoScrollToPlayhead = useStudioStore((s) => s.setAutoScrollToPlayhead);
  const handleDownloadSrt = useStudioStore((s) => s.handleDownloadSrt);
  const searchQuery = useStudioStore((s) => s.searchQuery);
  const setSearchQuery = useStudioStore((s) => s.setSearchQuery);
  const setScrollTop = useStudioStore((s) => s.setScrollTop);
  const dragOverPhraseIndex = useStudioStore((s) => s.dragOverPhraseIndex);
  const setDragOverPhraseIndex = useStudioStore((s) => s.setDragOverPhraseIndex);
  const draggedPhraseIndex = useStudioStore((s) => s.draggedPhraseIndex);
  const setDraggedPhraseIndex = useStudioStore((s) => s.setDraggedPhraseIndex);
  const handleSeek = useStudioStore((s) => s.handleSeek);

  const {
    phraseSegments,
    filteredPhrases,
    itemPositions,
    visibleRange,
    currentActivePhrase,
    handleUpdatePhraseText,
    handleReorderPhrases,
    renderHighlightedText,
  } = useTranscriptVirtualizer(virtualScrollRef);

  const isYouTubeProject =
    project?.sourceType === "youtube" ||
    (project?.sourcePath && /youtube|youtu\.be|\[[a-zA-Z0-9_-]{11}\]/i.test(project.sourcePath));

  const isBusy = isFetchingYtSubtitles || isTranscribing;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Grid container spacing={2} sx={{ height: "100%", minHeight: 0, flex: 1, alignItems: "stretch" }}>
        {/* LEFT COLUMN: SOURCE SELECTION & OFFSET SYNC */}
        <Grid size={{ xs: 12, md: 4.2, lg: 3.6 }} sx={{ display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              p: 2,
              bgcolor: subtitleOffsetMs !== 0 ? "rgba(245, 158, 11, 0.05)" : "#141418",
              borderRadius: 1.2,
              border: subtitleOffsetMs !== 0 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #27272a",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxSizing: "border-box",
            }}
          >
            {/* Top Controls */}
            <Box>
              {/* Header */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTimeIcon sx={{ color: subtitleOffsetMs !== 0 ? "#f59e0b" : "#3b82f6", fontSize: "1.15rem" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.88rem" }}>
                    Subtitle & Sync
                  </Typography>
                </Box>
                <Chip
                  label={
                    subtitleOffsetMs === 0
                      ? "0 ms"
                      : subtitleOffsetMs > 0
                      ? `+${subtitleOffsetMs} ms`
                      : `${subtitleOffsetMs} ms`
                  }
                  size="small"
                  sx={{
                    bgcolor: subtitleOffsetMs !== 0 ? "#f59e0b" : "#27272a",
                    color: subtitleOffsetMs !== 0 ? "#000000" : "#a1a1aa",
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    fontFamily: "monospace",
                  }}
                />
              </Box>

              {/* Subtitle Source Dropdown & Generate Button */}
              <Box
                sx={{
                  p: 1.2,
                  bgcolor: "#0d0d10",
                  borderRadius: 1,
                  border: "1px solid #27272a",
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                  <Typography variant="caption" sx={{ color: "#71717a", fontWeight: 700, textTransform: "uppercase", fontSize: "0.68rem" }}>
                    SUBTITLE SOURCE
                  </Typography>
                  <Chip
                    label={
                      activeTranscript?.sourceType === "youtube_cc"
                        ? "YouTube CC"
                        : activeTranscript?.label || (subtitleTracks.length > 0 ? "Track Aktif" : "Belum Ada")
                    }
                    size="small"
                    sx={{
                      bgcolor: activeTranscript?.sourceType === "youtube_cc" ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
                      color: activeTranscript?.sourceType === "youtube_cc" ? "#f87171" : "#60a5fa",
                      fontWeight: 800,
                      fontSize: "0.65rem",
                      height: 18,
                      borderRadius: 0.6,
                    }}
                  />
                </Box>

                <Select
                  fullWidth
                  size="small"
                  value={activeTranscript?.id || (subtitleTracks.length > 0 ? subtitleTracks[0].id : "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__action_generate_new__") {
                      setIsGenerateSubtitleModalOpen(true);
                    } else if (val === "__action_fetch_yt_cc__") {
                      handleFetchYouTubeSubtitles();
                    } else if (val) {
                      handleSwitchSubtitleTrack(val);
                    }
                  }}
                  disabled={isBusy}
                  displayEmpty
                  renderValue={(selected) => {
                    if (!selected) return <span style={{ color: "#71717a" }}>Pilih Track Subtitle...</span>;
                    const found = subtitleTracks.find((t) => t.id === selected) || activeTranscript;
                    if (!found) return <span style={{ color: "#71717a" }}>Pilih Track Subtitle...</span>;
                    const isYt = found.sourceType === "youtube_cc" || found.label === "YouTube Subtitles (CC)";
                    const title = isYt ? "YouTube Subtitles (CC)" : (found.label || "Track");
                    return (
                      <span style={{ fontWeight: 700, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {title}
                      </span>
                    );
                  }}
                  sx={{
                    bgcolor: "#141418",
                    borderRadius: 0.8,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#fafafa",
                    "& .MuiSelect-select": { py: 0.6, px: 1 },
                    "& fieldset": { borderColor: "#27272a" },
                    "&:hover fieldset": { borderColor: "#3f3f46" },
                    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                  }}
                >
                  {subtitleTracks.map((track) => {
                    const isYt = track.sourceType === "youtube_cc" || track.label === "YouTube Subtitles (CC)";
                    const title = isYt ? "YouTube Subtitles (CC)" : (track.label || "Track");
                    return (
                      <MenuItem
                        key={track.id}
                        value={track.id}
                        sx={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          bgcolor: activeTranscript?.id === track.id ? "rgba(59, 130, 246, 0.12)" : "transparent",
                        }}
                      >
                        <span>{title}</span>
                        <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                          {track.words?.length || 0} kata
                        </Typography>
                      </MenuItem>
                    );
                  })}

                  {isYouTubeProject && !subtitleTracks.some((t) => t.sourceType === "youtube_cc") && (
                    <MenuItem
                      value="__action_fetch_yt_cc__"
                      sx={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#f87171",
                        display: "flex",
                        alignItems: "center",
                        "&:hover": { bgcolor: "rgba(239, 68, 68, 0.15)" },
                      }}
                    >
                      <span>Muat Subtitle YouTube (CC)...</span>
                    </MenuItem>
                  )}

                  {subtitleTracks.length > 0 && <Divider sx={{ borderColor: "#27272a", my: 0.5 }} />}

                  <MenuItem
                    value="__action_generate_new__"
                    sx={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#60a5fa",
                      display: "flex",
                      alignItems: "center",
                      "&:hover": { bgcolor: "rgba(59, 130, 246, 0.15)" },
                    }}
                  >
                    <span>+ Generate New Subtitle...</span>
                  </MenuItem>
                </Select>
              </Box>

              {/* Offset Input Field */}
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.72rem" }}>
                    Timing Offset
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={subtitleOffsetMs === 0 ? "0" : subtitleOffsetMs.toString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSubtitleOffsetMs(isNaN(val) ? 0 : val);
                  }}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end"><Typography variant="caption" sx={{ color: "#71717a", fontWeight: 800 }}>ms</Typography></InputAdornment>,
                    },
                  }}
                  sx={{
                    "& .MuiInputBase-input": {
                      color: subtitleOffsetMs !== 0 ? "#facc15" : "#ffffff",
                      fontWeight: 800,
                      fontSize: "0.92rem",
                      fontFamily: "monospace",
                      py: 0.7,
                    },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#0d0d10",
                      borderRadius: 1,
                      "& fieldset": { borderColor: subtitleOffsetMs !== 0 ? "#f59e0b" : "#27272a" },
                      "&:hover fieldset": { borderColor: subtitleOffsetMs !== 0 ? "#fbbf24" : "#3f3f46" },
                    },
                  }}
                />
              </Box>

              {/* Quick Shift Grid */}
              <Box sx={{ mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: "#71717a", fontWeight: 700, fontSize: "0.68rem", mb: 0.6, display: "block", textTransform: "uppercase" }}>
                  Quick Shift
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.6, mb: 0.6 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(-1000)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    -1000ms
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(-500)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    -500ms
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(-100)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    -100ms
                  </Button>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.6, mb: 0.8 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(100)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    +100ms
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(500)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    +500ms
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleShiftSubtitleOffsetMs(1000)}
                    sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                  >
                    +1000ms
                  </Button>
                </Box>
                <Button
                  fullWidth
                  size="small"
                  variant="text"
                  onClick={() => setSubtitleOffsetMs(0)}
                  disabled={subtitleOffsetMs === 0}
                  sx={{ py: 0.3, fontSize: "0.72rem", color: subtitleOffsetMs !== 0 ? "#a1a1aa" : "#52525b", textTransform: "none", fontWeight: 700 }}
                >
                  Reset to 0ms
                </Button>
              </Box>
            </Box>

            {/* Bottom Action: Apply Permanently */}
            <Box sx={{ pt: 1.2, borderTop: "1px solid #27272a" }}>
              <Button
                fullWidth
                variant="contained"
                size="small"
                onClick={handleApplyOffsetPermanently}
                disabled={autoSaveStatus === "saving" || subtitleOffsetMs === 0}
                sx={{
                  bgcolor: subtitleOffsetMs !== 0 ? "#10b981" : "#27272a",
                  color: subtitleOffsetMs !== 0 ? "#ffffff" : "#71717a",
                  fontWeight: 800,
                  fontSize: "0.76rem",
                  textTransform: "none",
                  borderRadius: 1,
                  py: 0.6,
                  "&:hover": { bgcolor: subtitleOffsetMs !== 0 ? "#059669" : "#27272a" },
                }}
              >
                {autoSaveStatus === "saving" ? "Applying..." : "Apply Offset Permanently"}
              </Button>
            </Box>
          </Box>
        </Grid>

        {/* RIGHT COLUMN: SUBTITLE EDITOR & PHRASE LIST */}
        <Grid size={{ xs: 12, md: 7.8, lg: 8.4 }} sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* Top Bar */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1, flexShrink: 0 }}>
            <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.92rem" }}>
              Subtitles ({phraseSegments.length} Phrases)
            </Typography>

            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={autoScrollToPlayhead}
                    onChange={(e) => setAutoScrollToPlayhead(e.target.checked)}
                  />
                }
                label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.74rem" }}>Follow Playhead</Typography>}
              />

              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadSrt}
                disabled={editableWords.length === 0}
                sx={{
                  borderColor: "#3f3f46",
                  color: "#e4e4e7",
                  textTransform: "none",
                  fontWeight: 700,
                  px: 1.4,
                  py: 0.4,
                  borderRadius: 1,
                  fontSize: "0.76rem",
                  "&:hover": { borderColor: "#71717a", bgcolor: "rgba(255,255,255,0.06)" },
                }}
              >
                Download .SRT
              </Button>

              {autoSaveStatus === "saving" && (
                <Chip
                  icon={<CircularProgress size={12} sx={{ color: "#60a5fa !important" }} />}
                  label="Auto-saving..."
                  size="small"
                  sx={{
                    height: 26,
                    bgcolor: "rgba(59, 130, 246, 0.15)",
                    color: "#93c5fd",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    borderRadius: 0.8,
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                />
              )}

              {autoSaveStatus === "saved" && (
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: "0.9rem !important", color: "#4ade80" }} />}
                  label="Auto-saved"
                  size="small"
                  sx={{
                    height: 26,
                    bgcolor: "rgba(34, 197, 94, 0.15)",
                    color: "#4ade80",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    borderRadius: 0.8,
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search phrases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              mb: 1,
              flexShrink: 0,
              "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: 0.6 },
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0d0d10",
                borderRadius: 1,
                "& fieldset": { borderColor: searchQuery.trim() ? "#facc15" : "#27272a" },
                "&:hover fieldset": { borderColor: searchQuery.trim() ? "#facc15" : "#3f3f46" },
              },
            }}
            slotProps={{
              htmlInput: {
                spellCheck: false,
                autoCorrect: "off",
                autoCapitalize: "none",
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: searchQuery.trim() ? "#facc15" : "#71717a" }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {phraseSegments.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <RecordVoiceOverIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1.5 }} />
              <Typography variant="body2" sx={{ color: "#71717a" }}>
                No subtitles available yet. Select a subtitle source from the dropdown on the left and click Generate.
              </Typography>
            </Box>
          ) : (
            /* High-Performance Virtualized Container with Hidden Scrollbar */
            <Box
              ref={virtualScrollRef}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              sx={{
                flex: 1,
                maxHeight: "calc(100vh - 270px)",
                overflowY: "auto",
                position: "relative",
                bgcolor: "#09090c",
                p: 1,
                borderRadius: 1,
                border: "1px solid #27272a",
                boxSizing: "border-box",
                scrollbarWidth: "none", // Firefox
                "&::-webkit-scrollbar": { display: "none" }, // Chrome / Safari / Edge
                msOverflowStyle: "none", // IE / legacy Edge
              }}
            >
              {/* Virtual spacer */}
              <Box sx={{ height: itemPositions.totalHeight, width: "100%", position: "relative" }}>
                {filteredPhrases
                  .slice(visibleRange.start, visibleRange.end + 1)
                  .map((seg, sliceIdx) => {
                    const actualIndex = visibleRange.start + sliceIdx;
                    const pos = itemPositions.positions[actualIndex];
                    if (!pos) return null;

                    // Exactly one active playhead matching the video preview
                    const isActive = currentActivePhrase !== undefined && (currentActivePhrase.id === seg.id || currentActivePhrase.index === seg.index);
                    const isDragOver = dragOverPhraseIndex === seg.index;
                    const isBeingDragged = draggedPhraseIndex === seg.index;
                    const hasSearchMatch = searchQuery.trim() && seg.text.toLowerCase().includes(searchQuery.toLowerCase());

                    return (
                      <Box
                        key={seg.id}
                        sx={{
                          position: "absolute",
                          top: pos.top,
                          left: 0,
                          right: 0,
                          height: pos.height,
                          width: "100%",
                          boxSizing: "border-box",
                          flexShrink: 0,
                        }}
                      >
                        <Card
                          onClick={() => handleSeek(seg.startSec)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverPhraseIndex(seg.index);
                          }}
                          onDragLeave={() => {
                            if (dragOverPhraseIndex === seg.index) setDragOverPhraseIndex(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedPhraseIndex !== null && draggedPhraseIndex !== seg.index) {
                              handleReorderPhrases(draggedPhraseIndex, seg.index);
                            }
                            setDraggedPhraseIndex(null);
                            setDragOverPhraseIndex(null);
                          }}
                          sx={{
                            height: "100%",
                            p: 0.6,
                            px: 1,
                            boxSizing: "border-box",
                            bgcolor: isDragOver
                              ? "rgba(59, 130, 246, 0.2)"
                              : isActive
                              ? "rgba(59, 130, 246, 0.12)"
                              : "#121216",
                            border: isDragOver
                              ? "2px dashed #3b82f6"
                              : isActive
                              ? "1.5px solid #3b82f6"
                              : "1px solid #232328",
                            borderRadius: 1,
                            opacity: isBeingDragged ? 0.4 : 1,
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 1,
                            cursor: "pointer",
                            "&:hover": { borderColor: isActive ? "#3b82f6" : "#3f3f46" },
                          }}
                        >
                          {/* Single Horizontal Row */}
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, width: "100%" }}>
                            {/* Drag Handle & Phrase Index */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                              <Box
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedPhraseIndex(seg.index);
                                }}
                                sx={{
                                  cursor: "grab",
                                  color: "#52525b",
                                  display: "flex",
                                  alignItems: "center",
                                  "&:hover": { color: "#e4e4e7" },
                                }}
                              >
                                <DragIndicatorIcon sx={{ fontSize: "0.95rem" }} />
                              </Box>
                              <Chip
                                label={`#${(seg.index + 1).toString().padStart(2, "0")}`}
                                size="small"
                                sx={{
                                  bgcolor: isActive ? "#3b82f6" : "#1c1c22",
                                  color: isActive ? "#ffffff" : "#a1a1aa",
                                  fontWeight: 800,
                                  fontSize: "0.65rem",
                                  height: 18,
                                  borderRadius: 0.6,
                                  fontFamily: "monospace",
                                }}
                              />
                            </Box>

                            {/* Timecode Range */}
                            <Box sx={{ display: "flex", flexDirection: "column", minWidth: 92, flexShrink: 0 }}>
                              <Typography
                                variant="caption"
                                sx={{ color: isActive ? "#60a5fa" : "#a1a1aa", fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem", lineHeight: 1.2 }}
                              >
                                {formatTime(seg.startSec)} - {formatTime(seg.endSec)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.65rem", lineHeight: 1.1 }}>
                                {(seg.endSec - seg.startSec).toFixed(1)}s
                              </Typography>
                            </Box>

                            {/* Subtitle Text: Inline Highlight when searching, Editable TextField when focused/idle */}
                            {searchQuery.trim() && editingPhraseIndex !== seg.index ? (
                              <Box
                                onClick={() => {
                                  handleSeek(seg.startSec);
                                  setEditingPhraseIndex(seg.index);
                                }}
                                sx={{
                                  flex: 1,
                                  height: 32,
                                  bgcolor: "#18181c",
                                  borderRadius: 0.8,
                                  border: isActive ? "1px solid #3b82f6" : "1px solid #27272a",
                                  display: "flex",
                                  alignItems: "center",
                                  px: 1,
                                  cursor: "text",
                                  overflow: "hidden",
                                  "&:hover": { borderColor: "#3f3f46" },
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: "#ffffff",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {renderHighlightedText(seg.text, searchQuery)}
                                </Typography>
                              </Box>
                            ) : (
                              <TextField
                                fullWidth
                                size="small"
                                variant="outlined"
                                value={seg.text}
                                autoFocus={editingPhraseIndex === seg.index}
                                onBlur={() => setEditingPhraseIndex(null)}
                                onChange={(e) => handleUpdatePhraseText(seg.index, e.target.value)}
                                onFocus={() => handleSeek(seg.startSec)}
                                slotProps={{
                                  htmlInput: {
                                    spellCheck: false,
                                    autoCorrect: "off",
                                    autoCapitalize: "none",
                                  },
                                }}
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-input": {
                                    color: "#ffffff",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    py: 0.5,
                                    px: 1,
                                  },
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#18181c",
                                    height: 32,
                                    borderRadius: 0.8,
                                    "& fieldset": { borderColor: isActive ? "#3b82f6" : "#27272a" },
                                    "&:hover fieldset": { borderColor: "#3f3f46" },
                                    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                                  },
                                }}
                              />
                            )}
                          </Box>
                        </Card>
                      </Box>
                    );
                  })}
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Dedicated Generate Subtitle Dialog */}
      <GenerateSubtitleModal />
    </Box>
  );
}
