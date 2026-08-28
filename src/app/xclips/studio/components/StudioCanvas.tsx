import React, { useRef, useState, useCallback, useMemo, RefObject } from "react";
import { Box, Typography, IconButton, Chip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CropFreeIcon from "@mui/icons-material/CropFree";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";
import { LayoutMode, SubtitleStyle } from "@/lib/xclips/types";
import { PhraseSegment } from "../types/studio.types";

interface StudioCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  bgVideoRef: RefObject<HTMLVideoElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onTogglePlayPause?: () => void;
  currentActivePhrase?: PhraseSegment | undefined;
  effectiveSubtitleTime?: number;
}

export function StudioCanvas({
  videoRef,
  bgVideoRef,
  containerRef: externalContainerRef,
  onTimeUpdate,
  onEnded,
  onTogglePlayPause,
  currentActivePhrase: externalActivePhrase,
  effectiveSubtitleTime: externalEffectiveSubtitleTime,
}: StudioCanvasProps) {
  const projectId = useStudioStore((s) => s.projectId);
  const currentTime = useStudioStore((s) => s.currentTime);
  const subtitleOffsetMs = useStudioStore((s) => s.subtitleOffsetMs);
  const editableWords = useStudioStore((s) => s.editableWords);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isMuted = useStudioStore((s) => s.isMuted);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const togglePlayPauseStore = useStudioStore((s) => s.togglePlayPause);
  const handleSaveClip = useStudioStore((s) => s.handleSaveClip);

  const internalContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = externalContainerRef || internalContainerRef;

  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialPanX, setInitialPanX] = useState(0);

  const togglePlay = onTogglePlayPause || togglePlayPauseStore;

  const layoutMode: LayoutMode = selectedClip?.layoutMode || "blur_bg";
  const panOffsetX: number = selectedClip?.panOffsetX || 0;
  const subtitleStyle: SubtitleStyle = selectedClip?.subtitleStyle || {
    enabled: true,
    preset: "plain",
    fontFamily: "Anton",
    fontSize: 48,
    primaryColor: "#FFFFFF",
    secondaryColor: "#FACC15",
    highlightColor: "#FACC15",
    outlineColor: "#000000",
    outlineWidth: 3.5,
    boxColor: "#000000",
    boxOpacity: 0.0,
    karaokeEnabled: true,
    allCaps: true,
    textCase: "uppercase",
    autoEmoji: false,
    positionY: 80,
  };

  // Group raw word timestamps into phrase segments if not supplied
  const phraseSegments = useMemo<PhraseSegment[]>(() => {
    if (externalActivePhrase) return [];
    if (!editableWords || editableWords.length === 0) return [];

    const segments: PhraseSegment[] = [];
    let currentWords = [];
    let segIdx = 0;

    for (let i = 0; i < editableWords.length; i++) {
      const w = editableWords[i];
      currentWords.push(w);

      const isPunctuationEnd = /[.?!,;:]$/.test(w.word.trim());
      const isMaxWords = currentWords.length >= 6;
      const nextWord = editableWords[i + 1];
      const isTimeGap = nextWord && (nextWord.start - w.end) > 0.8;

      if (isPunctuationEnd || isMaxWords || isTimeGap || i === editableWords.length - 1) {
        const startSec = currentWords[0].start;
        const endSec = currentWords[currentWords.length - 1].end;
        const text = currentWords.map((cw) => cw.word).join(" ");

        segments.push({
          id: `seg_${segIdx}_${startSec.toFixed(2)}`,
          index: segIdx,
          startSec,
          endSec,
          text,
          words: [...currentWords],
        });

        currentWords = [];
        segIdx++;
      }
    }

    return segments;
  }, [editableWords, externalActivePhrase]);

  const effectiveSubtitleTime =
    externalEffectiveSubtitleTime !== undefined
      ? externalEffectiveSubtitleTime
      : currentTime - subtitleOffsetMs / 1000;

  const currentActivePhrase =
    externalActivePhrase !== undefined
      ? externalActivePhrase
      : phraseSegments.find(
          (p) => effectiveSubtitleTime >= p.startSec && effectiveSubtitleTime <= (p.endSec + 0.35)
        );

  const handlePointerDownPan = (e: React.PointerEvent) => {
    if (layoutMode !== "center_crop") return;
    setIsDraggingPan(true);
    setDragStartX(e.clientX);
    setInitialPanX(panOffsetX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMovePan = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingPan || layoutMode !== "center_crop" || !selectedClip) return;
      const deltaX = e.clientX - dragStartX;
      const sensitivity = 0.003;
      const rawPan = initialPanX + deltaX * sensitivity;
      const clampedPan = Math.max(-1.0, Math.min(1.0, Math.round(rawPan * 100) / 100));

      if (clampedPan !== selectedClip.panOffsetX) {
        handleSaveClip({
          ...selectedClip,
          panOffsetX: clampedPan,
        });
      }
    },
    [isDraggingPan, layoutMode, selectedClip, dragStartX, initialPanX, handleSaveClip]
  );

  const handlePointerUpPan = (e: React.PointerEvent) => {
    if (!isDraggingPan) return;
    setIsDraggingPan(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const toggleLayoutMode = () => {
    if (!selectedClip) return;
    const modes: LayoutMode[] = ["blur_bg", "center_crop", "split_screen"];
    const currentIdx = modes.indexOf(layoutMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    handleSaveClip({
      ...selectedClip,
      layoutMode: nextMode,
    });
  };

  const toggleFullscreen = () => {
    if (!canvasContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      canvasContainerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const videoStreamSrc = projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/stream` : "";

  return (
    <Box
      ref={canvasContainerRef}
      onPointerDown={handlePointerDownPan}
      onPointerMove={handlePointerMovePan}
      onPointerUp={handlePointerUpPan}
      onPointerCancel={handlePointerUpPan}
      sx={{
        position: "relative",
        width: "100%",
        flex: 1,
        minHeight: 0,
        bgcolor: "#000000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        cursor: layoutMode === "center_crop" ? (isDraggingPan ? "grabbing" : "ew-resize") : "default",
      }}
    >
      {/* 9:16 Canvas Viewport */}
      <Box
        sx={{
          position: "relative",
          height: "100%",
          aspectRatio: "9/16",
          bgcolor: "#000000",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* MODE 1: BLUR BACKGROUND (Letterbox foreground + blurred scaled background) */}
        {layoutMode === "blur_bg" && (
          <>
            <video
              ref={bgVideoRef}
              src={videoStreamSrc}
              muted
              playsInline
              onEnded={onEnded}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(24px) brightness(0.65)",
                transform: "scale(1.25)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <video
              ref={videoRef}
              src={videoStreamSrc}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              muted={isMuted}
              playsInline
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "100%",
                maxHeight: "56%",
                objectFit: "contain",
                borderRadius: 6,
                boxShadow: "0 6px 24px rgba(0,0,0,0.9)",
                zIndex: 2,
              }}
            />
          </>
        )}

        {/* MODE 2: CENTER CROP (Full bleed 9:16 with Speaker Pan Offset) */}
        {layoutMode === "center_crop" && (
          <video
            ref={videoRef}
            src={videoStreamSrc}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            muted={isMuted}
            playsInline
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${50 + panOffsetX * 40}% center`,
              zIndex: 2,
            }}
          />
        )}

        {/* MODE 3: SPLIT SCREEN */}
        {layoutMode === "split_screen" && (
          <>
            <video
              ref={videoRef}
              src={videoStreamSrc}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              muted={isMuted}
              playsInline
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "50%",
                objectFit: "cover",
                objectPosition: `${50 + panOffsetX * 35}% center`,
                zIndex: 2,
                borderBottom: "2px solid #27272a",
              }}
            />
            <video
              ref={bgVideoRef}
              src={videoStreamSrc}
              muted
              playsInline
              onEnded={onEnded}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: "50%",
                objectFit: "cover",
                objectPosition: "center center",
                zIndex: 2,
              }}
            />
          </>
        )}

        {/* Flat White Play / Pause Overlay Icon (Opacity: 30%, Hover: 45%) */}
        <Box
          onClick={togglePlay}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            bgcolor: "transparent",
            "&:hover .canvas-play-btn": {
              opacity: isPlaying ? 0.35 : 0.5,
              transform: "scale(1.08)",
            },
          }}
        >
          <Box
            className="canvas-play-btn"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(4px)",
              opacity: isPlaying ? 0 : 0.3,
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            {isPlaying ? (
              <PauseIcon sx={{ color: "#ffffff", fontSize: "2rem" }} />
            ) : (
              <PlayArrowIcon sx={{ color: "#ffffff", fontSize: "2.2rem", ml: 0.3 }} />
            )}
          </Box>
        </Box>
      </Box>

      {/* Top Left Status Badge */}
      <Box sx={{ position: "absolute", top: 12, left: 12, zIndex: 5, display: "flex", gap: 0.8 }}>
        <Chip
          label={layoutMode.replace("_", " ").toUpperCase()}
          size="small"
          sx={{
            bgcolor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "0.65rem",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        />
        {layoutMode === "center_crop" && panOffsetX !== 0 && (
          <Chip
            label={`Pan ${panOffsetX > 0 ? `+${panOffsetX}` : panOffsetX}`}
            size="small"
            sx={{
              bgcolor: "rgba(59,130,246,0.6)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "0.65rem",
            }}
          />
        )}
      </Box>

      {/* Top Right Controls */}
      <Box sx={{ position: "absolute", top: 10, right: 10, zIndex: 5, display: "flex", gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={toggleLayoutMode}
          title="Ganti Layout Mode (Blur / Center Crop / Split)"
          sx={{
            bgcolor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            color: "#ffffff",
            p: 0.6,
            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
          }}
        >
          <CropFreeIcon fontSize="small" />
        </IconButton>

        <IconButton
          size="small"
          onClick={toggleFullscreen}
          title="Fullscreen Canvas"
          sx={{
            bgcolor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            color: "#ffffff",
            p: 0.6,
            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
          }}
        >
          <FullscreenIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Dynamic ASS Karaoke Subtitle Overlay */}
      {subtitleStyle.enabled !== false && currentActivePhrase && (
        <Box
          sx={{
            position: "absolute",
            bottom: "16%",
            left: "6%",
            right: "6%",
            textAlign: "center",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <Typography
            component="div"
            sx={{
              fontFamily: subtitleStyle.fontFamily || "Anton",
              fontSize: `${(subtitleStyle.fontSize || 48) * 0.44}px`,
              fontWeight: 900,
              lineHeight: 1.15,
              textTransform: subtitleStyle.allCaps ? "uppercase" : "none",
              WebkitTextStroke: `${(subtitleStyle.outlineWidth || 3.5) * 0.4}px ${subtitleStyle.outlineColor || "#000000"}`,
              textShadow: `0 0 4px ${subtitleStyle.outlineColor || "#000000"}`,
              letterSpacing: "0.5px",
            }}
          >
            {currentActivePhrase.words.map((w, idx) => {
              const isActiveWord =
                effectiveSubtitleTime >= w.start && effectiveSubtitleTime <= w.end;
              const wordColor = isActiveWord
                ? subtitleStyle.highlightColor || subtitleStyle.secondaryColor || "#FACC15"
                : subtitleStyle.primaryColor || "#FFFFFF";

              return (
                <span
                  key={`${w.start}_${idx}`}
                  style={{
                    color: wordColor,
                    marginRight: "4px",
                    display: "inline-block",
                    transform: isActiveWord ? "scale(1.08)" : "scale(1)",
                    transition: "transform 0.08s ease-out, color 0.08s ease-out",
                    textShadow:
                      isActiveWord
                        ? `0 0 12px ${subtitleStyle.highlightColor || "#FACC15"}, 0 2px 4px #000000`
                        : undefined,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
