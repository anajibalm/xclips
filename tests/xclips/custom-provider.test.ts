import { describe, expect, it } from "bun:test";
import { CustomProviderSchema, XclipsAiSettingsSchema } from "@/lib/xclips/types";
import { xclipsService } from "@/lib/xclips.service";

const base = {
  id: "router", name: "Router", baseUrl: "https://example.test/v1",
  apiKey: "redacted-test-key", plannerModel: "model-1",
};

describe("custom provider contract", () => {
  it("accepts OpenAI-compatible provider", () => {
    expect(CustomProviderSchema.parse({ ...base, protocol: "openai-compatible" }).protocol).toBe("openai-compatible");
  });

  it("accepts Claude-compatible provider and optional future model slots", () => {
    const provider = CustomProviderSchema.parse({ ...base, protocol: "claude-compatible", visionModel: "vision-1", imageModel: "image-1" });
    expect(provider.protocol).toBe("claude-compatible");
    expect(provider.imageModel).toBe("image-1");
  });

  it("rejects vendor-specific protocol values", () => {
    expect(() => CustomProviderSchema.parse({ ...base, protocol: "openrouter" })).toThrow();
  });

  it("resolves active custom provider by ID in settings schema", () => {
    const settings = XclipsAiSettingsSchema.parse({ customProviders: [{ ...base, protocol: "openai-compatible" }], activeCustomProviderId: "router" });
    expect(settings.customProviders.find((provider) => provider.id === settings.activeCustomProviderId)?.plannerModel).toBe("model-1");
  });

  it("client-safe settings never expose custom API key", () => {
    const original = xclipsService.getAiSettings;
    xclipsService.getAiSettings = (() => XclipsAiSettingsSchema.parse({ customProviders: [{ ...base, protocol: "openai-compatible" }], activeCustomProviderId: "router" })) as typeof xclipsService.getAiSettings;
    try {
      const safe = xclipsService.getClientSafeAiSettings();
      expect(safe.customProviders[0].apiKey).toBe("");
      expect(safe.customProviders[0].apiKeyConfigured).toBe(true);
      expect(JSON.stringify(safe)).not.toContain("redacted-test-key");
    } finally {
      xclipsService.getAiSettings = original;
    }
  });

  it("dispatches custom OpenAI-compatible planner request", async () => {
    const settings = XclipsAiSettingsSchema.parse({ customProviders: [{ ...base, protocol: "openai-compatible" }], activeCustomProviderId: "router" });
    const originalSettings = xclipsService.getAiSettings;
    const originalFetch = globalThis.fetch;
    let request: Request | undefined;
    xclipsService.getAiSettings = (() => settings) as typeof xclipsService.getAiSettings;
    globalThis.fetch = (async (input, init) => { request = new Request(input, init); return new Response(JSON.stringify({ choices: [{ message: { content: '{"highlights":[]}' } }] }), { status: 200 }); }) as typeof fetch;
    try {
      const result = await xclipsService.discoverHighlights("proj_1788801264816_1ogi", { topicPrompt: "test", maxClipsCount: 1 });
      expect(result.success).toBe(false);
    } finally { xclipsService.getAiSettings = originalSettings; globalThis.fetch = originalFetch; }
    expect(request?.url).toBe("https://example.test/v1/chat/completions");
    expect(request?.headers.get("authorization")).toBe("Bearer redacted-test-key");
    expect((await request?.json()).model).toBe("model-1");
  });

  it("dispatches custom Claude-compatible planner request", async () => {
    const settings = XclipsAiSettingsSchema.parse({ customProviders: [{ ...base, id: "claude", protocol: "claude-compatible", baseUrl: "https://claude.example.test/v1", plannerModel: "claude-test" }], activeCustomProviderId: "claude" });
    const originalSettings = xclipsService.getAiSettings;
    const originalFetch = globalThis.fetch;
    let request: Request | undefined;
    xclipsService.getAiSettings = (() => settings) as typeof xclipsService.getAiSettings;
    globalThis.fetch = (async (input, init) => { request = new Request(input, init); return new Response(JSON.stringify({ content: [{ text: '{"highlights":[]}' }] }), { status: 200 }); }) as typeof fetch;
    try { await xclipsService.discoverHighlights("proj_1788801264816_1ogi", { topicPrompt: "test", maxClipsCount: 1 }); }
    finally { xclipsService.getAiSettings = originalSettings; globalThis.fetch = originalFetch; }
    expect(request?.url).toBe("https://claude.example.test/v1/messages");
    expect(request?.headers.get("x-api-key")).toBe("redacted-test-key");
    expect(request?.headers.get("anthropic-version")).toBe("2023-06-01");
    expect((await request?.json()).model).toBe("claude-test");
  });
});
