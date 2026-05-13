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
