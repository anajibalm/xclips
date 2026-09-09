// ============================================================
// Auto Production Helpers — Client-safe pure functions
// ============================================================
// No Node.js imports — safe for both client and server bundles.

const YOUTUBE_URL_RE =
	/^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)/i;

/**
 * Detect whether a sourcePath string is a supported YouTube URL.
 * Returns "url" for YouTube URLs, "local" for filesystem paths.
 */
export function detectSourceType(sourcePath: string): "local" | "url" {
	const trimmed = sourcePath.trim();
	if (YOUTUBE_URL_RE.test(trimmed)) {
		return "url";
	}
	return "local";
}

// --- Source credit identity (S1.2 production closeout) --------------------

/**
 * Persisted publisher-level metadata. Mirrors the optional fields carried
 * by XclipsProject.sourceMeta (channel/uploader) plus forward-compatible
 * publisher/creator/author slots. Never add title parsing here.
 */
export interface SourceCreditMetadata {
	channel?: string | null;
	uploader?: string | null;
	publisher?: string | null;
	creator?: string | null;
	author?: string | null;
}

/** Last-resort credit when neither metadata nor explicit name yields text. */
export const FALLBACK_SOURCE_CREDIT = "Redaksi";

const cleanCredit = (value: string | null | undefined): string =>
	(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Resolve the footer publisher credit upstream of rendering (S1.2).
 *
 * Priority (frozen contract):
 * 1. persisted channel/uploader/publisher metadata (first non-blank wins)
 * 2. explicit operator-supplied brief sourceName
 * 3. safe fallback (never empty — ProductionBrief requires min length 1)
 *
 * A long video title passed as explicit sourceName NEVER replaces an
 * available publisher. This function resolves identity only — measuring,
 * fitting, truncation and anti-overlap stay in resolveAutoProductionFooter.
 * Pure function — unit testable without FFmpeg or DB.
 */
export function resolveSourceCreditName(
	meta: SourceCreditMetadata | undefined | null,
	explicitName?: string | null,
	fallback: string = FALLBACK_SOURCE_CREDIT,
): string {
	const candidates = [
		meta?.channel,
		meta?.uploader,
		meta?.publisher,
		meta?.creator,
		meta?.author,
	];
	for (const candidate of candidates) {
		const cleaned = cleanCredit(candidate);
		if (cleaned) return cleaned;
	}
	const explicit = cleanCredit(explicitName);
	if (explicit) return explicit;
	return cleanCredit(fallback) || "Redaksi";
}
