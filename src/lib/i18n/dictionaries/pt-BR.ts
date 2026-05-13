import type { Dictionary } from './types';

export const ptBRDictionary = {
  app: {
    name: 'Tick',
    localFirst: 'Local-first',
  },
  navigation: {
    home: 'Tick',
    calendar: 'Calendário diário',
    goals: 'Metas',
  },
  calendar: {
    title: 'Calendário diário',
    today: 'Hoje',
    previousMonth: 'Mês anterior',
    nextMonth: 'Próximo mês',
    emptyDay: 'Sem itens',
    weekdays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  dayEditor: {
    title: 'Editor do dia',
    addItem: 'Adicionar item',
    untitledItem: 'Novo item',
    colors: 'Cores',
  },
  goals: {
    title: 'Metas',
    categories: {
      short: 'Curto prazo',
      medium: 'Médio prazo',
      long: 'Longo prazo',
    },
    addGoal: 'Adicionar meta',
    progress: 'Progresso',
  },
  status: {
    offline: 'Offline',
    synced: 'Sincronizado',
    syncing: 'Sincronizando',
    pending: 'Pendente',
    needsAttention: 'Precisa de atenção',
  },
  settings: {
    language: 'Idioma',
    installApp: 'Instalar app',
    updateAvailable: 'Atualização disponível',
  },
} satisfies Dictionary;
