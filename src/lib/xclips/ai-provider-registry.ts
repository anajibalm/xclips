import type { Result } from "@/lib/xclips/types";

// ============================================================
// AI Provider Registry — reusable capability routing contract.
// Thumbnail uses it today; transcription/editorial/voice-over can
// adopt the same contract later without changing this file's shape.
// No secrets are stored here — only the env var NAME (apiKeyEnv).
// ============================================================

export type AiCapability =
  | "text"
  | "transcription"
  | "image-generation"
  | "image-edit"
  | "speech";

export type AiProviderProtocol = "openai-images" | "openai-compatible";

export interface AiProviderConfig {
  id: string;
  label: string;
  protocol: AiProviderProtocol;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities: AiCapability[];
  models: string[];
  /** Only meaningful for protocol "openai-compatible". Defaults to "/v1/images/edits". */
  imageEndpoint?: string;
  /** Provider-scoped default model used when the task sets no explicit model. */
  defaultModel?: string;
}

export interface ThumbnailTaskConfig {
  providerId: string;
  model: string;
}

export const IMAGE_EDIT_CAPABILITIES: AiCapability[] = ["image-edit", "image-generation"];

/**
 * Built-in default. It goes through the same registry resolution as any
 * custom provider — there is no hidden special-case branch for it.
 * This is the ONLY place allowed to hardcode the OpenAI endpoint.
 */
export const BUILT_IN_OPENAI_PROVIDER: AiProviderConfig = {
  id: "openai",
  label: "OpenAI",
  protocol: "openai-images",
  baseUrl: "https://api.openai.com",
  apiKeyEnv: "OPENAI_API_KEY",
  capabilities: ["text", "transcription", "image-generation", "image-edit", "speech"],
  models: [],
};

export function defaultProviderRegistry(): AiProviderConfig[] {
  return [{ ...BUILT_IN_OPENAI_PROVIDER, capabilities: [...BUILT_IN_OPENAI_PROVIDER.capabilities], models: [...BUILT_IN_OPENAI_PROVIDER.models] }];
}

export function findProvider(providers: AiProviderConfig[], providerId: string): AiProviderConfig | undefined {
  return providers.find((provider) => provider.id === providerId);
}

/** Reads the secret from process.env by NAME. Never logs or returns it except to the caller. */
export function readProviderApiKey(provider: AiProviderConfig, env: NodeJS.ProcessEnv = process.env): string {
  if (!provider.apiKeyEnv) return "";
  return env[provider.apiKeyEnv] || "";
}

function normalizeBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Endpoint contract per protocol. Returns null when the protocol is unknown. */
export function buildImageEditsUrl(provider: AiProviderConfig): string | null {
  const base = normalizeBaseUrl(provider.baseUrl);
  if (!base) return null;
  if (provider.protocol === "openai-images") return `${base}/v1/images/edits`;
  if (provider.protocol === "openai-compatible") {
    const endpoint = provider.imageEndpoint ?? "/v1/images/edits";
    if (!endpoint.startsWith("/")) return null;
    return `${base}${endpoint}`;
  }
  return null;
}

export interface ResolvedImageProvider {
  provider: AiProviderConfig;
  apiKey: string;
  model: string;
  url: string;
}

/**
 * Validates, in order: provider exists → protocol known → capability fits →
 * baseUrl valid → apiKey present → model non-empty. Model names are NEVER
 * matched against a vendor allowlist; the provider API is source of truth.
 */
export function resolveImageProvider(options: {
  providers?: AiProviderConfig[];
  providerId?: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
}): Result<ResolvedImageProvider> {
  const providers = options.providers ?? defaultProviderRegistry();
  const providerId = (options.providerId || "openai").trim();
  const provider = findProvider(providers, providerId) ?? (providerId === BUILT_IN_OPENAI_PROVIDER.id ? { ...BUILT_IN_OPENAI_PROVIDER } : undefined);
  if (!provider) return { success: false, error: "BLOCKED_PROVIDER_CONFIG: unknown provider" };
  if (provider.protocol !== "openai-images" && provider.protocol !== "openai-compatible") {
    return { success: false, error: "BLOCKED_PROVIDER_CONFIG: unsupported protocol" };
  }
  if (!provider.capabilities.some((capability) => IMAGE_EDIT_CAPABILITIES.includes(capability))) {
    return { success: false, error: "BLOCKED_PROVIDER_CAPABILITY" };
  }
  const url = buildImageEditsUrl(provider);
  if (!url) return { success: false, error: "BLOCKED_PROVIDER_CONFIG: invalid baseUrl or endpoint" };
  const apiKey = readProviderApiKey(provider, options.env ?? process.env);
  if (!apiKey) return { success: false, error: "BLOCKED_API_KEY" };
  const model = (options.model || "").trim();
  if (!model) return { success: false, error: "BLOCKED_MODEL_CONFIG" };
  return { success: true, data: { provider, apiKey, model, url } };
}
