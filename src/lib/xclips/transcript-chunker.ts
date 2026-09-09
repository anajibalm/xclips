import { WordTimestamp, Result } from "@/lib/xclips/types";

export interface TranscriptChunk {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  text: string;
  words: WordTimestamp[];
}

export interface CandidateHighlight {
  title: string;
  hookText: string;
  viralScore: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  summary: string;
}

export const DEFAULT_CHUNK_DURATION_SEC = 900; // 15 minutes
export const DEFAULT_CHUNK_OVERLAP_SEC = 30; // 30 seconds

/**
 * Splits a full word-timestamp array into overlapping 15-minute chunks for scalable LLM processing
 */
export function chunkTranscript(
  words: WordTimestamp[],
  chunkDuration: number = DEFAULT_CHUNK_DURATION_SEC,
  overlap: number = DEFAULT_CHUNK_OVERLAP_SEC
): TranscriptChunk[] {
  if (!words || words.length === 0) return [];

  const totalDuration = words[words.length - 1].end;
  if (totalDuration <= chunkDuration) {
    return [
      {
        chunkIndex: 0,
        startSec: 0,
        endSec: totalDuration,
        text: words.map((w) => w.word).join(" "),
        words,
      },
    ];
  }

  const chunks: TranscriptChunk[] = [];
  let currentStart = 0;
  let chunkIdx = 0;

  while (currentStart < totalDuration) {
    const currentEnd = Math.min(totalDuration, currentStart + chunkDuration);
    const chunkWords = words.filter(
      (w) => w.start >= currentStart && w.end <= currentEnd + 5
    );

    if (chunkWords.length > 0) {
      chunks.push({
        chunkIndex: chunkIdx++,
        startSec: currentStart,
        endSec: currentEnd,
        text: chunkWords.map((w) => w.word).join(" "),
        words: chunkWords,
      });
    }

    if (currentEnd >= totalDuration) break;
    currentStart += chunkDuration - overlap;
  }

  return chunks;
}

const HOOK_PROMPT_MAP: Record<string, string> = {
  "01_myth_buster": "HOOK FORMULA: MYTH BUSTER (Myth vs. Reality). Find moments that debunk common misconceptions or false assumptions, starting with a surprising counter-statement and clarifying with valid facts/data.",
  "02_data_speaks": "HOOK FORMULA: DATA SPEAKS (Eye-Opening Numbers & Stats). Find moments highlighting striking statistics, metrics, or numbers that command instant attention and create sudden awareness.",
  "03_hidden_right": "HOOK FORMULA: HIDDEN RIGHT (Overlooked Rights & Opportunities). Find moments explaining hidden perks, legal rights, or unfair advantages that few people take advantage of.",
  "04_silent_risk": "HOOK FORMULA: SILENT RISK (Hidden Dangers & Warnings). Find moments warning about dangerous blindspots, compounding risks, or costly mistakes that people ignore.",
  "05_speed_proof": "HOOK FORMULA: SPEED PROOF (Rapid Progress & Milestones). Find moments showcasing rapid transformation, lightning-fast execution, or unexpected acceleration.",
  "06_local_hero": "HOOK FORMULA: LOCAL HERO (Grassroots Action, Massive Impact). Find inspiring stories of small initial actions creating massive ripple effects.",
  "07_little_known": "HOOK FORMULA: LITTLE-KNOWN (Behind-the-Scenes Insights). Find moments uncovering insider secrets, hidden mechanics, or unpublicized facts.",
  "08_plot_twist": "HOOK FORMULA: PLOT TWIST (Unexpected Reversal). Find moments with dramatic contradictions where the true reality is the exact opposite of initial assumptions.",
  "09_honest_talk": "HOOK FORMULA: HONEST TALK (Candid Confession & Solution). Find vulnerable, transparent moments acknowledging tough challenges while providing actionable solutions.",
  "10_not_your_fault": "HOOK FORMULA: NOT YOUR FAULT (Empathy & Clarity). Find moments relieving viewer anxiety, validating frustrations, and giving clear reassurance with constructive next steps.",
  "11_step_by_step": "HOOK FORMULA: STEP BY STEP (Actionable Blueprint). Find instructional moments walking through a practical, easy-to-follow sequence of steps.",
  "12_surprising_link": "HOOK FORMULA: SURPRISING LINK (Unexpected Analogy). Find clever comparisons and analogies bridging simple everyday ideas to big paradigm shifts.",
  "13_near_future": "HOOK FORMULA: NEAR FUTURE (Upcoming Vision & Roadmap). Find forward-looking moments discussing trends, predictions, or exciting future opportunities.",
  "14_are_you_in": "HOOK FORMULA: ARE YOU IN? (Direct Audience Qualification). Find moments directly calling out specific audience criteria and inviting them into action.",
  "15_ripple_effect": "HOOK FORMULA: RIPPLE EFFECT (Domino Effect). Find moments demonstrating how one simple decision today unlocks exponential returns down the road.",
  "auto": "HOOK FORMULA: AUTO (AI Best Fit). Find moments with the strongest retention pattern interrupt, punchy 3-second hook, and high-value payoff.",
};

/**
 * Generates prompt for AI LLM to discover viral highlights in a transcript chunk
 */
export function buildHighlightPrompt(
  chunk: TranscriptChunk,
  options?: {
    topicPrompt?: string;
    editorialFunction?: string;
    hookFormula?: string;
    targetDuration?: "short" | "standard" | "long" | "extended";
    strictBoundary?: boolean;
    outputLanguage?: string;
    videoMetadata?: {
      title?: string;
      channel?: string;
      description?: string;
      webpageUrl?: string;
    };
  }
): string {
  let minSec = 45;
  let maxSec = 75;
  if (options?.targetDuration === "short") {
    minSec = 30;
    maxSec = 45;
  } else if (options?.targetDuration === "long") {
    minSec = 75;
    maxSec = 120;
  } else if (options?.targetDuration === "extended") {
    minSec = 120;
    maxSec = 180;
  }

  const topicInstruction = options?.topicPrompt && options.topicPrompt.trim()
    ? `\nTARGET TOPIC / NARRATIVE FOCUS:\nPrioritize points and discussion segments that specifically cover: "${options.topicPrompt.trim()}". Ensure the selected clips address this topic comprehensively and accurately.\n`
    : "";

  // Bakom content function/category, manually selected by the operator.
  // Planning context only — never conflated with hookFormula mechanics.
  const editorialFunctionInstruction = options?.editorialFunction && options.editorialFunction.trim()
    ? `\nEDITORIAL FUNCTION CONTEXT:\nThe selected clips serve this Bakom content function: "${options.editorialFunction.trim()}". Prefer moments that fulfill this function while staying within the target topic.\n`
    : "";

  const formulaKey = options?.hookFormula || "auto";
  const formulaInstruction = HOOK_PROMPT_MAP[formulaKey]
    ? `\nHOOK FORMULA GUIDELINE:\n${HOOK_PROMPT_MAP[formulaKey]}\n`
    : "";

  const boundaryInstruction = options?.strictBoundary !== false
    ? `\nSTRICT NARRATIVE BOUNDARY:\n- Clip start (startSec) MUST align with the beginning of a complete, standalone thought/sentence (with natural opening context).\n- Clip end (endSec) MUST land cleanly after the thought or grammatical sentence concludes (NEVER cut off mid-sentence or leave thoughts hanging).\n`
    : "";

  const langCode = options?.outputLanguage || "auto";
  let languageInstruction = "";
  if (langCode === "auto") {
    languageInstruction = `\nLANGUAGE REQUIREMENT (CRITICAL):\n- Auto-detect the primary spoken language used in the provided TRANSCRIPT chunk.\n- ALL output fields ("title", "hookText", "summary") MUST be written strictly and naturally in that SAME detected transcript language (e.g. if the transcript is in Indonesian, write 100% fluent Indonesian title, hookText, and summary).\n- DO NOT translate or default to English if the transcript is in Indonesian or another non-English language.\n`;
  } else if (langCode === "id") {
    languageInstruction = `\nLANGUAGE REQUIREMENT (CRITICAL):\n- ALL output fields ("title", "hookText", "summary") MUST be written strictly in natural, engaging BAHASA INDONESIA.\n- DO NOT output in English or any other language.\n`;
  } else {
    const langMap: Record<string, string> = {
      en: "English",
      es: "Spanish (Español)",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)",
      ar: "Arabic (العربية)",
      de: "German (Deutsch)",
      fr: "French (Français)",
    };
    const targetName = langMap[langCode] || langCode;
    languageInstruction = `\nLANGUAGE REQUIREMENT (CRITICAL):\n- ALL output fields ("title", "hookText", "summary") MUST be written strictly in ${targetName}.\n`;
  }

  let metadataContext = "";
  if (options?.videoMetadata) {
    const metaParts: string[] = [];
    if (options.videoMetadata.title) metaParts.push(`- Title: ${options.videoMetadata.title}`);
    if (options.videoMetadata.channel) metaParts.push(`- Channel / Creator: ${options.videoMetadata.channel}`);
    if (options.videoMetadata.webpageUrl) metaParts.push(`- Source URL: ${options.videoMetadata.webpageUrl}`);
    if (options.videoMetadata.description) {
      metaParts.push(`- Description Excerpt: ${options.videoMetadata.description.slice(0, 500).replace(/[\r\n]+/g, " ")}`);
    }
    if (metaParts.length > 0) {
      metadataContext = `\nSOURCE VIDEO METADATA (YOUTUBE / MEDIA):\n${metaParts.join("\n")}\n`;
    }
  }

  return `You are a professional AI Video Producer & Short-Form Content Strategist (TikTok, Reels, Shorts).
Your goal is to analyze the following transcript segment (from second ${chunk.startSec.toFixed(0)} to ${chunk.endSec.toFixed(0)}) and identify 2 to 4 highest-value, highly engaging, and coherent short-form clip moments (target duration ${minSec}-${maxSec} seconds per clip).
${languageInstruction}${metadataContext}${topicInstruction}${editorialFunctionInstruction}${formulaInstruction}${boundaryInstruction}
TRANSCRIPT:
"""
${chunk.text}
"""

OUTPUT RULES:
1. Respond ONLY with a valid JSON object (no conversational preamble or markdown outside JSON).
2. JSON Schema:
{
  "highlights": [
    {
      "title": "Editorial headline in Target Language (5-10 words): concrete actor + action + consequence/stakes from THIS clip only",
      "hookText": "Opening 3-second hook in Target Language that sparks instant curiosity",
      "viralScore": 92, // Integer 0-100
      "startSec": 124.5, // Absolute start time in seconds
      "endSec": 178.0, // Absolute end time in seconds
      "summary": "Brief explanation in Target Language of core takeaway and why this clip converts"
    }
  ]
}
3. Ensure startSec and endSec stay strictly within [${chunk.startSec.toFixed(0)}, ${chunk.endSec.toFixed(0)}] with clip duration between ${minSec} and ${maxSec} seconds.
4. Ensure "title", "hookText", and "summary" strictly adhere to the LANGUAGE REQUIREMENT above.
5. HEADLINE CONTRACT (the "title" doubles as the on-video editorial headline — never a generic topic label):
- Name the concrete actor/action and the consequence or stakes stated in THIS clip's transcript.
- Prefer the specific subject of the selected statement over category nouns (never output vague labels like "preparation", "disaster", or their equivalents).
- Ground every claim in the TRANSCRIPT above; invent nothing, add no sensational clickbait.
- Correctness beats word count, but aim for roughly 5-10 words.`;
}

/**
 * Parses and merges raw AI highlight outputs from multiple chunks, removing overlaps
 */
export function reduceAndRankHighlights(
  rawHighlights: CandidateHighlight[],
  maxResults: number = 5
): CandidateHighlight[] {
  if (!rawHighlights || rawHighlights.length === 0) return [];

  // Sort primarily by viralScore descending
  const sorted = [...rawHighlights].sort((a, b) => b.viralScore - a.viralScore);

  const deduplicated: CandidateHighlight[] = [];

  for (const item of sorted) {
    item.durationSec = Math.round((item.endSec - item.startSec) * 10) / 10;

    // Check if this highlight heavily overlaps with an already chosen highlight (>40% overlap)
    const isDuplicate = deduplicated.some((chosen) => {
      const overlapStart = Math.max(item.startSec, chosen.startSec);
      const overlapEnd = Math.min(item.endSec, chosen.endSec);
      if (overlapEnd > overlapStart) {
        const overlapDur = overlapEnd - overlapStart;
        return overlapDur > 0.4 * Math.min(item.durationSec, chosen.durationSec);
      }
      return false;
    });

    if (!isDuplicate && item.durationSec >= 20 && item.durationSec <= 210) {
      deduplicated.push(item);
    }
  }

  return deduplicated.slice(0, maxResults);
}

// ============================================================
// S1.3 — Dedicated grounded headline generation
// ============================================================
// The headline model sees ONLY the final guarded selected transcript
// plus verified identity labels. It never sees the full transcript,
// neighboring chunks, video titles, or descriptions.

export interface HeadlineGenerationInput {
  /** Spoken text sliced strictly inside the FINAL guarded statement bounds. */
  selectedText: string;
  /** Verified speaker identity, only when already available (else omit). */
  speaker?: string;
  /** Verified publisher/source identity (else omit). */
  publisher?: string;
  /** BCP-47-ish language hint ("auto" follows the selected text). */
  outputLanguage?: string;
}

/**
 * Builds the dedicated headline prompt. Claim-bearing context is limited
 * to selectedText; speaker/publisher are identity labels only and must
 * not supply actions, objects, consequences, or stakes.
 */
export function buildHeadlinePrompt(input: HeadlineGenerationInput): string {
  // Identity labels are uploader-controlled strings: flatten newlines and cap
  // length so they cannot forge extra "verified" prompt lines.
  const flatLabel = (s: string): string => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const identityLines: string[] = [];
  const speaker = flatLabel(input.speaker || "");
  const publisher = flatLabel(input.publisher || "");
  if (speaker) {
    identityLines.push(`- Speaker (verified identity label only): ${speaker}`);
  }
  if (publisher) {
    identityLines.push(`- Publisher/source (verified identity label only): ${publisher}`);
  }
  const identityBlock = identityLines.length > 0
    ? `\nVERIFIED IDENTITY (labels only — never a source of actions, objects, or stakes):\n${identityLines.join("\n")}\n`
    : "";
  const lang = (input.outputLanguage || "auto").trim() || "auto";
  const languageLine = lang === "auto"
    ? "Write the headline in the same language as the SELECTED TRANSCRIPT above."
    : `Write the headline strictly in ${lang}.`;
  // Neutralize the transcript fence so ASR text cannot break out of it.
  const fencedTranscript = input.selectedText.replace(/"""/g, '"');

  return `You are an editorial headline writer for short-form news video.
Write ONE headline for the selected clip below.

SELECTED TRANSCRIPT (the ONLY source of claim content — nothing outside it exists):
"""
${fencedTranscript}
"""
${identityBlock}
HEADLINE RULES:
1. Ground EVERY claim (actor, action, object, consequence) ONLY in the SELECTED TRANSCRIPT above.
2. Verified identity labels above may supply a speaker/publisher NAME and nothing else.
3. Prefer concrete actor/action when the transcript supports them; otherwise stay conservative.
4. Concise and useful as an on-video editorial headline, roughly 5-10 words (correctness beats count).
5. No generic topic/category labels, no invented objects/actions/stakes, no clickbait.
6. No unsupported causal framing. No quotes unless the exact quoted words appear in the SELECTED TRANSCRIPT.
7. ${languageLine}

OUTPUT RULES:
1. Respond ONLY with a valid JSON object (no preamble, no markdown).
2. JSON Schema: { "headline": "Headline text here" }`;
}

/**
 * Strict parser for the dedicated headline response.
 * Mirrors the highlight JSON convention (fences stripped, object extracted).
 */
export function parseHeadlineResponse(raw: string): Result<{ headline: string }> {
  if (!raw || typeof raw !== "string") {
    return { success: false, error: "Empty headline response" };
  }
  try {
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return { success: false, error: "Headline response contains no JSON object" };
    const parsed = JSON.parse(match[0]) as { headline?: unknown };
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    if (!headline) return { success: false, error: "Headline response has empty headline" };
    return { success: true, data: { headline } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Invalid headline JSON: ${msg}` };
  }
}

// Small Indonesian + English stopword set for the grounding validator.
// Content-word check only — never a semantic judge.
const HEADLINE_STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "adalah", "ialah",
  "ini", "itu", "tersebut", "para", "sang", "sebuah", "seorang", "akan", "telah",
  "sudah", "belum", "tidak", "tak", "jangan", "bukan", "atau", "serta", "karena",
  "jika", "kalau", "agar", "supaya", "namun", "tetapi", "tapi", "sedangkan",
  "sementara", "saat", "ketika", "setelah", "sebelum", "oleh", "kepada", "dalam",
  "antara", "tentang", "bagai", "seperti", "sangat", "lebih", "paling", "cukup",
  "hanya", "saja", "juga", "lagi", "masih", "semakin", "the", "and", "for",
  "with", "from", "that", "this", "nya",
]);

const IDENTITY_NOISE = /\b(tv|news|channel|official|media|resmi|berita|network|group)\b/gi;
const IDENTITY_MAX_TOKENS = 3;

const tokenizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Minimal deterministic grounding validator (S1.3).
 *
 * Flags headline content words (length >= 5, non-stopword) that appear
 * neither in the selected transcript nor in verified identity name tokens.
 * Morphology-tolerant matching applies to transcript words only.
 * Paraphrase-safe by design: it only catches clearly imported nouns/entities.
 * Never throws; never rejects — callers map flags to NEEDS_REVIEW.
 */
export function validateHeadlineGrounding(
  headline: string,
  selectedText: string,
  verifiedIdentity?: { speaker?: string },
): { grounded: boolean; suspicious: string[] } {
  const transcriptTokens = new Set(tokenizeWords(selectedText));
  const identityTokens = new Set(
    tokenizeWords((verifiedIdentity?.speaker || "").replace(IDENTITY_NOISE, "")).slice(0, IDENTITY_MAX_TOKENS),
  );
  const suspicious: string[] = [];

  const headlineTokens = tokenizeWords(headline);
  if (headline.trim() && headlineTokens.length === 0) {
    return { grounded: false, suspicious: ["<unverifiable-script>"] };
  }

  for (const token of headlineTokens) {
    if (token.length < 5) continue;
    if (HEADLINE_STOPWORDS.has(token)) continue;
    if (identityTokens.has(token)) continue;
    if (transcriptTokens.has(token)) continue;
    let supported = false;
    for (const ref of transcriptTokens) {
      if (ref.length < 4 || token.length < 4) continue;
      if (ref.includes(token) || token.includes(ref)) {
        supported = true;
        break;
      }
    }
    if (!supported) suspicious.push(token);
  }

  return { grounded: suspicious.length === 0, suspicious };
}

/**
 * Deterministic grounded fallback (S1.3 Mission D): first complete
 * meaningful sentence fragment from the selected transcript, capped at
 * 12 words. No LLM, no invented content. Empty string when the selected
 * transcript carries no usable sentence (caller routes to NEEDS_REVIEW).
 */
export function fallbackHeadlineFromTranscript(selectedText: string): string {
  if (!selectedText || !selectedText.trim()) return "";
  const sentences = selectedText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/^[.,!?;:"'“”‘’\s]+/, "").trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return words.slice(0, 12).join(" ").replace(/[.!?…]+$/, "");
    }
  }
  const words = selectedText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 12).join(" ").replace(/[.!?…]+$/, "");
  return "";
}
