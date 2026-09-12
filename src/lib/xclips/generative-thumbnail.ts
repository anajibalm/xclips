import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extractThumbnailSubjectFrame } from "@/lib/xclips/thumbnail-subject-frame";
import type { Result } from "@/lib/xclips/types";

export interface ProcessRunner {
  (command: string, args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }>;
}

const defaultProcessRunner: ProcessRunner = async (command, args, options) => {
  const result = await promisify(execFile)(command, args, options);
  return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

export interface GenerativeThumbnailInput {
  sourceVideoPath: string;
  sourceStillTimestamp: number;
  title: string;
  sourceCredit: string;
  outputDir: string;
  referenceImages: string[];
  notes?: string;
  style?: { name: string; accentColors: string[] };
  generatorRepo?: string;
  generatorCommit?: string;
  processRunner?: ProcessRunner;
}

export interface GenerativeThumbnailResult {
  thumbnailPath: string;
  manifestPath: string;
  requestPath: string;
  evidence: {
    provider: "template-guideline";
    generatorRepo: string;
    generatorCommit: string;
    generatorCommand: string;
    model: string;
    generationStatus: "GENERATED";
    promptSha256: string;
    requestedSize: "1008x1344";
    finalDimensions: "1080x1440";
    inputImages: Array<{ filename: string; role: "subject" | "reference"; sha256: string }>;
    outputSha256: string;
  };
}

async function exists(path: string): Promise<boolean> { return (await stat(path).catch(() => null))?.isFile() === true; }
async function sha256(path: string): Promise<string> { return createHash("sha256").update(await readFile(path)).digest("hex"); }

export async function generateGenerativeThumbnail(input: GenerativeThumbnailInput): Promise<Result<GenerativeThumbnailResult>> {
  if (!input.title.trim()) return { success: false, error: "BLOCKED_INVALID_INPUT: title missing" };
  if (!input.referenceImages.length) return { success: false, error: "BLOCKED_REFERENCE_ASSETS" };
  if (!await exists(input.sourceVideoPath)) return { success: false, error: "BLOCKED_SUBJECT_SOURCE" };
  const referenceChecks = await Promise.all(input.referenceImages.map((path) => exists(path)));
  if (referenceChecks.some((exists) => !exists)) return { success: false, error: "BLOCKED_REFERENCE_ASSETS" };
  const generatorRepo = input.generatorRepo ?? process.env.TEMPLATE_GUIDELINE_REPO;
  if (!generatorRepo) return { success: false, error: "BLOCKED_GENERATOR_CONFIG" };
  const generatorCommit = input.generatorCommit?.trim();
  if (!generatorCommit) return { success: false, error: "BLOCKED_GENERATOR_CONFIG" };
  const requestPath = join(input.outputDir, "thumbnail-input.json");
  const thumbnailPath = join(input.outputDir, "thumbnail.png");
  const manifestPath = `${thumbnailPath}.generation-manifest.json`;
  await mkdir(input.outputDir, { recursive: true });
  const subject = await extractThumbnailSubjectFrame({ sourceVideoPath: input.sourceVideoPath, outputDir: input.outputDir, timestampSec: input.sourceStillTimestamp });
  if (!subject.success) return { success: false, error: `BLOCKED_SUBJECT_SOURCE: ${subject.error}` };
  const request = {
    title: input.title,
    subjectImages: [{ path: subject.data, label: "raw source subject" }],
    referenceImages: input.referenceImages,
    notes: input.notes ?? "",
    style: input.style ?? { name: "editorial", accentColors: ["navy blue", "gold"] },
    aspectRatio: "3:4",
    sourceCredit: input.sourceCredit,
  };
  await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const processRunner = input.processRunner ?? defaultProcessRunner;
  try {
    await processRunner("npm", ["run", "generate:thumbnail", "--", "--input", requestPath, "--output", thumbnailPath], { cwd: generatorRepo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BLOCKED_API_KEY")) return { success: false, error: "BLOCKED_API_KEY" };
    return { success: false, error: `BLOCKED_GENERATOR: ${message}` };
  }
  if (!await exists(thumbnailPath) || !await exists(manifestPath)) return { success: false, error: "BLOCKED_GENERATOR: output or manifest missing" };
  let manifest: Record<string, unknown>;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>; } catch { return { success: false, error: "BLOCKED_GENERATOR: manifest malformed" }; }
  if (manifest.generationStatus !== "GENERATED" || manifest.requestedSize !== "1008x1344" || manifest.finalDimensions !== "1080x1440" || typeof manifest.model !== "string" || !manifest.model.trim() || typeof manifest.promptSha256 !== "string" || !manifest.promptSha256.trim()) return { success: false, error: "BLOCKED_GENERATOR: manifest contract invalid" };
  const probe = JSON.parse((await processRunner("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", thumbnailPath])).stdout) as { streams?: Array<{ width?: number; height?: number }> };
  const dimensions = probe.streams?.[0];
  if (dimensions?.width !== 1080 || dimensions.height !== 1440) return { success: false, error: "BLOCKED_GENERATOR: thumbnail dimensions must be 1080x1440" };
  if (manifest.outputSha256 !== await sha256(thumbnailPath)) return { success: false, error: "BLOCKED_GENERATOR: output hash mismatch" };
  const inputImages = [{ filename: basename(subject.data), role: "subject" as const, sha256: await sha256(subject.data) }, ...await Promise.all(input.referenceImages.map(async (path) => ({ filename: basename(path), role: "reference" as const, sha256: await sha256(path) })) )];
  return { success: true, data: { thumbnailPath, manifestPath, requestPath, evidence: { provider: "template-guideline", generatorRepo: "template-guideline", generatorCommit, generatorCommand: "npm run generate:thumbnail -- --input <request.json> --output <thumbnail.png>", model: manifest.model, generationStatus: "GENERATED", promptSha256: manifest.promptSha256, requestedSize: manifest.requestedSize, finalDimensions: manifest.finalDimensions, inputImages, outputSha256: await sha256(thumbnailPath) } } };
}
