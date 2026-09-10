import * as fs from "fs";
import * as path from "path";

export type SliceEvidenceStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_APPLICABLE";
export type SliceGateStatus = "PASS" | "PENDING" | "FAIL";

export interface SliceContract {
  slice: string;
  deliverable: string;
  projectId: string;
  sourceVideoId: string;
  referencePhysicalBounds: { start: number; end: number };
  semanticStatementId: string;
  semanticAnchor: string;
  headline: string;
  publisher: string;
  visualSpine: string;
  immutableDimensions: string[];
  mutableDimensions: string[];
  forbiddenCapabilities: string[];
  evidenceVocabulary: SliceEvidenceStatus[];
  hardInvariants: {
    ccTimingMayDrivePhysicalCuts: false;
    fillerFlagsMayDrivePhysicalCutsWithoutTrustedAlignment: false;
    momentRediscoveryCalls: 0;
    headlineGenerationCalls: 0;
    sourceMayChange: false;
    nextSliceMayStartBeforeClosure: false;
  };
  closure: { machineGateRequired: true; humanGateRequired: true; blockedRequiredEvidenceMayClose: false };
}

export interface SliceExecutionEvidence {
  projectId: string;
  sourceVideoId: string;
  semanticStatementId: string;
  semanticAnchor: string;
  physicalStatementStart: number;
  physicalStatementEnd: number;
  headline: string;
  publisher: string;
  visualSpine: string;
  keepIntervals?: Array<{ start: number; end: number; duration: number }>;
  momentRediscoveryCalls: number;
  headlineGenerationCalls: number;
  ccTimingUsedForPhysicalCuts: boolean;
  fillerFlagsUsedForPhysicalCuts: boolean;
  trustedAudioAlignmentStatus: SliceEvidenceStatus;
  bgmUsed: boolean;
  sfxUsed: boolean;
  brollUsed: boolean;
  hyperframesUsed: boolean;
  visualRedesignUsed: boolean;
  thumbnailRedesignUsed: boolean;
  nextSliceWorkStarted: boolean;
  machineGateStatus: SliceGateStatus;
  humanGateStatus: SliceGateStatus;
  sourceMayChange?: boolean;
  semanticStatementPreserved: boolean;
}

export interface SliceCheck { id: string; status: SliceEvidenceStatus; message: string; }
export interface SliceValidationResult {
  slice: string;
  checks: SliceCheck[];
  hardInvariantFailed: boolean;
  humanReviewAllowed: boolean;
  closureAllowed: boolean;
}

const CONTRACT_DIR = path.resolve(process.cwd(), "config", "auto-production", "slice-contracts");
const EPSILON_SEC = 0.001;
const equalTime = (a: number, b: number): boolean => Number.isFinite(a) && Math.abs(a - b) <= EPSILON_SEC;

const IMMUTABLE_DIMENSIONS = new Set(["projectId", "sourceVideoId", "semanticStatementId", "semanticAnchor", "headline", "publisher", "visualSpine"]);
const MUTABLE_DIMENSIONS = new Set(["physicalStatementStart", "physicalStatementEnd", "keepIntervals", "subtitleTiming", "audioAlignment", "audioCleanup", "audioJoinTreatment"]);
const FORBIDDEN_CAPABILITIES = new Set(["momentRediscovery", "headlineRegeneration", "sourceReplacement", "broll", "bgm", "sfx", "hyperframes", "thumbnailRedesign", "visualRedesign", "nextSliceWork"]);
const EVIDENCE_STATUSES = new Set<SliceEvidenceStatus>(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);
const HARD_INVARIANTS = {
  ccTimingMayDrivePhysicalCuts: false,
  fillerFlagsMayDrivePhysicalCutsWithoutTrustedAlignment: false,
  momentRediscoveryCalls: 0,
  headlineGenerationCalls: 0,
  sourceMayChange: false,
  nextSliceMayStartBeforeClosure: false,
} as const;

function exactSet(actual: string[], expected: Set<string>): boolean {
  return actual.length === expected.size && new Set(actual).size === expected.size && actual.every((item) => expected.has(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSliceContractObject(value: unknown): SliceContract {
  if (!isRecord(value)) throw new Error("Slice contract must be an object");
  const arrays = ["immutableDimensions", "mutableDimensions", "forbiddenCapabilities", "evidenceVocabulary"];
  for (const key of arrays) if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== "string")) throw new Error(`Invalid contract array: ${key}`);
  const immutable = value.immutableDimensions as string[];
  const mutable = value.mutableDimensions as string[];
  const forbidden = value.forbiddenCapabilities as string[];
  const vocabulary = value.evidenceVocabulary as string[];
  if (!exactSet(immutable, IMMUTABLE_DIMENSIONS)) throw new Error("Invalid immutable dimensions");
  if (!exactSet(mutable, MUTABLE_DIMENSIONS)) throw new Error("Invalid mutable dimensions");
  if (!exactSet(forbidden, FORBIDDEN_CAPABILITIES)) throw new Error("Invalid forbidden capabilities");
  if (vocabulary.length !== EVIDENCE_STATUSES.size || vocabulary.some((item) => !EVIDENCE_STATUSES.has(item as SliceEvidenceStatus)) || EVIDENCE_STATUSES.size !== new Set(vocabulary).size) throw new Error("Invalid evidence vocabulary");
  if (!isRecord(value.closure) || value.closure.machineGateRequired !== true || value.closure.humanGateRequired !== true || value.closure.blockedRequiredEvidenceMayClose !== false) throw new Error("Invalid closure configuration");
  if (typeof value.slice !== "string" || typeof value.deliverable !== "string" || typeof value.projectId !== "string" || typeof value.sourceVideoId !== "string" || typeof value.semanticStatementId !== "string" || typeof value.semanticAnchor !== "string" || typeof value.headline !== "string" || typeof value.publisher !== "string" || typeof value.visualSpine !== "string") throw new Error("Invalid slice contract identity");
  if (!isRecord(value.referencePhysicalBounds) || typeof value.referencePhysicalBounds.start !== "number" || typeof value.referencePhysicalBounds.end !== "number") throw new Error("Invalid reference physical bounds");
  if (!isRecord(value.hardInvariants)) throw new Error("Invalid hard invariants");
  if (!isRecord(value.physicalBoundaryPolicy) || value.physicalBoundaryPolicy.correctionAllowed !== true || value.physicalBoundaryPolicy.requiresTrustedAlignment !== true || value.physicalBoundaryPolicy.requiresSemanticStatementPreserved !== true || value.physicalBoundaryPolicy.momentRediscoveryAllowed !== false) throw new Error("Invalid physical boundary policy");
  const hardInvariants = value.hardInvariants;
  const hardKeys = Object.keys(hardInvariants);
  const expectedKeys = Object.keys(HARD_INVARIANTS);
  if (hardKeys.length !== expectedKeys.length || hardKeys.some((key) => !expectedKeys.includes(key))) throw new Error("Invalid hard invariant keys");
  for (const key of expectedKeys) if (hardInvariants[key] !== HARD_INVARIANTS[key as keyof typeof HARD_INVARIANTS]) throw new Error(`Invalid hard invariant value: ${key}`);
  return value as unknown as SliceContract;
}

export function loadSliceContract(slice: string): SliceContract {
  const normalized = slice.toLowerCase().replace(/^s/, "");
  const contractPath = path.join(CONTRACT_DIR, `s${normalized}.json`);
  return validateSliceContractObject(JSON.parse(fs.readFileSync(contractPath, "utf8")));
}

export function validateSliceExecution(contract: SliceContract, evidence: SliceExecutionEvidence): SliceValidationResult {
  const checks: SliceCheck[] = [];
  const check = (id: string, status: SliceEvidenceStatus, message: string) => checks.push({ id, status, message });
  const physicalChanged = !equalTime(evidence.physicalStatementStart, contract.referencePhysicalBounds.start) || !equalTime(evidence.physicalStatementEnd, contract.referencePhysicalBounds.end);
  const immutablePass = evidence.projectId === contract.projectId && evidence.sourceVideoId === contract.sourceVideoId && evidence.semanticStatementId === contract.semanticStatementId && evidence.semanticAnchor === contract.semanticAnchor && evidence.headline === contract.headline && evidence.publisher === contract.publisher && evidence.visualSpine === contract.visualSpine;
  check("immutable_identity", immutablePass ? "PASS" : "FAIL", immutablePass ? "Frozen S2 identity matches" : "Frozen S2 identity changed");
  check("moment_rediscovery", evidence.momentRediscoveryCalls === 0 ? "PASS" : "FAIL", `momentRediscoveryCalls=${evidence.momentRediscoveryCalls}`);
  check("headline_regeneration", evidence.headlineGenerationCalls === 0 ? "PASS" : "FAIL", `headlineGenerationCalls=${evidence.headlineGenerationCalls}`);
  check("cc_physical_cut_truth", evidence.ccTimingUsedForPhysicalCuts ? "FAIL" : "PASS", `ccTimingUsedForPhysicalCuts=${evidence.ccTimingUsedForPhysicalCuts}`);
  check("physical_boundary_authorization", physicalChanged && (evidence.trustedAudioAlignmentStatus !== "PASS" || !evidence.semanticStatementPreserved) ? "FAIL" : "PASS", physicalChanged ? "Physical correction authorization checked" : "Reference physical bounds retained");
  const unsafeFiller = evidence.fillerFlagsUsedForPhysicalCuts && evidence.trustedAudioAlignmentStatus !== "PASS";
  check("filler_physical_cut_truth", unsafeFiller ? "FAIL" : "PASS", unsafeFiller ? "Filler flags used without trusted alignment" : "Filler cut rule satisfied");
  check("trusted_audio_alignment", evidence.trustedAudioAlignmentStatus, `trustedAudioAlignmentStatus=${evidence.trustedAudioAlignmentStatus}`);
  for (const [id, used] of [["bgm", evidence.bgmUsed], ["sfx", evidence.sfxUsed], ["broll", evidence.brollUsed], ["hyperframes", evidence.hyperframesUsed], ["visual_redesign", evidence.visualRedesignUsed], ["thumbnail_redesign", evidence.thumbnailRedesignUsed], ["next_slice", evidence.nextSliceWorkStarted]] as const) check(id, used ? "FAIL" : "PASS", `${id}Used=${used}`);
  if (evidence.sourceMayChange) check("source_unchanged", "FAIL", "sourceMayChange=true");
  else check("source_unchanged", "PASS", "Source unchanged");
  check("machine_gate", evidence.machineGateStatus === "PASS" ? "PASS" : evidence.machineGateStatus === "FAIL" ? "FAIL" : "BLOCKED", `machineGateStatus=${evidence.machineGateStatus}`);
  check("human_gate", evidence.humanGateStatus === "PASS" ? "PASS" : evidence.humanGateStatus === "FAIL" ? "FAIL" : "NOT_APPLICABLE", `humanGateStatus=${evidence.humanGateStatus}`);
  const hardInvariantFailed = checks.some((item) => item.status === "FAIL");
  const humanReviewAllowed = !hardInvariantFailed;
  const closureAllowed = !hardInvariantFailed && evidence.machineGateStatus === "PASS" && evidence.humanGateStatus === "PASS" && evidence.trustedAudioAlignmentStatus === "PASS";
  return { slice: contract.slice, checks, hardInvariantFailed, humanReviewAllowed, closureAllowed };
}
