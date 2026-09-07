import type { AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import type {
	DownloadProgress,
	Result,
	XclipsClip,
	XclipsProject,
	XclipsTranscript,
} from "@/lib/xclips/types";
import { xclipsService } from "@/lib/xclips.service";

// ============================================================
// Auto Production DI Adapter — Slice 5
// ============================================================
// Bridges XclipsService → AutoProductionDeps interface.
// In tests, mock AutoProductionDeps directly instead of using this adapter.

export function getAutoProductionDeps(): AutoProductionDeps {
	return {
		async ingestLocalFile(
			sourcePath: string,
			customName?: string,
		): Promise<Result<XclipsProject>> {
			const result = await xclipsService.ingestLocalFile(
				sourcePath,
				customName,
			);
			return result;
		},

		async ingestYouTubeUrl(
			url: string,
			options?: {
				quality?: string;
				customName?: string;
				downloadSubtitles?: boolean;
			},
			onProgress?: (p: unknown) => void,
		): Promise<Result<XclipsProject>> {
			const result = await xclipsService.ingestYouTubeUrl(
				url,
				{
					quality: options?.quality as
						| "best"
						| "1080p"
						| "720p"
						| "480p"
						| undefined,
					customName: options?.customName,
					downloadSubtitles: options?.downloadSubtitles,
				},
				onProgress as (progress: DownloadProgress) => void,
			);
			return result;
		},

		async transcribeProject(
			projectId: string,
			options?: { model?: string; apiKey?: string },
		): Promise<Result<XclipsTranscript>> {
			const result = await xclipsService.transcribeProject(projectId, options);
			return result;
		},

		async discoverHighlights(
			projectId: string,
			options?: {
				topicPrompt?: string;
				hookFormula?: string;
				targetDuration?: "short" | "standard" | "long" | "extended";
				maxClipsCount?: number;
				transcriptId?: string;
			},
		): Promise<Result<XclipsClip[]>> {
			const result = await xclipsService.discoverHighlights(projectId, options);
			return result;
		},
	};
}
