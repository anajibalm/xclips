import { describe, it, expect } from "bun:test";
import {
  DEFAULT_SUBTITLE_STYLE,
  PRESET_STYLES,
  SUBTITLE_PRESET_OPTIONS,
  getPresetSubtitleStyle,
} from "@/lib/xclips/subtitle-presets";
import { SubtitlePreset, SubtitlePresetSchema } from "@/lib/xclips/types";

describe("xclips - Subtitle Presets & Ingest Master Style Spec", () => {
  it("should return valid default standard clean style when preset is plain or undefined", () => {
    const defaultPlain = getPresetSubtitleStyle("plain");
    expect(defaultPlain.preset).toBe("plain");
    expect(defaultPlain.fontFamily).toBe("Inter");
    expect(defaultPlain.primaryColor).toBe("#FFFFFF");
    expect(defaultPlain.enabled).toBe(true);
    expect(defaultPlain.boxWidth).toBe(76);
    expect(defaultPlain.boxWidthMode).toBe("custom");

    const undefinedPreset = getPresetSubtitleStyle(undefined);
    expect(undefinedPreset.preset).toBe("plain");
    expect(undefinedPreset.fontFamily).toBe("Inter");
    expect(undefinedPreset.boxWidth).toBe(76);
    expect(undefinedPreset.boxWidthMode).toBe("custom");
  });

  it("should apply correct styling overrides for Hormozi Viral preset", () => {
    const hormozi = getPresetSubtitleStyle("hormozi");
    expect(hormozi.preset).toBe("hormozi");
    expect(hormozi.fontFamily).toBe("Anton");
    expect(hormozi.highlightColor).toBe("#FACC15");
    expect(hormozi.karaokeEnabled).toBe(true);
    expect(hormozi.allCaps).toBe(true);
    expect(hormozi.outlineWidth).toBe(3.5);
  });

  it("should apply correct styling overrides for MrBeast Action preset", () => {
    const beast = getPresetSubtitleStyle("beast");
    expect(beast.preset).toBe("beast");
    expect(beast.fontFamily).toBe("Bebas Neue");
    expect(beast.secondaryColor).toBe("#38BDF8");
    expect(beast.karaokeEnabled).toBe(true);
  });

  it("should apply correct styling overrides for Clean Modern Box preset", () => {
    const cleanBox = getPresetSubtitleStyle("clean_box");
    expect(cleanBox.preset).toBe("clean_box");
    expect(cleanBox.boxOpacity).toBe(0.8);
    expect(cleanBox.outlineWidth).toBe(0);
  });

  it("should ensure every option in SUBTITLE_PRESET_OPTIONS validates against SubtitlePresetSchema", () => {
    for (const opt of SUBTITLE_PRESET_OPTIONS) {
      expect(() => SubtitlePresetSchema.parse(opt.id)).not.toThrow();
      expect(opt.name.length).toBeGreaterThan(0);
      expect(opt.badge.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);

      const resolved = getPresetSubtitleStyle(opt.id);
      expect(resolved.preset).toBe(opt.id);
      expect(resolved.enabled).toBe(true);
    }
  });

  it("should serialize masterStyle with chosen preset cleanly to JSON for project storage", () => {
    const chosenPreset: SubtitlePreset = "hormozi";
    const masterSubtitleStyle = getPresetSubtitleStyle(chosenPreset);

    const masterStyle = {
      aspectRatio: "9:16" as const,
      layoutMode: "blur_bg" as const,
      subtitleStyle: masterSubtitleStyle,
    };

    const jsonStr = JSON.stringify(masterStyle);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.subtitleStyle.preset).toBe("hormozi");
    expect(parsed.subtitleStyle.fontFamily).toBe("Anton");
    expect(parsed.aspectRatio).toBe("9:16");
    expect(parsed.layoutMode).toBe("blur_bg");
  });
});
