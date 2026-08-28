import * as fs from "fs";
import * as path from "path";
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
} from "@/lib/xclips/types";
import { probeMedia, normalizeToCfr, extractAudioWav } from "@/lib/xclips/vfr-probe";
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
  parseSrtToWords,
  YouTubeVideoInfo,
  DownloadProgress,
} from "@/lib/xclips/ytdlp-downloader";
import { aiLogger, mediaLogger } from "@/lib/logger";

// Helper function to format SRT from word timestamps
function generateSrtFromWords(words: WordTimestamp[]): string {
  if (!words || words.length === 0) return "";
  const phrases: Array<{ start: number; end: number; text: string }> = [];
  let currentWords: WordTimestamp[] = [];

  for (const w of words) {
    if (w.excluded) continue;
    currentWords.push(w);
    if (currentWords.length >= 6 || /[.?!]$/.test(w.word)) {
      phrases.push({
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
        text: currentWords.map((cw) => cw.word).join(" "),
      });
      currentWords = [];
    }
  }
  if (currentWords.length > 0) {
    phrases.push({
      start: currentWords[0].start,
      end: currentWords[currentWords.length - 1].end,
      text: currentWords.map((cw) => cw.word).join(" "),
    });
  }

  const formatSrtTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };

  return phrases
    .map((p, i) => `${i + 1}\n${formatSrtTime(p.start)} --> ${formatSrtTime(p.end)}\n${p.text}\n`)
    .join("\n");
}

export class XclipsService {
  /**
   * Fetches metadata for a YouTube URL
   */
  async getYouTubeMetadata(url: string): Promise<Result<YouTubeVideoInfo>> {
    return fetchYouTubeInfo(url);
  }

  /**
   * Reads persistent AI configuration from vault/xclips/settings.json
   */
  getAiSettings(): XclipsAiSettings {
    const settingsPath = path.resolve(process.cwd(), "vault", "xclips", "settings.json");
    const defaultApiKeys: Record<AiProviderType, string> = {
      kieai: process.env.KIE_AI_API_KEY || "",
      gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      openai: process.env.OPENAI_API_KEY || "",
      anthropic: process.env.ANTHROPIC_API_KEY || "",
      openai_compatible: process.env.OPENAI_COMPATIBLE_API_KEY || "",
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
        return validated;
      } catch (err) {
        aiLogger.warn({ err }, "Failed to parse settings.json, returning default AI settings");
      }
    }
    return {
      provider: "kieai",
      baseUrl: "https://api.kie.ai/gemini-3-6-flash-openai/v1",
      apiKey: defaultApiKeys.kieai,
      apiKeys: defaultApiKeys,
      transcribeModel: "gemini-3-7-flash",
      highlightModel: "gemini-3-7-flash",
      topicPrompt: "",
      targetDuration: "standard",
      maxClipsCount: 5,
      strictBoundary: true,
    };
  }

  /**
   * Saves AI configuration to vault/xclips/settings.json
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
      const settingsDir = path.resolve(process.cwd(), "vault", "xclips");
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      const settingsPath = path.join(settingsDir, "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify(validated, null, 2), "utf-8");
      aiLogger.info({ provider: validated.provider, highlightModel: validated.highlightModel }, "Saved xclips AI settings with provider-specific API keys");
      return { success: true, data: validated };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi AI";
      aiLogger.error({ err }, "Failed to save AI configuration");
      return { success: false, error: msg };
    }
  }

  /**
   * Auto-searches available models from provider
   */
  async fetchAvailableModels(
    provider: AiProviderType,
    baseUrl: string,
    apiKey: string
  ): Promise<Result<string[]>> {
    try {
      if (provider === "anthropic") {
        return {
          success: true,
          data: [
            "claude-sonnet-5",
            "claude-opus-5",
            "claude-sonnet-4-6",
            "claude-opus-4-8",
          ],
        };
      }

      if (provider === "kieai") {
        return {
          success: true,
          data: [
            "gemini-3-7-flash",
            "gpt-5-6-terra",
          ],
        };
      }

      if (provider === "openai") {
        return {
          success: true,
          data: [
            "gpt-5-6-terra",
            "gpt-5-6-sol",
            "gpt-5-6-luna",
          ],
        };
      }

      if (provider === "gemini") {
        return {
          success: true,
          data: [
            "gemini-3.7-flash",
            "gemini-3.1-pro-preview",
            "gemini-3.6-flash",
          ],
        };
      }

      // OpenAI-compatible / Custom provider
      const targetUrl = `${baseUrl.replace(/\/+$/, "")}/models`;
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          const modelNames = json.data.map((m: { id?: string }) => m.id || "").filter(Boolean);
          if (modelNames.length > 0) return { success: true, data: modelNames };
        }
      }

      // Fallback default OpenAI compatible models
      return {
        success: true,
        data: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "whisper-1",
          "deepseek-chat",
          "deepseek-reasoner",
          "gemini-3-6-flash-openai",
        ],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengambil daftar model";
      aiLogger.warn({ provider, baseUrl, err: msg }, "Model search failed, returning popular fallbacks");
      return {
        success: true,
        data: [
          "gpt-4o",
          "gpt-4o-mini",
          "claude-3-5-sonnet-20241022",
          "gemini-1.5-flash",
          "gemini-3-7-flash",
          "gemini-3-6-flash-openai",
          "whisper-1",
        ],
      };
    }
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
              error: json.error?.message || "Autentikasi Claude gagal",
            };
          }
          return { success: true, data: { status: "ok", message: "API Key Claude Valid!" } };
        }
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: "API Key Claude tidak valid (401/403)" };
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

      // KIE AI, OpenAI, and Custom (OpenAI Compatible)
      const targetUrl = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const testModel =
        provider === "kieai"
          ? (model || "gemini-3-7-flash")
          : provider === "openai"
          ? (model || "gpt-5-6-terra")
          : (model || "gpt-4o");

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
        return { success: true, data: { status: "ok", message: "API Key Valid & Terhubung!" } };
      }

      const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: Autentikasi Gagal`;
      return { success: false, error: errMsg };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungi server API";
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
    },
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<Result<XclipsProject>> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const downloadDir = path.resolve(process.cwd(), "vault", "xclips", "downloads", projectId);
    fs.mkdirSync(downloadDir, { recursive: true });

    const dlRes = await downloadYouTubeVideo(
      {
        url,
        outputDir: downloadDir,
        quality: options?.quality || "1080p",
        downloadSubtitles: options?.downloadSubtitles ?? true,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    xclipsDb.saveProject(project);

    // If auto-subtitles were downloaded, parse and populate transcript immediately!
    if (srtPath && fs.existsSync(srtPath)) {
      try {
        const srtContent = fs.readFileSync(srtPath, "utf-8");
        const words = parseSrtToWords(srtContent);
        if (words.length > 0) {
          detectTokenFillers(words);
          const transcript: XclipsTranscript = {
            id: `tr_${Date.now()}`,
            projectId: project.id,
            language: "id",
            rawText: words.map((w) => w.word).join(" "),
            srtContent,
            words,
            createdAt: new Date().toISOString(),
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
   * Transcribes project audio using configured AI model
   */
  async transcribeProject(
    projectId: string,
    apiKeyOverride?: string
  ): Promise<Result<XclipsTranscript>> {
    const project = xclipsDb.getProject(projectId);
    if (!project) return { success: false, error: "Proyek tidak ditemukan" };

    const settings = this.getAiSettings();
    const apiKey =
      apiKeyOverride ||
      settings.apiKeys?.[settings.provider] ||
      settings.apiKey ||
      process.env.KIE_AI_API_KEY;
    if (!apiKey) {
      aiLogger.warn({ projectId }, "Transcription requested without API key");
      return {
        success: false,
        error: "API Key AI belum dikonfigurasi. Buka Settings pada tab Autoclip.",
      };
    }

    if (!project.audioPath || !fs.existsSync(project.audioPath)) {
      aiLogger.error({ projectId, audioPath: project.audioPath }, "Audio file not found for transcription");
      return { success: false, error: "File audio proyek tidak ditemukan" };
    }

    try {
      const startMs = Date.now();
      const audioBuffer = fs.readFileSync(project.audioPath);
      const base64Audio = audioBuffer.toString("base64");
      aiLogger.info({ projectId, audioBytes: audioBuffer.length, model: settings.transcribeModel }, "Dispatching audio transcription request");

      const systemPrompt = `Anda adalah transkriber audio profesional bahasa Indonesia dan Inggris.
Tugas Anda adalah mentranskripsikan audio ke dalam urutan kata-per-kata yang akurat dengan timestamp detik mulai dan selesai.
Format output WAJIB HANYA berupa JSON valid:
{
  "fullText": "Teks lengkap seluruh audio...",
  "words": [
    { "word": "Halo", "start": 0.12, "end": 0.45 },
    { "word": "teman-teman", "start": 0.48, "end": 0.95 }
  ]
}`;

      const modelToUse = settings.provider === "kieai"
        ? (settings.transcribeModel || settings.highlightModel || "gemini-3-7-flash")
        : (settings.transcribeModel || "whisper-1");

      const payload = {
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Transkrip audio berikut dengan format JSON:" },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: "wav",
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      };

      const targetUrl = settings.baseUrl.endsWith("/chat/completions")
        ? settings.baseUrl
        : `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180000), // 3 min timeout
      });

      const latencyMs = Date.now() - startMs;

      if (!response.ok) {
        const errText = await response.text();
        aiLogger.error({ projectId, status: response.status, latencyMs, errText: errText.slice(0, 500) }, "Transcription API returned non-OK status");
        return {
          success: false,
          error: `AI Transcription API Error (${response.status}): ${errText.slice(0, 200)}`,
        };
      }

      const resJson = await response.json();
      const content = resJson.choices?.[0]?.message?.content || "";

      // Parse JSON from response
      const cleanJsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanJsonStr);

      const words: WordTimestamp[] = (parsedData.words || []).map(
        (w: { word: string; start: number; end: number }) => ({
          word: w.word,
          start: parseFloat(w.start.toString()),
          end: parseFloat(w.end.toString()),
          confidence: 1.0,
          isFiller: false,
          excluded: false,
        })
      );

      // Detect Indonesian filler words at token level
      detectTokenFillers(words);

      const transcript: XclipsTranscript = {
        id: `tr_${Date.now()}`,
        projectId: project.id,
        language: "id",
        rawText: parsedData.fullText || words.map((w) => w.word).join(" "),
        srtContent: generateSrtFromWords(words),
        words,
        createdAt: new Date().toISOString(),
      };

      xclipsDb.saveTranscript(transcript);
      aiLogger.info({ projectId, wordsCount: words.length, latencyMs }, "Audio transcribed and parsed successfully");
      return { success: true, data: transcript };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal melakukan transkripsi AI";
      const stack = err instanceof Error ? err.stack : undefined;
      aiLogger.error({ projectId, err: msg, stack }, "Failed to perform AI transcription");
      return { success: false, error: msg };
    }
  }

  /**
   * Discovers viral clip candidates using Map-Reduce LLM scoring with configured narrative settings
   */
  async discoverHighlights(
    projectId: string,
    apiKeyOverride?: string
  ): Promise<Result<XclipsClip[]>> {
    const project = xclipsDb.getProject(projectId);
    const transcript = xclipsDb.getTranscript(projectId);

    if (!project || !transcript) {
      return { success: false, error: "Proyek atau transkrip belum tersedia" };
    }

    const settings = this.getAiSettings();
    const apiKey =
      apiKeyOverride ||
      settings.apiKeys?.[settings.provider] ||
      settings.apiKey ||
      process.env.KIE_AI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "API Key AI belum dikonfigurasi. Buka Settings pada tab Autoclip." };
    }

    const chunks = chunkTranscript(transcript.words);
    aiLogger.info({ projectId, chunksCount: chunks.length, totalWords: transcript.words.length, topic: settings.topicPrompt }, "Starting Map-Reduce highlight discovery");
    const allRawHighlights: CandidateHighlight[] = [];

    const targetUrl = settings.baseUrl.endsWith("/chat/completions")
      ? settings.baseUrl
      : `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    for (const chunk of chunks) {
      const prompt = buildHighlightPrompt(chunk, {
        topicPrompt: settings.topicPrompt,
        targetDuration: settings.targetDuration,
        strictBoundary: settings.strictBoundary,
      });
      try {
        const modelToUse = settings.provider === "kieai"
          ? (settings.highlightModel || settings.transcribeModel || "gemini-3-7-flash")
          : (settings.highlightModel || "gemini-3-7-flash");

        const payload = {
          model: modelToUse,
          messages: [
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        };

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(60000),
        });

        if (response.ok) {
          const resJson = await response.json();
          const content = resJson.choices?.[0]?.message?.content || "";
          const cleanJsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJsonStr);
          if (Array.isArray(parsed.highlights)) {
            allRawHighlights.push(...parsed.highlights);
            aiLogger.debug({ chunkIndex: chunk.chunkIndex, foundCount: parsed.highlights.length }, "Scored highlight candidates for chunk");
          }
        } else {
          const errText = await response.text();
          aiLogger.warn({ chunkIndex: chunk.chunkIndex, status: response.status, errText: errText.slice(0, 300) }, "Failed scoring chunk");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        aiLogger.error({ chunkIndex: chunk.chunkIndex, err: msg }, `Error scoring chunk ${chunk.chunkIndex}`);
      }
    }

    const maxResults = settings.maxClipsCount || 5;
    const ranked = reduceAndRankHighlights(allRawHighlights, maxResults);
    aiLogger.info({ projectId, rawCount: allRawHighlights.length, rankedCount: ranked.length, maxResults }, "Reduced and ranked viral candidate highlights");

    const defaultSubtitleStyle: SubtitleStyle = {
      enabled: true,
      preset: "plain",
      fontFamily: "Inter",
      fontSize: 42,
      primaryColor: "#FFFFFF",
      highlightColor: "#FACC15",
      outlineColor: "#000000",
      outlineWidth: 2,
      boxColor: "#000000",
      boxOpacity: 0.7,
      allCaps: false,
      textCase: "uppercase",
      autoEmoji: false,
      positionY: 80,
      karaokeEnabled: true,
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

  enqueueRender(clipId: string, projectId: string) {
    return renderQueue.enqueue(clipId, projectId);
  }
}

export const xclipsService = new XclipsService();
