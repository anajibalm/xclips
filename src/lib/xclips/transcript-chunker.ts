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

/**
 * Generates prompt for AI LLM to discover viral highlights in a transcript chunk
 */
export function buildHighlightPrompt(
  chunk: TranscriptChunk,
  options?: {
    topicPrompt?: string;
    targetDuration?: "short" | "standard" | "long";
    strictBoundary?: boolean;
  }
): string {
  let minSec = 30;
  let maxSec = 75;
  if (options?.targetDuration === "short") {
    minSec = 25;
    maxSec = 45;
  } else if (options?.targetDuration === "long") {
    minSec = 60;
    maxSec = 120;
  }

  const topicInstruction = options?.topicPrompt && options.topicPrompt.trim()
    ? `\nFOKUS TOPIK KHUSUS:\nPrioritaskan poin dan narasi yang membahas: "${options.topicPrompt.trim()}". Pastikan klip yang dipilih menjawab atau mengulas topik ini secara mendalam dan akurat.\n`
    : "";

  const boundaryInstruction = options?.strictBoundary !== false
    ? `\nBATASAN NARASI KETAT (STRICT BOUNDARY):\n- Titik awal (startSec) WAJIB berada di awal pembukaan kalimat/gagasan yang mandiri (ada konteks pembuka).\n- Titik akhir (endSec) WAJIB berada tepat setelah kesimpulan atau kalimat selesai secara gramatikal (TIDAK BOLEH menggantung atau memotong di tengah kalimat).\n`
    : "";

  return `Anda adalah AI Video Producer & Short-Form Content Strategist profesional (TikTok, Reels, Shorts).
Tugas Anda adalah menganalisis transkrip rekaman berikut (dimulai dari detik ${chunk.startSec.toFixed(0)} hingga detik ${chunk.endSec.toFixed(0)}) dan menemukan 2 hingga 4 momen paling bernilai tinggi, koheren, dan akurat (target durasi ${minSec}-${maxSec} detik per klip).
${topicInstruction}${boundaryInstruction}
TRANSKRIP:
"""
${chunk.text}
"""

ATURAN OUTPUT:
1. Berikan respon HANYA berupa JSON valid (tanpa penjelasan tambahan di luar JSON).
2. Format struktur JSON:
{
  "highlights": [
    {
      "title": "Judul Menarik Singkat (Maks 5 Kata)",
      "hookText": "Kalimat pembuka 3 detik pertama yang memancing rasa penasaran",
      "viralScore": 92, // Integer 0-100
      "startSec": 124.5, // Waktu mulai absolut dalam detik
      "endSec": 178.0, // Waktu selesai absolut dalam detik
      "summary": "Penjelasan poin narasi utama dan mengapa bagian ini bernilai"
    }
  ]
}
3. Pastikan startSec dan endSec berada dalam rentang [${chunk.startSec.toFixed(0)}, ${chunk.endSec.toFixed(0)}] dan durasi klip antara ${minSec} s.d ${maxSec} detik.`;
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

    if (!isDuplicate && item.durationSec >= 20 && item.durationSec <= 150) {
      deduplicated.push(item);
    }

    if (deduplicated.length >= maxResults) break;
  }

  return deduplicated;
}
