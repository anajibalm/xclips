import { create } from "zustand";
import { apiFetch } from "@/lib/api-client";
import {
  XclipsProject,
  XclipsTranscript,
  XclipsClip,
  WordTimestamp,
  XclipsAiSettings,
} from "@/lib/xclips/types";
import { LogItem, ProjectAssets, FootageProgress } from "../types/studio.types";

interface StudioState {
  projectId: string | null;
  loading: boolean;
  project: XclipsProject | null;
  transcript: XclipsTranscript | null;
  clips: XclipsClip[];
  selectedClip: XclipsClip | null;

  activeTab: number;
  isPlaying: boolean;
  currentTime: number;
  isMuted: boolean;
  isFullSourceView: boolean;

  isTranscribing: boolean;
  isDiscovering: boolean;
  isSavingTranscript: boolean;
  actionError: string | null;
  actionSuccess: string | null;

  renderJobId: string | null;
  renderProgress: number;
  renderStatus: string | null;

  editableWords: WordTimestamp[];
  expandedPhraseId: string | null;
  searchQuery: string;
  autoScrollToPlayhead: boolean;
  scrollTop: number;
  draggedPhraseIndex: number | null;
  dragOverPhraseIndex: number | null;
  subtitleOffsetMs: number;

  assets: ProjectAssets | null;
  assetsLoading: boolean;
  isCapturingThumb: boolean;
  copiedAssetKey: string | null;
  thumbTimestamp: number;

  previewVideoOpen: boolean;
  previewThumbnailOpen: boolean;

  logs: LogItem[];
  logsFilter: "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG";
  autoRefreshLogs: boolean;
  copiedLogs: boolean;

  footageUrl: string;
  footageDownloading: boolean;
  footageProgress: FootageProgress | null;
  footageError: string | null;
  footageResult: { projectId: string; videoPath: string } | null;
  footageTaskId: string | null;
  assetsSubTab: "video" | "image" | "files";
  footageList: XclipsProject[];
  footageListLoading: boolean;

  aiSettingsModalOpen: boolean;
  aiSettings: XclipsAiSettings | null;
  aiSettingsSaving: boolean;
  aiSettingsSuccess: string | null;
  aiSettingsError: string | null;
  availableHighlightModels: string[];
  availableTranscribeModels: string[];
  modelsLoading: boolean;

  // Setters
  setProjectId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProject: (project: XclipsProject | null) => void;
  setTranscript: (transcript: XclipsTranscript | null) => void;
  setClips: (clips: XclipsClip[]) => void;
  setSelectedClip: (clip: XclipsClip | null) => void;

  setActiveTab: (tab: number) => void;
  setIsPlaying: (playing: boolean | ((prev: boolean) => boolean)) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  setIsFullSourceView: (full: boolean | ((prev: boolean) => boolean)) => void;

  setIsTranscribing: (val: boolean) => void;
  setIsDiscovering: (val: boolean) => void;
  setIsSavingTranscript: (val: boolean) => void;
  setActionError: (err: string | null) => void;
  setActionSuccess: (msg: string | null) => void;

  setRenderJobId: (id: string | null) => void;
  setRenderProgress: (progress: number) => void;
  setRenderStatus: (status: string | null) => void;

  setEditableWords: (words: WordTimestamp[] | ((prev: WordTimestamp[]) => WordTimestamp[])) => void;
  setExpandedPhraseId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setAutoScrollToPlayhead: (auto: boolean) => void;
  setScrollTop: (top: number) => void;
  setDraggedPhraseIndex: (idx: number | null) => void;
  setDragOverPhraseIndex: (idx: number | null) => void;
  setSubtitleOffsetMs: (offset: number | ((prev: number) => number)) => void;

  setAssets: (assets: ProjectAssets | null) => void;
  setAssetsLoading: (val: boolean) => void;
  setIsCapturingThumb: (val: boolean) => void;
  setCopiedAssetKey: (key: string | null) => void;
  setThumbTimestamp: (ts: number) => void;

  setPreviewVideoOpen: (open: boolean) => void;
  setPreviewThumbnailOpen: (open: boolean) => void;

  setLogs: (logs: LogItem[]) => void;
  setLogsFilter: (filter: "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG") => void;
  setAutoRefreshLogs: (auto: boolean) => void;
  setCopiedLogs: (copied: boolean) => void;

  setFootageUrl: (url: string) => void;
  setFootageDownloading: (val: boolean) => void;
  setFootageProgress: (prog: FootageProgress | null) => void;
  setFootageError: (err: string | null) => void;
  setFootageResult: (res: { projectId: string; videoPath: string } | null) => void;
  setFootageTaskId: (taskId: string | null) => void;
  setAssetsSubTab: (tab: "video" | "image" | "files") => void;
  setFootageList: (list: XclipsProject[]) => void;
  setFootageListLoading: (val: boolean) => void;

  setAiSettingsModalOpen: (open: boolean) => void;
  setAiSettings: (settings: XclipsAiSettings | null) => void;
  setAiSettingsSaving: (val: boolean) => void;
  setAiSettingsSuccess: (msg: string | null) => void;
  setAiSettingsError: (err: string | null) => void;
  setAvailableHighlightModels: (models: string[]) => void;
  setAvailableTranscribeModels: (models: string[]) => void;
  setModelsLoading: (val: boolean) => void;

  // Actions
  loadProjectData: (projectId?: string) => Promise<void>;
  fetchAssets: (projectId?: string) => Promise<void>;
  fetchLogs: (projectId?: string) => Promise<void>;
  fetchFootageList: () => Promise<void>;
  fetchAiSettings: () => Promise<void>;
  fetchAvailableModels: (provider: string, apiKey?: string, baseUrl?: string) => Promise<void>;
  saveAiSettings: (updated: XclipsAiSettings) => Promise<boolean>;

  handleSeek: (timeSec: number) => void;
  togglePlayPause: () => void;
  handleSaveClip: (updatedClip: XclipsClip) => Promise<void>;
  handleDeleteClip: (clipId: string) => Promise<void>;
  handleTranscribe: () => Promise<void>;
  handleDiscoverHighlights: () => Promise<void>;
  handleSaveTranscript: () => Promise<void>;
  handleShiftSubtitleOffsetMs: (deltaMs: number) => void;
  handleApplyOffsetPermanently: () => Promise<void>;
  handleFootageDownload: (targetUrl?: string) => Promise<void>;
  handleCaptureThumbnail: () => Promise<void>;
  handleOpenInExplorer: (sourcePath?: string, targetProjectId?: string) => Promise<void>;
  handleRender: () => Promise<void>;
  handleCopyLogs: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  projectId: null,
  loading: true,
  project: null,
  transcript: null,
  clips: [],
  selectedClip: null,

  activeTab: 0,
  isPlaying: false,
  currentTime: 0,
  isMuted: false,
  isFullSourceView: false,

  isTranscribing: false,
  isDiscovering: false,
  isSavingTranscript: false,
  actionError: null,
  actionSuccess: null,

  renderJobId: null,
  renderProgress: 0,
  renderStatus: null,

  editableWords: [],
  expandedPhraseId: null,
  searchQuery: "",
  autoScrollToPlayhead: true,
  scrollTop: 0,
  draggedPhraseIndex: null,
  dragOverPhraseIndex: null,
  subtitleOffsetMs: 0,

  assets: null,
  assetsLoading: false,
  isCapturingThumb: false,
  copiedAssetKey: null,
  thumbTimestamp: Date.now(),

  previewVideoOpen: false,
  previewThumbnailOpen: false,

  logs: [],
  logsFilter: "ALL",
  autoRefreshLogs: true,
  copiedLogs: false,

  footageUrl: "",
  footageDownloading: false,
  footageProgress: null,
  footageError: null,
  footageResult: null,
  footageTaskId: null,
  assetsSubTab: "video",
  footageList: [],
  footageListLoading: false,

  aiSettingsModalOpen: false,
  aiSettings: null,
  aiSettingsSaving: false,
  aiSettingsSuccess: null,
  aiSettingsError: null,
  availableHighlightModels: [],
  availableTranscribeModels: [],
  modelsLoading: false,

  // Setters
  setProjectId: (id) => set({ projectId: id }),
  setLoading: (loading) => set({ loading }),
  setProject: (project) => set({ project }),
  setTranscript: (transcript) => set({ transcript }),
  setClips: (clips) => set({ clips }),
  setSelectedClip: (selectedClip) => set({ selectedClip }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setIsPlaying: (updater) =>
    set((state) => ({
      isPlaying: typeof updater === "function" ? updater(state.isPlaying) : updater,
    })),
  setCurrentTime: (updater) =>
    set((state) => ({
      currentTime: typeof updater === "function" ? updater(state.currentTime) : updater,
    })),
  setIsMuted: (updater) =>
    set((state) => ({
      isMuted: typeof updater === "function" ? updater(state.isMuted) : updater,
    })),
  setIsFullSourceView: (updater) =>
    set((state) => ({
      isFullSourceView: typeof updater === "function" ? updater(state.isFullSourceView) : updater,
    })),

  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setIsDiscovering: (isDiscovering) => set({ isDiscovering }),
  setIsSavingTranscript: (isSavingTranscript) => set({ isSavingTranscript }),
  setActionError: (actionError) => set({ actionError }),
  setActionSuccess: (actionSuccess) => set({ actionSuccess }),

  setRenderJobId: (renderJobId) => set({ renderJobId }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),

  setEditableWords: (updater) =>
    set((state) => ({
      editableWords: typeof updater === "function" ? updater(state.editableWords) : updater,
    })),
  setExpandedPhraseId: (expandedPhraseId) => set({ expandedPhraseId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAutoScrollToPlayhead: (autoScrollToPlayhead) => set({ autoScrollToPlayhead }),
  setScrollTop: (scrollTop) => set({ scrollTop }),
  setDraggedPhraseIndex: (draggedPhraseIndex) => set({ draggedPhraseIndex }),
  setDragOverPhraseIndex: (dragOverPhraseIndex) => set({ dragOverPhraseIndex }),
  setSubtitleOffsetMs: (updater) =>
    set((state) => ({
      subtitleOffsetMs: typeof updater === "function" ? updater(state.subtitleOffsetMs) : updater,
    })),

  setAssets: (assets) => set({ assets }),
  setAssetsLoading: (assetsLoading) => set({ assetsLoading }),
  setIsCapturingThumb: (isCapturingThumb) => set({ isCapturingThumb }),
  setCopiedAssetKey: (copiedAssetKey) => set({ copiedAssetKey }),
  setThumbTimestamp: (thumbTimestamp) => set({ thumbTimestamp }),

  setPreviewVideoOpen: (previewVideoOpen) => set({ previewVideoOpen }),
  setPreviewThumbnailOpen: (previewThumbnailOpen) => set({ previewThumbnailOpen }),

  setLogs: (logs) => set({ logs }),
  setLogsFilter: (logsFilter) => set({ logsFilter }),
  setAutoRefreshLogs: (autoRefreshLogs) => set({ autoRefreshLogs }),
  setCopiedLogs: (copiedLogs) => set({ copiedLogs }),

  setFootageUrl: (footageUrl) => set({ footageUrl }),
  setFootageDownloading: (footageDownloading) => set({ footageDownloading }),
  setFootageProgress: (footageProgress) => set({ footageProgress }),
  setFootageError: (footageError) => set({ footageError }),
  setFootageResult: (footageResult) => set({ footageResult }),
  setFootageTaskId: (footageTaskId) => set({ footageTaskId }),
  setAssetsSubTab: (assetsSubTab) => set({ assetsSubTab }),
  setFootageList: (footageList) => set({ footageList }),
  setFootageListLoading: (footageListLoading) => set({ footageListLoading }),

  setAiSettingsModalOpen: (aiSettingsModalOpen) => set({ aiSettingsModalOpen }),
  setAiSettings: (aiSettings) => set({ aiSettings }),
  setAiSettingsSaving: (aiSettingsSaving) => set({ aiSettingsSaving }),
  setAiSettingsSuccess: (aiSettingsSuccess) => set({ aiSettingsSuccess }),
  setAiSettingsError: (aiSettingsError) => set({ aiSettingsError }),
  setAvailableHighlightModels: (availableHighlightModels) => set({ availableHighlightModels }),
  setAvailableTranscribeModels: (availableTranscribeModels) => set({ availableTranscribeModels }),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),

  // Actions
  loadProjectData: async (targetId) => {
    const id = targetId || get().projectId;
    if (!id) return;
    set({ loading: true });
    try {
      const res = await apiFetch<{
        ok: boolean;
        project: XclipsProject;
        transcript?: XclipsTranscript;
        clips?: XclipsClip[];
      }>(`/api/xclips/projects/${id}`);

      if (res.ok && res.data) {
        const p = res.data.project;
        const t = res.data.transcript || null;
        const loadedClips = res.data.clips || [];

        set({
          project: p,
          transcript: t,
          editableWords: t?.words ? [...t.words] : [],
          clips: loadedClips,
        });

        if (loadedClips.length > 0 && !get().selectedClip) {
          set({
            selectedClip: loadedClips[0],
            currentTime: loadedClips[0].startSec,
          });
        }
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchAssets: async (targetId) => {
    const id = targetId || get().projectId;
    if (!id) return;
    set({ assetsLoading: true });
    const res = await apiFetch<{ ok: boolean; assets: ProjectAssets }>(`/api/xclips/media/${id}/assets`);
    if (res.ok && res.data?.assets) {
      set({ assets: res.data.assets });
    }
    set({ assetsLoading: false });
  },

  fetchLogs: async (targetId) => {
    const id = targetId || get().projectId;
    if (!id) return;
    const res = await apiFetch<{ ok: boolean; logs: LogItem[] }>(`/api/xclips/projects/${id}/logs`);
    if (res.ok && res.data?.logs) {
      set({ logs: res.data.logs });
    }
  },

  fetchFootageList: async () => {
    set({ footageListLoading: true });
    const res = await apiFetch<{ ok: boolean; projects: XclipsProject[] }>("/api/xclips/projects");
    if (res.ok && res.data?.projects) {
      set({ footageList: res.data.projects });
    }
    set({ footageListLoading: false });
  },

  fetchAiSettings: async () => {
    try {
      const res = await apiFetch<{ ok: boolean; settings: XclipsAiSettings }>("/api/xclips/settings");
      if (res.ok && res.data?.settings) {
        const s = res.data.settings;
        const currentProvider = s.provider || "kieai";
        const resolvedKey = s.apiKeys?.[currentProvider] || s.apiKey || "";
        const completeSettings: XclipsAiSettings = {
          ...s,
          apiKey: resolvedKey,
          apiKeys: s.apiKeys || {
            kieai: "",
            gemini: "",
            openai: "",
            anthropic: "",
            openai_compatible: "",
          },
        };
        set({ aiSettings: completeSettings });
        if (typeof window !== "undefined") {
          localStorage.setItem("xclips_ai_settings_cache", JSON.stringify(completeSettings));
        }
      }
    } catch {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("xclips_ai_settings_cache");
        if (cached) {
          try {
            set({ aiSettings: JSON.parse(cached) });
          } catch {
            // ignore
          }
        }
      }
    }
  },

  fetchAvailableModels: async (provider, apiKey, baseUrl) => {
    set({ modelsLoading: true });
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("provider", provider);
      if (apiKey) queryParams.set("apiKey", apiKey);
      if (baseUrl) queryParams.set("baseUrl", baseUrl);

      const res = await apiFetch<{ ok: boolean; highlightModels?: string[]; transcribeModels?: string[] }>(
        `/api/xclips/settings/models?${queryParams.toString()}`
      );
      if (res.ok && res.data) {
        set({
          availableHighlightModels: res.data.highlightModels || [],
          availableTranscribeModels: res.data.transcribeModels || [],
        });
      }
    } catch {
      // ignore
    } finally {
      set({ modelsLoading: false });
    }
  },

  saveAiSettings: async (updated) => {
    set({ aiSettingsSaving: true, aiSettingsSuccess: null, aiSettingsError: null });
    const res = await apiFetch<{ ok: boolean; message: string }>("/api/xclips/settings", {
      method: "POST",
      body: JSON.stringify(updated),
    });
    set({ aiSettingsSaving: false });
    if (res.ok) {
      set({ aiSettings: updated, aiSettingsSuccess: "Pengaturan AI berhasil disimpan!" });
      if (typeof window !== "undefined") {
        localStorage.setItem("xclips_ai_settings_cache", JSON.stringify(updated));
      }
      setTimeout(() => set({ aiSettingsSuccess: null }), 3000);
      return true;
    } else {
      set({ aiSettingsError: (res.data as unknown as { message?: string })?.message || "Gagal menyimpan pengaturan" });
      return false;
    }
  },

  handleSeek: (timeSec) => {
    set({ currentTime: timeSec });
  },

  togglePlayPause: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  handleSaveClip: async (updatedClip) => {
    set({ selectedClip: updatedClip });
    set((state) => ({
      clips: state.clips.map((c) => (c.id === updatedClip.id ? updatedClip : c)),
    }));

    await apiFetch(`/api/xclips/clips/${updatedClip.id}`, {
      method: "PUT",
      body: JSON.stringify(updatedClip),
    });
  },

  handleDeleteClip: async (clipId) => {
    const res = await apiFetch(`/api/xclips/clips/${clipId}`, { method: "DELETE" });
    if (res.ok) {
      set((state) => {
        const filtered = state.clips.filter((c) => c.id !== clipId);
        return {
          clips: filtered,
          selectedClip: state.selectedClip?.id === clipId ? filtered[0] || null : state.selectedClip,
        };
      });
    }
  },

  handleTranscribe: async () => {
    const id = get().projectId;
    if (!id) return;
    set({ isTranscribing: true, actionError: null });

    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/transcribe`,
      { method: "POST" }
    );
    set({ isTranscribing: false });

    if (res.ok && res.data?.transcript) {
      set({
        transcript: res.data.transcript,
        editableWords: res.data.transcript.words,
      });
      get().fetchAssets();
      get().fetchLogs();
      get().handleDiscoverHighlights();
    } else {
      set({ actionError: res.data?.message || "Gagal melakukan transkripsi AI" });
      get().fetchLogs();
    }
  },

  handleDiscoverHighlights: async () => {
    const id = get().projectId;
    if (!id) return;
    set({ isDiscovering: true, actionError: null });

    const res = await apiFetch<{ ok: boolean; clips?: XclipsClip[]; message?: string }>(
      `/api/xclips/projects/${id}/discover`,
      { method: "POST" }
    );
    set({ isDiscovering: false });

    if (res.ok && res.data?.clips) {
      const clips = res.data.clips;
      set({ clips });
      if (clips.length > 0) {
        set({ selectedClip: clips[0], currentTime: clips[0].startSec });
      }
      set({ actionSuccess: `Berhasil mengekstrak ${clips.length} klip highlight potensial!` });
      setTimeout(() => set({ actionSuccess: null }), 4000);
      get().fetchAssets();
      get().fetchLogs();
    } else {
      set({ actionError: res.data?.message || "Gagal mengekstrak autoclips" });
      get().fetchLogs();
    }
  },

  handleSaveTranscript: async () => {
    const id = get().projectId;
    const { editableWords } = get();
    if (!id || editableWords.length === 0) return;

    set({ isSavingTranscript: true, actionError: null, actionSuccess: null });

    const res = await apiFetch<{ ok: boolean; transcript: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/transcript`,
      {
        method: "PUT",
        body: JSON.stringify({ words: editableWords }),
      }
    );

    set({ isSavingTranscript: false });

    if (res.ok && res.data?.transcript) {
      set({ transcript: res.data.transcript });
      set({ actionSuccess: "Transkrip & Subtitle berhasil disimpan!" });
      setTimeout(() => set({ actionSuccess: null }), 3000);
      get().fetchAssets();
      get().fetchLogs();
    } else {
      set({ actionError: res.data?.message || "Gagal menyimpan transkrip" });
    }
  },

  handleShiftSubtitleOffsetMs: (deltaMs) => {
    set((state) => ({ subtitleOffsetMs: Math.round(state.subtitleOffsetMs + deltaMs) }));
  },

  handleApplyOffsetPermanently: async () => {
    const { projectId, subtitleOffsetMs, editableWords } = get();
    if (!projectId || subtitleOffsetMs === 0 || editableWords.length === 0) return;

    set({ isSavingTranscript: true, actionError: null, actionSuccess: null });

    const shiftAmountSec = -(subtitleOffsetMs / 1000);
    const updatedWords: WordTimestamp[] = editableWords.map((w) => {
      const newStart = Math.max(0, Math.round((w.start + shiftAmountSec) * 1000) / 1000);
      const newEnd = Math.max(newStart + 0.05, Math.round((w.end + shiftAmountSec) * 1000) / 1000);
      return { ...w, start: newStart, end: newEnd };
    });

    const res = await apiFetch<{ ok: boolean; transcript: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${projectId}/transcript`,
      {
        method: "PUT",
        body: JSON.stringify({ words: updatedWords }),
      }
    );

    set({ isSavingTranscript: false });

    if (res.ok && res.data?.transcript) {
      const appliedMs = -subtitleOffsetMs;
      set({
        transcript: res.data.transcript,
        editableWords: res.data.transcript.words,
        subtitleOffsetMs: 0,
        actionSuccess: `Kalibrasi offset ${appliedMs > 0 ? `+${appliedMs}` : appliedMs} ms (${shiftAmountSec > 0 ? `+${shiftAmountSec}` : shiftAmountSec}s) berhasil diterapkan permanen ke seluruh transkrip dan database!`,
      });
      setTimeout(() => set({ actionSuccess: null }), 4000);
      get().fetchAssets();
      get().fetchLogs();
    } else {
      set({ actionError: res.data?.message || "Gagal menyimpan kalibrasi offset transkrip" });
    }
  },

  handleFootageDownload: async (targetUrl) => {
    const downloadUrl = (targetUrl || get().footageUrl).trim();
    if (!downloadUrl) return;

    set({
      footageDownloading: true,
      footageError: null,
      footageResult: null,
      footageProgress: { percent: 0, speedStr: "Starting...", etaStr: "--:--", status: "downloading" },
    });

    const res = await apiFetch<{ ok: boolean; taskId: string; message?: string }>(
      "/api/xclips/footage/download-async",
      { method: "POST", body: JSON.stringify({ url: downloadUrl, quality: "best" }) }
    );

    if (!res.ok || !res.data?.taskId) {
      set({
        footageError: (res.data as unknown as { message?: string })?.message ?? "Failed to start download",
        footageDownloading: false,
        footageProgress: null,
      });
      return;
    }

    const taskId = res.data.taskId;
    set({ footageTaskId: taskId });

    const pollInterval = setInterval(async () => {
      const prog = await apiFetch<{
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
      }>(`/api/xclips/footage/progress/${taskId}`);

      if (prog.ok && prog.data?.progress) {
        const p = prog.data.progress;
        set({
          footageProgress: {
            percent: p.percent,
            speedStr: p.speedStr,
            etaStr: p.etaStr,
            totalSizeStr: p.totalSizeStr,
            status: p.status,
          },
        });

        if (p.status === "completed") {
          clearInterval(pollInterval);
          set({ footageDownloading: false });
          if (p.project) {
            set({
              footageResult: { projectId: p.project.id, videoPath: p.project.sourcePath },
              actionSuccess: `"${p.project.name || "B-Roll"}" downloaded and added to library!`,
              assetsSubTab: "video",
              footageUrl: "",
            });
            get().fetchFootageList();
            setTimeout(() => set({ actionSuccess: null }), 5000);
          }
        } else if (p.status === "error") {
          clearInterval(pollInterval);
          set({
            footageDownloading: false,
            footageError: p.error ?? "Download failed",
            footageProgress: null,
          });
        }
      }
    }, 1200);
  },

  handleCaptureThumbnail: async () => {
    const { projectId, currentTime } = get();
    if (!projectId) return;

    set({ isCapturingThumb: true });
    const res = await apiFetch<{ ok: boolean; message: string }>(`/api/xclips/media/${projectId}/thumbnail/capture`, {
      method: "POST",
      body: JSON.stringify({ timeSec: currentTime }),
    });
    set({ isCapturingThumb: false });

    if (res.ok) {
      set({
        thumbTimestamp: Date.now(),
        actionSuccess: `Thumbnail berhasil di-capture!`,
      });
      setTimeout(() => set({ actionSuccess: null }), 3000);
      get().fetchAssets();
      get().fetchLogs();
    } else {
      set({ actionError: res.data?.message || "Gagal mengambil frame thumbnail" });
    }
  },

  handleOpenInExplorer: async (sourcePath, targetProjectId) => {
    const res = await apiFetch<{ ok: boolean; message?: string }>("/api/xclips/open-in-explorer", {
      method: "POST",
      body: JSON.stringify({ path: sourcePath, projectId: targetProjectId }),
    });
    if (res.ok) {
      set({ actionSuccess: "Opened in File Explorer!" });
      setTimeout(() => set({ actionSuccess: null }), 2500);
    } else {
      set({ actionSuccess: (res.data as unknown as { message?: string })?.message || "Failed to open explorer" });
      setTimeout(() => set({ actionSuccess: null }), 3000);
    }
  },

  handleRender: async () => {
    const { selectedClip } = get();
    if (!selectedClip) return;

    set({ renderStatus: "rendering", renderProgress: 5 });

    const res = await apiFetch<{ ok: boolean; job: { id: string } }>(
      `/api/xclips/clips/${selectedClip.id}/render`,
      { method: "POST" }
    );

    if (res.ok && res.data?.job) {
      set({ renderJobId: res.data.job.id });
      get().fetchLogs();
    } else {
      set({ renderStatus: "failed" });
      get().fetchLogs();
    }
  },

  handleCopyLogs: () => {
    const raw = JSON.stringify(get().logs, null, 2);
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(raw);
    }
    set({ copiedLogs: true });
    setTimeout(() => set({ copiedLogs: false }), 2000);
  },
}));
