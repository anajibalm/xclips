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

  // Auto-scroll to active playing phrase (Instant Jump without layout thrashing)
  useEffect(() => {
    if (!autoScrollToPlayhead || activePhraseIndex === -1 || !virtualScrollRef.current) return;
    const pos = itemPositions.positions[activePhraseIndex];
    if (!pos) return;

    const el = virtualScrollRef.current;
    const currentScrollTop = el.scrollTop;
    const viewportHeight = el.clientHeight || containerHeight;

    // Check if active item is outside current viewport bounds
    const isAboveViewport = pos.top < currentScrollTop;
    const isBelowViewport = pos.top + pos.height > currentScrollTop + viewportHeight;

    if (isAboveViewport || isBelowViewport) {
      const targetScroll = Math.max(0, Math.round(pos.top - viewportHeight / 2 + pos.height / 2));
      el.scrollTop = targetScroll;
    }
  }, [activePhraseIndex, autoScrollToPlayhead, itemPositions, virtualScrollRef, containerHeight]);

  // Update a phrase's text and distribute timestamps proportionally
  const handleUpdatePhraseText = (phraseIndex: number, newText: string) => {
    const segment = phraseSegments[phraseIndex];
    if (!segment) return;

    const trimmed = newText.trim();
    let newWordsForPhrase: WordTimestamp[] = [];

    if (!trimmed) {
      // User deleted all characters: preserve empty placeholder word so the phrase is cleared smoothly
      newWordsForPhrase = [
        {
          word: "",
          start: segment.startSec,
          end: segment.endSec,
          confidence: 1.0,
          isFiller: false,
          excluded: false,
          breakAfter: true,
        },
      ];
    } else {
      const newWordTokens = trimmed.split(/\s+/).filter(Boolean);
      const dur = Math.max(0.2, segment.endSec - segment.startSec);
      const tokenDur = dur / newWordTokens.length;

      newWordsForPhrase = newWordTokens.map((token, i) => {
        const isLastToken = i === newWordTokens.length - 1;
        const origWord = segment.words[i];
        if (origWord && origWord.word.toLowerCase() === token.toLowerCase() && newWordTokens.length === segment.words.length) {
          return { ...origWord, word: token, breakAfter: isLastToken };
        }

        return {
          word: token,
          start: parseFloat((segment.startSec + i * tokenDur).toFixed(2)),
          end: parseFloat((segment.startSec + (i + 1) * tokenDur).toFixed(2)),
          confidence: 1.0,
          isFiller: false,
          excluded: false,
          breakAfter: isLastToken,
        };
      });
    }

    const updatedFullList: WordTimestamp[] = [];
    phraseSegments.forEach((seg, sIdx) => {
      if (sIdx === phraseIndex) {
        updatedFullList.push(...newWordsForPhrase);
      } else {
        const segWords = seg.words.map((w, wIdx) => ({
          ...w,
          breakAfter: wIdx === seg.words.length - 1,
        }));
        updatedFullList.push(...segWords);
      }
    });

    setEditableWords(updatedFullList);
  };

  // Split a phrase at cursor position into two distinct phrases
  const handleSplitPhrase = (phraseIndex: number, cursorPosition: number, fullText: string): boolean => {
    const segment = phraseSegments[phraseIndex];
    if (!segment) return false;

    const textBefore = fullText.slice(0, cursorPosition).trim();
    const textAfter = fullText.slice(cursorPosition).trim();

    // If either part is empty, cannot split
    if (!textBefore || !textAfter) return false;

    const tokensBefore = textBefore.split(/\s+/).filter(Boolean);
    const tokensAfter = textAfter.split(/\s+/).filter(Boolean);
    const totalTokens = tokensBefore.length + tokensAfter.length;
    if (totalTokens === 0) return false;

    const dur = Math.max(0.4, segment.endSec - segment.startSec);
    const tokenDur = dur / totalTokens;

    // Build words for first split phrase
    const wordsBefore: WordTimestamp[] = tokensBefore.map((token, i) => {
      const isLast = i === tokensBefore.length - 1;
      const origWord = segment.words[i];
      if (origWord && origWord.word.toLowerCase() === token.toLowerCase() && i < segment.words.length) {
        return { ...origWord, word: token, breakAfter: isLast };
      }
      return {
        word: token,
        start: parseFloat((segment.startSec + i * tokenDur).toFixed(2)),
        end: parseFloat((segment.startSec + (i + 1) * tokenDur).toFixed(2)),
        confidence: 1.0,
        isFiller: false,
        excluded: false,
        breakAfter: isLast,
      };
    });

    // Boundary timestamp between phrase 1 and phrase 2
    const splitBoundarySec = wordsBefore.length > 0 
      ? wordsBefore[wordsBefore.length - 1].end 
      : segment.startSec + (tokensBefore.length * tokenDur);

    // Build words for second split phrase
    const wordsAfter: WordTimestamp[] = tokensAfter.map((token, i) => {
      const origIdx = tokensBefore.length + i;
      const isLast = i === tokensAfter.length - 1;
      const origWord = segment.words[origIdx];
      if (origWord && origWord.word.toLowerCase() === token.toLowerCase() && origIdx < segment.words.length) {
        return { ...origWord, word: token, breakAfter: isLast };
      }
      return {
        word: token,
        start: parseFloat((splitBoundarySec + i * tokenDur).toFixed(2)),
        end: parseFloat((splitBoundarySec + (i + 1) * tokenDur).toFixed(2)),
        confidence: 1.0,
        isFiller: false,
        excluded: false,
        breakAfter: isLast,
      };
    });

    const updatedFullList: WordTimestamp[] = [];
    phraseSegments.forEach((seg, sIdx) => {
      if (sIdx === phraseIndex) {
        updatedFullList.push(...wordsBefore, ...wordsAfter);
      } else {
        const segWords = seg.words.map((w, wIdx) => ({
          ...w,
          breakAfter: wIdx === seg.words.length - 1,
        }));
        updatedFullList.push(...segWords);
      }
    });

    setEditableWords(updatedFullList);
    return true;
  };

  // Merge phrase with previous phrase on Backspace at start (cursor index 0)
  const handleMergeWithPreviousPhrase = (phraseIndex: number): { mergedIndex: number; cursorOffset: number } | null => {
    if (phraseIndex <= 0 || phraseIndex >= phraseSegments.length) return null;

    const prevSegment = phraseSegments[phraseIndex - 1];
    const currSegment = phraseSegments[phraseIndex];
    if (!prevSegment || !currSegment) return null;

    const prevWords = prevSegment.words.map((w) => ({ ...w, breakAfter: false }));
    const currWords = currSegment.words.map((w, idx) => ({
      ...w,
      breakAfter: idx === currSegment.words.length - 1,
    }));

    const mergedWords = [...prevWords, ...currWords];

    const updatedFullList: WordTimestamp[] = [];
    phraseSegments.forEach((seg, sIdx) => {
      if (sIdx === phraseIndex - 1) {
        updatedFullList.push(...mergedWords);
      } else if (sIdx === phraseIndex) {
        // merged into previous, skip
      } else {
        const segWords = seg.words.map((w, wIdx) => ({
          ...w,
          breakAfter: wIdx === seg.words.length - 1,
        }));
        updatedFullList.push(...segWords);
      }
    });

    setEditableWords(updatedFullList);
    return {
      mergedIndex: phraseIndex - 1,
      cursorOffset: prevSegment.text.length,
    };
  };

  // Merge phrase with next phrase on Delete key at end of phrase
  const handleMergeWithNextPhrase = (phraseIndex: number): { mergedIndex: number; cursorOffset: number } | null => {
    if (phraseIndex < 0 || phraseIndex >= phraseSegments.length - 1) return null;
    return handleMergeWithPreviousPhrase(phraseIndex + 1);
  };

  // Reorder phrase segments via index shifting (Up/Down)
  const handleReorderPhrases = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= phraseSegments.length || toIndex >= phraseSegments.length) return;
    const reordered = [...phraseSegments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const newWordsList: WordTimestamp[] = [];
    reordered.forEach((seg) => {
      const segWords = seg.words.map((w, wIdx) => ({
        ...w,
        breakAfter: wIdx === seg.words.length - 1,
      }));
      newWordsList.push(...segWords);
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
    handleSplitPhrase,
    handleMergeWithPreviousPhrase,
    handleMergeWithNextPhrase,
    handleReorderPhrases,
    renderHighlightedText,
  };
}
