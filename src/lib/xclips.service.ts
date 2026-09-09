import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import {
  XclipsProject,
  XclipsTranscript,
  XclipsClip,
  WordTimestamp,
  Result,
  SubtitleStyle,
  XclipsAiSettings,
  XclipsAiSettingsSchema,
  AiProviderType,
  StorageStats,
  ProjectStorage,
  CleanResult,
  AI_PROVIDER_MODELS,
  TimeRange,
} from "@/lib/xclips/types";
import {
  probeMedia,
  normalizeToCfr,
  extractAudioWav,
  extractCompressedAudio,
  extractAudioSegment,
} from "@/lib/xclips/vfr-probe";
import { detectTokenFillers } from "@/lib/xclips/filler-detector";
import {
  chunkTranscript,
  buildHighlightPrompt,
  reduceAndRankHighlights,
  CandidateHighlight,
} from "@/lib/xclips/transcript-chunker";
import { xclipsDb } from "@/lib/xclips/xclips-db";
import { renderQueue } from "@/lib/xclips/queue";
import {
  fetchYouTubeInfo,
  downloadYouTubeVideo,
  fetchYouTubeSubtitlesQuick,
  parseSrtToWords,
  findYtDlpBinary,
  YouTubeVideoInfo,
  DownloadProgress,
} from "@/lib/xclips/ytdlp-downloader";
import { generateSrtFromWords } from "@/lib/xclips/phrase-segmentation";
import { aiLogger, mediaLogger } from "@/lib/logger";

export class XclipsService {
  /**
   * Fetches metadata for a YouTube URL
   */
  async getYouTubeMetadata(url: string): Promise<Result<YouTubeVideoInfo>> {
    return fetchYouTubeInfo(url);
  }

  /**
   * Resolves the settings file path with full test environment isolation
   */
  getSettingsPath(): string {
    if (
      process.env.NODE_ENV === "test" ||
      process.env.BUN_ENV === "test" ||
      process.env.XCLIPS_TEST === "true"
    ) {
      return path.resolve(process.cwd(), "vault", "xclips", "settings.test.json");
    }
    return path.resolve(process.cwd(), "vault", "xclips", "settings.json");
  }

  /**
   * Reads persistent AI configuration from vault/xclips/settings.json
   */
  getAiSettings(): XclipsAiSettings {
    const settingsPath = this.getSettingsPath();
    const defaultApiKeys: Record<AiProviderType, string> = {
      kieai: process.env.KIE_AI_API_KEY || "",
      gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      anthropic: process.env.ANTHROPIC_API_KEY || "",
    };

    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        const validated = XclipsAiSettingsSchema.parse(parsed);
        const mergedApiKeys: Record<AiProviderType, string> = {
          ...defaultApiKeys,
          ...(validated.apiKeys || {}),
        };
        if (!mergedApiKeys[validated.provider] && validated.apiKey) {
          mergedApiKeys[validated.provider] = validated.apiKey;
        }
        validated.apiKeys = mergedApiKeys;
        validated.apiKey = mergedApiKeys[validated.provider] || validated.apiKey || "";

        // Automatic sanitization for non-existent / legacy model names
        if (validated.provider === "openai") {
          if (!validated.highlightModel || validated.highlightModel === "gpt-5-6-terra" || validated.highlightModel === "gpt-5.6-luna" || validated.highlightModel === "gpt-5-6-sol") {
            validated.highlightModel = "gpt-4o";
          }
          if (!validated.transcribeModel || validated.transcribeModel === "gpt-transcribe" || validated.transcribeModel === "gpt-4o-transcribe" || validated.transcribeModel === "gpt-4o-mini-transcribe") {
            validated.transcribeModel = "whisper-1";
          }
        } else if (validated.provider === "kieai") {
          if (validated.highlightModel === "gpt-5-6-terra") {
            validated.highlightModel = "gemini-3-7-flash";
          }
        }

        return validated;
      } catch (err) {
        aiLogger.warn({ err }, "Failed to parse settings.json, returning default AI settings");
      }
    }
    return {
      provider: "kieai",
      baseUrl: "https://api.kie.ai/gemini-3-6-flash-openai/v1",
      apiKey: defaultApiKeys.kieai || "",
      apiKeys: defaultApiKeys,
      transcribeModel: "gemini-3-7-flash",
      highlightModel: "gemini-3-7-flash",
      lightModel: "muse-glimmer-30b",
      topicPrompt: "",
      hookFormula: "auto",
      targetDuration: "standard",
      maxClipsCount: 5,
      strictBoundary: true,
      outputLanguage: "auto",
    };
  }

  /**
   * Saves AI configuration to vault/xclips/settings.json (or settings.test.json in tests)
   */
  saveAiSettings(settings: Partial<XclipsAiSettings>): Result<XclipsAiSettings> {
    try {
      const current = this.getAiSettings();
      const targetProvider = settings.provider || current.provider;
      const updatedApiKeys: Record<AiProviderType, string> = {
        ...current.apiKeys,
        ...(settings.apiKeys || {}),
      };
      if (settings.apiKey !== undefined && settings.apiKey.trim().length > 0) {
        updatedApiKeys[targetProvider] = settings.apiKey.trim();
      }
      if (settings.apiKeys?.[targetProvider] !== undefined) {
        updatedApiKeys[targetProvider] = settings.apiKeys[targetProvider];
      }

      const merged: XclipsAiSettings = {
        ...current,
        ...settings,
        apiKeys: updatedApiKeys,
        apiKey: updatedApiKeys[targetProvider] || "",
      };
      const validated = XclipsAiSettingsSchema.parse(merged);
      const settingsPath = this.getSettingsPath();
      const settingsDir = path.dirname(settingsPath);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      fs.writeFileSync(settingsPath, JSON.stringify(validated, null, 2), "utf-8");
      aiLogger.info({ provider: validated.provider, highlightModel: validated.highlightModel }, "Saved xclips AI settings with provider-specific API keys");
      return { success: true, data: validated };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save AI configuration";
      aiLogger.error({ err }, "Failed to save AI configuration");
      return { success: false, error: msg };
    }
  }

  /**
   * Resolves default base URL for each AI provider
   */
  getDefaultBaseUrlForProvider(provider: AiProviderType): string {
    switch (provider) {
      case "kieai":
        return "https://api.kie.ai";
      case "gemini":
        return "https://generativelanguage.googleapis.com/v1beta";
      case "openai":
        return "https://api.openai.com/v1";
      case "anthropic":
        return "https://api.anthropic.com/v1";
      default:
        return "https://api.kie.ai";
    }
  }

  /**
   * Returns available static models for provider
   */
  async fetchAvailableModels(
    provider: AiProviderType,
    _baseUrl?: string,
    _apiKey?: string
  ): Promise<Result<string[]>> {
    const models = AI_PROVIDER_MODELS[provider]?.map((m) => m.id) || [];
    return {
      success: true,
      data: models,
    };
  }

  /**
   * Tests and validates AI provider API credentials with a fast lightweight ping
   */
  async validateApiKey(
    provider: AiProviderType,
    baseUrl: string,
    apiKey: string,
    model?: string
  ): Promise<Result<{ status: "ok"; message: string }>> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: "API Key tidak boleh kosong" };
    }

    try {
      if (provider === "anthropic") {
        const targetUrl = baseUrl.endsWith("/messages")
          ? baseUrl
          : `${baseUrl.replace(/\/+$/, "")}/v1/messages`;
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: model || "claude-3-5-haiku-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (res.status === 200 || res.status === 400) {
          const json = (await res.json().catch(() => ({}))) as { type?: string; error?: { type?: string; message?: string } };
          if (
            json.type === "error" &&
            (json.error?.type === "authentication_error" ||
              json.error?.type === "permission_error")
          ) {
            return {
              success: false,
              error: json.error?.message || "Claude authentication failed",
            };
          }
          return { success: true, data: { status: "ok", message: "Claude API Key is valid!" } };
        }
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: "Claude API Key is invalid (401/403)" };
        }
        const errText = await res.text().catch(() => "");
        return { success: false, error: `Error (${res.status}): ${errText.slice(0, 100)}` };
      }

      if (provider === "gemini") {
        const targetUrl = baseUrl.includes("generativelanguage.googleapis.com")
          ? `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          : `${baseUrl.replace(/\/+$/, "")}/models`;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (!baseUrl.includes("generativelanguage.googleapis.com")) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
        const res = await fetch(targetUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(12000),
        });

        if (res.ok) {
          return { success: true, data: { status: "ok", message: "API Key Gemini Valid!" } };
        }
        return { success: false, error: `Gemini Auth Error (${res.status})` };
      }

      if (provider === "kieai") {
        // 1. Try Native Gemini endpoint on Kie AI
        const cleanBase = baseUrl.replace(/\/gemini\/v1.*$/, "").replace(/\/+$/, "");
        const targetUrl = `${cleanBase}/gemini/v1/models/gemini-3-7-flash:generateContent`;
        try {
          const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "ping" }] }],
              generationConfig: { maxOutputTokens: 1 },
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok) {
            const resJson = (await res.json().catch(() => ({}))) as { code?: number; msg?: string };
            if (resJson.code === 401 || resJson.msg?.toLowerCase().includes("unauthorized")) {
              return { success: false, error: resJson.msg || "KIE AI: API Key Tidak Valid / Unauthorized" };
            }
            return { success: true, data: { status: "ok", message: "API Key KIE AI Valid & Terhubung!" } };
          }
        } catch {}

        // 2. Fallback to OpenAI-compatible endpoint on Kie AI
        const openAiUrl = "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions";
        const res2 = await fetch(openAiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-3-7-flash",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (res2.ok) {
          const resJson = (await res2.json().catch(() => ({}))) as { code?: number; msg?: string; error?: { message?: string } };
          if (resJson.code === 401 || resJson.error) {
            return { success: false, error: resJson.msg || resJson.error?.message || "KIE AI: API Key Tidak Valid" };
          }
          return { success: true, data: { status: "ok", message: "API Key KIE AI Valid & Terhubung!" } };
        }

        return { success: false, error: `KIE AI Error (${res2.status})` };
      }

      if (provider === "openai") {
        // Direct official OpenAI model list endpoint (token-free and always works for valid keys)
        const modelsUrl = baseUrl.includes("/v1")
          ? `${baseUrl.replace(/\/+$/, "")}/models`
          : `${baseUrl.replace(/\/+$/, "")}/v1/models`;

        try {
          const res = await fetch(modelsUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(12000),
          });

          if (res.ok) {
            return { success: true, data: { status: "ok", message: "OpenAI API Key is valid & connected!" } };
          }
          if (res.status === 401 || res.status === 403) {
            return { success: false, error: "OpenAI API Key is invalid / unauthorized (401/403)" };
          }
          const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          return { success: false, error: errJson?.error?.message || `OpenAI Auth Error (${res.status})` };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Failed to connect to OpenAI: ${errMsg}` };
        }
      }

      // Custom (OpenAI Compatible)
      const targetUrl = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const testModel = model || "gpt-4o";

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        return { success: true, data: { status: "ok", message: "API Key is valid & connected!" } };
      }

      const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: Authentication failed`;
      return { success: false, error: errMsg };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to API server";
      return { success: false, error: msg };
    }
  }

  /**
   * Downloads and ingests a video from a YouTube URL with instant subtitle parsing
   */
  async ingestYouTubeUrl(
    url: string,
    options?: {
      quality?: "best" | "1080p" | "720p" | "480p";
      customName?: string;
      downloadSubtitles?: boolean;
      timeRange?: TimeRange;
    },
    onProgress?: (progress: DownloadProgress) => void,
    onEagerProjectReady?: (project: XclipsProject) => void
  ): Promise<Result<XclipsProject>> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const downloadDir = path.resolve(process.cwd(), "vault", "xclips", "downloads", projectId);
    fs.mkdirSync(downloadDir, { recursive: true });

    // P2: Eager Subtitle Interception (Fast background fetch in ~1.5 - 2.5s)
    const shouldDownloadSubs = options?.downloadSubtitles ?? true;
    if (shouldDownloadSubs && /youtube\.com|youtu\.be/i.test(url)) {
      fetchYouTubeSubtitlesQuick(url, downloadDir)
        .then((subRes) => {
          if (subRes.success && subRes.data && fs.existsSync(subRes.data)) {
            try {
              const srtContent = fs.readFileSync(subRes.data, "utf-8");
              const words = parseSrtToWords(srtContent);
              if (words.length > 0) {
                detectTokenFillers(words);
                const transcript: XclipsTranscript = {
                  id: `tr_yt_${Date.now()}`,
                  projectId,
                  label: "YouTube Subtitles (CC)",
                  sourceType: "youtube_cc",
                  isActive: true,
                  language: "id",
                  rawText: words.map((w) => w.word).join(" "),
                  srtContent,
                  words,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                xclipsDb.saveTranscript(transcript);

                // Initialize stub project if not created yet so UI can immediately show transcript & autoclip
                const existingProj = xclipsDb.getProject(projectId);
                if (!existingProj) {
                  const stubProject: XclipsProject = {
                    id: projectId,
                    name: options?.customName || "YouTube Video",
                    sourceType: "youtube",
                    sourcePath: "",
                    durationSec: 0,
                    width: 1920,
                    height: 1080,
                    frameRate: 30,
                    isVfr: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  xclipsDb.saveProject(stubProject);
                  if (onEagerProjectReady) onEagerProjectReady(stubProject);
                }
                aiLogger.info(
                  { projectId, wordsCount: words.length },
                  "P2 Eager Subtitles stored in SQLite ahead of media download"
                );
              }
            } catch (err) {
              aiLogger.warn({ err }, "P2 Eager subtitle parsing encountered an error");
            }
          }
        })
        .catch(() => {});
    }

    const dlRes = await downloadYouTubeVideo(
      {
        url,
        outputDir: downloadDir,
        quality: options?.quality || "1080p",
        downloadSubtitles: shouldDownloadSubs,
        timeRange: options?.timeRange,
      },
      onProgress
    );

    if (!dlRes.success) {
      return { success: false, error: dlRes.error };
    }

    const { videoPath, srtPath, info } = dlRes.data;

    // Probe the downloaded video
    const probeRes = await probeMedia(videoPath);
    if (!probeRes.success) {
      return { success: false, error: probeRes.error };
    }

    const metadata = probeRes.data;
    const projectName =
      options?.customName || info.title || path.basename(videoPath, path.extname(videoPath));

    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", projectId);
    fs.mkdirSync(cacheDir, { recursive: true });

    let normalizedPath: string | undefined = undefined;

    // VFR check and normalizer if needed
    if (metadata.isVfr) {
      const cfrPath = path.join(cacheDir, `cfr_normalized_${path.basename(videoPath)}`);
      const cfrRes = await normalizeToCfr(videoPath, cfrPath, metadata.fps);
      if (cfrRes.success && cfrRes.data) {
        normalizedPath = cfrRes.data;
      }
    }

    // Extract audio WAV for transcription
    const audioPath = path.join(cacheDir, "audio_16k.wav");
    const audioRes = await extractAudioWav(videoPath, audioPath);

    let detectedSourceType: "youtube" | "tiktok" | "instagram" = "youtube";
    if (/tiktok\.com/i.test(url)) detectedSourceType = "tiktok";
    else if (/instagram\.com/i.test(url)) detectedSourceType = "instagram";

    const project: XclipsProject = {
      id: projectId,
      name: projectName,
      sourceType: detectedSourceType,
      sourcePath: videoPath,
      durationSec: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.fps,
      isVfr: metadata.isVfr,
      normalizedPath,
      audioPath: audioRes.success ? audioRes.data : undefined,
      sourceMeta: {
        videoId: info.id,
        title: info.title,
        channel: info.channel,
        uploader: info.uploader,
        description: info.description,
        webpageUrl: info.webpageUrl,
        thumbnail: info.thumbnail,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    xclipsDb.saveProject(project);

    // If auto-subtitles were downloaded and not already captured by eager fetch, parse & populate!
    const existingTranscripts = xclipsDb.getProjectTranscripts(projectId);
    const hasExistingSub = existingTranscripts.some((t) => t.sourceType === "youtube_cc");

    if (!hasExistingSub && srtPath && fs.existsSync(srtPath)) {
      try {
        const srtContent = fs.readFileSync(srtPath, "utf-8");
        const words = parseSrtToWords(srtContent);
        if (words.length > 0) {
          detectTokenFillers(words);
          const transcript: XclipsTranscript = {
            id: `tr_yt_${Date.now()}`,
            projectId: project.id,
            label: "YouTube Subtitles (CC)",
            sourceType: "youtube_cc",
            isActive: true,
            language: "id",
            rawText: words.map((w) => w.word).join(" "),
            srtContent,
            words,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          xclipsDb.saveTranscript(transcript);
        }
      } catch (err) {
        console.error("Error parsing YouTube subtitle file:", err);
      }
    }

    return { success: true, data: project };
  }

  /**
   * Ingests a local video/audio file into a new project
   */
  async ingestLocalFile(
    sourcePath: string,
    customName?: string
  ): Promise<Result<XclipsProject>> {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: `File tidak ditemukan: ${sourcePath}` };
    }

    const probeRes = await probeMedia(sourcePath);
    if (!probeRes.success) {
      return { success: false, error: probeRes.error };
    }

    const metadata = probeRes.data;
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const projectName = customName || path.basename(sourcePath, path.extname(sourcePath));

    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", projectId);
    fs.mkdirSync(cacheDir, { recursive: true });

    let normalizedPath: string | undefined = undefined;

    // VFR check and normalizer
    if (metadata.isVfr) {
      const cfrPath = path.join(cacheDir, `cfr_normalized_${path.basename(sourcePath)}`);
      const cfrRes = await normalizeToCfr(sourcePath, cfrPath, metadata.fps);
      if (cfrRes.success && cfrRes.data) {
        normalizedPath = cfrRes.data;
      }
    }

    // Extract audio WAV for transcription
    const audioPath = path.join(cacheDir, "audio_16k.wav");
    const audioRes = await extractAudioWav(sourcePath, audioPath);

    const project: XclipsProject = {
      id: projectId,
      name: projectName,
      sourceType: "local",
      sourcePath,
      durationSec: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.fps,
      isVfr: metadata.isVfr,
      normalizedPath,
      audioPath: audioRes.success ? audioRes.data : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    xclipsDb.saveProject(project);
    return { success: true, data: project };
  }

  /**
   * Universal Smart AI Dispatcher supporting Native Gemini (Kie AI & Google AI Studio) and OpenAI standard formats
   */
  private async dispatchAiContent(params: {
    provider: AiProviderType;
    baseUrl: string;
    apiKey: string;
    model: string;
    systemPrompt?: string;
    userPrompt: string;
    base64Audio?: string;
    audioFormat?: "mp3" | "wav";
    timeoutMs?: number;
  }): Promise<Result<string>> {
    const {
      provider,
      baseUrl,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      base64Audio,
      audioFormat = "mp3",
      timeoutMs = 120000,
    } = params;

    const isCustomClaude = provider === "anthropic" && !baseUrl.includes("anthropic.com");

    const isKieAi = provider === "kieai" || baseUrl.includes("kie.ai");
    const isGeminiDirect = (provider === "gemini" || baseUrl.includes("generativelanguage.googleapis.com")) && !isKieAi;
    const isGeminiModel = model.toLowerCase().startsWith("gemini") || model.toLowerCase().includes("flash") || model.toLowerCase().includes("pro");

    try {
      if (isCustomClaude) {
        const targetUrl = baseUrl.endsWith("/messages") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/messages`;
        const response = await fetch(targetUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: "user", content: userPrompt }] }), signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) return { success: false, error: `AI API Error (${response.status})` };
        const json = await response.json() as { content?: Array<{ text?: string }> };
        const text = json.content?.map((part) => part.text || "").join("").trim() || "";
        return text ? { success: true, data: text } : { success: false, error: `Model ${model} mengembalikan respons teks kosong.` };
      }
      if (isGeminiDirect && isGeminiModel) {
        // Native Google AI Studio Gemini REST format
        const cleanBase = baseUrl.replace(/\/models.*$/, "").replace(/\/+$/, "");
        const targetUrl = `${cleanBase}/models/${model}:generateContent?key=${apiKey}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };

        const promptCombined = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        const parts: Array<Record<string, unknown>> = [{ text: promptCombined }];

        if (base64Audio) {
          parts.push({
            inlineData: {
              mimeType: audioFormat === "mp3" ? "audio/mp3" : "audio/wav",
              data: base64Audio,
            },
          });
        }

        const generationConfig: Record<string, unknown> = {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };

        const payload = {
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig,
        };

        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          let detailedError = errText;
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr.error?.message) detailedError = parsedErr.error.message;
          } catch {}
          return {
            success: false,
            error: `Gemini API Error (${response.status}): ${detailedError.slice(0, 300)}`,
          };
        }

        const resJson = await response.json();
        let textContent = "";
        const candidateParts = resJson.candidates?.[0]?.content?.parts;
        if (Array.isArray(candidateParts) && candidateParts.length > 0) {
          const nonThoughtParts = candidateParts.filter((p: Record<string, unknown>) => !p.thought && typeof p.text === "string");
          if (nonThoughtParts.length > 0) {
            textContent = nonThoughtParts.map((p: Record<string, unknown>) => p.text).join("");
          } else {
            textContent = candidateParts.map((p: Record<string, unknown>) => (typeof p.text === "string" ? p.text : "")).join("");
          }
        } else {
          textContent = resJson.choices?.[0]?.message?.content || "";
        }

        return { success: true, data: textContent };
      }

      // OpenAI / Anthropic / Kie AI / Custom compatible format
      let targetUrl = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      if (!targetUrl.includes("/v1/") && !targetUrl.endsWith("/v1/chat/completions")) {
        if (targetUrl.endsWith("/chat/completions")) {
          targetUrl = targetUrl.replace(/\/chat\/completions$/, "/v1/chat/completions");
        }
      }

      let modelToUse = model;

      // Handle Kie AI specialized endpoints
      if (isKieAi) {
        if (model.includes("gemini-3-7-flash-openai") || model.includes("gemini-3.7-flash-openai")) {
          targetUrl = "https://api.kie.ai/gemini-3-7-flash-openai/v1/chat/completions";
          modelToUse = "gemini-3-7-flash";
        } else if (model.includes("gemini-3-6-flash-openai") || model.includes("gemini-3.6-flash-openai")) {
          targetUrl = "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions";
          modelToUse = "gemini-3-6-flash";
        } else {
          targetUrl = "https://api.kie.ai/v1/chat/completions";
          modelToUse = model;
        }
      }

      const messages: Array<Record<string, unknown>> = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      if (base64Audio) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: audioFormat,
              },
            },
          ],
        });
      } else {
        messages.push({ role: "user", content: userPrompt });
      }

      // OpenAI API requires "max_completion_tokens" and forbids custom temperature for newer reasoning models (GPT-5.x / o-series)
      const isReasoningModel = /^(gpt-5|o[134])/i.test(modelToUse);
      const tokenParam = isReasoningModel ? "max_completion_tokens" : "max_tokens";

      const payload: Record<string, unknown> = {
        model: modelToUse,
        messages,
        [tokenParam]: 8192,
      };

      // Reasoning models (o1, o3, gpt-5.x) do not accept custom temperature on OpenAI
      if (!isReasoningModel) {
        payload.temperature = 0.1;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        // Read error body once to avoid empty string on subsequent reads
        const errText = await response.text().catch(() => "");

        // Adaptive retry 1: if provider rejects custom temperature on reasoning models
        if (response.status === 400 && /temperature/i.test(errText) && payload.temperature !== undefined) {
          aiLogger.warn({ model: modelToUse }, "AI provider rejected custom temperature, retrying without temperature");
          const retryPayload = { ...payload };
          delete retryPayload.temperature;
          const retryRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(retryPayload),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (retryRes.ok) {
            const retryJson = await retryRes.json();
            return { success: true, data: retryJson.choices?.[0]?.message?.content || "" };
          }
        }

        // Adaptive retry 2: if provider rejects the token parameter name, swap and retry once
        if (response.status === 400) {
          const isTokenParamError =
            /max_tokens|max_completion_tokens/i.test(errText) &&
            /not supported|unsupported parameter|use 'max_completion_tokens'|use 'max_tokens'/i.test(errText);
          if (isTokenParamError) {
            aiLogger.warn({ model: modelToUse }, "AI provider rejected token parameter name, swapping parameter");
            const retryPayload: Record<string, unknown> = { ...payload };
            delete retryPayload[tokenParam];
            retryPayload[isReasoningModel ? "max_tokens" : "max_completion_tokens"] = 8192;
            const retryRes = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(retryPayload),
              signal: AbortSignal.timeout(timeoutMs),
            });
            if (retryRes.ok) {
              const retryJson = await retryRes.json();
              return { success: true, data: retryJson.choices?.[0]?.message?.content || "" };
            }
          }
        }

        // Adaptive retry 3: if model is not found (404 or 400 model_not_found), automatically fallback to gpt-4o
        const isModelNotFound =
          response.status === 404 ||
          (response.status === 400 && /does not exist|model_not_found|not have access|invalid_model/i.test(errText));
        if (isModelNotFound && modelToUse !== "gpt-4o") {
          aiLogger.warn({ model: modelToUse, fallbackModel: "gpt-4o" }, "Model not found on AI provider, retrying with gpt-4o");
          const fallbackPayload: Record<string, unknown> = {
            ...payload,
            model: "gpt-4o",
            max_tokens: 8192,
            temperature: 0.1,
          };
          delete fallbackPayload.max_completion_tokens;
          const fallbackRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(fallbackPayload),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            return { success: true, data: fallbackJson.choices?.[0]?.message?.content || "" };
          }
        }

        // Adaptive retry 4: if Kie AI specialized route returns 404, fallback to /v1/chat/completions
        if (isKieAi && response.status === 404 && !targetUrl.endsWith("/v1/chat/completions")) {
          aiLogger.warn({ targetUrl, fallbackUrl: "https://api.kie.ai/v1/chat/completions" }, "Kie AI specialized route 404, falling back to /v1/chat/completions");
          const fallbackRes = await fetch("https://api.kie.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              ...payload,
              model: model,
            }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            return { success: true, data: fallbackJson.choices?.[0]?.message?.content || "" };
          }
        }

        let detailedError = errText;
        try {
          const parsedErr = JSON.parse(errText);
          if (parsedErr.error?.message) {
            detailedError = parsedErr.error.message;
          } else if (parsedErr.message) {
            detailedError = parsedErr.message;
          } else if (parsedErr.msg) {
            detailedError = parsedErr.msg;
          }
        } catch {}

        return {
          success: false,
          error: `AI API Error (${response.status}): ${detailedError.slice(0, 300)}`,
        };
      }

      const resJson = await response.json();
      let textContent =
        resJson.choices?.[0]?.message?.content ||
        resJson.choices?.[0]?.message?.reasoning_content ||
        resJson.choices?.[0]?.text ||
        "";

      if (typeof textContent === "string") {
        textContent = textContent.trim();
      } else {
        textContent = "";
      }

      if (!textContent) {
        return {
          success: false,
          error: `Model ${modelToUse} mengembalikan respons teks kosong.`,
        };
      }

      return { success: true, data: textContent };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process AI request";
      return { success: false, error: msg };
    }
  }

  /**
   * Detects and synthesizes a high-retention viral narrative topic from video title and transcript sample
   * using the built-in Requesty Light Model Helper (Zero-Config)
   */
  async detectNarrativeTopic(options: {
    projectId?: string;
    title?: string;
    transcriptText?: string;
    lightModel?: string;
    outputLanguage?: string;
  }): Promise<Result<{ topicPrompt: string; modelUsed: string }>> {
    const REQUESTY_BUILTIN_API_KEY =
      "rqsty-sk-yDRXwua9Q0eFIjeidKgP1tYPL2DhE/0QFk9ThwKT4aosEfROhA+ObqyF40yN0BFxQN1glbx6SfvfS2IusK8PQbbvnxiqMBBnk7L7Jjkp4gM=";
    const REQUESTY_ROUTER_BASE_URL = "https://router.requesty.ai/v1";

    try {
      let title = options.title || "";
      let transcriptSample = options.transcriptText || "";
      let metadataContext = "";

      if (options.projectId) {
        const project = xclipsDb.getProject(options.projectId);
        if (project) {
          if (!title) title = project.name;
        }
        // Prefer the YouTube CC transcript (original platform subtitles) over AI-generated tracks
        const allTracks = xclipsDb.getProjectTranscripts(options.projectId);
        const ytTrack =
          allTracks.find((t) => t.sourceType === "youtube_cc" && (t.rawText || "").trim().length > 0) ||
          null;
        const transcript = ytTrack || xclipsDb.getTranscript(options.projectId);
        if (transcript && !transcriptSample) {
          transcriptSample = transcript.rawText || "";
        }
        // Enrich with persisted platform metadata
        const meta = project?.sourceMeta;
        if (meta) {
          if (!title && meta.title) title = meta.title;
          metadataContext = [
            meta.title ? `Title: ${meta.title}` : "",
            meta.channel || meta.uploader ? `Channel / Creator: ${meta.channel || meta.uploader}` : "",
            meta.webpageUrl ? `Source URL: ${meta.webpageUrl}` : "",
            meta.description ? `Description: ${meta.description.slice(0, 800).replace(/[\r\n]+/g, " ")}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        }
      }

      // Clean up title
      const cleanTitle = title
        .replace(/\.(mp4|mkv|webm|mov|avi)$/i, "")
        .replace(/\[[a-zA-Z0-9_-]{11}\]/g, "")
        .replace(/[_-]/g, " ")
        .trim();

      // Sample first ~6000 chars of transcript (original CC preferred)
      const sample = transcriptSample.slice(0, 6000).trim();

      const settings = this.getAiSettings();
      const modelToUse = options.lightModel || settings.lightModel || "muse-glimmer-30b";
      const langCode = options.outputLanguage || settings.outputLanguage || "auto";

      const isIndonesian =
        langCode === "id" ||
        (langCode === "auto" && /\b(yang|dan|di|ini|itu|dengan|untuk|dari|tidak|akan|pada|adalah|karena|dalam|bisa|saya|kita|mereka|ekonomi|rakyat|negara|sosialisme|kapitalisme)\b/i.test(`${cleanTitle} ${sample}`));

      let langInstruction = "";
      if (isIndonesian) {
        langInstruction = `CRITICAL: The output MUST be 100% in natural BAHASA INDONESIA. Start your instruction with "Fokus pada...".\nExample output: Fokus pada perdebatan antara kapitalisme dan sosialisme, solusi kemiskinan berbasis data, serta peran koperasi.`;
      } else if (langCode !== "auto" && langCode !== "en") {
        langInstruction = `CRITICAL: The output MUST be 100% in target language (code: ${langCode}).`;
      }

      const systemPrompt = `You are a viral short-form video strategist and content editor (TikTok, Reels, Shorts).
Your goal is to extract the single most compelling core topic / narrative direction from the video metadata (title, channel, description) and the transcript excerpt (the original YouTube closed captions when available).
Output ONLY a concise, high-impact instruction (1-2 sentences).
${langInstruction}
Do not include quotation marks, markdown headings, or conversational filler.`;

      const userPrompt = `Video Title: "${cleanTitle || "Untitled Video"}"
${metadataContext ? `\nSOURCE VIDEO METADATA (YOUTUBE / PLATFORM):\n${metadataContext}\n` : ""}
Transcript Excerpt (original platform captions when available):
"""
${sample || "No transcript available. Infer from title, channel, and description."}
"""

Synthesize the single best viral narrative focus prompt:`;

      const response = await fetch(`${REQUESTY_ROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REQUESTY_BUILTIN_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://xclips.local",
          "X-Title": "xClips Studio",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        aiLogger.warn({ status: response.status, errText }, "Requesty Light Model returned non-OK status, using smart fallback");
        const fallbackTopic = isIndonesian
          ? (cleanTitle
              ? `Fokus pada poin-poin penting, strategi kunci, dan wawasan utama dari "${cleanTitle}".`
              : "Fokus pada wawasan paling aplikatif, pelajaran penting, dan momen paling berkesan dari video ini.")
          : (cleanTitle
              ? `Focus on core takeaways, key strategies, and actionable insights from "${cleanTitle}".`
              : "Focus on the most actionable insights, key lessons, and memorable moments from this video.");

        return {
          success: true,
          data: {
            topicPrompt: fallbackTopic,
            modelUsed: `${modelToUse} (fallback)`,
          },
        };
      }

      const resJson = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      let topicPrompt = resJson.choices?.[0]?.message?.content?.trim() || "";

      // Clean prompt
      topicPrompt = topicPrompt.replace(/^["'`]+|["'`]+$/g, "").trim();
      if (isIndonesian) {
        topicPrompt = topicPrompt.replace(/^(focus on|fokus pada|fokus ke)\s*/i, "").trim();
        topicPrompt = `Fokus pada ${topicPrompt.charAt(0).toLowerCase() + topicPrompt.slice(1)}`;
      } else {
        topicPrompt = topicPrompt.replace(/^(fokus pada|focus on|fokus ke)\s*/i, "").trim();
        topicPrompt = `Focus on ${topicPrompt.charAt(0).toLowerCase() + topicPrompt.slice(1)}`;
      }

      aiLogger.info({ modelToUse, topicPrompt }, "Successfully synthesized narrative topic using Requesty Light Model");
      return {
        success: true,
        data: {
          topicPrompt,
          modelUsed: modelToUse,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      aiLogger.warn({ err: msg }, "Requesty Light Model call failed/timeout, smart fallback generated");
      const fallbackTitle = (options.title || "").replace(/\.(mp4|mkv|webm|mov|avi)$/i, "").trim();
      return {
        success: true,
        data: {
          topicPrompt: fallbackTitle
            ? `Focus on key takeaways, core strategies, and valuable discussions from "${fallbackTitle}".`
            : "Focus on key insights, memorable soundbites, and actionable takeaways from this video.",
          modelUsed: "local-heuristic",
        },
      };
    }
  }

  /**
   * Helper to parse JSON or fallback regex for word timestamps from AI response
   */
  private parseTranscriptWords(rawStr: string): { fullText: string; words: WordTimestamp[] } {
    if (!rawStr || typeof rawStr !== "string") {
      return { fullText: "", words: [] };
    }

    const cleanStr = rawStr
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const jsonMatch = cleanStr.match(/\{[\s\S]*\}/);
      const target = jsonMatch ? jsonMatch[0] : cleanStr;
      const parsed = JSON.parse(target) as {
        fullText?: string;
        text?: string;
        words?: unknown[];
        segments?: unknown[];
      };
      const rawWords = parsed?.words || parsed?.segments;
      if (parsed && Array.isArray(rawWords) && rawWords.length > 0) {
        const words: WordTimestamp[] = [];
        for (const item of rawWords) {
          if (item && typeof item === "object") {
            if (Array.isArray(item)) {
              // Compact array format: [word, start, end]
              const wordStr = String(item[0] || "").trim();
              const startNum = parseFloat(String(item[1] || 0));
              const endNum = parseFloat(String(item[2] || 0));
              if (wordStr.length > 0 && !isNaN(startNum) && !isNaN(endNum)) {
                words.push({
                  word: wordStr,
                  start: parseFloat(startNum.toFixed(2)),
                  end: parseFloat(Math.max(startNum + 0.05, endNum).toFixed(2)),
                  confidence: 1.0,
                  isFiller: false,
                  excluded: false,
                });
              }
            } else {
              const w = item as Record<string, unknown>;
              const wordStr = typeof w.word === "string" ? w.word.trim() : typeof w.text === "string" ? w.text.trim() : "";
              const startNum = typeof w.start === "number" ? w.start : parseFloat(String(w.start || 0));
              const endNum = typeof w.end === "number" ? w.end : parseFloat(String(w.end || 0));

              if (wordStr.length > 0 && !isNaN(startNum) && !isNaN(endNum)) {
                words.push({
                  word: wordStr,
                  start: parseFloat(startNum.toFixed(2)),
                  end: parseFloat(Math.max(startNum + 0.05, endNum).toFixed(2)),
                  confidence: 1.0,
                  isFiller: false,
                  excluded: false,
                });
              }
            }
          }
        }

        if (words.length > 0) {
          return {
            fullText: parsed.fullText || parsed.text || words.map((w) => w.word).join(" "),
            words,
          };
        }
      }
    } catch (_err) {
      // If JSON.parse fails (e.g. truncated JSON from large audio chunk), fallback to regex token extractor
    }

    // Fallback 1: extract word-level timestamps using regex (handles truncated/unterminated JSON)
    const words: WordTimestamp[] = [];
    const tokenRegex = /\{\s*"(?:word|text)"\s*:\s*"([^"]+)"\s*,\s*"start"\s*:\s*([0-9.]+)\s*,\s*"end"\s*:\s*([0-9.]+)/g;
    let match;
    while ((match = tokenRegex.exec(cleanStr)) !== null) {
      const word = match[1].trim();
      const start = parseFloat(match[2]);
      const end = parseFloat(match[3]);
      if (word && !isNaN(start) && !isNaN(end)) {
        words.push({
          word,
          start: parseFloat(start.toFixed(2)),
          end: parseFloat(Math.max(start + 0.05, end).toFixed(2)),
          confidence: 1.0,
          isFiller: false,
          excluded: false,
        });
      }
    }

    if (words.length > 0) {
      return {
        fullText: words.map((w) => w.word).join(" "),
        words,
      };
    }

    // Fallback 2: Array-of-arrays regex fallback (e.g. [ "halo", 0.12, 0.45 ])
    const arrayTokenRegex = /\[\s*"([^"]+)"\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]/g;
    let arrMatch;
    while ((arrMatch = arrayTokenRegex.exec(cleanStr)) !== null) {
      const word = arrMatch[1].trim();
      const start = parseFloat(arrMatch[2]);
      const end = parseFloat(arrMatch[3]);
      if (word && !isNaN(start) && !isNaN(end)) {
        words.push({
          word,
          start: parseFloat(start.toFixed(2)),
          end: parseFloat(Math.max(start + 0.05, end).toFixed(2)),
          confidence: 1.0,
          isFiller: false,
          excluded: false,
        });
      }
    }

    if (words.length > 0) {
      return {
        fullText: words.map((w) => w.word).join(" "),
        words,
      };
    }

    // Fallback 3: If model returned plain text or a fullText field without word timestamps
    const textOnlyMatch = cleanStr.match(/"fullText"\s*:\s*"([^"]+)"/i) || cleanStr.match(/"text"\s*:\s*"([^"]+)"/i);
    const textContent = textOnlyMatch ? textOnlyMatch[1] : cleanStr.replace(/[{}[\]"]/g, "").trim();
    if (textContent.length > 0) {
      const tokens = textContent.split(/\s+/).filter(Boolean);
      const estStep = 0.35;
      tokens.forEach((t, i) => {
        words.push({
          word: t,
          start: parseFloat((i * estStep).toFixed(2)),
          end: parseFloat(((i + 1) * estStep).toFixed(2)),
          confidence: 0.8,
          isFiller: false,
          excluded: false,
        });
      });
    }

    return {
      fullText: words.map((w) => w.word).join(" "),
      words,
    };
  }

  /**
   * Dedicated OpenAI Whisper Speech-to-Text with word-level granularity
   */
  private async transcribeWithOpenAiWhisper(params: {
    audioPath: string;
    apiKey: string;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
  }): Promise<Result<{ fullText: string; words: WordTimestamp[] }>> {
    const { audioPath, apiKey, baseUrl, model = "whisper-1", timeoutMs = 60000 } = params;

    if (!fs.existsSync(audioPath)) {
      return { success: false, error: "Berkas audio tidak ditemukan untuk transkripsi Whisper" };
    }

    try {
      const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "https://api.openai.com/v1";
      const targetUrl = cleanBase.endsWith("/audio/transcriptions")
        ? cleanBase
        : cleanBase.includes("/v1")
          ? `${cleanBase}/audio/transcriptions`
          : `${cleanBase}/v1/audio/transcriptions`;

      const audioBuffer = fs.readFileSync(audioPath);
      const fileName = path.basename(audioPath);
      const mimeType = audioPath.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

      const actualWhisperModel = (model === "gpt-transcribe" || !model) ? "whisper-1" : model;

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", audioBlob, fileName);
      formData.append("model", actualWhisperModel);
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "word");

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        const errMsg = errJson?.error?.message || `Whisper Error HTTP ${res.status}`;
        return { success: false, error: errMsg };
      }

      const resJson = (await res.json()) as {
        text?: string;
        words?: Array<{ word?: string; start?: number; end?: number }>;
        segments?: Array<{ text?: string; start?: number; end?: number }>;
      };

      const fullText = resJson.text || "";
      const words: WordTimestamp[] = [];

      if (Array.isArray(resJson.words) && resJson.words.length > 0) {
        for (const w of resJson.words) {
          if (w.word && typeof w.start === "number" && typeof w.end === "number") {
            words.push({
              word: w.word.trim(),
              start: Math.max(0, Number(w.start.toFixed(2))),
              end: Math.max(Number(w.start.toFixed(2)), Number(w.end.toFixed(2))),
              confidence: 1.0,
              isFiller: false,
              excluded: false,
            });
          }
        }
      } else if (Array.isArray(resJson.segments) && resJson.segments.length > 0) {
        // Fallback: segment timestamps converted to words if word granularity is absent
        for (const seg of resJson.segments) {
          const segText = seg.text?.trim() || "";
          const segWords = segText.split(/\s+/).filter(Boolean);
          const segDuration = Math.max(0.1, (seg.end || 0) - (seg.start || 0));
          const perWordDuration = segDuration / Math.max(1, segWords.length);
          segWords.forEach((wordStr, wIdx) => {
            const start = (seg.start || 0) + wIdx * perWordDuration;
            const end = start + perWordDuration;
            words.push({
              word: wordStr,
              start: Number(start.toFixed(2)),
              end: Number(end.toFixed(2)),
              confidence: 1.0,
              isFiller: false,
              excluded: false,
            });
          });
        }
      }

      return {
        success: true,
        data: {
          fullText: fullText || words.map((w) => w.word).join(" "),
          words,
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to process Whisper transcription: ${errMsg}` };
    }
  }

  /**
   * Transcribes project audio using configured AI model with lightweight compression and multi-chunking
   */
  async transcribeProject(
    projectId: string,
    options?: { model?: string; apiKey?: string; label?: string; provider?: AiProviderType } | string
  ): Promise<Result<XclipsTranscript>> {
    const project = xclipsDb.getProject(projectId);
    if (!project) return { success: false, error: "Project not found" };

    const apiKeyOverride = typeof options === "string" ? options : options?.apiKey;
    const modelOverride = typeof options === "object" ? options?.model : undefined;
    const providerOverride = typeof options === "object" ? options?.provider : undefined;

    const settings = this.getAiSettings();

    // Auto-detect target provider from model name if not explicitly provided
    let targetProvider: AiProviderType = providerOverride || settings.provider || "kieai";
    if (!providerOverride && modelOverride) {
      if (modelOverride.startsWith("gemini-3.7") || modelOverride.startsWith("gemini-3.5") || modelOverride.startsWith("gemini-3.1") || modelOverride.startsWith("gemini-3.6")) {
        targetProvider = settings.provider === "kieai" && !settings.apiKeys?.gemini ? "kieai" : "gemini";
      } else if (modelOverride === "gemini-3-7-flash") {
        targetProvider = settings.provider === "gemini" && settings.apiKeys?.gemini ? "gemini" : "kieai";
      } else if (modelOverride.startsWith("whisper") || modelOverride.startsWith("gpt-") || modelOverride.includes("transcribe")) {
        targetProvider = "openai";
      } else if (modelOverride.startsWith("claude-")) {
        targetProvider = "anthropic";
      }
    }

    const providerUrlMap: Record<AiProviderType, string> = {
      kieai: "https://api.kie.ai",
      gemini: "https://generativelanguage.googleapis.com/v1beta",
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
    };

    const targetBaseUrl = (settings.provider === targetProvider && settings.baseUrl) ? settings.baseUrl : providerUrlMap[targetProvider];
    
    // Resolve API key with robust multi-level fallback
    let apiKey: string | undefined = apiKeyOverride || settings.apiKeys?.[targetProvider];
    if (!apiKey && settings.provider === targetProvider && settings.apiKey) {
      apiKey = settings.apiKey;
    }
    if (!apiKey && targetProvider === "openai") {
      apiKey = settings.apiKeys?.openai || settings.apiKey;
    }
    if (!apiKey && (targetProvider === "kieai" || targetProvider === "gemini")) {
      apiKey = settings.apiKeys?.kieai || settings.apiKeys?.gemini || (settings.provider === "kieai" || settings.provider === "gemini" ? settings.apiKey : undefined);
    }
    if (!apiKey && settings.apiKey && settings.apiKey.trim().length > 0) {
      apiKey = settings.apiKey;
    }
    if (!apiKey && process.env.KIE_AI_API_KEY) {
      apiKey = process.env.KIE_AI_API_KEY;
    }

    if (!apiKey || !apiKey.trim()) {
      aiLogger.warn({ projectId, targetProvider }, "Transcription requested without API key for target provider");
      return {
        success: false,
        error: `API Key for provider ${targetProvider.toUpperCase()} is not configured. Please open AI Settings.`,
      };
    }

    const videoPath = project.normalizedPath || project.sourcePath;
    const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", projectId);
    fs.mkdirSync(cacheDir, { recursive: true });

    // Use compressed MP3 audio for 6x faster upload and reliable API payload size
    const compressedAudioPath = path.join(cacheDir, "audio_compressed.mp3");
    if (!fs.existsSync(compressedAudioPath) && fs.existsSync(videoPath)) {
      await extractCompressedAudio(videoPath, compressedAudioPath, "48k");
    }

    const audioToUse = fs.existsSync(compressedAudioPath)
      ? compressedAudioPath
      : (project.audioPath && fs.existsSync(project.audioPath) ? project.audioPath : null);

    if (!audioToUse) {
      aiLogger.error({ projectId }, "Audio file not found for transcription");
      return { success: false, error: "Project audio file not found" };
    }

    try {
      let modelToUse = modelOverride || settings.transcribeModel || settings.highlightModel || "gemini-3-7-flash";
      const totalDuration = project.durationSec || 60;
      const CHUNK_DURATION = 900; // 15 minutes per chunk if duration > 30 minutes

      const allWords: WordTimestamp[] = [];
      let fullTextCombined = "";

      const isWhisperStt =
        modelToUse === "gpt-transcribe" ||
        modelToUse.toLowerCase().startsWith("whisper") ||
        (targetProvider === "openai" && (modelToUse === "whisper-1" || modelToUse === "gpt-transcribe"));

      if (isWhisperStt) {
        const whisperModel = modelToUse === "gpt-transcribe" ? "whisper-1" : modelToUse;
        // OpenAI Whisper / Transcribe STT API (/v1/audio/transcriptions)
        // Cap single request at 300s (5 minutes) to avoid gateway timeouts and large payload bottlenecks
        const MAX_SINGLE_WHISPER_DURATION = 300;

        if (totalDuration <= MAX_SINGLE_WHISPER_DURATION) {
          const timeoutMs = Math.max(90000, Math.ceil(totalDuration * 1000 * 0.5));
          aiLogger.info({ projectId, model: whisperModel, provider: targetProvider, timeoutMs }, "Dispatching single OpenAI Whisper transcription request");
          const whisperRes = await this.transcribeWithOpenAiWhisper({
            audioPath: audioToUse,
            apiKey,
            baseUrl: targetBaseUrl,
            model: whisperModel,
            timeoutMs,
          });

          if (!whisperRes.success) {
            return { success: false, error: whisperRes.error };
          }

          fullTextCombined = whisperRes.data.fullText;
          allWords.push(...whisperRes.data.words);
        } else {
          // Multi-chunk for longer files (120 seconds per chunk for high reliability)
          const WHISPER_CHUNK_DURATION = 120;
          const chunkCount = Math.ceil(totalDuration / WHISPER_CHUNK_DURATION);
          aiLogger.info(
            { projectId, totalDuration, chunkCount, chunkSizeSec: WHISPER_CHUNK_DURATION, provider: targetProvider },
            "Starting multi-chunk OpenAI Whisper audio transcription"
          );

          const chunkResults: Array<{ cIdx: number; fullText: string; words: WordTimestamp[] }> = [];
          const CONCURRENCY = Math.min(3, Math.max(1, chunkCount));
          let currentWhisperIdx = 0;

          const worker = async () => {
            while (currentWhisperIdx < chunkCount) {
              const cIdx = currentWhisperIdx++;
              const chunkStart = cIdx * WHISPER_CHUNK_DURATION;
              const chunkDuration = Math.min(WHISPER_CHUNK_DURATION, totalDuration - chunkStart);
              const chunkPath = path.join(cacheDir, `audio_chunk_whisper_${cIdx}.mp3`);

              await extractAudioSegment(audioToUse, chunkPath, chunkStart, chunkDuration);
              if (!fs.existsSync(chunkPath)) continue;

              const whisperRes = await this.transcribeWithOpenAiWhisper({
                audioPath: chunkPath,
                apiKey,
                baseUrl: targetBaseUrl,
                model: whisperModel,
                timeoutMs: 90000,
              });

              if (whisperRes.success) {
                const remappedWords = whisperRes.data.words.map((w) => ({
                  ...w,
                  start: parseFloat((w.start + chunkStart).toFixed(2)),
                  end: parseFloat((w.end + chunkStart).toFixed(2)),
                }));
                chunkResults.push({
                  cIdx,
                  fullText: whisperRes.data.fullText,
                  words: remappedWords,
                });
              } else {
                aiLogger.warn(
                  { chunkIndex: cIdx + 1, chunkCount, err: whisperRes.error },
                  "Whisper chunk failed, continuing with remaining chunks"
                );
              }
            }
          };

          await Promise.all(
            Array.from({ length: CONCURRENCY }, () => worker())
          );

          chunkResults.sort((a, b) => a.cIdx - b.cIdx);
          for (const res of chunkResults) {
            if (res.fullText) {
              fullTextCombined += (fullTextCombined ? " " : "") + res.fullText;
            }
            allWords.push(...res.words);
          }
        }
      } else {
        // Gemini / KIE AI Multimodal Audio
        const systemPrompt = `Anda adalah transkriber audio profesional bahasa Indonesia dan Inggris.
Tugas Anda adalah mentranskripsikan audio ke dalam urutan kata-per-kata yang akurat dengan timestamp detik mulai dan selesai relatif terhadap audio input.
Format output WAJIB HANYA berupa JSON valid:
{
  "fullText": "Teks lengkap seluruh audio...",
  "words": [
    { "word": "Halo", "start": 0.12, "end": 0.45 },
    { "word": "teman-teman", "start": 0.48, "end": 0.95 }
  ]
}`;

        // Map custom transcription model alias to actual multimodal LLM model name
        if (modelToUse === "gpt-4o-transcribe") modelToUse = "gpt-4o";
        if (modelToUse === "gpt-4o-mini-transcribe") modelToUse = "gpt-4o-mini";

        const LLM_CHUNK_DURATION = 180; // 180s (3 min) per chunk for optimal context, reduced I/O & low rate-limit overhead

        if (totalDuration <= LLM_CHUNK_DURATION) {
          const audioBuffer = fs.readFileSync(audioToUse);
          const base64Audio = audioBuffer.toString("base64");
          const audioFormat = audioToUse.endsWith(".mp3") ? "mp3" : "wav";

          aiLogger.info({ projectId, audioBytes: audioBuffer.length, model: modelToUse, provider: targetProvider, format: audioFormat }, "Dispatching single audio transcription request");

          const dispatchRes = await this.dispatchAiContent({
            provider: targetProvider,
            baseUrl: targetBaseUrl,
            apiKey,
            model: modelToUse,
            systemPrompt,
            userPrompt: "Transkrip audio berikut dengan format JSON kata-per-kata:",
            base64Audio,
            audioFormat,
            timeoutMs: 60000,
          });

          if (!dispatchRes.success) {
            return { success: false, error: dispatchRes.error };
          }

          const parsed = this.parseTranscriptWords(dispatchRes.data);
          fullTextCombined = parsed.fullText;
          allWords.push(...parsed.words);
        } else {
          // Multi-chunk for videos longer than 45 seconds with concurrency pool
          const chunkCount = Math.ceil(totalDuration / LLM_CHUNK_DURATION);
          aiLogger.info({ projectId, totalDuration, chunkCount, chunkSizeSec: LLM_CHUNK_DURATION, provider: targetProvider }, "Starting multi-chunk audio transcription");

          const chunkResults: Array<{ cIdx: number; fullText: string; words: WordTimestamp[] }> = [];
          const CONCURRENCY = 3;
          let currentIdx = 0;

          const worker = async () => {
            while (currentIdx < chunkCount) {
              const cIdx = currentIdx++;
              const chunkStart = cIdx * LLM_CHUNK_DURATION;
              const chunkDuration = Math.min(LLM_CHUNK_DURATION, totalDuration - chunkStart);
              const chunkPath = path.join(cacheDir, `audio_chunk_${cIdx}.mp3`);

              await extractAudioSegment(audioToUse, chunkPath, chunkStart, chunkDuration);

              if (!fs.existsSync(chunkPath)) continue;

              const audioBuffer = fs.readFileSync(chunkPath);
              const base64Audio = audioBuffer.toString("base64");

              aiLogger.debug({ chunkIndex: cIdx + 1, chunkCount, chunkStart, chunkDuration }, "Transcribing audio chunk");

              const dispatchRes = await this.dispatchAiContent({
                provider: targetProvider,
                baseUrl: targetBaseUrl,
                apiKey,
                model: modelToUse,
                systemPrompt,
                userPrompt: `Transkrip audio segmen ${cIdx + 1}/${chunkCount} dengan format JSON kata-per-kata:`,
                base64Audio,
                audioFormat: "mp3",
                timeoutMs: 60000,
              });

              if (dispatchRes.success) {
                const parsed = this.parseTranscriptWords(dispatchRes.data);
                const remappedWords = parsed.words.map((w) => ({
                  ...w,
                  start: parseFloat((w.start + chunkStart).toFixed(2)),
                  end: parseFloat((w.end + chunkStart).toFixed(2)),
                }));
                chunkResults.push({
                  cIdx,
                  fullText: parsed.fullText,
                  words: remappedWords,
                });
              } else {
                aiLogger.warn({ chunkIndex: cIdx + 1, err: dispatchRes.error }, "Chunk transcription failed, continuing with remaining chunks");
              }
            }
          };

          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunkCount) }, () => worker()));

          // Sort chunks chronologically by index
          chunkResults.sort((a, b) => a.cIdx - b.cIdx);
          for (const res of chunkResults) {
            if (res.fullText) {
              fullTextCombined += (fullTextCombined ? " " : "") + res.fullText;
            }
            allWords.push(...res.words);
          }
        }
      }

      if (allWords.length === 0) {
        return {
          success: false,
          error: `Transkripsi dengan model ${modelToUse} menghasilkan teks kosong atau format tidak sesuai. Pastikan model mendukung input audio multimodal.`,
        };
      }

      // Detect Indonesian filler words at token level
      detectTokenFillers(allWords);

      const labelOverride = typeof options === "object" ? options?.label : undefined;
      const label = labelOverride?.trim() || `Track-${xclipsDb.getProjectTranscripts(project.id).length + 1}`;

      const transcript: XclipsTranscript = {
        id: `tr_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        projectId: project.id,
        label,
        sourceType: "ai",
        isActive: true,
        language: "id",
        rawText: fullTextCombined.trim() || allWords.map((w) => w.word).join(" "),
        srtContent: generateSrtFromWords(allWords),
        words: allWords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      xclipsDb.saveTranscript(transcript);
      aiLogger.info({ projectId, wordsCount: allWords.length, model: modelToUse, trackId: transcript.id }, "Audio transcribed and saved as active subtitle track");
      return { success: true, data: transcript };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to perform AI transcription";
      const stack = err instanceof Error ? err.stack : undefined;
      aiLogger.error({ projectId, err: msg, stack }, "Failed to perform AI transcription");
      return { success: false, error: msg };
    }
  }

  /**
   * Fetches subtitles directly from YouTube source via yt-dlp
   */
  async fetchYouTubeSubtitles(projectId: string): Promise<Result<XclipsTranscript>> {
    const project = xclipsDb.getProject(projectId);
    if (!project) return { success: false, error: "Project not found" };

    if (!project.sourcePath) {
      return { success: false, error: "Source video file not found" };
    }

    try {
      const cacheDir = path.resolve(process.cwd(), "vault", "xclips", "cache", projectId);
      fs.mkdirSync(cacheDir, { recursive: true });

      let srtPath: string | null = null;
      const downloadsDir = path.dirname(project.sourcePath);
      const baseVideoName = path.parse(project.sourcePath).name;
      const idMatch = project.sourcePath.match(/\[([a-zA-Z0-9_-]{11})\]/);
      const ytId = idMatch ? idMatch[1] : null;

      if (fs.existsSync(downloadsDir)) {
        const files = fs.readdirSync(downloadsDir);
        const srtFile = files.find(
          (f) =>
            (f.endsWith(".srt") || f.endsWith(".vtt")) &&
            (f.includes(baseVideoName) || (ytId ? f.includes(ytId) : false))
        );
        if (srtFile) srtPath = path.join(downloadsDir, srtFile);
      }

      if (!srtPath || !fs.existsSync(srtPath)) {
        const ytUrl = idMatch ? `https://www.youtube.com/watch?v=${idMatch[1]}` : (project.sourcePath.startsWith("http") ? project.sourcePath : null);
        if (ytUrl) {
          const ytdlp = findYtDlpBinary();
          const outputTemplate = path.join(cacheDir, "%(title)s [%(id)s].%(ext)s");
          await new Promise<void>((resolve) => {
            const proc = spawn(
              ytdlp,
              [
                "--write-subs",
                "--write-auto-subs",
                "--sub-lang",
                "id,id-orig,en,en-orig",
                "--sub-format",
                "srt/vtt/best",
                "--skip-download",
                "--no-warnings",
                "-o",
                outputTemplate,
                ytUrl,
              ],
              { windowsHide: true }
            );
            proc.on("close", () => resolve());
            proc.on("error", () => resolve());
          });

          const updatedFiles = fs.readdirSync(cacheDir);
          const downloadedSrt = updatedFiles.find((f) => f.endsWith(".srt") || f.endsWith(".vtt"));
          if (downloadedSrt) {
            srtPath = path.join(cacheDir, downloadedSrt);
          }
        }
      }

      if (!srtPath || !fs.existsSync(srtPath)) {
        return {
          success: false,
          error: "YouTube CC subtitles not found for this video. Use AI Transcribe instead.",
        };
      }

      const srtContent = fs.readFileSync(srtPath, "utf-8");
      const words = parseSrtToWords(srtContent);

      if (words.length === 0) {
        return {
          success: false,
          error: "Failed to parse YouTube subtitles. Use AI Transcribe instead.",
        };
      }

      detectTokenFillers(words);

      const transcript: XclipsTranscript = {
        id: `tr_yt_${Date.now()}`,
        projectId: project.id,
        label: "YouTube Subtitles (CC)",
        sourceType: "youtube_cc",
        isActive: true,
        language: "id",
        rawText: words.map((w) => w.word).join(" "),
        srtContent,
        words,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      xclipsDb.saveTranscript(transcript);
      aiLogger.info({ projectId, wordsCount: words.length, trackId: transcript.id }, "YouTube subtitles loaded and saved as active track");
      return { success: true, data: transcript };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load YouTube subtitles";
      return { success: false, error: msg };
    }
  }

  /**
   * Retrieves all saved subtitle tracks for a project
   */
  getProjectSubtitles(projectId: string): Result<XclipsTranscript[]> {
    const tracks = xclipsDb.getProjectTranscripts(projectId);
    return { success: true, data: tracks };
  }

  /**
   * Switches the active subtitle track for a project
   */
  switchActiveSubtitle(projectId: string, transcriptId: string): Result<XclipsTranscript> {
    const ok = xclipsDb.setActiveTranscript(projectId, transcriptId);
    if (!ok) return { success: false, error: "Failed to switch active subtitle track" };

    const active = xclipsDb.getTranscript(projectId, transcriptId);
    if (!active) return { success: false, error: "Subtitle track not found" };

    return { success: true, data: active };
  }

  /**
   * Deletes a specific subtitle track for a project
   */
  deleteProjectSubtitle(
    projectId: string,
    transcriptId: string
  ): Result<{ remaining: XclipsTranscript[]; active: XclipsTranscript | null }> {
    const ok = xclipsDb.deleteTranscript(projectId, transcriptId);
    if (!ok) return { success: false, error: "Failed to delete subtitle track" };

    const remaining = xclipsDb.getProjectTranscripts(projectId);
    const active = xclipsDb.getTranscript(projectId);
    return { success: true, data: { remaining, active } };
  }

  /**
   * Auto-saves word edits to the active transcript track
   */
  saveTranscriptWords(
    projectId: string,
    words: WordTimestamp[],
    transcriptId?: string
  ): Result<XclipsTranscript> {
    const current = xclipsDb.getTranscript(projectId, transcriptId);
    if (!current) return { success: false, error: "Transcript not found" };

    const updated: XclipsTranscript = {
      ...current,
      words,
      rawText: words.map((w) => w.word).join(" "),
      srtContent: generateSrtFromWords(words),
      updatedAt: new Date().toISOString(),
    };

    xclipsDb.saveTranscript(updated);
    return { success: true, data: updated };
  }

  /**
   * Scans transcript using Map-Reduce AI highlight reducer
   */
  async discoverHighlights(
    projectId: string,
    optionsOverride?: {
      apiKey?: string;
      provider?: AiProviderType;
      model?: string;
      topicPrompt?: string;
      editorialFunction?: string;
      hookFormula?: string;
      targetDuration?: "short" | "standard" | "long" | "extended";
      maxClipsCount?: number;
      transcriptId?: string;
      outputLanguage?: string;
    } | string
  ): Promise<Result<XclipsClip[]>> {
    const project = xclipsDb.getProject(projectId);
    const options = typeof optionsOverride === "string" ? { apiKey: optionsOverride } : optionsOverride;
    // Resolve the selected transcript track (falls back to the active one)
    const transcript = options?.transcriptId
      ? xclipsDb.getTranscript(projectId, options.transcriptId) || xclipsDb.getTranscript(projectId)
      : xclipsDb.getTranscript(projectId);

    if (!project || !transcript) {
      return { success: false, error: "Project or transcript not available yet" };
    }

    const settings = this.getAiSettings();
    const custom = settings.activeCustomProviderId ? settings.customProviders.find((provider) => provider.id === settings.activeCustomProviderId) : undefined;
    const customOptions = custom ? { provider: custom.protocol === "claude-compatible" ? "anthropic" as const : "openai" as const, baseUrl: custom.baseUrl, apiKey: custom.apiKey, model: custom.plannerModel } : undefined;
    const providerToUse = customOptions?.provider || options?.provider || settings.provider;
    const effectiveBaseUrl =
      customOptions?.baseUrl || (providerToUse === settings.provider
        ? settings.baseUrl
        : this.getDefaultBaseUrlForProvider(providerToUse));
    const apiKey =
      customOptions?.apiKey || options?.apiKey ||
      settings.apiKeys?.[providerToUse] ||
      (providerToUse === settings.provider ? settings.apiKey : "") ||
      (providerToUse === "kieai" ? process.env.KIE_AI_API_KEY : "");
    if (!apiKey) {
      return { success: false, error: `API Key untuk provider ${providerToUse.toUpperCase()} belum dikonfigurasi. Buka Settings pada tab Autoclip.` };
    }

    const effectiveTopic = options?.topicPrompt !== undefined ? options.topicPrompt : settings.topicPrompt;
    const effectiveFormula = options?.hookFormula !== undefined ? options.hookFormula : settings.hookFormula;
    const effectiveDuration = options?.targetDuration !== undefined ? options.targetDuration : settings.targetDuration;
    const effectiveLanguage = options?.outputLanguage || settings.outputLanguage || "auto";
    const maxResults = options?.maxClipsCount || settings.maxClipsCount || 5;

    const chunks = chunkTranscript(transcript.words);
    aiLogger.info({ projectId, chunksCount: chunks.length, totalWords: transcript.words.length, topic: effectiveTopic, formula: effectiveFormula, language: effectiveLanguage, provider: providerToUse }, "Starting Map-Reduce highlight discovery");
    const allRawHighlights: CandidateHighlight[] = [];
    let lastError: string | null = null;

    const CONCURRENCY = Math.min(3, Math.max(1, chunks.length));
    let chunkIndexPointer = 0;

    const worker = async () => {
      while (chunkIndexPointer < chunks.length) {
        const chunk = chunks[chunkIndexPointer++];
        const prompt = buildHighlightPrompt(chunk, {
          topicPrompt: effectiveTopic,
          editorialFunction: options?.editorialFunction,
          hookFormula: effectiveFormula,
          targetDuration: effectiveDuration,
          outputLanguage: effectiveLanguage,
          strictBoundary: settings.strictBoundary,
          videoMetadata: {
            title: project.sourceMeta?.title || project.name,
            channel: project.sourceMeta?.channel || project.sourceMeta?.uploader,
            description: project.sourceMeta?.description,
            webpageUrl: project.sourceMeta?.webpageUrl,
          },
        });
        try {
          const modelToUse = customOptions?.model || options?.model || (providerToUse === "kieai"
            ? (settings.highlightModel || settings.transcribeModel || "gemini-3-7-flash")
            : (settings.highlightModel || "gemini-3-7-flash"));

          const dispatchRes = await this.dispatchAiContent({
            provider: providerToUse,
            baseUrl: effectiveBaseUrl,
            apiKey,
            model: modelToUse,
            userPrompt: prompt,
            timeoutMs: 60000,
          });

          if (dispatchRes.success && dispatchRes.data?.trim()) {
            try {
              const cleanJsonStr = dispatchRes.data.replace(/```json/gi, "").replace(/```/g, "").trim();
              const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
              if (!jsonMatch) {
                throw new Error("Respons AI tidak mengandung objek JSON yang valid");
              }
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
                allRawHighlights.push(...parsed.highlights);
                aiLogger.debug({ chunkIndex: chunk.chunkIndex, foundCount: parsed.highlights.length }, "Scored highlight candidates for chunk");
              } else {
                aiLogger.warn({ chunkIndex: chunk.chunkIndex }, "AI response contained no highlights array");
              }
            } catch (parseErr: unknown) {
              const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
              lastError = `Gagal parse JSON chunk ${chunk.chunkIndex}: ${parseMsg}`;
              aiLogger.warn({ chunkIndex: chunk.chunkIndex, err: parseMsg, preview: dispatchRes.data.slice(0, 150) }, "Failed to parse JSON highlights from chunk");
            }
          } else {
            const errMsg = !dispatchRes.success ? dispatchRes.error : "Empty response from AI";
            lastError = errMsg;
            aiLogger.warn({ chunkIndex: chunk.chunkIndex, err: errMsg }, "Failed scoring chunk");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          lastError = msg;
          aiLogger.error({ chunkIndex: chunk.chunkIndex, err: msg }, `Error scoring chunk ${chunk.chunkIndex}`);
        }
      }
    };

    await Promise.all(
      Array.from({ length: CONCURRENCY }, () => worker())
    );

    if (allRawHighlights.length === 0 && chunks.length > 0) {
      return {
        success: false,
        error: lastError || "Tidak ada kandidat clip yang berhasil dibuat oleh model AI. Periksa konfigurasi model dan API Key pada menu AI Settings.",
      };
    }

    const ranked = reduceAndRankHighlights(allRawHighlights, maxResults);
    aiLogger.info({ projectId, rawCount: allRawHighlights.length, rankedCount: ranked.length, maxResults }, "Reduced and ranked viral candidate highlights");

    const defaultSubtitleStyle: SubtitleStyle = {
      enabled: true,
      preset: "plain",
      fontFamily: "Inter",
      fontSize: 44,
      primaryColor: "#FFFFFF",
      secondaryColor: "#FFFFFF",
      highlightColor: "#FFFFFF",
      outlineColor: "#000000",
      outlineWidth: 2.0,
      boxColor: "#000000",
      boxOpacity: 0.0,
      allCaps: false,
      textCase: "uppercase",
      autoEmoji: false,
      positionX: 50,
      positionY: 80,
      rotation: 0,
      boxWidthMode: "custom",
      boxWidth: 76,
      scaleX: 1,
      scaleY: 1,
      karaokeEnabled: false,
    };

    const createdClips: XclipsClip[] = [];

    for (const cand of ranked) {
      const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const clip: XclipsClip = {
        id: clipId,
        projectId: project.id,
        transcriptId: transcript.id,
        title: cand.title,
        hookText: cand.hookText,
        viralScore: cand.viralScore,
        startSec: cand.startSec,
        endSec: cand.endSec,
        aspectRatio: "9:16",
        layoutMode: "blur_bg",
        panOffsetX: 0.0,
        subtitleStyle: defaultSubtitleStyle,
        removeFillers: true,
        removeSilence: true,
        customCuts: [],
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      xclipsDb.saveClip(clip);
      createdClips.push(clip);
    }

    xclipsDb.saveClipsBatch(createdClips);

    return { success: true, data: createdClips };
  }

  /**
   * Updates transcript words and regenerates SRT content from user edits
   */
  updateTranscriptWords(
    projectId: string,
    words: WordTimestamp[]
  ): Result<XclipsTranscript> {
    const existing = xclipsDb.getTranscript(projectId);
    if (!existing) {
      return { success: false, error: "Transkrip tidak ditemukan" };
    }

    const updatedTranscript: XclipsTranscript = {
      ...existing,
      rawText: words.map((w) => w.word).join(" "),
      words,
      srtContent: generateSrtFromWords(words),
    };

    xclipsDb.saveTranscript(updatedTranscript);
    aiLogger.info({ projectId, wordsCount: words.length }, "Transcript words updated from Subtitle Editor");
    return { success: true, data: updatedTranscript };
  }

  enqueueRender(clipId: string, projectId: string, options?: { resolution?: string; bitrate?: string; format?: string }) {
    return renderQueue.enqueue(clipId, projectId, options);
  }

  // ── Storage & Cache Management ──────────────────────────────

  private getVaultDir(): string {
    return path.resolve(process.cwd(), "vault", "xclips");
  }

  /**
   * Recursively calculates directory size in bytes and file count.
   */
  private getDirStats(dirPath: string): { size: number; fileCount: number } {
    let size = 0;
    let fileCount = 0;
    if (!fs.existsSync(dirPath)) return { size, fileCount };

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = this.getDirStats(fullPath);
        size += sub.size;
        fileCount += sub.fileCount;
      } else if (entry.isFile()) {
        try {
          size += fs.statSync(fullPath).size;
          fileCount++;
        } catch { /* skip inaccessible files */ }
      }
    }
    return { size, fileCount };
  }

  /**
   * Returns aggregated storage stats for cache, downloads, and database.
   */
  getStorageStats(): StorageStats {
    const vault = this.getVaultDir();
    const cacheDir = path.join(vault, "cache");
    const downloadsDir = path.join(vault, "downloads");
    const dbPath = path.join(vault, "xclips.db");
    const walPath = dbPath + "-wal";
    const shmPath = dbPath + "-shm";

    const cache = this.getDirStats(cacheDir);
    const downloads = this.getDirStats(downloadsDir);

    let databaseSize = 0;
    try { databaseSize += fs.statSync(dbPath).size; } catch { /* no-op */ }
    try { databaseSize += fs.statSync(walPath).size; } catch { /* no-op */ }
    try { databaseSize += fs.statSync(shmPath).size; } catch { /* no-op */ }

    // Orphan detection
    const knownIds = new Set(xclipsDb.getAllProjectIds());
    let orphanCount = 0;
    for (const dir of [cacheDir, downloadsDir]) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !knownIds.has(entry.name)) {
          orphanCount++;
        }
      }
    }

    return {
      cacheSize: cache.size,
      cacheFileCount: cache.fileCount,
      downloadsSize: downloads.size,
      downloadsFileCount: downloads.fileCount,
      databaseSize,
      totalSize: cache.size + downloads.size + databaseSize,
      orphanCount,
    };
  }

  /**
   * Returns per-project storage breakdown for cache and downloads.
   */
  getProjectStorageMap(): ProjectStorage[] {
    const vault = this.getVaultDir();
    const cacheDir = path.join(vault, "cache");
    const downloadsDir = path.join(vault, "downloads");
    const knownIds = new Set(xclipsDb.getAllProjectIds());
    const projects = xclipsDb.getAllProjects();
    const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

    // Collect all unique project folder IDs from both dirs
    const folderIds = new Set<string>();
    for (const dir of [cacheDir, downloadsDir]) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) folderIds.add(entry.name);
      }
    }

    const result: ProjectStorage[] = [];
    for (const projectId of folderIds) {
      const cachePath = path.join(cacheDir, projectId);
      const dlPath = path.join(downloadsDir, projectId);
      const cacheStats = this.getDirStats(cachePath);
      const dlStats = this.getDirStats(dlPath);

      result.push({
        projectId,
        projectName: projectNameMap.get(projectId) || projectId,
        cacheSize: cacheStats.size,
        downloadsSize: dlStats.size,
        totalSize: cacheStats.size + dlStats.size,
        isOrphan: !knownIds.has(projectId),
      });
    }

    // Sort: orphans first, then by total size descending
    result.sort((a, b) => {
      if (a.isOrphan !== b.isOrphan) return a.isOrphan ? -1 : 1;
      return b.totalSize - a.totalSize;
    });

    return result;
  }

  /**
   * Removes all contents from vault/xclips/cache/
   */
  cleanAllCache(): CleanResult {
    const cacheDir = path.join(this.getVaultDir(), "cache");
    const stats = this.getDirStats(cacheDir);
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    mediaLogger.info({ freedBytes: stats.size, deletedCount: stats.fileCount }, "Cleaned all cache");
    return { freedBytes: stats.size, deletedCount: stats.fileCount };
  }

  /**
   * Removes all contents from vault/xclips/downloads/
   */
  cleanAllDownloads(): CleanResult {
    const downloadsDir = path.join(this.getVaultDir(), "downloads");
    const stats = this.getDirStats(downloadsDir);
    if (fs.existsSync(downloadsDir)) {
      fs.rmSync(downloadsDir, { recursive: true, force: true });
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    mediaLogger.info({ freedBytes: stats.size, deletedCount: stats.fileCount }, "Cleaned all downloads");
    return { freedBytes: stats.size, deletedCount: stats.fileCount };
  }

  /**
   * Removes cache and download folders for projects that no longer exist in the database.
   */
  cleanOrphanedFiles(): CleanResult {
    const vault = this.getVaultDir();
    const cacheDir = path.join(vault, "cache");
    const downloadsDir = path.join(vault, "downloads");
    const knownIds = new Set(xclipsDb.getAllProjectIds());
    let freedBytes = 0;
    let deletedCount = 0;

    for (const dir of [cacheDir, downloadsDir]) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !knownIds.has(entry.name)) {
          const fullPath = path.join(dir, entry.name);
          const stats = this.getDirStats(fullPath);
          freedBytes += stats.size;
          deletedCount += stats.fileCount;
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }
    }

    mediaLogger.info({ freedBytes, deletedCount }, "Cleaned orphaned files");
    return { freedBytes, deletedCount };
  }

  /**
   * Removes cache and download folders for a specific project.
   */
  cleanProjectStorage(projectId: string): CleanResult {
    const vault = this.getVaultDir();
    let freedBytes = 0;
    let deletedCount = 0;

    for (const sub of ["cache", "downloads"]) {
      const dirPath = path.join(vault, sub, projectId);
      if (fs.existsSync(dirPath)) {
        const stats = this.getDirStats(dirPath);
        freedBytes += stats.size;
        deletedCount += stats.fileCount;
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }

    mediaLogger.info({ projectId, freedBytes, deletedCount }, "Cleaned project storage");
    return { freedBytes, deletedCount };
  }

  /**
   * Runs VACUUM on SQLite database and returns size delta.
   */
  compactDatabase(): { beforeSize: number; afterSize: number } {
    return xclipsDb.compactDatabase();
  }

  /**
   * Exports a project as a JSON bundle (metadata, clips, transcript).
   * Returns a serializable object that can be sent as JSON or zipped.
   */
  exportProjectBundle(projectId: string): Result<{
    project: XclipsProject;
    clips: XclipsClip[];
    transcript: XclipsTranscript | null;
    exportedAt: string;
    version: string;
  }> {
    const project = xclipsDb.getProject(projectId);
    if (!project) {
      return { success: false, error: `Project ${projectId} not found` };
    }
    const clips = xclipsDb.getClips(projectId);
    const transcript = xclipsDb.getTranscript(projectId);

    return {
      success: true,
      data: {
        project,
        clips,
        transcript,
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
      },
    };
  }

  /**
   * Imports a project bundle from a JSON object.
   * Reconstructs project, transcript, and clips in the database.
   */
  importProjectBundle(bundle: {
    project: XclipsProject;
    clips: XclipsClip[];
    transcript: XclipsTranscript | null;
  }): Result<{ projectId: string }> {
    try {
      // Generate new ID to avoid collisions
      const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const project: XclipsProject = {
        ...bundle.project,
        id: newId,
        name: `${bundle.project.name} (Imported)`,
        createdAt: now,
        updatedAt: now,
      };
      xclipsDb.saveProject(project);

      if (bundle.transcript) {
        const transcript: XclipsTranscript = {
          ...bundle.transcript,
          id: `trx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          projectId: newId,
          createdAt: now,
          updatedAt: now,
        };
        xclipsDb.saveTranscript(transcript);
      }

      if (bundle.clips && bundle.clips.length > 0) {
        const remappedClips = bundle.clips.map((clip, idx) => ({
          ...clip,
          id: `clip_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          projectId: newId,
          status: "draft" as const,
          outputPath: undefined,
          renderError: undefined,
          createdAt: now,
          updatedAt: now,
        }));
        xclipsDb.saveClipsBatch(remappedClips);
      }

      aiLogger.info({ originalId: bundle.project.id, newId }, "Imported project bundle");
      return { success: true, data: { projectId: newId } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return { success: false, error: message };
    }
  }
}

export const xclipsService = new XclipsService();
