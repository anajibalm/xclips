import { describe, it, expect } from "bun:test";
import {
  chunkTranscript,
  buildHighlightPrompt,
  reduceAndRankHighlights,
  CandidateHighlight,
} from "@/lib/xclips/transcript-chunker";
import { WordTimestamp } from "@/lib/xclips/types";

describe("xclips - Transcript Chunker & Highlight Reducer", () => {
  it("should chunk long transcripts into 15-minute segments with overlap", () => {
    // Generate synthetic words spanning 35 minutes (2100 seconds)
    const mockWords: WordTimestamp[] = [];
    for (let t = 0; t < 2100; t += 2) {
      mockWords.push({
        word: `token_${t}`,
        start: t,
        end: t + 1.5,
        confidence: 0.99,
      });
    }

    const chunks = chunkTranscript(mockWords, 900, 30);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Chunk 0 should start at 0
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(900);

    // Chunk 1 should start at 900 - 30 = 870
    expect(chunks[1].startSec).toBe(870);
  });

  it("should deduplicate and rank candidate highlights by viral score", () => {
    const rawHighlights: CandidateHighlight[] = [
      {
        title: "Klip 1 (Bagus)",
        hookText: "Hook 1",
        viralScore: 95,
        startSec: 10.0,
        endSec: 55.0,
        durationSec: 45,
        summary: "Summary 1",
      },
      {
        title: "Klip 2 (Overlap dengan Klip 1)",
        hookText: "Hook 2",
        viralScore: 80,
        startSec: 15.0,
        endSec: 60.0,
        durationSec: 45,
        summary: "Summary 2",
      },
      {
        title: "Klip 3 (Segmen Berbeda)",
        hookText: "Hook 3",
        viralScore: 90,
        startSec: 120.0,
        endSec: 170.0,
        durationSec: 50,
        summary: "Summary 3",
      },
    ];

    const ranked = reduceAndRankHighlights(rawHighlights, 5);

    expect(ranked.length).toBe(2); // Klip 2 was dropped due to >40% overlap with Klip 1
    expect(ranked[0].viralScore).toBe(95);
    expect(ranked[1].viralScore).toBe(90);
    expect(ranked[0].title).toBe("Klip 1 (Bagus)");
    expect(ranked[1].title).toBe("Klip 3 (Segmen Berbeda)");
  });

  it("should build prompt with custom topic instruction and strict boundary rules", () => {
    const chunk = {
      chunkIndex: 0,
      startSec: 0,
      endSec: 120,
      text: "Halo teman-teman ini transkrip strategi trading.",
      words: [],
    };

    const prompt = buildHighlightPrompt(chunk, {
      topicPrompt: "Strategi risk management trading kripto",
      targetDuration: "short",
      strictBoundary: true,
    });

    expect(prompt).toContain("Strategi risk management trading kripto");
    expect(prompt).toContain("STRICT NARRATIVE BOUNDARY");
    expect(prompt).toContain("target duration 30-45 seconds");
    expect(prompt).toContain("LANGUAGE REQUIREMENT (CRITICAL)");

    // Test explicit Indonesian language
    const promptId = buildHighlightPrompt(chunk, {
      outputLanguage: "id",
    });
    expect(promptId).toContain("BAHASA INDONESIA");

    // Test explicit Spanish language
    const promptEs = buildHighlightPrompt(chunk, {
      outputLanguage: "es",
    });
    expect(promptEs).toContain("Spanish");
  });

  it("should return static models (gemini-3-6-flash, gemini-3-7-flash, gpt-5-6-terra) for kieai provider", async () => {
    const { xclipsService } = await import("@/lib/xclips.service");
    const res = await xclipsService.fetchAvailableModels(
      "kieai",
      "https://api.kie.ai/gemini-3-6-flash-openai/v1",
      "test-api-key"
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("gemini-3-6-flash");
      expect(res.data).toContain("gemini-3-7-flash");
      expect(res.data).toContain("gpt-5-6-terra");
    }
  });

  it("should return static models including gpt-transcribe, gpt-5.6-luna, gpt-image-2 for openai provider", async () => {
    const { xclipsService } = await import("@/lib/xclips.service");
    const res = await xclipsService.fetchAvailableModels(
      "openai",
      "https://api.openai.com/v1",
      "test-api-key"
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("gpt-transcribe");
      expect(res.data).toContain("gpt-5.6-luna");
      expect(res.data).toContain("gpt-image-2");
      expect(res.data).toContain("gpt-4o-transcribe");
      expect(res.data).toContain("gpt-4o-mini-transcribe");
      expect(res.data).toContain("whisper-1");
    }
  });

  it("should return static 4 models (claude-sonnet-5, claude-opus-5, claude-sonnet-4-6, claude-opus-4-8) for anthropic provider", async () => {
    const { xclipsService } = await import("@/lib/xclips.service");
    const res = await xclipsService.fetchAvailableModels(
      "anthropic",
      "https://api.anthropic.com/v1",
      "test-api-key"
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual([
        "claude-sonnet-5",
        "claude-opus-5",
        "claude-sonnet-4-6",
        "claude-opus-4-8",
      ]);
    }
  });

  it("should return static models (gemini-3.5-transcribe, gemini-3.7-flash, gemini-3.1-pro-preview, gemini-3.6-flash) for gemini provider", async () => {
    const { xclipsService } = await import("@/lib/xclips.service");
    const res = await xclipsService.fetchAvailableModels("gemini", "https://generativelanguage.googleapis.com", "");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual([
        "gemini-3.5-transcribe",
        "gemini-3.7-flash",
        "gemini-3.1-pro-preview",
        "gemini-3.6-flash",
      ]);
    }
  });

  it("should isolate and persist individual API keys per provider", async () => {
    const { xclipsService } = await import("@/lib/xclips.service");
    // Save KIE AI key
    const saveKie = xclipsService.saveAiSettings({
      provider: "kieai",
      apiKey: "sk-kie-test-123",
      apiKeys: {
        kieai: "sk-kie-test-123",
        gemini: "",
        openai: "",
        anthropic: "",
        openai_compatible: "",
      },
    });
    expect(saveKie.success).toBe(true);

    // Save OpenAI key
    const saveOpenAi = xclipsService.saveAiSettings({
      provider: "openai",
      apiKey: "sk-openai-test-456",
    });
    expect(saveOpenAi.success).toBe(true);

    const current = xclipsService.getAiSettings();
    expect(current.apiKeys.kieai).toBe("sk-kie-test-123");
    expect(current.apiKeys.openai).toBe("sk-openai-test-456");
    expect(current.provider).toBe("openai");
    expect(current.apiKey).toBe("sk-openai-test-456");
  });

  it("should build prompt with Hook Matrix formulas and extended (~3 min) target duration", () => {
    const chunk = {
      chunkIndex: 0,
      startSec: 0,
      endSec: 300,
      text: "Katanya makan gratis itu asal kenyang. Padahal semuanya dihitung ahli gizi.",
      words: [],
    };

    const promptMythBuster = buildHighlightPrompt(chunk, {
      hookFormula: "01_myth_buster",
      targetDuration: "extended",
      strictBoundary: true,
    });

    expect(promptMythBuster).toContain("MYTH BUSTER");
    expect(promptMythBuster).toContain("target duration 120-180 seconds");
    expect(promptMythBuster).toContain("STRICT NARRATIVE BOUNDARY");

    const promptRipple = buildHighlightPrompt(chunk, {
      hookFormula: "15_ripple_effect",
      targetDuration: "standard",
    });

    expect(promptRipple).toContain("RIPPLE EFFECT");
    expect(promptRipple).toContain("target duration 45-75 seconds");
  });

  it("should keep extended duration highlights (up to 180s/210s) in reduceAndRankHighlights", () => {
    const rawHighlights: CandidateHighlight[] = [
      {
        title: "Extended 3 Min Highlight",
        hookText: "Hook 3 Min",
        viralScore: 98,
        startSec: 10.0,
        endSec: 185.0,
        durationSec: 175,
        summary: "Summary 3 min",
      },
    ];

    const ranked = reduceAndRankHighlights(rawHighlights, 5);
    expect(ranked.length).toBe(1);
    expect(ranked[0].durationSec).toBe(175);
  });

  it("should expose Requesty light models constant and synthesize topic prompts with fallback", async () => {
    const { REQUESTY_LIGHT_MODELS } = await import("@/lib/xclips/types");
    expect(REQUESTY_LIGHT_MODELS.length).toBe(3);
    expect(REQUESTY_LIGHT_MODELS.map((m) => m.id)).toEqual([
      "muse-glimmer-30b",
      "gemma-4-31b-it",
      "gpt-5.6-luna",
    ]);

    const { xclipsService } = await import("@/lib/xclips.service");

    // Test with mock AI success response
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "Focus on viral hook strategies, audience psychology, and editing blueprints.",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );

      const res = await xclipsService.detectNarrativeTopic({
        title: "How to Build High-Converting Short-Form Videos [abc12345678].mp4",
        transcriptText: "Today we will break down hook psychology, retention graphs, and audio framing secrets.",
        lightModel: "muse-glimmer-30b",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.topicPrompt).toBe("Focus on viral hook strategies, audience psychology, and editing blueprints.");
        expect(res.data.modelUsed).toBe("muse-glimmer-30b");
      }

      // Test fallback when AI endpoint returns error
      globalThis.fetch = async () => new Response("Internal error", { status: 500 });
      const resFallback = await xclipsService.detectNarrativeTopic({
        title: "Crypto Trading Masterclass.mp4",
        transcriptText: "Risk management is the key to longevity.",
        lightModel: "gemma-4-31b-it",
      });

      expect(resFallback.success).toBe(true);
      if (resFallback.success) {
        expect(resFallback.data.topicPrompt).toContain("Crypto Trading Masterclass");
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
