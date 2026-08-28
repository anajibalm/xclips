import React, { useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useStudioStore } from "../store/useStudioStore";
import { LogItem } from "../types/studio.types";

interface HumanizedLog {
  category: string;
  categoryColor: string;
  friendlyMsg: string;
  detail?: string;
  tag?: string;
}

function humanizeLogItem(item: LogItem): HumanizedLog {
  const msg = ((item.msg || item.message || "") as string).trim();
  const mod = (item.module || "").toLowerCase();
  const lvl = Number(item.level) || 30;

  // 1. Error / Failure handling
  if (
    lvl >= 50 ||
    msg.toLowerCase().includes("failed") ||
    msg.toLowerCase().includes("error") ||
    item.err
  ) {
    const rawErr = item.err
      ? typeof item.err === "string"
        ? item.err
        : (item.err as { message?: string }).message || JSON.stringify(item.err)
      : msg;

    let friendlyErr = rawErr;
    if (rawErr.toLowerCase().includes("api key") || rawErr.includes("401") || rawErr.includes("403")) {
      friendlyErr = "Kredensial API Key tidak valid atau tidak memiliki akses. Silakan periksa kembali API Key di menu Pengaturan AI.";
    } else if (rawErr.toLowerCase().includes("quota") || rawErr.includes("429")) {
      friendlyErr = "Batas kuota / rate limit API provider telah tercapai. Mohon tunggu sesaat atau beralih ke model lain.";
    } else if (rawErr.toLowerCase().includes("network") || rawErr.toLowerCase().includes("timeout") || rawErr.toLowerCase().includes("fetch failed")) {
      friendlyErr = "Koneksi ke server API terputus atau timeout saat memproses request.";
    }

    return {
      category: "Kendala Sistem",
      categoryColor: "#ef4444",
      friendlyMsg: friendlyErr,
      detail: msg !== friendlyErr ? msg : (item.module ? `Modul: ${item.module}` : undefined),
      tag: "GAGAL",
    };
  }

  // 2. AI Settings & Configuration
  if (msg.includes("Saved xclips AI settings") || mod.includes("settings")) {
    const provider = item.provider ? String(item.provider).toUpperCase() : "AI";
    const model = item.highlightModel || item.model ? ` · Model: ${item.highlightModel || item.model}` : "";
    return {
      category: "Konfigurasi AI",
      categoryColor: "#8b5cf6",
      friendlyMsg: `Pengaturan AI berhasil disimpan dan diperbarui (Provider: ${provider}${model}).`,
      tag: "PENGATURAN",
    };
  }

  // 3. Audio Extraction & Speech-to-Text Transcription
  if (
    msg.toLowerCase().includes("transcribe") ||
    mod.includes("transcribe") ||
    msg.toLowerCase().includes("audio wav") ||
    msg.toLowerCase().includes("speech")
  ) {
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("parsed")) {
      return {
        category: "Transkrip Audio",
        categoryColor: "#10b981",
        friendlyMsg: "Transkripsi kata & timestamp selesai. Teks subtitle telah tersinkronisasi dan siap disunting.",
        tag: "SELESAI",
      };
    }
    const provider = item.provider ? ` via ${item.provider}` : "";
    return {
      category: "Transkrip Audio",
      categoryColor: "#3b82f6",
      friendlyMsg: `Mengekstrak suara dan memetakan kata-per-kata video master${provider}...`,
      tag: "PROSES",
    };
  }

  // 4. Highlight & Viral Clip Discovery
  if (
    msg.toLowerCase().includes("highlight") ||
    msg.toLowerCase().includes("discover") ||
    mod.includes("chunker") ||
    msg.toLowerCase().includes("viral")
  ) {
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("ranked") || msg.toLowerCase().includes("success")) {
      const count = item.count || item.totalClips || (Array.isArray(item.clips) ? item.clips.length : "");
      return {
        category: "Pencarian Klip",
        categoryColor: "#10b981",
        friendlyMsg: `AI berhasil menemukan ${count ? `${count} ` : ""}segmen momen terbaik dengan skor viralitas tinggi.`,
        tag: "SELESAI",
      };
    }
    return {
      category: "Pencarian Klip",
      categoryColor: "#3b82f6",
      friendlyMsg: "AI sedang menganalisis narasi transkrip untuk mendeteksi hook pembuka dan momen paling menarik...",
      tag: "PROSES",
    };
  }

  // 5. Media Downloader & Ingestion (YouTube, TikTok, Instagram)
  if (
    msg.toLowerCase().includes("download") ||
    mod.includes("ytdlp") ||
    mod.includes("downloader") ||
    msg.toLowerCase().includes("ingest")
  ) {
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("success") || msg.toLowerCase().includes("finished")) {
      return {
        category: "Unduh Media",
        categoryColor: "#10b981",
        friendlyMsg: "File video berhasil diunduh dan disimpan ke Assets Library.",
        detail: item.title ? `Judul: ${String(item.title)}` : (item.url ? `Sumber: ${String(item.url)}` : undefined),
        tag: "SUKSES",
      };
    }
    if (item.percent !== undefined) {
      return {
        category: "Unduh Media",
        categoryColor: "#3b82f6",
        friendlyMsg: `Sedang mengunduh file media (${item.percent}%)...`,
        detail: item.speedStr ? `Kecepatan: ${item.speedStr} | Sisa Waktu: ${item.etaStr || "--:--"}` : undefined,
        tag: "UNDUH",
      };
    }
    return {
      category: "Unduh Media",
      categoryColor: "#3b82f6",
      friendlyMsg: "Memulai proses pengunduhan media video dari tautan eksternal...",
      detail: item.url ? `URL: ${String(item.url)}` : undefined,
      tag: "UNDUH",
    };
  }

  // 6. Video Rendering & Export (FFmpeg / NVENC)
  if (
    msg.toLowerCase().includes("render") ||
    mod.includes("ffmpeg") ||
    mod.includes("queue") ||
    msg.toLowerCase().includes("export")
  ) {
    if (msg.toLowerCase().includes("completed") || msg.toLowerCase().includes("finished") || msg.toLowerCase().includes("done")) {
      return {
        category: "Render Video",
        categoryColor: "#10b981",
        friendlyMsg: "Render video vertikal 9:16 selesai! Video kualitas tinggi siap diunduh.",
        detail: item.outputPath ? `Output: ${String(item.outputPath)}` : undefined,
        tag: "SELESAI",
      };
    }
    return {
      category: "Render Video",
      categoryColor: "#3b82f6",
      friendlyMsg: "Memproses pembuatan video vertikal 9:16, penyesuaian layout latar, dan efek karaoke subtitle...",
      detail: item.filterPreset ? `Preset: ${String(item.filterPreset)}` : undefined,
      tag: "RENDER",
    };
  }

  // 7. Filler & Silence Detector
  if (msg.toLowerCase().includes("filler") || mod.includes("filler")) {
    return {
      category: "Pembersihan Audio",
      categoryColor: "#06b6d4",
      friendlyMsg: "Memindai jeda hening dan kata-kata filler ('eh', 'anu', 'hmm') untuk meningkatkan retensi penonton.",
      tag: "OPTIMASI",
    };
  }

  // 8. Subtitles / Style
  if (msg.toLowerCase().includes("subtitle") || mod.includes("subtitle") || msg.includes("ass")) {
    return {
      category: "Gaya Subtitle",
      categoryColor: "#f59e0b",
      friendlyMsg: "Menyinkronkan tata letak teks subtitle, font kustom, dan animasi penyorotan kata.",
      tag: "SUBTITLE",
    };
  }

  // 9. Warnings
  if (lvl >= 40 || msg.toLowerCase().includes("warn")) {
    return {
      category: "Peringatan",
      categoryColor: "#f59e0b",
      friendlyMsg: msg || "Peringatan sistem saat menjalankan tahapan proses.",
      detail: item.err ? String(item.err) : undefined,
      tag: "PERINGATAN",
    };
  }

  // 10. General Informative Activity
  return {
    category: "Aktivitas Sistem",
    categoryColor: "#3b82f6",
    friendlyMsg: msg || "Operasi sistem berhasil dijalankan.",
    detail: item.module ? `Modul: ${String(item.module)}` : undefined,
    tag: "INFO",
  };
}

const getLevelLabel = (lvl?: unknown) => {
  const num = Number(lvl);
  if (isNaN(num)) return "INFO";
  if (num >= 50) return "ERROR";
  if (num >= 40) return "WARN";
  if (num >= 30) return "INFO";
  return "DEBUG";
};

export function TabLogs() {
  const logs = useStudioStore((s) => s.logs);
  const logsFilter = useStudioStore((s) => s.logsFilter);
  const setLogsFilter = useStudioStore((s) => s.setLogsFilter);
  const autoRefreshLogs = useStudioStore((s) => s.autoRefreshLogs);
  const setAutoRefreshLogs = useStudioStore((s) => s.setAutoRefreshLogs);
  const copiedLogs = useStudioStore((s) => s.copiedLogs);
  const fetchLogs = useStudioStore((s) => s.fetchLogs);
  const handleCopyLogs = useStudioStore((s) => s.handleCopyLogs);

  // Auto-refresh logs timer
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, fetchLogs]);

  const filteredLogs = logs.filter((item) => {
    if (logsFilter === "ALL") return true;
    const lvlName = getLevelLabel(item.level);
    return lvlName === logsFilter;
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.9rem" }}>
            Process Logs ({filteredLogs.length})
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
              />
            }
            label={<Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.72rem" }}>Live (2s)</Typography>}
          />
          <IconButton size="small" onClick={() => fetchLogs()} sx={{ color: "#a1a1aa" }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={handleCopyLogs}
            sx={{ color: "#a1a1aa", borderColor: "#27272a", textTransform: "none", fontSize: "0.72rem", borderRadius: 0.8, py: 0.3 }}
          >
            {copiedLogs ? "Copied!" : "Copy"}
          </Button>
        </Box>
      </Box>

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 0.6, mb: 1.5, flexWrap: "wrap" }}>
        {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((filterName) => (
          <Chip
            key={filterName}
            label={filterName}
            size="small"
            onClick={() => setLogsFilter(filterName)}
            sx={{
              bgcolor: logsFilter === filterName ? "#3b82f6" : "#141418",
              color: logsFilter === filterName ? "#ffffff" : "#a1a1aa",
              fontWeight: 700,
              fontSize: "0.68rem",
              height: 20,
              borderRadius: 0.6,
              cursor: "pointer",
            }}
          />
        ))}
      </Box>

      {/* Human-Friendly Log Stream Container */}
      <Box
        sx={{
          maxHeight: "calc(100vh - 300px)",
          overflowY: "auto",
          p: 1.2,
          bgcolor: "#09090b",
          borderRadius: 1,
          border: "1px solid #27272a",
          display: "flex",
          flexDirection: "column",
          gap: 0.8,
        }}
      >
        {filteredLogs.length === 0 ? (
          <Typography variant="caption" sx={{ color: "#52525b", py: 4, textAlign: "center" }}>
            Belum ada aktivitas log untuk project ini.
          </Typography>
        ) : (
          filteredLogs.map((item, idx) => {
            const h = humanizeLogItem(item);
            const timeVal = (item as { time?: unknown; timestamp?: unknown }).time || (item as { time?: unknown; timestamp?: unknown }).timestamp;
            const timeStr = timeVal
              ? new Date(typeof timeVal === "number" ? timeVal : String(timeVal)).toLocaleTimeString("id-ID", { hour12: false })
              : "--:--:--";

            return (
              <Box
                key={idx}
                sx={{
                  px: 1.4,
                  py: 1,
                  bgcolor: "#121217",
                  borderRadius: 1,
                  borderLeft: `3px solid ${h.categoryColor}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.4,
                  transition: "background-color 0.15s ease",
                  "&:hover": { bgcolor: "#181820" },
                }}
              >
                {/* Header: Category Badge + Tag + Time */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                  <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
                    <Chip
                      label={h.category}
                      size="small"
                      sx={{
                        bgcolor: `${h.categoryColor}18`,
                        color: h.categoryColor,
                        border: `1px solid ${h.categoryColor}40`,
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        height: 20,
                        borderRadius: 0.6,
                        px: 0.4,
                      }}
                    />
                    {h.tag && (
                      <span style={{ color: "#71717a", fontSize: "0.65rem", fontWeight: 700 }}>
                        · {h.tag}
                      </span>
                    )}
                  </Box>
                  <span style={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace" }}>
                    {timeStr}
                  </span>
                </Box>

                {/* Friendly Main Message */}
                <Typography sx={{ color: "#f4f4f5", fontWeight: 600, fontSize: "0.8rem", lineHeight: 1.45 }}>
                  {h.friendlyMsg}
                </Typography>

                {/* Sub Detail if available */}
                {h.detail && (
                  <Typography sx={{ color: "#71717a", fontSize: "0.68rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {h.detail}
                  </Typography>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
