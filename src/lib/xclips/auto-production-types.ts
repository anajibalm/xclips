import { z } from "zod";

// ============================================================
// Auto Production — Typed Domain Contract (Slice 1)
// ============================================================

// --- Job Status -----------------------------------------------------------

export const JobStatusSchema = z.enum([
  "NEW",
  "PROCESSING",
  "READY",
  "NEEDS_REVIEW",
  "FAILED",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// --- Source Reference -----------------------------------------------------

export const SourceReferenceSchema = z.object({
  sourcePath: z.string().min(1, "sourcePath is required"),
  sourceType: z.enum(["local", "url"]),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// --- B-Roll Pool Reference ------------------------------------------------

export const BrollAssetRefSchema = z.object({
  assetId: z.string().min(1),
  label: z.string().optional(),
  path: z.string().min(1),
});
export type BrollAssetRef = z.infer<typeof BrollAssetRefSchema>;

// --- Editorial Signals (3 independent confidence tracks) ------------------

export const EditorialSignalSchema = z.object({
  confidence: z.enum(["strong", "review", "low"]),
  warnings: z.array(z.string()),
});
export type EditorialSignal = z.infer<typeof EditorialSignalSchema>;

// --- B-Roll Placement Plan -----------------------------------------------

export const BrollPlacementSchema = z.object({
  assetId: z.string().min(1),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  relevanceScore: z.number().optional(),
  misrepresentationRisk: z.boolean().optional().default(false),
});
export type BrollPlacement = z.infer<typeof BrollPlacementSchema>;

// --- EditPlan (AI editorial decisions) -----------------------------------

export const EditPlanSchema = z.object({
  statementStart: z.number().min(0),
  statementEnd: z.number().min(0),
  headline: z.string().min(1),
  brollPlacements: z.array(BrollPlacementSchema),
  thumbnailSourceFrame: z.number().optional(),
  statementSignal: EditorialSignalSchema,
  brollSignal: EditorialSignalSchema,
  headlineSignal: EditorialSignalSchema,
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

// --- Account Preset (deterministic production rules) ----------------------

export const AccountPresetIdSchema = z.enum(["shadow", "kabakom"]);
export type AccountPresetId = z.infer<typeof AccountPresetIdSchema>;

export const CaptionStyleSchema = z.object({
  fontFamily: z.string(),
  fontSizePx: z.number(),
  color: z.string(),
  outlineColor: z.string(),
  outlineWidthPx: z.number(),
  uppercase: z.boolean(),
  maxWordsPerPhrase: z.number(),
});
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const HeadlineStyleSchema = z.object({
  fontFamily: z.string(),
  fontSizePx: z.number(),
  color: z.string(),
  position: z.enum(["top", "bottom"]),
});
export type HeadlineStyle = z.infer<typeof HeadlineStyleSchema>;

export const SafeZoneSchema = z.object({
  topPx: z.number(),
  bottomPx: z.number(),
  leftPx: z.number(),
  rightPx: z.number(),
});
export type SafeZone = z.infer<typeof SafeZoneSchema>;

export const TransitionPolicySchema = z.enum(["hard_cut", "cross_dissolve"]);
export type TransitionPolicy = z.infer<typeof TransitionPolicySchema>;

export const BgmPolicySchema = z.object({
  enabled: z.boolean(),
  loudnessTargetLu: z.number().optional(),
  fadeOutSec: z.number().optional(),
});
export type BgmPolicy = z.infer<typeof BgmPolicySchema>;

export const AccountPresetSchema = z.object({
  id: AccountPresetIdSchema,
  label: z.string(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  captionStyle: CaptionStyleSchema,
  headlineStyle: HeadlineStyleSchema,
  safeZone: SafeZoneSchema,
  sourceCreditPlacement: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]),
  handlePlacement: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]),
  transition: TransitionPolicySchema,
  loudnessTargetLu: z.number(),
  bgmPolicy: BgmPolicySchema,
});
export type AccountPreset = z.infer<typeof AccountPresetSchema>;

// --- Production Brief (operator input) ------------------------------------

export const ProductionBriefSchema = z.object({
  source: SourceReferenceSchema,
  editorialAngle: z.string().min(1, "editorialAngle is required"),
  accountPresetId: AccountPresetIdSchema,
  sourceName: z.string().min(1, "sourceName is required"),
  sourceDate: z.string().optional(),
  accountHandle: z.string().min(1, "accountHandle is required"),
  sourceRole: z.string().optional(),
  brollPool: z.array(BrollAssetRefSchema),
});
export type ProductionBrief = z.infer<typeof ProductionBriefSchema>;

// --- Account Preset Registry ----------------------------------------------

const SHADOW: AccountPreset = {
  id: "shadow",
  label: "Shadow",
  width: 1080,
  height: 1920,
  fps: 30,
  captionStyle: {
    fontFamily: "Inter",
    fontSizePx: 44,
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthPx: 2,
    uppercase: true,
    maxWordsPerPhrase: 6,
  },
  headlineStyle: {
    fontFamily: "Inter",
    fontSizePx: 56,
    color: "#FFFFFF",
    position: "top",
  },
  safeZone: { topPx: 120, bottomPx: 120, leftPx: 48, rightPx: 48 },
  sourceCreditPlacement: "bottom_left",
  handlePlacement: "bottom_right",
  transition: "hard_cut",
  loudnessTargetLu: -14,
  bgmPolicy: { enabled: false },
} as const;

const KABAKOM: AccountPreset = {
  id: "kabakom",
  label: "Kabakom",
  width: 1080,
  height: 1920,
  fps: 30,
  captionStyle: {
    fontFamily: "Inter",
    fontSizePx: 44,
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthPx: 2,
    uppercase: true,
    maxWordsPerPhrase: 6,
  },
  headlineStyle: {
    fontFamily: "Inter",
    fontSizePx: 56,
    color: "#FFFFFF",
    position: "top",
  },
  safeZone: { topPx: 120, bottomPx: 120, leftPx: 48, rightPx: 48 },
  sourceCreditPlacement: "bottom_left",
  handlePlacement: "bottom_right",
  transition: "hard_cut",
  loudnessTargetLu: -14,
  bgmPolicy: { enabled: false },
} as const;

export const ACCOUNT_PRESETS: ReadonlyMap<AccountPresetId, AccountPreset> =
  new Map([
    ["shadow", SHADOW],
    ["kabakom", KABAKOM],
  ]);

/**
 * Resolve an AccountPreset by id. Returns undefined for invalid ids
 * (never throws — callers gate on undefined to reject invalid input).
 */
export function resolveAccountPreset(id: AccountPresetId): AccountPreset | undefined {
  return ACCOUNT_PRESETS.get(id);
}

/**
 * Type guard: is the string a valid AccountPresetId?
 */
export function isAccountPresetId(id: string): id is AccountPresetId {
  return AccountPresetIdSchema.safeParse(id).success;
}

// --- Output Bundle (Slice 4) ----------------------------------------------

export interface AutoProductionOutputBundle {
  videoPath: string;
  coverPath: string;
  qc: import("@/lib/xclips/auto-production-qc").QcResult;
  verdict: "READY" | "NEEDS_REVIEW" | "FAILED";
}
