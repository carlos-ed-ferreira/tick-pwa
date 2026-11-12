# Arquitetura do Tick

[Desenvolvimento](DESENVOLVIMENTO.md) · [Sincronização](SINCRONIZACAO.md) · [Modos de acesso](MODOS-DE-ACESSO.md)

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

A composição muda por ponteiro e largura; as regras, primitives e exceções estão na [skill de frontend](../../.agents/skills/frontend-design/SKILL.md) e no seu [mapa de telas](../../.agents/skills/frontend-design/references/MAPA-DE-TELAS.md).

### Persistência e sincronização

O fluxo de leitura e escrita está em [Sincronização](SINCRONIZACAO.md).

### Tema

O aplicativo usa somente o tema escuro. A fonte da paleta é `src/app/globals.css`; as regras de uso estão nos [padrões visuais](../../.agents/skills/frontend-design/references/PADROES-VISUAIS.md).

### Tarefas recorrentes

Na visão Executar em composição de toque, o nome e a categoria compartilham o
cabeçalho da atividade. Nas atividades quantitativas, a barra e o botão de
registro ficam em uma linha abaixo, com espaço próprio. Títulos longos podem
crescer em altura sem empurrar o progresso sobre a categoria.

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
