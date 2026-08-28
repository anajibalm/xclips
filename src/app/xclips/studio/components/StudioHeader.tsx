import React from "react";
import Link from "next/link";
import { Box, Typography, Button, IconButton, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SettingsIcon from "@mui/icons-material/Settings";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useStudioStore } from "../store/useStudioStore";
import { formatTime } from "../types/studio.types";

export function StudioHeader() {
  const project = useStudioStore((s) => s.project);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);

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
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
            Duration: {project ? formatTime(project.durationSec) : "00:00"} &bull; {project?.width}x{project?.height} &bull; {project?.frameRate} fps
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SettingsIcon fontSize="small" />}
          onClick={() => setAiSettingsModalOpen(true)}
          sx={{
            borderColor: "#27272a",
            color: "#e4e4e7",
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            borderRadius: 1,
            "&:hover": { borderColor: "#3f3f46", bgcolor: "#141418" },
          }}
        >
          AI Settings ({aiSettings?.provider ? aiSettings.provider.toUpperCase() : "KIE.AI"})
        </Button>

        <Button
          size="small"
          variant="contained"
          startIcon={<FileDownloadIcon fontSize="small" />}
          onClick={() => setActiveTab(4)}
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
