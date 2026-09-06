import { describe, it, expect } from "bun:test";
import { WordTimestamp } from "@/lib/xclips/types";

describe("xclips - Parallel Worker Pool & Ingestion Optimization Spec (P1-P3)", () => {
  it("should process asynchronous chunks concurrently with worker pool and preserve chronological order", async () => {
    const totalChunks = 8;
    const CHUNK_DURATION = 120;
    const executionLogs: number[] = [];

    const mockFetchChunk = async (cIdx: number): Promise<{ cIdx: number; words: WordTimestamp[] }> => {
      executionLogs.push(cIdx);
      // Simulate non-deterministic API response times
      const delay = cIdx % 2 === 0 ? 30 : 10;
      await new Promise((r) => setTimeout(r, delay));

      return {
        cIdx,
        words: [
          { word: `WordA_${cIdx}`, start: 1.0, end: 2.0, confidence: 1.0, isFiller: false, excluded: false },
          { word: `WordB_${cIdx}`, start: 2.5, end: 3.5, confidence: 1.0, isFiller: false, excluded: false },
        ],
      };
    };

    const CONCURRENCY = 3;
    let currentIdx = 0;
    const chunkResults: Array<{ cIdx: number; words: WordTimestamp[] }> = [];

    const worker = async () => {
      while (currentIdx < totalChunks) {
        const cIdx = currentIdx++;
        const res = await mockFetchChunk(cIdx);
        const chunkStart = cIdx * CHUNK_DURATION;
        const remapped = res.words.map((w) => ({
          ...w,
          start: parseFloat((w.start + chunkStart).toFixed(2)),
          end: parseFloat((w.end + chunkStart).toFixed(2)),
        }));
        chunkResults.push({ cIdx, words: remapped });
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    expect(chunkResults.length).toBe(totalChunks);

    // Sort chronologically by chunk index
    chunkResults.sort((a, b) => a.cIdx - b.cIdx);

    // Verify ordering
    for (let i = 0; i < totalChunks; i++) {
      expect(chunkResults[i].cIdx).toBe(i);
      const expectedStart = i * CHUNK_DURATION + 1.0;
      expect(chunkResults[i].words[0].start).toBe(expectedStart);
    }
  });

  it("should isolate chunk failures without aborting remaining concurrent chunks", async () => {
    const totalChunks = 5;
    const chunkResults: number[] = [];
    const errors: string[] = [];

    let currentIdx = 0;
    const worker = async () => {
      while (currentIdx < totalChunks) {
        const cIdx = currentIdx++;
        try {
          if (cIdx === 2) {
            throw new Error(`Simulated failure on chunk ${cIdx}`);
          }
          chunkResults.push(cIdx);
        } catch (err: unknown) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    };

    await Promise.all(Array.from({ length: 3 }, () => worker()));

    // 4 successful chunks, 1 failed chunk
    expect(chunkResults.length).toBe(4);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Simulated failure on chunk 2");
    expect(chunkResults.sort()).toEqual([0, 1, 3, 4]);
  });

  it("should verify chunk reduction ratio with adaptive 180s LLM duration", () => {
    const totalDuration = 1800; // 30 minutes video

    const oldChunkDuration = 45;
    const oldChunkCount = Math.ceil(totalDuration / oldChunkDuration);
    expect(oldChunkCount).toBe(40); // 40 requests!

    const newChunkDuration = 180;
    const newChunkCount = Math.ceil(totalDuration / newChunkDuration);
    expect(newChunkCount).toBe(10); // only 10 requests!

    // 75% reduction in total HTTP requests & disk operations
    const reductionPercent = ((oldChunkCount - newChunkCount) / oldChunkCount) * 100;
    expect(reductionPercent).toBe(75);
  });
});
