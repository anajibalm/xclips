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
