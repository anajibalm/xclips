import React, { useRef, useState, useCallback, useMemo, RefObject } from "react";
import { Box, Typography, Chip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";
import { LayoutMode, AspectRatio, SubtitleStyle } from "@/lib/xclips/types";
import { PhraseSegment, DEFAULT_SUBTITLE_STYLE } from "../types/studio.types";
import { segmentPhrases } from "@/lib/xclips/phrase-segmentation";

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
  const storeProjectId = useStudioStore((s) => s.projectId);
  const project = useStudioStore((s) => s.project);
  const projectId = storeProjectId || project?.id;
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

  const studioAspectRatio = useStudioStore((s) => s.studioAspectRatio);
  const studioLayoutMode = useStudioStore((s) => s.studioLayoutMode);
  const studioPanOffsetX = useStudioStore((s) => s.studioPanOffsetX);
  const studioSubtitleStyle = useStudioStore((s) => s.studioSubtitleStyle);

  const layoutMode: LayoutMode = selectedClip?.layoutMode || studioLayoutMode || "blur_bg";
  const aspectRatio: AspectRatio = selectedClip?.aspectRatio || studioAspectRatio || "9:16";
  const panOffsetX: number = selectedClip?.panOffsetX ?? studioPanOffsetX ?? 0;

  const canvasAspectRatio =
    aspectRatio === "1:1" ? "1/1" :
    aspectRatio === "4:5" ? "4/5" :
    aspectRatio === "16:9" ? "16/9" :
    "9/16";

  const subtitleStyle: SubtitleStyle = selectedClip?.subtitleStyle || studioSubtitleStyle || DEFAULT_SUBTITLE_STYLE;

  // Group raw word timestamps into phrase segments if not supplied
  const phraseSegments = useMemo<PhraseSegment[]>(() => {
    if (externalActivePhrase) return [];
    if (!editableWords || editableWords.length === 0) return [];
    return segmentPhrases(editableWords);
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

  const videoStreamSrc = projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/stream` : undefined;

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
        bgcolor: "#09090c",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        cursor: layoutMode === "center_crop" ? (isDraggingPan ? "grabbing" : "ew-resize") : "default",
      }}
    >
      {/* Canvas Viewport with Dynamic Aspect Ratio */}
      <Box
        sx={{
          position: "relative",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: canvasAspectRatio,
          ...(aspectRatio === "9:16" ? { width: "auto", height: "100%" } : { width: "100%", height: "auto" }),
          bgcolor: "#000000",
          overflow: "hidden",
          borderRadius: 0,
        }}
      >
        {/* MODE 1: BLUR BACKGROUND (Letterbox/Pillarbox foreground + blurred scaled background) */}
        {layoutMode === "blur_bg" && (
          <>
            <video
              ref={bgVideoRef}
              src={videoStreamSrc}
              preload="auto"
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
              preload="auto"
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
                height: "100%",
                objectFit: "contain",
                borderRadius: 0,
                zIndex: 2,
              }}
            />
          </>
        )}

        {/* MODE 2: CENTER CROP (Full bleed with Speaker Pan Offset) */}
        {layoutMode === "center_crop" && (
          <video
            ref={videoRef}
            src={videoStreamSrc}
            preload="auto"
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
            {aspectRatio === "16:9" ? (
              // Side-by-side split screen for 16:9 landscape
              <>
                <video
                  ref={videoRef}
                  src={videoStreamSrc}
                  preload="auto"
                  onTimeUpdate={onTimeUpdate}
                  onEnded={onEnded}
                  muted={isMuted}
                  playsInline
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "50%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${50 + panOffsetX * 35}% center`,
                    zIndex: 2,
                    borderRight: "2px solid #27272a",
                  }}
                />
                <video
                  ref={bgVideoRef}
                  src={videoStreamSrc}
                  preload="auto"
                  muted
                  playsInline
                  onEnded={onEnded}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "50%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center center",
                    zIndex: 2,
                  }}
                />
              </>
            ) : (
              // Stacked top & bottom split screen for 9:16, 1:1, 4:5
              <>
                <video
                  ref={videoRef}
                  src={videoStreamSrc}
                  preload="auto"
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
                  preload="auto"
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
          </>
        )}

        {/* Dynamic ASS Karaoke Subtitle Overlay (Inside Canvas) */}
        {subtitleStyle.enabled !== false && currentActivePhrase && (
          <Box
            sx={{
              position: "absolute",
              bottom: `${Math.max(5, Math.min(90, 100 - (subtitleStyle.positionY || 80)))}%`,
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
                fontFamily: subtitleStyle.fontFamily
                  ? `"${subtitleStyle.fontFamily}", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
                  : '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: `${(subtitleStyle.fontSize ?? 22) * 0.44}px`,
                fontWeight: subtitleStyle.fontFamily === "Inter" || !subtitleStyle.fontFamily ? 700 : 900,
                lineHeight: 1.25,
                textTransform: subtitleStyle.allCaps ? "uppercase" : "none",
                paintOrder: "stroke fill",
                WebkitPaintOrder: "stroke fill",
                WebkitTextStroke:
                  (subtitleStyle.outlineWidth ?? 2.0) > 0
                    ? `${(subtitleStyle.outlineWidth ?? 2.0) * 0.55}px ${subtitleStyle.outlineColor || "#000000"}`
                    : "none",
                filter: "drop-shadow(0px 1.5px 2.5px rgba(0, 0, 0, 0.9))",
                letterSpacing: "0.2px",
                display: "inline-block",
              }}
            >
              {currentActivePhrase.words.map((w, idx) => {
                const isActiveWord = effectiveSubtitleTime >= w.start && effectiveSubtitleTime <= w.end;
                const isKaraokeActive = subtitleStyle.karaokeEnabled !== false && isActiveWord;
                const wordColor = isKaraokeActive
                  ? subtitleStyle.highlightColor || subtitleStyle.secondaryColor || "#FFFFFF"
                  : subtitleStyle.primaryColor || "#FFFFFF";

                return (
                  <span
                    key={`${w.start}_${idx}`}
                    style={{
                      color: wordColor,
                      marginRight: "4px",
                      display: "inline-block",
                      transform: isKaraokeActive ? "scale(1.08)" : "scale(1)",
                      transition: "transform 0.08s ease-out, color 0.08s ease-out",
                      textShadow:
                        isKaraokeActive && subtitleStyle.highlightColor !== "#FFFFFF"
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

      {/* Dynamic Pan Feedback Toast (Only shown when dragging in center_crop mode) */}
      {isDraggingPan && layoutMode === "center_crop" && (
        <Box
          sx={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <Chip
            label={`Pan: ${panOffsetX > 0 ? `+${panOffsetX.toFixed(2)}` : panOffsetX.toFixed(2)}`}
            size="small"
            sx={{
              bgcolor: "rgba(0, 229, 255, 0.9)",
              color: "#000000",
              fontWeight: 800,
              fontSize: "0.72rem",
              backdropFilter: "blur(4px)",
              boxShadow: "0 2px 12px rgba(0, 229, 255, 0.4)",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
