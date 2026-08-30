import React from "react";
import Link from "next/link";
import { Box, Typography, Button, IconButton, Chip, Tooltip, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import { useStudioStore } from "../store/useStudioStore";
import { formatTime } from "../types/studio.types";

export function StudioHeader() {
  const project = useStudioStore((s) => s.project);
  const setExportModalOpen = useStudioStore((s) => s.setExportModalOpen);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const fetchAiSettings = useStudioStore((s) => s.fetchAiSettings);
  const autoSaveStatus = useStudioStore((s) => s.autoSaveStatus);

  return (
    <Box
      sx={{
        px: 3,
        py: 1.2,
        bgcolor: "#09090b",
        borderBottom: "1px solid #27272a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Link href="/xclips" style={{ textDecoration: "none" }}>
          <IconButton size="small" sx={{ color: "#a1a1aa", "&:hover": { color: "#ffffff", bgcolor: "#18181b" } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Link>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.95rem" }}>
              {project?.name || "Studio Project"}
            </Typography>
            <Chip
              label={project?.sourceType?.toUpperCase() || "LOCAL"}
              size="small"
              sx={{
                bgcolor: "#1e1e24",
                color: "#a1a1aa",
                fontWeight: 700,
                fontSize: "0.65rem",
                height: 20,
                borderRadius: 0.6,
              }}
            />
            {/* Real-Time AutoSave Status Badge */}
            {autoSaveStatus === "saving" && (
              <Chip
                icon={<CircularProgress size={10} sx={{ color: "#38bdf8 !important" }} />}
                label="Saving..."
                size="small"
                sx={{
                  bgcolor: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  height: 20,
                  borderRadius: 0.6,
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                }}
              />
            )}
            {autoSaveStatus === "saved" && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: "0.85rem !important", color: "#22c55e !important" }} />}
                label="Saved"
                size="small"
                sx={{
                  bgcolor: "rgba(34, 197, 94, 0.12)",
                  color: "#4ade80",
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  height: 20,
                  borderRadius: 0.6,
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              />
            )}
            {autoSaveStatus === "error" && (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: "0.85rem !important", color: "#ef4444 !important" }} />}
                label="Save Failed"
                size="small"
                sx={{
                  bgcolor: "rgba(239, 68, 68, 0.12)",
                  color: "#f87171",
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  height: 20,
                  borderRadius: 0.6,
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
            Duration: {project ? formatTime(project.durationSec) : "00:00"} &bull; {project?.width}x{project?.height} &bull; {project?.frameRate} fps
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title="Configure AI Provider & Settings" arrow>
          <IconButton
            size="small"
            onClick={() => {
              fetchAiSettings();
              setAiSettingsModalOpen(true);
            }}
            sx={{
              color: "#a1a1aa",
              bgcolor: "#141418",
              border: "1px solid #27272a",
              borderRadius: 1,
              p: 0.8,
              "&:hover": { color: "#3b82f6", bgcolor: "#1e1e24", borderColor: "#3f3f46" },
            }}
          >
            <SettingsIcon sx={{ fontSize: "1.1rem" }} />
          </IconButton>
        </Tooltip>

        <Button
          size="small"
          variant="contained"
          startIcon={<FileDownloadIcon fontSize="small" />}
          onClick={() => setExportModalOpen(true)}
          sx={{
            bgcolor: "#3b82f6",
            color: "#ffffff",
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 700,
            borderRadius: 1,
            "&:hover": { bgcolor: "#2563eb" },
          }}
        >
          Export
        </Button>
      </Box>
    </Box>
  );
}
