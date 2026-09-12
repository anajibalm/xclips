import { describe, expect, it } from "bun:test";
import * as trustModule from "@/lib/xclips/production-trust";
import {
  finalizeProductionArtifact,
  isSemanticEvidenceSource,
  isTrustedPhysicalTimeline,
  isTrustedRenderResult,
  isTrustedRendererAuthority,
  markPreviewArtifact,
  requirePhysicalTimeline,
  requireTrustedRenderResult,
  semanticEvidence,
  validateAlignedWords,
  CANONICAL_PHYSICAL_AUTHORITY_AVAILABLE,
  CANONICAL_RENDER_AUTHORITY_AVAILABLE,
  NON_PHYSICAL_TIMING_SOURCES,
  OFFICIAL_BAKOM_RENDERER_AUTHORITY,
  PHYSICAL_TIMING_AUTHORITY,
} from "@/lib/xclips/production-trust";
import { mapCanonicalWordsToAudio, parseWhisperCppWordOutput, type WhisperCppTimedWord } from "@/lib/xclips/audio-alignment";
import type { WordTimestamp } from "@/lib/xclips/types";

function words(pairs: Array<[string, number, number]>): WordTimestamp[] {
  return pairs.map(([word, start, end]) => ({ word, start, end }));
}

function timed(pairs: Array<[string, number, number]>): WhisperCppTimedWord[] {
  return pairs.map(([word, start, end]) => ({ word, start, end }));
}

function canonical(list: string[]): WordTimestamp[] {
  return list.map((word, i) => ({ word, start: 9999 + i, end: 9999 + i }));
}

/** A perfect-looking caller-supplied physical payload. */
function perfectLookingPhysical(): Record<string, unknown> {
  return {
    authority: PHYSICAL_TIMING_AUTHORITY,
    words: words([["reaksi", 147.99, 149.5], ["terhadap", 149.5, 150.56], ["kurang", 150.56, 151.5]]),
    provenance: { source: "audio", provider: "whisper.cpp", model: "ggml-small-q5_1" },
    openingDirect: true,
    endingDirect: true,
  };
}

describe("ARCH.1C production trust — capability leaks closed", () => {
  // --- CASE A: no public minter ------------------------------------------

  it("CASE A: no public trust-minter factory is exported", () => {
    const exported = Object.keys(trustModule);
    expect(exported).not.toContain("createPhysicalTimelineMinter");
    expect(exported).not.toContain("createRenderResultMinter");
    expect(exported).not.toContain("promoteToTrustedPhysicalTimeline");
    expect(exported).not.toContain("officialBakomRenderResult");
    expect(exported).not.toContain("physicalTimelineMinter");
    expect(exported).not.toContain("renderResultMinter");
  });

  it("CASE B: perfect-looking caller-supplied words cannot become trusted", () => {
    const forged = perfectLookingPhysical();
    expect(isTrustedPhysicalTimeline(forged)).toBe(false);
    expect(() => requirePhysicalTimeline(forged)).toThrow();
    // also cannot mint via any exported helper
    const anyMint = (trustModule as Record<string, unknown>).mintPhysicalTimeline;
    expect(anyMint).toBeUndefined();
  });

  it("CASE C: alignment mapper returns alignment DATA, not trust", () => {
    const result = mapCanonicalWordsToAudio(
      canonical(["reaksi", "terhadap", "kurang"]),
      timed([["reaksi", 147.99, 149.5], ["terhadap", 149.5, 150.56], ["kurang", 150.56, 151.5]]),
      { opening: ["reaksi"], ending: ["kurang"] },
    );
    expect(result.success).toBe(true);
    if (result.success) {
      // Data only: the returned object is not a trusted timeline and carries no
      // capability.
      expect(isTrustedPhysicalTimeline(result.data)).toBe(false);
      expect(isTrustedPhysicalTimeline(result.data.words)).toBe(false);
      // And it cannot be promoted into trust by any public function.
      const promoted = (trustModule as Record<string, unknown>).trustTheseWords;
      expect(promoted).toBeUndefined();
    }
  });

  it("CASE D: caller-forged render fields cannot become a trusted render result", () => {
    const forged = {
      rendererAuthority: OFFICIAL_BAKOM_RENDERER_AUTHORITY,
      presentationSystem: "bakom-reels-system",
      outputPath: "/tmp/manual.mp4",
      width: 1080,
      height: 1920,
      fps: 30,
      durationSec: 50,
    };
    expect(isTrustedRenderResult(forged)).toBe(false);
    expect(() => requireTrustedRenderResult(forged)).toThrow();
  });

  it("CASE F: caller-made values remain blocked; canonical producers now own minting", () => {
    expect(CANONICAL_PHYSICAL_AUTHORITY_AVAILABLE).toBe(true);
    expect(CANONICAL_RENDER_AUTHORITY_AVAILABLE).toBe(true);

    const result = finalizeProductionArtifact({
      physicalTimeline: perfectLookingPhysical(),
      renderResult: {
        rendererAuthority: "official_bakom",
        presentationSystem: "bakom-reels-system",
      },
      qcChecks: { media_duration: "PASS" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("blocked");
      expect(result.reasons.join(" ")).toContain("missing trusted physical timing");
      expect(result.reasons.join(" ")).toContain("missing trusted render result");
    }
  });

  // --- Plain objects ------------------------------------------------------

  it("plain physical object is rejected even when fields validate", () => {
    // Payload passes validateAlignedWords ...
    expect(validateAlignedWords(words([["a", 0, 1]]))).toBeNull();
    // ... but without the private capability it is still not trusted.
    expect(isTrustedPhysicalTimeline({ authority: PHYSICAL_TIMING_AUTHORITY, words: words([["a", 0, 1]]), provenance: { source: "audio", provider: "x" } })).toBe(false);
  });

  it("copied __trust / descriptive strings are rejected", () => {
    expect(isTrustedPhysicalTimeline({ __trust: "TrustedPhysicalTimeline", ...perfectLookingPhysical() })).toBe(false);
  });

  it("JSON round-trip of trusted metadata is no longer trusted", () => {
    const roundTrip = JSON.parse(JSON.stringify(perfectLookingPhysical()));
    expect(isTrustedPhysicalTimeline(roundTrip)).toBe(false);
  });

  it("non-physical authorities are rejected", () => {
    for (const authority of ["youtube_cc", "srt", "synthetic", "interpolated", "ai_estimate", "manual", "unknown"]) {
      expect(isTrustedPhysicalTimeline({ authority, words: words([["a", 0, 1]]), provenance: { source: "audio", provider: "x" } })).toBe(false);
    }
    expect(NON_PHYSICAL_TIMING_SOURCES).toContain("youtube_cc");
    expect(NON_PHYSICAL_TIMING_SOURCES).toContain("interpolated");
  });

  it("untrusted renderer authorities are rejected", () => {
    for (const authority of ["manual", "scratch", "pil_scratch", "preview", "experiment", "unknown"]) {
      expect(isTrustedRendererAuthority(authority)).toBe(false);
    }
  });

  // --- Semantic ----------------------------------------------------------

  it("PASS: YouTube CC remains usable in semantic APIs", () => {
    expect(isSemanticEvidenceSource("youtube_cc")).toBe(true);
    const e = semanticEvidence("youtube_cc", "v.id.srt", "Besarnya api membuat petugas gabungan");
    expect(e.source).toBe("youtube_cc");
  });

  it("PASS: the pure whisper parser still returns data (not trust)", () => {
    const parsed = parseWhisperCppWordOutput(
      { transcription: [{ text: " reaksi", offsets: { from: 0, to: 1000 } }] },
      0,
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(isTrustedPhysicalTimeline(parsed.data)).toBe(false);
  });

  // --- Finalization gate --------------------------------------------------

  it("FAIL CLOSED: missing physical trust blocks", () => {
    const result = finalizeProductionArtifact({
      physicalTimeline: words([["cc", 1, 2]]),
      renderResult: { rendererAuthority: "official_bakom", presentationSystem: "bakom-reels-system" },
      qcChecks: { media_duration: "PASS" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("missing trusted physical timing");
  });

  it("FAIL CLOSED: missing canonical render trust blocks", () => {
    const result = finalizeProductionArtifact({
      physicalTimeline: perfectLookingPhysical(),
      renderResult: null,
      qcChecks: { media_duration: "PASS" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("missing trusted render result");
  });

  it("FAIL CLOSED: missing QC blocks", () => {
    const result = finalizeProductionArtifact({
      physicalTimeline: perfectLookingPhysical(),
      renderResult: { rendererAuthority: "official_bakom", presentationSystem: "bakom-reels-system" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("missing QC evidence");
  });

  it("FAIL CLOSED: failing QC blocks", () => {
    const result = finalizeProductionArtifact({
      physicalTimeline: perfectLookingPhysical(),
      renderResult: { rendererAuthority: "official_bakom", presentationSystem: "bakom-reels-system" },
      qcChecks: { media_duration: "FAIL" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain("qc_failed");
  });

  it("no bypass flags: empty finalization is blocked", () => {
    const result = finalizeProductionArtifact({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("blocked");
  });

  it("preview artifacts are explicitly non-production", () => {
    const preview = markPreviewArtifact(["scratch pipeline output for inspection"]);
    expect(preview.artifactStatus).toBe("preview");
    expect(preview.artifactStatus).not.toBe("production_valid");
  });
});
