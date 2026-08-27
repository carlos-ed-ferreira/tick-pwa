export type TaskCompletionState = 'unchecked' | 'completed' | 'ignored';

export interface TaskCompletionValues {
  completed: boolean;
  ignored: boolean;
  markLevel: number;
}

export interface TaskCompletionInput {
  completed?: boolean;
  ignored?: boolean;
  markLevel?: number | null;
}

export interface TaskCompletionSettings {
  ignored: boolean;
  levels: number;
}

export const maxTaskCompletionLevels = 5;

export const defaultTaskCompletionSettings: TaskCompletionSettings = {
  ignored: false,
  levels: 1,
};

const uncheckedTaskCompletionValues: TaskCompletionValues = {
  completed: false,
  ignored: false,
  markLevel: 0,
};

const ignoredTaskCompletionValues: TaskCompletionValues = {
  completed: false,
  ignored: true,
  markLevel: 0,
};

function clampTaskCompletionLevels(levels: unknown): number {
  if (typeof levels !== 'number' || !Number.isFinite(levels)) {
    return defaultTaskCompletionSettings.levels;
  }

  return Math.min(
    Math.max(Math.trunc(levels), defaultTaskCompletionSettings.levels),
    maxTaskCompletionLevels,
  );
}

export function normalizeTaskCompletionSettings(
  value: unknown,
): TaskCompletionSettings {
  if (typeof value !== 'object' || value === null) {
    return defaultTaskCompletionSettings;
  }

  const settings = value as Partial<TaskCompletionSettings>;

  return {
    ignored: settings.ignored === true,
    levels: clampTaskCompletionLevels(settings.levels),
  };
}

export function normalizeTaskCompletionValues(
  input: TaskCompletionInput,
): TaskCompletionValues {
  if (input.ignored === true) {
    return ignoredTaskCompletionValues;
  }

  const storedLevel =
    typeof input.markLevel === 'number' && Number.isFinite(input.markLevel)
      ? Math.max(Math.trunc(input.markLevel), 0)
      : 0;
  const markLevel = storedLevel > 0 ? storedLevel : input.completed ? 1 : 0;

  return markLevel > 0
    ? { completed: true, ignored: false, markLevel }
    : uncheckedTaskCompletionValues;
}

export function getTaskCompletionState(
  input: TaskCompletionInput,
): TaskCompletionState {
  const values = normalizeTaskCompletionValues(input);

  if (values.ignored) {
    return 'ignored';
  }

  return values.completed ? 'completed' : 'unchecked';
}

export function getTaskCompletionDisplayLevel(
  input: TaskCompletionInput,
  settings: TaskCompletionSettings = defaultTaskCompletionSettings,
): number {
  const values = normalizeTaskCompletionValues(input);

  return Math.min(values.markLevel, clampTaskCompletionLevels(settings.levels));
}

export function getTaskCompletionOptions(
  settings: TaskCompletionSettings = defaultTaskCompletionSettings,
): TaskCompletionValues[] {
  const levels = clampTaskCompletionLevels(settings.levels);
  const options: TaskCompletionValues[] = [uncheckedTaskCompletionValues];

  for (let markLevel = 1; markLevel <= levels; markLevel += 1) {
    options.push({ completed: true, ignored: false, markLevel });
  }

  if (settings.ignored) {
    options.push(ignoredTaskCompletionValues);
  }

  return options;
}

export function getNextTaskCompletionValues(
  input: TaskCompletionInput,
  settings: TaskCompletionSettings = defaultTaskCompletionSettings,
): TaskCompletionValues {
  const values = normalizeTaskCompletionValues(input);

  if (values.ignored) {
    return uncheckedTaskCompletionValues;
  }

  const levels = clampTaskCompletionLevels(settings.levels);

  if (values.markLevel < levels) {
    return {
      completed: true,
      ignored: false,
      markLevel: values.markLevel + 1,
    };
  }

  return settings.ignored
    ? ignoredTaskCompletionValues
    : uncheckedTaskCompletionValues;
}

export function getSelectionCompletionValues(
  inputs: readonly TaskCompletionInput[],
): TaskCompletionValues {
  const [first, ...rest] = inputs.map(normalizeTaskCompletionValues);

  if (!first) {
    return uncheckedTaskCompletionValues;
  }

  const sharesFirstValues = rest.every(
    (values) =>
      values.ignored === first.ignored && values.markLevel === first.markLevel,
  );

  return sharesFirstValues ? first : uncheckedTaskCompletionValues;
}
