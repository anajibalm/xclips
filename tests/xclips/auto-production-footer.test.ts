import { describe, it, expect } from "bun:test";
import {
  resolveAutoProductionFooter,
  FOOTER_MIN_GAP_PX,
  estimateLineWidth,
} from "@/lib/xclips/auto-production-headline";
import { buildAutoProductionFfmpegCommand } from "@/lib/xclips/auto-production-renderer";
import { BAKOM_LAYOUT } from "@/lib/xclips/auto-production-bakom-layout";
import {
  ACCOUNT_PRESETS,
  type ProductionBrief,
  type EditPlan,
} from "@/lib/xclips/auto-production-types";

// ============================================================
// S1 visual spine — footer anti-overlap contract
// Invariant: sourceRight + minGap <= handleLeft, single baseline,
// both strings inside horizontal safe margins.
// ============================================================

const FONT = 28;
const SAFE_X = 48;
const CANVAS_W = 1080;

function checkMargins(f: { sourceX: number; sourceRight: number; handleX: number; handleText: string }) {
  expect(f.sourceX).toBe(SAFE_X);
  expect(f.sourceRight).toBeLessThanOrEqual(CANVAS_W - SAFE_X);
  const handleRight = f.handleX + estimateLineWidth(f.handleText, FONT);
  expect(handleRight).toBeLessThanOrEqual(CANVAS_W - SAFE_X + 1); // rounding tolerance
  expect(f.handleX).toBeGreaterThanOrEqual(SAFE_X);
}

describe("xclips - Auto Production footer fit (S1)", () => {
  it("short source + short handle stay intact with gap respected", () => {
    const f = resolveAutoProductionFooter("Sumber: TVRI Jatim", "@tvrijatim");
    expect(f.truncated).toBe(false);
    expect(f.sourceText).toBe("Sumber: TVRI Jatim");
    expect(f.handleText).toBe("@tvrijatim");
    expect(f.gap).toBeGreaterThanOrEqual(FOOTER_MIN_GAP_PX);
    expect(f.sourceRight + FOOTER_MIN_GAP_PX).toBeLessThanOrEqual(f.handleX);
    checkMargins(f);
  });

  it("long source + short handle truncates source, keeps handle intact", () => {
    const f = resolveAutoProductionFooter(
      "Sumber: BREAKING NEWS - Presiden Prabowo Pimpin Ratas Perkembangan Penanganan Bencana Alam (2026-09-07)",
      "@bakom_ri",
    );
    expect(f.truncated).toBe(true);
    expect(f.handleText).toBe("@bakom_ri");
    expect(f.sourceText.endsWith("...")).toBe(true);
    expect(f.sourceRight + FOOTER_MIN_GAP_PX).toBeLessThanOrEqual(f.handleX);
    expect(f.gap).toBeGreaterThanOrEqual(FOOTER_MIN_GAP_PX);
    checkMargins(f);
  });

  it("long source + long handle never collide", () => {
    const f = resolveAutoProductionFooter(
      "Sumber: BREAKING NEWS - Presiden Prabowo Pimpin Ratas Perkembangan Penanganan Bencana Alam",
      "@akun_berita_nasional_resmi_terverifikasi",
    );
    expect(f.sourceRight + FOOTER_MIN_GAP_PX).toBeLessThanOrEqual(f.handleX);
    expect(f.gap).toBeGreaterThanOrEqual(FOOTER_MIN_GAP_PX);
    checkMargins(f);
  });

  it("pathological 200-char handle still honors the invariant", () => {
    const f = resolveAutoProductionFooter("Sumber: TVRI", `@${"x".repeat(200)}`);
    expect(f.sourceRight + FOOTER_MIN_GAP_PX).toBeLessThanOrEqual(f.handleX);
    expect(f.gap).toBeGreaterThanOrEqual(FOOTER_MIN_GAP_PX);
    checkMargins(f);
  });

  it("strips newlines from operator input so drawtext stays intact", () => {
    const f = resolveAutoProductionFooter("Sumber: TVRI\nJatim\r\nNews", "@bakom\n_ri");
    expect(f.sourceText).not.toContain("\n");
    expect(f.handleText).not.toContain("\n");
    expect(f.sourceText).toBe("Sumber: TVRI Jatim News");
    expect(f.handleText).toBe("@bakom _ri");
    expect(f.sourceRight + FOOTER_MIN_GAP_PX).toBeLessThanOrEqual(f.handleX);
  });

  it("is deterministic across repeated calls", () => {
    const a = resolveAutoProductionFooter("Sumber: TVRI Jatim (2026-09-07)", "@tvrijatim");
    const b = resolveAutoProductionFooter("Sumber: TVRI Jatim (2026-09-07)", "@tvrijatim");
    expect(a).toEqual(b);
  });

  it("renderer emits fitted footer on one baseline without overlap", () => {
    const preset = ACCOUNT_PRESETS.get("kabakom")!;
    const brief: ProductionBrief = {
      source: { sourcePath: "/tmp/test.mp4", sourceType: "local" },
      editorialAngle: "angle",
      editorialFunction: "function",
      accountPresetId: "kabakom",
      sourceName: "BREAKING NEWS - Presiden Prabowo Pimpin Ratas Perkembangan Penanganan Bencana Alam",
      accountHandle: "@bakom_ri",
      brollPool: [],
    };
    const editPlan: EditPlan = {
      statementStart: 5,
      statementEnd: 35,
      headline: "Headline",
      brollPlacements: [],
      statementSignal: { confidence: "strong", warnings: [] },
      brollSignal: { confidence: "strong", warnings: [] },
      headlineSignal: { confidence: "strong", warnings: [] },
    };
    const cmd = buildAutoProductionFfmpegCommand(
      {
        sourceVideoPath: "/tmp/test.mp4",
        sourceWidth: 1920,
        sourceHeight: 1080,
        clipStart: 5,
        clipEnd: 35,
        preset,
        editPlan,
        brief,
        assSubtitlePath: "/tmp/test.ass",
      },
      "/tmp/out.mp4",
      "cpu",
    );
    // Truncated source with ellipsis is emitted, full handle intact.
    expect(cmd.filterComplex).toContain("...");
    expect(cmd.filterComplex).toContain("@bakom_ri");
    // Both footer lines share one baseline below the media zone, raised into
    // the bottom safe area (S1.1: never hardcoded — follows layout).
    const footerY = 1920 - BAKOM_LAYOUT.sourceBottomOffset;
    expect(BAKOM_LAYOUT.sourceBottomOffset).toBeGreaterThanOrEqual(200);
    expect(cmd.filterComplex).toContain(`y=${footerY}`);
  });
});
