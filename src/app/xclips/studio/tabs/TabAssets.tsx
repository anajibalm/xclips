import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Grid,
  Card,
  TextField,
  InputAdornment,
  CircularProgress,
  LinearProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import YouTubeIcon from "@mui/icons-material/YouTube";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import { useStudioStore } from "../store/useStudioStore";
import { getApiBaseUrl } from "@/lib/api-client";
import { formatTime } from "../types/studio.types";
import { XclipsProject } from "@/lib/xclips/types";

function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  return "url";
}

interface TabAssetsProps {
  onPreviewBroll?: (item: XclipsProject) => void;
}

export function TabAssets({ onPreviewBroll }: TabAssetsProps) {
  const projectId = useStudioStore((s) => s.projectId);
  const currentTime = useStudioStore((s) => s.currentTime);
  const footageUrl = useStudioStore((s) => s.footageUrl);
  const setFootageUrl = useStudioStore((s) => s.setFootageUrl);
  const footageDownloading = useStudioStore((s) => s.footageDownloading);
  const footageProgress = useStudioStore((s) => s.footageProgress);
  const footageError = useStudioStore((s) => s.footageError);
  const setFootageError = useStudioStore((s) => s.setFootageError);
  const handleFootageDownload = useStudioStore((s) => s.handleFootageDownload);
  const assetsSubTab = useStudioStore((s) => s.assetsSubTab);
  const setAssetsSubTab = useStudioStore((s) => s.setAssetsSubTab);
  const footageList = useStudioStore((s) => s.footageList);
  const footageListLoading = useStudioStore((s) => s.footageListLoading);
  const fetchFootageList = useStudioStore((s) => s.fetchFootageList);
  const assets = useStudioStore((s) => s.assets);
  const setPreviewVideoOpen = useStudioStore((s) => s.setPreviewVideoOpen);
  const setPreviewThumbnailOpen = useStudioStore((s) => s.setPreviewThumbnailOpen);
  const handleOpenInExplorer = useStudioStore((s) => s.handleOpenInExplorer);
  const handleCaptureThumbnail = useStudioStore((s) => s.handleCaptureThumbnail);
  const isCapturingThumb = useStudioStore((s) => s.isCapturingThumb);
  const thumbTimestamp = useStudioStore((s) => s.thumbTimestamp);
  const copiedAssetKey = useStudioStore((s) => s.copiedAssetKey);
  const setCopiedAssetKey = useStudioStore((s) => s.setCopiedAssetKey);

  const [footagePlatform, setFootagePlatform] = useState<string>("youtube");

  const handleCopyText = (text: string, key: string) => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
    }
    setCopiedAssetKey(key);
    setTimeout(() => setCopiedAssetKey(null), 2000);
  };

  return (
    <Box>
      {/* ===== PERMANENT MEDIA DOWNLOADER (ABOVE SUB-TABS) ===== */}
      <Box sx={{ p: 2, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a", mb: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.9rem" }}>
              Media Downloader
            </Typography>
            <Button
              size="small"
              variant="text"
              href="/xclips/downloader"
              target="_blank"
              endIcon={<OpenInNewIcon sx={{ fontSize: "0.75rem !important" }} />}
              sx={{ color: "#60a5fa", textTransform: "none", fontSize: "0.72rem", py: 0, px: 0.8 }}
            >
              Open Dedicated Page
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 0.6 }}>
            {[
              { id: "youtube", label: "YouTube", color: "#ef4444" },
              { id: "tiktok", label: "TikTok", color: "#ffffff" },
              { id: "instagram", label: "Instagram", color: "#e1306c" },
            ].map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                size="small"
                sx={{
                  bgcolor: footagePlatform === p.id ? `${p.color}22` : "#1e1e24",
                  color: footagePlatform === p.id ? p.color : "#71717a",
                  border: `1px solid ${footagePlatform === p.id ? p.color : "#27272a"}`,
                  fontSize: "0.65rem",
                  height: 18,
                  fontWeight: 700,
                  borderRadius: 0.6,
                }}
              />
            ))}
          </Box>
        </Box>

        {/* URL Input Row */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Paste YouTube, TikTok, or Instagram video link..."
            value={footageUrl}
            onChange={(e) => {
              setFootageUrl(e.target.value);
              setFootagePlatform(detectPlatformFromUrl(e.target.value));
              setFootageError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !footageDownloading && footageUrl.trim()) {
                handleFootageDownload();
              }
            }}
            slotProps={{
              htmlInput: { spellCheck: false, autoCorrect: "off", autoCapitalize: "none" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <OpenInNewIcon sx={{ color: "#71717a", fontSize: "0.95rem" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: 0.8 },
              "& .MuiOutlinedInput-root": {
                bgcolor: "#09090c",
                borderRadius: 1,
                "& fieldset": { borderColor: "#27272a" },
                "&:hover fieldset": { borderColor: "#3f3f46" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
              },
            }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={footageDownloading ? <CircularProgress size={13} sx={{ color: "#ffffff" }} /> : <FileDownloadIcon />}
            onClick={() => handleFootageDownload()}
            disabled={footageDownloading || !footageUrl.trim()}
            sx={{
              bgcolor: "#3b82f6",
              textTransform: "none",
              fontWeight: 800,
              whiteSpace: "nowrap",
              px: 2.2,
              height: 36,
              borderRadius: 1,
              fontSize: "0.82rem",
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            {footageDownloading ? "Downloading..." : "Download"}
          </Button>
        </Box>

        {/* Error Alert */}
        {footageError && (
          <Alert severity="error" sx={{ mt: 1.2, py: 0.2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", fontSize: "0.78rem" }} onClose={() => setFootageError(null)}>
            {footageError}
          </Alert>
        )}

        {/* Progress Bar */}
        {footageDownloading && footageProgress && (
          <Box sx={{ mt: 1.5, p: 1.2, bgcolor: "#101014", border: "1px solid #3b82f6", borderRadius: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
              <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.75rem" }}>
                {footageProgress.status === "merging" ? "Merging streams..." : `Downloading ${footageProgress.percent.toFixed(1)}%`}
              </Typography>
              <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem" }}>
                {footageProgress.totalSizeStr ? `📦 ${footageProgress.totalSizeStr} · ` : ""}
                {footageProgress.speedStr} {footageProgress.etaStr && `· ETA ${footageProgress.etaStr}`}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={footageProgress.percent}
              sx={{ bgcolor: "#27272a", height: 5, borderRadius: 1, "& .MuiLinearProgress-bar": { bgcolor: "#3b82f6" } }}
            />
          </Box>
        )}
      </Box>

      {/* 3 ASSET SUB-TABS: VIDEO | IMAGE | FILES */}
      <Box sx={{ display: "flex", gap: 0.8, mb: 2, borderBottom: "1px solid #27272a", pb: 0 }}>
        {[
          { id: "video", label: `Video (${1 + footageList.filter((f) => f.id !== projectId).length})` },
          { id: "image", label: "Image (Cover & Frames)" },
          { id: "files", label: "Files (SRT, ASS, Audio)" },
        ].map((tab) => (
          <Box
            key={tab.id}
            onClick={() => setAssetsSubTab(tab.id as "video" | "image" | "files")}
            sx={{
              px: 1.5,
              py: 0.8,
              fontSize: "0.82rem",
              fontWeight: assetsSubTab === tab.id ? 800 : 500,
              color: assetsSubTab === tab.id ? "#3b82f6" : "#71717a",
              borderBottom: assetsSubTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
              userSelect: "none",
              "&:hover": { color: "#e4e4e7" },
            }}
          >
            {tab.label}
          </Box>
        ))}
      </Box>

      {/* ===== SUB-TAB 1: VIDEO (RAW MASTER + B-ROLLS) ===== */}
      {assetsSubTab === "video" && (
        <Box>
          {/* Master RAW Video Card */}
          <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, mb: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <VideoFileIcon sx={{ color: "#3b82f6", fontSize: "1.2rem" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                  Master Raw Video
                </Typography>
              </Box>
              <Chip label={assets?.hasNormalized ? "CFR Ready" : "Native Source"} size="small" sx={{ bgcolor: "#1e1e24", color: "#60a5fa", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
            </Box>

            <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1.2 }}>
              Status: {assets?.hasSource ? "Available in local vault" : "Pending ingest"}
            </Typography>

            <Box sx={{ display: "flex", gap: 0.8 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={() => setPreviewVideoOpen(true)}
                sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}
              >
                Preview
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                component="a"
                href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=video`}
                download
                sx={{ color: "#60a5fa", borderColor: "#3b82f6", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}
              >
                Download MP4
              </Button>
              <IconButton
                size="small"
                onClick={() => handleOpenInExplorer("", projectId || "")}
                title="Show in File Explorer"
                sx={{ color: "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5, "&:hover": { color: "#60a5fa" } }}
              >
                <FolderOpenIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleCopyText(`${getApiBaseUrl()}/api/xclips/media/${projectId}/stream`, "video_stream")}
                title={copiedAssetKey === "video_stream" ? "Copied!" : "Copy Stream URL"}
                sx={{ color: copiedAssetKey === "video_stream" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Card>

          {/* Downloaded B-Roll Gallery Section */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.85rem" }}>
              B-Roll Library
            </Typography>
            <IconButton size="small" onClick={fetchFootageList} disabled={footageListLoading} sx={{ color: "#a1a1aa" }}>
              {footageListLoading ? <CircularProgress size={14} sx={{ color: "#3b82f6" }} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Box>

          {footageList.filter((item) => item.id !== projectId).length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center", border: "1px dashed #27272a", borderRadius: 1 }}>
              <VideoFileIcon sx={{ fontSize: 32, color: "#3f3f46", mb: 0.8 }} />
              <Typography variant="caption" sx={{ color: "#71717a", display: "block" }}>
                No downloaded B-Roll videos yet. Paste a link in the downloader above to add footage.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={1.5}>
              {footageList.filter((item) => item.id !== projectId).map((item) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
                  <Card
                    onClick={() => {
                      if (onPreviewBroll) onPreviewBroll(item);
                    }}
                    sx={{
                      bgcolor: "#141418",
                      border: "1px solid #27272a",
                      borderRadius: 1,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      "&:hover": { borderColor: "#3f3f46" },
                    }}
                  >
                    {/* Thumbnail */}
                    <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9", bgcolor: "#000" }}>
                      <Box
                        component="img"
                        src={item?.id ? `${getApiBaseUrl()}/api/xclips/media/${item.id}/thumbnail` : undefined}
                        alt={item.name}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                        <Chip
                          label={item.sourceType ? item.sourceType.toUpperCase() : "B-ROLL"}
                          size="small"
                          sx={{ bgcolor: "rgba(0,0,0,0.8)", color: "#fff", fontSize: "0.6rem", height: 18, borderRadius: 0.5, fontWeight: 700 }}
                        />
                      </Box>
                      <Box sx={{ position: "absolute", bottom: 6, right: 6, bgcolor: "rgba(0,0,0,0.8)", color: "#fff", px: 0.6, py: 0.2, borderRadius: 0.5, fontSize: "0.65rem", fontFamily: "monospace" }}>
                        {formatTime(item.durationSec || 0)}
                      </Box>
                    </Box>

                    {/* Body */}
                    <Box sx={{ p: 1.2, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#fafafa", fontSize: "0.78rem", mb: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
                          {item.width}x{item.height} • {item.frameRate} fps
                        </Typography>
                      </Box>

                      {/* Action Footer */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.4, pt: 0.8, mt: 0.8, borderTop: "1px solid #1f1f24" }}>
                        <Tooltip title="Open in File Explorer" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInExplorer(item.sourcePath, item.id);
                            }}
                            sx={{ color: "#a1a1aa", p: 0.4, "&:hover": { color: "#60a5fa" } }}
                          >
                            <FolderOpenIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download MP4" arrow>
                          <IconButton
                            size="small"
                            component="a"
                            href={`${getApiBaseUrl()}/api/xclips/media/${item.id}/download?type=video`}
                            download
                            onClick={(e) => e.stopPropagation()}
                            sx={{ color: "#a1a1aa", p: 0.4, "&:hover": { color: "#34d399" } }}
                          >
                            <FileDownloadIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={copiedAssetKey === `broll_${item.id}` ? "Copied!" : "Copy Path"} arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(item.sourcePath || "", `broll_${item.id}`);
                            }}
                            sx={{ color: copiedAssetKey === `broll_${item.id}` ? "#34d399" : "#a1a1aa", p: 0.4 }}
                          >
                            <ContentCopyIcon fontSize="small" sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ===== SUB-TAB 2: IMAGE (THUMBNAILS & FRAME CAPTURES) ===== */}
      {assetsSubTab === "image" && (
        <Box>
          <Card sx={{ p: 2, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <YouTubeIcon sx={{ color: "#ef4444" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa" }}>
                  Cover Thumbnail &amp; Captured Frames
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CameraAltIcon />}
                onClick={handleCaptureThumbnail}
                disabled={isCapturingThumb}
                sx={{
                  borderColor: "#ef4444",
                  color: "#f87171",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  borderRadius: 0.8,
                  "&:hover": { bgcolor: "rgba(239, 68, 68, 0.12)" },
                }}
              >
                {isCapturingThumb ? "Capturing..." : `Capture Frame (${formatTime(currentTime)})`}
              </Button>
            </Box>

            <Box
              onClick={() => setPreviewThumbnailOpen(true)}
              sx={{ width: "100%", height: 180, bgcolor: "#000", borderRadius: 1, border: "1px solid #27272a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5, position: "relative", cursor: "pointer" }}
            >
              <Box component="img" src={projectId ? `${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail?t=${thumbTimestamp}` : undefined} alt="Cover" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </Box>

            <Box sx={{ display: "flex", gap: 0.8 }}>
              <Button variant="contained" size="small" startIcon={<VisibilityIcon />} onClick={() => setPreviewThumbnailOpen(true)} sx={{ bgcolor: "#ef4444", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}>
                Preview Fullscreen
              </Button>
              <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} component="a" href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=thumbnail`} download sx={{ color: "#f87171", borderColor: "#ef4444", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.4 }}>
                Download JPEG
              </Button>
              <IconButton size="small" onClick={() => handleCopyText(`${getApiBaseUrl()}/api/xclips/media/${projectId}/thumbnail`, "thumb_url")} sx={{ color: copiedAssetKey === "thumb_url" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Card>
        </Box>
      )}

      {/* ===== SUB-TAB 3: FILES (SRT, ASS, AUDIO PCM) ===== */}
      {assetsSubTab === "files" && (
        <Grid container spacing={2}>
          {/* SRT Subtitle Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SubtitlesIcon sx={{ color: "#f59e0b", fontSize: "1.1rem" }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                      SRT Subtitles (.srt)
                    </Typography>
                  </Box>
                  <Chip label="SRT UTF-8" size="small" sx={{ bgcolor: "#1e1e24", color: "#fbbf24", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
                </Box>
                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1 }}>
                  Standard SubRip format compatible with Premiere, Final Cut, and DaVinci Resolve.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  component="a"
                  href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=srt`}
                  download
                  sx={{ bgcolor: "#f59e0b", color: "#000000", textTransform: "none", fontWeight: 800, fontSize: "0.72rem", borderRadius: 0.8, flex: 1, "&:hover": { bgcolor: "#d97706" } }}
                >
                  Download .SRT
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyText(`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=srt`, "srt_download_url")}
                  sx={{ color: "#a1a1aa", borderColor: "#27272a", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8 }}
                >
                  {copiedAssetKey === "srt_download_url" ? "Copied!" : "Copy URL"}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Audio RAW Track Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ p: 1.8, bgcolor: "#141418", border: "1px solid #27272a", borderRadius: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AudiotrackIcon sx={{ color: "#10b981", fontSize: "1.1rem" }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                      Audio RAW Track (16kHz WAV)
                    </Typography>
                  </Box>
                  <Chip label="16kHz WAV" size="small" sx={{ bgcolor: "#1e1e24", color: "#34d399", fontWeight: 700, fontSize: "0.68rem", height: 20, borderRadius: 0.6 }} />
                </Box>
                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", fontSize: "0.72rem", mb: 1 }}>
                  PCM 16-bit Mono isolated audio track normalized for Whisper speech models.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  component="a"
                  href={`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=audio`}
                  download
                  sx={{ bgcolor: "#10b981", textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 0.8, flex: 1, "&:hover": { bgcolor: "#059669" } }}
                >
                  Download WAV
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleCopyText(`${getApiBaseUrl()}/api/xclips/media/${projectId}/download?type=audio`, "audio_url")}
                  sx={{ color: copiedAssetKey === "audio_url" ? "#34d399" : "#a1a1aa", border: "1px solid #27272a", borderRadius: 0.8, p: 0.5 }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
