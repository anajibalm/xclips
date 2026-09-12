import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  buildPublishReviewPackage,
  validatePublishPackageInput,
  type PublishPackageInput,
} from "@/lib/xclips/publish-package-builder";

const exec = promisify(execFile);

const baseInput = (root: string): PublishPackageInput => ({
  outputDir: join(root, "package"),
  finalVideoPath: join(root, "final.mp4"),
  thumbnailPath: join(root, "thumbnail.png"),
  thumbnailEvidence: {
    provider: "template-guideline",
    generatorRepo: "template-guideline",
    generatorCommit: "fixture-commit",
    generatorCommand: "npm run generate:thumbnail -- --input <request.json> --output <thumbnail.png>",
    model: "gpt-image-2.5-sunburst",
    generationStatus: "GENERATED",
    promptSha256: "fixture-prompt",
    requestedSize: "1008x1344",
    finalDimensions: "1080x1440",
    inputImages: [{ filename: "subject.jpg", role: "subject", sha256: "fixture-subject" }, { filename: "reference.png", role: "reference", sha256: "fixture-reference" }],
    outputSha256: "fixture-output",
  },
  thumbnailManifestPath: join(root, "thumbnail-generation-manifest.json"),
  source: {
    videoId: "source-1",
    url: "https://example.test/source-1",
    publisher: "Example Publisher",
    sourceStart: 2,
    sourceEnd: 12,
    sourceFileIdentity: "sha256:source",
  },
  editorialSelection: { headline: "A grounded headline", statement: "A grounded statement." },
  physicalTiming: { sourceStart: 2, sourceEnd: 12, openingDirect: true, endingDirect: true },
  framingPolicy: { mode: "FIELD_FIT_BG", outcome: "WARN", rationale: "Context survives." },
  materialSources: [{
    materialId: "material-1",
    sourceVideoId: "source-1",
    sourceUrl: "https://example.test/source-1",
    publisher: "Example Publisher",
    sourceStart: 20,
    sourceEnd: 22,
    programStart: 4,
    programEnd: 6,
    selectionReason: "Factual cutaway",
    sourceKind: "source-internal",
    sourceFileIdentity: "sha256:source",
  }],
  publication: {
    headline: "A grounded headline",
    sourceCredit: "Example Publisher",
    captionDraft: "Kebakaran lahan gambut di Trans Kalimantan meluas. Petugas berjibaku memadamkan api di sejumlah lokasi. Rekaman ini menunjukkan kondisi lapangan dan upaya penanganan dalam laporan Official iNews. Perkembangan kejadian perlu dilihat bersama keterangan terbaru dari sumber resmi agar konteks lokasi dan waktunya tetap jelas. Informasi ini membantu audiens memahami urutan kejadian tanpa menambahkan detail di luar laporan. Apa perkembangan penanganan berikutnya di lokasi ini?",
    structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"],
  },
  modules: { included: ["V1", "V3", "V10"], omitted: { V5: "identity not grounded" } },
  reviewFlags: { blockers: [], warnings: ["framing WARN"] },
  qc: { dimensions: "PASS", audio: "PASS", framing: "WARN", provenance: "PASS" },
});

describe("publish package builder", () => {
  it("fails closed for missing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "xclips-package-"));
    await writeFile(join(root, "thumbnail.png"), "thumb");
    await expect(buildPublishReviewPackage(baseInput(root))).rejects.toThrow(/final video/i);
  });

  it("rejects malformed provenance", async () => {
    const root = await mkdtemp(join(tmpdir(), "xclips-package-"));
    const input = baseInput(root);
    input.materialSources[0].sourceUrl = "";
    expect(() => validatePublishPackageInput(input)).toThrow(/provenance/i);
  });

  it("rejects absolute and temporary package paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "xclips-package-"));
    const input = baseInput(root);
    input.materialSources[0].sourceFileIdentity = "/tmp/bad-source";
    expect(() => validatePublishPackageInput(input)).toThrow(/sourceFileIdentity/i);
  });

  it("builds valid self-contained package and matching hashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "xclips-package-"));
    const input = baseInput(root);
    await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "1", "-af", "volume=7dB", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", input.finalVideoPath]);
    await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=1080x1440", "-frames:v", "1", input.thumbnailPath]);
    input.thumbnailEvidence.outputSha256 = createHash("sha256").update(await readFile(input.thumbnailPath)).digest("hex");
    await writeFile(input.thumbnailManifestPath, `${JSON.stringify({ generationStatus: "GENERATED", finalDimensions: "1080x1440", outputSha256: input.thumbnailEvidence.outputSha256, model: input.thumbnailEvidence.model, promptSha256: input.thumbnailEvidence.promptSha256 })}\n`);
    const result = await buildPublishReviewPackage(input);
    const manifest = JSON.parse(await readFile(join(result.packageDir, "package-manifest.json"), "utf8"));
    expect(result.status).toBe("PASS");
    expect(manifest.schemaVersion).toBe("xclips.publish-package.v1");
    expect(manifest.files["final.mp4"].sha256).toBe(result.sha256.finalVideo);
    expect(manifest.files["thumbnail.png"].sha256).toBe(result.sha256.thumbnail);
    expect(manifest.files["final.mp4"].path).not.toMatch(/^\//);
    expect(manifest.files["package-manifest.json"]).toBeUndefined();
    expect(manifest.previewTimestamps.opening).toBe(0.5);
    expect(manifest.previewTimestamps.middle).toBeCloseTo(manifest.media.duration / 2, 6);
    expect(manifest.previewTimestamps.closing).toBeCloseTo(manifest.media.duration - 0.5, 6);
  }, 30000);
});
