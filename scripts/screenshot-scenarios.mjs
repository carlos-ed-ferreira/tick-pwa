export const demoScenarios = {
  'pt-BR': {
    categorySections: [
      ['Grupos', ['CARREIRA', 'CASA', 'VIDA']],
      ['Metas', ['TRABALHO', 'FINANÇAS', 'FORMAÇÃO']],
      ['Etapas', ['PLANEJAMENTO', 'PRODUÇÃO', 'REVISÃO']],
    ],
    goals: [
      {
        title: 'Portfólio',
        category: 'TRABALHO',
        steps: [
          'Selecionar três projetos',
          'Escrever os estudos de caso',
          'Revisar textos e imagens',
          'Montar a versão navegável',
          'Publicar e testar os links',
        ],
        stepCategories: ['PLANEJAMENTO', 'PRODUÇÃO', 'REVISÃO'],
        dates: [
          [1, 14],
          [3, 21],
        ],
      },
      {
        title: 'Planejar reserva',
        category: 'FINANÇAS',
        steps: [
          'Calcular três meses de despesas',
          'Definir o aporte mensal',
          'Programar a transferência inicial',
        ],
      },
      {
        title: 'Planejar viagem',
        steps: [
          'Escolher destino e datas',
          'Comparar passagens e hospedagens',
          'Fechar as reservas',
        ],
      },
      {
        title: 'Inscrição na pós',
        category: 'FORMAÇÃO',
        steps: [
          'Comparar os programas',
          'Solicitar o histórico escolar',
          'Enviar a documentação',
        ],
        group: 'Estudos',
        groupCategory: 'CARREIRA',
      },
      {
        title: 'Home office',
        steps: [
          'Definir o orçamento',
          'Escolher cadeira e luminária',
          'Montar e ajustar o espaço',
        ],
        group: 'Casa',
      },
    ],
    activities: [
      {
        name: 'Leitura',
        category: 'FOCO',
        target: 20,
        unit: 'páginas',
        values: [24, 20, 12, null, 28, 0, 22, 15, 20, 15],
      },
      {
        name: 'Caminhada',
        category: 'SAÚDE',
        target: 3,
        unit: 'km',
        weekdays: [1, 3, 5],
        values: [3.5, null, 2.4, null, 3.2, null, null, 4, null, 3.1],
      },
      {
        name: 'Inglês',
        category: 'FOCO',
        target: 20,
        unit: 'min',
        weekdays: [1, 2, 3, 4, 5],
        values: [25, 20, 10, 20, 0, null, null, 30, 15, 25],
      },
      {
        name: 'Alongamento',
        category: 'SAÚDE',
        target: 10,
        unit: 'min',
        weekdays: [2, 4, 6],
        values: [null, 10, null, 8, null, 12, null, null, 10, null],
      },
      {
        name: 'Planejar refeições',
        category: 'CASA',
        weekdays: [0],
        values: [null, null, null, null, null, null, true, null, null, null],
      },
    ],
    weekdays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  en: {
    categorySections: [
      ['Groups', ['CAREER', 'HOME', 'LIFE']],
      ['Goals', ['WORK', 'FINANCE', 'EDUCATION']],
      ['Steps', ['PLANNING', 'PRODUCTION', 'REVIEW']],
    ],
    goals: [
      {
        title: 'Portfolio',
        category: 'WORK',
        steps: [
          'Choose three projects',
          'Write the case studies',
          'Review copy and images',
          'Build the working website',
          'Publish and test the links',
        ],
        stepCategories: ['PLANNING', 'PRODUCTION', 'REVIEW'],
        dates: [
          [1, 14],
          [3, 21],
        ],
      },
      {
        title: 'Savings plan',
        category: 'FINANCE',
        steps: [
          'Calculate three months of expenses',
          'Set a monthly contribution',
          'Schedule the first transfer',
        ],
      },
      {
        title: 'Plan a trip',
        steps: [
          'Choose dates and destination',
          'Compare flights and accommodation',
          'Confirm the bookings',
        ],
      },
      {
        title: 'Course application',
        category: 'EDUCATION',
        steps: [
          'Compare the programs',
          'Request academic transcripts',
          'Submit the documents',
        ],
        group: 'Studies',
        groupCategory: 'CAREER',
      },
      {
        title: 'Home office',
        steps: [
          'Set the budget',
          'Choose a chair and desk lamp',
          'Set up the workspace',
        ],
        group: 'Home',
      },
    ],
    activities: [
      {
        name: 'Reading',
        category: 'FOCUS',
        target: 20,
        unit: 'pages',
        values: [24, 20, 12, null, 28, 0, 22, 15, 20, 15],
      },
      {
        name: 'Walking',
        category: 'HEALTH',
        target: 3,
        unit: 'km',
        weekdays: [1, 3, 5],
        values: [3.5, null, 2.4, null, 3.2, null, null, 4, null, 3.1],
      },
      {
        name: 'Language practice',
        category: 'FOCUS',
        target: 20,
        unit: 'min',
        weekdays: [1, 2, 3, 4, 5],
        values: [25, 20, 10, 20, 0, null, null, 30, 15, 25],
      },
      {
        name: 'Stretching',
        category: 'HEALTH',
        target: 10,
        unit: 'min',
        weekdays: [2, 4, 6],
        values: [null, 10, null, 8, null, 12, null, null, 10, null],
      },
      {
        name: 'Meal planning',
        category: 'HOME',
        weekdays: [0],
        values: [null, null, null, null, null, null, true, null, null, null],
      },
    ],
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};
