import { describe, expect, it } from "bun:test";
import { CustomProviderSchema, XclipsAiSettingsSchema } from "@/lib/xclips/types";

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
});
