import * as fs from "fs";
import * as path from "path";
import type { AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import type {
	DownloadProgress,
	Result,
	XclipsClip,
	XclipsProject,
	XclipsTranscript,
} from "@/lib/xclips/types";
import { xclipsService } from "@/lib/xclips.service";
import { xclipsDb } from "@/lib/xclips/xclips-db";

// ============================================================
// Auto Production DI Adapter — Slice 5
// ============================================================
// Bridges XclipsService → AutoProductionDeps interface.
// In tests, mock AutoProductionDeps directly instead of using this adapter.

export function getAutoProductionDeps(): AutoProductionDeps {
	return {
		/**
		 * Resolve an already-persisted project for an exact source identity.
		 * Prefers the oldest project whose media still exists on disk and
		 * which already carries a usable transcript (words > 0), so repeat
		 * Generate/Regenerate runs replan on the same project + transcript
		 * instead of duplicating ingest/transcription. Returns null when
		 * nothing reusable exists (orchestrator falls through to ingest).
		 */
		async findExistingProjectBySourcePath(
			sourcePath: string,
		): Promise<Result<XclipsProject | null>> {
			try {
				const candidates = xclipsDb
					.getAllProjects()
					.filter((p) => isSameSourceIdentity(p.sourcePath, sourcePath))
					.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
				for (const candidate of candidates) {
					const mediaPath = candidate.normalizedPath || candidate.sourcePath;
					if (!mediaPath || !fs.existsSync(mediaPath)) continue;
					const transcript = xclipsDb.getTranscript(candidate.id);
					if (transcript && transcript.words && transcript.words.length > 0) {
						return { success: true, data: candidate };
					}
				}
				return { success: true, data: null };
			} catch {
				return { success: true, data: null };
			}
		},
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

		async getExistingTranscript(
			projectId: string,
		): Promise<Result<XclipsTranscript | null>> {
			try {
				const existing = xclipsDb.getTranscript(projectId);
				return { success: true, data: existing };
			} catch {
				return { success: true, data: null };
			}
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
				editorialFunction?: string;
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

/**
 * Exact persisted-source identity: identical strings match; local
 * filesystem paths also match when they resolve to the same absolute
 * path (covers relative-vs-absolute spellings). URLs match exactly only.
 */
function isSameSourceIdentity(a: string, b: string): boolean {
	if (!a || !b) return false;
	if (a === b) return true;
	const looksUrl = (s: string) => /^https?:\/\//i.test(s);
	if (looksUrl(a) || looksUrl(b)) return false;
	try {
		return path.resolve(a) === path.resolve(b);
	} catch {
		return false;
	}
}
