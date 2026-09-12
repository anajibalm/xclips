import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const SCHEMA_VERSION = "xclips.publish-package.v1";
const PREVIEW_NAMES = ["opening.png", "middle.png", "closing.png"] as const;

export interface MaterialSource {
  materialId: string;
  sourceVideoId: string;
  sourceUrl: string;
  publisher: string;
  sourceStart: number;
  sourceEnd: number;
  programStart: number;
  programEnd: number;
  selectionReason: string;
  sourceKind: "source-internal" | "external";
  sourceFileIdentity: string;
  uploadDate?: string;
}

export interface PublishPackageInput {
  outputDir: string;
  finalVideoPath: string;
  thumbnailPath: string;
  thumbnailEvidence: {
    provider: string;
    protocol: string;
    model: string;
    generationStatus: "GENERATED";
    promptSha256: string;
    requestedSize: "1008x1344";
    rawDimensions: string;
    finalDimensions: "1080x1440";
    transform: string;
    inputImages: Array<{ filename: string; role: "subject" | "reference"; sha256: string }>;
    outputSha256: string;
  };
  thumbnailManifestPath: string;
  source: {
    videoId: string;
    url: string;
    publisher: string;
    uploadDate?: string;
    sourceStart: number;
    sourceEnd: number;
    sourceFileIdentity: string;
  };
  editorialSelection: { headline: string; statement: string };
  physicalTiming: Record<string, unknown>;
  framingPolicy: Record<string, unknown>;
  materialSources: MaterialSource[];
  publication: {
    headline: string;
    sourceCredit: string;
    captionDraft: string;
    structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"];
  };
  modules: { included: string[]; omitted: Record<string, string> };
  reviewFlags: { blockers: string[]; warnings: string[] };
  qc?: Record<string, unknown>;
}

export function validatePublishPackageInput(input: PublishPackageInput): void {
  if (!input.outputDir.trim()) throw new Error("outputDir missing");
  for (const [name, value] of [["final video", input.finalVideoPath], ["thumbnail", input.thumbnailPath]] as const) {
    if (!value || !value.trim()) throw new Error(`${name} path missing`);
  }
  if (!input.editorialSelection.headline.trim()) throw new Error("headline missing");
  if (!input.publication.captionDraft.trim()) throw new Error("publication caption missing");
  if (!input.thumbnailEvidence?.provider || !input.thumbnailEvidence.protocol || !input.thumbnailEvidence.model || input.thumbnailEvidence.generationStatus !== "GENERATED" || !input.thumbnailEvidence.promptSha256 || input.thumbnailEvidence.requestedSize !== "1008x1344" || input.thumbnailEvidence.rawDimensions !== "1008x1344" || input.thumbnailEvidence.finalDimensions !== "1080x1440" || !input.thumbnailEvidence.transform || !input.thumbnailEvidence.inputImages.length || !input.thumbnailEvidence.outputSha256) throw new Error("generative thumbnail evidence missing");
  if (Object.values(input.thumbnailEvidence).some((value) => typeof value === "string" && /(?:^|[/\\])(home|tmp|vault|artifacts)(?:[/\\]|$)/i.test(value))) throw new Error("thumbnail evidence path must be portable");
  const words = input.publication.captionDraft.trim().split(/\s+/).length;
  if (words < 50 || words > 120) throw new Error(`publication caption must contain 50-120 words, got ${words}`);
  if (input.publication.structure.join("→") !== "HOOK→CONTEXT→RELEVANCE→QUESTION") throw new Error("publication structure invalid");
  if (/paket ini|provenance|review|editor/i.test(input.publication.captionDraft)) throw new Error("publication caption contains internal review language");
  const serialized = JSON.stringify({ source: input.source, physicalTiming: input.physicalTiming, framingPolicy: input.framingPolicy, thumbnailEvidence: input.thumbnailEvidence });
  if (/(?:^|["'])\/(?:home|tmp|vault|artifacts)(?:\/|["'])/i.test(serialized)) throw new Error("input evidence paths must be portable");
  for (const material of input.materialSources) {
    for (const [key, value] of Object.entries(material)) {
      if (typeof value === "string" && !value.trim()) throw new Error(`provenance ${material.materialId}.${key} missing`);
    }
    if (!(material.sourceEnd > material.sourceStart) || !(material.programEnd > material.programStart)) throw new Error(`provenance ${material.materialId} interval invalid`);
    if (material.sourceFileIdentity.startsWith("/") || /[/\\]tmp[/\\]/i.test(material.sourceFileIdentity)) throw new Error(`provenance ${material.materialId}.sourceFileIdentity must be portable`);
  }
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function nonEmpty(filePath: string, label: string): Promise<void> {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile() || info.size === 0) throw new Error(`${label} missing or empty`);
}

interface ProbeResult {
  streams: Array<Record<string, string>>;
  duration: number;
}

async function probeVideo(filePath: string): Promise<ProbeResult> {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,sample_rate,channels,duration", "-of", "json", filePath]);
  const result = JSON.parse(stdout) as { streams?: Array<Record<string, string>>; format?: { duration?: string } };
  const streams = result.streams ?? [];
  const streamDuration = Math.max(...streams.map((stream) => Number(stream.duration) || 0), 0);
  return { streams, duration: Number(result.format?.duration) || streamDuration };
}

async function measureQc(finalPath: string, thumbPath: string, input: PublishPackageInput): Promise<Record<string, unknown>> {
  const { streams } = await probeVideo(finalPath);
  const video = streams.find((s) => s.codec_type === "video") ?? {};
  const audio = streams.find((s) => s.codec_type === "audio") ?? {};
  const loudText = (await exec("ffmpeg", ["-hide_banner", "-nostats", "-i", finalPath, "-af", "loudnorm=print_format=json", "-f", "null", "-"])).stderr;
  const jsonStart = loudText.indexOf("{");
  const loud = jsonStart >= 0 ? JSON.parse(loudText.slice(jsonStart, loudText.lastIndexOf("}") + 1)) : {};
  const image = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", thumbPath])).stdout).streams?.[0] ?? {};
  const videoDuration = Number(video.duration);
  const audioDuration = Number(audio.duration);
  const check = (status: "PASS" | "WARN" | "FAIL", measured: unknown, expected: unknown, evidence: string) => ({ status, measured, expected, evidence });
  const checks: Record<string, unknown> = {
    codec: check(video.codec_name === "h264" && audio.codec_name === "aac" ? "PASS" : "FAIL", { video: video.codec_name, audio: audio.codec_name }, "H264/AAC", "ffprobe"),
    dimensions: check(Number(video.width) === 1080 && Number(video.height) === 1920 ? "PASS" : "FAIL", `${video.width}x${video.height}`, "1080x1920", "ffprobe"),
    cfr: check(video.r_frame_rate === "30/1" && video.avg_frame_rate === "30/1" ? "PASS" : "FAIL", { r: video.r_frame_rate, avg: video.avg_frame_rate }, "30/1", "ffprobe"),
    avDuration: check(Math.abs(videoDuration - audioDuration) <= 1 / 30 + 0.005 ? "PASS" : "FAIL", { videoDuration, audioDuration, diff: Math.abs(videoDuration - audioDuration) }, "<= 1 frame", "ffprobe"),
    loudness: check(Number(loud.input_i) >= -15 && Number(loud.input_i) <= -13 && Number(loud.input_tp) <= -1 ? "PASS" : "FAIL", { integratedLUFS: Number(loud.input_i), truePeakDbTP: Number(loud.input_tp) }, "I [-15,-13], TP <= -1", "ffmpeg loudnorm"),
    thumbnail: check(image.codec_name === "png" && Number(image.width) === 1080 && Number(image.height) === 1440 ? "PASS" : "FAIL", { mime: "image/png", width: image.width, height: image.height }, "PNG 1080x1440", "ffprobe"),
    provenance: check(input.materialSources.length > 0 && input.materialSources.every((m) => m.sourceFileIdentity && m.sourceUrl && m.selectionReason) ? "PASS" : "FAIL", input.materialSources.length, ">=1 complete material", "input validation"),
  };
  const status = Object.values(checks).some((x) => (x as { status: string }).status === "FAIL") ? "BLOCKED" : "PASS";
  return { status, checks, sourceSha256: input.source.sourceFileIdentity };
}

async function preview(filePath: string, outputPath: string, timestamp: number): Promise<void> {
  await exec("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.max(0, timestamp)), "-i", filePath, "-frames:v", "1", outputPath]);
}

function packageRelative(filePath: string, packageDir: string): string {
  const value = relative(packageDir, filePath);
  if (!value || value.startsWith("..") || value.startsWith("/")) throw new Error(`package path escapes package: ${value}`);
  return value;
}

export async function buildPublishReviewPackage(input: PublishPackageInput, options: { extractPreviews?: boolean } = {}): Promise<{ packageDir: string; sha256: { finalVideo: string; thumbnail: string }; status: "PASS" | "BLOCKED" }> {
  validatePublishPackageInput(input);
  await nonEmpty(input.finalVideoPath, "final video");
  await nonEmpty(input.thumbnailPath, "thumbnail");
  await nonEmpty(input.thumbnailManifestPath, "thumbnail generation manifest");
  const packageDir = input.outputDir;
  await mkdir(join(packageDir, "preview"), { recursive: true });
  const finalPath = join(packageDir, "final.mp4");
  const thumbPath = join(packageDir, "thumbnail.png");
  await copyFile(input.finalVideoPath, finalPath);
  await copyFile(input.thumbnailPath, thumbPath);
  let generationManifest: Record<string, unknown> = {};
  try { generationManifest = JSON.parse(await readFile(input.thumbnailManifestPath, "utf8")) as Record<string, unknown>; } catch { generationManifest = { generationStatus: "BLOCKED", error: "generation manifest malformed" }; }
  const media = await probeVideo(finalPath);
  if (options.extractPreviews !== false) {
    const timestamps = [0.5, media.duration / 2, Math.max(0, media.duration - 0.5)];
    for (const [name, timestamp] of PREVIEW_NAMES.map((name, index) => [name, timestamps[index]] as const)) await preview(finalPath, join(packageDir, "preview", name), timestamp);
  } else {
    for (const name of PREVIEW_NAMES) await writeFile(join(packageDir, "preview", name), "preview-disabled-test");
  }
  let measuredQc = await measureQc(finalPath, thumbPath, input);
  const generatedThumbnailHash = await sha256(thumbPath);
  const generationValid = generationManifest.generationStatus === "GENERATED" && generationManifest.finalDimensions === "1080x1440" && generationManifest.outputSha256 === generatedThumbnailHash;
  if (!generationValid) measuredQc = { ...measuredQc, status: "BLOCKED", generation: { status: "FAIL", expected: "GENERATED manifest with matching 1080x1440 outputSha256", measured: generationManifest.generationStatus ?? "MALFORMED" } };
  const jsonFiles: Record<string, unknown> = {
    "editorial-selection.json": input.editorialSelection,
    "physical-timing.json": input.physicalTiming,
    "framing-policy.json": input.framingPolicy,
    "material-sources.json": { materials: input.materialSources },
    "qc.json": measuredQc,
    "publication.json": input.publication,
    "modules.json": input.modules,
    "review-flags.json": input.reviewFlags,
    "generation-manifest.json": generationManifest,
  };
  for (const [name, data] of Object.entries(jsonFiles)) await writeFile(join(packageDir, name), `${JSON.stringify(data, null, 2)}\n`);
  const finalHash = await sha256(finalPath);
  const thumbnailHash = await sha256(thumbPath);
  const files: Record<string, { path: string; sha256: string; bytes: number }> = {};
  for (const name of ["final.mp4", "thumbnail.png", ...Object.keys(jsonFiles), ...PREVIEW_NAMES.map((name) => `preview/${name}`)]) {
    const filePath = join(packageDir, name);
    await nonEmpty(filePath, name);
    files[name] = { path: packageRelative(filePath, packageDir), sha256: await sha256(filePath), bytes: (await stat(filePath)).size };
  }
  const manifest = { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), files, media, thumbnailEvidence: input.thumbnailEvidence, previewTimestamps: { opening: 0.5, middle: media.duration / 2, closing: Math.max(0, media.duration - 0.5) }, source: input.source, status: measuredQc.status === "PASS" ? "READY_FOR_HUMAN_REVIEW" : "BLOCKED" };
  await writeFile(join(packageDir, "package-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { packageDir, sha256: { finalVideo: finalHash, thumbnail: thumbnailHash }, status: measuredQc.status === "PASS" ? "PASS" : "BLOCKED" };
}
