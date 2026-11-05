export interface TaskTreeRowAvailability {
  canAssignCategory: boolean;
  canClearCategory: boolean;
  canEditContent: boolean;
  canIndent: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  canOutdent: boolean;
}

function getTaskTreeRowActions({
  canEditContent,
  categoryTagId,
  depth,
  hasAssignableCategories,
  isFirstSibling,
  isLastSibling,
}: {
  canEditContent: boolean;
  categoryTagId: string | null;
  depth: number;
  hasAssignableCategories: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
}): TaskTreeRowAvailability {
  return {
    canAssignCategory: canEditContent && hasAssignableCategories,
    canClearCategory: canEditContent && categoryTagId !== null,
    canEditContent,
    canIndent: !isFirstSibling,
    canMoveDown: !isLastSibling,
    canMoveUp: !isFirstSibling,
    canOutdent: depth > 0,
  };
}

export function getTaskTreeRowAvailability({
  categoryTagId,
  depth,
  hasAssignableCategories,
  isDraft,
  isFirstSibling,
  isLastSibling,
  isSelected,
  isSelectionMode,
  text,
}: {
  categoryTagId: string | null;
  depth: number;
  hasAssignableCategories: boolean;
  isDraft: boolean;
  isFirstSibling: boolean;
  isLastSibling: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  text: string;
}) {
  const isEmptyDraft = isDraft && text.trim().length === 0;
  const actions = getTaskTreeRowActions({
    canEditContent: !isEmptyDraft,
    categoryTagId,
    depth,
    hasAssignableCategories,
    isFirstSibling,
    isLastSibling,
  });

  return {
    actions,
    inlineDisabled: {
      checkbox: isEmptyDraft || (isSelectionMode && !isSelected),
      clearCategory: isSelectionMode || !actions.canClearCategory,
      delete: isSelectionMode,
      indent: isSelectionMode || !actions.canIndent,
      moveDown: isSelectionMode || !actions.canMoveDown,
      moveUp: isSelectionMode || !actions.canMoveUp,
      outdent: isSelectionMode || !actions.canOutdent,
    },
    isEmptyDraft,
    isLocked: isSelectionMode || isEmptyDraft,
  };
}

export type TaskTreeRowAvailabilityState = ReturnType<
  typeof getTaskTreeRowAvailability
>;
