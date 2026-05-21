const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const base = alphabet.length;

function valueFor(character: string): number {
  const value = alphabet.indexOf(character);

  if (value === -1) {
    throw new Error(`Invalid sort rank character: ${character}`);
  }

  return value;
}

function charFor(value: number): string {
  if (value < 0 || value >= base) {
    throw new Error(`Invalid sort rank value: ${value}`);
  }

  return alphabet[value];
}

export function createInitialSortRank(): string {
  return 'U';
}

export function createSortRankBetween(
  previousRank: string | null,
  nextRank: string | null,
): string {
  let index = 0;
  let rank = '';

  while (true) {
    const previousValue = previousRank
      ? valueFor(previousRank[index] ?? alphabet[0])
      : 0;
    const nextValue = nextRank
      ? valueFor(nextRank[index] ?? alphabet[base - 1])
      : base - 1;

    if (nextValue - previousValue > 1) {
      const middleValue = Math.floor((previousValue + nextValue) / 2);
      return `${rank}${charFor(middleValue)}`;
    }

    rank += charFor(previousValue);
    index += 1;
  }
}

export function compareSortRanks(
  firstRank: string,
  secondRank: string,
): number {
  const length = Math.max(firstRank.length, secondRank.length);

  for (let index = 0; index < length; index += 1) {
    if (index >= firstRank.length) {
      return -1;
    }

    if (index >= secondRank.length) {
      return 1;
    }

    const firstValue = valueFor(firstRank[index]);
    const secondValue = valueFor(secondRank[index]);

    if (firstValue !== secondValue) {
      return firstValue - secondValue;
    }
  }

  return 0;
}

export interface RankedItem {
  id: string;
  sortRank: string;
}

export type ReorderDirection = 'up' | 'down';

export function sortByRank<TItem extends { sortRank: string }>(
  items: readonly TItem[],
): TItem[] {
  return [...items].sort((firstItem, secondItem) =>
    compareSortRanks(firstItem.sortRank, secondItem.sortRank),
  );
}

export function createRankAfter<TItem extends RankedItem>({
  afterItemId,
  items,
}: {
  afterItemId?: string | null;
  items: readonly TItem[];
}): string {
  const sortedItems = sortByRank(items);

  if (!afterItemId) {
    return createSortRankBetween(sortedItems.at(-1)?.sortRank ?? null, null);
  }

  const previousIndex = sortedItems.findIndex(
    (item) => item.id === afterItemId,
  );

  if (previousIndex === -1) {
    return createSortRankBetween(sortedItems.at(-1)?.sortRank ?? null, null);
  }

  return createSortRankBetween(
    sortedItems[previousIndex].sortRank,
    sortedItems[previousIndex + 1]?.sortRank ?? null,
  );
}

export function createReorderedRank<TItem extends RankedItem>({
  direction,
  itemId,
  items,
}: {
  direction: ReorderDirection;
  itemId: string;
  items: readonly TItem[];
}): string | null {
  const sortedItems = sortByRank(items);
  const currentIndex = sortedItems.findIndex((item) => item.id === itemId);

  if (currentIndex === -1) {
    return null;
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= sortedItems.length) {
    return null;
  }

  const reorderedItems = [...sortedItems];
  const [movedItem] = reorderedItems.splice(currentIndex, 1);
  reorderedItems.splice(nextIndex, 0, movedItem);

  return createSortRankBetween(
    reorderedItems[nextIndex - 1]?.sortRank ?? null,
    reorderedItems[nextIndex + 1]?.sortRank ?? null,
  );
}
