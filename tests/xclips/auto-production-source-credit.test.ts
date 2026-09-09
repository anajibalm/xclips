import { describe, it, expect } from "bun:test";
import {
  resolveSourceCreditName,
  FALLBACK_SOURCE_CREDIT,
} from "@/lib/xclips/auto-production-helpers";

// ============================================================
// S1.2 production closeout — publisher identity resolution.
// Contract: persisted channel/uploader metadata > explicit
// brief sourceName > safe fallback. Video titles never win
// over an available publisher. No title parsing, no hardcoding.
// ============================================================

const LONG_TITLE =
  "BREAKING NEWS - Presiden Prabowo Pimpin Ratas Perkembangan Penanganan Bencana Alam";

describe("xclips - Auto Production source credit (S1.2)", () => {
  it("1. YouTube channel/uploader metadata yields the publisher (trimmed)", () => {
    expect(
      resolveSourceCreditName({ channel: "METRO TV ", uploader: "METRO TV " }, LONG_TITLE),
    ).toBe("METRO TV");
  });

  it("2. explicit sourceName is used when no metadata exists", () => {
    expect(resolveSourceCreditName(undefined, "Kompas TV")).toBe("Kompas TV");
    expect(resolveSourceCreditName(null, "Sekretariat Presiden")).toBe("Sekretariat Presiden");
    expect(resolveSourceCreditName({}, "TVRI")).toBe("TVRI");
  });

  it("3. long video title never replaces an available publisher", () => {
    expect(resolveSourceCreditName({ channel: "Metro TV" }, LONG_TITLE)).toBe("Metro TV");
    expect(resolveSourceCreditName({ uploader: "Kompas TV" }, LONG_TITLE)).toBe("Kompas TV");
    expect(resolveSourceCreditName({ publisher: "Sekretariat Presiden" }, LONG_TITLE)).toBe(
      "Sekretariat Presiden",
    );
  });

  it("4. blank metadata values are skipped, whitespace never leaks", () => {
    expect(
      resolveSourceCreditName({ channel: "   ", uploader: "\n", publisher: "TVRI" }, LONG_TITLE),
    ).toBe("TVRI");
    expect(resolveSourceCreditName({ channel: "Metro TV\r\n" }, LONG_TITLE)).toBe("Metro TV");
  });

  it("5. empty everything falls back to a non-empty safe credit", () => {
    const credit = resolveSourceCreditName(undefined, "   ");
    expect(credit.length).toBeGreaterThan(0);
    expect(credit).toBe(FALLBACK_SOURCE_CREDIT);
  });
});
