import { describe, it, expect } from "bun:test";
import {
  ACCOUNT_PRESETS,
  resolveAccountPreset,
  isAccountPresetId,
  ProductionBriefSchema,
  AccountPresetIdSchema,
  JobStatusSchema,
  EditPlanSchema,
  SourceReferenceSchema,
} from "@/lib/xclips/auto-production-types";

describe("xclips - Auto Production Contract (Slice 1)", () => {
  describe("Account Presets", () => {
    it("both presets resolve successfully", () => {
      const shadow = resolveAccountPreset("shadow");
      const kabakom = resolveAccountPreset("kabakom");
      expect(shadow).toBeDefined();
      expect(kabakom).toBeDefined();
    });

    it("deterministic production values are correct for shadow", () => {
      const s = resolveAccountPreset("shadow")!;
      expect(s.id).toBe("shadow");
      expect(s.width).toBe(1080);
      expect(s.height).toBe(1920);
      expect(s.fps).toBe(30);
      expect(s.captionStyle.uppercase).toBe(true);
      expect(s.captionStyle.maxWordsPerPhrase).toBe(6);
      expect(s.loudnessTargetLu).toBe(-14);
      expect(s.transition).toBe("hard_cut");
      expect(s.bgmPolicy.enabled).toBe(false);
      expect(s.safeZone.topPx).toBeGreaterThan(0);
      expect(s.safeZone.bottomPx).toBeGreaterThan(0);
      expect(s.safeZone.leftPx).toBeGreaterThan(0);
      expect(s.safeZone.rightPx).toBeGreaterThan(0);
    });

    it("deterministic production values are correct for kabakom", () => {
      const k = resolveAccountPreset("kabakom")!;
      expect(k.id).toBe("kabakom");
      expect(k.width).toBe(1080);
      expect(k.height).toBe(1920);
      expect(k.fps).toBe(30);
      expect(k.captionStyle.maxWordsPerPhrase).toBe(6);
      expect(k.loudnessTargetLu).toBe(-14);
      expect(k.transition).toBe("hard_cut");
    });

    it("invalid preset id is rejected safely", () => {
      expect(resolveAccountPreset("invalid" as any)).toBeUndefined();
      expect(isAccountPresetId("shadow")).toBe(true);
      expect(isAccountPresetId("invalid")).toBe(false);
    });

    it("ACCOUNT_PRESETS map contains exactly two entries", () => {
      expect(ACCOUNT_PRESETS.size).toBe(2);
      expect(ACCOUNT_PRESETS.has("shadow")).toBe(true);
      expect(ACCOUNT_PRESETS.has("kabakom")).toBe(true);
    });
  });

  describe("ProductionBrief validation", () => {
    it("valid brief with sourceDate accepted", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/video.mp4", sourceType: "local" },
        editorialAngle: "Dampak erupsi",
        accountPresetId: "shadow",
        sourceName: "TVRI",
        sourceDate: "2026-09-01",
        accountHandle: "@newsdesk",
        sourceRole: "TV Broadcast",
        brollPool: [{ assetId: "b1", path: "/tmp/broll1.mp4" }],
      });
      expect(result.success).toBe(true);
    });

    it("sourceDate may be absent — not a validation failure", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/video.mp4", sourceType: "local" },
        editorialAngle: "Dampak erupsi",
        accountPresetId: "kabakom",
        sourceName: "TVRI",
        accountHandle: "@newsdesk",
        brollPool: [],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceDate).toBeUndefined();
      }
    });

    it("missing source blocks validation", () => {
      const result = ProductionBriefSchema.safeParse({
        editorialAngle: "test",
        accountPresetId: "shadow",
        sourceName: "x",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(result.success).toBe(false);
    });

    it("missing editorialAngle blocks validation", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        accountPresetId: "shadow",
        sourceName: "x",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(result.success).toBe(false);
    });

    it("missing accountPresetId blocks validation", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        sourceName: "x",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(result.success).toBe(false);
    });

    it("missing sourceName blocks validation", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        accountPresetId: "shadow",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(result.success).toBe(false);
    });

    it("missing accountHandle blocks validation", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        accountPresetId: "shadow",
        sourceName: "x",
        brollPool: [],
      });
      expect(result.success).toBe(false);
    });

    it("empty brollPool is valid", () => {
      const result = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        accountPresetId: "shadow",
        sourceName: "x",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(result.success).toBe(true);
    });

    it("sourceRole is independent of accountPresetId", () => {
      const withRole = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        accountPresetId: "shadow",
        sourceName: "x",
        accountHandle: "@x",
        sourceRole: "BAKOM",
        brollPool: [],
      });
      expect(withRole.success).toBe(true);

      const withoutRole = ProductionBriefSchema.safeParse({
        source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
        editorialAngle: "test",
        accountPresetId: "shadow",
        sourceName: "x",
        accountHandle: "@x",
        brollPool: [],
      });
      expect(withoutRole.success).toBe(true);
    });
  });

  describe("JobStatus schema", () => {
    it("accepts all five valid statuses", () => {
      for (const s of ["NEW", "PROCESSING", "READY", "NEEDS_REVIEW", "FAILED"]) {
        expect(JobStatusSchema.safeParse(s).success).toBe(true);
      }
    });

    it("rejects invalid statuses", () => {
      expect(JobStatusSchema.safeParse("PENDING").success).toBe(false);
      expect(JobStatusSchema.safeParse("done").success).toBe(false);
    });
  });

  describe("EditPlan schema", () => {
    it("valid plan with B-roll placements accepted", () => {
      const result = EditPlanSchema.safeParse({
        statementStart: 10,
        statementEnd: 45,
        headline: "Judul Berita",
        brollPlacements: [
          { assetId: "b1", startSec: 15, endSec: 25 },
          { assetId: "b2", startSec: 30, endSec: 40, relevanceScore: 0.85, misrepresentationRisk: false },
        ],
        thumbnailSourceFrame: 1200,
        statementSignal: { confidence: "strong", warnings: [] },
        brollSignal: { confidence: "review", warnings: ["low relevance on segment 2"] },
        headlineSignal: { confidence: "strong", warnings: [] },
      });
      expect(result.success).toBe(true);
    });

    it("plan without thumbnailSourceFrame is valid", () => {
      const result = EditPlanSchema.safeParse({
        statementStart: 5,
        statementEnd: 50,
        headline: "Breaking News",
        brollPlacements: [],
        statementSignal: { confidence: "low", warnings: ["weak match"] },
        brollSignal: { confidence: "strong", warnings: [] },
        headlineSignal: { confidence: "review", warnings: [] },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.thumbnailSourceFrame).toBeUndefined();
      }
    });

    it("empty brollPlacements is valid", () => {
      const result = EditPlanSchema.safeParse({
        statementStart: 0,
        statementEnd: 30,
        headline: "Headline",
        brollPlacements: [],
        statementSignal: { confidence: "strong", warnings: [] },
        brollSignal: { confidence: "strong", warnings: [] },
        headlineSignal: { confidence: "strong", warnings: [] },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SourceReference schema", () => {
    it("accepts local source", () => {
      expect(SourceReferenceSchema.safeParse({ sourcePath: "/tmp/v.mp4", sourceType: "local" }).success).toBe(true);
    });

    it("accepts url source", () => {
      expect(SourceReferenceSchema.safeParse({ sourcePath: "https://example.com/v.mp4", sourceType: "url" }).success).toBe(true);
    });

    it("rejects empty sourcePath", () => {
      expect(SourceReferenceSchema.safeParse({ sourcePath: "", sourceType: "local" }).success).toBe(false);
    });

    it("rejects invalid sourceType", () => {
      expect(SourceReferenceSchema.safeParse({ sourcePath: "/tmp/v.mp4", sourceType: "youtube" }).success).toBe(false);
    });
  });
});
