import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  TextField,
  InputAdornment,
  FormControlLabel,
  RadioGroup,
  Radio,
  Slider,
  Switch,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import CropIcon from "@mui/icons-material/Crop";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import SubtitlesOffIcon from "@mui/icons-material/SubtitlesOff";
import FontDownloadIcon from "@mui/icons-material/FontDownload";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import CropPortraitIcon from "@mui/icons-material/CropPortrait";
import CropLandscapeIcon from "@mui/icons-material/CropLandscape";
import PaletteIcon from "@mui/icons-material/Palette";
import { useStudioStore } from "../store/useStudioStore";
import { LayoutMode, AspectRatio, SubtitleStyle, SubtitlePreset } from "@/lib/xclips/types";
import { PRESET_STYLES, GOOGLE_FONTS_CATALOG, DEFAULT_SUBTITLE_STYLE } from "../types/studio.types";

interface AspectRatioOption {
  id: AspectRatio;
  name: string;
  resolution: string;
  platform: string;
  description: string;
  icon: React.ReactNode;
  aspectBoxRatio: string;
}

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: "9:16",
    name: "9:16 Vertical",
    resolution: "1080 × 1920",
    platform: "TikTok · Reels · Shorts",
    description: "Format vertikal standar FYP TikTok, IG Reels, dan YT Shorts.",
    icon: <SmartphoneIcon sx={{ fontSize: "1.1rem" }} />,
    aspectBoxRatio: "9/16",
  },
  {
    id: "1:1",
    name: "1:1 Square",
    resolution: "1080 × 1080",
    platform: "Instagram · FB Feed",
    description: "Format persegi simetris untuk feed post media sosial.",
    icon: <CropSquareIcon sx={{ fontSize: "1.1rem" }} />,
    aspectBoxRatio: "1/1",
  },
  {
    id: "4:5",
    name: "4:5 Portrait",
    resolution: "1080 × 1350",
    platform: "IG Feed Portrait",
    description: "Format feed vertikal optimal layar mobile tanpa terpotong.",
    icon: <CropPortraitIcon sx={{ fontSize: "1.1rem" }} />,
    aspectBoxRatio: "4/5",
  },
  {
    id: "16:9",
    name: "16:9 Landscape",
    resolution: "1920 × 1080",
    platform: "YouTube · Desktop",
    description: "Format widescreen standar untuk video horizontal & desktop.",
    icon: <CropLandscapeIcon sx={{ fontSize: "1.1rem" }} />,
    aspectBoxRatio: "16/9",
  },
];

export function TabFramingStyle() {
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const handleSaveClip = useStudioStore((s) => s.handleSaveClip);
  const studioAspectRatio = useStudioStore((s) => s.studioAspectRatio);
  const setStudioAspectRatio = useStudioStore((s) => s.setStudioAspectRatio);
  const studioLayoutMode = useStudioStore((s) => s.studioLayoutMode);
  const setStudioLayoutMode = useStudioStore((s) => s.setStudioLayoutMode);
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
  const setStudioSubtitleStyle = useStudioStore((s) => s.setStudioSubtitleStyle);

  const [styleSubTab, setStyleSubTab] = useState<number>(0);
  const [fontSearch, setFontSearch] = useState("");

  const currentAspectRatio: AspectRatio = selectedClip?.aspectRatio || studioAspectRatio || "9:16";
  const currentLayoutMode: LayoutMode = selectedClip?.layoutMode || studioLayoutMode || "blur_bg";
  const currentPanOffsetX: number = selectedClip?.panOffsetX ?? studioPanOffsetX ?? 0;
  const currentVideoScale: number = selectedClip?.videoScale ?? studioVideoScale ?? 1.0;
  const currentVideoPanX: number = selectedClip?.videoPanX ?? selectedClip?.panOffsetX ?? studioVideoPanX ?? 0;
  const currentVideoPanY: number = selectedClip?.videoPanY ?? studioVideoPanY ?? 0;
  const currentVideoRotation: number = selectedClip?.videoRotation ?? studioVideoRotation ?? 0;
  const currentStyle: SubtitleStyle = selectedClip?.subtitleStyle || studioSubtitleStyle || DEFAULT_SUBTITLE_STYLE;

  const updateVideoScale = (scale: number) => {
    setStudioVideoScale(scale);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        videoScale: scale,
      });
    }
  };

  const updateVideoPanX = (x: number) => {
    setStudioVideoPanX(x);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        videoPanX: x,
        panOffsetX: x,
      });
    }
  };

  const updateVideoPanY = (y: number) => {
    setStudioVideoPanY(y);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        videoPanY: y,
      });
    }
  };

  const updateVideoRotation = (rot: number) => {
    setStudioVideoRotation(rot);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        videoRotation: rot,
      });
    }
  };

  const updateSubtitleStyle = (newStyle: SubtitleStyle) => {
    setStudioSubtitleStyle(newStyle);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        subtitleStyle: newStyle,
      });
    }
  };

  const updateSubtitleStylePreview = (newStyle: SubtitleStyle) => {
    setStudioSubtitleStyle(newStyle);
  };

  const updateSubtitleStyleCommitted = (newStyle: SubtitleStyle) => {
    setStudioSubtitleStyle(newStyle);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        subtitleStyle: newStyle,
      });
    }
  };

  const updateLayoutMode = (mode: LayoutMode) => {
    setStudioLayoutMode(mode);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        layoutMode: mode,
      });
    }
  };

  const updatePanOffsetX = (pan: number) => {
    setStudioPanOffsetX(pan);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        panOffsetX: pan,
      });
    }
  };

  const updatePanOffsetPreview = (pan: number) => {
    setStudioPanOffsetX(pan);
  };

  const updatePanOffsetCommitted = (pan: number) => {
    setStudioPanOffsetX(pan);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        panOffsetX: pan,
      });
    }
  };

  const updateAspectRatio = (ratio: AspectRatio) => {
    setStudioAspectRatio(ratio);
    if (selectedClip) {
      handleSaveClip({
        ...selectedClip,
        aspectRatio: ratio,
      });
    }
  };

  const handleApplyPreset = (preset: SubtitlePreset) => {
    const presetOverrides = PRESET_STYLES[preset];
    const newStyle: SubtitleStyle = {
      ...currentStyle,
      ...presetOverrides,
      preset,
    };
    updateSubtitleStyle(newStyle);
  };

  return (
    <Box>
      {/* Context Badge Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, p: 1.2, bgcolor: "#111116", borderRadius: 1, border: "1px solid #27272a" }}>
        <Box>
          <Typography variant="body2" sx={{ color: "#fafafa", fontWeight: 700, fontSize: "0.85rem" }}>
            {selectedClip ? `Active Clip Framing & Style` : `Master Video Template (Global Style)`}
          </Typography>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
            {selectedClip
              ? `Customizing style for current clip (${(selectedClip.endSec - selectedClip.startSec).toFixed(1)}s duration)`
              : `Configuring layout & subtitle style template for the full master video`}
          </Typography>
        </Box>

        <Chip
          label={selectedClip ? "CLIP LEVEL" : "MASTER VIDEO"}
          size="small"
          sx={{
            bgcolor: selectedClip ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
            color: selectedClip ? "#60a5fa" : "#34d399",
            fontWeight: 800,
            fontSize: "0.65rem",
            border: selectedClip ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
          }}
        />
      </Box>

      {/* Subtabs Header */}
      <Tabs
        value={styleSubTab}
        onChange={(_, val) => setStyleSubTab(val)}
        sx={{
          minHeight: 38,
          mb: 2.5,
          borderBottom: "1px solid #27272a",
          "& .MuiTabs-indicator": {
            bgcolor: "#3b82f6",
            height: 2.5,
            borderRadius: "2px 2px 0 0",
          },
          "& .MuiTab-root": {
            minHeight: 38,
            py: 0.8,
            px: 1.5,
            fontSize: "0.78rem",
            fontWeight: 700,
            textTransform: "none",
            color: "#71717a",
            "&.Mui-selected": {
              color: "#3b82f6",
            },
            "&:hover": {
              color: "#d4d4d8",
            },
          },
        }}
      >
        <Tab icon={<CropIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Aspect & Framing" />
        <Tab icon={<SubtitlesIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Presets & Subtitles" />
        <Tab icon={<FontDownloadIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Typography & Colors" />
      </Tabs>

      {/* SUBTAB 0: ASPECT RATIO & FRAMING */}
      {styleSubTab === 0 && (
        <Box>
          {/* 1. ASPECT RATIO & PLATFORM STANDARDS */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.2 }}>
              <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.92rem" }}>
                1. Aspect Ratio &amp; Platform Standard
              </Typography>
              <Chip
                label={`${currentAspectRatio} (${ASPECT_RATIO_OPTIONS.find((o) => o.id === currentAspectRatio)?.resolution || "1080x1920"})`}
                size="small"
                sx={{
                  bgcolor: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 1.5 }}>
              Pilih rasio aspek sesuai platform tujuan (TikTok VT, IG Reels, Shorts, Post Feed, atau YouTube).
            </Typography>

            <Grid container spacing={1.5}>
              {ASPECT_RATIO_OPTIONS.map((opt) => {
                const isSelected = currentAspectRatio === opt.id;
                return (
                  <Grid key={opt.id} size={{ xs: 6, sm: 3 }}>
                    <Card
                      onClick={() => updateAspectRatio(opt.id)}
                      sx={{
                        p: 1.5,
                        bgcolor: isSelected ? "rgba(59, 130, 246, 0.12)" : "#141418",
                        border: isSelected ? "2px solid #3b82f6" : "1px solid #27272a",
                        borderRadius: 1.2,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
                        "&:hover": {
                          borderColor: isSelected ? "#3b82f6" : "#3f3f46",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 0.8,
                            bgcolor: isSelected ? "rgba(59, 130, 246, 0.25)" : "#1e1e24",
                            color: isSelected ? "#60a5fa" : "#a1a1aa",
                          }}
                        >
                          {opt.icon}
                        </Box>
                        {isSelected && (
                          <Chip
                            label="ACTIVE"
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "#ffffff",
                              fontWeight: 900,
                              fontSize: "0.58rem",
                              height: 18,
                              borderRadius: 0.5,
                            }}
                          />
                        )}
                      </Box>

                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.82rem", mb: 0.2 }}>
                        {opt.name}
                      </Typography>

                      <Typography variant="caption" sx={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.68rem", display: "block", mb: 0.5 }}>
                        {opt.platform}
                      </Typography>

                      <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.65rem", display: "block", lineHeight: 1.25 }}>
                        {opt.description}
                      </Typography>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <Divider sx={{ borderColor: "#27272a", my: 2.5 }} />

          {/* 2. LAYOUT MODES */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.2, fontSize: "0.9rem" }}>
            2. Framing Layout ({currentAspectRatio})
          </Typography>
          <RadioGroup
            row
            value={currentLayoutMode}
            onChange={(e) => updateLayoutMode(e.target.value as LayoutMode)}
            sx={{ mb: 2 }}
          >
            <FormControlLabel
              value="blur_bg"
              control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <BlurOnIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Blur Background</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="center_crop"
              control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CropIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Center Crop</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="split_screen"
              control={<Radio size="small" sx={{ color: "#3b82f6" }} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <ViewAgendaIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>Split Screen</Typography>
                </Box>
              }
            />
          </RadioGroup>

          {currentLayoutMode === "center_crop" && (
            <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a" }}>
              <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 0.5, fontWeight: 600 }}>
                Horizontal Speaker Pan ({(currentPanOffsetX || 0).toFixed(2)})
              </Typography>
              <Slider
                min={-1.0}
                max={1.0}
                step={0.05}
                value={currentPanOffsetX || 0}
                onChange={(_, val) => updatePanOffsetPreview(val as number)}
                onChangeCommitted={(_, val) => updatePanOffsetCommitted(val as number)}
                sx={{ color: "#3b82f6" }}
              />
            </Box>
          )}

          {/* 3. VIDEO TRANSFORM & PLACEMENT */}
          <Box sx={{ mb: 2.5, p: 2, bgcolor: "#141418", borderRadius: 1.5, border: "1px solid #27272a" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, fontSize: "0.88rem" }}>
                  3. Video Transform &amp; Placement
                </Typography>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
                  Sesuaikan ukuran zoom, posisi pan horizontal/vertikal, dan rotasi video.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  updateVideoScale(1.0);
                  updateVideoPanX(0);
                  updateVideoPanY(0);
                  updateVideoRotation(0);
                }}
                sx={{
                  color: "#a1a1aa",
                  borderColor: "#27272a",
                  fontSize: "0.7rem",
                  py: 0.2,
                  px: 1,
                  textTransform: "none",
                  "&:hover": { borderColor: "#00e5ff", color: "#00e5ff" },
                }}
              >
                Reset All
              </Button>
            </Box>

            {/* Video Zoom / Scale Slider */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 600 }}>
                  Zoom / Scale ({Math.round(currentVideoScale * 100)}%)
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => updateVideoScale(1.0)}
                  sx={{ color: "#71717a", fontSize: "0.68rem", p: 0, minWidth: "auto", textTransform: "none" }}
                >
                  100%
                </Button>
              </Box>
              <Slider
                min={0.5}
                max={3.0}
                step={0.05}
                value={currentVideoScale}
                onChange={(_, val) => updateVideoScale(val as number)}
                sx={{ color: "#00e5ff" }}
              />
            </Box>

            {/* Horizontal Position X Slider */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 600 }}>
                  Horizontal Position X ({Math.round(currentVideoPanX * 100)}%)
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => updateVideoPanX(0)}
                  sx={{ color: "#71717a", fontSize: "0.68rem", p: 0, minWidth: "auto", textTransform: "none" }}
                >
                  Center (0)
                </Button>
              </Box>
              <Slider
                min={-1.0}
                max={1.0}
                step={0.02}
                value={currentVideoPanX}
                onChange={(_, val) => updateVideoPanX(val as number)}
                sx={{ color: "#00e5ff" }}
              />
            </Box>

            {/* Vertical Position Y Slider */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 600 }}>
                  Vertical Position Y ({Math.round(currentVideoPanY * 100)}%)
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => updateVideoPanY(0)}
                  sx={{ color: "#71717a", fontSize: "0.68rem", p: 0, minWidth: "auto", textTransform: "none" }}
                >
                  Center (0)
                </Button>
              </Box>
              <Slider
                min={-1.0}
                max={1.0}
                step={0.02}
                value={currentVideoPanY}
                onChange={(_, val) => updateVideoPanY(val as number)}
                sx={{ color: "#00e5ff" }}
              />
            </Box>

            {/* Video Rotation Slider */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 600 }}>
                  Rotation ({currentVideoRotation}°)
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => updateVideoRotation(0)}
                  sx={{ color: "#71717a", fontSize: "0.68rem", p: 0, minWidth: "auto", textTransform: "none" }}
                >
                  0°
                </Button>
              </Box>
              <Slider
                min={-180}
                max={180}
                step={1}
                value={currentVideoRotation}
                onChange={(_, val) => updateVideoRotation(val as number)}
                sx={{ color: "#00e5ff" }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* SUBTAB 1: PRESETS & SUBTITLES */}
      {styleSubTab === 1 && (
        <Box>
          {/* SUBTITLE MASTER TOGGLE */}
          <Box
            sx={{
              p: 1.8,
              bgcolor: currentStyle.enabled !== false ? "rgba(59, 130, 246, 0.05)" : "#131317",
              borderRadius: 1,
              border: currentStyle.enabled !== false ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid #27272a",
              mb: 2.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ p: 0.8, bgcolor: currentStyle.enabled !== false ? "rgba(59, 130, 246, 0.15)" : "#1c1c22", borderRadius: 0.8 }}>
                {currentStyle.enabled !== false ? (
                  <SubtitlesIcon sx={{ color: "#3b82f6", fontSize: "1.2rem" }} />
                ) : (
                  <SubtitlesOffIcon sx={{ color: "#71717a", fontSize: "1.2rem" }} />
                )}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.88rem" }}>
                  Subtitle &amp; Caption
                </Typography>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem", display: "block" }}>
                  {currentStyle.enabled !== false
                    ? "Teks subtitle aktif dan akan dirender ke video ekspor"
                    : "Subtitle dinonaktifkan — video akan dirender tanpa teks subtitle"}
                </Typography>
              </Box>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={currentStyle.enabled !== false}
                  onChange={(e) =>
                    updateSubtitleStyle({ ...currentStyle, enabled: e.target.checked })
                  }
                  sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 700, color: currentStyle.enabled !== false ? "#3b82f6" : "#71717a" }}>
                  {currentStyle.enabled !== false ? "Aktif" : "Nonaktif"}
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Box>

          {/* SUBTITLE DISABLED BANNER */}
          {currentStyle.enabled === false ? (
            <Box
              sx={{
                p: 3.5,
                bgcolor: "#121216",
                borderRadius: 1,
                border: "1px dashed #27272a",
                textAlign: "center",
                my: 2,
              }}
            >
              <SubtitlesOffIcon sx={{ fontSize: 36, color: "#71717a", mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 800, color: "#e4e4e7", mb: 0.5 }}>
                Subtitle Sedang Dinonaktifkan
              </Typography>
              <Typography variant="caption" sx={{ color: "#71717a", maxWidth: 380, display: "block", mx: "auto", mb: 2 }}>
                Video akan diekspor dalam format bersih tanpa caption. Nyalakan sakelar di atas jika ingin menampilkan dan mengkustomisasi subtitle.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  updateSubtitleStyle({ ...currentStyle, enabled: true })
                }
                startIcon={<SubtitlesIcon fontSize="small" />}
                sx={{
                  color: "#60a5fa",
                  borderColor: "#3b82f6",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  borderRadius: 1,
                  "&:hover": { bgcolor: "rgba(59, 130, 246, 0.1)", borderColor: "#60a5fa" },
                }}
              >
                Aktifkan Subtitle
              </Button>
            </Box>
          ) : (
            <Box>
              {/* PRESET SELECTOR WITH LIVE SAMPLE CAPTIONS */}
              <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
                Instant Subtitle Presets
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 3 }}>
                {[
                  {
                    id: "plain",
                    label: "Standard Clean",
                    desc: "Classic crisp white subtitles",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0a0a0c", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 700, color: "#FFFFFF", textShadow: "0 0 4px #000" }}>
                          STANDARD CLEAN WHITE
                        </span>
                      </Box>
                    ),
                  },
                  {
                    id: "hormozi",
                    label: "Hormozi Viral",
                    desc: "Bold impact, yellow active glow",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0a0a0c", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Anton, Impact", fontSize: "14px", fontWeight: 900, color: "#FACC15", textShadow: "0 0 8px #FACC15, 0 2px 4px #000", textTransform: "uppercase" }}>
                          DYNAMIC{" "}
                        </span>
                        <span style={{ fontFamily: "Anton, Impact", fontSize: "14px", fontWeight: 900, color: "#FFFFFF", textShadow: "0 0 2px #000, 0 2px 4px #000", textTransform: "uppercase" }}>
                          VIRAL HOOK
                        </span>
                      </Box>
                    ),
                  },
                  {
                    id: "beast",
                    label: "MrBeast Action",
                    desc: "Punchy sky blue & white stroke",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#05070d", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Bebas Neue", fontSize: "15px", fontWeight: 900, color: "#38BDF8", textShadow: "0 0 8px #38BDF8", textTransform: "uppercase" }}>
                          INSANE{" "}
                        </span>
                        <span style={{ fontFamily: "Bebas Neue", fontSize: "15px", fontWeight: 900, color: "#FFFFFF", textShadow: "0 0 4px #000", textTransform: "uppercase" }}>
                          CHALLENGE
                        </span>
                      </Box>
                    ),
                  },
                  {
                    id: "neon_glow",
                    label: "Neon Cyberpunk",
                    desc: "Pink & electric purple aura",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0d0514", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Syne", fontSize: "13px", fontWeight: 900, color: "#F472B6", textShadow: "0 0 10px #F472B6", textTransform: "uppercase" }}>
                          NEON{" "}
                        </span>
                        <span style={{ fontFamily: "Syne", fontSize: "13px", fontWeight: 900, color: "#A855F7", textShadow: "0 0 10px #A855F7", textTransform: "uppercase" }}>
                          CYBER GLOW
                        </span>
                      </Box>
                    ),
                  },
                  {
                    id: "minimal",
                    label: "Minimalist Clean",
                    desc: "Modern soft typography",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0c0c0e", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 600, color: "#93C5FD", letterSpacing: "0.02em" }}>
                          minimalist{" "}
                        </span>
                        <span style={{ fontFamily: "Inter", fontSize: "13px", fontWeight: 600, color: "#F4F4F5", letterSpacing: "0.02em" }}>
                          typography
                        </span>
                      </Box>
                    ),
                  },
                  {
                    id: "cinema",
                    label: "Cinema Serif",
                    desc: "Editorial Playfair elegance",
                    sample: (
                      <Box sx={{ mt: 1, p: 0.8, bgcolor: "#0e0e11", borderRadius: 0.8, textAlign: "center" }}>
                        <span style={{ fontFamily: "Playfair Display", fontSize: "13px", fontWeight: 700, color: "#E2E8F0", fontStyle: "italic" }}>
                          Cinematic Narrative Story
                        </span>
                      </Box>
                    ),
                  },
                ].map((preset) => {
                  const isCurrent = currentStyle.preset === preset.id;
                  return (
                    <Grid key={preset.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Card
                        onClick={() => handleApplyPreset(preset.id as SubtitlePreset)}
                        sx={{
                          p: 1.5,
                          bgcolor: isCurrent ? "rgba(59, 130, 246, 0.1)" : "#141418",
                          border: isCurrent ? "1.5px solid #3b82f6" : "1px solid #27272a",
                          borderRadius: 1,
                          cursor: "pointer",
                          "&:hover": { borderColor: isCurrent ? "#3b82f6" : "#3f3f46" },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "0.85rem" }}>
                            {preset.label}
                          </Typography>
                          {isCurrent && (
                            <Chip label="Active" size="small" sx={{ bgcolor: "#3b82f6", color: "#fff", fontSize: "0.62rem", height: 18, borderRadius: 0.6, fontWeight: 800 }} />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.72rem" }}>
                          {preset.desc}
                        </Typography>
                        {preset.sample}
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ borderColor: "#27272a", my: 2 }} />

              {/* TEXT CASE SWITCHER & KARAOKE TOGGLE */}
              <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1, fontSize: "0.9rem" }}>
                Text Case Format
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
                {[
                  { id: "uppercase", label: "UPPERCASE" },
                  { id: "capitalize", label: "Capitalize Words" },
                  { id: "lowercase", label: "lowercase" },
                ].map((item) => {
                  const isSelected =
                    (currentStyle.textCase === item.id) ||
                    (item.id === "uppercase" && currentStyle.allCaps && !currentStyle.textCase);

                  return (
                    <Button
                      key={item.id}
                      variant={isSelected ? "contained" : "outlined"}
                      size="small"
                      onClick={() =>
                        updateSubtitleStyle({
                          ...currentStyle,
                          textCase: item.id as "uppercase" | "capitalize" | "lowercase",
                          allCaps: item.id === "uppercase",
                        })
                      }
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        borderRadius: 1,
                        bgcolor: isSelected ? "#3b82f6" : "transparent",
                        borderColor: isSelected ? "#3b82f6" : "#27272a",
                        color: isSelected ? "#ffffff" : "#a1a1aa",
                        "&:hover": { borderColor: "#3f3f46", bgcolor: isSelected ? "#2563eb" : "#18181c" },
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentStyle.karaokeEnabled !== false}
                      onChange={(e) =>
                        updateSubtitleStyle({ ...currentStyle, karaokeEnabled: e.target.checked })
                      }
                      sx={{ "& .Mui-checked": { color: "#3b82f6" } }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>Karaoke Active Word Highlight</Typography>}
                />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* SUBTAB 2: TYPOGRAPHY & COLORS */}
      {styleSubTab === 2 && (
        <Box>
          {/* 1. CLOUD FONT SELECTOR (20 GOOGLE FONTS) */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
            1. Font Cloud (20 Curated Google Fonts)
          </Typography>

          <Box sx={{ mb: 2.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search fonts (e.g. Inter, Anton, Montserrat, Oswald)..."
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <FontDownloadIcon fontSize="small" sx={{ color: "#71717a" }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mb: 1.2,
                "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem" },
                "& .MuiOutlinedInput-root": { bgcolor: "#0d0d10", borderRadius: 1, "& fieldset": { borderColor: "#27272a" } },
              }}
            />

            {/* Font Chips Cloud Grid */}
            <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", maxHeight: 150, overflowY: "auto", p: 0.5 }}>
              {GOOGLE_FONTS_CATALOG.filter((f) => f.name.toLowerCase().includes(fontSearch.toLowerCase())).map((font) => {
                const isSelected = currentStyle.fontFamily === font.name;
                return (
                  <Box
                    key={font.id}
                    onClick={() =>
                      updateSubtitleStyle({ ...currentStyle, fontFamily: font.name })
                    }
                    sx={{
                      px: 1.2,
                      py: 0.6,
                      bgcolor: isSelected ? "#3b82f6" : "#18181c",
                      color: isSelected ? "#ffffff" : "#d4d4d8",
                      fontFamily: font.name,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      borderRadius: 0.8,
                      border: isSelected ? "1px solid #3b82f6" : "1px solid #27272a",
                      cursor: "pointer",
                      userSelect: "none",
                      "&:hover": { borderColor: "#3f3f46", bgcolor: isSelected ? "#3b82f6" : "#222228" },
                    }}
                  >
                    {font.name}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#27272a", my: 2 }} />

          {/* 2. COLORS & SLIDERS */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
            2. Typography Colors &amp; Position
          </Typography>

          <Grid container spacing={2}>
            {/* Color Customizers */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                    Primary Text Color:
                  </Typography>
                  <input
                    type="color"
                    value={currentStyle.primaryColor || "#FFFFFF"}
                    onChange={(e) =>
                      updateSubtitleStyle({ ...currentStyle, primaryColor: e.target.value })
                    }
                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                  />
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                    Karaoke Active Word Color:
                  </Typography>
                  <input
                    type="color"
                    value={currentStyle.highlightColor || currentStyle.secondaryColor || "#FFFFFF"}
                    onChange={(e) =>
                      updateSubtitleStyle({
                        ...currentStyle,
                        highlightColor: e.target.value,
                        secondaryColor: e.target.value,
                      })
                    }
                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                  />
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>
                    Outline / Stroke Color:
                  </Typography>
                  <input
                    type="color"
                    value={currentStyle.outlineColor || "#000000"}
                    onChange={(e) =>
                      updateSubtitleStyle({ ...currentStyle, outlineColor: e.target.value })
                    }
                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Sub-Column 2: Sliders (Size, Outline, Position Y) */}
            <Grid size={{ xs: 12, md: 6 }}>
              {/* Font Size (Min: 0, Max: 999, Default: 44) */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Font Size</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={currentStyle.fontSize ?? 44}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(999, val));
                      updateSubtitleStyle({ ...currentStyle, fontSize: clamped });
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          width: 64,
                          height: 24,
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          color: "#3b82f6",
                          fontWeight: 700,
                          bgcolor: "#0d0d10",
                          borderRadius: 0.8,
                          p: 0,
                          "& input": { textAlign: "center", p: "2px 4px" },
                          "& fieldset": { borderColor: "#27272a" },
                        },
                      },
                    }}
                  />
                </Box>
                <Slider
                  min={0}
                  max={999}
                  step={1}
                  value={Math.max(0, Math.min(999, currentStyle.fontSize ?? 44))}
                  onChange={(_, val) =>
                    updateSubtitleStylePreview({ ...currentStyle, fontSize: val as number })
                  }
                  onChangeCommitted={(_, val) =>
                    updateSubtitleStyleCommitted({ ...currentStyle, fontSize: val as number })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Outline Width */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Stroke Width</Typography>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace" }}>{currentStyle.outlineWidth ?? 2}px</Typography>
                </Box>
                <Slider
                  min={0}
                  max={8}
                  step={0.5}
                  value={currentStyle.outlineWidth ?? 2}
                  onChange={(_, val) =>
                    updateSubtitleStylePreview({ ...currentStyle, outlineWidth: val as number })
                  }
                  onChangeCommitted={(_, val) =>
                    updateSubtitleStyleCommitted({ ...currentStyle, outlineWidth: val as number })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Position X (Horizontal) */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Horizontal Position (X)</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" sx={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>
                      {currentStyle.positionX ?? 50}%
                    </Typography>
                    {(currentStyle.positionX ?? 50) !== 50 && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => updateSubtitleStyleCommitted({ ...currentStyle, positionX: 50 })}
                        sx={{ fontSize: "0.62rem", py: 0, px: 0.8, height: 18, minWidth: 0, color: "#a1a1aa", bgcolor: "#1f1f24" }}
                      >
                        Center
                      </Button>
                    )}
                  </Box>
                </Box>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={currentStyle.positionX ?? 50}
                  onChange={(_, val) =>
                    updateSubtitleStylePreview({ ...currentStyle, positionX: val as number })
                  }
                  onChangeCommitted={(_, val) =>
                    updateSubtitleStyleCommitted({ ...currentStyle, positionX: val as number })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Position Y (Vertical) */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Vertical Position (Y)</Typography>
                  <Typography variant="caption" sx={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>
                    {currentStyle.positionY ?? 80}%
                  </Typography>
                </Box>
                <Slider
                  min={5}
                  max={95}
                  step={1}
                  value={currentStyle.positionY ?? 80}
                  onChange={(_, val) =>
                    updateSubtitleStylePreview({ ...currentStyle, positionY: val as number })
                  }
                  onChangeCommitted={(_, val) =>
                    updateSubtitleStyleCommitted({ ...currentStyle, positionY: val as number })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Rotation Angle */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Rotation Angle</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" sx={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>
                      {currentStyle.rotation ?? 0}°
                    </Typography>
                    {(currentStyle.rotation ?? 0) !== 0 && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => updateSubtitleStyleCommitted({ ...currentStyle, rotation: 0 })}
                        sx={{ fontSize: "0.62rem", py: 0, px: 0.8, height: 18, minWidth: 0, color: "#a1a1aa", bgcolor: "#1f1f24" }}
                      >
                        Reset 0°
                      </Button>
                    )}
                  </Box>
                </Box>
                <Slider
                  min={-180}
                  max={180}
                  step={1}
                  value={currentStyle.rotation ?? 0}
                  onChange={(_, val) =>
                    updateSubtitleStylePreview({ ...currentStyle, rotation: val as number })
                  }
                  onChangeCommitted={(_, val) =>
                    updateSubtitleStyleCommitted({ ...currentStyle, rotation: val as number })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Box Width & Wrap Mode */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Box Width (Wrap Mode)</Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Button
                      size="small"
                      variant={currentStyle.boxWidthMode === "custom" ? "outlined" : "contained"}
                      onClick={() =>
                        updateSubtitleStyleCommitted({ ...currentStyle, boxWidthMode: "auto" })
                      }
                      sx={{
                        fontSize: "0.62rem",
                        py: 0.2,
                        px: 0.8,
                        height: 20,
                        minWidth: 0,
                        textTransform: "none",
                        fontWeight: 700,
                        bgcolor: currentStyle.boxWidthMode === "custom" ? "transparent" : "#3b82f6",
                        color: currentStyle.boxWidthMode === "custom" ? "#a1a1aa" : "#ffffff",
                        borderColor: "#27272a",
                      }}
                    >
                      Auto (Fit Text)
                    </Button>
                    <Button
                      size="small"
                      variant={currentStyle.boxWidthMode === "custom" ? "contained" : "outlined"}
                      onClick={() =>
                        updateSubtitleStyleCommitted({
                          ...currentStyle,
                          boxWidthMode: "custom",
                          boxWidth: currentStyle.boxWidth ?? 85,
                        })
                      }
                      sx={{
                        fontSize: "0.62rem",
                        py: 0.2,
                        px: 0.8,
                        height: 20,
                        minWidth: 0,
                        textTransform: "none",
                        fontWeight: 700,
                        bgcolor: currentStyle.boxWidthMode === "custom" ? "#3b82f6" : "transparent",
                        color: currentStyle.boxWidthMode === "custom" ? "#ffffff" : "#a1a1aa",
                        borderColor: "#27272a",
                      }}
                    >
                      Custom Width
                    </Button>
                  </Box>
                </Box>
                {currentStyle.boxWidthMode === "custom" && (
                  <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.72rem" }}>Width Limit</Typography>
                      <Typography variant="caption" sx={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>
                        {currentStyle.boxWidth ?? 85}%
                      </Typography>
                    </Box>
                    <Slider
                      min={20}
                      max={100}
                      step={1}
                      value={currentStyle.boxWidth ?? 85}
                      onChange={(_, val) =>
                        updateSubtitleStylePreview({ ...currentStyle, boxWidth: val as number })
                      }
                      onChangeCommitted={(_, val) =>
                        updateSubtitleStyleCommitted({ ...currentStyle, boxWidth: val as number })
                      }
                      sx={{ color: "#3b82f6" }}
                    />
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
