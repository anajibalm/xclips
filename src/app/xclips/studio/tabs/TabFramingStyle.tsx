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
} from "@mui/material";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import CropIcon from "@mui/icons-material/Crop";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import SubtitlesOffIcon from "@mui/icons-material/SubtitlesOff";
import FontDownloadIcon from "@mui/icons-material/FontDownload";
import { useStudioStore } from "../store/useStudioStore";
import { LayoutMode, SubtitleStyle, SubtitlePreset } from "@/lib/xclips/types";
import { PRESET_STYLES, GOOGLE_FONTS_CATALOG } from "../types/studio.types";

export function TabFramingStyle() {
  const selectedClip = useStudioStore((s) => s.selectedClip);
  const handleSaveClip = useStudioStore((s) => s.handleSaveClip);
  const [fontSearch, setFontSearch] = useState("");

  if (!selectedClip) {
    return (
      <Typography variant="body2" sx={{ color: "#71717a", py: 4, textAlign: "center" }}>
        Select a clip in the Autoclip tab to configure framing and subtitles.
      </Typography>
    );
  }

  const currentStyle: SubtitleStyle = selectedClip.subtitleStyle || {
    fontFamily: "Anton",
    fontSize: 48,
    primaryColor: "#FFFFFF",
    secondaryColor: "#FACC15",
    outlineColor: "#000000",
    shadowColor: "#000000",
    outlineWidth: 3.5,
    shadowOffset: 2.0,
    karaoke: true,
    allCaps: true,
    activeWordGlow: true,
    enabled: true,
  };

  const handleApplyPreset = (preset: SubtitlePreset) => {
    const presetOverrides = PRESET_STYLES[preset];
    const newStyle: SubtitleStyle = {
      ...selectedClip.subtitleStyle,
      ...presetOverrides,
      preset,
    };
    handleSaveClip({
      ...selectedClip,
      subtitleStyle: newStyle,
    });
  };

  return (
    <Box>
      {/* LAYOUT MODES */}
      <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.2, fontSize: "0.9rem" }}>
        1. Framing Layout (9:16)
      </Typography>
      <RadioGroup
        row
        value={selectedClip.layoutMode}
        onChange={(e) =>
          handleSaveClip({
            ...selectedClip,
            layoutMode: e.target.value as LayoutMode,
          })
        }
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

      {selectedClip.layoutMode === "center_crop" && (
        <Box sx={{ mb: 2.5, p: 1.5, bgcolor: "#141418", borderRadius: 1, border: "1px solid #27272a" }}>
          <Typography variant="caption" sx={{ color: "#a1a1aa", display: "block", mb: 0.5, fontWeight: 600 }}>
            Horizontal Pan Offset ({(selectedClip.panOffsetX || 0).toFixed(2)})
          </Typography>
          <Slider
            min={-1.0}
            max={1.0}
            step={0.05}
            value={selectedClip.panOffsetX || 0}
            onChange={(_, val) =>
              handleSaveClip({
                ...selectedClip,
                panOffsetX: val as number,
              })
            }
            sx={{ color: "#3b82f6" }}
          />
        </Box>
      )}

      <Divider sx={{ borderColor: "#27272a", my: 2.5 }} />

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
                handleSaveClip({
                  ...selectedClip,
                  subtitleStyle: { ...currentStyle, enabled: e.target.checked },
                })
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
            Klip ini akan diekspor dalam format bersih tanpa caption. Nyalakan sakelar di atas jika ingin menampilkan dan mengkustomisasi subtitle.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() =>
              handleSaveClip({
                ...selectedClip,
                subtitleStyle: { ...currentStyle, enabled: true },
              })
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
            2. Instant Subtitle Presets
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            {[
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

          {/* 3. CLOUD FONT SELECTOR (20 GOOGLE FONTS) */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
            3. Font Cloud (20 Curated Google Fonts)
          </Typography>

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search fonts (e.g. Anton, Montserrat, Oswald)..."
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
                      handleSaveClip({
                        ...selectedClip,
                        subtitleStyle: { ...currentStyle, fontFamily: font.name },
                      })
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

          {/* 4. TEXT CASE SWITCHER */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1, fontSize: "0.9rem" }}>
            4. Text Case Format
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
                    handleSaveClip({
                      ...selectedClip,
                      subtitleStyle: {
                        ...currentStyle,
                        textCase: item.id as "uppercase" | "capitalize" | "lowercase",
                        allCaps: item.id === "uppercase",
                      },
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

          <Divider sx={{ borderColor: "#27272a", my: 2 }} />

          {/* 5. COLORS & SLIDERS */}
          <Typography variant="subtitle2" sx={{ color: "#fafafa", fontWeight: 800, mb: 1.5, fontSize: "0.9rem" }}>
            5. Typography Colors &amp; Position
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
                      handleSaveClip({
                        ...selectedClip,
                        subtitleStyle: { ...currentStyle, primaryColor: e.target.value },
                      })
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
                    value={currentStyle.highlightColor || currentStyle.secondaryColor || "#FACC15"}
                    onChange={(e) =>
                      handleSaveClip({
                        ...selectedClip,
                        subtitleStyle: { ...currentStyle, highlightColor: e.target.value, secondaryColor: e.target.value },
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
                      handleSaveClip({
                        ...selectedClip,
                        subtitleStyle: { ...currentStyle, outlineColor: e.target.value },
                      })
                    }
                    style={{ width: 44, height: 26, borderRadius: 3, cursor: "pointer", background: "none", border: "1px solid #3f3f46" }}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Sub-Column 2: Sliders (Size, Outline, Position Y) */}
            <Grid size={{ xs: 12, md: 6 }}>
              {/* Font Size */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Font Size</Typography>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace" }}>{currentStyle.fontSize || 42}px</Typography>
                </Box>
                <Slider
                  min={20}
                  max={80}
                  step={1}
                  value={currentStyle.fontSize || 42}
                  onChange={(_, val) =>
                    handleSaveClip({
                      ...selectedClip,
                      subtitleStyle: { ...currentStyle, fontSize: val as number },
                    })
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
                    handleSaveClip({
                      ...selectedClip,
                      subtitleStyle: { ...currentStyle, outlineWidth: val as number },
                    })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>

              {/* Position Y */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#e4e4e7", fontWeight: 600 }}>Vertical Position (Y)</Typography>
                  <Typography variant="caption" sx={{ color: "#a1a1aa", fontFamily: "monospace" }}>{currentStyle.positionY || 80}%</Typography>
                </Box>
                <Slider
                  min={50}
                  max={95}
                  step={1}
                  value={currentStyle.positionY || 80}
                  onChange={(_, val) =>
                    handleSaveClip({
                      ...selectedClip,
                      subtitleStyle: { ...currentStyle, positionY: val as number },
                    })
                  }
                  sx={{ color: "#3b82f6" }}
                />
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={currentStyle.karaokeEnabled !== false}
                  onChange={(e) =>
                    handleSaveClip({
                      ...selectedClip,
                      subtitleStyle: { ...currentStyle, karaokeEnabled: e.target.checked },
                    })
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
  );
}
