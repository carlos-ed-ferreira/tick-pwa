export type TreeMoveDirection = 'down' | 'up';
export type TreeMovePlacement = 'before' | 'child' | 'after';

type TreeMoveItem = {
  id: string;
  parentId: string | null;
};

export async function moveTreeItemToTarget<T extends TreeMoveItem>({
  canMove = () => true,
  itemId,
  items,
  placement,
  targetItemId,
  onReorder,
  onMoveAsChild,
  onMoveAdjacent,
}: {
  canMove?: (item: T) => boolean;
  itemId: string;
  items: T[];
  placement: TreeMovePlacement;
  targetItemId: string;
  onReorder: (itemId: string, direction: TreeMoveDirection) => Promise<void>;
  onMoveAsChild?: (itemId: string, parentItemId: string) => Promise<void>;
  onMoveAdjacent?: (
    itemId: string,
    targetItemId: string,
    placement: Exclude<TreeMovePlacement, 'child'>,
  ) => Promise<void>;
}): Promise<void> {
  if (itemId === targetItemId) {
    return;
  }

  const item = items.find((currentItem) => currentItem.id === itemId);
  const targetItem = items.find(
    (currentItem) => currentItem.id === targetItemId,
  );

  if (!item || !targetItem || !canMove(item) || !canMove(targetItem)) {
    return;
  }

  if (placement === 'child') {
    let ancestor: T | undefined = targetItem;

    while (ancestor) {
      if (ancestor.id === itemId) {
        return;
      }

      ancestor = ancestor.parentId
        ? items.find((currentItem) => currentItem.id === ancestor?.parentId)
        : undefined;
    }

    await onMoveAsChild?.(itemId, targetItemId);
    return;
  }

  if (item.parentId !== targetItem.parentId) {
    await onMoveAdjacent?.(itemId, targetItemId, placement);
    return;
  }

  const siblings = items.filter(
    (currentItem) => currentItem.parentId === targetItem.parentId,
  );
  const currentIndex = siblings.findIndex(
    (currentItem) => currentItem.id === itemId,
  );
  const targetIndex = siblings.findIndex(
    (currentItem) => currentItem.id === targetItemId,
  );

  if (currentIndex === -1 || targetIndex === -1) {
    return;
  }

  let nextIndex = placement === 'before' ? targetIndex : targetIndex + 1;

  if (currentIndex < nextIndex) {
    nextIndex -= 1;
  }

  if (nextIndex === currentIndex) {
    return;
  }

  const direction: TreeMoveDirection = nextIndex > currentIndex ? 'down' : 'up';

  for (let index = 0; index < Math.abs(nextIndex - currentIndex); index += 1) {
    await onReorder(itemId, direction);
  }
}
