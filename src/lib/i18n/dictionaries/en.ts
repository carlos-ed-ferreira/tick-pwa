import type { Dictionary } from './types';

export const enDictionary = {
  app: {
    name: 'Tick',
    localFirst: 'Local-first',
  },
  navigation: {
    home: 'Tick',
    calendar: 'Daily Calendar',
    goals: 'Goals',
  },
  calendar: {
    title: 'Daily Calendar',
    today: 'Today',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    emptyDay: 'No items',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  dayEditor: {
    title: 'Day editor',
    addItem: 'Add item',
    untitledItem: 'New item',
    colors: 'Colors',
  },
  goals: {
    title: 'Goals',
    categories: {
      short: 'Short term',
      medium: 'Medium term',
      long: 'Long term',
    },
    addGoal: 'Add goal',
    progress: 'Progress',
  },
  status: {
    offline: 'Offline',
    synced: 'Synced',
    syncing: 'Syncing',
    pending: 'Pending',
    needsAttention: 'Needs attention',
  },
  settings: {
    language: 'Language',
    installApp: 'Install app',
    updateAvailable: 'Update available',
  },
} satisfies Dictionary;
