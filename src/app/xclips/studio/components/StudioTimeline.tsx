import React from "react";
import { Box, Typography, IconButton, Slider, Tooltip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useStudioStore } from "../store/useStudioStore";
import { formatTimecodeWithFrames } from "../types/studio.types";

interface StudioTimelineProps {
  onSeek: (timeSec: number) => void;
  onToggleFullscreen?: () => void;
  onTogglePlayPause?: () => void;
}

export function StudioTimeline({ onSeek, onToggleFullscreen, onTogglePlayPause }: StudioTimelineProps) {
  const currentTime = useStudioStore((s) => s.currentTime);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isFullSourceView = useStudioStore((s) => s.isFullSourceView);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const project = useStudioStore((s) => s.project);
  const togglePlayPauseStore = useStudioStore((s) => s.togglePlayPause);

  const togglePlay = onTogglePlayPause || togglePlayPauseStore;

  const minTime = !isFullSourceView && selectedClip ? selectedClip.startSec : 0;
  const maxTime = !isFullSourceView && selectedClip ? selectedClip.endSec : project?.durationSec || 100;

  return (
    <Box
      sx={{
        width: "100%",
        px: 1.5,
        pt: 0.5,
        pb: 1,
        borderTop: "1px solid #27272a",
        bgcolor: "#141416",
        flexShrink: 0,
      }}
    >
      {/* Slim Cyan Scrubber */}
      <Slider
        size="small"
        min={minTime}
        max={maxTime}
        step={0.05}
        value={currentTime}
        onChange={(_, val) => onSeek(val as number)}
        sx={{
          color: "#00e5ff",
          height: 2.5,
          py: 0.8,
          mb: 0.4,
          "& .MuiSlider-thumb": {
            width: 10,
            height: 10,
            bgcolor: "#00e5ff",
            "&:hover, &.Mui-focusVisible": {
              boxShadow: "0 0 0 6px rgba(0, 229, 255, 0.2)",
            },
          },
          "& .MuiSlider-rail": {
            bgcolor: "#27272a",
            opacity: 1,
          },
        }}
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Left Side: Timecode + Layout Stream + Play/Pause */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
          <Typography
            variant="caption"
            sx={{
              color: "#00e5ff",
              fontFamily: "sans-serif",
              fontWeight: 600,
              fontSize: "0.68rem",
              letterSpacing: "0.01em",
            }}
          >
            {formatTimecodeWithFrames(currentTime)}
          </Typography>

          <Typography variant="caption" sx={{ color: "#71717a", fontFamily: "sans-serif", fontSize: "0.68rem" }}>
            /
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: "#a1a1aa",
              fontFamily: "sans-serif",
              fontWeight: 500,
              fontSize: "0.68rem",
              letterSpacing: "0.01em",
            }}
          >
            {formatTimecodeWithFrames(selectedClip ? selectedClip.endSec : project?.durationSec || 0)}
          </Typography>

          <IconButton
            size="small"
            onClick={togglePlay}
            sx={{
              color: "#ffffff",
              p: 0.3,
              "&:hover": { color: "#00e5ff", transform: "scale(1.1)" },
              transition: "all 0.15s ease",
            }}
          >
            {isPlaying ? <PauseIcon sx={{ fontSize: "1.25rem" }} /> : <PlayArrowIcon sx={{ fontSize: "1.25rem" }} />}
          </IconButton>
        </Box>

        {/* Right Side: 9:16 Badge, Fullscreen Icon */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <Tooltip title="Vertical Aspect Ratio 9:16">
            <Box
              sx={{
                border: "1px solid #3f3f46",
                borderRadius: "3px",
                px: "5px",
                py: "1px",
                fontSize: "0.65rem",
                fontWeight: 600,
                color: "#71717a",
                bgcolor: "#18181b",
                cursor: "default",
                userSelect: "none",
                fontFamily: "sans-serif",
              }}
            >
              9:16
            </Box>
          </Tooltip>

          {/* Fullscreen Icon */}
          <Tooltip title="Fullscreen">
            <IconButton
              size="small"
              onClick={() => onToggleFullscreen && onToggleFullscreen()}
              sx={{ color: "#71717a", p: 0.3, "&:hover": { color: "#00e5ff" } }}
            >
              <FullscreenIcon sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
