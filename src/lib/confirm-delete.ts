export function requiresDeleteConfirmation(text: string): boolean {
  return text.trim().length > 0;
}
