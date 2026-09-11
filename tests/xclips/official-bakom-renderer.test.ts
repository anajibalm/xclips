import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildEndcardVideo,
  ENDCARD_TIMEOUT_MS,
  planSegments,
  renderOfficialBakomSequential,
  resolveFontFile,
  v5Motion,
  V5_FADE_SEC,
  V5_SLIDE_PX,
  type OfficialBakomRenderInput,
} from "@/lib/xclips/official-bakom-renderer";

describe("official BAKOM dynamic endcard", () => {
  it("keeps low-memory codecs and timeout budget", () => {
    expect(ENDCARD_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(ENDCARD_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it("renders different bytes for different headlines/sources", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const dir = process.env.XCLIPS_FONT_DIR ?? "";
    const fonts = {
      head: `${dir}/plus-jakarta-sans-800-latin.ttf`,
      text: `${dir}/nunito-sans-800.ttf`,
      italic: `${dir}/nunito-sans-italic-500.ttf`,
    };
    for (const f of Object.values(fonts)) {
      if (!existsSync(f)) return;
    }
    const tmp = path.join(os.tmpdir(), `s3ec-${Date.now()}`);
    await run("mkdir", ["-p", tmp]);
    const a = path.join(tmp, "a.mp4");
    const b = path.join(tmp, "b.mp4");
    await buildEndcardVideo({ dir: tmp, content: { headline: "Reaksi terhadap Kebakaran Hutan Cukup Masif", publisherHandle: "@bakom_ri", sourceName: "Metro TV" }, fonts, outputPath: a });
    await buildEndcardVideo({ dir: tmp, content: { headline: "Status Gunung Tetap pada Level Tiga Siaga", publisherHandle: "@lainnya", sourceName: "TV Lain" }, fonts, outputPath: b });
    const ha = readFileSync(a);
    const hb = readFileSync(b);
    expect(ha.length).toBeGreaterThan(100_000);
    expect(hb.length).toBeGreaterThan(100_000);
    expect(Buffer.compare(ha, hb) === 0).toBe(false);
    for (const f of [a, b]) {
      const probe = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]);
      const dur = Number(String(probe.stdout).trim());
      expect(dur).toBeGreaterThanOrEqual(3.9);
      expect(dur).toBeLessThanOrEqual(4.1);
    }
  }, 180000);

  it("fails closed on missing endcard content", async () => {
    await expect(
      buildEndcardVideo({ dir: os.tmpdir(), content: { headline: "", publisherHandle: "@x", sourceName: "Y" }, fonts: { head: "h", text: "t", italic: "i" }, outputPath: path.join(os.tmpdir(), "no.mp4") }),
    ).rejects.toThrow(/headline/);
  });
});

function s3PlanFixture(): OfficialBakomRenderInput {
  return {
    sourceVideoPath: "/nonexistent-src.mp4",
    sourceStart: 100,
    sourceEnd: 110,
    headline: "Judul Uji",
    cues: [
      { start: 4.0, end: 6.0, text: "Kalimat Kedua" },
      { start: 1.0, end: 2.0, text: "Kalimat Pertama" },
    ],
    credit: "Uji TV · @uji",
    outputPath: "/tmp/out.mp4",
    v5: { start: 3.0, end: 6.5, name: "Nama", role: "Peran" },
    framingMode: "FIELD_FIT_BG",
  };
}

describe("official BAKOM timeline plan", () => {
  it("V1 owns the 3s intro and source starts after it, uncut", () => {
    const segs = planSegments(s3PlanFixture());
    expect(segs[0]).toMatchObject({ start: 0, end: 3, sourceStart: null });
    expect(segs[0].kinds).toEqual(["intro", "hook"]);
    const speech = segs.filter((s) => s.sourceStart !== null);
    expect(speech[0].sourceStart).toBe(100);
    expect(speech[speech.length - 1].end).toBe(13);
    expect(speech[speech.length - 1].sourceStart! + (speech[speech.length - 1].end - speech[speech.length - 1].start)).toBeCloseTo(110, 6);
  });

  it("subtitle is persistent: active inside the V5 window, absent in gaps", () => {
    const segs = planSegments(s3PlanFixture());
    const v5segs = segs.filter((s) => s.v5Active);
    expect(v5segs.length).toBeGreaterThan(0);
    // cue [4,6] overlaps the V5 window [3,6.5]: both layers co-occur
    const overlap = v5segs.find((s) => s.cue && s.cue.text === "Kalimat Kedua");
    expect(overlap).toBeDefined();
    expect(overlap!.kinds).toContain("subtitle");
    expect(overlap!.kinds).toContain("v5");
    // gap [2,3)+[3,4): no cue -> no subtitle kind anywhere without a cue
    for (const s of segs) {
      if (!s.cue) expect(s.kinds).not.toContain("subtitle");
      if (s.cue) expect(s.kinds).toContain("subtitle");
    }
  });

  it("hook segment never carries subtitles", () => {
    const segs = planSegments(s3PlanFixture());
    expect(segs[0].kinds).not.toContain("subtitle");
    expect(segs[0].kinds).not.toContain("v5");
  });
});

describe("official BAKOM V5 motion", () => {
  it("fades and slides 16px over 260ms, then holds static", () => {
    expect(V5_FADE_SEC).toBe(0.26);
    expect(V5_SLIDE_PX).toBe(16);
    const enter = v5Motion(0);
    expect(enter.fadeFilter).toContain("fade=t=in:st=0:d=0.26:alpha=1");
    expect(enter.overlayY).toContain("16*");
    expect(enter.overlayY).toContain("min(t/0.26");
    const held = v5Motion(1.0);
    expect(held.fadeFilter).toBeNull();
    expect(held.overlayY).toBe("0");
  });
});

describe("official BAKOM loudness plumbing", () => {
  it("builds target-consistent measured second pass and requests linear when possible", async () => {
    const mod = await import("@/lib/xclips/official-bakom-renderer");
    const args = mod.loudnormSecondPass({ inputI: -21.21, inputTp: -3.74, inputLra: 7.2, inputThresh: -32.99, targetOffset: 1.61 });
    expect(args).toContain("I=-14");
    expect(args).toContain("TP=-1.5");
    expect(args).toContain("LRA=11");
    expect(args).toContain("measured_I=-21.21");
    expect(args).toContain("measured_TP=-3.74");
    expect(args).toContain("offset=1.61");
    // linear=true is a request, not a guarantee: FFmpeg falls back to
    // dynamic when the TP/LRA conditions forbid pure linear gain.
    // Truth is the post-AAC acceptance measurement below, not this flag.
    expect(args).toContain("linear=true");
    expect(args).not.toContain("linear=false");
  });
});
describe("official BAKOM dependency hygiene", () => {
  const selfSource = readFileSync(new URL("../../src/lib/xclips/official-bakom-renderer.ts", import.meta.url), "utf8");

  it("has no absolute font path or runtime artifact path", () => {
    expect(selfSource).not.toContain("/home/lenovo");
    expect(selfSource).not.toContain("/mnt/");
    expect(selfSource).not.toContain("artifacts/");
    expect(selfSource).toContain("XCLIPS_FONT_DIR");
  });

  it("does not depend on production-trust or S6 modules", () => {
    expect(selfSource).not.toContain("production-trust");
    expect(selfSource).not.toContain("audio-alignment");
    expect(selfSource).not.toContain("auto-production-service");
  });

  it("stores no headline or source fixture in code", () => {
    for (const fixture of ["Reaksi terhadap", "METRO TV", "Metro TV", "bakom_ri", "Prabowo", "Antisipatif", "vXFdaRBI9ls", "146.45"]) {
      expect(selfSource).not.toContain(fixture);
    }
  });

    it("fails closed when fonts are unresolvable", () => {
    const saved = process.env.XCLIPS_FONT_DIR;
    try {
      process.env.XCLIPS_FONT_DIR = "/nonexistent-font-dir-xyz";
      expect(() => resolveFontFile("nunito-sans-800.ttf")).toThrow(/font missing/);
      delete process.env.XCLIPS_FONT_DIR;
      expect(() => resolveFontFile("nunito-sans-800.ttf")).toThrow(/XCLIPS_FONT_DIR is not set/);
    } finally {
      if (saved === undefined) delete process.env.XCLIPS_FONT_DIR;
      else process.env.XCLIPS_FONT_DIR = saved;
    }
  });
});

const renderDepsOk = (() => {
  try {
    const dir = process.env.XCLIPS_FONT_DIR ?? "";
    if (!dir) return false;
    for (const f of ["nunito-sans-800.ttf", "nunito-sans-500.ttf", "nunito-sans-italic-500.ttf", "plus-jakarta-sans-800-latin.ttf"]) {
      if (!existsSync(path.join(dir, f))) return false;
    }
    return true;
  } catch {
    return false;
  }
})();
const itRender = renderDepsOk ? it : it.skip;

const S3_FIXTURE_SRC =
  process.env.XCLIPS_S3_FIXTURE_SRC ??
  path.resolve(process.cwd(), "vault/xclips/downloads/proj_1788933823612_gftf/BREAKING NEWS - Presiden Prabowo Pimpin Ratas Perkembangan Penanganan Bencana Alam [vXFdaRBI9ls].mp4");
const S3_WORDS_JSON = path.resolve(process.cwd(), "artifacts/slice-3-official-bakom-draft/s3-words-146.45-192.6.json");
const S3_CUES_JSON = path.resolve(process.cwd(), "artifacts/slice-3-official-bakom-draft/cue-manifest.json");
const itFixture = renderDepsOk && existsSync(S3_FIXTURE_SRC) && existsSync(S3_WORDS_JSON) && existsSync(S3_CUES_JSON) ? it : it.skip;

describe("official BAKOM CFR acceptance render", () => {
  itRender("true CFR 30 with bounded A/V duration match", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const tmp = path.join(os.tmpdir(), `s3cfr-${Date.now()}`);
    await run("mkdir", ["-p", tmp]);
    const src = path.join(tmp, "src.mp4");
    await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=5", "-f", "lavfi", "-i", "sine=frequency=440:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src]);
    const out = path.join(tmp, "final.mp4");
    await renderOfficialBakomSequential({
      sourceVideoPath: src,
      sourceStart: 0,
      sourceEnd: 5,
      headline: "Judul Uji CFR",
      cues: [
        { start: 0.5, end: 1.5, text: "Uji Coba Satu" },
        { start: 2.0, end: 3.0, text: "Uji Coba Dua", emphasis: "Dua" },
      ],
      credit: "Uji TV · @uji",
      creditMeta: { sourceName: "Uji TV", publisherHandle: "@uji" },
      outputPath: out,
      v5: { start: 0.8, end: 2.3, name: "Nama Uji", role: "Peran Uji" },
      framingMode: "FIELD_FIT_BG",
    });
    const streams = JSON.parse(String((await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,avg_frame_rate,nb_frames", "-of", "json", out])).stdout));
    const st = streams.streams[0];
    expect(st.r_frame_rate).toBe("30/1");
    expect(st.avg_frame_rate).toBe("30/1");
    // Packet PTS values form the same multiset as presentation timestamps
    // (packets sit in decode order when B-frames exist); sorting restores
    // presentation order for gap analysis.
    const pkts = String((await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0", out])).stdout)
      .trim().split("\n").map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    expect(pkts.length).toBeGreaterThan(200);
    let maxDev = 0;
    let maxGap = 0;
    for (let i = 1; i < pkts.length; i++) {
      const d = pkts[i] - pkts[i - 1];
      maxGap = Math.max(maxGap, d);
      maxDev = Math.max(maxDev, Math.abs(d - 1 / 30));
    }
    expect(maxGap).toBeLessThan(0.05);
    expect(maxDev).toBeLessThan(0.004);
    const fmt = JSON.parse(String((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", out])).stdout));
    expect(Math.abs(Number(fmt.format.duration) - 12)).toBeLessThan(0.15);
    const av = JSON.parse(String((await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", out])).stdout));
    const vd = Number(av.streams.find((s: { codec_type: string }) => s.codec_type === "video").duration);
    const ad = Number(av.streams.find((s: { codec_type: string }) => s.codec_type === "audio").duration);
    expect(Math.abs(ad - vd)).toBeLessThanOrEqual(1 / 30 + 0.005);
    // Loudness plumbing smoke: measurement parses finite numbers on real
    // output. Absolute broadcast targeting is enforced by the loudness
    // acceptance test below and verified per-proof in the manifest.
    const { measureLoudness } = await import("@/lib/xclips/official-bakom-renderer");
    const loud = await measureLoudness(out);
    for (const v of [loud.inputI, loud.inputTp, loud.inputLra, loud.inputThresh, loud.targetOffset]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  }, 180000);
});

describe("official BAKOM loudness acceptance on the S3 fixture", () => {
  itFixture("post-AAC final program measures [-15,-13] LUFS with TP <= -1 dBTP", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const { buildTimedCues } = await import("@/lib/xclips/bakom-presentation");
    const { readFile } = await import("node:fs/promises");
    const wordsFile = JSON.parse(await readFile(S3_WORDS_JSON, "utf8"));
    const accepted = JSON.parse(await readFile(S3_CUES_JSON, "utf8")).map((c: { text: string }) => c.text);
    const cues = buildTimedCues(accepted, wordsFile.items);
    const tmp = path.join(os.tmpdir(), `s3loud-${Date.now()}`);
    await run("mkdir", ["-p", tmp]);
    const out = path.join(tmp, "final.mp4");
    await renderOfficialBakomSequential({
      sourceVideoPath: S3_FIXTURE_SRC,
      sourceStart: 146.45,
      sourceEnd: 192.6,
      headline: "Reaksi terhadap Kebakaran Hutan Cukup Masif",
      cues: cues.map((c) => ({ start: c.start - 146.45, end: c.end - 146.45, text: c.text, emphasis: "Antisipatif" })),
      credit: "Sumber: METRO TV",
      creditMeta: { sourceName: "METRO TV", publisherHandle: "@bakom_ri" },
      outputPath: out,
      v5: { start: 3.0, end: 6.5, name: "Prabowo Subianto", role: "Presiden Republik Indonesia" },
      framingMode: "FIELD_FIT_BG",
    });
    const probed = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", out, "-af", "loudnorm=print_format=json", "-f", "null", "-"]);
    const text = String((probed as { stderr: string }).stderr ?? "");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
    const integrated = Number(parsed.input_i);
    const truePeak = Number(parsed.input_tp);
    expect(Number.isFinite(integrated) && Number.isFinite(truePeak)).toBe(true);
    expect(integrated).toBeGreaterThanOrEqual(-15);
    expect(integrated).toBeLessThanOrEqual(-13);
    expect(truePeak).toBeLessThanOrEqual(-1.0);
  }, 600000);
});
