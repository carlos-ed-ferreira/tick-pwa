export interface Dictionary {
  app: {
    name: string;
    localFirst: string;
  };
  navigation: {
    home: string;
    calendar: string;
    goals: string;
  };
  calendar: {
    title: string;
    today: string;
    previousMonth: string;
    nextMonth: string;
    emptyDay: string;
    weekdays: readonly [string, string, string, string, string, string, string];
  };
  dayEditor: {
    title: string;
    addItem: string;
    untitledItem: string;
    colors: string;
  };
  goals: {
    title: string;
    categories: {
      short: string;
      medium: string;
      long: string;
    };
    addGoal: string;
    progress: string;
  };
  status: {
    offline: string;
    synced: string;
    syncing: string;
    pending: string;
    needsAttention: string;
  };
  settings: {
    language: string;
    installApp: string;
    updateAvailable: string;
  };
}
