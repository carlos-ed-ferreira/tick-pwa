# Tick

Tick é uma PWA mobile-first de produtividade pessoal para organizar tarefas
diárias, checklists hierárquicos, categorias, grupos de metas, metas e etapas.
O produto funciona no navegador em dois modos: guest sem conta e autenticado
com dados locais e persistência remota. Neste projeto, local-first significa
que o usuário autenticado pode continuar trabalhando ao perder a internet;
guest é o uso sem conta e não comprova o contrato da conta offline.

## Capacidades atuais

- calendário mensal e tarefas por dia;
- tarefas e subtarefas hierárquicas;
- criação e limpeza em lote;
- seleção múltipla com ações coletivas de conclusão, prioridade, negrito,
  categoria e exclusão;
- importação JSON;
- categorias separadas por superfície;
- visualização de tarefas e etapas em lista única ou em abas por categoria;
- estados de marcação configuráveis por superfície, com até cinco níveis e
  estado ignorado opcional, e seleção direta do estado por clique direito ou
  toque longo no checkbox;
- grupos de metas, metas e etapas hierárquicas;
- instalação como PWA e fallback de navegação offline;
- interface adaptada a toque, com alvos de 44px, drag por toque e calendário
  de densidade compacta em telas estreitas;
- interface em português do Brasil e inglês;
- modo local e modo autenticado por allowlist.

## Arquitetura atual

O repositório contém uma única aplicação web Next.js. Não há BFF, API Route,
worker de aplicação, fila externa ou microsserviço. O navegador acessa o
Supabase por `@supabase/supabase-js`. Uma RPC PostgreSQL implementa o contrato
transacional e idempotente para lotes funcionais de calendário, categorias e
metas. O consumidor funcional usa uma outbox Dexie durável, mas permanece
desligado por padrão e restrito por uma allowlist de UUIDs durante o rollout.

As páginas usam App Router. O layout lê cookies e cabeçalhos para escolher o
idioma inicial, por isso as rotas principais são renderizadas dinamicamente no
servidor. As telas e os fluxos de negócio são majoritariamente componentes
client-side.

```text
Next.js App Router
  ├─ src/app e src/features       UI e composição das telas
  ├─ src/components e src/hooks   componentes e comportamento reutilizável
  ├─ src/lib/domain               tipos e regras puras
  ├─ src/lib/db                   schema Dexie e comandos locais
  ├─ src/lib/supabase             auth, mapeamento e acesso remoto
  ├─ src/lib/i18n e src/lib/time  localização, datas e timezone
  └─ src/providers                sessão, escopo e orquestração global

Browser
  ├─ IndexedDB/Dexie              fonte imediata da UI
  ├─ Supabase Auth                sessão autenticada
  └─ Supabase REST/Postgres       persistência canônica da conta
```

### Fronteiras e dependências

- `src/app` monta rotas e providers;
- `src/features` organiza capacidades do produto;
- `src/components/ui` contém primitives e `src/components/app` contém padrões
  compartilhados do produto;
- `src/lib/domain` não depende de UI nem de persistência;
- `src/lib/db` concentra schema, migrations locais e comandos que escrevem no
  IndexedDB;
- `src/lib/supabase` concentra o cliente remoto, autenticação, mapeadores,
  refresh e persistência da conta;
- componentes e hooks podem observar tabelas Dexie para leitura, mas as
  escritas passam pelos comandos de `src/lib/db`;
- `supabase/schemas/tick.sql` é o estado declarativo canônico do Postgres;
- `tests/unit`, `tests/integration`, `tests/e2e` e `supabase/tests` cobrem níveis
  diferentes do sistema.

### Responsividade e adaptação mobile

O produto é mobile-first e mantém uma única linguagem visual nos dois tamanhos.
Cores, tokens, superfícies, sombras, tipografia e primitives são idênticos em
mobile e desktop; o que muda é densidade, área de toque e composição.

A adaptação usa os sinais de capacidade e de largura, e não breakpoints novos
que alterem o desktop:

- capacidade do ponteiro, por `(pointer: coarse)`, para comportamento de
  interação e área de toque;
- largura real medida em runtime, para densidade do calendário;
- a conjunção dos dois, `(pointer: coarse) and (max-width: 899.98px)`, para
  escolher a composição de toque.

A consulta de composição tem uma fonte única, `touchCompositionQuery` em
`src/hooks/use-touch-composition.ts`, espelhada em `globals.css` pela variante
`touch` do Tailwind. Como ela nunca casa com ponteiro fino, o desenho de 640px
para cima fica inalterado por construção. Celular em pé e deitado recebem a
composição de toque; tablet e notebook com tela sensível acima de 900px
continuam no desenho desktop.

Convenções em vigor:

| Sinal                      | Onde                                 | Efeito                                               |
| -------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `useTouchComposition`      | `src/hooks/use-touch-composition.ts` | escolhe a composição de toque                        |
| variante `touch:`          | utilitários Tailwind                 | override de toque sobre a base desktop               |
| `useCoarsePointer`         | `src/hooks/use-coarse-pointer.ts`    | toque abre o dia; drag de árvore por ponteiro        |
| `@media (pointer: coarse)` | `src/app/globals.css`                | área de toque de 44px e descrição sempre visível     |
| `.touch-target`            | primitives `Button` e `IconButton`   | amplia só a área de acerto, sem mudar o desenho      |
| `getCalendarDayDensity`    | `src/features/calendar`              | célula do calendário compacta abaixo de 72px         |
| `getCalendarWeekDensity`   | `src/features/calendar`              | dia da faixa de semana compacto abaixo de 48px       |
| `--app-bottom-nav-height`  | `src/app/globals.css`                | reserva o espaço da barra inferior; `0px` no desktop |
| `sm:` restaurando o valor  | composições mobile legadas           | preserva o desenho desktop existente                 |
| `.app-safe-padding`        | shells de página                     | respeita `env(safe-area-inset-*)` com `viewportFit`  |

Para código novo, a regra de escrita é **base igual ao desktop atual e `touch:`
como override**; `sm:` restaurando o valor continua válido no que já existe.

Três composições próprias de toque:

- **Calendário**: faixa de semana rolável mais a agenda do dia selecionado
  (`calendar-week-view.tsx`). A grade do mês continua existindo e abre em folha
  inferior pelo controle de visão de mês. O dia selecionado é persistido por
  escopo em preferência local, sem consulta nova: a semana é derivada do mesmo
  range de 42 dias que o mês visível já carrega.
- **Linha de tarefa e de etapa**: checkbox, texto, alça de arrasto e `⋯`. Todas
  as demais ações, inclusive hora e data, vivem em `TaskTreeRowActionsSheet`,
  com alvos de 44px e categoria sem depender de hover.
- **Shell**: cabeçalho de uma linha com logo, sincronização, idioma e saída, e
  navegação fixa no rodapé. As categorias de tarefas ficam no cabeçalho do dia;
  as de metas, na barra da visão geral de Metas e nos cabeçalhos de grupo e meta.

Regras derivadas:

- alvo de toque mínimo de 44px em ponteiro grosso, obtido por área de acerto e
  não por aumento visual do controle;
- todo controle com desenho menor que 44px usa `touch-target`;
- reordenação de árvore funciona por HTML5 drag no mouse e por Pointer Events
  no toque, com o mesmo contrato de placement em `tree-touch-drag.ts`;
- `interactiveWidget: 'resizes-content'` no viewport para o teclado virtual;
- folha inferior é `Dialog size="sheet"`, limitada a `85dvh` e com rolagem
  própria, para o teclado virtual não empurrar o conteúdo para fora;
- composição mobile própria só quando comprimir o desktop não atende.

### Fluxo de leitura e escrita

No modo local, a UI lê do IndexedDB e os comandos confirmam as alterações em
transações Dexie. Nenhuma entidade do usuário é enviada ao Supabase.

No modo autenticado, o app baixa snapshots das tabelas da conta para um cache
Dexie. Os snapshots são paginados em blocos de 1.000 linhas, ordenados apenas
pelo identificador, que é imutável, e só reconciliam exclusões das entidades depois que todas
as páginas terminam com sucesso. Preferências são atualizadas separadamente. Refreshes simultâneos do mesmo escopo
compartilham uma única leitura remota, e o merge compara a versão local capturada antes da rede com a versão atual.
Escritas criadas, alteradas ou confirmadas durante a leitura ficam protegidas,
assim como suas dependências. Revisões remotas inferiores ou iguais não
sobrescrevem versões sincronizadas mais recentes. No rollout controlado, a alteração funcional e seu lote
remoto são gravados atomicamente no IndexedDB. A outbox preserva o mesmo
`operation_id` entre reloads, mantém a ordem, agrupa até 100 mutações e envia
uma RPC transacional; falhas continuam visíveis e podem ser reenviadas. Contas
fora da coorte de lotes permanecem no caminho legado de `upsert` direto e fila em
memória. Não existe dual-write entre os dois caminhos.

Uma operação que falha é retentada automaticamente no máximo cinco vezes, com
espera exponencial de 1 s a 30 s entre as tentativas; reconexão e retry manual
ignoram essa espera. O limite de cinco bloqueia apenas operações rejeitadas pelo
servidor. Uma operação que esgotou as tentativas por falta de rede para de
agendar novos timers, mas continua pendente e é enviada na próxima reconexão,
foco ou retomada, sem depender de sincronização manual. A fila durável é limitada a 200 operações por conta: ao
atingir o limite, a alteração continua salva localmente, deixa de gerar novas
operações remotas e aparece como falha recuperável, resolvida pela
sincronização forçada. Uma rejeição `stale_revision` é rebaseada uma vez pela
revisão atual do servidor e reenviada automaticamente; se ainda assim falhar, a
operação permanece visível e recuperável. A drenagem da outbox usa um lock por
conta, compartilhado com a sincronização forçada e o envio de preferências,
para que abas do mesmo navegador não disputem o mesmo `operation_id`. Sem
Web Locks, a serialização cobre somente a aba atual.
Quando o navegador informa que está offline, uma operação nova permanece
pendente sem iniciar RPC. Se a conexão cai durante uma chamada, a operação volta
de `syncing` para `pending` e conserva o mesmo identificador para a retomada na
reconexão. O mesmo vale quando a RPC devolve um erro de transporte antes de
`navigator.onLine` refletir a queda: a primeira operação permanece pendente, o
dreno para e uma tentativa limitada usa o backoff da outbox. Refreshes remotos
disparados por foco ou sessão também não começam enquanto o navegador está
offline; indisponibilidade esperada não é apresentada como falha definitiva de
sincronização.

Preferências de conta confirmam localmente e guardam estado de envio, número
de tentativas e prazo de retry em `localPreferences`. Reabertura e reconexão
retomam o último valor local; falha remota não restaura um valor antigo. O
acknowledgement só confirma a versão enviada. São no máximo cinco tentativas
automáticas, com backoff de 1 s a 30 s; a sincronização forçada permite nova
tentativa. O indicador inclui entidades e preferências. Essa persistência de
preferências vale também fora da coorte funcional; guest permanece somente local.

O indicador de sincronização é acionável em qualquer estado. A ação baixa o
snapshot remoto e depois envia o que este dispositivo alterou, nessa ordem. O
pull aceita o valor remoto apenas para entidades já sincronizadas localmente e
nunca sobrescreve uma alteração local ainda pendente. O push envia somente
essas alterações pendentes, com `base_revision` rebaseada a partir do servidor,
de modo que o dispositivo atual vence o conflito. Entidades já convergidas não
são reenviadas, o que impede que dois dispositivos fiquem revertendo o valor um
do outro. A ação nunca apaga linhas que existam apenas no remoto, e é a saída
para um `stale_revision` que o retry automático não resolve sozinho.

Alterações pendentes carregam junto as entidades que referenciam. O pull não
remove um pai já sincronizado enquanto um filho pendente depender dele, e o
push reenvia esse pai quando ele não existe mais no servidor, antes do filho.
Sem isso, uma exclusão física no outro dispositivo deixaria a alteração local
presa em violação de chave estrangeira.

Refreshes de uma mesma conta são deduplicados. Foco e reconexão usam debounce
de 500 ms e só atualizam dados com pelo menos 60 segundos; refresh manual ignora
essa validade. A reconciliação só escreve no IndexedDB o que realmente mudou:
linhas com a mesma revisão remota e preferências com o mesmo valor não são
regravadas, então um refresh sem novidade não dispara nenhuma consulta viva nem
re-render da interface. O indicador de sincronização também só sai de
`Sincronizado` quando a atividade passa de 800 ms; ciclos rápidos permanecem
invisíveis, enquanto falha aparece imediatamente. A duração, páginas, linhas e
motivo ficam no resultado estruturado do refresh e são enviados ao Sentry pelo
adapter de telemetria quando o DSN está configurado.

Métricas de fila, tentativas, rejeições, falhas de transporte, conflitos,
tamanho e duração dos lotes, idade da operação mais antiga e latência de
confirmação são acumuladas por conta em
`src/lib/db/account-sync-metrics.ts`, sem conteúdo do usuário. Elas não
têm identidade nem conteúdo funcional. Um adapter independente envia os
agregados e resultados de refresh ao Sentry quando o DSN é configurado. Todas
as integrações automáticas ficam desligadas e uma allowlist remove identidade,
conteúdo funcional, tokens e payloads antes do fornecedor.

O backend contém `apply_account_operation_batch` e recibos por conta e
`operation_id`. O contrato aceita até 100 mutações de categoria, dia, tarefa,
grupo de metas, meta, etapa, recorrência e resposta, deriva ownership do JWT, aplica compare-and-set
por revisão e confirma o lote inteiro em uma transação. Cada chamada também
descarta os recibos da própria conta com mais de sete dias.

A estratégia de lotes usa Dexie e Supabase, sem outra fonte canônica. As
contas fora da coorte continuam no caminho legado descrito acima. Consultas
Supabase usam `cache: no-store`; autorização e dados não dependem do cache HTTP
do navegador. Quando o navegador informa ausência de rede, a verificação de
acesso usa o contrato de grant local e a atualização do perfil remoto é adiada.

### Tema

O Tick tem um único tema, o escuro. Os tokens de `src/app/globals.css` não dependem
de `prefers-color-scheme`, e a aparência é a mesma em qualquer configuração do
sistema.

### Tarefas recorrentes

A aba `/recurring` é independente das tarefas do dia e das metas: não altera o
progresso delas e usa a surface de categorias própria `recurrence`. Ela tem três
visualizações:

- **Executar** responde às atividades da data selecionada.
- **Atividades** administra as atividades, sem métricas: frequência, pausa e
  ações. Filtra por situação, categoria e nome.
- **Desempenho** analisa um período e abre o histórico de cada atividade, com
  calendário mensal dos resultados e lista cronológica.

A visualização e a atividade aberta ficam na URL (`?view=activities`,
`?view=performance&activity=<id>`), e voltar no navegador restaura o contexto.
O motor puro fica em `src/lib/domain/recurrence.ts`, os indicadores em
`src/lib/domain/recurrence-performance.ts` e os comandos em
`src/lib/db/recurrence-commands.ts`.

Ocorrências são calculadas na consulta; somente respostas são persistidas.

- `recurrences` guarda uma linha por atividade, com o conteúdo atual, as
  subtarefas em JSON e dois históricos. `schedule` lista segmentos
  `{from, rule}`: o primeiro tem `from: null` e vale para todo o passado, e
  `rule: null` representa pausa. `content_history` guarda o conteúdo anterior,
  válido até a data `until`, exclusiva.
- `recurrence_responses` guarda uma linha por data e item, com `item_id` nulo
  para a atividade principal. O id é determinístico por escopo, atividade, data e
  item, e o Postgres exige que ele contenha o próprio `user_id`.
- Voltar a pendente grava `deleted_at`; responder de novo restaura a mesma linha.

Regras:

- A taxa usa somente as respostas da atividade principal, contando cada data uma
  vez. Subtarefas têm respostas próprias que não entram nos indicadores nem
  alteram a principal.
- O Desempenho usa os últimos 7, 30 ou 90 dias até hoje, ou um intervalo
  personalizado, sempre inclusivo e no fuso do usuário. O padrão é 30 dias.
  Período e categoria valem para todos os indicadores e para o histórico.
- Cada data prevista no período é Feita, Não feita, Sem registro (passado sem
  resposta) ou Pendente (hoje sem resposta). Datas futuras ficam de fora.
- O acompanhamento começa na criação da atividade ou na primeira resposta, o
  que vier antes; não há ocorrências retroativas antes disso.
- A taxa é feitas ÷ (feitas + não feitas). Sem nenhuma das duas, mostra "—".
  A cobertura é respondidas ÷ (respondidas + sem registro) e é secundária.
- A ordenação por taxa deixa as atividades sem dados no fim.
- O calendário do histórico distingue dias sem ocorrência, futuros e fora do
  período dos dias previstos; nenhum deles conta como falha.
- Hoje e o passado aceitam resposta; datas futuras são somente consulta.
- Uma resposta dada continua visível na data mesmo que a regra deixe de prevê-la.
- Mudar a frequência cria um segmento a partir de hoje, sem recalcular o passado.
  Atividade pausada precisa ser reativada para mudar de frequência.
- Mudar o conteúdo depois de haver respostas pergunta como aplicar: atualizar os
  registros anteriores limpa `content_history`; aplicar daqui em diante corta
  o conteúdo em hoje, ou em amanhã se já houver resposta hoje.
- Pausar e reativar valem a partir de hoje, e o intervalo pausado não tem
  ocorrências. Excluir faz cascata para as respostas.
- Sem data escolhida, a visão do dia acompanha a virada do dia.
- Guest recebe categorias padrão próprias, e o editor permite gerenciá-las sem
  perder o rascunho.

Atividades quantitativas:

- Uma atividade sem subtarefas, ou uma subtarefa final, pode ter uma medida
  com meta mínima e unidade em texto livre (`measure`). Itens com subtarefas
  não são medidos.
- A meta e o registro aceitam até 3 casas decimais, entre 0 e 1.000.000,
  e as comparações são feitas em milésimos.
- O registro define o total do dia, sem somar valores. Zero é "Não feita";
  limpar volta a "Sem registro". Igual ou acima da meta é "Feita"; entre zero e
  a meta é "Parcial", que conta como não atingida na taxa.
- Cada resposta guarda `quantity`, `target` e `unit` da época, e o `status`
  é derivado deles. Respostas binárias antigas nunca recebem valores.
- Mudar a medida de uma atividade com respostas vale a partir do dia seguinte,
  pelo `content_history`.
- O progresso quantitativo é Σ min(valor, meta) ÷ Σ meta dos registros, por
  unidade; o total realizado usa o valor real. Unidades diferentes não são
  somadas.

Compatibilidade com versões antigas da PWA: clientes novos sempre enviam a
chave `measure` em cada subtarefa e as colunas quantitativas da resposta. O
trigger `recurrences_preserve_measures` recupera, por id, a medida de subtarefas
e de snapshots de histórico que chegam sem a chave, nos dois caminhos de
sincronização; `null` explícito remove a medida. A RPC só altera `measure` e
as colunas quantitativas quando a chave está no payload, e a constraint
`recurrence_responses_quantity_check` rejeita uma escrita antiga que mudaria o
status sem a quantidade, mantendo a operação retida com aviso.

Na conta, as duas entidades seguem a outbox de lotes e o caminho legado. Dois
dispositivos que criam offline a mesma resposta convergem: o ramo da RPC usa
`on conflict (id) do nothing`, a linha existente resulta em `stale_revision`, e o
rebase reaplica a resposta como update. Vence o último dispositivo a reenviar.
O conteúdo da atividade segue a mesma regra, para a linha inteira.

### PWA e offline

Serwist gera `public/sw.js` durante o build. Assets usam estratégias de cache e
navegações usam `NetworkFirst` com fallback em `/~offline`. O shell de `/`,
`/calendar`, `/goals` e `/recurring` é precacheado para permitir reload direto offline mesmo
quando a rota foi aberta originalmente por navegação client-side. Parâmetros
locais, como o dia ou a meta selecionada, reutilizam o mesmo shell precacheado e
são reconstruídos do IndexedDB. O modo local continua funcional sem Supabase. A
reabertura da conta offline depende da sessão disponível e de grant positivo
da mesma conta/e-mail com até 24 horas quando o Supabase está indisponível.
Uma sessão já aberta e a reabertura autenticada são cenários diferentes;
a primeira visita e um login novo dependem dos serviços remotos.

### Navegadores suportados

- Chrome desktop e Chrome Android nas versões estáveis atual e anterior são o
  alvo primário e têm cobertura automatizada;
- Safari macOS e Safari iOS nas versões estáveis atual e anterior são alvo
  oficial; a cobertura automatizada de navegador usa Chromium e a aprovação de
  sincronização no Safari depende de ensaio manual;
- outros navegadores Chromium podem funcionar, mas não compõem a matriz oficial;
- Firefox não faz parte da matriz oficial;
- o produto exige IndexedDB e service worker. Se o armazenamento
  local estiver bloqueado ou indisponível, uma tela traduzida orienta a liberar
  dados de site, fechar outras abas e tentar novamente sem limpar os dados;
- calendário e metas usam lock por conta quando o navegador oferece Web Locks e
  preservam a outbox em sua ausência.

## Stack verificada

| Área               | Tecnologia                                                    |
| ------------------ | ------------------------------------------------------------- |
| Linguagem          | TypeScript 5, configuração `strict`                           |
| Runtime            | Node.js `^20.19.0 \|\| >=22.12.0`                             |
| Package manager    | npm, lockfile v3                                              |
| Framework          | Next.js 16.4.4, App Router e React 19.2.4                     |
| UI                 | Tailwind CSS 4, Lucide e React Icons                          |
| PWA                | Serwist 9                                                     |
| Banco local        | IndexedDB com Dexie 4                                         |
| Banco remoto       | PostgreSQL 17 no ambiente local do Supabase                   |
| Query layer        | Dexie local e cliente REST do Supabase; não há ORM relacional |
| Autenticação       | Supabase Auth, senha e Google, com allowlist própria          |
| i18n               | dicionários tipados `pt-BR` e `en`                            |
| Unit/integration   | Vitest 4.1.12, Testing Library, jsdom e fake-indexeddb        |
| E2E                | Playwright 1.62.1, Chromium desktop e perfil Pixel 7          |
| Responsividade     | mobile-first por `(pointer: coarse)` e largura medida         |
| Banco              | Supabase CLI e pgTAP                                          |
| Análise            | TypeScript, ESLint 9 e verificador próprio de comentários     |
| Formatação         | Prettier 3 e EditorConfig                                     |
| CI                 | GitHub Actions                                                |
| Deploy documentado | Vercel e Supabase gerenciado                                  |

Não há cache de servidor, broker de filas, storage de arquivos usado pela
aplicação ou pooler habilitado. O Supabase CLI gerencia seus próprios
containers; o projeto não possui Dockerfile nem Compose próprios.

## Terminologia

| Termo             | Significado no produto                                  |
| ----------------- | ------------------------------------------------------- |
| Tarefa            | item de checklist associado a um dia em `/calendar`     |
| Subtarefa         | descendente hierárquico de uma tarefa                   |
| Categoria         | marcador visual pertencente a uma superfície específica |
| Grupo de metas    | agrupador opcional de metas                             |
| Meta              | resultado acompanhado em `/goals`                       |
| Recorrência       | atividade repetida acompanhada em `/recurring`          |
| Etapa             | item hierárquico dentro de uma meta                     |
| Subetapa          | descendente de uma etapa                                |
| Nível de marcação | grau de conclusão da tarefa ou etapa, de 1 até o máximo |
| Estado ignorado   | marcação opcional que exclui a tarefa das contagens     |
| Modo guest        | uso sem conta, no escopo `guest:<installationId>`       |
| Modo autenticado  | uso no escopo `user:<supabaseUserId>`                   |
| Local-first       | continuidade do uso autenticado ao perder a internet    |
| Allowlist         | tabela `account_access` que libera as contas convidadas |

Os nomes técnicos principais continuam `ChecklistItem`, `Goal`, `GoalGroup` e
`GoalStep`. Menus de overflow são chamados de **opções extras**.

## Modos de uso atuais

### Guest sem conta

- usa o escopo `guest:<installationId>`;
- salva entidades apenas no IndexedDB do dispositivo;
- não envia entidades ao Supabase;
- oferece todas as funcionalidades de organização, sem prazo nem limite de
  quantidade imposto pelo produto;
- não migra dados automaticamente para uma conta.

### Autenticado

- usa o escopo `user:<supabaseUserId>`;
- exige sessão Supabase e uma linha ativa em `account_access`;
- conserva por até 24 horas a última autorização positiva da mesma conta para
  permitir reload offline, sem converter falha de rede em acesso negado;
- mantém cache IndexedDB separado por usuário;
- persiste entidades no Postgres protegido por RLS;
- não importa dados guest.

O acesso remoto permanece fechado a convidados autorizados. O modo guest é
completo e gratuito, sem limite de tempo ou quantidade imposto pelo produto,
com dados somente no IndexedDB deste navegador. Fechar/reabrir o app não apaga
progresso. Limites físicos e limpeza do armazenamento pelo navegador continuam
possíveis; não há cópia remota dos dados guest.
A política está em
[MODOS-DE-ACESSO.md](docs/planning/MODOS-DE-ACESSO.md).

## Estrutura do repositório

```text
src/app             rotas, layout, manifest e service worker
src/components      primitives e componentes compartilhados
src/features        áreas funcionais do produto
src/hooks           hooks reutilizáveis
src/lib/db          Dexie, migrations e comandos locais
src/lib/domain      tipos e regras de domínio
src/lib/i18n        locale, dicionários e formatação
src/lib/supabase    auth, query layer e mapeamento remoto
src/lib/time        datas diárias e timezone
src/providers       contexto global e escopo de usuário
tests/unit          testes unitários e de componentes
tests/integration   integração de domínio, Dexie e mocks de Supabase
tests/e2e           fluxos Playwright
supabase/schemas    estado declarativo do Postgres
supabase/migrations migrations versionadas
supabase/tests      testes pgTAP
scripts             wrappers do Supabase e validação de comentários
docs                documentação detalhada
```

## Pré-requisitos

- Git;
- Node.js 20.19+ ou 22.12+ com npm, conforme o `engines` do `package.json` e
  o requisito do Vite 8 usado pelas ferramentas de teste;
- Docker acessível ao usuário local;
- GNU Make;
- portas locais 3000 e 54320–54329 disponíveis para o fluxo padrão;
- acesso ao repositório;
- para produção, acesso separado à Vercel, Supabase e ao ambiente `production`
  do GitHub.

A CLI do Supabase é uma dependência de desenvolvimento do npm; não precisa ser
instalada globalmente. Não use credenciais de produção no ambiente local.

## Instalação do zero

```bash
git clone https://github.com/carlos-ed-ferreira/tick-pwa.git
cd tick-pwa
cp .env.example .env.local
make install-ci
make supabase-start
make supabase-status
```

Copie a chave local exibida por `supabase:status` para
`NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`. As chaves exibidas pelo
ambiente local não devem ser usadas em produção nem incluídas em commits.

Prepare schema, migrations e seed:

```bash
make supabase-reset
make dev
```

A aplicação abre em `http://localhost:3000`. O Supabase Studio fica em
`http://127.0.0.1:54323` e a caixa de e-mail local em
`http://127.0.0.1:54324`.

O seed local cria `dev@email.com` com a senha `12341234` e libera esse e-mail
na allowlist. Essas credenciais são exclusivamente locais.

O atalho `make dev` executa instalação, inicia o Supabase e sobe o Next.js. Ele
não substitui a configuração inicial da anon key em `.env.local`.

## Variáveis de ambiente

Desenvolvimento autenticado local:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave pública local>
NEXT_PUBLIC_TICK_DISABLE_SUPABASE=
NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES=
NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS=
```

Defina `NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1` para forçar execução local sem
Supabase. Em `localhost`, a aplicação só aceita `local` com uma URL local. Fora
de localhost, só aceita o ambiente explícito `production`.

As variáveis `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` e
`NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS` também permanecem vazias por padrão.
Elas controlam a outbox funcional e a RPC transacional; somente UUIDs
listados usam esse caminho. A configuração está no runbook de operação.

Produção requer:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

O deploy de migrations usa secrets do ambiente GitHub `production`:

```bash
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_AUTOMATION_BYPASS_SECRET=
```

Esses valores são configurados fora do repositório. Nunca os adicione a um
arquivo versionado.

A instalação reproduzível por `make install-ci` mantém o lockfile e os scripts
normais do npm. Em falhas transitórias identificadas no download da CLI
Supabase pelo GitHub Releases, repete a instalação até três vezes no total,
com esperas de 5 e 10 segundos. Outros erros interrompem imediatamente. Essa
recuperação vale para os jobs de CI, publicação e backup que usam o target;
não repete migrations, deploys ou o workflow inteiro.

## Banco, migrations e conexões

`supabase/schemas/tick.sql` define tabelas, constraints, índices, triggers, RLS
e policies do schema `public`. As tabelas funcionais usam `user_id`, foreign
keys compostas e policies que exigem `auth.uid()` e acesso ativo.

O fluxo local é:

1. alterar o schema declarativo;
2. iniciar o Supabase local;
3. gerar uma migration com
   `make supabase-migration-diff name=<nome_da_migration>`;
4. revisar o SQL gerado;
5. recriar o banco com `make supabase-reset`;
6. rodar lint, pgTAP e os testes da aplicação;
7. atualizar os tipos com `make supabase-types-local` quando necessário.

O reset aplica migrations e depois `supabase/seed.sql`. O pooler local está
desabilitado. A aplicação usa HTTP/REST pelo cliente Supabase e não mantém uma
conexão PostgreSQL direta.

Comandos de produção são bloqueados pelo wrapper fora do GitHub Actions. O
workflow de produção faz repair do histórico conhecido, dry-run, push e só
então publica o SHA aprovado pela API da Vercel. Ele depende do quality gate aprovado do
mesmo SHA e falha se a `main` avançar antes do disparo. A confirmação do deployment segue o
[runbook de deploy](docs/operations/PUBLICACAO.md).

## APIs e serviços externos

- Supabase Auth: senha e OAuth Google;
- Supabase REST/Postgres: leitura e escrita das contas;
- Vercel: hospedagem documentada do frontend;
- GitHub Actions: CI, migrations e backup lógico cifrado de produção;
- Sentry Free: destino opcional de eventos agregados de sincronização;
- Google Fonts: carregadas pelo Next.js e cobertas pelo cache da PWA.

Não existem webhooks, pagamentos, e-mail de produção ou API de domínio próprios
no estado atual. Configuração do Sentry, provedor Google, URLs de
redirect, projeto Supabase, domínio e integração Vercel são externas ao Git.

## Comandos de desenvolvimento

O `Makefile` é a interface única para operações do projeto. Não execute
`npm`, `npx`, CLIs de serviço ou scripts diretamente. Se surgir uma rotina
recorrente sem target, adicione-a ao `Makefile` e ao `make help` primeiro.

Desenvolvimento e gates:

| Objetivo                | Comando                                     |
| ----------------------- | ------------------------------------------- |
| instalar                | `make install` ou `make install-ci`         |
| desenvolver             | `make dev`                                  |
| build/start             | `make build`, `make start`                  |
| typecheck               | `make typecheck`                            |
| lint                    | `make lint`                                 |
| testes                  | `make test`                                 |
| testes direcionados     | `make test-file files="<arquivos>"`         |
| formatar/verificar      | `make format`, `make format-check`          |
| gate atual              | `make check`                                |
| limpar gerados          | `make clean`                                |
| estrutura e arquitetura | `make quality-check`                        |
| cobertura e ratchet     | `make test-coverage`, `make coverage-check` |
| mutação e ratchet       | `make test-mutation`                        |
| secrets e SAST          | `make check-secrets`, `make check-sast`     |

Testes direcionados:

| Objetivo                           | Comando                         |
| ---------------------------------- | ------------------------------- |
| telemetria                         | `make test-telemetry`           |
| contrato transacional              | `make test-account-operations`  |
| outbox autenticada                 | `make test-account-persistence` |
| corridas de refresh e preferências | `make test-sync-safety`         |
| validadores dos gates              | `make test-quality`             |
| guest e convidados                 | `make test-access-policy`       |
| metas e etapas                     | `make test-goals`               |
| cifra do backup                    | `make test-backup`              |
| restore em Docker                  | `make test-backup-restore`      |
| ordem do pipeline e Vercel         | `make test-release-workflow`    |
| estatísticas de benchmark          | `make test-capacity`            |

E2E:

| Objetivo                   | Comando                           |
| -------------------------- | --------------------------------- |
| padrão, com build novo     | `make test-e2e`                   |
| iteração rápida, sem prova | `make test-e2e-reuse`             |
| layout mobile              | `make test-e2e-mobile`            |
| reload offline             | `make test-e2e-offline`           |
| autenticado                | `make test-e2e-account`           |
| instalar Chromium          | `make test-e2e-browsers`          |
| acessibilidade WCAG        | `make test-e2e-a11y`              |
| conta com API real isolada | `make test-account-browser`       |
| imagem Playwright          | `make e2e-container-prepare`      |
| padrão em container        | `make test-e2e-container`         |
| autenticado em container   | `make test-e2e-account-container` |

Os targets em container usam a imagem oficial do Playwright 1.62.1 com GNU
Make, o UID/GID local e nenhuma porta publicada. Use-os em Linux sem as
bibliotecas do Chromium no host. `make test-account-browser` cria checkout e
Supabase temporários nas portas 56320–56329 e app em 3102, usa rede host no
container e uma conta sintética do seed; não lê `.env` nem reseta o banco de
trabalho. Os artefatos ficam em `.next/playwright-account-real-results`.
Não execute builds ou E2E simultâneos no mesmo
checkout; a versão da imagem e a dependência Playwright devem permanecer iguais.

Dependências:

| Objetivo                     | Comando                                    |
| ---------------------------- | ------------------------------------------ |
| dependências diretas         | `make deps-tree`                           |
| auditar produção             | `make audit-prod`                          |
| auditar tudo                 | `make audit-all`                           |
| consultar pacote             | `make dependency-info package=<pacote>`    |
| adicionar de produção        | `make add-dependency package=<pacote>`     |
| adicionar de desenvolvimento | `make add-dev-dependency package=<pacote>` |
| atualizar no intervalo       | `make update-dependency package=<pacote>`  |

Diagnóstico de desempenho, opcional e somente local:

| Objetivo                    | Comando                      |
| --------------------------- | ---------------------------- |
| lotes da RPC                | `make benchmark-account-rpc` |
| conta sintética isolada     | `make benchmark-cohort`      |
| executar no ambiente pronto | `make benchmark-cohort-run`  |
| comparar com baseline       | `make benchmark-compare`     |
| tamanho do JS do build      | `make bundle-report`         |
| limpeza dos ensaios         | `make cohort-status`         |

O procedimento e os limites estão no
[guia de capacidade](docs/operations/DIAGNOSTICO-DE-DESEMPENHO.md); os resultados não
representam capacidade aprovada de produção.

Backup, publicação e operação:

| Objetivo                            | Comando                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| publicar em `main`                  | `make publish`                                                            |
| execuções recentes                  | `make actions-status`                                                     |
| evento, data e jobs de uma execução | `make actions-run run=<run-id>`                                           |
| log de um job pela API              | `make actions-job-log job=<job-id>`                                       |
| artefato do Actions                 | `make actions-artifact-download run=<run-id> name=<artefato> dir=<pasta>` |
| issues operacionais abertas         | `make operations-issues`                                                  |
| configuração da API Vercel          | `make production-release-status`                                          |
| execuções do backup                 | `make backup-status`                                                      |
| log de backup falho                 | `make backup-log run=<run-id>`                                            |
| artefatos de backup                 | `make backup-artifacts run=<run-id>`                                      |
| datas da chave de backup            | `make backup-key-status`                                                  |
| pg_dump da imagem GHCR              | `make backup-image-check`                                                 |
| comando de dump, sem rodar          | `make backup-command-check`                                               |
| cifrar backup lógico                | `make backup-encrypt input=<dir> output=<file>`                           |
| baixar imagens do restore           | `make backup-restore-prepare`                                             |
| restaurar backup                    | `make backup-restore archive=<file>`                                      |

Supabase:

| Objetivo                                   | Comando                                        |
| ------------------------------------------ | ---------------------------------------------- |
| iniciar/parar                              | `make supabase-start`, `make supabase-stop`    |
| só o banco                                 | `make supabase-start-db`                       |
| banco e Auth                               | `make supabase-start-account`                  |
| status                                     | `make supabase-status`                         |
| reset                                      | `make supabase-reset`                          |
| diff                                       | `make supabase-diff`                           |
| conferir diff                              | `make supabase-diff-check`                     |
| gerar migration                            | `make supabase-migration-diff name=<nome>`     |
| validar sem resetar o ambiente de trabalho | `make validate-database`                       |
| gerar diff em banco temporário             | `make generate-database-migration name=<nome>` |
| gerar tipos em banco temporário            | `make generate-database-types`                 |
| aplicar migrations pendentes sem reset     | `make supabase-migrate-local`                  |
| instalar o Chromium do Playwright          | `make test-e2e-browser-install`                |
| lint                                       | `make supabase-lint`                           |
| pgTAP                                      | `make supabase-test-db`                        |
| tipos                                      | `make supabase-types-local`                    |
| histórico prod.                            | `make supabase-prod-migrations-check`          |

Os targets `supabase-prod-*` só executam no GitHub Actions; o wrapper os
bloqueia fora dele.

`make check` executa typecheck, lint, Vitest, format-check e build. E2E e
validações de banco são separados. Os critérios de aprovação e gates
atuais estão definidos no [REVIEW.md](REVIEW.md).

## Deploy atual

O frontend é hospedado na Vercel, com Supabase gerenciado para autenticação e
banco. O domínio canônico é [tickapp.com.br](https://tickapp.com.br), que redireciona
para `www.tickapp.com.br`.
GitHub Free, Vercel Hobby e Supabase Free são os planos adotados. Previews da
Vercel não recebem configuração do Supabase de produção.

O ruleset da `main` exige `Check app`, `Check database`, `Check end-to-end` e
`Check security`.
O App CI roda em pull requests e pushes da `main`, com auditoria de produção,
`make check`, cobertura, mutação, estrutura/arquitetura, SAST/secrets, banco
limpo/lint/diff/pgTAP e E2E local e autenticado. Axe verifica calendário e metas
em desktop e mobile dentro da suíte local. O E2E de
conta cobre API simulada com latência e Chromium com API real temporária,
fechamento completo e conflito entre duas sessões. Falhas de push na `main` abrem ou comentam
issue `ci-failure` atribuída ao proprietário.

O `vercel.json` desabilita auto-deploy Git somente da `main`. O workflow
`supabase-migrations.yml` exige App CI completo aprovado para o SHA da ponta
atual da `main`. Ele aceita somente `workflow_dispatch` com `expected_sha` e
`request_id`; merge e conclusão do CI não disparam publicação. O preflight
confere credenciais e vínculo do projeto Vercel antes de tocar o banco.
Toda publicação consulta e aplica migrations pendentes, independentemente dos
arquivos alterados no último commit, e confirma o histórico remoto antes do deploy.

O deploy usa a API Vercel com o SHA explícito, sem Deploy Hook. O job confere
SHA, projeto e ambiente Production, espera `READY` e verifica HTML e marcador
`tick-release` em `/`, `/calendar`, `/goals` e `/recurring`. Retomadas procuram deployment do
mesmo SHA; resposta perdida não gera repetição cega do POST. O timeout exige
inspeção na Vercel antes de nova tentativa. O smoke ocorre após a promoção e
não substitui validação funcional do domínio canônico. Configuração e retomada
estão no [runbook](docs/operations/PUBLICACAO.md).

Execuções de produção são serializadas. Falhas abrem ou comentam issue
`pipeline-failure`. Não há auditoria horária de migrations; o histórico remoto
é conferido em toda publicação. Avisos no GitHub dependem de sua disponibilidade.

`make publish` exige branch `dev` e worktree limpo, sincroniza a branch, cria
ou reutiliza PR, silencia notificações desse PR e aguarda os checks obrigatórios
antes de armar squash automático. Depois confirma o merge e reconcilia `dev`.
O comando captura o SHA do merge, espera o App CI de push desse SHA e solicita
explicitamente o workflow de produção com um identificador único. Ele acompanha
somente o run dessa solicitação e confirma publicação depois de `READY` e smoke
aprovados. Se a `main` avançar, o SHA anterior é recusado.

Interromper antes de armar auto-merge deixa o PR aberto; depois de armado, o
merge pode acontecer sem o processo local continuar executando. Antes do
disparo explícito, nenhuma publicação é iniciada. Depois do disparo, fechar o
terminal não cancela o run remoto. Resposta perdida não provoca novo disparo
automático; inspecione o Actions antes de retomar pelo procedimento manual do
[runbook](docs/operations/PUBLICACAO.md).

Commits, PRs, merges e publicação são controlados pelo desenvolvedor. Agentes
não os executam sem pedido explícito da operação no turno atual. Mudanças de
banco precisam ser compatíveis com a aplicação anterior e com clientes abertos:
Supabase e Vercel não compartilham uma transação de publicação. Rollback de
aplicação não desfaz migrations.

O workflow `Production backup` está habilitado, com agendamento diário às
03:17 UTC, dump pelo GHCR, cifra AES-256-GCM e retenção de 14 dias no GitHub.
Falhas abrem ou comentam issue `backup-failure`. Backup e restore são descritos
no [runbook operacional](docs/operations/MONITORAMENTO-E-RECUPERACAO.md).

### Credenciais e variáveis de produção

`VERCEL_TOKEN`, `VERCEL_PROJECT_ID` e `VERCEL_AUTOMATION_BYPASS_SECRET` estão
criados e cadastrados como secrets no environment GitHub `production`. O token
autoriza o GitHub Actions a consultar e criar deployments, o ID identifica o
projeto Tick na Vercel e o bypass permite ao smoke acessar o deployment
protegido. A Vercel usa conta pessoal Hobby, sem time, então `VERCEL_TEAM_ID`
não é cadastrado.
Os tokens de integração criados manualmente pelo proprietário, incluindo
`VERCEL_TOKEN` e `SUPABASE_ACCESS_TOKEN`, estão configurados sem expiração
automática, conforme informado pelo proprietário. O cadastro foi confirmado
por metadados, sem ler valores; validade e permissões são conferidas pelo
preflight da publicação.

O [inventário de credenciais e configuração](docs/operations/AMBIENTE-DE-PRODUCAO.md#inventário-de-credenciais-do-github)
descreve a origem, a finalidade, o consumidor e o efeito de remover cada um dos
oito secrets cadastrados no GitHub e das sete variáveis de Production na Vercel.
Distingue tokens privados, senha do banco, chave do backup, identificadores,
chaves públicas de cliente e flags de funcionamento.

O Deploy Hook da Vercel foi removido e revogado; a publicação usa somente a
API. A chave de backup deve ser preservada enquanto existirem arquivos cifrados
que dependam dela.

```sh
make production-release-status
make production-secrets-status
make main-ruleset-status
```

O primeiro comando consulta nomes e datas dos secrets da API Vercel, o segundo
lista todos os secrets de `production` e o terceiro, os checks obrigatórios da
`main`, sempre sem valores.
Os valores ficam nos provedores e no cofre do proprietário.

## Escopo de uso

O uso atual é uma pessoa em três dispositivos; o teto conservador de
planejamento é 20 convidados. A interface deve continuar utilizável e as
alterações locais preservadas enquanto a sincronização acontece. Cerca de 20
segundos é uma referência prática para investigar demora, não um timeout de
descarte. Não há budgets de latência ou capacidade obrigatórios; o proprietário
acompanha quotas manualmente e os benchmarks são diagnóstico opcional.

## Documentação

Os Markdown permanentes descrevem comportamento, regras e procedimentos atuais.
Identificadores técnicos usam inglês; o conteúdo textual pode usar português.
Documentos Markdown usam nomes em português e maiúsculas, com as exceções
convencionais definidas no AGENTS. Títulos e subtítulos internos usam
capitalização natural e preservam os termos técnicos.

- [AGENTS.md](AGENTS.md): regras operacionais de agentes.
- [REVIEW.md](REVIEW.md): gates e critérios de revisão vigentes.
- [.agents/skills](.agents/skills): workflows espelhados em `.claude/skills` e `.codex/skills`.
- [Contrato de acesso](docs/planning/MODOS-DE-ACESSO.md): guest e conta convidada.
- [Importação JSON](docs/guides/IMPORTACAO-DE-TAREFAS.md): uso e contrato de entrada.
- [Configuração externa](docs/operations/AMBIENTE-DE-PRODUCAO.md): contas, secrets e operação.
- [Publicação](docs/operations/PUBLICACAO.md): gates, deploy por SHA e recuperação.
- [Telemetria e backup](docs/operations/MONITORAMENTO-E-RECUPERACAO.md): alertas, recuperação e rollback.
- [Restore em outra máquina](docs/operations/TESTE-DE-RESTAURACAO.md): ensaio isolado.
- [Capacidade local](docs/operations/DIAGNOSTICO-DE-DESEMPENHO.md): ferramentas opcionais de diagnóstico.
- [Dependências](docs/operations/DEPENDENCIAS.md): configuração e manutenção atuais.
- [Arquivo temporário de trabalho](docs/planning/PENDENCIAS.md): único concentrador de pendências; removível após sua resolução.
