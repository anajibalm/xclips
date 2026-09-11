import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { brollAt, validateBrollPlacements, type BrollPlacement } from "@/lib/xclips/bakom-enrichment";

function placement(over: Partial<BrollPlacement> = {}): BrollPlacement {
  return {
    programStart: 28.0,
    programEnd: 36.0,
    sourcePath: "/repo/vault/fire.mp4",
    sourceStart: 8.0,
    sourceEnd: 16.0,
    reason: "cutaway",
    provenance: {
      materialId: "mat-01",
      sourceVideoId: "7QzF3NxGltQ",
      sourceUrl: "https://www.youtube.com/watch?v=7QzF3NxGltQ",
      publisher: "Official iNews",
      sourceStart: 8.0,
      sourceEnd: 16.0,
      selectionReason: "fire front",
    },
    ...over,
  };
}

describe("bakom enrichment placement validation", () => {
  it("accepts in-bounds provenanced placements", () => {
    const out = validateBrollPlacements([placement()], 50.05);
    expect(out).toHaveLength(1);
  });

  it("rejects slots outside the program", () => {
    expect(() => validateBrollPlacements([placement({ programEnd: 60 })], 50.05)).toThrow();
    expect(() => validateBrollPlacements([placement({ programStart: -1 })], 50.05)).toThrow();
  });

  it("rejects overlapping slots", () => {
    expect(() =>
      validateBrollPlacements([placement(), placement({ programStart: 30, programEnd: 40 })], 50.05),
    ).toThrow();
  });

  it("rejects visual/audio duration mismatch beyond one frame", () => {
    expect(() => validateBrollPlacements([placement({ sourceEnd: 10 })], 50.05)).toThrow();
  });

  it("rejects material without provenance", () => {
    const p = placement();
    // @ts-expect-error - provenance deliberately removed to prove fail-closed
    delete p.provenance;
    expect(() => validateBrollPlacements([p], 50.05)).toThrow(/provenance/);
    expect(() =>
      validateBrollPlacements([placement({ provenance: { ...placement().provenance, sourceUrl: " " } })], 50.05),
    ).toThrow(/provenance/);
  });

  it("resolves covering placement by program time", () => {
    const ps = validateBrollPlacements([placement()], 50.05);
    expect(brollAt(ps, 27.999)).toBeNull();
    expect(brollAt(ps, 28.0)?.provenance.materialId).toBe("mat-01");
    expect(brollAt(ps, 35.999)?.provenance.materialId).toBe("mat-01");
    expect(brollAt(ps, 36.0)).toBeNull();
  });
});

describe("bakom enrichment render integration (synthetic)", () => {
  const renderDepsOk = (() => {
    try {
      const dir = process.env.XCLIPS_FONT_DIR ?? "";
      if (!dir) return false;
      for (const f of ["nunito-sans-800.ttf", "plus-jakarta-sans-800-latin.ttf"]) {
        if (!existsSync(path.join(dir, f))) return false;
      }
      return true;
    } catch {
      return false;
    }
  })();
  const itRender = renderDepsOk ? it : it.skip;

  itRender("broll switches video but leaves program audio bit-identical", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const { renderOfficialBakomSequential } = await import("@/lib/xclips/official-bakom-renderer");
    const tmp = path.join(os.tmpdir(), `s4broll-${Date.now()}`);
    await run("mkdir", ["-p", tmp]);
    const src = path.join(tmp, "src.mp4");
    await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src]);
    const common = {
      sourceVideoPath: src, sourceStart: 0, sourceEnd: 8, headline: "Judul Uji",
      cues: [
        { start: 0.5, end: 3.5, text: "Kalimat Pertama" },
        { start: 4.0, end: 7.5, text: "Kalimat Kedua" },
      ],
      credit: "Sumber: Uji TV",
      creditMeta: { sourceName: "Uji TV", publisherHandle: "@uji" },
      framingMode: "FIELD_FIT_BG" as const,
    };
    const base = path.join(tmp, "base.mp4");
    await renderOfficialBakomSequential({ ...common, outputPath: base });
    const withBroll = path.join(tmp, "broll.mp4");
    await renderOfficialBakomSequential({
      ...common,
      outputPath: withBroll,
      brollPlacements: [{
        programStart: 2.0, programEnd: 5.0, sourcePath: src, sourceStart: 5.0, sourceEnd: 8.0,
        reason: "synthetic cutaway",
        provenance: { materialId: "syn-01", sourceVideoId: "syn", sourceUrl: "lavfi:testsrc2", publisher: "synthetic", sourceStart: 5.0, sourceEnd: 8.0, selectionReason: "synthetic" },
      }],
    });
    const md5 = async (file: string, spec: string[]) => {
      const r = await run("ffmpeg", ["-v", "error", "-i", file, ...spec]);
      return String(r.stdout ?? r.stderr ?? "").trim();
    };
    const audioBase = await md5(base, ["-map", "0:a", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-f", "md5", "-"]);
    const audioBroll = await md5(withBroll, ["-map", "0:a", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-f", "md5", "-"]);
    expect(audioBase).toContain("MD5=");
    expect(audioBroll).toBe(audioBase);
    const videoBase = await md5(base, ["-map", "0:v", "-c", "copy", "-f", "md5", "-"]);
    const videoBroll = await md5(withBroll, ["-map", "0:v", "-c", "copy", "-f", "md5", "-"]);
    expect(videoBroll).not.toBe(videoBase);
  }, 300000);
});
