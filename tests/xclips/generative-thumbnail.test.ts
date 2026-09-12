import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateGenerativeThumbnail, type GenerativeThumbnailInput, type ProcessRunner } from "@/lib/xclips/generative-thumbnail";

const exec = promisify(execFile);

async function fixture(): Promise<GenerativeThumbnailInput & { root: string }> {
  const root = await mkdtemp(join(tmpdir(), "xclips-thumbnail-integration-"));
  const video = join(root, "source.mp4");
  await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=30", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
  const reference = join(root, "reference.png");
  await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=white:s=120x120", "-frames:v", "1", reference]);
  return { root, sourceVideoPath: video, sourceStillTimestamp: 0.2, title: "Grounded title", sourceCredit: "Source", outputDir: join(root, "out"), referenceImages: [reference], generatorRepo: "template-guideline", generatorCommit: "fixture-commit" };
}

const hash = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");

function runnerFor(mode: "success" | "fail" | "missing-output" | "missing-manifest" | "malformed" | "hash" | "dimensions" | "contract"): ProcessRunner {
  return async (command, args) => {
    if (command === "ffprobe") return (await exec(command, args)) as { stdout: string; stderr: string };
    if (mode === "fail") throw new Error("child process failed");
    const output = args[args.indexOf("--output") + 1];
    const manifestPath = `${output}.generation-manifest.json`;
    if (mode !== "missing-output") await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=black:s=${mode === "dimensions" ? "100x100" : "1080x1440"}`, "-frames:v", "1", output]);
    if (mode === "missing-output") return { stdout: "", stderr: "" };
    if (mode === "missing-manifest") return { stdout: "", stderr: "" };
    if (mode === "malformed") { await writeFile(manifestPath, "{"); return { stdout: "", stderr: "" }; }
    await writeFile(manifestPath, JSON.stringify({ generationStatus: "GENERATED", requestedSize: mode === "contract" ? "1024x1536" : "1008x1344", finalDimensions: mode === "contract" ? "1024x1536" : "1080x1440", outputSha256: mode === "hash" ? "wrong" : await hash(output), model: "gpt-image-2.5-sunburst", promptSha256: "prompt" }));
    return { stdout: "", stderr: "" };
  };
}

describe("generative S5 thumbnail integration", () => {
  it("accepts generated PNG and manifest", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("success") }); expect(result.success).toBe(true); });
  it("blocks child process failure", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("fail") }); expect(result).toEqual({ success: false, error: expect.stringContaining("BLOCKED_GENERATOR") }); });
  it("blocks API key response from child", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: async () => { throw new Error("BLOCKED_API_KEY"); } }); expect(result).toEqual({ success: false, error: "BLOCKED_API_KEY" }); });
  it("blocks missing output", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("missing-output") }); expect(result).toEqual({ success: false, error: "BLOCKED_GENERATOR: output or manifest missing" }); });
  it("blocks missing or malformed manifest", async () => { const input = await fixture(); expect(await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("missing-manifest") })).toEqual({ success: false, error: "BLOCKED_GENERATOR: output or manifest missing" }); expect(await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("malformed") })).toEqual({ success: false, error: "BLOCKED_GENERATOR: manifest malformed" }); });
  it("blocks hash mismatch", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("hash") }); expect(result).toEqual({ success: false, error: "BLOCKED_GENERATOR: output hash mismatch" }); });
  it("blocks invalid dimensions", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("dimensions") }); expect(result).toEqual({ success: false, error: "BLOCKED_GENERATOR: thumbnail dimensions must be 1080x1440" }); });
  it("blocks invalid manifest size contract", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: runnerFor("contract") }); expect(result).toEqual({ success: false, error: "BLOCKED_GENERATOR: manifest contract invalid" }); });
  it("blocks any missing reference", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, referenceImages: [join(input.root, "missing.png")], processRunner: async () => { throw new Error("runner must not run"); } }); expect(result).toEqual({ success: false, error: "BLOCKED_REFERENCE_ASSETS" }); });
  it("blocks missing generator config", async () => { const input = await fixture(); const old = process.env.TEMPLATE_GUIDELINE_REPO; delete process.env.TEMPLATE_GUIDELINE_REPO; const result = await generateGenerativeThumbnail({ ...input, generatorRepo: undefined }); expect(result).toEqual({ success: false, error: "BLOCKED_GENERATOR_CONFIG" }); if (old) process.env.TEMPLATE_GUIDELINE_REPO = old; });
  it("does not leave output for blocked key", async () => { const input = await fixture(); const result = await generateGenerativeThumbnail({ ...input, processRunner: async () => { throw new Error("BLOCKED_API_KEY"); } }); expect(result.success).toBe(false); expect((await stat(join(input.outputDir, "thumbnail.png")).catch(() => null))?.isFile()).not.toBe(true); });
});
