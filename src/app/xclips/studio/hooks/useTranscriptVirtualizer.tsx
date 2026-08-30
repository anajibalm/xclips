import React, { useMemo, useEffect, useRef, useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { WordTimestamp } from "@/lib/xclips/types";
import { PhraseSegment, ITEM_BASE_HEIGHT, ITEM_EXPANDED_HEIGHT } from "../types/studio.types";
import { segmentPhrases } from "@/lib/xclips/phrase-segmentation";

export function useTranscriptVirtualizer(virtualScrollRef: React.RefObject<HTMLDivElement | null>) {
  const editableWords = useStudioStore((s) => s.editableWords);
  const setEditableWords = useStudioStore((s) => s.setEditableWords);
  const currentTime = useStudioStore((s) => s.currentTime);
  const subtitleOffsetMs = useStudioStore((s) => s.subtitleOffsetMs);
  const expandedPhraseId = useStudioStore((s) => s.expandedPhraseId);
  const searchQuery = useStudioStore((s) => s.searchQuery);
  const autoScrollToPlayhead = useStudioStore((s) => s.autoScrollToPlayhead);
  const scrollTop = useStudioStore((s) => s.scrollTop);

  // Dynamic viewport height measurement
  const [containerHeight, setContainerHeight] = useState<number>(600);

  useEffect(() => {
    const el = virtualScrollRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [virtualScrollRef]);

  // Group raw word timestamps into phrase segments using unified engine
  const phraseSegments = useMemo<PhraseSegment[]>(() => {
    if (!editableWords || editableWords.length === 0) return [];
    return segmentPhrases(editableWords);
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
      currentTop += height + 6; // 6px gap
    });
    return { positions, totalHeight: currentTop };
  }, [filteredPhrases, expandedPhraseId]);

  // Find visible slice with dynamic container height
  const OVERSCAN = 4;
  const visibleRange = useMemo(() => {
    const { positions } = itemPositions;
    if (positions.length === 0) return { start: 0, end: 0 };

    let start = 0;
    while (start < positions.length && positions[start].top + positions[start].height < scrollTop) {
      start++;
    }
    start = Math.max(0, start - OVERSCAN);

    let end = start;
    const viewportBottom = scrollTop + containerHeight + 100;
    while (end < positions.length && positions[end].top < viewportBottom) {
      end++;
    }
    end = Math.min(positions.length - 1, end + OVERSCAN);

    return { start, end };
  }, [scrollTop, itemPositions, containerHeight]);

  // Effective playback time for subtitles considering user-calibrated timing offset
  const effectiveSubtitleTime = currentTime - subtitleOffsetMs / 1000;

  // Active phrase segment in current playback time with calibrated offset and 0.35s hang tolerance
  const currentActivePhrase = phraseSegments.find(
    (p) => effectiveSubtitleTime >= p.startSec && effectiveSubtitleTime <= p.endSec + 0.35
  );

  // Auto-scroll to active playing phrase
  const activePhraseIndex = useMemo(() => {
    const effectiveTime = currentTime - subtitleOffsetMs / 1000;
    return filteredPhrases.findIndex(
      (p) => effectiveTime >= p.startSec && effectiveTime <= p.endSec + 0.35
    );
  }, [filteredPhrases, currentTime, subtitleOffsetMs]);

  const isAutoScrollingRef = useRef(false);
  useEffect(() => {
    if (!autoScrollToPlayhead || activePhraseIndex === -1 || !virtualScrollRef.current) return;
    const pos = itemPositions.positions[activePhraseIndex];
    if (!pos || isAutoScrollingRef.current) return;

    const targetScroll = Math.max(0, pos.top - containerHeight / 2 + pos.height / 2);
    const diff = Math.abs(virtualScrollRef.current.scrollTop - targetScroll);
    if (diff > 140) {
      isAutoScrollingRef.current = true;
      virtualScrollRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 400);
    }
  }, [activePhraseIndex, autoScrollToPlayhead, itemPositions, virtualScrollRef, containerHeight]);

  // Update a phrase's text and distribute timestamps proportionally
  const handleUpdatePhraseText = (phraseIndex: number, newText: string) => {
    const segment = phraseSegments[phraseIndex];
    if (!segment) return;

    const newWordTokens = newText.trim().split(/\s+/).filter(Boolean);
    if (newWordTokens.length === 0) return;

    const dur = Math.max(0.2, segment.endSec - segment.startSec);
    const tokenDur = dur / newWordTokens.length;

    const newWordsForPhrase: WordTimestamp[] = newWordTokens.map((token, i) => {
      // Try to preserve original word timestamps if token unchanged
      const origWord = segment.words[i];
      if (origWord && origWord.word.toLowerCase() === token.toLowerCase() && newWordTokens.length === segment.words.length) {
        return { ...origWord, word: token };
      }

      return {
        word: token,
        start: parseFloat((segment.startSec + i * tokenDur).toFixed(2)),
        end: parseFloat((segment.startSec + (i + 1) * tokenDur).toFixed(2)),
        confidence: 1.0,
        isFiller: false,
        excluded: false,
      };
    });

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
    if (!query || !query.trim()) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark
              key={i}
              style={{
                backgroundColor: "#facc15",
                color: "#000000",
                fontWeight: 800,
                padding: "1px 4px",
                borderRadius: "3px",
                margin: "0 1px",
                display: "inline-block",
                lineHeight: "1.2",
              }}
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
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
    currentActivePhrase,
    activePhraseIndex,
    handleUpdatePhraseText,
    handleReorderPhrases,
    renderHighlightedText,
  };
}
