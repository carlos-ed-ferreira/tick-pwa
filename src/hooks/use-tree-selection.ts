'use client';

import { useCallback, useMemo, useState } from 'react';

export function useTreeSelection(visibleIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const visibleSelectedIds = useMemo(() => {
    const nextSelectedIds = new Set<string>();

    for (const id of selectedIds) {
      if (visibleIdSet.has(id)) {
        nextSelectedIds.add(id);
      }
    }

    return nextSelectedIds.size === selectedIds.size
      ? selectedIds
      : nextSelectedIds;
  }, [selectedIds, visibleIdSet]);
  const visibleLastSelectedId =
    lastSelectedId && visibleIdSet.has(lastSelectedId) ? lastSelectedId : null;

  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey && visibleLastSelectedId) {
        const from = visibleIds.indexOf(visibleLastSelectedId);
        const to = visibleIds.indexOf(id);

        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(
            () =>
              new Set([
                ...visibleSelectedIds,
                ...visibleIds.slice(start, end + 1),
              ]),
          );
        }

        return;
      }

      setSelectedIds(() => {
        const nextSelectedIds = new Set(visibleSelectedIds);

        if (nextSelectedIds.has(id)) {
          nextSelectedIds.delete(id);
        } else {
          nextSelectedIds.add(id);
        }

        return nextSelectedIds;
      });
      setLastSelectedId(id);
    },
    [visibleIds, visibleLastSelectedId, visibleSelectedIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const isSelected = useCallback(
    (id: string) => visibleSelectedIds.has(id),
    [visibleSelectedIds],
  );

  return {
    clearSelection,
    isSelected,
    isSelectionMode: visibleSelectedIds.size > 0,
    lastSelectedId: visibleLastSelectedId,
    selectedCount: visibleSelectedIds.size,
    selectedIds: visibleSelectedIds,
    toggleSelect,
  };
}
