export type DragPayload =
  | { id: string; type: 'goal' }
  | { id: string; type: 'group' };

export type PositionSide = 'before' | 'after';

export type DragTarget =
  | { id: string; type: 'goal-combine' }
  | { id: string; side: PositionSide; type: 'goal-position' }
  | { id: string; type: 'group-combine' }
  | { id: string; side: PositionSide; type: 'group-position' }
  | { type: 'ungrouped' };

export type PointerDragState = {
  offsetX: number;
  offsetY: number;
  payload: DragPayload;
  pointerId: number;
};

export type PendingGoalCombine = {
  sourceGoalId: string;
  targetGoalId: string;
};

export function isSameDragPayload(
  first: DragPayload | null,
  second: DragPayload,
): boolean {
  return Boolean(first && first.type === second.type && first.id === second.id);
}

export function isSameDragTarget(
  first: DragTarget | null,
  second: DragTarget,
): boolean {
  if (!first || first.type !== second.type) {
    return false;
  }

  if (first.type === 'ungrouped' || second.type === 'ungrouped') {
    return first.type === second.type;
  }

  if (first.id !== second.id) {
    return false;
  }

  if ('side' in first || 'side' in second) {
    return 'side' in first && 'side' in second && first.side === second.side;
  }

  return true;
}

function createPositionDragTarget(
  payload: DragPayload,
  id: string,
  side: PositionSide,
): DragTarget {
  return payload.type === 'group'
    ? { id, side, type: 'group-position' }
    : { id, side, type: 'goal-position' };
}

function getPositionTargetFromPoint(
  payload: DragPayload,
  clientX: number,
  clientY: number,
): DragTarget | null {
  const selector =
    payload.type === 'group' ? '[data-group-drop-id]' : '[data-goal-drop-id]';
  const cards = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => {
      const id =
        payload.type === 'group'
          ? element.dataset.groupDropId
          : element.dataset.goalDropId;

      return id
        ? {
            id,
            rect: element.getBoundingClientRect(),
          }
        : null;
    })
    .filter((card): card is { id: string; rect: DOMRect } =>
      Boolean(card && card.id !== payload.id),
    );

  if (cards.length === 0) {
    return null;
  }

  const rowCards = cards.filter(
    ({ rect }) => clientY >= rect.top - 14 && clientY <= rect.bottom + 14,
  );
  const candidates =
    rowCards.length > 0
      ? rowCards
      : cards.filter(({ rect }) => {
          const closestDistance = Math.min(
            ...cards.map((card) =>
              Math.abs(clientY - (card.rect.top + card.rect.height / 2)),
            ),
          );

          return (
            Math.abs(clientY - (rect.top + rect.height / 2)) === closestDistance
          );
        });
  const sortedCandidates = [...candidates].sort(
    (first, second) => first.rect.left - second.rect.left,
  );
  const firstCandidate = sortedCandidates[0];

  if (
    firstCandidate &&
    clientX < firstCandidate.rect.left + firstCandidate.rect.width / 2
  ) {
    return createPositionDragTarget(payload, firstCandidate.id, 'before');
  }

  const target =
    sortedCandidates
      .filter(({ rect }) => clientX >= rect.left + rect.width / 2)
      .at(-1) ?? sortedCandidates[0];

  if (!target) {
    return null;
  }

  return createPositionDragTarget(payload, target.id, 'after');
}

export function getDragTargetFromPoint(
  payload: DragPayload,
  clientX: number,
  clientY: number,
): DragTarget | null {
  const target = document.elementFromPoint(
    clientX,
    clientY,
  ) as HTMLElement | null;
  const goalId =
    target?.closest<HTMLElement>('[data-goal-drop-id]')?.dataset.goalDropId ??
    null;
  const groupId =
    target?.closest<HTMLElement>('[data-group-drop-id]')?.dataset.groupDropId ??
    null;
  const ungroupedDropZone = target?.closest<HTMLElement>(
    '[data-ungrouped-drop-zone="true"]',
  );

  if (payload.type === 'group') {
    if (groupId && groupId !== payload.id) {
      const groupElement = target?.closest<HTMLElement>('[data-group-drop-id]');
      const rect = groupElement?.getBoundingClientRect();
      const side =
        rect && clientX < rect.left + rect.width / 2 ? 'before' : 'after';

      return { id: groupId, side, type: 'group-position' };
    }

    return getPositionTargetFromPoint(payload, clientX, clientY);
  }

  if (goalId && goalId !== payload.id) {
    return { id: goalId, type: 'goal-combine' };
  }

  if (groupId) {
    return { id: groupId, type: 'group-combine' };
  }

  const positionTarget = getPositionTargetFromPoint(payload, clientX, clientY);

  if (positionTarget) {
    return positionTarget;
  }

  if (ungroupedDropZone) {
    return { type: 'ungrouped' };
  }

  return null;
}
