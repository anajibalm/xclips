"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import FolderDeleteIcon from "@mui/icons-material/FolderDelete";
import DataThresholdingIcon from "@mui/icons-material/DataThresholding";
import DownloadIcon from "@mui/icons-material/Download";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";

import { apiFetch } from "@/lib/api-client";
import { StorageStats, ProjectStorage, CleanResult } from "@/lib/xclips/types";

export default function XclipsSettingsPage() {
  const router = useRouter();

  const [stats, setStats] = useState<StorageStats | null>(null);
  const [projectStorage, setProjectStorage] = useState<ProjectStorage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    actionType: "clean_cache" | "clean_downloads" | "clean_orphans" | "compact_db" | "clean_project";
    targetId?: string;
  }>({
    open: false,
    title: "",
    description: "",
    actionType: "clean_cache",
  });

  // Export / Import states
  const [exportProjectId, setExportProjectId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [importJson, setImportJson] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Snackbar Notification
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const loadStorageData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        stats: StorageStats;
        projectStorage: ProjectStorage[];
      }>("/api/xclips/storage/stats");

      if (res.ok && res.data) {
        setStats(res.data.stats);
        setProjectStorage(res.data.projectStorage || []);
        if (res.data.projectStorage && res.data.projectStorage.length > 0 && !exportProjectId) {
          const firstNonOrphan = res.data.projectStorage.find((p) => !p.isOrphan);
          if (firstNonOrphan) setExportProjectId(firstNonOrphan.projectId);
        }
      }
    } catch {
      setSnackbar({
        open: true,
        message: "Gagal memuat informasi storage dari server.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // ── Action Handlers ──────────────────────────────────────────

  const handleExecuteAction = async () => {
    const { actionType, targetId } = confirmDialog;
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    setActionLoading(true);

    try {
      if (actionType === "clean_cache") {
        const res = await apiFetch<{ ok: boolean; result: CleanResult }>("/api/xclips/storage/clean-cache", {
          method: "POST",
        });
        if (res.ok && res.data?.result) {
          setSnackbar({
            open: true,
            message: `Cache dibersihkan! Dibebaskan: ${formatBytes(res.data.result.freedBytes)} (${res.data.result.deletedCount} files)`,
            severity: "success",
          });
        }
      } else if (actionType === "clean_downloads") {
        const res = await apiFetch<{ ok: boolean; result: CleanResult }>("/api/xclips/storage/clean-downloads", {
          method: "POST",
        });
        if (res.ok && res.data?.result) {
          setSnackbar({
            open: true,
            message: `Downloads dibersihkan! Dibebaskan: ${formatBytes(res.data.result.freedBytes)} (${res.data.result.deletedCount} files)`,
            severity: "success",
          });
        }
      } else if (actionType === "clean_orphans") {
        const res = await apiFetch<{ ok: boolean; result: CleanResult }>("/api/xclips/storage/clean-orphans", {
          method: "POST",
        });
        if (res.ok && res.data?.result) {
          setSnackbar({
            open: true,
            message: `File orphan dibersihkan! Dibebaskan: ${formatBytes(res.data.result.freedBytes)} (${res.data.result.deletedCount} files)`,
            severity: "success",
          });
        }
      } else if (actionType === "compact_db") {
        const res = await apiFetch<{
          ok: boolean;
          result: { beforeSize: number; afterSize: number };
        }>("/api/xclips/storage/compact-db", { method: "POST" });
        if (res.ok && res.data?.result) {
          const delta = res.data.result.beforeSize - res.data.result.afterSize;
          setSnackbar({
            open: true,
            message: `Database berhasil di-VACUUM! Sebelum: ${formatBytes(res.data.result.beforeSize)} → Sesudah: ${formatBytes(res.data.result.afterSize)} (${formatBytes(Math.max(0, delta))} hemat)`,
            severity: "success",
          });
        }
      } else if (actionType === "clean_project" && targetId) {
        const res = await apiFetch<{ ok: boolean; result: CleanResult }>(
          `/api/xclips/storage/clean-project/${targetId}`,
          { method: "POST" }
        );
        if (res.ok && res.data?.result) {
          setSnackbar({
            open: true,
            message: `Storage project dibersihkan! Dibebaskan: ${formatBytes(res.data.result.freedBytes)} (${res.data.result.deletedCount} files)`,
            severity: "success",
          });
        }
      }
      await loadStorageData();
    } catch {
      setSnackbar({
        open: true,
        message: "Terjadi kesalahan saat menjalankan aksi pembersihan.",
        severity: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Project Bundle
  const handleExportProject = async () => {
    if (!exportProjectId) return;
    setExporting(true);
    try {
      const res = await apiFetch<{ ok: boolean; bundle: unknown }>(`/api/xclips/projects/${exportProjectId}/export`);
      if (res.ok && res.data?.bundle) {
        const jsonStr = JSON.stringify(res.data.bundle, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `xclips-export-${exportProjectId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSnackbar({
          open: true,
          message: "Project bundle berhasil diekspor sebagai JSON!",
          severity: "success",
        });
      } else {
        setSnackbar({
          open: true,
          message: "Gagal mengekspor project.",
          severity: "error",
        });
      }
    } catch {
      setSnackbar({
        open: true,
        message: "Terjadi kesalahan saat mengekspor project.",
        severity: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  // Import Project Bundle
  const handleImportProject = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const res = await apiFetch<{ ok: boolean; projectId: string }>("/api/xclips/projects/import", {
        method: "POST",
        body: JSON.stringify({ bundle: parsed }),
      });
      if (res.ok && res.data?.projectId) {
        setSnackbar({
          open: true,
          message: `Project berhasil di-import dengan ID: ${res.data.projectId}!`,
          severity: "success",
        });
        setImportOpen(false);
        setImportJson("");
        await loadStorageData();
      } else {
        setSnackbar({
          open: true,
          message: "Gagal mengimpor project. Pastikan format JSON valid.",
          severity: "error",
        });
      }
    } catch {
      setSnackbar({
        open: true,
        message: "Format JSON tidak valid atau rusak.",
        severity: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  // Calculate bar percentages
  const total = stats?.totalSize || 1;
  const cachePercent = stats ? Math.max(0, Math.min(100, (stats.cacheSize / total) * 100)) : 0;
  const dlPercent = stats ? Math.max(0, Math.min(100, (stats.downloadsSize / total) * 100)) : 0;
  const dbPercent = stats ? Math.max(0, Math.min(100, (stats.databaseSize / total) * 100)) : 0;

  return (
    <Box sx={{ py: 3, maxWidth: 1400, mx: "auto", px: { xs: 2, md: 3 } }}>
      {/* Top Header */}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/xclips")}
            sx={{
              borderColor: "#27272a",
              color: "#a1a1aa",
              bgcolor: "#18181b",
              "&:hover": { borderColor: "#3f3f46", color: "#f4f4f5", bgcolor: "#27272a" },
              borderRadius: 1,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Dashboard
          </Button>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <StorageIcon sx={{ color: "#3b82f6", fontSize: 28 }} />
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                Storage &amp; System Settings
              </Typography>
              <Chip
                label={stats ? formatBytes(stats.totalSize) : "Loading..."}
                size="small"
                sx={{
                  bgcolor: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  fontWeight: 700,
                  borderRadius: 0.8,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: "#a1a1aa" }}>
              Kelola kapasitas disk, bersihkan intermediate cache/footage, compact database SQLite, dan backup/restore project.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton
            onClick={loadStorageData}
            disabled={loading || actionLoading}
            sx={{ color: "#a1a1aa", bgcolor: "#18181b", border: "1px solid #27272a", borderRadius: 1 }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Loading Progress Bar */}
      {(loading || actionLoading) && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* ── SECTION 1: STORAGE OVERVIEW ────────────────────────── */}
      <Card
        sx={{
          bgcolor: "#121215",
          border: "1px solid #27272a",
          borderRadius: 2,
          mb: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
              📊 Storage Breakdown Overview
            </Typography>
            <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
              Lokasi Vault: <code>vault/xclips/</code> (Local-First Storage)
            </Typography>
          </Box>

          {/* Visual Stacked Bar Chart */}
          <Box
            sx={{
              display: "flex",
              height: 20,
              width: "100%",
              borderRadius: 1.5,
              overflow: "hidden",
              bgcolor: "#27272a",
              mb: 2.5,
            }}
          >
            {cachePercent > 0 && (
              <Tooltip title={`Cache: ${formatBytes(stats?.cacheSize || 0)} (${cachePercent.toFixed(1)}%)`}>
                <Box
                  sx={{
                    width: `${cachePercent}%`,
                    bgcolor: "#f59e0b",
                    transition: "width 0.4s ease",
                  }}
                />
              </Tooltip>
            )}
            {dlPercent > 0 && (
              <Tooltip title={`Downloads: ${formatBytes(stats?.downloadsSize || 0)} (${dlPercent.toFixed(1)}%)`}>
                <Box
                  sx={{
                    width: `${dlPercent}%`,
                    bgcolor: "#3b82f6",
                    transition: "width 0.4s ease",
                  }}
                />
              </Tooltip>
            )}
            {dbPercent > 0 && (
              <Tooltip title={`Database: ${formatBytes(stats?.databaseSize || 0)} (${dbPercent.toFixed(1)}%)`}>
                <Box
                  sx={{
                    width: `${dbPercent}%`,
                    bgcolor: "#10b981",
                    transition: "width 0.4s ease",
                  }}
                />
              </Tooltip>
            )}
          </Box>

          {/* Breakdown Cards Grid */}
          <Grid container spacing={2}>
            {/* Cache */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "rgba(245, 158, 11, 0.06)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  borderRadius: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#f59e0b" }} />
                  <Typography variant="body2" sx={{ color: "#fbbf24", fontWeight: 700 }}>
                    Cache &amp; Waveforms
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#f4f4f5" }}>
                  {stats ? formatBytes(stats.cacheSize) : "0 B"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                  {stats?.cacheFileCount || 0} file audio WAV, normalized CFR, thumbnail preview
                </Typography>
              </Box>
            </Grid>

            {/* Downloads */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "rgba(59, 130, 246, 0.06)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#3b82f6" }} />
                  <Typography variant="body2" sx={{ color: "#60a5fa", fontWeight: 700 }}>
                    Source Video Downloads
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#f4f4f5" }}>
                  {stats ? formatBytes(stats.downloadsSize) : "0 B"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                  {stats?.downloadsFileCount || 0} file master video YouTube / TikTok / Local
                </Typography>
              </Box>
            </Grid>

            {/* Database */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#10b981" }} />
                  <Typography variant="body2" sx={{ color: "#34d399", fontWeight: 700 }}>
                    Database (SQLite WAL)
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#f4f4f5" }}>
                  {stats ? formatBytes(stats.databaseSize) : "0 B"}
                </Typography>
                <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
                  <code>xclips.db</code>, <code>-wal</code>, <code>-shm</code> (Projects, Subtitles, Clips)
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── SECTION 2: QUICK CLEAN ACTIONS ─────────────────────── */}
      <Card
        sx={{
          bgcolor: "#121215",
          border: "1px solid #27272a",
          borderRadius: 2,
          mb: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f4f4f5", mb: 0.5 }}>
            ⚡ Quick Clean &amp; Maintenance Actions
          </Typography>
          <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 2.5 }}>
            Bersihkan disk secara selektif tanpa menghapus metadata transkrip atau clip yang tersimpan di database.
          </Typography>

          <Grid container spacing={2}>
            {/* Clean Cache */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <CleaningServicesIcon sx={{ color: "#f59e0b", fontSize: 22 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                      Clean All Cache
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                    Hapus semua file intermediate render, audio chunk, dan waveform cache (akan di-generate ulang otomatis saat dibutuhkan).
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteSweepIcon />}
                  disabled={actionLoading || !stats || stats.cacheSize === 0}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: "Bersihkan Semua Cache?",
                      description: `Tindakan ini akan menghapus ${formatBytes(stats?.cacheSize || 0)} cache render dan audio wave. Waveform akan di-generate ulang saat membuka project kembali.`,
                      actionType: "clean_cache",
                    })
                  }
                  sx={{
                    borderColor: "#f59e0b",
                    color: "#fbbf24",
                    "&:hover": { borderColor: "#d97706", bgcolor: "rgba(245, 158, 11, 0.1)" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Clean Cache ({stats ? formatBytes(stats.cacheSize) : "0 B"})
                </Button>
              </Box>
            </Grid>

            {/* Clean Downloads */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <FolderDeleteIcon sx={{ color: "#3b82f6", fontSize: 22 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                      Clean All Downloads
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                    Hapus file video master footage dari YouTube/TikTok di folder downloads untuk menghemat storage besar.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteSweepIcon />}
                  disabled={actionLoading || !stats || stats.downloadsSize === 0}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: "Bersihkan Semua Source Footage Downloads?",
                      description: `Tindakan ini akan menghapus ${formatBytes(stats?.downloadsSize || 0)} master video source. Pastikan Anda tidak memerlukan file lokal ini lagi atau dapat mengunduhnya kembali.`,
                      actionType: "clean_downloads",
                    })
                  }
                  sx={{
                    borderColor: "#3b82f6",
                    color: "#60a5fa",
                    "&:hover": { borderColor: "#2563eb", bgcolor: "rgba(59, 130, 246, 0.1)" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Clean Downloads ({stats ? formatBytes(stats.downloadsSize) : "0 B"})
                </Button>
              </Box>
            </Grid>

            {/* Clean Orphans */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <DeleteSweepIcon sx={{ color: "#a855f7", fontSize: 22 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                      Clean Orphaned Folders
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                    Hapus folder cache/downloads dari project-project yang sudah dihapus dari database SQLite.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteSweepIcon />}
                  disabled={actionLoading || !stats || stats.orphanCount === 0}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: "Hapus File Orphan?",
                      description: `Ditemukan ${stats?.orphanCount || 0} folder orphan yang tidak lagi memiliki entri di database SQLite. Folder ini aman untuk dihapus.`,
                      actionType: "clean_orphans",
                    })
                  }
                  sx={{
                    borderColor: "#a855f7",
                    color: "#c084fc",
                    "&:hover": { borderColor: "#9333ea", bgcolor: "rgba(168, 85, 247, 0.1)" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Clean Orphans ({stats?.orphanCount || 0} found)
                </Button>
              </Box>
            </Grid>

            {/* Compact DB */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <DataThresholdingIcon sx={{ color: "#10b981", fontSize: 22 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                      Compact Database
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                    Jalankan SQLite <code>VACUUM</code> untuk mengosongkan unused pages, memadatkan file WAL, dan mempercepat query.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DataThresholdingIcon />}
                  disabled={actionLoading}
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: "Compact SQLite Database via VACUUM?",
                      description:
                        "Tindakan ini akan mengunci database sesaat untuk membebaskan ruang disk yang tidak terpakai dan mengoptimalkan performa index SQLite WAL.",
                      actionType: "compact_db",
                    })
                  }
                  sx={{
                    borderColor: "#10b981",
                    color: "#34d399",
                    "&:hover": { borderColor: "#059669", bgcolor: "rgba(16, 185, 129, 0.1)" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Run VACUUM ({stats ? formatBytes(stats.databaseSize) : "0 B"})
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── SECTION 3: PER-PROJECT STORAGE BREAKDOWN ───────────── */}
      <Card
        sx={{
          bgcolor: "#121215",
          border: "1px solid #27272a",
          borderRadius: 2,
          mb: 3,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
              📁 Per-Project Storage Usage ({projectStorage.length} items)
            </Typography>
            <Typography variant="caption" sx={{ color: "#a1a1aa" }}>
              Klik tombol sapu untuk menghapus cache/downloads khusus project tertentu
            </Typography>
          </Box>

          <TableContainer component={Paper} sx={{ bgcolor: "#18181b", border: "1px solid #27272a", borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#27272a" }}>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700, py: 1.2 }}>Project Name / ID</TableCell>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700 }} align="right">Cache Size</TableCell>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700 }} align="right">Downloads Size</TableCell>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700 }} align="right">Total Disk</TableCell>
                  <TableCell sx={{ color: "#e4e4e7", fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectStorage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: "#a1a1aa" }}>
                      Tidak ada data storage project.
                    </TableCell>
                  </TableRow>
                ) : (
                  projectStorage.map((p) => (
                    <TableRow
                      key={p.projectId}
                      sx={{
                        "&:hover": { bgcolor: "rgba(255,255,255,0.02)" },
                        borderBottom: "1px solid #27272a",
                      }}
                    >
                      <TableCell sx={{ color: "#f4f4f5", fontWeight: 600 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <VideoLibraryIcon sx={{ color: p.isOrphan ? "#ef4444" : "#3b82f6", fontSize: 18 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {p.projectName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#71717a", fontFamily: "monospace" }}>
                              {p.projectId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {p.isOrphan ? (
                          <Chip
                            label="Orphan Folder"
                            size="small"
                            sx={{
                              bgcolor: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              borderRadius: 0.6,
                            }}
                          />
                        ) : (
                          <Chip
                            label="Active Project"
                            size="small"
                            sx={{
                              bgcolor: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              borderRadius: 0.6,
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#fbbf24", fontFamily: "monospace" }}>
                        {formatBytes(p.cacheSize)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#60a5fa", fontFamily: "monospace" }}>
                        {formatBytes(p.downloadsSize)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#f4f4f5", fontWeight: 700, fontFamily: "monospace" }}>
                        {formatBytes(p.totalSize)}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                          <Tooltip title="Clean cache & downloads for this project">
                            <IconButton
                              size="small"
                              disabled={actionLoading || p.totalSize === 0}
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  title: `Bersihkan Storage Project: ${p.projectName}?`,
                                  description: `Tindakan ini akan menghapus ${formatBytes(p.totalSize)} cache dan video downloads untuk project ini. Metadata project dan transkrip tetap aman.`,
                                  actionType: "clean_project",
                                  targetId: p.projectId,
                                })
                              }
                              sx={{ color: "#f59e0b", bgcolor: "rgba(245, 158, 11, 0.1)" }}
                            >
                              <CleaningServicesIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── SECTION 4: BACKUP & MIGRATION ──────────────────────── */}
      <Card
        sx={{
          bgcolor: "#121215",
          border: "1px solid #27272a",
          borderRadius: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f4f4f5", mb: 0.5 }}>
            💾 Project Backup &amp; Migration (JSON Bundle)
          </Typography>
          <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 2.5 }}>
            Ekspor project beserta clips, subtitle tracks, dan word timestamps sebagai portable JSON bundle untuk backup atau import ke instalasi xClips lain.
          </Typography>

          <Grid container spacing={3}>
            {/* Export Section */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  height: "100%",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <DownloadIcon sx={{ color: "#3b82f6" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                    Export Project Bundle
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                  Pilih project aktif yang ingin diekspor. File JSON berisi seluruh state project, transkrip kata-per-kata, dan daftar clip hasil AI.
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: "#a1a1aa" }}>Select Project to Export</InputLabel>
                  <Select
                    value={exportProjectId}
                    label="Select Project to Export"
                    onChange={(e) => setExportProjectId(e.target.value)}
                    sx={{
                      bgcolor: "#121215",
                      color: "#f4f4f5",
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
                    }}
                  >
                    {projectStorage
                      .filter((p) => !p.isOrphan)
                      .map((p) => (
                        <MenuItem key={p.projectId} value={p.projectId}>
                          {p.projectName} ({p.projectId})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  fullWidth
                  startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  disabled={exporting || !exportProjectId}
                  onClick={handleExportProject}
                  sx={{
                    bgcolor: "#3b82f6",
                    color: "#fff",
                    "&:hover": { bgcolor: "#2563eb" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                >
                  {exporting ? "Exporting..." : "Download Project JSON Bundle"}
                </Button>
              </Box>
            </Grid>

            {/* Import Section */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: 2.5,
                  bgcolor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 1.5,
                  height: "100%",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <FileUploadIcon sx={{ color: "#10b981" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#f4f4f5" }}>
                    Import Project Bundle
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 2 }}>
                  Import bundle JSON yang pernah diekspor. Project, transkrip subtitle, dan clip akan dibuat ulang di database lokal.
                </Typography>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<FileUploadIcon />}
                  onClick={() => setImportOpen(true)}
                  sx={{
                    borderColor: "#10b981",
                    color: "#34d399",
                    "&:hover": { borderColor: "#059669", bgcolor: "rgba(16, 185, 129, 0.1)" },
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    py: 1,
                  }}
                >
                  Paste / Upload JSON Bundle
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── CONFIRMATION DIALOG ────────────────────────────────── */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#18181b",
              color: "#f4f4f5",
              border: "1px solid #27272a",
              borderRadius: 2,
              minWidth: 420,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 700 }}>
          <WarningAmberIcon sx={{ color: "#f59e0b" }} />
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#a1a1aa", mt: 1 }}>
            {confirmDialog.description}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid #27272a" }}>
          <Button
            onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
            sx={{ color: "#a1a1aa", textTransform: "none", fontWeight: 600 }}
          >
            Batal
          </Button>
          <Button
            variant="contained"
            onClick={handleExecuteAction}
            sx={{
              bgcolor: "#ef4444",
              color: "#fff",
              "&:hover": { bgcolor: "#dc2626" },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1,
            }}
          >
            Ya, Jalankan Pembersihan
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── IMPORT MODAL ───────────────────────────────────────── */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#18181b",
              color: "#f4f4f5",
              border: "1px solid #27272a",
              borderRadius: 2,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <FileUploadIcon sx={{ color: "#10b981" }} />
          Import Project JSON Bundle
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 2, mt: 1 }}>
            Tempelkan isi JSON project bundle yang telah diekspor sebelumnya di bawah ini:
          </Typography>
          <TextField
            multiline
            rows={12}
            fullWidth
            placeholder='{ "project": { ... }, "clips": [ ... ], "transcript": { ... } }'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            sx={{
              bgcolor: "#121215",
              borderRadius: 1,
              fontFamily: "monospace",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#27272a" },
              "& .MuiInputBase-input": { color: "#f4f4f5", fontFamily: "monospace", fontSize: "0.85rem" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid #27272a" }}>
          <Button onClick={() => setImportOpen(false)} sx={{ color: "#a1a1aa", textTransform: "none" }}>
            Batal
          </Button>
          <Button
            variant="contained"
            disabled={importing || !importJson.trim()}
            onClick={handleImportProject}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <FileUploadIcon />}
            sx={{
              bgcolor: "#10b981",
              color: "#fff",
              "&:hover": { bgcolor: "#059669" },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1,
            }}
          >
            {importing ? "Importing..." : "Import Project Sekarang"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── SNACKBAR ───────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%", borderRadius: 1.5 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
