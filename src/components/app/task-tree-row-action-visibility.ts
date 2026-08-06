export type TaskTreeRowActionPlacement = 'hidden' | 'inline' | 'menu';

export interface TaskTreeRowActionPreferences {
  add: TaskTreeRowActionPlacement;
  bold: TaskTreeRowActionPlacement;
  category: TaskTreeRowActionPlacement;
  clearCategory: TaskTreeRowActionPlacement;
  delete: TaskTreeRowActionPlacement;
  drag: boolean;
  indent: TaskTreeRowActionPlacement;
  moveDown: TaskTreeRowActionPlacement;
  moveUp: TaskTreeRowActionPlacement;
  outdent: TaskTreeRowActionPlacement;
  priority: TaskTreeRowActionPlacement;
  scheduledTime: boolean;
  scheduledDate: boolean;
}

export const defaultTaskTreeRowActionPreferences: TaskTreeRowActionPreferences =
  {
    add: 'inline',
    bold: 'menu',
    category: 'menu',
    clearCategory: 'menu',
    delete: 'menu',
    drag: true,
    indent: 'inline',
    moveDown: 'inline',
    moveUp: 'inline',
    outdent: 'inline',
    priority: 'menu',
    scheduledTime: true,
    scheduledDate: true,
  };

export function copyTaskTreeRowActionPreferences({
  source,
  target,
}: {
  source: TaskTreeRowActionPreferences;
  target: TaskTreeRowActionPreferences;
}): TaskTreeRowActionPreferences {
  return {
    ...source,
    scheduledTime: target.scheduledTime,
    scheduledDate: target.scheduledDate,
  };
}

export function isTaskTreeBulkActionVisible(
  preferences: TaskTreeRowActionPreferences,
  action: 'bold' | 'category' | 'clearCategory' | 'delete' | 'priority',
) {
  return preferences[action] !== 'hidden';
}

export function hasTaskTreeMenuActions(
  preferences: TaskTreeRowActionPreferences,
) {
  return (
    preferences.add === 'menu' ||
    preferences.bold === 'menu' ||
    preferences.category === 'menu' ||
    preferences.clearCategory === 'menu' ||
    preferences.delete === 'menu' ||
    preferences.indent === 'menu' ||
    preferences.moveDown === 'menu' ||
    preferences.moveUp === 'menu' ||
    preferences.outdent === 'menu' ||
    preferences.priority === 'menu'
  );
}
