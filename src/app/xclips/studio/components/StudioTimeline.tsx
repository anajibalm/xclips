import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import CheckIcon from "@mui/icons-material/Check";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import { useStudioStore } from "../store/useStudioStore";
import { AspectRatio } from "@/lib/xclips/types";
import { formatTimecodeWithFrames } from "../types/studio.types";

interface StudioTimelineProps {
  onSeek: (timeSec: number) => void;
  onToggleFullscreen?: () => void;
  onTogglePlayPause?: () => void;
}

const RATIO_PRESETS: Array<{ id: AspectRatio; label: string; sub: string }> = [
  { id: "9:16", label: "9:16 Vertical", sub: "TikTok · Reels · Shorts" },
  { id: "1:1", label: "1:1 Square", sub: "Instagram · FB Feed" },
  { id: "4:5", label: "4:5 Portrait", sub: "IG Feed Portrait" },
  { id: "16:9", label: "16:9 Landscape", sub: "YouTube · Desktop" },
];

export function StudioTimeline({ onSeek, onToggleFullscreen, onTogglePlayPause }: StudioTimelineProps) {
  const currentTime = useStudioStore((s) => s.currentTime);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isFullSourceView = useStudioStore((s) => s.isFullSourceView);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const project = useStudioStore((s) => s.project);
  const studioAspectRatio = useStudioStore((s) => s.studioAspectRatio);
  const setStudioAspectRatio = useStudioStore((s) => s.setStudioAspectRatio);
  const volume = useStudioStore((s) => s.volume ?? 100);
  const setVolume = useStudioStore((s) => s.setVolume);
  const isMuted = useStudioStore((s) => s.isMuted);
  const toggleMute = useStudioStore((s) => s.toggleMute);
  const togglePlayPauseStore = useStudioStore((s) => s.togglePlayPause);

  const [ratioMenuAnchor, setRatioMenuAnchor] = useState<null | HTMLElement>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const togglePlay = onTogglePlayPause || togglePlayPauseStore;
  const currentRatio: AspectRatio = selectedClip?.aspectRatio || studioAspectRatio || "9:16";

  const minTime = !isFullSourceView && selectedClip ? selectedClip.startSec : 0;
  const maxTime = !isFullSourceView && selectedClip ? selectedClip.endSec : project?.durationSec || 100;

  const handleSelectRatio = (ratio: AspectRatio) => {
    setRatioMenuAnchor(null);
    setStudioAspectRatio(ratio);
  };

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
        value={Math.max(minTime, Math.min(maxTime, currentTime || minTime))}
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
        {/* Left Side: Play/Pause Button, Timecodes */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
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

          {/* Timecode */}
          <Typography
            variant="caption"
            sx={{
              color: "#00e5ff",
              fontFamily: "sans-serif",
              fontWeight: 600,
              fontSize: "0.68rem",
              letterSpacing: "0.01em",
              ml: 0.2,
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
        </Box>

        {/* Right Side: Volume Control, Aspect Ratio Selector Button, Fullscreen Icon */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          {/* Interactive Volume Control with Vertical Popup Slider */}
          <Box
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
            sx={{ display: "flex", alignItems: "center", position: "relative" }}
          >
            <Tooltip title={isMuted ? "Unmute" : `Volume: ${volume}%`}>
              <IconButton
                size="small"
                onClick={toggleMute}
                sx={{
                  color: isMuted ? "#ef4444" : volume > 0 ? "#a1a1aa" : "#71717a",
                  p: 0.3,
                  "&:hover": { color: "#00e5ff", transform: "scale(1.1)" },
                  transition: "all 0.15s ease",
                }}
              >
                {isMuted || volume === 0 ? (
                  <VolumeOffIcon sx={{ fontSize: "1.1rem" }} />
                ) : volume < 50 ? (
                  <VolumeDownIcon sx={{ fontSize: "1.1rem" }} />
                ) : (
                  <VolumeUpIcon sx={{ fontSize: "1.1rem" }} />
                )}
              </IconButton>
            </Tooltip>

            {/* Vertical Volume Slider Popup (Minimal) */}
            {showVolumeSlider && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  mb: 0.8,
                  px: 0.8,
                  py: 1.2,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.85)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: 84,
                  zIndex: 20,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Slider
                  orientation="vertical"
                  size="small"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(_, val) => {
                    if (isMuted) toggleMute();
                    setVolume(val as number);
                  }}
                  sx={{
                    color: "#00e5ff",
                    width: 3,
                    py: 0,
                    "& .MuiSlider-thumb": {
                      width: 10,
                      height: 10,
                      bgcolor: "#00e5ff",
                      "&:hover, &.Mui-focusVisible": {
                        boxShadow: "0 0 0 5px rgba(0, 229, 255, 0.2)",
                      },
                    },
                    "& .MuiSlider-rail": {
                      bgcolor: "#27272a",
                      opacity: 1,
                    },
                    "& .MuiSlider-track": {
                      bgcolor: "#00e5ff",
                    },
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Aspect Ratio Badge */}
          <Box
            onClick={(e) => setRatioMenuAnchor(e.currentTarget)}
            sx={{
              border: "1px solid #3f3f46",
              borderRadius: "3px",
              px: "6px",
              py: "1px",
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "#e4e4e7",
              bgcolor: "#18181b",
              cursor: "pointer",
              userSelect: "none",
              fontFamily: "sans-serif",
              transition: "all 0.15s ease",
              "&:hover": {
                borderColor: "#00e5ff",
                color: "#00e5ff",
                bgcolor: "rgba(0, 229, 255, 0.08)",
              },
            }}
          >
            {currentRatio}
          </Box>

          {/* Aspect Ratio Popover Menu */}
          <Menu
            anchorEl={ratioMenuAnchor}
            open={Boolean(ratioMenuAnchor)}
            onClose={() => setRatioMenuAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
            slotProps={{
              paper: {
                sx: {
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1,
                  minWidth: 180,
                  py: 0.5,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                },
              },
            }}
          >
            {RATIO_PRESETS.map((preset) => {
              const isSelected = currentRatio === preset.id;
              return (
                <MenuItem
                  key={preset.id}
                  onClick={() => handleSelectRatio(preset.id)}
                  sx={{
                    py: 0.6,
                    px: 1.5,
                    bgcolor: isSelected ? "rgba(0, 229, 255, 0.1)" : "transparent",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "0.78rem",
                            fontWeight: isSelected ? 800 : 500,
                            color: isSelected ? "#00e5ff" : "#fafafa",
                          }}
                        >
                          {preset.label}
                        </Typography>
                        {isSelected && <CheckIcon sx={{ fontSize: "0.95rem", color: "#00e5ff" }} />}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#71717a", display: "block" }}>
                        {preset.sub}
                      </Typography>
                    }
                  />
                </MenuItem>
              );
            })}
          </Menu>

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
