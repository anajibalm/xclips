import * as fs from "fs";
import * as path from "path";
import { LayoutMode, SubtitleStyle, WordTimestamp, Result } from "@/lib/xclips/types";

export interface FilterComplexOptions {
  sourceVideo: string;
  sourceWidth: number;
  sourceHeight: number;
  clipStart: number;
  clipEnd: number;
  keepIntervals: Array<{ start: number; end: number; duration: number }>;
  layoutMode: LayoutMode;
  panOffsetX?: number; // -1.0 to 1.0 (0.0 = centered)
  assSubtitlePath?: string;
  targetWidth?: number; // default 1080
  targetHeight?: number; // default 1920
  targetFps?: number; // default 30
}

export interface FfmpegCommandResult {
  args: string[];
  filterComplex: string;
}

/**
 * Builds the complete ffmpeg command args and filter_complex string
 */
export function buildFfmpegCommand(
  options: FilterComplexOptions,
  outputPath: string,
  hwaccel: "nvenc" | "qsv" | "amf" | "cpu" = "cpu"
): FfmpegCommandResult {
  const targetW = options.targetWidth || 1080;
  const targetH = options.targetHeight || 1920;
  const targetFps = options.targetFps || 30;
  const intervals = options.keepIntervals;

  const filterChains: string[] = [];
  const concatVideoLabels: string[] = [];
  const concatAudioLabels: string[] = [];

  // Step 1: Trim and reset PTS for each interval
  for (let i = 0; i < intervals.length; i++) {
    const inter = intervals[i];
    const absStart = options.clipStart + inter.start;
    const absEnd = options.clipStart + inter.end;

    // Video trim & PTS reset
    filterChains.push(
      `[0:v]trim=start=${absStart.toFixed(3)}:end=${absEnd.toFixed(3)},setpts=PTS-STARTPTS[v_trim_${i}]`
    );
    concatVideoLabels.push(`[v_trim_${i}]`);

    // Audio trim & PTS reset
    filterChains.push(
      `[0:a]atrim=start=${absStart.toFixed(3)}:end=${absEnd.toFixed(3)},asetpts=PTS-STARTPTS[a_trim_${i}]`
    );
    concatAudioLabels.push(`[a_trim_${i}]`);
  }

  // Step 2: Concat segments
  const concatCount = intervals.length;
  if (concatCount > 1) {
    const videoConcatIn = concatVideoLabels.join("");
    const audioConcatIn = concatAudioLabels.join("");

    filterChains.push(
      `${videoConcatIn}concat=n=${concatCount}:v=1:a=0[v_concatenated]`
    );
    filterChains.push(
      `${audioConcatIn}concat=n=${concatCount}:v=0:a=1[a_concatenated]`
    );
  } else {
    filterChains.push(`[v_trim_0]copy[v_concatenated]`);
    filterChains.push(`[a_trim_0]acopy[a_concatenated]`);
  }

  // Step 3: Layout Reframing (9:16 target)
  if (options.layoutMode === "blur_bg") {
    // Background: scale to fill 1080x1920 and boxblur
    // Foreground: scale to fit width 1080
    filterChains.push(
      `[v_concatenated]split=2[v_bg_in][v_fg_in]`,
      `[v_bg_in]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=25:5[v_bg]`,
      `[v_fg_in]scale=${targetW}:-2[v_fg]`,
      `[v_bg][v_fg]overlay=(W-w)/2:(H-h)/2[v_framed]`
    );
  } else if (options.layoutMode === "center_crop") {
    // Scale height to 1920, crop width to 1080 with pan offset
    const panOffset = options.panOffsetX || 0.0;
    // panOffset 0 = center, -1.0 = left edge, 1.0 = right edge
    const cropXExpr = `(in_w-out_w)/2 + (${panOffset.toFixed(2)} * (in_w-out_w)/2)`;
    filterChains.push(
      `[v_concatenated]scale=-2:${targetH},crop=${targetW}:${targetH}:${cropXExpr}:0[v_framed]`
    );
  } else if (options.layoutMode === "split_screen") {
    // Split screen: top half & bottom half (stacked)
    const halfH = Math.floor(targetH / 2);
    filterChains.push(
      `[v_concatenated]split=2[v_top_in][v_bot_in]`,
      `[v_top_in]scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[v_top]`,
      `[v_bot_in]scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[v_bot]`,
      `[v_top][v_bot]vstack=inputs=2[v_framed]`
    );
  } else {
    // Fallback: simple scale
    filterChains.push(`[v_concatenated]scale=${targetW}:${targetH}[v_framed]`);
  }

  // Step 4: Subtitle burn-in (if provided)
  let finalVideoLabel = "[v_framed]";
  if (options.assSubtitlePath && fs.existsSync(options.assSubtitlePath)) {
    const escapedAss = options.assSubtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    filterChains.push(`[v_framed]ass='${escapedAss}'[v_subbed]`);
    finalVideoLabel = "[v_subbed]";
  }

  // Step 5: Audio Normalization EBU R128
  filterChains.push(
    `[a_concatenated]loudnorm=I=-16:TP=-1.5:LRA=11[a_final]`
  );

  const filterComplex = filterChains.join(";");

  // Determine Video Codec based on HW acceleration
  let videoEncoder = "libx264";
  let encoderArgs: string[] = ["-preset", "veryfast", "-crf", "19"];

  if (hwaccel === "nvenc") {
    videoEncoder = "h264_nvenc";
    encoderArgs = ["-preset", "p4", "-cq", "20"];
  } else if (hwaccel === "qsv") {
    videoEncoder = "h264_qsv";
    encoderArgs = ["-global_quality", "20"];
  } else if (hwaccel === "amf") {
    videoEncoder = "h264_amf";
    encoderArgs = ["-quality", "speed"];
  }

  const args: string[] = [
    "-y",
    "-i",
    options.sourceVideo,
    "-filter_complex",
    filterComplex,
    "-map",
    finalVideoLabel,
    "-map",
    "[a_final]",
    "-c:v",
    videoEncoder,
    ...encoderArgs,
    "-r",
    targetFps.toString(),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath,
  ];

  return { args, filterComplex };
}

/**
 * Converts standard CSS/Hex color (#RRGGBB) to ASS subtitle color (&HAABBGGRR)
 */
export function hexToAssColor(hex: string, alphaHex = "00"): string {
  if (hex.startsWith("&H") || hex.startsWith("&h")) return hex;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `&H${alphaHex}${b}${g}${r}`;
  }
  return `&H${alphaHex}FFFFFF`;
}

/**
 * Generates an Advanced SubStation Alpha (.ass) subtitle file with word-by-word highlight tags
 */
export function generateAssSubtitles(
  words: WordTimestamp[],
  clipStartSec: number,
  clipEndSec: number,
  style: SubtitleStyle,
  outputPath: string
): Result<string> {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Filter words to clip bounds
    const clipWords = words.filter(
      (w) => w.start >= clipStartSec && w.end <= clipEndSec
    );

    const primaryColor = hexToAssColor(style.primaryColor || "#FFFFFF", "00");
    const highlightColor = hexToAssColor(style.highlightColor || "#FACC15", "00");
    const outlineColor = hexToAssColor(style.outlineColor || "#000000", "00");
    const boxAlpha = Math.round((1 - (style.boxOpacity ?? 0.7)) * 255).toString(16).padStart(2, "0").toUpperCase();
    const boxColor = hexToAssColor(style.boxColor || "#000000", boxAlpha);

    const fontSize = style.fontSize || 42;
    const fontFamily = style.fontFamily || "Inter";
    const outlineWidth = style.outlineWidth ?? (style.preset === "plain" ? 2 : 3.5);
    const borderStyle = style.preset === "clean_box" ? 3 : 1;
    const bold = style.preset === "minimal" ? 0 : -1;
    const marginV = Math.round(1920 * (1 - (style.positionY || 80) / 100));

    const header = `[Script Info]
Title: xclips Dynamic Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${primaryColor},${highlightColor},${outlineColor},${boxColor},${bold},0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${style.preset === "minimal" ? 1 : 2},2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Group words into short phrases (3-5 words per subtitle screen)
    const phrases: Array<WordTimestamp[]> = [];
    let currentPhrase: WordTimestamp[] = [];

    for (const w of clipWords) {
      currentPhrase.push(w);
      if (
        currentPhrase.length >= (style.preset === "plain" ? 6 : 4) ||
        w.word.endsWith(".") ||
        w.word.endsWith("?") ||
        w.word.endsWith("!")
      ) {
        phrases.push(currentPhrase);
        currentPhrase = [];
      }
    }
    if (currentPhrase.length > 0) phrases.push(currentPhrase);

    const events: string[] = [];

    for (const phrase of phrases) {
      if (phrase.length === 0) continue;

      const phraseStart = Math.max(0, phrase[0].start - clipStartSec);
      const phraseEnd = Math.max(phraseStart + 0.5, phrase[phrase.length - 1].end - clipStartSec);

      const formatCase = (str: string) => {
        if (style.textCase === "uppercase" || style.allCaps) return str.toUpperCase();
        if (style.textCase === "lowercase") return str.toLowerCase();
        if (style.textCase === "capitalize") {
          return str.replace(/\b\w/g, (c) => c.toUpperCase());
        }
        return str;
      };

      if (style.preset === "plain" || !style.karaokeEnabled) {
        // Standard clean subtitle (no individual word karaoke timing tags)
        const plainText = formatCase(phrase.map((w) => w.word).join(" "));
        events.push(
          `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,${plainText}`
        );
      } else {
        // Karaoke active word tags: {\k<duration_in_centiseconds>}word
        const phraseTokens: string[] = [];
        for (const w of phrase) {
          const wordDurCentis = Math.max(10, Math.round((w.end - w.start) * 100));
          const displayWord = formatCase(w.word);

          phraseTokens.push(`{\\k${wordDurCentis}}${displayWord}`);
        }

        const textPayload = phraseTokens.join(" ");
        events.push(
          `Dialogue: 0,${formatAssTime(phraseStart)},${formatAssTime(phraseEnd)},Default,,0,0,0,,{\\kf}${textPayload}`
        );
      }
    }

    const fullContent = header + events.join("\n") + "\n";
    fs.writeFileSync(outputPath, fullContent, "utf-8");

    return { success: true, data: outputPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal membuat file subtitle ASS";
    return { success: false, error: msg };
  }
}


function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}
