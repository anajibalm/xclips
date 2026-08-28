import React, { useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  TextField,
  InputAdornment,
  FormControlLabel,
  Switch,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import YouTubeIcon from "@mui/icons-material/YouTube";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useStudioStore } from "../store/useStudioStore";
import { useTranscriptVirtualizer } from "../hooks/useTranscriptVirtualizer";
import { formatTime } from "../types/studio.types";

export function TabSubtitles() {
  const virtualScrollRef = useRef<HTMLDivElement>(null);

  const project = useStudioStore((s) => s.project);
  const subtitleOffsetMs = useStudioStore((s) => s.subtitleOffsetMs);
  const setSubtitleOffsetMs = useStudioStore((s) => s.setSubtitleOffsetMs);
  const handleShiftSubtitleOffsetMs = useStudioStore((s) => s.handleShiftSubtitleOffsetMs);
  const handleApplyOffsetPermanently = useStudioStore((s) => s.handleApplyOffsetPermanently);
  const isSavingTranscript = useStudioStore((s) => s.isSavingTranscript);
  const editableWords = useStudioStore((s) => s.editableWords);
  const autoScrollToPlayhead = useStudioStore((s) => s.autoScrollToPlayhead);
  const setAutoScrollToPlayhead = useStudioStore((s) => s.setAutoScrollToPlayhead);
  const handleSaveTranscript = useStudioStore((s) => s.handleSaveTranscript);
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
    effectiveSubtitleTime,
    handleUpdatePhraseText,
    handleReorderPhrases,
    renderHighlightedText,
  } = useTranscriptVirtualizer(virtualScrollRef);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Grid container spacing={2} sx={{ height: "100%", minHeight: 0, flex: 1, alignItems: "stretch" }}>
        {/* LEFT COLUMN: SINKRONISASI KONFIGURASI (COMPACT, SLEEK & PROPORTIONAL) */}
        <Grid size={{ xs: 12, md: 4.2, lg: 3.8 }} sx={{ display: "flex", flexDirection: "column" }}>
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
            {/* Header & Controls */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.2, gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTimeIcon sx={{ color: subtitleOffsetMs !== 0 ? "#f59e0b" : "#3b82f6", fontSize: "1.15rem" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.88rem" }}>
                    Sinkronisasi Subtitle
                  </Typography>
                </Box>
                <Chip
                  label={
                    subtitleOffsetMs === 0
                      ? "Tepat (0 ms)"
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

              {/* Keterangan Sumber Subtitle (YouTube vs Generate AI) */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1,
                  px: 1.2,
                  bgcolor: "#0d0d10",
                  borderRadius: 1,
                  border: "1px solid #27272a",
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  {project?.sourceType === "youtube" ? (
                    <YouTubeIcon sx={{ color: "#ef4444", fontSize: "1.15rem" }} />
                  ) : (
                    <AutoFixHighIcon sx={{ color: "#a855f7", fontSize: "1.05rem" }} />
                  )}
                  <Box>
                    <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.66rem", display: "block", lineHeight: 1 }}>
                      Sumber Subtitle
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#fafafa", fontWeight: 700, fontSize: "0.76rem" }}>
                      {project?.sourceType === "youtube" ? "Subtitle YouTube" : "Hasil Generate AI"}
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  label={project?.sourceType === "youtube" ? "YouTube CC" : "Generate AI"}
                  size="small"
                  sx={{
                    bgcolor: project?.sourceType === "youtube" ? "rgba(239, 68, 68, 0.15)" : "rgba(168, 85, 247, 0.15)",
                    color: project?.sourceType === "youtube" ? "#f87171" : "#c084fc",
                    fontWeight: 800,
                    fontSize: "0.64rem",
                    height: 19,
                    borderRadius: 0.6,
                  }}
                />
              </Box>

              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem", display: "block", mb: 1.5, lineHeight: 1.35 }}>
                Atur pergeseran waktu secara real-time jika subtitle tidak sinkron dengan pembicara.
              </Typography>

              {/* Direct Input Field */}
              <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, fontSize: "0.72rem", mb: 0.5, display: "block" }}>
                Offset Milidetik (ms)
              </Typography>
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
                  mb: 1.5,
                  "& .MuiInputBase-input": {
                    color: subtitleOffsetMs !== 0 ? "#facc15" : "#ffffff",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    fontFamily: "monospace",
                    py: 0.8,
                  },
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "#0d0d10",
                    borderRadius: 1,
                    "& fieldset": { borderColor: subtitleOffsetMs !== 0 ? "#f59e0b" : "#27272a" },
                    "&:hover fieldset": { borderColor: subtitleOffsetMs !== 0 ? "#fbbf24" : "#3f3f46" },
                  },
                }}
              />

              {/* Quick Shift Grid: Maju (Negatif) & Tunda (Positif) */}
              <Typography variant="caption" sx={{ color: "#71717a", fontWeight: 700, fontSize: "0.68rem", mb: 0.6, display: "block", textTransform: "uppercase" }}>
                Pergeseran Cepat
              </Typography>

              {/* Row 1: Maju / -ms (Subtitle Muncul Lebih Awal) */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.6, mb: 0.6 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(-1000)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  -1000 ms
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(-500)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  -500 ms
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(-100)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  -100 ms
                </Button>
              </Box>

              {/* Row 2: Tunda / +ms (Subtitle Ditunda) */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.6, mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(100)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  +100 ms
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(500)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  +500 ms
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleShiftSubtitleOffsetMs(1000)}
                  sx={{ py: 0.3, px: 0.5, fontSize: "0.7rem", borderColor: "#3f3f46", color: "#e4e4e7", textTransform: "none", borderRadius: 0.8, fontWeight: 700 }}
                >
                  +1000 ms
                </Button>
              </Box>

              {/* Reset Button */}
              <Button
                fullWidth
                size="small"
                variant="text"
                onClick={() => setSubtitleOffsetMs(0)}
                disabled={subtitleOffsetMs === 0}
                sx={{ py: 0.3, fontSize: "0.72rem", color: subtitleOffsetMs !== 0 ? "#a1a1aa" : "#52525b", textTransform: "none", fontWeight: 700, mb: 1 }}
              >
                Reset (0 ms)
              </Button>
            </Box>

            {/* Bottom Actions: Terapkan Permanen */}
            <Box sx={{ pt: 1.2, borderTop: "1px solid #27272a" }}>
              <Button
                fullWidth
                variant="contained"
                size="small"
                onClick={handleApplyOffsetPermanently}
                disabled={isSavingTranscript || subtitleOffsetMs === 0}
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
                {isSavingTranscript ? "Menyimpan..." : "Terapkan Permanen"}
              </Button>
              <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.66rem", display: "block", mt: 0.6, textAlign: "center" }}>
                Nilai negatif (-) memajukan subtitle. Terapkan untuk simpan ke database.
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* RIGHT COLUMN: SUBTITLE EDITOR & PHRASE LIST */}
        <Grid size={{ xs: 12, md: 7.8, lg: 8.2 }} sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* Top Bar: Title, Follow Playhead toggle & Save Button */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1, flexShrink: 0 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.92rem" }}>
                Subtitles ({phraseSegments.length} Phrases)
              </Typography>
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
                Klik frasa untuk seek player. Edit teks langsung pada kartu frasa.
              </Typography>
            </Box>

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
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveTranscript}
                disabled={isSavingTranscript || editableWords.length === 0}
                sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800, px: 1.6, py: 0.4, borderRadius: 1, fontSize: "0.76rem" }}
              >
                {isSavingTranscript ? "Saving..." : "Save Subtitles"}
              </Button>
            </Box>
          </Box>

          {/* Search Bar with spellCheck=false */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search words or phrases in transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              mb: 1,
              flexShrink: 0,
              "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: 0.7 },
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
            <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1, flex: 1 }}>
              <RecordVoiceOverIcon sx={{ fontSize: 40, color: "#3f3f46", mb: 1.5 }} />
              <Typography variant="body2" sx={{ color: "#71717a", mb: 2 }}>
                Transcript not generated yet. Go to <strong style={{ color: "#ffffff" }}>Autoclip</strong> tab to transcribe.
              </Typography>
            </Box>
          ) : (
            /* High-Performance Virtualized Container taking full remaining height in right pane */
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
              }}
            >
              {/* Virtual spacer to simulate full scroll height */}
              <Box sx={{ height: itemPositions.totalHeight, width: "100%", position: "relative" }}>
                {filteredPhrases
                  .slice(visibleRange.start, visibleRange.end + 1)
                  .map((seg, sliceIdx) => {
                    const actualIndex = visibleRange.start + sliceIdx;
                    const pos = itemPositions.positions[actualIndex];
                    if (!pos) return null;

                    const isTimeActive = effectiveSubtitleTime >= seg.startSec && effectiveSubtitleTime < (seg.endSec + 0.35);
                    const isActive = isTimeActive;
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
                              : hasSearchMatch
                              ? "1.5px solid rgba(250, 204, 21, 0.6)"
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
                            {/* Drag Handle & Phrase Index Badge */}
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

                            {/* Single-line Text Input with Auto-Seek on Focus */}
                            <TextField
                              fullWidth
                              size="small"
                              variant="outlined"
                              value={seg.text}
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
                                  "& fieldset": { borderColor: isActive ? "#3b82f6" : hasSearchMatch ? "#facc15" : "#27272a" },
                                  "&:hover fieldset": { borderColor: "#3f3f46" },
                                  "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                                },
                              }}
                            />

                            {/* Search Keyword Highlight Preview Tag */}
                            {hasSearchMatch && (
                              <Box
                                sx={{
                                  display: { xs: "none", md: "flex" },
                                  alignItems: "center",
                                  px: 1,
                                  py: 0.2,
                                  bgcolor: "rgba(250, 204, 21, 0.12)",
                                  border: "1px solid rgba(250, 204, 21, 0.4)",
                                  borderRadius: 0.8,
                                  maxWidth: 180,
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  flexShrink: 0,
                                }}
                              >
                                <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#f4f4f5" }}>
                                  {renderHighlightedText(seg.text, searchQuery)}
                                </Typography>
                              </Box>
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
    </Box>
  );
}
