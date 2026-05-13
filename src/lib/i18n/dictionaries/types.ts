export interface Dictionary {
  app: {
    name: string;
    localFirst: string;
  };
  navigation: {
    home: string;
    calendar: string;
    goals: string;
    categories: string;
  };
  calendar: {
    title: string;
    today: string;
    previousMonth: string;
    nextMonth: string;
    previousYear: string;
    nextYear: string;
    emptyDay: string;
    weekdays: readonly [string, string, string, string, string, string, string];
  };
  dayEditor: {
    title: string;
    addItem: string;
    addChild: string;
    addCategory: string;
    assignCategory: string;
    clearCategory: string;
    checklist: string;
    close: string;
    collapseItem: string;
    untitledItem: string;
    emptyChecklist: string;
    expandItem: string;
    itemPlaceholder: string;
    newCategory: string;
    indentItem: string;
    moveCategoryDown: string;
    moveCategoryUp: string;
    outdentItem: string;
    deleteItem: string;
    toggleItem: string;
    categories: string;
    categoryNamePlaceholder: string;
    deleteCategory: string;
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
