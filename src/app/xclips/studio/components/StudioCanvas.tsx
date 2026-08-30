import React, { useRef, useState, useCallback, useMemo, useEffect, RefObject } from "react";
import { Box, Typography, Chip, Tooltip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import OpenWithIcon from "@mui/icons-material/OpenWith";
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
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const isMuted = useStudioStore((s) => s.isMuted);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const togglePlayPauseStore = useStudioStore((s) => s.togglePlayPause);
  const handleSaveClip = useStudioStore((s) => s.handleSaveClip);
  const saveActiveClipNow = useStudioStore((s) => s.saveActiveClipNow);
  const saveMasterTemplateNow = useStudioStore((s) => s.saveMasterTemplateNow);
  const setStudioSubtitleStyle = useStudioStore((s) => s.setStudioSubtitleStyle);

  const internalContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = externalContainerRef || internalContainerRef;
  const viewportRef = useRef<HTMLDivElement>(null);

  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialPanX, setInitialPanX] = useState(0);

  const togglePlay = onTogglePlayPause || togglePlayPauseStore;

  const studioAspectRatio = useStudioStore((s) => s.studioAspectRatio);
  const studioLayoutMode = useStudioStore((s) => s.studioLayoutMode);
  const studioPanOffsetX = useStudioStore((s) => s.studioPanOffsetX);
  const setStudioPanOffsetX = useStudioStore((s) => s.setStudioPanOffsetX);
  const studioVideoScale = useStudioStore((s) => s.studioVideoScale);
  const setStudioVideoScale = useStudioStore((s) => s.setStudioVideoScale);
  const studioVideoPanX = useStudioStore((s) => s.studioVideoPanX);
  const setStudioVideoPanX = useStudioStore((s) => s.setStudioVideoPanX);
  const studioVideoPanY = useStudioStore((s) => s.studioVideoPanY);
  const setStudioVideoPanY = useStudioStore((s) => s.setStudioVideoPanY);
  const studioVideoRotation = useStudioStore((s) => s.studioVideoRotation);
  const setStudioVideoRotation = useStudioStore((s) => s.setStudioVideoRotation);
  const studioSubtitleStyle = useStudioStore((s) => s.studioSubtitleStyle);

  const aspectRatio: AspectRatio = selectedClip?.aspectRatio || studioAspectRatio || "9:16";
  const layoutMode: LayoutMode = selectedClip?.layoutMode || studioLayoutMode || "blur_bg";
  const panOffsetX: number = selectedClip?.panOffsetX ?? studioPanOffsetX ?? 0;
  const videoScale: number = selectedClip?.videoScale ?? studioVideoScale ?? 1.0;
  const videoPanX: number = selectedClip?.videoPanX ?? selectedClip?.panOffsetX ?? studioVideoPanX ?? 0;
  const videoPanY: number = selectedClip?.videoPanY ?? studioVideoPanY ?? 0;
  const videoRotation: number = selectedClip?.videoRotation ?? studioVideoRotation ?? 0;

  const canvasAspectRatio =
    aspectRatio === "1:1" ? "1/1" :
    aspectRatio === "4:5" ? "4/5" :
    aspectRatio === "16:9" ? "16/9" :
    "9/16";

  const subtitleStyle: SubtitleStyle = selectedClip?.subtitleStyle || studioSubtitleStyle || DEFAULT_SUBTITLE_STYLE;

  const updateActiveVideoTransform = useCallback(
    (updates: { videoScale?: number; videoPanX?: number; videoPanY?: number; videoRotation?: number }) => {
      if (updates.videoScale !== undefined) setStudioVideoScale(updates.videoScale);
      if (updates.videoPanX !== undefined) {
        setStudioVideoPanX(updates.videoPanX);
        setStudioPanOffsetX(updates.videoPanX);
      }
      if (updates.videoPanY !== undefined) setStudioVideoPanY(updates.videoPanY);
      if (updates.videoRotation !== undefined) setStudioVideoRotation(updates.videoRotation);
    },
    [setStudioVideoScale, setStudioVideoPanX, setStudioPanOffsetX, setStudioVideoPanY, setStudioVideoRotation]
  );

  // Auto-pause video when interacting with subtitle gizmo
  const ensurePaused = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    if (bgVideoRef.current && !bgVideoRef.current.paused) {
      bgVideoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying, videoRef, bgVideoRef]);

  // 1. Calculate base reference virtual stage dimensions (e.g. 1080x1920 for 9:16)
  const virtualDims = useMemo<{ width: number; height: number }>(() => {
    switch (aspectRatio) {
      case "1:1":
        return { width: 1080, height: 1080 };
      case "4:5":
        return { width: 1080, height: 1350 };
      case "16:9":
        return { width: 1920, height: 1080 };
      case "9:16":
      default:
        return { width: 1080, height: 1920 };
    }
  }, [aspectRatio]);

  // Calculate active foreground video dimensions in virtual stage (e.g. 1080x607.5 for 16:9 in 9:16 blur_bg)
  const activeFgDims = useMemo<{ width: number; height: number }>(() => {
    if (layoutMode === "blur_bg") {
      const sourceAspect =
        project?.width && project?.height && project.width > 0 && project.height > 0
          ? project.width / project.height
          : 16 / 9;
      const stageAspect = virtualDims.width / virtualDims.height;
      if (sourceAspect >= stageAspect) {
        const w = virtualDims.width;
        const h = w / sourceAspect;
        return { width: w, height: h };
      } else {
        const h = virtualDims.height;
        const w = h * sourceAspect;
        return { width: w, height: h };
      }
    }
    return { width: virtualDims.width, height: virtualDims.height };
  }, [layoutMode, project, virtualDims]);

  // 2. Dynamic uniform scale factor computed from rendered container size via ResizeObserver
  const [scaleFactor, setScaleFactor] = useState<number>(0.25);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const computeScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const sx = rect.width / virtualDims.width;
        const sy = rect.height / virtualDims.height;
        const factor = Math.min(sx, sy);
        if (factor > 0 && !isNaN(factor)) {
          setScaleFactor(factor);
        }
      }
    };

    computeScale();
    const ro = new ResizeObserver(computeScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualDims]);

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

  // Active phrase at current playhead position
  const liveActivePhrase =
    externalActivePhrase !== undefined
      ? externalActivePhrase
      : phraseSegments.find(
          (p) => effectiveSubtitleTime >= p.startSec && effectiveSubtitleTime <= (p.endSec + 0.35)
        );

  // Fallback phrase logic:
  // - While playing: only display when words are actively spoken (or fade on silence)
  // - While paused or editing subtitle style: fallback to closest phrase or preview sample so user can always see/edit it!
  const currentActivePhrase = useMemo<PhraseSegment | undefined>(() => {
    if (liveActivePhrase) return liveActivePhrase;
    if (isPlaying) return undefined;

    // Paused fallback: Find phrase closest to current playhead
    if (phraseSegments.length > 0) {
      const nearest =
        phraseSegments.find(
          (p) => effectiveSubtitleTime >= (p.startSec - 1.5) && effectiveSubtitleTime <= (p.endSec + 1.5)
        ) ||
        phraseSegments.find((p) => p.startSec >= effectiveSubtitleTime) ||
        phraseSegments[phraseSegments.length - 1];
      return nearest;
    }

    // Default sample phrase if transcript hasn't been created yet
    return {
      id: "preview_sample",
      index: 0,
      startSec: 0,
      endSec: 3,
      text: "CONTOH SUBTITLE VIRAL HOOK",
      words: [
        { word: "CONTOH", start: 0, end: 0.8, confidence: 1, isFiller: false, excluded: false },
        { word: "SUBTITLE", start: 0.8, end: 1.6, confidence: 1, isFiller: false, excluded: false },
        { word: "VIRAL", start: 1.6, end: 2.2, confidence: 1, isFiller: false, excluded: false },
        { word: "HOOK", start: 2.2, end: 3.0, confidence: 1, isFiller: false, excluded: false },
      ],
    };
  }, [liveActivePhrase, isPlaying, phraseSegments, effectiveSubtitleTime]);

  // Layer Selection State
  const [selectedLayer, setSelectedLayer] = useState<"none" | "subtitle" | "video">("none");

  // 3. Subtitle Transform Gizmo Interaction States
  const isSubtitleSelected = selectedLayer === "subtitle";
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false);
  const [isRotatingGizmo, setIsRotatingGizmo] = useState(false);
  const [isResizingGizmo, setIsResizingGizmo] = useState(false);
  const [isWidthResizingGizmo, setIsWidthResizingGizmo] = useState(false);
  const widthResizeSideRef = useRef<"left" | "right">("right");

  // 4. Video Transform Gizmo Interaction States
  const isVideoSelected = selectedLayer === "video";
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [isRotatingVideo, setIsRotatingVideo] = useState(false);
  const [isResizingVideo, setIsResizingVideo] = useState(false);

  // Video Magnet Snapping States (Center Pan X 0, Pan Y 0, Rotation 0/90/180)
  const [isVideoSnappedX, setIsVideoSnappedX] = useState(false);
  const [isVideoSnappedY, setIsVideoSnappedY] = useState(false);
  const [isVideoSnappedRot, setIsVideoSnappedRot] = useState(false);

  const videoGizmoRef = useRef({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
    initialScale: 1.0,
    initialRot: 0,
    centerX: 0,
    centerY: 0,
    initialDist: 100,
  });

  // Magnet Snapping States (Center X 50% & Y 50% / 80%)
  const [isSnappedX, setIsSnappedX] = useState(false);
  const [isSnappedY, setIsSnappedY] = useState(false);
  const [snappedYTarget, setSnappedYTarget] = useState<number | null>(null);

  const gizmoStateRef = useRef({
    startX: 0,
    startY: 0,
    initialPosX: 50,
    initialPosY: 80,
    initialRot: 0,
    initialFontSize: 44,
    initialBoxWidth: 85,
    boxCenterX: 0,
    boxCenterY: 0,
    initialDist: 100,
  });

  const updateActiveSubtitleStyle = useCallback(
    (newStyle: SubtitleStyle) => {
      setStudioSubtitleStyle(newStyle);
    },
    [setStudioSubtitleStyle]
  );

  // Drag Gizmo Box (Move Position X & Position Y with Magnet Center Snapping)
  const handleGizmoPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setSelectedLayer("subtitle");
    setIsDraggingGizmo(true);
    gizmoStateRef.current = {
      ...gizmoStateRef.current,
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: subtitleStyle.positionX ?? 50,
      initialPosY: subtitleStyle.positionY ?? 80,
      initialRot: subtitleStyle.rotation ?? 0,
      initialFontSize: subtitleStyle.fontSize ?? 44,
      initialBoxWidth: subtitleStyle.boxWidth ?? 85,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleGizmoPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingGizmo) return;
    e.stopPropagation();
    const deltaClientX = e.clientX - gizmoStateRef.current.startX;
    const deltaClientY = e.clientY - gizmoStateRef.current.startY;
    const deltaVirtualX = deltaClientX / scaleFactor;
    const deltaVirtualY = deltaClientY / scaleFactor;

    const deltaPctX = (deltaVirtualX / virtualDims.width) * 100;
    const deltaPctY = (deltaVirtualY / virtualDims.height) * 100;

    let rawPosX = gizmoStateRef.current.initialPosX + deltaPctX;
    let rawPosY = gizmoStateRef.current.initialPosY + deltaPctY;

    // Magnet Center Snapping: Sumbu X (50% Center ±2.5%)
    let snappedX = false;
    if (Math.abs(rawPosX - 50) <= 2.5) {
      rawPosX = 50;
      snappedX = true;
    }
    setIsSnappedX(snappedX);

    // Magnet Center Snapping: Sumbu Y (50% True Center & 80% Lower-Third ±2.5%)
    let snappedY = false;
    let snapTargetY: number | null = null;
    if (Math.abs(rawPosY - 50) <= 2.5) {
      rawPosY = 50;
      snappedY = true;
      snapTargetY = 50;
    } else if (Math.abs(rawPosY - 80) <= 2.5) {
      rawPosY = 80;
      snappedY = true;
      snapTargetY = 80;
    }
    setIsSnappedY(snappedY);
    setSnappedYTarget(snapTargetY);

    const newPosX = Math.max(0, Math.min(100, Math.round(rawPosX)));
    const newPosY = Math.max(0, Math.min(100, Math.round(rawPosY)));

    updateActiveSubtitleStyle({
      ...subtitleStyle,
      positionX: newPosX,
      positionY: newPosY,
    });
  };

  const handleGizmoPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingGizmo) return;
    setIsDraggingGizmo(false);
    setIsSnappedX(false);
    setIsSnappedY(false);
    setSnappedYTarget(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Rotation Knob (Rotate Z Angle in degrees)
  const handleRotationPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setIsRotatingGizmo(true);
    const gizmoBox = e.currentTarget.closest(".subtitle-gizmo-box");
    if (gizmoBox) {
      const rect = gizmoBox.getBoundingClientRect();
      gizmoStateRef.current.boxCenterX = rect.left + rect.width / 2;
      gizmoStateRef.current.boxCenterY = rect.top + rect.height / 2;
    }
    gizmoStateRef.current.initialRot = subtitleStyle.rotation ?? 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleRotationPointerMove = (e: React.PointerEvent) => {
    if (!isRotatingGizmo) return;
    e.stopPropagation();
    const dx = e.clientX - gizmoStateRef.current.boxCenterX;
    const dy = e.clientY - gizmoStateRef.current.boxCenterY;
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = Math.round(angleRad * (180 / Math.PI) + 90);
    while (angleDeg > 180) angleDeg -= 360;
    while (angleDeg < -180) angleDeg += 360;

    updateActiveSubtitleStyle({
      ...subtitleStyle,
      rotation: angleDeg,
    });
  };

  const handleRotationPointerUp = (e: React.PointerEvent) => {
    if (!isRotatingGizmo) return;
    setIsRotatingGizmo(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Corner Resize Handle (Scale Font Size via radial distance from box center)
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setIsResizingGizmo(true);
    const gizmoBox = e.currentTarget.closest(".subtitle-gizmo-box");
    if (gizmoBox) {
      const rect = gizmoBox.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      gizmoStateRef.current.boxCenterX = cx;
      gizmoStateRef.current.boxCenterY = cy;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      gizmoStateRef.current.initialDist = Math.max(10, dist);
    }
    gizmoStateRef.current.initialFontSize = subtitleStyle.fontSize ?? 44;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingGizmo) return;
    e.stopPropagation();
    const currentDist = Math.hypot(
      e.clientX - gizmoStateRef.current.boxCenterX,
      e.clientY - gizmoStateRef.current.boxCenterY
    );
    const ratio = currentDist / Math.max(10, gizmoStateRef.current.initialDist);
    const newFontSize = Math.max(12, Math.min(180, Math.round(gizmoStateRef.current.initialFontSize * ratio)));

    updateActiveSubtitleStyle({
      ...subtitleStyle,
      fontSize: newFontSize,
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!isResizingGizmo) return;
    setIsResizingGizmo(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Middle-Side Handles (Drag to adjust Custom Box Width)
  const handleWidthResizePointerDown = (side: "left" | "right") => (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setIsWidthResizingGizmo(true);
    widthResizeSideRef.current = side;
    gizmoStateRef.current.startX = e.clientX;
    gizmoStateRef.current.initialBoxWidth = subtitleStyle.boxWidth ?? 85;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleWidthResizePointerMove = (e: React.PointerEvent) => {
    if (!isWidthResizingGizmo) return;
    e.stopPropagation();
    const deltaClientX = e.clientX - gizmoStateRef.current.startX;
    const deltaVirtualX = deltaClientX / scaleFactor;
    const multiplier = widthResizeSideRef.current === "right" ? 2 : -2;
    const deltaPct = (deltaVirtualX / virtualDims.width) * 100 * multiplier;
    const newWidth = Math.max(20, Math.min(100, Math.round(gizmoStateRef.current.initialBoxWidth + deltaPct)));

    updateActiveSubtitleStyle({
      ...subtitleStyle,
      boxWidthMode: "custom",
      boxWidth: newWidth,
    });
  };

  const handleWidthResizePointerUp = (e: React.PointerEvent) => {
    if (!isWidthResizingGizmo) return;
    setIsWidthResizingGizmo(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Video Transform Handlers (Pan, Scale Zoom, Rotate)
  const handleVideoGizmoPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setSelectedLayer("video");
    setIsDraggingVideo(true);
    videoGizmoRef.current = {
      ...videoGizmoRef.current,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: videoPanX,
      initialPanY: videoPanY,
      initialScale: videoScale,
      initialRot: videoRotation,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleVideoGizmoPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingVideo) return;
    e.stopPropagation();
    const deltaClientX = e.clientX - videoGizmoRef.current.startX;
    const deltaClientY = e.clientY - videoGizmoRef.current.startY;
    const deltaVirtualX = deltaClientX / scaleFactor;
    const deltaVirtualY = deltaClientY / scaleFactor;

    const deltaPanX = deltaVirtualX / (virtualDims.width * 0.4);
    const deltaPanY = deltaVirtualY / (virtualDims.height * 0.4);

    let rawPanX = videoGizmoRef.current.initialPanX + deltaPanX;
    let rawPanY = videoGizmoRef.current.initialPanY + deltaPanY;

    // Magnet Center snapping for video (±0.04 tolerance for X and Y)
    let snappedX = false;
    if (Math.abs(rawPanX) <= 0.04) {
      rawPanX = 0;
      snappedX = true;
    }
    setIsVideoSnappedX(snappedX);

    let snappedY = false;
    if (Math.abs(rawPanY) <= 0.04) {
      rawPanY = 0;
      snappedY = true;
    }
    setIsVideoSnappedY(snappedY);

    const newPanX = Math.max(-1.0, Math.min(1.0, Number(rawPanX.toFixed(3))));
    const newPanY = Math.max(-1.0, Math.min(1.0, Number(rawPanY.toFixed(3))));

    updateActiveVideoTransform({
      videoPanX: newPanX,
      videoPanY: newPanY,
    });
  };

  const handleVideoGizmoPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingVideo) return;
    setIsDraggingVideo(false);
    setIsVideoSnappedX(false);
    setIsVideoSnappedY(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Video Rotation Knob
  const handleVideoRotationPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setIsRotatingVideo(true);
    const gizmoBox = e.currentTarget.closest(".video-gizmo-box");
    if (gizmoBox) {
      const rect = gizmoBox.getBoundingClientRect();
      videoGizmoRef.current.centerX = rect.left + rect.width / 2;
      videoGizmoRef.current.centerY = rect.top + rect.height / 2;
    }
    videoGizmoRef.current.initialRot = videoRotation;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleVideoRotationPointerMove = (e: React.PointerEvent) => {
    if (!isRotatingVideo) return;
    e.stopPropagation();
    const dx = e.clientX - videoGizmoRef.current.centerX;
    const dy = e.clientY - videoGizmoRef.current.centerY;
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = Math.round(angleRad * (180 / Math.PI) + 90);
    while (angleDeg > 180) angleDeg -= 360;
    while (angleDeg < -180) angleDeg += 360;

    // Magnet snapping for rotation (0°, 90°, -90°, 180° ±4° tolerance)
    let snappedRot = false;
    if (Math.abs(angleDeg) <= 4) {
      angleDeg = 0;
      snappedRot = true;
    } else if (Math.abs(angleDeg - 90) <= 4) {
      angleDeg = 90;
      snappedRot = true;
    } else if (Math.abs(angleDeg + 90) <= 4) {
      angleDeg = -90;
      snappedRot = true;
    } else if (Math.abs(angleDeg - 180) <= 4 || Math.abs(angleDeg + 180) <= 4) {
      angleDeg = 180;
      snappedRot = true;
    }
    setIsVideoSnappedRot(snappedRot);

    updateActiveVideoTransform({
      videoRotation: angleDeg,
    });
  };

  const handleVideoRotationPointerUp = (e: React.PointerEvent) => {
    if (!isRotatingVideo) return;
    setIsRotatingVideo(false);
    setIsVideoSnappedRot(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Video Corner Scale Handle (Radial Scale / Zoom)
  const handleVideoScalePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    ensurePaused();
    setIsResizingVideo(true);
    const gizmoBox = e.currentTarget.closest(".video-gizmo-box");
    if (gizmoBox) {
      const rect = gizmoBox.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      videoGizmoRef.current.centerX = cx;
      videoGizmoRef.current.centerY = cy;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      videoGizmoRef.current.initialDist = Math.max(10, dist);
    }
    videoGizmoRef.current.initialScale = videoScale;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleVideoScalePointerMove = (e: React.PointerEvent) => {
    if (!isResizingVideo) return;
    e.stopPropagation();
    const currentDist = Math.hypot(
      e.clientX - videoGizmoRef.current.centerX,
      e.clientY - videoGizmoRef.current.centerY
    );
    const ratio = currentDist / Math.max(10, videoGizmoRef.current.initialDist);
    let newScale = Number((videoGizmoRef.current.initialScale * ratio).toFixed(2));
    // Snap to 1.0 (100% zoom) within ±0.04
    if (Math.abs(newScale - 1.0) <= 0.04) newScale = 1.0;
    newScale = Math.max(0.5, Math.min(3.0, newScale));

    updateActiveVideoTransform({
      videoScale: newScale,
    });
  };

  const handleVideoScalePointerUp = (e: React.PointerEvent) => {
    if (!isResizingVideo) return;
    setIsResizingVideo(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  // Pan interaction for center_crop
  const handlePointerDownPan = (e: React.PointerEvent) => {
    if (layoutMode !== "center_crop") return;
    setIsDraggingPan(true);
    setDragStartX(e.clientX);
    setInitialPanX(panOffsetX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMovePan = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingPan || layoutMode !== "center_crop") return;
      const deltaX = e.clientX - dragStartX;
      const sensitivity = 0.003;
      const rawPan = initialPanX + deltaX * sensitivity;
      const clampedPan = Math.max(-1.0, Math.min(1.0, Math.round(rawPan * 100) / 100));

      setStudioPanOffsetX(clampedPan);
    },
    [isDraggingPan, layoutMode, dragStartX, initialPanX, setStudioPanOffsetX]
  );

  const handlePointerUpPan = (e: React.PointerEvent) => {
    if (!isDraggingPan) return;
    setIsDraggingPan(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveActiveClipNow();
  };

  const videoStreamSrc = projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/stream` : undefined;

  return (
    <Box
      ref={canvasContainerRef}
      onClick={() => setSelectedLayer("none")}
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
        cursor: layoutMode === "center_crop" && isDraggingPan ? "grabbing" : "default",
      }}
    >
      {/* Viewport Box (Bounded Aspect Ratio Window) */}
      <Box
        ref={viewportRef}
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
        {/* VIRTUAL CANVAS STAGE (Fixed 1080x1920 virtual resolution scaled by scaleFactor) */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: `${virtualDims.width}px`,
            height: `${virtualDims.height}px`,
            transform: `translate(-50%, -50%) scale(${scaleFactor})`,
            transformOrigin: "center center",
            overflow: "hidden",
            bgcolor: "#000000",
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
                onPlay={(e) => {
                  e.currentTarget.muted = true;
                  e.currentTarget.volume = 0;
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  ensurePaused();
                  setSelectedLayer("video");
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: `${activeFgDims.width}px`,
                  height: `${activeFgDims.height}px`,
                  objectFit: "contain",
                  transform: `translate(calc(-50% + ${videoPanX * 35}%), calc(-50% + ${videoPanY * 35}%)) scale(${videoScale}) rotate(${videoRotation}deg)`,
                  transformOrigin: "center center",
                  borderRadius: 0,
                  zIndex: 2,
                  cursor: "pointer",
                }}
              />
            </>
          )}

          {/* MODE 2: CENTER CROP (Full bleed with Speaker Pan Offset & Transform) */}
          {layoutMode === "center_crop" && (
            <video
              ref={videoRef}
              src={videoStreamSrc}
              preload="auto"
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              muted={isMuted}
              playsInline
              onClick={(e) => {
                e.stopPropagation();
                ensurePaused();
                setSelectedLayer("video");
              }}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `translate(calc(-50% + ${videoPanX * 35}%), calc(-50% + ${videoPanY * 35}%)) scale(${videoScale}) rotate(${videoRotation}deg)`,
                transformOrigin: "center center",
                zIndex: 2,
                cursor: "pointer",
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
                    onClick={(e) => {
                      e.stopPropagation();
                      ensurePaused();
                      setSelectedLayer("video");
                    }}
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
                      cursor: "pointer",
                    }}
                  />
                  <video
                    ref={bgVideoRef}
                    src={videoStreamSrc}
                    preload="auto"
                    muted
                    playsInline
                    onEnded={onEnded}
                    onPlay={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      ensurePaused();
                      setSelectedLayer("video");
                    }}
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
                      cursor: "pointer",
                    }}
                  />
                  <video
                    ref={bgVideoRef}
                    src={videoStreamSrc}
                    preload="auto"
                    muted
                    playsInline
                    onEnded={onEnded}
                    onPlay={(e) => {
                      e.currentTarget.muted = true;
                      e.currentTarget.volume = 0;
                    }}
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

          {/* VIDEO TRANSFORM GIZMO (CYAN FRAME) */}
          {isVideoSelected && (
            <Box
              className="video-gizmo-box"
              onClick={(e) => {
                e.stopPropagation();
                ensurePaused();
                setSelectedLayer("video");
              }}
              onPointerDown={handleVideoGizmoPointerDown}
              onPointerMove={handleVideoGizmoPointerMove}
              onPointerUp={handleVideoGizmoPointerUp}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: `${activeFgDims.width}px`,
                height: `${activeFgDims.height}px`,
                transform: `translate(calc(-50% + ${videoPanX * 35}%), calc(-50% + ${videoPanY * 35}%)) scale(${videoScale}) rotate(${videoRotation}deg)`,
                transformOrigin: "center center",
                border: "2.5px dashed #00e5ff",
                boxShadow: "0 0 16px rgba(0, 229, 255, 0.35)",
                pointerEvents: "auto",
                cursor: isDraggingVideo ? "grabbing" : "move",
                zIndex: 7,
              }}
            >
              {/* Rotation Knob */}
              <Tooltip title="Drag to Rotate Video" placement="top">
                <Box
                  onPointerDown={handleVideoRotationPointerDown}
                  onPointerMove={handleVideoRotationPointerMove}
                  onPointerUp={handleVideoRotationPointerUp}
                  sx={{
                    position: "absolute",
                    top: -42,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    bgcolor: "#00e5ff",
                    border: "2.5px solid #ffffff",
                    cursor: isRotatingVideo ? "grabbing" : "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.8)",
                    zIndex: 20,
                    "&:after": {
                      content: '""',
                      position: "absolute",
                      top: 27,
                      left: 12,
                      width: 2,
                      height: 15,
                      bgcolor: "#00e5ff",
                    },
                  }}
                >
                  <RotateRightIcon sx={{ fontSize: "1rem", color: "#000000" }} />
                </Box>
              </Tooltip>

              {/* Corner Scale Handles */}
              {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => {
                const isTop = pos.includes("top");
                const isLeft = pos.includes("left");
                return (
                  <Box
                    key={pos}
                    onPointerDown={handleVideoScalePointerDown}
                    onPointerMove={handleVideoScalePointerMove}
                    onPointerUp={handleVideoScalePointerUp}
                    sx={{
                      position: "absolute",
                      top: isTop ? -8 : "auto",
                      bottom: !isTop ? -8 : "auto",
                      left: isLeft ? -8 : "auto",
                      right: !isLeft ? -8 : "auto",
                      width: 16,
                      height: 16,
                      borderRadius: "3px",
                      bgcolor: "#ffffff",
                      border: "3px solid #00e5ff",
                      cursor: isTop === isLeft ? "nwse-resize" : "nesw-resize",
                      zIndex: 20,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                    }}
                  />
                );
              })}

              {/* Video Transform HUD Tag with Magnet Snapping Highlights */}
              <Box
                sx={{
                  position: "absolute",
                  top: 14,
                  left: "50%",
                  transform: "translateX(-50%)",
                  bgcolor: "rgba(0, 0, 0, 0.9)",
                  color: isVideoSnappedX || isVideoSnappedY || isVideoSnappedRot ? "#00e5ff" : "#38bdf8",
                  border: isVideoSnappedX || isVideoSnappedY || isVideoSnappedRot ? "1px solid #00e5ff" : "1px solid rgba(0, 229, 255, 0.4)",
                  boxShadow: isVideoSnappedX || isVideoSnappedY || isVideoSnappedRot ? "0 0 12px rgba(0, 229, 255, 0.5)" : "none",
                  borderRadius: 1,
                  px: 1.2,
                  py: 0.3,
                  fontSize: "13px",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                Video: {Math.round(videoScale * 100)}% Zoom | X: {Math.round(videoPanX * 100)}%{isVideoSnappedX ? " (Center)" : ""} | Y: {Math.round(videoPanY * 100)}%{isVideoSnappedY ? " (Center)" : ""} | {videoRotation}°{isVideoSnappedRot ? " (Snap)" : ""}
              </Box>
            </Box>
          )}

          {/* DYNAMIC SUBTITLE OVERLAY WITH INTERACTIVE TRANSFORM GIZMO */}
          {subtitleStyle.enabled !== false && currentActivePhrase && (
            <Box
              className="subtitle-gizmo-box"
              onClick={(e) => {
                e.stopPropagation();
                ensurePaused();
                setSelectedLayer("subtitle");
              }}
              onPointerDown={handleGizmoPointerDown}
              onPointerMove={handleGizmoPointerMove}
              onPointerUp={handleGizmoPointerUp}
              sx={{
                position: "absolute",
                left: `${subtitleStyle.positionX ?? 50}%`,
                top: `${subtitleStyle.positionY ?? 80}%`,
                transform: `translate(-50%, -50%) rotate(${subtitleStyle.rotation ?? 0}deg)`,
                transformOrigin: "center center",
                zIndex: 10,
                userSelect: "none",
                cursor: isDraggingGizmo ? "grabbing" : "move",
                p: "12px 20px",
                width: subtitleStyle.boxWidthMode === "custom" ? `${subtitleStyle.boxWidth ?? 85}%` : "fit-content",
                maxWidth: `${virtualDims.width * 0.96}px`,
                display: "inline-block",
                textAlign: "center",
                border: isSubtitleSelected ? "3px dashed #3b82f6" : "3px dashed transparent",
                borderRadius: 2,
                bgcolor: isSubtitleSelected ? "rgba(59, 130, 246, 0.08)" : "transparent",
                transition: isDraggingGizmo || isRotatingGizmo || isResizingGizmo || isWidthResizingGizmo ? "none" : "border-color 0.15s ease",
                "&:hover": {
                  border: "3px dashed rgba(59, 130, 246, 0.6)",
                },
              }}
            >
              {/* SUBTITLE TYPOGRAPHY (Rendered in 1080x1920 virtual pixel space) */}
              <Typography
                component="div"
                sx={{
                  fontFamily: subtitleStyle.fontFamily
                    ? `"${subtitleStyle.fontFamily}", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
                    : '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: `${Math.max(20, subtitleStyle.fontSize ?? 44)}px`,
                  fontWeight: subtitleStyle.fontFamily === "Inter" || !subtitleStyle.fontFamily ? 700 : 900,
                  lineHeight: 1.25,
                  textTransform: subtitleStyle.allCaps || subtitleStyle.textCase === "uppercase" ? "uppercase" : subtitleStyle.textCase === "lowercase" ? "lowercase" : "none",
                  paintOrder: "stroke fill",
                  WebkitPaintOrder: "stroke fill",
                  WebkitTextStroke:
                    (subtitleStyle.outlineWidth ?? 2.0) > 0
                      ? `${subtitleStyle.outlineWidth ?? 2.0}px ${subtitleStyle.outlineColor || "#000000"}`
                      : "none",
                  filter: "drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.9))",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  pointerEvents: "none",
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
                        marginRight: "10px",
                        display: "inline-block",
                        transform: isKaraokeActive ? "scale(1.08)" : "scale(1)",
                        transition: "transform 0.08s ease-out, color 0.08s ease-out",
                        textShadow:
                          isKaraokeActive && subtitleStyle.highlightColor !== "#FFFFFF"
                            ? `0 0 24px ${subtitleStyle.highlightColor || "#FACC15"}, 0 4px 8px #000000`
                            : undefined,
                      }}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </Typography>

              {/* GIZMO CONTROLS: ROTATION KNOB & CONNECTOR */}
              {isSubtitleSelected && (
                <>
                  <Tooltip title="Drag to Rotate Subtitle" placement="top">
                    <Box
                      onPointerDown={handleRotationPointerDown}
                      onPointerMove={handleRotationPointerMove}
                      onPointerUp={handleRotationPointerUp}
                      sx={{
                        position: "absolute",
                        top: -50,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        bgcolor: "#3b82f6",
                        border: "3px solid #ffffff",
                        cursor: isRotatingGizmo ? "grabbing" : "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                        zIndex: 20,
                        "&:after": {
                          content: '""',
                          position: "absolute",
                          top: 29,
                          left: 13,
                          width: 2,
                          height: 20,
                          bgcolor: "#3b82f6",
                        },
                      }}
                    >
                      <RotateRightIcon sx={{ fontSize: "1.1rem", color: "#ffffff" }} />
                    </Box>
                  </Tooltip>

                  {/* Corner Resize Handles */}
                  {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => {
                    const isTop = pos.includes("top");
                    const isLeft = pos.includes("left");
                    return (
                      <Box
                        key={pos}
                        onPointerDown={handleResizePointerDown}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        sx={{
                          position: "absolute",
                          top: isTop ? -8 : "auto",
                          bottom: !isTop ? -8 : "auto",
                          left: isLeft ? -8 : "auto",
                          right: !isLeft ? -8 : "auto",
                          width: 16,
                          height: 16,
                          borderRadius: "3px",
                          bgcolor: "#ffffff",
                          border: "3px solid #3b82f6",
                          cursor: isTop === isLeft ? "nwse-resize" : "nesw-resize",
                          zIndex: 20,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                        }}
                      />
                    );
                  })}

                  {/* Middle-Left and Middle-Right Width Resize Handles */}
                  <Tooltip title="Drag to adjust custom box width" placement="left">
                    <Box
                      onPointerDown={handleWidthResizePointerDown("left")}
                      onPointerMove={handleWidthResizePointerMove}
                      onPointerUp={handleWidthResizePointerUp}
                      sx={{
                        position: "absolute",
                        left: -9,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 14,
                        height: 28,
                        borderRadius: "4px",
                        bgcolor: "#3b82f6",
                        border: "2px solid #ffffff",
                        cursor: "ew-resize",
                        zIndex: 25,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="Drag to adjust custom box width" placement="right">
                    <Box
                      onPointerDown={handleWidthResizePointerDown("right")}
                      onPointerMove={handleWidthResizePointerMove}
                      onPointerUp={handleWidthResizePointerUp}
                      sx={{
                        position: "absolute",
                        right: -9,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 14,
                        height: 28,
                        borderRadius: "4px",
                        bgcolor: "#3b82f6",
                        border: "2px solid #ffffff",
                        cursor: "ew-resize",
                        zIndex: 25,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                      }}
                    />
                  </Tooltip>

                  {/* Position & Width HUD Tag with Magnet Snapping Highlights */}
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: -32,
                      left: "50%",
                      transform: "translateX(-50%)",
                      bgcolor: "rgba(0, 0, 0, 0.9)",
                      color: isSnappedX || isSnappedY ? "#00e5ff" : "#60a5fa",
                      border: isSnappedX || isSnappedY ? "1px solid #00e5ff" : "1px solid rgba(59, 130, 246, 0.4)",
                      boxShadow: isSnappedX || isSnappedY ? "0 0 10px rgba(0, 229, 255, 0.5)" : "none",
                      borderRadius: 1,
                      px: 1.2,
                      py: 0.3,
                      fontSize: "14px",
                      fontWeight: 800,
                      fontFamily: "monospace",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    X: {subtitleStyle.positionX ?? 50}%{isSnappedX ? " (Center)" : ""} | Y: {subtitleStyle.positionY ?? 80}%{isSnappedY ? (snappedYTarget === 50 ? " (Center)" : " (Lower-3rd)") : ""} | {subtitleStyle.rotation ?? 0}° | W: {subtitleStyle.boxWidthMode === "custom" ? `${subtitleStyle.boxWidth ?? 85}%` : "Auto"}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* MAGNET CENTER SNAPPING GUIDELINES (Cyan Laser Alignment with Glow) */}
          {isDraggingGizmo && isSnappedX && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "2px",
                bgcolor: "#00e5ff",
                boxShadow: "0 0 12px #00e5ff, 0 0 24px rgba(0, 229, 255, 0.7)",
                zIndex: 8,
                pointerEvents: "none",
              }}
            />
          )}

          {isDraggingGizmo && isSnappedY && snappedYTarget !== null && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${snappedYTarget}%`,
                transform: "translateY(-50%)",
                height: "2px",
                bgcolor: "#00e5ff",
                boxShadow: "0 0 12px #00e5ff, 0 0 24px rgba(0, 229, 255, 0.7)",
                zIndex: 8,
                pointerEvents: "none",
              }}
            />
          )}

          {/* MAGNET VIDEO SNAPPING GUIDELINES (Cyan Laser Alignment with Glow) */}
          {isDraggingVideo && isVideoSnappedX && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "2px",
                bgcolor: "#00e5ff",
                boxShadow: "0 0 12px #00e5ff, 0 0 24px rgba(0, 229, 255, 0.7)",
                zIndex: 8,
                pointerEvents: "none",
              }}
            />
          )}

          {isDraggingVideo && isVideoSnappedY && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                height: "2px",
                bgcolor: "#00e5ff",
                boxShadow: "0 0 12px #00e5ff, 0 0 24px rgba(0, 229, 255, 0.7)",
                zIndex: 8,
                pointerEvents: "none",
              }}
            />
          )}
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
            icon={<OpenWithIcon sx={{ fontSize: "0.85rem !important", color: "#000000 !important" }} />}
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
