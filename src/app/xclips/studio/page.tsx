"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import PermMediaIcon from "@mui/icons-material/PermMedia";
import TerminalIcon from "@mui/icons-material/Terminal";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { useStudioStore } from "./store/useStudioStore";
import { useVideoPlaybackSync } from "./hooks/useVideoPlaybackSync";
import { StudioHeader } from "./components/StudioHeader";
import { StudioCanvas } from "./components/StudioCanvas";
import { StudioTimeline } from "./components/StudioTimeline";
import { TabAutoclips } from "./tabs/TabAutoclips";
import { TabSubtitles } from "./tabs/TabSubtitles";
import { TabFramingStyle } from "./tabs/TabFramingStyle";
import { TabAssets } from "./tabs/TabAssets";
import { TabExport } from "./tabs/TabExport";
import { TabLogs } from "./tabs/TabLogs";
import { AiSettingsModal } from "./modals/AiSettingsModal";
import { PreviewVideoModal } from "./modals/PreviewVideoModal";
import { PreviewThumbnailModal } from "./modals/PreviewThumbnailModal";
import { PreviewFootageModal } from "./modals/PreviewFootageModal";
import { XclipsProject } from "@/lib/xclips/types";

function StudioContent() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("id") || "";

  const projectId = useStudioStore((s) => s.projectId);
  const loading = useStudioStore((s) => s.loading);
  const clips = useStudioStore((s) => s.clips);
  const activeTab = useStudioStore((s) => s.activeTab);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const actionError = useStudioStore((s) => s.actionError);
  const actionSuccess = useStudioStore((s) => s.actionSuccess);
  const loadProjectData = useStudioStore((s) => s.loadProjectData);

  const [brollPreviewItem, setBrollPreviewItem] = useState<XclipsProject | null>(null);

  const {
    videoRef,
    bgVideoRef,
    containerRef,
    togglePlayPause,
    handleSeek,
    toggleFullscreen,
    handleVideoTimeUpdate,
    handleVideoEnded,
  } = useVideoPlaybackSync();

  useEffect(() => {
    if (projectIdParam && projectIdParam !== projectId) {
      loadProjectData(projectIdParam);
    }
  }, [projectIdParam, projectId, loadProjectData]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#09090c" }}>
        <CircularProgress size={40} sx={{ color: "#3b82f6", mb: 2 }} />
        <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
          Menyiapkan Workspace Studio &amp; Stream Video...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#09090c",
        p: 2,
        boxSizing: "border-box",
        width: "100vw",
      }}
    >
      {/* Top Header */}
      <StudioHeader />

      {/* Global Alerts */}
      {actionError && (
        <Alert severity="error" sx={{ mb: 1, flexShrink: 0, py: 0.2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5" }}>
          {actionError}
        </Alert>
      )}

      {actionSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1, flexShrink: 0, py: 0.2, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }}>
          {actionSuccess}
        </Alert>
      )}

      {/* Dual-Pane Studio Body */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 2,
          overflow: "hidden",
          mt: 1,
        }}
      >
        {/* LEFT PANE: 9:16 PREVIEW & TIMELINE */}
        <Box
          sx={{
            width: { xs: 300, sm: 320, md: 340, lg: 360 },
            flexShrink: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Card
            sx={{
              height: "100%",
              bgcolor: "#141416",
              border: "1px solid #27272a",
              borderRadius: 1,
              p: 0,
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* 1. Header Bar: Player-Timeline 01 */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 2,
                py: 1.1,
                borderBottom: "1px solid #27272a",
                bgcolor: "#18181b",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "#e4e4e7",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                Player-Timeline 01
              </Typography>
            </Box>

            {/* 2. Studio 9:16 Canvas */}
            <StudioCanvas
              videoRef={videoRef}
              bgVideoRef={bgVideoRef}
              containerRef={containerRef}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onTogglePlayPause={togglePlayPause}
            />

            {/* 3. Studio Timeline Scrubber */}
            <StudioTimeline
              onSeek={handleSeek}
              onTogglePlayPause={togglePlayPause}
              onToggleFullscreen={toggleFullscreen}
            />
          </Card>
        </Box>

        {/* RIGHT PANE: TABBED INSPECTOR (Scrollable) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Card
            sx={{
              height: "100%",
              bgcolor: "#121216",
              border: "1px solid #27272a",
              borderRadius: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{
                flexShrink: 0,
                borderBottom: "1px solid #27272a",
                bgcolor: "#0e0e11",
                "& .MuiTab-root": { color: "#71717a", fontWeight: 700, textTransform: "none", py: 1.2, fontSize: "0.82rem" },
                "& .Mui-selected": { color: "#3b82f6" },
              }}
            >
              <Tab label={`Autoclip (${clips.length})`} />
              <Tab label="Subtitles" />
              <Tab label="Style" />
              <Tab icon={<PermMediaIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" label="Assets" />
              <Tab label="Export" />
              <Tab icon={<TerminalIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Logs" />
            </Tabs>

            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                p: 2.5,
                "&:last-child": { pb: 2.5 },
              }}
            >
              {activeTab === 0 && <TabAutoclips />}
              {activeTab === 1 && <TabSubtitles />}
              {activeTab === 2 && <TabFramingStyle />}
              {activeTab === 3 && (
                <TabAssets onPreviewBroll={(item) => setBrollPreviewItem(item)} />
              )}
              {activeTab === 4 && <TabExport />}
              {activeTab === 5 && <TabLogs />}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Global Modals */}
      <AiSettingsModal />
      <PreviewVideoModal />
      <PreviewThumbnailModal />
      <PreviewFootageModal
        item={brollPreviewItem}
        onClose={() => setBrollPreviewItem(null)}
      />
    </Box>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#09090c" }}>
          <CircularProgress size={36} sx={{ color: "#3b82f6" }} />
        </Box>
      }
    >
      <StudioContent />
    </Suspense>
  );
}
