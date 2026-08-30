import { create } from "zustand";
import { apiFetch } from "@/lib/api-client";
import {
  XclipsProject,
  XclipsTranscript,
  XclipsClip,
  WordTimestamp,
  XclipsAiSettings,
  AspectRatio,
  LayoutMode,
  SubtitleStyle,
  AiProviderType,
  MasterStyleConfig,
} from "@/lib/xclips/types";
import { LogItem, ProjectAssets, FootageProgress, DEFAULT_SUBTITLE_STYLE } from "../types/studio.types";
import { generateSrtFromWords } from "@/lib/xclips/phrase-segmentation";

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
  studioAspectRatio: AspectRatio;
  studioLayoutMode: LayoutMode;
  studioPanOffsetX: number;
  studioVideoScale: number;
  studioVideoPanX: number;
  studioVideoPanY: number;
  studioVideoRotation: number;
  studioSubtitleStyle: SubtitleStyle;
  volume: number;
  isMuted: boolean;
  isFullSourceView: boolean;

  isTranscribing: boolean;
  isFetchingYtSubtitles: boolean;
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
  selectedSubtitleSource: string;
  subtitleTracks: XclipsTranscript[];
  isGenerateSubtitleModalOpen: boolean;
  autoSaveStatus: "idle" | "saving" | "saved" | "error";

  assets: ProjectAssets | null;
  assetsLoading: boolean;
  isCapturingThumb: boolean;
  copiedAssetKey: string | null;
  thumbTimestamp: number;

  previewVideoOpen: boolean;
  previewThumbnailOpen: boolean;
  exportModalOpen: boolean;

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
  setStudioAspectRatio: (ratio: AspectRatio) => void;
  setStudioLayoutMode: (mode: LayoutMode) => void;
  setStudioPanOffsetX: (pan: number) => void;
  setStudioVideoScale: (scale: number) => void;
  setStudioVideoPanX: (x: number) => void;
  setStudioVideoPanY: (y: number) => void;
  setStudioVideoRotation: (rot: number) => void;
  setStudioSubtitleStyle: (style: SubtitleStyle | ((prev: SubtitleStyle) => SubtitleStyle)) => void;
  setVolume: (volume: number | ((prev: number) => number)) => void;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  toggleMute: () => void;
  setIsFullSourceView: (full: boolean | ((prev: boolean) => boolean)) => void;

  setIsTranscribing: (val: boolean) => void;
  setIsFetchingYtSubtitles: (val: boolean) => void;
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
  setSelectedSubtitleSource: (source: string) => void;
  setSubtitleTracks: (tracks: XclipsTranscript[]) => void;
  setIsGenerateSubtitleModalOpen: (open: boolean) => void;
  setAutoSaveStatus: (status: "idle" | "saving" | "saved") => void;

  setAssets: (assets: ProjectAssets | null) => void;
  setAssetsLoading: (val: boolean) => void;
  setIsCapturingThumb: (val: boolean) => void;
  setCopiedAssetKey: (key: string | null) => void;
  setThumbTimestamp: (ts: number) => void;

  setPreviewVideoOpen: (open: boolean) => void;
  setPreviewThumbnailOpen: (open: boolean) => void;
  setExportModalOpen: (open: boolean) => void;

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
  saveActiveClipNow: (clipOverride?: XclipsClip) => Promise<void>;
  saveMasterTemplateNow: () => Promise<void>;
  saveStudioSession: () => void;
  handleDeleteClip: (clipId: string) => Promise<void>;
  handleTranscribe: (modelOverride?: string, label?: string, providerOverride?: AiProviderType) => Promise<{ ok: boolean; message?: string }>;
  handleFetchYouTubeSubtitles: () => Promise<{ ok: boolean; message?: string }>;
  handleDiscoverHighlights: () => Promise<void>;
  handleSaveTranscript: () => Promise<void>;
  handleDownloadSrt: () => void;
  fetchSubtitleTracks: (projectId?: string) => Promise<void>;
  handleSwitchSubtitleTrack: (trackId: string) => Promise<void>;
  handleDeleteSubtitleTrack: (trackId: string) => Promise<void>;
  handleAutoSaveTranscript: (wordsToSave?: WordTimestamp[]) => Promise<void>;
  handleShiftSubtitleOffsetMs: (deltaMs: number) => void;
  handleApplyOffsetPermanently: () => Promise<void>;
  handleFootageDownload: (targetUrl?: string) => Promise<void>;
  handleCaptureThumbnail: () => Promise<void>;
  handleOpenInExplorer: (sourcePath?: string, targetProjectId?: string) => Promise<void>;
  handleRender: () => Promise<void>;
  handleCopyLogs: () => void;
  handleClearLogs: () => Promise<void>;
}

let autoSaveTimeout: NodeJS.Timeout | null = null;

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
  studioAspectRatio: "9:16",
  studioLayoutMode: "blur_bg",
  studioPanOffsetX: 0,
  studioVideoScale: 1.0,
  studioVideoPanX: 0,
  studioVideoPanY: 0,
  studioVideoRotation: 0,
  studioSubtitleStyle: DEFAULT_SUBTITLE_STYLE,
  volume: 100,
  isMuted: false,
  isFullSourceView: false,

  isTranscribing: false,
  isFetchingYtSubtitles: false,
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
  selectedSubtitleSource: "youtube",
  subtitleTracks: [],
  isGenerateSubtitleModalOpen: false,
  autoSaveStatus: "idle",

  assets: null,
  assetsLoading: false,
  isCapturingThumb: false,
  copiedAssetKey: null,
  thumbTimestamp: Date.now(),

  previewVideoOpen: false,
  previewThumbnailOpen: false,
  exportModalOpen: false,

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
  setSelectedClip: (selectedClip) => {
    set({ selectedClip });
    if (selectedClip) {
      set({
        studioSubtitleStyle: selectedClip.subtitleStyle || get().studioSubtitleStyle || DEFAULT_SUBTITLE_STYLE,
        studioLayoutMode: selectedClip.layoutMode || get().studioLayoutMode || "blur_bg",
        studioAspectRatio: selectedClip.aspectRatio || get().studioAspectRatio || "9:16",
        studioPanOffsetX: selectedClip.panOffsetX ?? 0,
        studioVideoScale: selectedClip.videoScale ?? 1.0,
        studioVideoPanX: selectedClip.videoPanX ?? selectedClip.panOffsetX ?? 0,
        studioVideoPanY: selectedClip.videoPanY ?? 0,
        studioVideoRotation: selectedClip.videoRotation ?? 0,
      });
    }
    get().saveStudioSession();
  },

  setActiveTab: (activeTab) => {
    set({ activeTab });
    get().saveStudioSession();
  },
  setIsPlaying: (updater) =>
    set((state) => ({
      isPlaying: typeof updater === "function" ? updater(state.isPlaying) : updater,
    })),
  setCurrentTime: (updater) =>
    set((state) => ({
      currentTime: typeof updater === "function" ? updater(state.currentTime) : updater,
    })),
  setStudioAspectRatio: (ratio) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, aspectRatio: ratio } : null;
      return {
        studioAspectRatio: ratio,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioLayoutMode: (mode) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, layoutMode: mode } : null;
      return {
        studioLayoutMode: mode,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioPanOffsetX: (pan) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, panOffsetX: pan, videoPanX: pan } : null;
      return {
        studioPanOffsetX: pan,
        studioVideoPanX: pan,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioVideoScale: (scale) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, videoScale: scale } : null;
      return {
        studioVideoScale: scale,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioVideoPanX: (x) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, videoPanX: x, panOffsetX: x } : null;
      return {
        studioVideoPanX: x,
        studioPanOffsetX: x,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioVideoPanY: (y) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, videoPanY: y } : null;
      return {
        studioVideoPanY: y,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioVideoRotation: (rot) => {
    set((state) => {
      const nextClip = state.selectedClip ? { ...state.selectedClip, videoRotation: rot } : null;
      return {
        studioVideoRotation: rot,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    });
  },
  setStudioSubtitleStyle: (updater) =>
    set((state) => {
      const nextStyle = typeof updater === "function" ? updater(state.studioSubtitleStyle) : updater;
      const nextClip = state.selectedClip ? { ...state.selectedClip, subtitleStyle: nextStyle } : null;
      return {
        studioSubtitleStyle: nextStyle,
        selectedClip: nextClip,
        clips: nextClip ? state.clips.map((c) => (c.id === nextClip.id ? nextClip : c)) : state.clips,
      };
    }),
  setVolume: (updater) =>
    set((state) => {
      const nextVol = typeof updater === "function" ? updater(state.volume) : updater;
      const clamped = Math.max(0, Math.min(100, nextVol));
      const res = {
        volume: clamped,
        isMuted: clamped === 0 ? true : state.isMuted,
      };
      if (typeof window !== "undefined" && state.projectId) {
        localStorage.setItem(`xclips_vol_${state.projectId}`, String(clamped));
      }
      return res;
    }),
  setIsMuted: (updater) =>
    set((state) => ({
      isMuted: typeof updater === "function" ? updater(state.isMuted) : updater,
    })),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setIsFullSourceView: (updater) =>
    set((state) => {
      const nextVal = typeof updater === "function" ? updater(state.isFullSourceView) : updater;
      const res = { isFullSourceView: nextVal };
      setTimeout(() => get().saveStudioSession(), 0);
      return res;
    }),

  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setIsFetchingYtSubtitles: (isFetchingYtSubtitles) => set({ isFetchingYtSubtitles }),
  setIsDiscovering: (isDiscovering) => set({ isDiscovering }),
  setIsSavingTranscript: (isSavingTranscript) => set({ isSavingTranscript }),
  setActionError: (actionError) => {
    set({ actionError });
    if (actionError) {
      setTimeout(() => {
        if (get().actionError === actionError) {
          set({ actionError: null });
        }
      }, 5000);
    }
  },
  setActionSuccess: (actionSuccess) => {
    set({ actionSuccess });
    if (actionSuccess) {
      setTimeout(() => {
        if (get().actionSuccess === actionSuccess) {
          set({ actionSuccess: null });
        }
      }, 4000);
    }
  },

  setRenderJobId: (renderJobId) => set({ renderJobId }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),

  setEditableWords: (updater) =>
    set((state) => {
      const nextWords = typeof updater === "function" ? updater(state.editableWords) : updater;
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        get().handleAutoSaveTranscript(nextWords);
      }, 1000);
      return { editableWords: nextWords };
    }),
  setExpandedPhraseId: (expandedPhraseId) => set({ expandedPhraseId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAutoScrollToPlayhead: (autoScrollToPlayhead) => set({ autoScrollToPlayhead }),
  setScrollTop: (scrollTop) => set({ scrollTop }),
  setDraggedPhraseIndex: (draggedPhraseIndex) => set({ draggedPhraseIndex }),
  setDragOverPhraseIndex: (dragOverPhraseIndex) => set({ dragOverPhraseIndex }),
  setSubtitleOffsetMs: (subtitleOffsetMs) =>
    set((state) => ({
      subtitleOffsetMs:
        typeof subtitleOffsetMs === "function"
          ? subtitleOffsetMs(state.subtitleOffsetMs)
          : subtitleOffsetMs,
    })),
  setSelectedSubtitleSource: (selectedSubtitleSource) => set({ selectedSubtitleSource }),
  setSubtitleTracks: (subtitleTracks) => set({ subtitleTracks }),
  setIsGenerateSubtitleModalOpen: (isGenerateSubtitleModalOpen) => set({ isGenerateSubtitleModalOpen }),
  setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),

  setAssets: (assets) => set({ assets }),
  setAssetsLoading: (assetsLoading) => set({ assetsLoading }),
  setIsCapturingThumb: (isCapturingThumb) => set({ isCapturingThumb }),
  setCopiedAssetKey: (copiedAssetKey) => set({ copiedAssetKey }),
  setThumbTimestamp: (thumbTimestamp) => set({ thumbTimestamp }),

  setPreviewVideoOpen: (previewVideoOpen) => set({ previewVideoOpen }),
  setPreviewThumbnailOpen: (previewThumbnailOpen) => set({ previewThumbnailOpen }),
  setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),

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
    set({ projectId: id, loading: true });
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
          projectId: id,
          project: p,
          transcript: t,
          editableWords: t?.words ? [...t.words] : [],
          selectedSubtitleSource: t?.id || "youtube",
          clips: loadedClips,
        });

        // Restore Master Style fallback if exists
        let masterStyle = p.masterStyle;
        if (!masterStyle && p.masterStyleJson) {
          try {
            masterStyle = JSON.parse(p.masterStyleJson);
          } catch {
            // ignore
          }
        }
        if (!masterStyle && typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem(`xclips_master_style_${id}`);
            if (cached) masterStyle = JSON.parse(cached);
          } catch {
            // ignore
          }
        }

        if (masterStyle) {
          set({
            studioAspectRatio: masterStyle.aspectRatio || "9:16",
            studioLayoutMode: masterStyle.layoutMode || "blur_bg",
            studioPanOffsetX: masterStyle.panOffsetX || 0,
            studioVideoScale: masterStyle.videoScale ?? 1.0,
            studioVideoPanX: masterStyle.videoPanX ?? masterStyle.panOffsetX ?? 0,
            studioVideoPanY: masterStyle.videoPanY ?? 0,
            studioVideoRotation: masterStyle.videoRotation ?? 0,
            studioSubtitleStyle: masterStyle.subtitleStyle || DEFAULT_SUBTITLE_STYLE,
          });
        }

        // Restore Session (Last Active Tab, Selected Clip, Volume, etc.)
        let savedSession: {
          activeTab?: number;
          selectedClipId?: string | null;
          selectedSubtitleSource?: string;
          volume?: number;
          isMuted?: boolean;
          isFullSourceView?: boolean;
        } | null = null;

        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`xclips_studio_session_${id}`);
            if (raw) savedSession = JSON.parse(raw);
          } catch {
            // ignore
          }
        }

        if (savedSession?.activeTab !== undefined) {
          set({ activeTab: savedSession.activeTab });
        }
        if (savedSession?.volume !== undefined) {
          set({ volume: savedSession.volume });
        }
        if (savedSession?.isMuted !== undefined) {
          set({ isMuted: savedSession.isMuted });
        }
        if (savedSession?.isFullSourceView !== undefined) {
          set({ isFullSourceView: savedSession.isFullSourceView });
        }

        // Resolve Target Clip
        let targetClip: XclipsClip | null = null;
        if (savedSession?.selectedClipId) {
          targetClip = loadedClips.find((c) => c.id === savedSession?.selectedClipId) || null;
        }
        if (!targetClip && loadedClips.length > 0) {
          targetClip = loadedClips[0];
        }

        if (targetClip) {
          set({
            selectedClip: targetClip,
            currentTime: targetClip.startSec,
            studioSubtitleStyle: targetClip.subtitleStyle || DEFAULT_SUBTITLE_STYLE,
            studioLayoutMode: targetClip.layoutMode || "blur_bg",
            studioAspectRatio: targetClip.aspectRatio || "9:16",
            studioPanOffsetX: targetClip.panOffsetX || 0,
            studioVideoScale: targetClip.videoScale ?? 1.0,
            studioVideoPanX: targetClip.videoPanX ?? targetClip.panOffsetX ?? 0,
            studioVideoPanY: targetClip.videoPanY ?? 0,
            studioVideoRotation: targetClip.videoRotation ?? 0,
          });
        }

        get().fetchSubtitleTracks(id);
        get().fetchAssets(id);
        get().fetchLogs(id);
        get().fetchAiSettings();
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
      const newLogs = res.data.logs;
      const currentLogs = get().logs;
      if (
        newLogs.length !== currentLogs.length ||
        (newLogs.length > 0 &&
          (newLogs[newLogs.length - 1]?.time !== currentLogs[currentLogs.length - 1]?.time ||
            newLogs[0]?.time !== currentLogs[0]?.time))
      ) {
        set({ logs: newLogs });
      }
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
        const completeApiKeys: Record<AiProviderType, string> = {
          kieai: s.apiKeys?.kieai || "",
          gemini: s.apiKeys?.gemini || "",
          openai: s.apiKeys?.openai || "",
          anthropic: s.apiKeys?.anthropic || "",
          openai_compatible: s.apiKeys?.openai_compatible || "",
        };
        if (!completeApiKeys[currentProvider] && resolvedKey) {
          completeApiKeys[currentProvider] = resolvedKey;
        }
        const completeSettings: XclipsAiSettings = {
          ...s,
          apiKey: resolvedKey,
          apiKeys: completeApiKeys,
        };
        set({ aiSettings: completeSettings });
        if (typeof window !== "undefined") {
          localStorage.setItem("xclips_ai_settings_cache", JSON.stringify(completeSettings));
        }
        get().fetchAvailableModels(currentProvider, resolvedKey, s.baseUrl);
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
      const res = await apiFetch<{ ok: boolean; models?: string[]; highlightModels?: string[]; transcribeModels?: string[] }>(
        "/api/xclips/ai/models",
        {
          method: "POST",
          body: JSON.stringify({ provider, apiKey, baseUrl }),
        }
      );
      if (res.ok && res.data) {
        const modelList = res.data.models || res.data.highlightModels || [];
        set({
          availableHighlightModels: modelList,
          availableTranscribeModels: res.data.transcribeModels || modelList,
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

  saveStudioSession: () => {
    const state = get();
    if (!state.projectId || typeof window === "undefined") return;
    try {
      const session = {
        activeTab: state.activeTab,
        selectedClipId: state.selectedClip?.id || null,
        selectedSubtitleSource: state.selectedSubtitleSource,
        volume: state.volume,
        isMuted: state.isMuted,
        isFullSourceView: state.isFullSourceView,
      };
      localStorage.setItem(`xclips_studio_session_${state.projectId}`, JSON.stringify(session));
    } catch {
      // ignore
    }
  },

  saveActiveClipNow: async (clipOverride) => {
    const clipToSave = clipOverride || get().selectedClip;
    if (!clipToSave) {
      await get().saveMasterTemplateNow();
      return;
    }

    set({ autoSaveStatus: "saving" });
    try {
      const res = await apiFetch<{ ok: boolean; clip?: XclipsClip; message?: string }>(
        `/api/xclips/clips/${clipToSave.id}`,
        {
          method: "PUT",
          body: JSON.stringify(clipToSave),
        }
      );

      if (res.ok && res.data?.clip) {
        const saved = res.data.clip;
        set((state) => ({
          selectedClip: saved,
          clips: state.clips.map((c) => (c.id === saved.id ? saved : c)),
          autoSaveStatus: "saved",
        }));
        get().saveStudioSession();
        setTimeout(() => {
          if (get().autoSaveStatus === "saved") {
            set({ autoSaveStatus: "idle" });
          }
        }, 2500);
      } else {
        set({ autoSaveStatus: "error" });
        setTimeout(() => {
          if (get().autoSaveStatus === "error") {
            set({ autoSaveStatus: "idle" });
          }
        }, 4000);
      }
    } catch {
      set({ autoSaveStatus: "error" });
    }
  },

  saveMasterTemplateNow: async () => {
    const state = get();
    const projectId = state.projectId;
    if (!projectId) return;

    const masterStyle: MasterStyleConfig = {
      aspectRatio: state.studioAspectRatio,
      layoutMode: state.studioLayoutMode,
      panOffsetX: state.studioPanOffsetX,
      videoScale: state.studioVideoScale,
      videoPanX: state.studioVideoPanX,
      videoPanY: state.studioVideoPanY,
      videoRotation: state.studioVideoRotation,
      subtitleStyle: state.studioSubtitleStyle,
    };

    set({ autoSaveStatus: "saving" });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`xclips_master_style_${projectId}`, JSON.stringify(masterStyle));
      } catch {
        // ignore
      }
    }

    try {
      const res = await apiFetch<{ ok: boolean; project?: XclipsProject }>(
        `/api/xclips/projects/${projectId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            masterStyle,
            masterStyleJson: JSON.stringify(masterStyle),
          }),
        }
      );

      if (res.ok) {
        set({ autoSaveStatus: "saved" });
        setTimeout(() => {
          if (get().autoSaveStatus === "saved") {
            set({ autoSaveStatus: "idle" });
          }
        }, 2500);
      } else {
        set({ autoSaveStatus: "error" });
      }
    } catch {
      set({ autoSaveStatus: "error" });
    }
  },

  handleSaveClip: async (updatedClip) => {
    set({ selectedClip: updatedClip });
    set((state) => ({
      clips: state.clips.map((c) => (c.id === updatedClip.id ? updatedClip : c)),
    }));
    await get().saveActiveClipNow(updatedClip);
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

  fetchSubtitleTracks: async (targetId) => {
    const id = targetId || get().projectId;
    if (!id) return;
    const res = await apiFetch<{ ok: boolean; subtitles?: XclipsTranscript[] }>(`/api/xclips/projects/${id}/subtitles`);
    if (res.ok && res.data?.subtitles) {
      set({ subtitleTracks: res.data.subtitles });
      const activeTrack = res.data.subtitles.find((s) => s.isActive);
      if (activeTrack && (!get().transcript || get().transcript?.id !== activeTrack.id)) {
        set({
          transcript: activeTrack,
          editableWords: activeTrack.words || [],
          selectedSubtitleSource: activeTrack.id,
        });
      }
    }
  },

  handleSwitchSubtitleTrack: async (trackId) => {
    const id = get().projectId;
    if (!id || !trackId) return;

    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/subtitles/switch`,
      {
        method: "POST",
        body: JSON.stringify({ transcriptId: trackId }),
      }
    );

    if (res.ok && res.data?.transcript) {
      const t = res.data.transcript;
      set({
        transcript: t,
        editableWords: t.words,
        selectedSubtitleSource: t.id,
        actionSuccess: `Beralih ke subtitle "${t.label || (t.sourceType === 'youtube_cc' ? 'YouTube Subtitles (CC)' : 'AI Subtitle')}"`,
      });
      get().fetchSubtitleTracks(id);
      get().fetchAssets();
      get().fetchLogs();
    } else {
      get().setActionError(res.data?.message || "Gagal beralih track subtitle");
    }
  },

  handleDeleteSubtitleTrack: async (trackId) => {
    const id = get().projectId;
    if (!id || !trackId) return;

    const res = await apiFetch<{ ok: boolean; remaining?: XclipsTranscript[]; active?: XclipsTranscript | null; message?: string }>(
      `/api/xclips/projects/${id}/subtitles/${trackId}`,
      { method: "DELETE" }
    );

    if (res.ok && res.data) {
      const remaining = res.data.remaining || [];
      const active = res.data.active || null;
      set({
        subtitleTracks: remaining,
        transcript: active,
        editableWords: active?.words || [],
        selectedSubtitleSource: active?.id || "",
        actionSuccess: "Track subtitle berhasil dihapus",
      });
      get().fetchAssets();
      get().fetchLogs();
    } else {
      get().setActionError(res.data?.message || "Gagal menghapus track subtitle");
    }
  },

  handleAutoSaveTranscript: async (wordsToSave) => {
    const id = get().projectId;
    const words = wordsToSave || get().editableWords;
    if (!id || words.length === 0) return;

    set({ autoSaveStatus: "saving" });

    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/transcript`,
      {
        method: "PUT",
        body: JSON.stringify({
          words,
          transcriptId: get().transcript?.id,
        }),
      }
    );

    if (res.ok && res.data?.transcript) {
      const savedTranscript = res.data.transcript;
      set((state) => ({
        transcript: savedTranscript,
        autoSaveStatus: "saved",
        subtitleTracks: state.subtitleTracks.map((t) =>
          t.id === savedTranscript.id ? savedTranscript : t
        ),
      }));
      setTimeout(() => {
        if (get().autoSaveStatus === "saved") {
          set({ autoSaveStatus: "idle" });
        }
      }, 3000);
    } else {
      set({ autoSaveStatus: "idle" });
    }
  },

  handleTranscribe: async (modelOverride?: string, label?: string, providerOverride?: AiProviderType): Promise<{ ok: boolean; message?: string }> => {
    const id = get().projectId;
    if (!id) return { ok: false, message: "Project ID tidak ditemukan" };
    set({ isTranscribing: true, actionError: null, actionSuccess: null });

    const modelToUse = modelOverride || get().aiSettings?.transcribeModel || "gemini-3-7-flash";

    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/transcribe`,
      {
        method: "POST",
        body: JSON.stringify({ model: modelToUse, label, provider: providerOverride }),
      }
    );
    set({ isTranscribing: false });

    if (res.ok && res.data?.transcript) {
      set({
        transcript: res.data.transcript,
        editableWords: res.data.transcript.words,
        selectedSubtitleSource: res.data.transcript.id,
        actionSuccess: `Transkripsi berhasil dibuat dengan model ${modelToUse}!`,
        isGenerateSubtitleModalOpen: false,
      });
      setTimeout(() => set({ actionSuccess: null }), 3500);
      get().fetchSubtitleTracks(id);
      get().fetchAssets();
      get().fetchLogs();
      return { ok: true };
    } else {
      const errMsg = res.data?.message || "Gagal melakukan transkripsi AI";
      get().setActionError(errMsg);
      get().fetchLogs();
      return { ok: false, message: errMsg };
    }
  },

  handleFetchYouTubeSubtitles: async (): Promise<{ ok: boolean; message?: string }> => {
    const id = get().projectId;
    if (!id) return { ok: false, message: "Project ID tidak ditemukan" };
    set({ isFetchingYtSubtitles: true, actionError: null, actionSuccess: null });

    const res = await apiFetch<{ ok: boolean; transcript?: XclipsTranscript; message?: string }>(
      `/api/xclips/projects/${id}/subtitles/youtube`,
      { method: "POST" }
    );
    set({ isFetchingYtSubtitles: false });

    if (res.ok && res.data?.transcript) {
      set({
        transcript: res.data.transcript,
        editableWords: res.data.transcript.words,
        selectedSubtitleSource: res.data.transcript.id,
        actionSuccess: "Subtitle YouTube berhasil dimuat!",
        isGenerateSubtitleModalOpen: false,
      });
      setTimeout(() => set({ actionSuccess: null }), 3000);
      get().fetchSubtitleTracks(id);
      get().fetchAssets();
      get().fetchLogs();
      return { ok: true };
    } else {
      const errMsg = res.data?.message || "Gagal memuat subtitle YouTube";
      get().setActionError(errMsg);
      get().fetchLogs();
      return { ok: false, message: errMsg };
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
      get().setActionError(res.data?.message || "Gagal mengekstrak autoclips");
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
      get().setActionError(res.data?.message || "Gagal menyimpan transkrip");
    }
  },

  handleDownloadSrt: () => {
    const { project, transcript, editableWords, subtitleOffsetMs } = get();
    const wordsToUse = editableWords.length > 0 ? editableWords : (transcript?.words || []);
    if (wordsToUse.length === 0 && !transcript?.srtContent) {
      get().setActionError("Tidak ada transkrip subtitle untuk diunduh.");
      return;
    }

    const offsetSec = (subtitleOffsetMs || 0) / 1000;
    const srtContent = wordsToUse.length > 0
      ? generateSrtFromWords(wordsToUse, { offsetSec })
      : (transcript?.srtContent || "");

    const cleanProjectName = (project?.name || "subtitles").replace(/[^a-zA-Z0-9_\-]/g, "_");
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cleanProjectName}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    get().setActionSuccess(`Subtitle "${cleanProjectName}.srt" berhasil didownload!`);
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
      get().setActionError(res.data?.message || "Gagal menyimpan kalibrasi offset transkrip");
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

  handleClearLogs: async () => {
    const { projectId } = get();
    set({ logs: [] });
    if (projectId) {
      await apiFetch(`/api/xclips/projects/${projectId}/logs`, { method: "DELETE" });
    }
  },
}));
