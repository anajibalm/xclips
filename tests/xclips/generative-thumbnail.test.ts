import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildThumbnailPrompt, createOpenAIImageProvider, generateGenerativeThumbnail, type ThumbnailImageProvider } from "@/lib/xclips/generative-thumbnail";
import type { AiProviderConfig } from "@/lib/xclips/ai-provider-registry";

const exec = promisify(execFile);
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "xclips-thumb-"));
  const video = join(root, "source.mp4");
  await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=30", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
  const reference = join(root, "reference.png");
  await exec("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=white:s=200x200", "-frames:v", "1", reference]);
  return { root, video, reference };
}

async function pngBytes(width: number, height: number): Promise<Uint8Array> {
  const outputPath = join(tmpdir(), `thumb-bytes-${width}x${height}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  await exec("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}`, "-frames:v", "1", outputPath]);
  return readFile(outputPath);
}

function withEnv(key: string, value: string | undefined, fn: () => Promise<void>): Promise<void>;
function withEnv(key: string, value: string | undefined, fn: () => void): void;
function withEnv(key: string, value: string | undefined, fn: () => unknown): unknown {
  const old = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return (fn as () => unknown)();
  } finally {
    if (old === undefined) delete process.env[key];
    else process.env[key] = old;
  }
}

const successProvider = (model = "gpt-image-2.5-sunburst"): ThumbnailImageProvider => ({
  async generate() {
    const bytes = await pngBytes(1008, 1344);
    return { success: true, data: { bytes, mimeType: "image/png", model, usage: { test: 1 } } };
  },
});

async function providerPngBytes(): Promise<Uint8Array> {
  return pngBytes(1008, 1344);
}

const baseInput = (root: string, video: string, refs: string[] = [], provider?: ThumbnailImageProvider) => ({
  sourceVideoPath: video,
  sourceStillTimestamp: 0.2,
  title: "Grounded title",
  sourceCredit: "Source",
  outputDir: join(root, "out"),
  referenceImages: refs,
  ...(provider ? { provider } : {}),
});

describe("internal generative thumbnail", () => {
  it("builds grounded prompt with conditional reference rule", () => {
    const withRefs = buildThumbnailPrompt({ title: "Exact title", notes: "none", style: { name: "paper brutalism", accentColors: ["navy blue", "crimson red"] }, referenceImages: ["reference.png"] });
    expect(withRefs).toContain("Exact title");
    expect(withRefs).toContain("paper brutalism");
    expect(withRefs).toContain("maximum 3 lines");
    expect(withRefs).toContain("image 2 through final");
    expect(withRefs).toContain("STYLE references");
    const withoutRefs = buildThumbnailPrompt({ title: "Exact title", notes: "none", style: { name: "paper brutalism", accentColors: ["navy blue", "crimson red"] }, referenceImages: [] });
    expect(withoutRefs).toContain("Exact title");
    expect(withoutRefs).toContain("maximum 3 lines");
    expect(withoutRefs).not.toContain("image 2 through final");
  });

  it("accepts custom provider models without vendor allowlist", async () => {
    const f = await fixture();
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        ...baseInput(f.root, f.video, [], successProvider()),
        model: "acme-painter-v9",
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.evidence.model).toBe("acme-painter-v9");
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("generates PNG with matching manifest hashes and transform", async () => {
    const f = await fixture();
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      const result = await generateGenerativeThumbnail(baseInput(f.root, f.video, [f.reference], successProvider()));
      expect(result.success).toBe(true);
      if (!result.success) return;
      const probe = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", result.data.thumbnailPath])).stdout) as { streams?: Array<{ width?: number; height?: number }> };
      expect(probe.streams?.[0]?.width).toBe(1080);
      expect(probe.streams?.[0]?.height).toBe(1440);
      const manifest = JSON.parse(await readFile(result.data.manifestPath, "utf8")) as Record<string, unknown>;
      expect(manifest.requestedSize).toBe("1008x1344");
      expect(manifest.rawDimensions).toBe("1008x1344");
      expect(manifest.finalDimensions).toBe("1080x1440");
      expect(String(manifest.transform)).toContain("scale=1080:1440");
      expect(String(manifest.transform)).toContain("crop=1080:1440");
      const outputBytes = await readFile(result.data.thumbnailPath);
      expect(manifest.outputSha256).toBe(sha256(outputBytes));
      expect(typeof manifest.promptSha256).toBe("string");
      expect((manifest.promptSha256 as string).length).toBeGreaterThan(0);
      const evidence = result.data.evidence;
      expect(evidence.model).toBe("gpt-image-2.5-sunburst");
      expect(evidence.outputSha256).toBe(sha256(outputBytes));
      const subjectEntry = evidence.inputImages.find((entry) => entry.role === "subject");
      const referenceEntry = evidence.inputImages.find((entry) => entry.role === "reference");
      expect(subjectEntry?.filename).toBe("subject-frame.jpg");
      expect(referenceEntry?.filename).toBe("reference.png");
      const serialized = JSON.stringify({ manifest, evidence });
      expect(serialized).not.toContain("template-guideline");
      expect(serialized).not.toContain("generatorRepo");
      expect(serialized).not.toContain("generatorCommit");
      expect(serialized).not.toContain("npm run generate");
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("verifies prompt, subject, reference, and output hashes against actual files", async () => {
    const f = await fixture();
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      const result = await generateGenerativeThumbnail(baseInput(f.root, f.video, [f.reference], successProvider()));
      expect(result.success).toBe(true);
      if (!result.success) return;
      const manifest = JSON.parse(await readFile(result.data.manifestPath, "utf8")) as {
        promptSha256: string; outputSha256: string;
        subjectImage: { sha256: string }; referenceImages: Array<{ sha256: string }>;
      };
      const request = JSON.parse(await readFile(result.data.requestPath, "utf8")) as { title: string };
      expect(request.title).toBe("Grounded title");
      const expectedPrompt = buildThumbnailPrompt({ title: "Grounded title", notes: "", style: { name: "paper brutalism", accentColors: ["navy blue", "crimson red"] }, referenceImages: [f.reference] });
      expect(manifest.promptSha256).toBe(sha256(Buffer.from(expectedPrompt)));
      const subjectBytes = await readFile(join(f.root, "out", "subject-frame.jpg"));
      expect(manifest.subjectImage.sha256).toBe(sha256(subjectBytes));
      const referenceBytes = await readFile(f.reference);
      expect(manifest.referenceImages[0].sha256).toBe(sha256(referenceBytes));
      const outputBytes = await readFile(result.data.thumbnailPath);
      expect(manifest.outputSha256).toBe(sha256(outputBytes));
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("supports zero references by default and blocks them when required", async () => {
    const f = await fixture();
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      expect((await generateGenerativeThumbnail(baseInput(f.root, f.video, [], successProvider()))).success).toBe(true);
      expect(await generateGenerativeThumbnail({ ...baseInput(f.root, f.video, [], successProvider()), referencesRequired: true })).toEqual({ success: false, error: "BLOCKED_REFERENCE_ASSETS" });
      expect(await generateGenerativeThumbnail(baseInput(f.root, f.video, [join(f.root, "missing.png")], successProvider()))).toEqual({ success: false, error: "BLOCKED_REFERENCE_ASSETS" });
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("blocks empty model before any provider work", async () => {
    const f = await fixture();
    let providerCalls = 0;
    const counting: ThumbnailImageProvider = { async generate() { providerCalls += 1; return successProvider().generate({} as never); } };
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      expect(await generateGenerativeThumbnail({ ...baseInput(f.root, f.video, [], counting), model: "   " })).toEqual({ success: false, error: "BLOCKED_MODEL_CONFIG" });
      expect(providerCalls).toBe(0);
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("proves endpoint, multipart fields, and image order without paid call", async () => {
    const imageBytes = await pngBytes(1008, 1344);
    const calls: Array<{ url: string; method: string; fields: Record<string, string>; files: string[] }> = [];
    const fetchImpl = (async (url: unknown, init?: { method?: string; body?: unknown }) => {
      const form = init?.body as FormData;
      const files = (form.getAll("image[]") as File[]).map((file) => file.name);
      calls.push({
        url: String(url),
        method: init?.method ?? "",
        fields: {
          model: String(form.get("model") ?? ""),
          prompt: String(form.get("prompt") ?? ""),
          size: String(form.get("size") ?? ""),
          quality: String(form.get("quality") ?? ""),
          output_format: String(form.get("output_format") ?? ""),
        },
        files,
      });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(imageBytes).toString("base64") }], usage: { test: 1 } }), { status: 200 });
    }) as typeof fetch;
    const provider = createOpenAIImageProvider({ fetchImpl, getSettings: () => ({ provider: "openai", apiKey: "", apiKeys: { openai: "test-key" } }) });
    const subject = { filename: "subject-frame.jpg", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" };
    const references = [
      { filename: "ref-a.png", bytes: new Uint8Array([4]), mimeType: "image/png" },
      { filename: "ref-b.png", bytes: new Uint8Array([5]), mimeType: "image/png" },
    ];
    const result = await provider.generate({ title: "Exact title", subject, references, prompt: "Exact title prompt", model: "gpt-image-2.5-sunburst" });
    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.openai.com/v1/images/edits");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].fields.model).toBe("gpt-image-2.5-sunburst");
    expect(calls[0].fields.model).not.toContain("gemini");
    expect(calls[0].fields.size).toBe("1008x1344");
    expect(calls[0].fields.quality).toBe("high");
    expect(calls[0].fields.output_format).toBe("png");
    expect(calls[0].fields.prompt).toBe("Exact title prompt");
    expect(calls[0].files).toEqual(["subject-frame.jpg", "ref-a.png", "ref-b.png"]);
  });

  it("stops empty models before fetch", async () => {
    let fetchCalls = 0;
    const fetchImpl = (async () => { fetchCalls += 1; throw new Error("must not fetch"); }) as typeof fetch;
    const provider = createOpenAIImageProvider({ fetchImpl, getSettings: () => ({ provider: "openai", apiKey: "", apiKeys: { openai: "test-key" } }) });
    const result = await withEnv("OPENAI_API_KEY", "test-key", async () =>
      provider.generate({ title: "t", subject: { filename: "s.jpg", bytes: new Uint8Array([1]), mimeType: "image/jpeg" }, references: [], prompt: "p", model: "   " }),
    );
    expect(result).toEqual({ success: false, error: "BLOCKED_MODEL_CONFIG" });
    expect(fetchCalls).toBe(0);
  });

  it("blocks malformed provider responses without throwing", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch;
    const provider = createOpenAIImageProvider({ fetchImpl, getSettings: () => ({ provider: "openai", apiKey: "", apiKeys: { openai: "test-key" } }) });
    const result = await withEnv("OPENAI_API_KEY", "test-key", async () =>
      provider.generate({ title: "t", subject: { filename: "s.jpg", bytes: new Uint8Array([1]), mimeType: "image/jpeg" }, references: [], prompt: "p", model: "gpt-image-2.5-sunburst" }),
    );
    expect(result.success).toBe(false);
  });

  it("blocks unsupported reference mime as structured input error", async () => {
    const f = await fixture();
    const badRef = join(f.root, "note.txt");
    await writeFile(badRef, "not an image");
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      expect(await generateGenerativeThumbnail(baseInput(f.root, f.video, [badRef], successProvider()))).toEqual({ success: false, error: expect.stringContaining("BLOCKED_INPUT") });
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("blocks invalid raw dimensions from provider", async () => {
    const f = await fixture();
    const small: ThumbnailImageProvider = {
      async generate() {
        const bytes = await pngBytes(100, 100);
        return { success: true, data: { bytes, mimeType: "image/png", model: "gpt-image-2.5-sunburst" } };
      },
    };
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      expect(await generateGenerativeThumbnail(baseInput(f.root, f.video, [], small))).toEqual({ success: false, error: "BLOCKED_PROVIDER: invalid raw dimensions" });
    } finally {
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);
});

describe("custom provider routing", () => {
  const customProvider: AiProviderConfig = {
    id: "acme",
    label: "Acme Images",
    protocol: "openai-compatible",
    baseUrl: "https://img.acme.test",
    apiKeyEnv: "TEST_ACME_IMAGE_KEY",
    capabilities: ["image-edit"],
    models: [],
    imageEndpoint: "/v1/img/edits",
    defaultModel: "acme-painter-v9",
  };

  async function routedFixture() {
    const f = await fixture();
    const imageBytes = await pngBytes(1008, 1344);
    return { ...f, imageBytes };
  }

  function mockFetchOk(imageBytes: Uint8Array, calls: Array<{ url: string; method: string; auth: string; fields: Record<string, string>; files: string[] }>) {
    return (async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
      const form = init?.body as FormData;
      calls.push({
        url: String(url),
        method: init?.method ?? "",
        auth: String(init?.headers?.["Authorization"] ?? ""),
        fields: {
          model: String(form.get("model") ?? ""),
          prompt: String(form.get("prompt") ?? ""),
          size: String(form.get("size") ?? ""),
          quality: String(form.get("quality") ?? ""),
          output_format: String(form.get("output_format") ?? ""),
        },
        files: (form.getAll("image[]") as File[]).map((file) => file.name),
      });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(imageBytes).toString("base64") }], usage: { test: 1 } }), { status: 200 });
    }) as typeof fetch;
  }

  it("uses custom baseUrl and passes custom model without vendor allowlist", async () => {
    const f = await routedFixture();
    const calls: Array<{ url: string; method: string; auth: string; fields: Record<string, string>; files: string[] }> = [];
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_ACME_IMAGE_KEY = "acme-secret-value";
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [f.reference],
        providerId: "acme",
        model: "acme-painter-v9",
        providers: [customProvider],
        fetchImpl: mockFetchOk(f.imageBytes, calls),
      });
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://img.acme.test/v1/img/edits");
      expect(calls[0].method).toBe("POST");
      expect(calls[0].fields.model).toBe("acme-painter-v9");
      expect(calls[0].files).toEqual(["subject-frame.jpg", "reference.png"]);
      expect(sha256(Buffer.from(calls[0].auth))).toBe(sha256(Buffer.from("Bearer acme-secret-value")));
      if (!result.success) return;
      const manifest = JSON.parse(await readFile(result.data.manifestPath, "utf8")) as Record<string, unknown>;
      expect(manifest.providerId).toBe("acme");
      expect(manifest.protocol).toBe("openai-compatible");
      expect(manifest.model).toBe("acme-painter-v9");
      expect(JSON.stringify(manifest)).not.toContain("acme-secret-value");
      expect(result.data.evidence.provider).toBe("acme");
      expect(result.data.evidence.protocol).toBe("openai-compatible");
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("reads custom apiKeyEnv and blocks missing key before fetch", async () => {
    const f = await routedFixture();
    const calls: Array<unknown> = [];
    const fetchImpl = (async () => { calls.push(1); throw new Error("must not fetch"); }) as typeof fetch;
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    delete process.env.TEST_ACME_IMAGE_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "acme",
        model: "acme-painter-v9",
        providers: [customProvider],
        fetchImpl,
      });
      expect(result).toEqual({ success: false, error: "BLOCKED_API_KEY" });
      expect(calls).toHaveLength(0);
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("blocks providers without image capability before fetch", async () => {
    const f = await routedFixture();
    const calls: Array<unknown> = [];
    const fetchImpl = (async () => { calls.push(1); throw new Error("must not fetch"); }) as typeof fetch;
    const textOnly: AiProviderConfig = { ...customProvider, id: "textual", capabilities: ["text"] };
    const oldKey = process.env.TEST_TEXT_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_TEXT_KEY = "text-key";
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "textual",
        model: "text-model",
        providers: [{ ...textOnly, apiKeyEnv: "TEST_TEXT_KEY" }],
        fetchImpl,
      });
      expect(result).toEqual({ success: false, error: "BLOCKED_PROVIDER_CAPABILITY" });
      expect(calls).toHaveLength(0);
    } finally {
      if (oldKey === undefined) delete process.env.TEST_TEXT_KEY;
      else process.env.TEST_TEXT_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("blocks unknown protocols before fetch", async () => {
    const f = await routedFixture();
    const calls: Array<unknown> = [];
    const fetchImpl = (async () => { calls.push(1); throw new Error("must not fetch"); }) as typeof fetch;
    const weird = { ...customProvider, id: "weird", protocol: "carrier-pigeon" };
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_ACME_IMAGE_KEY = "acme-secret-value";
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "weird",
        model: "weird-model",
        providers: [weird as unknown as AiProviderConfig],
        fetchImpl,
      });
      expect(result).toEqual({ success: false, error: "BLOCKED_PROVIDER_CONFIG: unsupported protocol" });
      expect(calls).toHaveLength(0);
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("routes built-in OpenAI through the same registry contract", async () => {
    const f = await routedFixture();
    const calls: Array<{ url: string; auth: string }> = [];
    const fetchImpl = (async (url: unknown, init?: { headers?: Record<string, string> }) => {
      calls.push({ url: String(url), auth: String(init?.headers?.["Authorization"] ?? "") });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(f.imageBytes).toString("base64") }] }), { status: 200 });
    }) as typeof fetch;
    const oldKey = process.env.OPENAI_API_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_API_KEY = "openai-test-key";
    delete process.env.OPENAI_IMAGE_MODEL;
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        fetchImpl,
      });
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://api.openai.com/v1/images/edits");
      expect(calls[0].auth).not.toBe("");
      if (!result.success) return;
      expect(result.data.evidence.provider).toBe("openai");
      expect(result.data.evidence.protocol).toBe("openai-images");
    } finally {
      if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("isolates custom provider from OPENAI_IMAGE_MODEL via provider defaultModel", async () => {
    const f = await routedFixture();
    const calls: Array<{ fields: Record<string, string> }> = [];
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      const form = init?.body as FormData;
      calls.push({ fields: { model: String(form.get("model") ?? "") } });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(f.imageBytes).toString("base64") }] }), { status: 200 });
    }) as typeof fetch;
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_ACME_IMAGE_KEY = "acme-secret-value";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "acme",
        providers: [customProvider],
        fetchImpl,
      });
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].fields.model).toBe("acme-painter-v9");
      if (!result.success) return;
      expect(result.data.evidence.provider).toBe("acme");
      expect(result.data.evidence.model).toBe("acme-painter-v9");
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("blocks custom provider without explicit or default model before fetch", async () => {
    const f = await routedFixture();
    const calls: Array<unknown> = [];
    const fetchImpl = (async () => { calls.push(1); throw new Error("must not fetch"); }) as typeof fetch;
    const bare: AiProviderConfig = { ...customProvider, id: "bare", defaultModel: undefined };
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_ACME_IMAGE_KEY = "acme-secret-value";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "bare",
        providers: [bare],
        fetchImpl,
      });
      expect(result).toEqual({ success: false, error: "BLOCKED_MODEL_CONFIG" });
      expect(calls).toHaveLength(0);
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("prefers explicit input.model over custom provider defaultModel", async () => {
    const f = await routedFixture();
    const calls: Array<{ fields: Record<string, string> }> = [];
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      const form = init?.body as FormData;
      calls.push({ fields: { model: String(form.get("model") ?? "") } });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(f.imageBytes).toString("base64") }] }), { status: 200 });
    }) as typeof fetch;
    const oldKey = process.env.TEST_ACME_IMAGE_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.TEST_ACME_IMAGE_KEY = "acme-secret-value";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        providerId: "acme",
        model: "acme-custom-override-v1",
        providers: [customProvider],
        fetchImpl,
      });
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].fields.model).toBe("acme-custom-override-v1");
      if (!result.success) return;
      expect(result.data.evidence.model).toBe("acme-custom-override-v1");
    } finally {
      if (oldKey === undefined) delete process.env.TEST_ACME_IMAGE_KEY;
      else process.env.TEST_ACME_IMAGE_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);

  it("keeps OPENAI_IMAGE_MODEL override for built-in OpenAI", async () => {
    const f = await routedFixture();
    const calls: Array<{ fields: Record<string, string> }> = [];
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      const form = init?.body as FormData;
      calls.push({ fields: { model: String(form.get("model") ?? "") } });
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(f.imageBytes).toString("base64") }] }), { status: 200 });
    }) as typeof fetch;
    const oldKey = process.env.OPENAI_API_KEY;
    const oldModel = process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.5-flare";
    try {
      const result = await generateGenerativeThumbnail({
        sourceVideoPath: f.video,
        sourceStillTimestamp: 0.2,
        title: "Grounded title",
        sourceCredit: "Source",
        outputDir: join(f.root, "out"),
        referenceImages: [],
        fetchImpl,
      });
      expect(result.success).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].fields.model).toBe("gpt-image-2.5-flare");
      if (!result.success) return;
      expect(result.data.evidence.provider).toBe("openai");
      expect(result.data.evidence.model).toBe("gpt-image-2.5-flare");
    } finally {
      if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
      else process.env.OPENAI_IMAGE_MODEL = oldModel;
    }
  }, 30000);
});
