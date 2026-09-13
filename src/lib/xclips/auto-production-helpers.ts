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
	uploaderId?: string | null;
	channelId?: string | null;
	channelUrl?: string | null;
	uploaderUrl?: string | null;
	publisher?: string | null;
	creator?: string | null;
	author?: string | null;
}

export interface ResolvedSourceCreditMeta {
	sourceName: string;
	publisherHandle: string;
}

const cleanHandle = (value: string | null | undefined): string => {
	const cleaned = cleanCredit(value);
	return /^@[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : "";
};

export function resolveSourceCreditMeta(
	meta: SourceCreditMetadata | undefined | null,
	briefSourceName: string,
	/**
	 * Publishing/output account handle (same domain as ProductionBrief
	 * accountHandle and SourceCreditMeta.publisherHandle, which
	 * bakom-presentation.ts documents as the "publishing account" and
	 * endcardChannelLines renders as "Informasi resmi: {handle}").
	 * Footage-source identity (uploaderId, channelUrl, uploaderUrl,
	 * channelId, display names) lives in a different domain and is NEVER
	 * consulted here; footage identity resolves to sourceName only.
	 */
	publishingAccountHandle: string,
): ResolvedSourceCreditMeta | { error: "MISSING_PUBLISHER_HANDLE" } {
	const sourceName = resolveSourceCreditName(meta, briefSourceName);
	const handle = cleanHandle(publishingAccountHandle);
	return handle ? { sourceName, publisherHandle: handle } : { error: "MISSING_PUBLISHER_HANDLE" };
}

/** Last-resort credit when neither metadata nor explicit name yields text. */
export const FALLBACK_SOURCE_CREDIT = "Redaksi";

/**
 * Where a resolved editorial source date came from. `operator` is an
 * explicit operator-supplied date; `platform_upload` is the platform
 * publication/upload date (never the event date); `missing` means no valid
 * date exists on either side and QC must remain REVIEW.
 */
export type SourceDateProvenance = "operator" | "platform_upload" | "missing";

export interface ResolvedSourceDate {
  date?: string;
  provenance: SourceDateProvenance;
}

/** Strict ISO YYYY-MM-DD with real calendar validation. */
export function isValidIsoDate(value: string): boolean {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Resolve the editorial source date. An explicit operator-supplied date wins
 * ONLY when it is a valid ISO date; otherwise a valid platform date is used
 * with `platform_upload` provenance. Invalid/missing on both sides yields no
 * date with `missing` provenance (QC remains REVIEW).
 */
export function resolveBriefSourceDate(
  explicitDate?: string | null,
  platformDate?: string | null,
): ResolvedSourceDate {
  const explicit = (explicitDate ?? "").trim();
  if (explicit && isValidIsoDate(explicit)) return { date: explicit, provenance: "operator" };
  const platform = (platformDate ?? "").trim();
  if (platform && isValidIsoDate(platform)) return { date: platform, provenance: "platform_upload" };
  return { provenance: "missing" };
}

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
