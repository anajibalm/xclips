"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  IconButton,
  Alert,
  Tooltip,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  CardMedia,
  CircularProgress,
} from "@mui/material";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import AddIcon from "@mui/icons-material/Add";
import BoltIcon from "@mui/icons-material/Bolt";
import SpeedIcon from "@mui/icons-material/Speed";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import YouTubeIcon from "@mui/icons-material/YouTube";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { apiFetch } from "@/lib/api-client";
import { XclipsProject } from "@/lib/xclips/types";
import { YouTubeVideoInfo } from "@/lib/xclips/ytdlp-downloader";
import { useRouter } from "next/navigation";

export default function XclipsDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<XclipsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpuEncoder, setGpuEncoder] = useState<string>("cpu");
  const [openIngestModal, setOpenIngestModal] = useState(false);

  // Ingest Modal state
  const [ingestTab, setIngestTab] = useState<number>(0); // 0: YouTube, 1: Local File
  const [sourcePath, setSourcePath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // YouTube Ingest specific state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeQuality, setYoutubeQuality] = useState<"1080p" | "720p" | "480p" | "best">("1080p");
  const [downloadSubtitles, setDownloadSubtitles] = useState(true);
  const [ytInfo, setYtInfo] = useState<YouTubeVideoInfo | null>(null);
  const [fetchingYtInfo, setFetchingYtInfo] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [downloadSize, setDownloadSize] = useState<string>("");
  const [downloadSpeed, setDownloadSpeed] = useState<string>("");
  const [downloadEta, setDownloadEta] = useState<string>("");
  const [downloadPhase, setDownloadPhase] = useState<string>("Memulai download...");

  const loadData = async () => {
    setLoading(true);
    const [projRes, hwRes] = await Promise.all([
      apiFetch<{ ok: boolean; projects: XclipsProject[] }>("/api/xclips/projects"),
      apiFetch<{ ok: boolean; encoder: string }>("/api/xclips/hwaccel"),
    ]);

    if (projRes.ok && projRes.data?.projects) {
      setProjects(projRes.data.projects);
    }
    if (hwRes.ok && hwRes.data?.encoder) {
      setGpuEncoder(hwRes.data.encoder);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Debounced auto-fetch YouTube metadata
  useEffect(() => {
    if (!youtubeUrl || !youtubeUrl.includes("youtu")) {
      setYtInfo(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setFetchingYtInfo(true);
      setIngestError(null);
      const res = await apiFetch<{ ok: boolean; info: YouTubeVideoInfo }>("/api/xclips/youtube/info", {
        method: "POST",
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (res.ok && res.data?.info) {
        setYtInfo(res.data.info);
        if (!projectName) {
          setProjectName(res.data.info.title);
        }
      } else {
        setYtInfo(null);
      }
      setFetchingYtInfo(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [youtubeUrl]);

  // Handle Local Ingest
  const handleLocalIngest = async () => {
    if (!sourcePath) return;
    setIngesting(true);
    setIngestError(null);

    const res = await apiFetch<{ ok: boolean; project: XclipsProject; message?: string }>(
      "/api/xclips/projects/ingest",
      {
        method: "POST",
        body: JSON.stringify({ sourcePath, name: projectName || undefined }),
      }
    );

    setIngesting(false);

    if (res.ok && res.data?.project) {
      setOpenIngestModal(false);
      resetIngestForm();
      router.push(`/xclips/studio?id=${res.data.project.id}`);
    } else {
      setIngestError(res.data?.message || "Gagal mengimpor file media lokal");
    }
  };

  // Handle YouTube Ingest with real-time 0-100% progress tracking
  const handleYouTubeIngest = async () => {
    if (!youtubeUrl) return;
    setIngesting(true);
    setIngestError(null);
    setDownloadPercent(0);
    setDownloadSize("");
    setDownloadSpeed("");
    setDownloadEta("");
    setDownloadPhase("Menghubungkan ke YouTube...");

    try {
      const initRes = await apiFetch<{ ok: boolean; taskId: string; message?: string }>(
        "/api/xclips/youtube/ingest-async",
        {
          method: "POST",
          body: JSON.stringify({
            url: youtubeUrl,
            quality: youtubeQuality,
            name: projectName || ytInfo?.title || undefined,
            downloadSubtitles,
          }),
        }
      );

      if (!initRes.ok || !initRes.data?.taskId) {
        setIngesting(false);
        setIngestError(initRes.data?.message || "Gagal memulai tugas download YouTube");
        return;
      }

      const taskId = initRes.data.taskId;

      // Poll progress every 350ms
      const pollInterval = setInterval(async () => {
        const progRes = await apiFetch<{
          ok: boolean;
          progress: {
            percent: number;
            speedStr: string;
            etaStr: string;
            totalSizeStr?: string;
            status: string;
            project?: XclipsProject;
            error?: string;
          };
        }>(`/api/xclips/youtube/progress/${taskId}`);

        if (progRes.ok && progRes.data?.progress) {
          const prog = progRes.data.progress;
          setDownloadPercent(Math.round(prog.percent * 10) / 10);
          if (prog.totalSizeStr) setDownloadSize(prog.totalSizeStr);
          if (prog.speedStr) setDownloadSpeed(prog.speedStr);
          if (prog.etaStr) setDownloadEta(prog.etaStr);

          if (prog.status === "downloading") {
            setDownloadPhase(`Mengunduh stream video & audio (${prog.percent.toFixed(1)}%)...`);
          } else if (prog.status === "merging") {
            setDownloadPhase("Menggabungkan container MP4 & subtitle...");
          } else if (prog.status === "completed" && prog.project) {
            clearInterval(pollInterval);
            setDownloadPercent(100);
            setDownloadPhase("Selesai! Mengarahkan ke Studio...");
            setTimeout(() => {
              setIngesting(false);
              setOpenIngestModal(false);
              resetIngestForm();
              router.push(`/xclips/studio?id=${prog.project!.id}`);
            }, 600);
          } else if (prog.status === "error") {
            clearInterval(pollInterval);
            setIngesting(false);
            setIngestError(prog.error || "Gagal mengunduh video dari YouTube");
          }
        }
      }, 350);
    } catch (err: unknown) {
      setIngesting(false);
      setIngestError(err instanceof Error ? err.message : "Kesalahan koneksi saat download");
    }
  };

  const resetIngestForm = () => {
    setSourcePath("");
    setProjectName("");
    setYoutubeUrl("");
    setYtInfo(null);
    setIngestError(null);
    setDownloadPercent(0);
    setDownloadSize("");
    setDownloadSpeed("");
    setDownloadEta("");
  };


  // State for Project Deletion Confirmation (Replaces native window.alert/confirm)
  const [projectToDelete, setProjectToDelete] = useState<XclipsProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    await apiFetch(`/api/xclips/projects/${projectToDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    setProjectToDelete(null);
    loadData();
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <Box sx={{ py: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <MovieFilterIcon sx={{ color: "#3b82f6", fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              xclips Studio
            </Typography>
            <Chip
              label="v1.1"
              size="small"
              sx={{ bgcolor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontWeight: 700, borderRadius: 0.8 }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
            Smart Video Clipper &amp; Short-Form 9:16 Studio
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Chip
            icon={<SpeedIcon sx={{ fontSize: "1rem !important", color: "#10b981" }} />}
            label={`Engine: ${gpuEncoder.toUpperCase()}`}
            sx={{
              bgcolor: "#18181b",
              border: "1px solid #27272a",
              color: "#e4e4e7",
              fontWeight: 600,
              borderRadius: 0.8,
            }}
          />
          <IconButton onClick={loadData} sx={{ color: "#a1a1aa", bgcolor: "#18181b", borderRadius: 0.8 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenIngestModal(true)}
            sx={{
              bgcolor: "#3b82f6",
              fontWeight: 700,
              textTransform: "none",
              px: 2.5,
              borderRadius: 1,
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            Import Video Baru
          </Button>
        </Box>
      </Box>

      {/* Projects List */}
      {loading ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <CircularProgress sx={{ color: "#3b82f6", mb: 2 }} />
          <Typography variant="body2" sx={{ color: "#71717a" }}>
            Memuat daftar proyek...
          </Typography>
        </Box>
      ) : projects.length === 0 ? (
        <Card
          sx={{
            bgcolor: "#121216",
            border: "1px dashed #3f3f46",
            borderRadius: 1,
            p: 6,
            textAlign: "center",
          }}
        >
          <VideoLibraryIcon sx={{ fontSize: 56, color: "#52525b", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: "#e4e4e7" }}>
            Belum Ada Proyek xclips
          </Typography>
          <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 3, maxWidth: 440, mx: "auto" }}>
            Mulai dengan mengimpor video panjang dari YouTube atau file lokal untuk mendeteksi klip viral secara otomatis.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenIngestModal(true)}
            sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 700, borderRadius: 1 }}
          >
            Import Video Pertama
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {projects.map((proj) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={proj.id}>
              <Card
                onClick={() => router.push(`/xclips/studio?id=${proj.id}`)}
                sx={{
                  bgcolor: "#121216",
                  border: "1px solid #27272a",
                  borderRadius: 1,
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: "#3b82f6",
                  },
                }}
              >
                <Box sx={{ p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {proj.sourceType === "youtube" ? (
                        <YouTubeIcon sx={{ color: "#ef4444", fontSize: 24 }} />
                      ) : (
                        <PlayCircleIcon sx={{ color: "#3b82f6", fontSize: 24 }} />
                      )}
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: "#f4f4f5",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                        }}
                      >
                        {proj.name}
                      </Typography>
                    </Box>

                    <Tooltip title="Hapus Proyek">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(proj);
                        }}
                        sx={{ color: "#71717a", "&:hover": { color: "#ef4444" } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                    <Chip
                      size="small"
                      label={`Durasi: ${formatDuration(proj.durationSec)}`}
                      sx={{ bgcolor: "#18181b", color: "#a1a1aa", fontSize: "0.75rem", borderRadius: 0.8 }}
                    />
                    <Chip
                      size="small"
                      label={`${proj.width}x${proj.height}`}
                      sx={{ bgcolor: "#18181b", color: "#a1a1aa", fontSize: "0.75rem", borderRadius: 0.8 }}
                    />
                    {proj.isVfr && (
                      <Chip
                        size="small"
                        label="VFR -> CFR"
                        sx={{ bgcolor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", fontSize: "0.75rem", borderRadius: 0.8 }}
                      />
                    )}
                  </Box>

                  <Typography variant="caption" sx={{ color: "#71717a" }}>
                    Dibuat: {new Date(proj.createdAt).toLocaleDateString("id-ID")}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

      )}

      {/* Delete Confirmation Modal (Replaces native window.alert/confirm) */}
      <Dialog
        open={Boolean(projectToDelete)}
        onClose={() => !deleting && setProjectToDelete(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: "#121216", border: "1px solid #27272a", borderRadius: 1, color: "#ffffff" },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "0.95rem", pb: 1, color: "#fafafa" }}>
          Hapus Proyek xclips?
        </DialogTitle>
        <DialogContent sx={{ pb: 1.5 }}>
          <Typography variant="body2" sx={{ color: "#a1a1aa", fontSize: "0.82rem" }}>
            Apakah Anda yakin ingin menghapus proyek <strong style={{ color: "#ffffff" }}>{projectToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button
            size="small"
            onClick={() => setProjectToDelete(null)}
            disabled={deleting}
            sx={{ color: "#a1a1aa", textTransform: "none", fontSize: "0.8rem" }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={confirmDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <DeleteIcon fontSize="small" />}
            sx={{ bgcolor: "#ef4444", textTransform: "none", fontWeight: 800, fontSize: "0.8rem", borderRadius: 0.8, "&:hover": { bgcolor: "#dc2626" } }}
          >
            {deleting ? "Menghapus..." : "Hapus Proyek"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ingest Modal */}
      <Dialog
        open={openIngestModal}
        onClose={() => !ingesting && setOpenIngestModal(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: "#121216", border: "1px solid #27272a", borderRadius: 1 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: "#fafafa", pb: 1 }}>
          Import Media ke xclips
        </DialogTitle>

        <Box sx={{ borderBottom: 1, borderColor: "#27272a", px: 3 }}>
          <Tabs
            value={ingestTab}
            onChange={(_, val) => {
              setIngestTab(val);
              setIngestError(null);
            }}
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 700,
                color: "#71717a",
                "&.Mui-selected": { color: "#3b82f6" },
              },
              "& .MuiTabs-indicator": { bgcolor: "#3b82f6" },
            }}
          >
            <Tab icon={<YouTubeIcon sx={{ fontSize: 18, mr: 0.5 }} />} iconPosition="start" label="YouTube URL" />
            <Tab icon={<FolderOpenIcon sx={{ fontSize: 18, mr: 0.5 }} />} iconPosition="start" label="File Lokal" />
          </Tabs>
        </Box>

        <DialogContent sx={{ pt: 2.5 }}>
          {ingestError && (
            <Alert severity="error" sx={{ mb: 2.5, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", borderRadius: 0.8 }}>
              {ingestError}
            </Alert>
          )}

          {/* TAB 0: YouTube Ingest */}
          {ingestTab === 0 && (
            <Box>
              <TextField
                fullWidth
                label="YouTube Video URL"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={ingesting}
                sx={{ mb: 2 }}
              />

              {fetchingYtInfo && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, p: 1.5, bgcolor: "#18181b", borderRadius: 1 }}>
                  <CircularProgress size={18} sx={{ color: "#3b82f6" }} />
                  <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                    Mengambil info video YouTube...
                  </Typography>
                </Box>
              )}

              {/* YouTube Metadata Preview Card */}
              {ytInfo && (
                <Card sx={{ bgcolor: "#18181b", border: "1px solid #27272a", borderRadius: 1, mb: 2.5, display: "flex", overflow: "hidden" }}>
                  {ytInfo.thumbnail && (
                    <CardMedia
                      component="img"
                      sx={{ width: 140, objectFit: "cover" }}
                      image={ytInfo.thumbnail}
                      alt={ytInfo.title}
                    />
                  )}
                  <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", justifyContent: "space-between", flexGrow: 1, minWidth: 0 }}>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: "#f4f4f5",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          mb: 0.5,
                        }}
                      >
                        {ytInfo.title}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#a1a1aa", fontSize: "0.75rem" }}>
                        <AccountCircleIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                          {ytInfo.uploader}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: "#60a5fa" }} />
                      <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 600 }}>
                        {formatDuration(ytInfo.duration)}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              )}

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: "#a1a1aa" }}>Kualitas Video</InputLabel>
                    <Select
                      value={youtubeQuality}
                      label="Kualitas Video"
                      onChange={(e) => setYoutubeQuality(e.target.value as "1080p" | "720p" | "480p" | "best")}
                      disabled={ingesting}
                      sx={{ bgcolor: "#18181b", color: "#f4f4f5", borderRadius: 1 }}
                    >
                      <MenuItem value="1080p">1080p (Rekomendasi)</MenuItem>
                      <MenuItem value="720p">720p (Cepat)</MenuItem>
                      <MenuItem value="480p">480p (Hemat)</MenuItem>
                      <MenuItem value="best">Best / 4K Asli</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nama Proyek (Opsional)"
                    placeholder="Judul Proyek"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={ingesting}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={downloadSubtitles}
                    onChange={(e) => setDownloadSubtitles(e.target.checked)}
                    disabled={ingesting}
                    sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: "#e4e4e7" }}>
                    Ekstrak Subtitle YouTube Otomatis (Transkrip Instan)
                  </Typography>
                }
              />
            </Box>
          )}

          {/* TAB 1: Local File Ingest */}
          {ingestTab === 1 && (
            <Box>
              <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 2 }}>
                Masukkan path absolut file video/audio lokal (misal: <code>D:\videos\webinar.mp4</code>).
              </Typography>

              <TextField
                fullWidth
                label="Path File Video / Audio"
                placeholder="D:\@eggafx\live-assist\sample.mp4"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                disabled={ingesting}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Nama Proyek (Opsional)"
                placeholder="BAKOM Webinar Trading Eps 12"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={ingesting}
              />
            </Box>
          )}

          {/* Download & Processing Progress Indicator */}
          {ingesting && (
            <Box sx={{ mt: 3, p: 2, bgcolor: "#18181b", borderRadius: 1, border: "1px solid #27272a" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "#60a5fa", fontWeight: 700 }}>
                  {ingestTab === 0 ? downloadPhase : "Memproses media lokal (Probe & Audio Extraction)..."}
                </Typography>
                {ingestTab === 0 && (
                  <Typography variant="body2" sx={{ color: "#fbbf24", fontWeight: 800 }}>
                    {downloadPercent.toFixed(1)}%
                  </Typography>
                )}
              </Box>

              <LinearProgress
                variant={ingestTab === 0 && downloadPercent > 0 ? "determinate" : "indeterminate"}
                value={downloadPercent}
                sx={{
                  bgcolor: "#27272a",
                  height: 8,
                  borderRadius: 1,
                  "& .MuiLinearProgress-bar": {
                    bgcolor: downloadPercent === 100 ? "#10b981" : "#3b82f6",
                    transition: "transform 0.2s linear",
                  },
                }}
              />

              {ingestTab === 0 && (downloadSize || downloadSpeed || downloadEta) && (
                <Box sx={{ display: "flex", gap: 1.2, mt: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                  {downloadSize && (
                    <Chip
                      size="small"
                      label={`📦 ${downloadSize}`}
                      sx={{ bgcolor: "rgba(59, 130, 246, 0.15)", color: "#93c5fd", border: "1px solid rgba(59, 130, 246, 0.3)", fontSize: "0.75rem", fontWeight: 700 }}
                    />
                  )}
                  {downloadSpeed && (
                    <Chip
                      size="small"
                      label={`⚡ ${downloadSpeed}`}
                      sx={{ bgcolor: "#27272a", color: "#e4e4e7", fontSize: "0.75rem", fontWeight: 600 }}
                    />
                  )}
                  {downloadEta && (
                    <Chip
                      size="small"
                      label={`⏱️ ETA ${downloadEta}`}
                      sx={{ bgcolor: "#27272a", color: "#e4e4e7", fontSize: "0.75rem", fontWeight: 600 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button
            onClick={() => {
              setOpenIngestModal(false);
              resetIngestForm();
            }}
            disabled={ingesting}
            sx={{ color: "#a1a1aa", textTransform: "none" }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            onClick={ingestTab === 0 ? handleYouTubeIngest : handleLocalIngest}
            disabled={ingesting || (ingestTab === 0 ? !youtubeUrl : !sourcePath)}
            sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 700, px: 3 }}
          >
            {ingesting ? (ingestTab === 0 ? "Mengunduh..." : "Memproses...") : (ingestTab === 0 ? "Download & Import" : "Mulai Analisis")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
