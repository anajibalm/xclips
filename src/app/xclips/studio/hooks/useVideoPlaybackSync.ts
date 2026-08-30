import { useEffect, useRef, useCallback } from "react";
import { useStudioStore } from "../store/useStudioStore";

export function useVideoPlaybackSync() {
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const setCurrentTime = useStudioStore((s) => s.setCurrentTime);
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const project = useStudioStore((s) => s.project);
  const aiSettingsModalOpen = useStudioStore((s) => s.aiSettingsModalOpen);
  const previewVideoOpen = useStudioStore((s) => s.previewVideoOpen);
  const previewThumbnailOpen = useStudioStore((s) => s.previewThumbnailOpen);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const prevClipIdRef = useRef<string | null>(null);
  const lastStateTimeRef = useRef<number>(0);
  const selectedClipRef = useRef(selectedClip);
  selectedClipRef.current = selectedClip;
  const projectDurationRef = useRef(project?.durationSec || 0);
  projectDurationRef.current = project?.durationSec || 0;

  // Toggle Play / Pause
  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, [setIsPlaying]);

  const volume = useStudioStore((s) => s.volume);
  const isMuted = useStudioStore((s) => s.isMuted);

  // Synchronize HTML5 video element with play/pause state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
    if (bgVideoRef.current) {
      if (isPlaying) {
        bgVideoRef.current.play().catch(() => {});
      } else {
        bgVideoRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  // Synchronize HTML5 video element with volume and mute state (Hard isolate bgVideo)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100));
      videoRef.current.muted = isMuted;
    }
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.volume = 0;
    }
  }, [volume, isMuted]);

  // Auto-pause playback when document is hidden or window loses focus
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      if (document.hidden) {
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.pause();
        if (bgVideoRef.current) bgVideoRef.current.pause();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    window.addEventListener("blur", handleVisibilityOrBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      window.removeEventListener("blur", handleVisibilityOrBlur);
    };
  }, [setIsPlaying]);

  // Synchronize time when selected clip changes (memoized on ID)
  useEffect(() => {
    if (selectedClip && selectedClip.id !== prevClipIdRef.current) {
      prevClipIdRef.current = selectedClip.id;
      if (videoRef.current) videoRef.current.currentTime = selectedClip.startSec;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = selectedClip.startSec;
      setCurrentTime(selectedClip.startSec);
    }
  }, [selectedClip?.id, selectedClip?.startSec, setCurrentTime]);

  // Global Keyboard Shortcut: Spacebar to toggle Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }
      if (document.activeElement?.getAttribute("contenteditable") === "true") {
        return;
      }
      if (aiSettingsModalOpen || previewVideoOpen || previewThumbnailOpen) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiSettingsModalOpen, previewVideoOpen, previewThumbnailOpen, setIsPlaying]);

  // High-frequency playhead synchronization via throttled requestAnimationFrame (~15 FPS React state ticks)
  useEffect(() => {
    if (!isPlaying) return;
    let animationFrameId: number;

    const syncLoop = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const t = videoRef.current.currentTime;
        const currentClip = selectedClipRef.current;
        const dur = projectDurationRef.current;

        if (currentClip) {
          if (t >= currentClip.endSec) {
            videoRef.current.currentTime = currentClip.startSec;
            if (bgVideoRef.current) bgVideoRef.current.currentTime = currentClip.startSec;
            setCurrentTime(currentClip.startSec);
            lastStateTimeRef.current = currentClip.startSec;
          } else if (t < currentClip.startSec) {
            videoRef.current.currentTime = currentClip.startSec;
            if (bgVideoRef.current) bgVideoRef.current.currentTime = currentClip.startSec;
            setCurrentTime(currentClip.startSec);
            lastStateTimeRef.current = currentClip.startSec;
          } else if (Math.abs(t - lastStateTimeRef.current) >= 0.06) {
            lastStateTimeRef.current = t;
            setCurrentTime(t);
          }
        } else if (dur > 0 && t >= dur) {
          videoRef.current.currentTime = 0;
          if (bgVideoRef.current) bgVideoRef.current.currentTime = 0;
          setCurrentTime(0);
          lastStateTimeRef.current = 0;
        } else if (Math.abs(t - lastStateTimeRef.current) >= 0.06) {
          lastStateTimeRef.current = t;
          setCurrentTime(t);
        }
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };

    animationFrameId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, setCurrentTime]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    const currentClip = selectedClipRef.current;
    const dur = projectDurationRef.current;

    if (currentClip) {
      if (t >= currentClip.endSec) {
        videoRef.current.currentTime = currentClip.startSec;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = currentClip.startSec;
        setCurrentTime(currentClip.startSec);
      } else if (t < currentClip.startSec) {
        videoRef.current.currentTime = currentClip.startSec;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = currentClip.startSec;
        setCurrentTime(currentClip.startSec);
      }
    } else if (dur > 0 && t >= dur) {
      videoRef.current.currentTime = 0;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, [setCurrentTime]);

  const handleVideoEnded = useCallback(() => {
    const start = selectedClip ? selectedClip.startSec : 0;
    if (videoRef.current) videoRef.current.currentTime = start;
    if (bgVideoRef.current) bgVideoRef.current.currentTime = start;
    setCurrentTime(start);
    if (isPlaying) {
      videoRef.current?.play().catch(() => {});
      bgVideoRef.current?.play().catch(() => {});
    }
  }, [selectedClip, isPlaying, setCurrentTime]);

  const handleSeek = useCallback((timeSec: number) => {
    setCurrentTime(timeSec);
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
    }
    if (bgVideoRef.current) {
      bgVideoRef.current.currentTime = timeSec;
    }
  }, [setCurrentTime]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  return {
    videoRef,
    bgVideoRef,
    containerRef,
    togglePlayPause,
    handleSeek,
    toggleFullscreen,
    handleVideoTimeUpdate,
    handleVideoEnded,
  };
}
