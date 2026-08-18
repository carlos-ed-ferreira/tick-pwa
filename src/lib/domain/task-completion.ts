export type TaskCompletionState = 'unchecked' | 'completed' | 'ignored';

export interface TaskCompletionValues {
  completed: boolean;
  ignored: boolean;
}

export function getTaskCompletionState(
  completed: boolean,
  ignored: boolean,
): TaskCompletionState {
  if (ignored) {
    return 'ignored';
  }

  return completed ? 'completed' : 'unchecked';
}

export function getNextTaskCompletionValues(
  completed: boolean,
  ignored: boolean,
): TaskCompletionValues {
  switch (getTaskCompletionState(completed, ignored)) {
    case 'unchecked':
      return { completed: true, ignored: false };
    case 'completed':
      return { completed: false, ignored: true };
    case 'ignored':
      return { completed: false, ignored: false };
  }
}

export function getSelectionCompletionState(
  values: readonly TaskCompletionValues[],
): TaskCompletionState {
  if (values.length === 0) {
    return 'unchecked';
  }

  if (values.every((value) => value.ignored)) {
    return 'ignored';
  }

  return values.every((value) => value.completed && !value.ignored)
    ? 'completed'
    : 'unchecked';
}
