import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Divider,
  LinearProgress,
  Alert,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useStudioStore } from "../store/useStudioStore";

export function TabExport() {
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const renderStatus = useStudioStore((s) => s.renderStatus);
  const renderProgress = useStudioStore((s) => s.renderProgress);
  const handleRender = useStudioStore((s) => s.handleRender);

  const [exportResolution, setExportResolution] = useState<"1080x1920" | "720x1280" | "2160x3840">("1080x1920");
  const [exportBitrate, setExportBitrate] = useState<"8M" | "5M" | "3M">("8M");
  const [exportFormat, setExportFormat] = useState<"mp4" | "mov">("mp4");

  if (!selectedClip) {
    return (
      <Typography variant="body2" sx={{ color: "#71717a", py: 4, textAlign: "center" }}>
        Select a clip in the Autoclip tab first to configure export settings.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 0.5, fontSize: "0.95rem" }}>
        Export Video (9:16)
      </Typography>
      <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 2.5 }}>
        Configure resolution, bitrate, and container format for the final render.
      </Typography>

      {/* Option 1: Output Resolution */}
      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
        Output Resolution
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        {[
          { id: "1080x1920", label: "1080x1920 (9:16 FHD)" },
          { id: "720x1280", label: "720x1280 (9:16 HD)" },
          { id: "2160x3840", label: "2160x3840 (4K UHD)" },
        ].map((res) => (
          <Button
            key={res.id}
            variant={exportResolution === res.id ? "contained" : "outlined"}
            size="small"
            onClick={() => setExportResolution(res.id as "1080x1920" | "720x1280" | "2160x3840")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              borderRadius: 1,
              bgcolor: exportResolution === res.id ? "#3b82f6" : "transparent",
              borderColor: exportResolution === res.id ? "#3b82f6" : "#27272a",
              color: exportResolution === res.id ? "#ffffff" : "#a1a1aa",
              "&:hover": { borderColor: "#3f3f46" },
            }}
          >
            {res.label}
          </Button>
        ))}
      </Box>

      {/* Option 2: Target Bitrate */}
      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
        Target Bitrate
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
        {[
          { id: "8M", label: "High (8 Mbps)" },
          { id: "5M", label: "Medium (5 Mbps)" },
          { id: "3M", label: "Draft (3 Mbps)" },
        ].map((br) => (
          <Button
            key={br.id}
            variant={exportBitrate === br.id ? "contained" : "outlined"}
            size="small"
            onClick={() => setExportBitrate(br.id as "8M" | "5M" | "3M")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              borderRadius: 1,
              bgcolor: exportBitrate === br.id ? "#3b82f6" : "transparent",
              borderColor: exportBitrate === br.id ? "#3b82f6" : "#27272a",
              color: exportBitrate === br.id ? "#ffffff" : "#a1a1aa",
              "&:hover": { borderColor: "#3f3f46" },
            }}
          >
            {br.label}
          </Button>
        ))}
      </Box>

      {/* Option 3: Video Format */}
      <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8 }}>
        Container Format
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
        {[
          { id: "mp4", label: "MP4 (H.264 + AAC)" },
          { id: "mov", label: "MOV (ProRes)" },
        ].map((fmt) => (
          <Button
            key={fmt.id}
            variant={exportFormat === fmt.id ? "contained" : "outlined"}
            size="small"
            onClick={() => setExportFormat(fmt.id as "mp4" | "mov")}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              borderRadius: 1,
              bgcolor: exportFormat === fmt.id ? "#3b82f6" : "transparent",
              borderColor: exportFormat === fmt.id ? "#3b82f6" : "#27272a",
              color: exportFormat === fmt.id ? "#ffffff" : "#a1a1aa",
              "&:hover": { borderColor: "#3f3f46" },
            }}
          >
            {fmt.label}
          </Button>
        ))}
      </Box>

      <Divider sx={{ borderColor: "#27272a", my: 2.5 }} />

      {/* Rendering Progress */}
      {renderStatus === "rendering" && (
        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #3b82f6" }}>
          <Typography variant="body2" sx={{ color: "#60a5fa", fontWeight: 700, mb: 0.8, fontSize: "0.82rem" }}>
            Rendering video ({renderProgress}%)...
          </Typography>
          <LinearProgress variant="determinate" value={renderProgress} sx={{ bgcolor: "#27272a", height: 6, borderRadius: 1 }} />
        </Box>
      )}

      {/* Render Complete Alert */}
      {selectedClip.status === "completed" && selectedClip.outputPath && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2.5, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", borderRadius: 1 }}>
          Render complete! Output ready: <code>{selectedClip.outputPath}</code>
        </Alert>
      )}

      {/* Render Action Button */}
      <Button
        variant="contained"
        size="medium"
        startIcon={<FileDownloadIcon />}
        onClick={handleRender}
        disabled={renderStatus === "rendering"}
        sx={{
          bgcolor: "#3b82f6",
          fontWeight: 800,
          textTransform: "none",
          px: 3,
          py: 1,
          borderRadius: 1,
          fontSize: "0.85rem",
          "&:hover": { bgcolor: "#2563eb" },
        }}
      >
        {renderStatus === "rendering" ? "Rendering Video..." : "Render & Export 9:16 Video"}
      </Button>
    </Box>
  );
}
