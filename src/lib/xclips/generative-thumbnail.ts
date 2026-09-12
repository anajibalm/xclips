import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extractThumbnailSubjectFrame } from "@/lib/xclips/thumbnail-subject-frame";
import { xclipsService } from "@/lib/xclips.service";
import {
  BUILT_IN_OPENAI_PROVIDER,
  buildImageEditsUrl,
  defaultProviderRegistry,
  findProvider,
  readProviderApiKey,
  type AiProviderConfig,
} from "@/lib/xclips/ai-provider-registry";
import type { Result } from "@/lib/xclips/types";

const exec = promisify(execFile);
const REQUESTED_SIZE = "1008x1344" as const;
const FINAL_DIMENSIONS = "1080x1440" as const;
const TRANSFORM = "scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440" as const;
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";

export interface ThumbnailImageProviderInput {
  title: string;
  subject: { filename: string; bytes: Uint8Array; mimeType: string };
  references: Array<{ filename: string; bytes: Uint8Array; mimeType: string }>;
  prompt: string;
  model: string;
}

export interface ThumbnailImageProviderOutput {
  bytes: Uint8Array;
  mimeType: string;
  model: string;
  usage?: unknown;
}

export interface ThumbnailImageProvider {
  generate(input: ThumbnailImageProviderInput): Promise<Result<ThumbnailImageProviderOutput>>;
}

export interface GenerativeThumbnailInput {
  sourceVideoPath: string;
  sourceStillTimestamp: number;
  title: string;
  sourceCredit: string;
  outputDir: string;
  referenceImages: string[];
  referencesRequired?: boolean;
  notes?: string;
  style?: { name: string; accentColors: string[] };
  providerId?: string;
  model?: string;
  providers?: AiProviderConfig[];
  provider?: ThumbnailImageProvider;
  fetchImpl?: typeof fetch;
}

export interface GenerativeThumbnailResult {
  thumbnailPath: string;
  manifestPath: string;
  requestPath: string;
  evidence: {
    provider: string;
    protocol: string;
    model: string;
    generationStatus: "GENERATED";
    promptSha256: string;
    requestedSize: typeof REQUESTED_SIZE;
    rawDimensions: string;
    finalDimensions: typeof FINAL_DIMENSIONS;
    transform: string;
    inputImages: Array<{ filename: string; role: "subject" | "reference"; sha256: string }>;
    outputSha256: string;
  };
}

function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
async function fileSha256(path: string): Promise<string> { return sha256(await readFile(path)); }
async function exists(path: string): Promise<boolean> { return (await stat(path).catch(() => null))?.isFile() === true; }
function mimeType(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  throw new Error(`unsupported image format: ${path}`);
}

export function buildThumbnailPrompt(input: Pick<GenerativeThumbnailInput, "title" | "notes" | "style" | "referenceImages">): string {
  const style = input.style ?? { name: "paper brutalism", accentColors: ["navy blue", "crimson red"] };
  return [
    "Generate one full-bleed editorial thumbnail for a public information story.",
    `Title, preserve verbatim with no spelling changes or added words: "${input.title}".`,
    "Use image 1 as subject/content source. Preserve subject identity and recognizable facial characteristics.",
    ...(input.referenceImages?.length ? ["Use image 2 through final image only as STYLE references. Never copy their people, names, text, logos, or event identity."] : ["No reference images supplied; follow the textual style direction only."]),
    "Add only supporting illustration grounded in the title and subject source.",
    "Render title in a bold readable panel, vertically centered and proportionally balanced, maximum 3 lines.",
    "No empty black area, nested video frame, TV chyron, ticker, QR code, fake logo, watermark, or font name.",
    `Style direction: ${style.name}. Accent colors: ${style.accentColors.join(", ")}.`,
    `Notes: ${input.notes || "none"}.`,
    "Final composition must be exactly 3:4 portrait, normalized to 1080x1440.",
  ].join("\n");
}

async function postImageEdit(options: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  subject: ThumbnailImageProviderInput["subject"];
  references: ThumbnailImageProviderInput["references"];
  fetchImpl: typeof fetch;
}): Promise<Result<ThumbnailImageProviderOutput>> {
  const form = new FormData();
  form.append("model", options.model);
  form.append("prompt", options.prompt);
  form.append("size", REQUESTED_SIZE);
  form.append("quality", "high");
  form.append("output_format", "png");
  for (const file of [options.subject, ...options.references]) {
    form.append("image[]", new File([Buffer.from(file.bytes)], file.filename, { type: file.mimeType }));
  }
  let response: Response;
  try {
    response = await options.fetchImpl(options.url, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}` }, body: form });
  } catch (error) {
    return { success: false, error: `BLOCKED_PROVIDER: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) return { success: false, error: response.status === 400 || response.status === 422 ? "BLOCKED_UNSUPPORTED_SIZE" : `BLOCKED_PROVIDER: ${response.status}` };
  let payload: { data?: Array<{ b64_json?: string }>; usage?: unknown };
  try {
    payload = await response.json() as { data?: Array<{ b64_json?: string }>; usage?: unknown };
  } catch {
    return { success: false, error: "BLOCKED_PROVIDER: malformed response" };
  }
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded || typeof encoded !== "string") return { success: false, error: "BLOCKED_PROVIDER: no image response" };
  let bytes: Uint8Array;
  try {
    bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0) return { success: false, error: "BLOCKED_PROVIDER: empty image response" };
  } catch {
    return { success: false, error: "BLOCKED_PROVIDER: malformed base64" };
  }
  return { success: true, data: { bytes, mimeType: "image/png", model: options.model, usage: payload.usage } };
}

export interface OpenAIImageProviderOptions {
  fetchImpl?: typeof fetch;
  getSettings?: () => { apiKeys?: { openai?: string }; provider?: string; apiKey?: string };
}

/** Backward-compatible built-in provider, routed through the registry contract. */
export function createOpenAIImageProvider(options: OpenAIImageProviderOptions = {}): ThumbnailImageProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const getSettings = options.getSettings ?? (() => xclipsService.getAiSettings());
  return { async generate(input) {
    let key = "";
    try {
      const settings = getSettings() as { apiKeys?: { openai?: string }; provider?: string; apiKey?: string };
      key = process.env.OPENAI_API_KEY || settings?.apiKeys?.openai || (settings?.provider === "openai" ? settings?.apiKey : "") || "";
    } catch {
      key = process.env.OPENAI_API_KEY || "";
    }
    if (!key) return { success: false, error: "BLOCKED_API_KEY" };
    if (!input.model.trim()) return { success: false, error: "BLOCKED_MODEL_CONFIG" };
    const url = buildImageEditsUrl(BUILT_IN_OPENAI_PROVIDER);
    if (!url) return { success: false, error: "BLOCKED_PROVIDER_CONFIG" };
    return postImageEdit({ url, apiKey: key, model: input.model.trim(), prompt: input.prompt, subject: input.subject, references: input.references, fetchImpl });
  } };
}

function defaultProvider(fetchImpl?: typeof fetch): ThumbnailImageProvider {
  return createOpenAIImageProvider(fetchImpl ? { fetchImpl } : {});
}

function isBuiltInOpenAI(provider: AiProviderConfig): boolean {
  return provider.id === BUILT_IN_OPENAI_PROVIDER.id && provider.protocol === "openai-images";
}

/**
 * Provider-scoped model resolution. The provider is resolved FIRST; the
 * model never leaks across providers: OPENAI_IMAGE_MODEL and the legacy
 * xclips thumbnailImageModel apply ONLY to the built-in OpenAI provider.
 */
function resolveTaskModel(input: Pick<GenerativeThumbnailInput, "model">, provider: AiProviderConfig): string | null {
  if (typeof input.model === "string") {
    const explicit = input.model.trim();
    return explicit ? explicit : null;
  }
  if (provider.defaultModel?.trim()) return provider.defaultModel.trim();
  if (isBuiltInOpenAI(provider)) {
    const envOverride = (process.env.OPENAI_IMAGE_MODEL || "").trim();
    if (envOverride) return envOverride;
    let configured = "";
    try {
      configured = xclipsService.getAiSettings().thumbnailImageModel || "";
    } catch {
      configured = "";
    }
    if (configured.trim()) return configured.trim();
    return DEFAULT_OPENAI_IMAGE_MODEL;
  }
  return null;
}

async function generateGenerativeThumbnailInternal(input: GenerativeThumbnailInput): Promise<Result<GenerativeThumbnailResult>> {
  if (!input.title.trim()) return { success: false, error: "BLOCKED_INVALID_INPUT: title missing" };
  if (input.referencesRequired && input.referenceImages.length === 0) return { success: false, error: "BLOCKED_REFERENCE_ASSETS" };
  if (!await exists(input.sourceVideoPath)) return { success: false, error: "BLOCKED_SUBJECT_SOURCE" };
  const referenceChecks = await Promise.all(input.referenceImages.map((path) => exists(path)));
  if (referenceChecks.some((value) => !value)) return { success: false, error: "BLOCKED_REFERENCE_ASSETS" };
  await mkdir(input.outputDir, { recursive: true });
  const subject = await extractThumbnailSubjectFrame({ sourceVideoPath: input.sourceVideoPath, outputDir: input.outputDir, timestampSec: input.sourceStillTimestamp });
  if (!subject.success) return { success: false, error: `BLOCKED_SUBJECT_SOURCE: ${subject.error}` };
  const subjectBytes = await readFile(subject.data);
  const references = await Promise.all(input.referenceImages.map(async (path) => ({ filename: basename(path), bytes: await readFile(path), mimeType: mimeType(path) })));
  const prompt = buildThumbnailPrompt(input);
  const providerId = (input.providerId || "openai").trim() || "openai";
  const providers = input.providers ?? defaultProviderRegistry();
  const provider = findProvider(providers, providerId) ?? (providerId === BUILT_IN_OPENAI_PROVIDER.id ? { ...BUILT_IN_OPENAI_PROVIDER } : undefined);
  if (!provider) return { success: false, error: "BLOCKED_PROVIDER_CONFIG: unknown provider" };
  if (provider.protocol !== "openai-images" && provider.protocol !== "openai-compatible") {
    return { success: false, error: "BLOCKED_PROVIDER_CONFIG: unsupported protocol" };
  }
  if (!provider.capabilities.some((capability) => capability === "image-edit" || capability === "image-generation")) {
    return { success: false, error: "BLOCKED_PROVIDER_CAPABILITY" };
  }
  const url = buildImageEditsUrl(provider);
  if (!url) return { success: false, error: "BLOCKED_PROVIDER_CONFIG: invalid baseUrl or endpoint" };
  const model = resolveTaskModel(input, provider);
  if (!model) return { success: false, error: "BLOCKED_MODEL_CONFIG" };
  const outputPath = join(input.outputDir, "thumbnail.png");
  const manifestPath = join(input.outputDir, "generation-manifest.json");
  const requestPath = join(input.outputDir, "thumbnail-input.json");
  await writeFile(requestPath, `${JSON.stringify({ title: input.title, sourceCredit: input.sourceCredit, notes: input.notes ?? "", style: input.style ?? { name: "paper brutalism", accentColors: ["navy blue", "crimson red"] }, aspectRatio: "3:4", providerId: provider.id, protocol: provider.protocol, model, references: input.referenceImages.map((referencePath) => basename(referencePath)) }, null, 2)}\n`);
  const subjectInput = { filename: basename(subject.data), bytes: subjectBytes, mimeType: mimeType(subject.data) };
  const result = input.provider
    ? await input.provider.generate({ title: input.title, subject: subjectInput, references, prompt, model })
    : await (async () => {
      const apiKey = readProviderApiKey(provider);
      if (!apiKey) return { success: false, error: "BLOCKED_API_KEY" } as Result<ThumbnailImageProviderOutput>;
      return postImageEdit({ url, apiKey, model, prompt, subject: subjectInput, references, fetchImpl: input.fetchImpl ?? fetch });
    })();
  if (!result.success) return result;
  const rawPath = `${outputPath}.raw`;
  try {
    await writeFile(rawPath, result.data.bytes);
    const rawProbe = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", rawPath])).stdout) as { streams?: Array<{ width?: number; height?: number }> };
    const raw = rawProbe.streams?.[0];
    if (raw?.width !== 1008 || raw.height !== 1344) return { success: false, error: "BLOCKED_PROVIDER: invalid raw dimensions" };
    await exec("ffmpeg", ["-y", "-v", "error", "-i", rawPath, "-vf", TRANSFORM, outputPath]);
  } finally { await unlink(rawPath).catch(() => {}); }
  const finalProbe = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", outputPath])).stdout) as { streams?: Array<{ width?: number; height?: number }> };
  if (finalProbe.streams?.[0]?.width !== 1080 || finalProbe.streams?.[0]?.height !== 1440) return { success: false, error: "BLOCKED_PROVIDER: invalid final dimensions" };
  const outputSha256 = await fileSha256(outputPath);
  const rawDimensions = "1008x1344";
  const manifest = { generationStatus: "GENERATED", providerId: provider.id, protocol: provider.protocol, provider: provider.id, model, promptSha256: sha256(Buffer.from(prompt)), requestedSize: REQUESTED_SIZE, rawDimensions, finalDimensions: FINAL_DIMENSIONS, transform: TRANSFORM, subjectImage: { filename: basename(subject.data), role: "subject" as const, sha256: sha256(subjectBytes) }, referenceImages: references.map((reference) => ({ filename: reference.filename, role: "reference" as const, sha256: sha256(reference.bytes) })), outputSha256, usage: result.data.usage ?? null };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { success: true, data: { thumbnailPath: outputPath, manifestPath, requestPath, evidence: { provider: provider.id, protocol: provider.protocol, model, generationStatus: "GENERATED", promptSha256: manifest.promptSha256, requestedSize: REQUESTED_SIZE, rawDimensions, finalDimensions: FINAL_DIMENSIONS, transform: manifest.transform, inputImages: [manifest.subjectImage, ...manifest.referenceImages], outputSha256 } } };
}

export async function generateGenerativeThumbnail(input: GenerativeThumbnailInput): Promise<Result<GenerativeThumbnailResult>> {
  try { return await generateGenerativeThumbnailInternal(input); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message.includes("unsupported image format") ? `BLOCKED_INPUT: ${message}` : `BLOCKED_PROVIDER: ${message}` };
  }
}
