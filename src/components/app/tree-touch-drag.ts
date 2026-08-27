'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TreeMovePlacement } from './move-tree-item-to-target';

export interface TreeDragSource {
  itemId: string;
  nextSiblingId: string | null;
  parentId: string | null;
  previousSiblingId: string | null;
}

export interface TreeDropTarget {
  itemId: string;
  parentId: string | null;
}

export function resolveTreeDropPlacement({
  height,
  isLastSibling,
  offsetY,
}: {
  height: number;
  isLastSibling: boolean;
  offsetY: number;
}): TreeMovePlacement {
  if (height <= 0) {
    return 'after';
  }

  if (offsetY < height * 0.25) {
    return 'before';
  }

  if (isLastSibling && offsetY > height * 0.75) {
    return 'after';
  }

  return 'child';
}

export function validateTreeDrop({
  dragged,
  placement,
  target,
}: {
  dragged: TreeDragSource;
  placement: TreeMovePlacement | null;
  target: TreeDropTarget;
}): TreeMovePlacement | null {
  if (!placement || !dragged.itemId || dragged.itemId === target.itemId) {
    return null;
  }

  if (placement === 'child' && dragged.parentId === target.itemId) {
    return null;
  }

  if (dragged.parentId === target.parentId) {
    if (placement === 'before' && dragged.nextSiblingId === target.itemId) {
      return null;
    }

    if (placement === 'after' && dragged.previousSiblingId === target.itemId) {
      return null;
    }
  }

  return placement;
}

export function createTreeDragSource({
  itemId,
  parentId,
  siblingIds,
}: {
  itemId: string;
  parentId: string | null;
  siblingIds: string[];
}): TreeDragSource {
  const siblingIndex = siblingIds.indexOf(itemId);

  return {
    itemId,
    nextSiblingId: siblingIds[siblingIndex + 1] ?? null,
    parentId,
    previousSiblingId: siblingIds[siblingIndex - 1] ?? null,
  };
}

export const treeRowIdAttribute = 'data-tree-row-id';
export const treeRowParentIdAttribute = 'data-tree-row-parent-id';
export const treeRowLastSiblingAttribute = 'data-tree-row-last-sibling';

export function readTreeRowTarget(element: Element | null): {
  isLastSibling: boolean;
  rect: DOMRect;
  target: TreeDropTarget;
} | null {
  const row = element?.closest<HTMLElement>(`[${treeRowIdAttribute}]`);
  const itemId = row?.getAttribute(treeRowIdAttribute);

  if (!row || !itemId) {
    return null;
  }

  const parentId = row.getAttribute(treeRowParentIdAttribute);

  return {
    isLastSibling: row.getAttribute(treeRowLastSiblingAttribute) === 'true',
    rect: row.getBoundingClientRect(),
    target: { itemId, parentId: parentId ? parentId : null },
  };
}

interface TreeTouchDragState {
  placement: TreeMovePlacement | null;
  source: TreeDragSource;
  targetItemId: string | null;
}

let treeTouchDragState: TreeTouchDragState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return treeTouchDragState;
}

function getServerSnapshot(): TreeTouchDragState | null {
  return null;
}

function setTreeTouchDragState(next: TreeTouchDragState | null) {
  const current = treeTouchDragState;

  if (
    current === next ||
    (current &&
      next &&
      current.source.itemId === next.source.itemId &&
      current.targetItemId === next.targetItemId &&
      current.placement === next.placement)
  ) {
    return;
  }

  treeTouchDragState = next;
  emit();
}

const edgeScrollZone = 72;
const edgeScrollStep = 12;

function scrollViewportEdges(clientY: number) {
  if (clientY < edgeScrollZone) {
    window.scrollBy(0, -edgeScrollStep);
    return;
  }

  if (clientY > window.innerHeight - edgeScrollZone) {
    window.scrollBy(0, edgeScrollStep);
  }
}

export function useTreeTouchDrag({
  enabled,
  itemId,
  onMoveTo,
  parentId,
  siblingIds,
}: {
  enabled: boolean;
  itemId: string;
  onMoveTo?: (input: {
    itemId: string;
    targetItemId: string;
    placement: TreeMovePlacement;
  }) => Promise<void> | void;
  parentId: string | null;
  siblingIds: string[];
}) {
  const dragState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const startTouchDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !onMoveTo || event.pointerType === 'mouse') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      const source = createTreeDragSource({ itemId, parentId, siblingIds });
      handle.setPointerCapture(event.pointerId);
      setTreeTouchDragState({ placement: null, source, targetItemId: null });

      const finish = (commit: boolean) => {
        handle.removeEventListener('pointermove', handlePointerMove);
        handle.removeEventListener('pointerup', handlePointerUp);
        handle.removeEventListener('pointercancel', handlePointerCancel);

        const settled = treeTouchDragState;
        setTreeTouchDragState(null);

        if (
          commit &&
          settled?.placement &&
          settled.targetItemId &&
          settled.targetItemId !== source.itemId
        ) {
          void onMoveTo({
            itemId: source.itemId,
            targetItemId: settled.targetItemId,
            placement: settled.placement,
          });
        }
      };

      function handlePointerMove(moveEvent: globalThis.PointerEvent) {
        if (moveEvent.pointerId !== event.pointerId) {
          return;
        }

        moveEvent.preventDefault();
        scrollViewportEdges(moveEvent.clientY);

        const hovered = readTreeRowTarget(
          document.elementFromPoint(moveEvent.clientX, moveEvent.clientY),
        );

        if (!hovered) {
          setTreeTouchDragState({
            placement: null,
            source,
            targetItemId: null,
          });
          return;
        }

        const placement = validateTreeDrop({
          dragged: source,
          placement: resolveTreeDropPlacement({
            height: hovered.rect.height,
            isLastSibling: hovered.isLastSibling,
            offsetY: moveEvent.clientY - hovered.rect.top,
          }),
          target: hovered.target,
        });

        setTreeTouchDragState({
          placement,
          source,
          targetItemId: placement ? hovered.target.itemId : null,
        });
      }

      function handlePointerUp(upEvent: globalThis.PointerEvent) {
        if (upEvent.pointerId !== event.pointerId) {
          return;
        }

        finish(true);
      }

      function handlePointerCancel(cancelEvent: globalThis.PointerEvent) {
        if (cancelEvent.pointerId !== event.pointerId) {
          return;
        }

        finish(false);
      }

      handle.addEventListener('pointermove', handlePointerMove);
      handle.addEventListener('pointerup', handlePointerUp);
      handle.addEventListener('pointercancel', handlePointerCancel);
    },
    [enabled, itemId, onMoveTo, parentId, siblingIds],
  );

  return {
    isTouchDragging: dragState?.source.itemId === itemId,
    startTouchDrag,
    touchDropPosition:
      dragState && dragState.targetItemId === itemId
        ? dragState.placement
        : null,
  };
}
