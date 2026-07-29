export type DropdownJoinShape = 'main-taller' | 'extension-taller' | 'similar';

export const dropdownJoinCornerClearance = 40;
export const dropdownJoinOverlap = 1;

export function getDropdownJoinShape(
  mainHeight: number,
  extensionHeight: number,
): DropdownJoinShape {
  const heightDifference = mainHeight - extensionHeight;

  if (heightDifference >= dropdownJoinCornerClearance) {
    return 'main-taller';
  }

  if (heightDifference <= -dropdownJoinCornerClearance) {
    return 'extension-taller';
  }

  return 'similar';
}
