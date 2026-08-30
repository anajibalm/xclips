import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Tooltip,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useStudioStore } from "../store/useStudioStore";
import { apiFetch } from "@/lib/api-client";
import { AiProviderType, XclipsAiSettings } from "@/lib/xclips/types";

// Brand Icons
function KieAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

function OpenAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  );
}

function AnthropicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function CustomAiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const PROVIDER_METADATA: Record<
  AiProviderType,
  { label: string; keyTitle: string; getUrl?: string; placeholder: string }
> = {
  kieai: {
    label: "KIE AI",
    keyTitle: "KIE AI API Key",
    getUrl: "https://kie.ai/api-key",
    placeholder: "Masukkan KIE AI API key...",
  },
  gemini: {
    label: "Gemini",
    keyTitle: "Google Gemini API Key",
    getUrl: "https://aistudio.google.com/api-keys",
    placeholder: "Masukkan Google Gemini API key...",
  },
  openai: {
    label: "OpenAI",
    keyTitle: "OpenAI API Key",
    getUrl: "https://platform.openai.com/api-keys",
    placeholder: "Masukkan OpenAI API key...",
  },
  anthropic: {
    label: "Claude",
    keyTitle: "Anthropic Claude API Key",
    getUrl: "https://platform.claude.com/settings/workspaces/default/keys",
    placeholder: "Masukkan Claude API key...",
  },
  openai_compatible: {
    label: "Custom",
    keyTitle: "Custom Provider API Key",
    placeholder: "Masukkan Custom API key...",
  },
};

interface FormFieldProps {
  label: string;
  subLabel?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
  multiline?: boolean;
  rows?: number;
  slotProps?: {
    input?: {
      endAdornment?: React.ReactNode;
    };
  };
}

function FormField({ label, subLabel, value, onChange, placeholder, type = "text", helperText, multiline, rows, slotProps }: FormFieldProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
          {label}
        </Typography>
        {subLabel && typeof subLabel === "string" ? (
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.68rem" }}>
            {subLabel}
          </Typography>
        ) : (
          subLabel
        )}
      </Box>
      <TextField
        fullWidth
        size="small"
        type={type}
        multiline={multiline}
        rows={rows}
        placeholder={placeholder}
        value={value || ""}
        onChange={onChange}
        slotProps={slotProps}
        helperText={helperText ? <span style={{ color: "#71717a", fontSize: "0.68rem" }}>{helperText}</span> : undefined}
        sx={{
          "& .MuiInputBase-input": { color: "#ffffff", fontSize: "0.82rem", py: multiline ? 1 : 0.8 },
          "& .MuiOutlinedInput-root": {
            bgcolor: "#0d0d10",
            borderRadius: 1,
            "& fieldset": { borderColor: "#27272a" },
            "&:hover fieldset": { borderColor: "#3f3f46" },
            "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
          },
        }}
      />
    </Box>
  );
}

export function AiSettingsModal() {
  const aiSettingsModalOpen = useStudioStore((s) => s.aiSettingsModalOpen);
  const setAiSettingsModalOpen = useStudioStore((s) => s.setAiSettingsModalOpen);
  const aiSettings = useStudioStore((s) => s.aiSettings);
  const setAiSettings = useStudioStore((s) => s.setAiSettings);
  const aiSettingsSaving = useStudioStore((s) => s.aiSettingsSaving);
  const aiSettingsSuccess = useStudioStore((s) => s.aiSettingsSuccess);
  const aiSettingsError = useStudioStore((s) => s.aiSettingsError);
  const saveAiSettings = useStudioStore((s) => s.saveAiSettings);

  const [aiModalTab, setAiModalTab] = useState(0);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [testKeyStatus, setTestKeyStatus] = useState<"idle" | "success" | "error">("idle");
  const [testKeyMessage, setTestKeyMessage] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [searchingModels, setSearchingModels] = useState(false);

  if (!aiSettings) return null;

  const handleTestApiKey = async () => {
    const activeKey = aiSettings.apiKey || aiSettings.apiKeys?.[aiSettings.provider] || "";
    if (!activeKey) return;

    setTestingApiKey(true);
    setTestKeyStatus("idle");
    setTestKeyMessage(null);

    const res = await apiFetch<{ ok: boolean; message?: string }>("/api/xclips/settings/test-key", {
      method: "POST",
      body: JSON.stringify({
        provider: aiSettings.provider,
        apiKey: activeKey,
        baseUrl: aiSettings.baseUrl,
      }),
    });

    setTestingApiKey(false);
    if (res.ok) {
      setTestKeyStatus("success");
      setTestKeyMessage("API Key Valid!");
    } else {
      setTestKeyStatus("error");
      setTestKeyMessage((res.data as unknown as { message?: string })?.message || "API Key Tidak Valid");
    }
  };

  const handleAutoSearchModels = async () => {
    setSearchingModels(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("provider", aiSettings.provider);
      if (aiSettings.apiKey) queryParams.set("apiKey", aiSettings.apiKey);
      if (aiSettings.baseUrl) queryParams.set("baseUrl", aiSettings.baseUrl);

      const res = await apiFetch<{ ok: boolean; highlightModels?: string[] }>(
        `/api/xclips/settings/models?${queryParams.toString()}`
      );
      if (res.ok && res.data?.highlightModels) {
        setAvailableModels(res.data.highlightModels);
      }
    } finally {
      setSearchingModels(false);
    }
  };

  return (
    <Dialog
      open={aiSettingsModalOpen}
      onClose={() => setAiSettingsModalOpen(false)}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#0d0d10",
            border: "1px solid #27272a",
            borderRadius: 1.5,
            color: "#ffffff",
            backgroundImage: "none",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: 2.5, pb: 1.8, borderBottom: "1px solid #1f1f26" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
            <TuneIcon sx={{ color: "#3b82f6", fontSize: "1.25rem" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#fafafa", fontSize: "1rem", letterSpacing: "-0.01em" }}>
              Configuration
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.75rem", display: "block" }}>
            Configure LLM providers, model routing, and precision narrative boundaries for highlight discovery.
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setAiSettingsModalOpen(false)} sx={{ color: "#71717a", "&:hover": { color: "#ffffff", bgcolor: "#1f1f26" } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Navigation Tabs for Modal */}
      <Box sx={{ borderBottom: "1px solid #1f1f26", px: 2.5, bgcolor: "#0f0f14" }}>
        <Tabs
          value={aiModalTab}
          onChange={(_, val) => setAiModalTab(val)}
          sx={{
            minHeight: 40,
            "& .MuiTab-root": {
              color: "#71717a",
              fontWeight: 700,
              textTransform: "none",
              py: 1,
              fontSize: "0.8rem",
              minHeight: 40,
            },
            "& .Mui-selected": { color: "#3b82f6" },
          }}
        >
          <Tab label="AI Provider & Model" icon={<TuneIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" />
          <Tab label="Content & Narrative Settings" icon={<VideoFileIcon sx={{ fontSize: "0.95rem" }} />} iconPosition="start" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* TAB 0: AI PROVIDER & MODEL ROUTING */}
        {aiModalTab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
            {/* PROVIDER SELECTION */}
            <Box>
              <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.8, fontSize: "0.75rem" }}>
                Pilih AI Provider
              </Typography>
              <Grid container spacing={1}>
                {[
                  {
                    id: "kieai",
                    label: "KIE AI",
                    icon: <KieAiIcon style={{ color: "#3b82f6", width: 22, height: 22 }} />,
                    defaultUrl: "https://api.kie.ai",
                    defaultTranscribe: "gemini-3-7-flash",
                    defaultHighlight: "gemini-3-7-flash",
                  },
                  {
                    id: "gemini",
                    label: "Gemini",
                    icon: <GeminiIcon style={{ color: "#8E75FF", width: 22, height: 22 }} />,
                    defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
                    defaultTranscribe: "gemini-3.7-flash",
                    defaultHighlight: "gemini-3.7-flash",
                  },
                  {
                    id: "openai",
                    label: "OpenAI",
                    icon: <OpenAiIcon style={{ color: "#10A37F", width: 22, height: 22 }} />,
                    defaultUrl: "https://api.openai.com/v1",
                    defaultTranscribe: "gpt-transcribe",
                    defaultHighlight: "gpt-5.6-luna",
                  },
                  {
                    id: "anthropic",
                    label: "Claude",
                    icon: <AnthropicIcon style={{ color: "#D97757", width: 22, height: 22 }} />,
                    defaultUrl: "https://api.anthropic.com/v1",
                    defaultTranscribe: "gemini-3-7-flash",
                    defaultHighlight: "claude-sonnet-5",
                  },
                  {
                    id: "openai_compatible",
                    label: "Custom",
                    icon: <CustomAiIcon style={{ color: "#a1a1aa", width: 22, height: 22 }} />,
                    defaultUrl: "https://api.openai.com/v1",
                    defaultTranscribe: "whisper-1",
                    defaultHighlight: "gpt-4o",
                  },
                ].map((p) => {
                  const isSelected = aiSettings.provider === p.id;
                  const isConfigured = Boolean(
                    (aiSettings.apiKeys?.[p.id as AiProviderType] && aiSettings.apiKeys[p.id as AiProviderType].trim().length > 0) ||
                    (aiSettings.provider === p.id && aiSettings.apiKey && aiSettings.apiKey.trim().length > 0)
                  );

                  return (
                    <Grid size={{ xs: 6, sm: 2.4 }} key={p.id}>
                      <Box
                        onClick={() => {
                          const nextProvider = p.id as AiProviderType;
                          const providerApiKey = aiSettings.apiKeys?.[nextProvider] || "";
                          setAiSettings({
                            ...aiSettings,
                            provider: nextProvider,
                            baseUrl: p.defaultUrl,
                            apiKey: providerApiKey,
                            transcribeModel: p.defaultTranscribe,
                            highlightModel: p.defaultHighlight,
                          });
                          setTestKeyStatus("idle");
                          setTestKeyMessage(null);
                          setAvailableModels([]);
                        }}
                        sx={{
                          p: 1.4,
                          height: "100%",
                          bgcolor: isSelected
                            ? "rgba(59, 130, 246, 0.1)"
                            : isConfigured
                            ? "#16161c"
                            : "#111116",
                          border: isSelected
                            ? "1.5px solid #3b82f6"
                            : isConfigured
                            ? "1px solid #282834"
                            : "1px solid #1c1c24",
                          borderRadius: 1,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: 0.8,
                          transition: "all 0.15s ease",
                          filter: isConfigured || isSelected ? "none" : "grayscale(100%)",
                          opacity: isConfigured || isSelected ? 1 : 0.45,
                          "&:hover": {
                            borderColor: isSelected ? "#3b82f6" : "#3b82f6",
                            bgcolor: isSelected ? "rgba(59, 130, 246, 0.14)" : "#1c1c24",
                            opacity: 1,
                            filter: "none",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            p: 0.6,
                            bgcolor: "#0f0f14",
                            borderRadius: 0.8,
                            border: "1px solid #23232b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p.icon}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            color: isSelected ? "#ffffff" : isConfigured ? "#e4e4e7" : "#71717a",
                            lineHeight: 1.2,
                          }}
                        >
                          {p.label}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            {/* ENDPOINT & CREDENTIALS */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
              {aiSettings.provider === "openai_compatible" && (
                <FormField
                  label="Base URL / API Endpoint"
                  subLabel="Endpoint Kustom (Dapat Diedit)"
                  value={aiSettings.baseUrl}
                  onChange={(e) => setAiSettings({ ...aiSettings, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              )}

              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                <FormField
                  label={PROVIDER_METADATA[aiSettings.provider]?.keyTitle || "API Key"}
                  subLabel={
                    PROVIDER_METADATA[aiSettings.provider]?.getUrl ? (
                      <Box
                        component="a"
                        href={PROVIDER_METADATA[aiSettings.provider]?.getUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: "#60a5fa",
                          textDecoration: "none",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.3,
                          "&:hover": { textDecoration: "underline", color: "#93c5fd" },
                        }}
                      >
                        Get API Key ↗
                      </Box>
                    ) : undefined
                  }
                  type={showApiKey ? "text" : "password"}
                  value={aiSettings.apiKey || aiSettings.apiKeys?.[aiSettings.provider] || ""}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    setTestKeyStatus("idle");
                    setTestKeyMessage(null);
                    setAiSettings({
                      ...aiSettings,
                      apiKey: newKey,
                      apiKeys: {
                        ...(aiSettings.apiKeys || {
                          kieai: "",
                          gemini: "",
                          openai: "",
                          anthropic: "",
                          openai_compatible: "",
                        }),
                        [aiSettings.provider]: newKey,
                      },
                    });
                  }}
                  placeholder={PROVIDER_METADATA[aiSettings.provider]?.placeholder || "Masukkan API Key..."}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end" sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                          {testingApiKey ? (
                            <CircularProgress size={16} sx={{ color: "#3b82f6", mr: 0.4 }} />
                          ) : testKeyStatus === "success" ? (
                            <Tooltip title={testKeyMessage || "API Key Valid & Terhubung!"}>
                              <IconButton size="small" onClick={handleTestApiKey} sx={{ color: "#22c55e", p: 0.4 }}>
                                <CheckCircleIcon sx={{ fontSize: "1.15rem" }} />
                              </IconButton>
                            </Tooltip>
                          ) : testKeyStatus === "error" ? (
                            <Tooltip title={testKeyMessage || "API Key Tidak Valid / Error"}>
                              <IconButton size="small" onClick={handleTestApiKey} sx={{ color: "#ef4444", p: 0.4 }}>
                                <CloseIcon sx={{ fontSize: "1.15rem" }} />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Test / Check API Key">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={handleTestApiKey}
                                  disabled={!aiSettings.apiKey}
                                  sx={{ color: "#3b82f6", p: 0.4 }}
                                >
                                  <PlayArrowIcon sx={{ fontSize: "1.15rem" }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}

                          <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)} sx={{ color: "#71717a", p: 0.4 }}>
                            {showApiKey ? <VisibilityOffIcon sx={{ fontSize: "1.15rem" }} /> : <VisibilityIcon sx={{ fontSize: "1.15rem" }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                {aiSettings.provider === "openai_compatible" && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAutoSearchModels}
                    disabled={searchingModels || !aiSettings.apiKey}
                    startIcon={searchingModels ? <CircularProgress size={13} sx={{ color: "#3b82f6" }} /> : <RefreshIcon fontSize="small" />}
                    sx={{
                      color: "#60a5fa",
                      borderColor: "#3b82f6",
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: "0.76rem",
                      whiteSpace: "nowrap",
                      px: 2,
                      height: 38,
                      borderRadius: 1,
                    }}
                  >
                    {searchingModels ? "Searching..." : "Fetch Models"}
                  </Button>
                )}
              </Box>

              {/* KIE AI Model Selector */}
              {aiSettings.provider === "kieai" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                    Model AI KIE (Pengolahan Narasi)
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={aiSettings.highlightModel || "gemini-3-7-flash"}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setAiSettings({
                          ...aiSettings,
                          transcribeModel: "gemini-3-7-flash",
                          highlightModel: selectedVal,
                        });
                      }}
                      sx={{
                        bgcolor: "#14141a",
                        color: "#ffffff",
                        borderRadius: 1,
                        fontSize: "0.8rem",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                      }}
                    >
                      <MenuItem value="gemini-3-7-flash">Gemini 3.7 Flash</MenuItem>
                      <MenuItem value="gpt-5-6-terra">GPT 5.6 Terra</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* OPENAI Model Selector */}
              {aiSettings.provider === "openai" && (
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                      <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                        Model Transkrip Audio (Speech-to-Text)
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={aiSettings.transcribeModel || "gpt-transcribe"}
                          onChange={(e) => {
                            setAiSettings({
                              ...aiSettings,
                              transcribeModel: e.target.value,
                            });
                          }}
                          sx={{
                            bgcolor: "#14141a",
                            color: "#ffffff",
                            borderRadius: 1,
                            fontSize: "0.8rem",
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          }}
                        >
                          <MenuItem value="gpt-transcribe">GPT Transcribe</MenuItem>
                          <MenuItem value="gpt-4o-transcribe">GPT-4o Transcribe</MenuItem>
                          <MenuItem value="gpt-4o-mini-transcribe">GPT-4o Mini Transcribe</MenuItem>
                          <MenuItem value="whisper-1">Whisper 1</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                      <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                        Model Pengolahan Narasi &amp; Hook (LLM)
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={aiSettings.highlightModel || "gpt-5.6-luna"}
                          onChange={(e) => {
                            setAiSettings({
                              ...aiSettings,
                              highlightModel: e.target.value,
                            });
                          }}
                          sx={{
                            bgcolor: "#14141a",
                            color: "#ffffff",
                            borderRadius: 1,
                            fontSize: "0.8rem",
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                          }}
                        >
                          <MenuItem value="gpt-5.6-luna">GPT 5.6 Luna</MenuItem>
                          <MenuItem value="gpt-5-6-terra">GPT 5.6 Terra</MenuItem>
                          <MenuItem value="gpt-5-6-sol">GPT 5.6 Sol</MenuItem>
                          <MenuItem value="gpt-5-6-luna">GPT 5.6 Luna (Alt)</MenuItem>
                          <MenuItem value="gpt-4o">GPT 4o</MenuItem>
                          <MenuItem value="gpt-4o-mini">GPT 4o Mini</MenuItem>
                          <MenuItem value="gpt-image-2">GPT Image 2</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Grid>
                </Grid>
              )}

              {/* ANTHROPIC Model Selector */}
              {aiSettings.provider === "anthropic" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                    Model Claude (Pengolahan Narasi)
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={aiSettings.highlightModel || "claude-sonnet-5"}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setAiSettings({
                          ...aiSettings,
                          transcribeModel: "gemini-3-7-flash",
                          highlightModel: selectedVal,
                        });
                      }}
                      sx={{
                        bgcolor: "#14141a",
                        color: "#ffffff",
                        borderRadius: 1,
                        fontSize: "0.8rem",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                      }}
                    >
                      <MenuItem value="claude-sonnet-5">Claude Sonnet 5</MenuItem>
                      <MenuItem value="claude-opus-5">Claude Opus 5</MenuItem>
                      <MenuItem value="claude-sonnet-4-6">Claude Sonnet 4.6</MenuItem>
                      <MenuItem value="claude-opus-4-8">Claude Opus 4.8</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* GEMINI Model Selector */}
              {aiSettings.provider === "gemini" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  <Typography variant="caption" sx={{ color: "#d4d4d8", fontWeight: 700, fontSize: "0.75rem" }}>
                    Model Google Gemini (Transkrip &amp; Pengolahan Narasi)
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={aiSettings.highlightModel || "gemini-3.7-flash"}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setAiSettings({
                          ...aiSettings,
                          transcribeModel: selectedVal,
                          highlightModel: selectedVal,
                        });
                      }}
                      sx={{
                        bgcolor: "#14141a",
                        color: "#ffffff",
                        borderRadius: 1,
                        fontSize: "0.8rem",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#23232b" },
                      }}
                    >
                      <MenuItem value="gemini-3.5-transcribe">Gemini 3.5 Transcribe</MenuItem>
                      <MenuItem value="gemini-3.7-flash">Gemini 3.7 Flash</MenuItem>
                      <MenuItem value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</MenuItem>
                      <MenuItem value="gemini-3.6-flash">Gemini 3.6 Flash</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* CUSTOM Model Inputs */}
              {aiSettings.provider === "openai_compatible" && (
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormField
                      label="Speech-to-Text Model (Audio)"
                      value={aiSettings.transcribeModel}
                      onChange={(e) => setAiSettings({ ...aiSettings, transcribeModel: e.target.value })}
                      placeholder="gemini-2.0-flash / whisper-1"
                      helperText="Digunakan untuk memproses kata-per-kata"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormField
                      label="Narrative & Highlight Model (LLM)"
                      value={aiSettings.highlightModel}
                      onChange={(e) => setAiSettings({ ...aiSettings, highlightModel: e.target.value })}
                      placeholder="gpt-4o / gemini-1.5-pro / claude-3-5-sonnet"
                      helperText="Digunakan untuk menemukan topik narasi & hook"
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          </Box>
        )}

        {/* TAB 1: CONTENT & NARRATIVE SETTINGS */}
        {aiModalTab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormField
              label="Target Topic / Narrative Prompt (Opsional)"
              multiline
              rows={3}
              placeholder="Contoh: Fokus pada strategi analisis teknikal, manajemen risiko, atau insight motivasi praktis..."
              value={aiSettings.topicPrompt}
              onChange={(e) => setAiSettings({ ...aiSettings, topicPrompt: e.target.value })}
              helperText="Mengarahkan AI agar memprioritaskan topik atau poin narasi spesifik dari transkrip."
            />

            {/* Target Duration & Max Clips */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.6 }}>
                  Target Durasi per Klip
                </Typography>
                <Box sx={{ display: "flex", gap: 0.6 }}>
                  {[
                    { id: "short", label: "Short", sub: "30-45s" },
                    { id: "standard", label: "Standard", sub: "45-75s" },
                    { id: "long", label: "Long", sub: "75-120s" },
                  ].map((dur) => {
                    const isSel = aiSettings.targetDuration === dur.id;
                    return (
                      <Box
                        key={dur.id}
                        onClick={() => setAiSettings({ ...aiSettings, targetDuration: dur.id as "short" | "standard" | "long" })}
                        sx={{
                          flex: 1,
                          py: 1,
                          px: 0.5,
                          textAlign: "center",
                          borderRadius: 0.8,
                          border: isSel ? "1.5px solid #3b82f6" : "1px solid #23232b",
                          bgcolor: isSel ? "rgba(59, 130, 246, 0.12)" : "#16161c",
                          cursor: "pointer",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.74rem", color: isSel ? "#ffffff" : "#d4d4d8" }}>
                          {dur.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isSel ? "#93c5fd" : "#71717a", fontSize: "0.64rem", display: "block" }}>
                          {dur.sub}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ color: "#a1a1aa", fontWeight: 700, display: "block", mb: 0.6 }}>
                  Jumlah Maksimal Klip
                </Typography>
                <Box sx={{ display: "flex", gap: 0.6 }}>
                  {[3, 5, 8, 12].map((num) => {
                    const isSel = aiSettings.maxClipsCount === num;
                    return (
                      <Button
                        key={num}
                        variant={isSel ? "contained" : "outlined"}
                        size="small"
                        onClick={() => setAiSettings({ ...aiSettings, maxClipsCount: num })}
                        sx={{
                          flex: 1,
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          bgcolor: isSel ? "#3b82f6" : "#16161c",
                          borderColor: isSel ? "#3b82f6" : "#23232b",
                          color: isSel ? "#ffffff" : "#a1a1aa",
                        }}
                      >
                        {num}
                      </Button>
                    );
                  })}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {aiSettingsSuccess && (
          <Alert severity="success" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }}>
            {aiSettingsSuccess}
          </Alert>
        )}

        {aiSettingsError && (
          <Alert severity="error" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5" }}>
            {aiSettingsError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.8, borderTop: "1px solid #1f1f26", bgcolor: "#0f0f14" }}>
        <Button onClick={() => setAiSettingsModalOpen(false)} sx={{ color: "#a1a1aa", textTransform: "none" }}>
          Batal
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            const ok = await saveAiSettings(aiSettings);
            if (ok) {
              setTimeout(() => setAiSettingsModalOpen(false), 800);
            }
          }}
          disabled={aiSettingsSaving}
          sx={{ bgcolor: "#3b82f6", textTransform: "none", fontWeight: 800 }}
        >
          {aiSettingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
