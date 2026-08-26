import { useCallback, useEffect, useMemo, useState } from 'react';

function findRowIndexAtOffset(offsets, itemCount, value) {
  if (itemCount <= 0) return 0;
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= value) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(0, Math.min(itemCount - 1, high));
}

export function useVirtualRows({
  itemCount,
  estimateSize = 44,
  overscan = 8,
  scrollElementRef,
}) {
  const getSize = useCallback(
    (index) => {
      const rawSize = typeof estimateSize === 'function' ? estimateSize(index) : estimateSize;
      const size = Number(rawSize);
      return Number.isFinite(size) && size > 0 ? size : 44;
    },
    [estimateSize]
  );

  const offsets = useMemo(() => {
    const next = new Array(itemCount + 1);
    next[0] = 0;
    for (let i = 0; i < itemCount; i += 1) {
      next[i + 1] = next[i] + getSize(i);
    }
    return next;
  }, [getSize, itemCount]);

  const totalSize = offsets[itemCount] || 0;
  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.min(itemCount, 30) });

  const updateRange = useCallback(() => {
    if (itemCount <= 0) {
      setRange({ startIndex: 0, endIndex: 0 });
      return;
    }

    const scrollEl = scrollElementRef?.current;
    const viewportHeight = scrollEl?.clientHeight || 0;
    if (!scrollEl || viewportHeight <= 0) {
      setRange({ startIndex: 0, endIndex: Math.min(itemCount, 30) });
      return;
    }

    const scrollTop = scrollEl.scrollTop || 0;
    const startIndex = Math.max(
      0,
      findRowIndexAtOffset(offsets, itemCount, scrollTop) - overscan
    );
    const endIndex = Math.min(
      itemCount,
      findRowIndexAtOffset(offsets, itemCount, scrollTop + viewportHeight) + 1 + overscan
    );

    setRange((prev) =>
      prev.startIndex === startIndex && prev.endIndex === endIndex
        ? prev
        : { startIndex, endIndex }
    );
  }, [itemCount, offsets, overscan, scrollElementRef]);

  useEffect(() => {
    updateRange();
    const scrollEl = scrollElementRef?.current;
    if (!scrollEl) return undefined;

    let frame = null;
    const scheduleUpdate = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateRange);
    };

    scrollEl.addEventListener('scroll', scheduleUpdate, { passive: true });
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(scrollEl);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      scrollEl.removeEventListener('scroll', scheduleUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [scrollElementRef, updateRange, itemCount]);

  const startIndex = itemCount > 0 ? Math.min(range.startIndex, itemCount - 1) : 0;
  const endIndex = itemCount > 0 ? Math.min(Math.max(range.endIndex, startIndex + 1), itemCount) : 0;

  return {
    startIndex,
    endIndex,
    paddingTop: offsets[startIndex] || 0,
    paddingBottom: Math.max(0, totalSize - (offsets[endIndex] || 0)),
    totalSize,
  };
}
