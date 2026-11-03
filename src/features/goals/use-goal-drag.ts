'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  groupGoalsTogether,
  moveGoalAfter,
  moveGoalBefore,
  moveGoalGroupAfter,
  moveGoalGroupBefore,
  moveGoalToGroup,
} from '@/lib/db';
import type { AppScope, Goal } from '@/lib/domain';
import {
  DragPayload,
  DragTarget,
  PointerDragState,
  PendingGoalCombine,
  isSameDragTarget,
  getDragTargetFromPoint,
} from './goal-drag-target';

export function useGoalDrag({
  scope,
  activeGoals,
  groupTitle,
}: {
  scope: AppScope | null;
  activeGoals: Goal[];
  groupTitle: string;
}) {
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const [activeDragPayload, setActiveDragPayload] =
    useState<DragPayload | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [pendingGoalCombine, setPendingGoalCombine] =
    useState<PendingGoalCombine | null>(null);
  const clearDragState = useCallback(() => {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
    pointerDragRef.current = null;
    setActiveDragPayload(null);
    setDragTarget(null);
  }, []);

  const setCurrentDragTarget = useCallback((target: DragTarget | null) => {
    setDragTarget((current) =>
      target && isSameDragTarget(current, target) ? current : target,
    );
  }, []);

  const beginPointerDrag = useCallback(
    (payload: DragPayload, event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary) {
        return;
      }

      const card = event.currentTarget.closest<HTMLElement>(
        '[data-drag-card="true"]',
      );

      if (!card) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      dragPreviewRef.current?.remove();

      const rect = card.getBoundingClientRect();
      const preview = card.cloneNode(true) as HTMLElement;
      preview.setAttribute('aria-hidden', 'true');
      preview.style.position = 'fixed';
      preview.style.left = '0';
      preview.style.top = '0';
      preview.style.width = `${rect.width}px`;
      preview.style.height = `${rect.height}px`;
      preview.style.zIndex = '2147483647';
      preview.style.pointerEvents = 'none';
      preview.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      preview.style.transition = 'none';
      preview.style.boxShadow = '0 24px 56px rgba(5, 8, 13, 0.35)';
      document.body.appendChild(preview);

      pointerDragRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        payload,
        pointerId: event.pointerId,
      };
      dragPreviewRef.current = preview;
      setActiveDragPayload(payload);
      setCurrentDragTarget(null);
    },
    [setCurrentDragTarget],
  );

  useEffect(() => {
    return () => {
      dragPreviewRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    function handlePointerCancel() {
      clearDragState();
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const dragState = pointerDragRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragPreviewRef.current?.style.setProperty(
        'transform',
        `translate3d(${event.clientX - dragState.offsetX}px, ${
          event.clientY - dragState.offsetY
        }px, 0)`,
      );

      const target = getDragTargetFromPoint(
        dragState.payload,
        event.clientX,
        event.clientY,
      );

      setCurrentDragTarget(target);
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      const dragState = pointerDragRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const target = getDragTargetFromPoint(
        dragState.payload,
        event.clientX,
        event.clientY,
      );
      const combineGoalId = target?.type === 'goal-combine' ? target.id : null;
      const positionGoalTarget =
        target?.type === 'goal-position' ? target : null;
      const combineGroupId =
        target?.type === 'group-combine' ? target.id : null;
      const positionGroupTarget =
        target?.type === 'group-position' ? target : null;
      const ungroupedDropZone = target?.type === 'ungrouped';
      const { payload } = dragState;
      clearDragState();

      if (!scope) {
        return;
      }

      if (payload.type === 'goal') {
        if (combineGoalId) {
          const targetGoal = activeGoals.find(
            (goal) => goal.id === combineGoalId,
          );

          if (targetGoal?.groupId) {
            void groupGoalsTogether({
              scope,
              sourceGoalId: payload.id,
              targetGoalId: combineGoalId,
              title: groupTitle,
            });
            return;
          }

          setPendingGoalCombine({
            sourceGoalId: payload.id,
            targetGoalId: combineGoalId,
          });
          return;
        }

        if (combineGroupId) {
          void moveGoalToGroup({
            scope,
            goalId: payload.id,
            groupId: combineGroupId,
          });
          return;
        }

        if (positionGoalTarget) {
          const moveGoal =
            positionGoalTarget.side === 'before'
              ? moveGoalBefore
              : moveGoalAfter;

          void moveGoal({
            scope,
            goalId: payload.id,
            targetGoalId: positionGoalTarget.id,
          });
          return;
        }

        if (ungroupedDropZone) {
          void moveGoalToGroup({ scope, goalId: payload.id, groupId: null });
        }
        return;
      }

      if (payload.type === 'group' && positionGroupTarget) {
        const moveGoalGroup =
          positionGroupTarget.side === 'before'
            ? moveGoalGroupBefore
            : moveGoalGroupAfter;

        void moveGoalGroup({
          scope,
          goalGroupId: payload.id,
          targetGoalGroupId: positionGroupTarget.id,
        });
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [activeGoals, clearDragState, groupTitle, scope, setCurrentDragTarget]);

  return {
    activeDragPayload,
    dragTarget,
    beginPointerDrag,
    pendingGoalCombine,
    setPendingGoalCombine,
  };
}
