import React, { useMemo, useEffect, useRef } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { WordTimestamp } from "@/lib/xclips/types";
import { PhraseSegment, ITEM_BASE_HEIGHT, ITEM_EXPANDED_HEIGHT } from "../types/studio.types";

export function useTranscriptVirtualizer(virtualScrollRef: React.RefObject<HTMLDivElement | null>) {
  const editableWords = useStudioStore((s) => s.editableWords);
  const setEditableWords = useStudioStore((s) => s.setEditableWords);
  const currentTime = useStudioStore((s) => s.currentTime);
  const subtitleOffsetMs = useStudioStore((s) => s.subtitleOffsetMs);
  const expandedPhraseId = useStudioStore((s) => s.expandedPhraseId);
  const searchQuery = useStudioStore((s) => s.searchQuery);
  const autoScrollToPlayhead = useStudioStore((s) => s.autoScrollToPlayhead);
  const scrollTop = useStudioStore((s) => s.scrollTop);

  // Group raw word timestamps into phrase segments
  const phraseSegments = useMemo<PhraseSegment[]>(() => {
    if (!editableWords || editableWords.length === 0) return [];

    const segments: PhraseSegment[] = [];
    let currentWords: WordTimestamp[] = [];
    let segIdx = 0;

    for (let i = 0; i < editableWords.length; i++) {
      const w = editableWords[i];
      currentWords.push(w);

      const isPunctuationEnd = /[.?!,;:]$/.test(w.word.trim());
      const isMaxWords = currentWords.length >= 6;
      const nextWord = editableWords[i + 1];
      const isTimeGap = nextWord && (nextWord.start - w.end) > 0.8;

      if (isPunctuationEnd || isMaxWords || isTimeGap || i === editableWords.length - 1) {
        const startSec = currentWords[0].start;
        const endSec = currentWords[currentWords.length - 1].end;
        const text = currentWords.map((cw) => cw.word).join(" ");

        segments.push({
          id: `seg_${segIdx}_${startSec.toFixed(2)}`,
          index: segIdx,
          startSec,
          endSec,
          text,
          words: [...currentWords],
        });

        currentWords = [];
        segIdx++;
      }
    }

    return segments;
  }, [editableWords]);

  // Filter phrases based on search query
  const filteredPhrases = useMemo(() => {
    if (!searchQuery.trim()) return phraseSegments;
    const q = searchQuery.toLowerCase().trim();
    return phraseSegments.filter((p) => p.text.toLowerCase().includes(q));
  }, [phraseSegments, searchQuery]);

  // Item height and top offsets calculation for virtualized list
  const itemPositions = useMemo(() => {
    const positions: { top: number; height: number }[] = [];
    let currentTop = 0;
    filteredPhrases.forEach((p) => {
      const isExpanded = expandedPhraseId === p.id;
      const height = isExpanded ? ITEM_EXPANDED_HEIGHT : ITEM_BASE_HEIGHT;
      positions.push({ top: currentTop, height });
      currentTop += height + 6; // 6px sleek gap
    });
    return { positions, totalHeight: currentTop };
  }, [filteredPhrases, expandedPhraseId]);

  // Find visible slice
  const OVERSCAN = 3;
  const visibleRange = useMemo(() => {
    const { positions } = itemPositions;
    if (positions.length === 0) return { start: 0, end: 0 };

    let start = 0;
    while (start < positions.length && positions[start].top + positions[start].height < scrollTop) {
      start++;
    }
    start = Math.max(0, start - OVERSCAN);

    let end = start;
    while (end < positions.length && positions[end].top < scrollTop + 800) {
      end++;
    }
    end = Math.min(positions.length - 1, end + OVERSCAN);

    return { start, end };
  }, [scrollTop, itemPositions]);

  // Effective playback time for subtitles considering user-calibrated timing offset
  const effectiveSubtitleTime = currentTime - subtitleOffsetMs / 1000;

  // Active word in current playback time
  const currentWord = editableWords.find(
    (w) => effectiveSubtitleTime >= w.start && effectiveSubtitleTime <= w.end
  );

  // Active phrase segment in current playback time with calibrated offset and 0.35s hang tolerance
  const currentActivePhrase = phraseSegments.find(
    (p) => effectiveSubtitleTime >= p.startSec && effectiveSubtitleTime <= (p.endSec + 0.35)
  );

  // Auto-scroll to active playing phrase
  const activePhraseIndex = useMemo(() => {
    const effectiveTime = currentTime - subtitleOffsetMs / 1000;
    return filteredPhrases.findIndex(
      (p) => effectiveTime >= p.startSec && effectiveTime <= (p.endSec + 0.35)
    );
  }, [filteredPhrases, currentTime, subtitleOffsetMs]);

  const isAutoScrollingRef = useRef(false);
  useEffect(() => {
    if (!autoScrollToPlayhead || activePhraseIndex === -1 || !virtualScrollRef.current) return;
    const pos = itemPositions.positions[activePhraseIndex];
    if (!pos || isAutoScrollingRef.current) return;

    const containerHeight = virtualScrollRef.current.clientHeight || 450;
    const targetScroll = Math.max(0, pos.top - containerHeight / 2 + pos.height / 2);
    const diff = Math.abs(virtualScrollRef.current.scrollTop - targetScroll);
    if (diff > 140) {
      isAutoScrollingRef.current = true;
      virtualScrollRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 400);
    }
  }, [activePhraseIndex, autoScrollToPlayhead, itemPositions, virtualScrollRef]);

  // Update a phrase's text and distribute timestamps proportionally
  const handleUpdatePhraseText = (phraseIndex: number, newText: string) => {
    const segment = phraseSegments[phraseIndex];
    if (!segment) return;

    const newWordTokens = newText.trim().split(/\s+/).filter(Boolean);
    if (newWordTokens.length === 0) return;

    const dur = segment.endSec - segment.startSec;
    const tokenDur = dur / newWordTokens.length;

    const newWordsForPhrase: WordTimestamp[] = newWordTokens.map((token, i) => ({
      word: token,
      start: Math.round((segment.startSec + i * tokenDur) * 100) / 100,
      end: Math.round((segment.startSec + (i + 1) * tokenDur) * 100) / 100,
      confidence: 1.0,
      isFiller: false,
      excluded: false,
    }));

    const updatedFullList: WordTimestamp[] = [];
    phraseSegments.forEach((seg, sIdx) => {
      if (sIdx === phraseIndex) {
        updatedFullList.push(...newWordsForPhrase);
      } else {
        updatedFullList.push(...seg.words);
      }
    });

    setEditableWords(updatedFullList);
  };

  // Reorder phrase segments via drag and drop
  const handleReorderPhrases = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...phraseSegments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const newWordsList: WordTimestamp[] = [];
    reordered.forEach((seg) => {
      newWordsList.push(...seg.words);
    });
    setEditableWords(newWordsList);
  };

  // Render Highlighted Search Text
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} style={{ backgroundColor: "#FACC15", color: "#000000", fontWeight: 800, padding: "0 2px", borderRadius: "2px" }}>
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return {
    phraseSegments,
    filteredPhrases,
    itemPositions,
    visibleRange,
    effectiveSubtitleTime,
    currentWord,
    currentActivePhrase,
    activePhraseIndex,
    handleUpdatePhraseText,
    handleReorderPhrases,
    renderHighlightedText,
  };
}
