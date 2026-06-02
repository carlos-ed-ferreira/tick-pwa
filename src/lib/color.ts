export function toAlphaColor(hex: string, opacity: number): string {
  const normalizedHex = hex.replace('#', '');

  if (normalizedHex.length !== 3 && normalizedHex.length !== 6) {
    return hex;
  }

  const expandedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalizedHex;
  const red = Number.parseInt(expandedHex.slice(0, 2), 16);
  const green = Number.parseInt(expandedHex.slice(2, 4), 16);
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
