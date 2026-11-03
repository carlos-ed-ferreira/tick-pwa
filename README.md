# Tick

Tick é uma PWA mobile-first de produtividade pessoal para organizar tarefas
diárias, checklists hierárquicos, categorias, grupos de metas, metas e etapas.
O produto funciona no navegador em dois modos: local sem conta e autenticado
com persistência remota.

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
- **Shell**: cabeçalho de uma linha e navegação fixa no rodapé, com categorias
  e idioma em folha inferior.

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
pelo identificador, que é imutável, e só reconciliam exclusões depois que todas
as páginas terminam com sucesso. Refreshes simultâneos do mesmo escopo
compartilham uma única leitura remota, e o conjunto protegido de entidades
pendentes é calculado dentro da transação de merge. No rollout controlado, a alteração funcional e seu lote
remoto são gravados atomicamente no IndexedDB. A outbox preserva o mesmo
`operation_id` entre reloads, mantém a ordem, agrupa até 100 mutações e envia
uma RPC transacional; falhas continuam visíveis e podem ser reenviadas. Contas
fora da allowlist permanecem no caminho legado de `upsert` direto e fila em
memória. Não existe dual-write entre os dois caminhos.

Uma operação que falha é retentada automaticamente no máximo cinco vezes, com
espera exponencial de 1 s a 30 s entre as tentativas; reconexão e retry manual
ignoram essa espera. A fila durável é limitada a 200 operações por conta: ao
atingir o limite, a alteração continua salva localmente, deixa de gerar novas
operações remotas e aparece como falha recuperável, resolvida pela
sincronização forçada. Uma rejeição `stale_revision` é rebaseada uma vez pela
revisão atual do servidor e reenviada automaticamente; se ainda assim falhar, a
operação permanece visível e recuperável. A drenagem da outbox usa um lock por
conta para que abas do mesmo navegador não disputem o mesmo `operation_id`.
Quando o navegador informa que está offline, uma operação nova permanece
pendente sem iniciar RPC. Se a conexão cai durante uma chamada, a operação volta
de `syncing` para `pending` e conserva o mesmo identificador para a retomada na
reconexão. O mesmo vale quando a RPC devolve um erro de transporte antes de
`navigator.onLine` refletir a queda: a primeira operação permanece pendente, o
dreno para e uma tentativa limitada usa o backoff da outbox. Refreshes remotos
disparados por foco ou sessão também não começam enquanto o navegador está
offline; indisponibilidade esperada não é apresentada como falha definitiva de
sincronização.

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
`src/lib/db/account-sync-metrics.ts`, sem conteúdo do usuário. Elas ainda não
têm identidade nem conteúdo funcional. Um adapter independente envia os
agregados e resultados de refresh ao Sentry quando o DSN é configurado. Todas
as integrações automáticas ficam desligadas e uma allowlist remove identidade,
conteúdo funcional, tokens e payloads antes do fornecedor.

Limitações conhecidas: a sincronização ainda não foi validada manualmente em
Safari macOS/iOS, o evento do Sentry mantém `user.geo` e o backup diário ainda
precisa comprovar estabilidade após a troca para GHCR. Elas estão registradas no
[plano de implementação](docs/planning/implementation-plan.md) e não devem ser
confundidas com garantias já implementadas.

O backend contém `apply_account_operation_batch` e recibos por conta e
`operation_id`. O contrato aceita até 100 mutações de categoria, dia, tarefa,
grupo de metas, meta e etapa, deriva ownership do JWT, aplica compare-and-set
por revisão e confirma o lote inteiro em uma transação. Cada chamada também
descarta os recibos da própria conta com mais de sete dias. O consumidor
funcional é habilitado somente para contas internas explicitamente autorizadas.
A ativação, os ensaios e o rollback estão no passo 1 do
[plano de implementação](docs/planning/implementation-plan.md).

A arquitetura de sincronização autenticada foi consolidada na outbox própria.
O POC PowerSync e seus objetos isolados foram retirados; não existe runtime,
rota, flag ou dual-write alternativo no produto. A comparação, o custo e o
procedimento de remoção estão registrados no passo 3 do
[plano de implementação](docs/planning/implementation-plan.md).

### PWA e offline

Serwist gera `public/sw.js` durante o build. Assets usam estratégias de cache e
navegações usam `NetworkFirst` com fallback em `/~offline`. O shell de `/`,
`/calendar` e `/goals` é precacheado para permitir reload direto offline mesmo
quando a rota foi aberta originalmente por navegação client-side. Parâmetros
locais, como o dia ou a meta selecionada, reutilizam o mesmo shell precacheado e
são reconstruídos do IndexedDB. O modo local continua funcional sem Supabase. A
sessão e o refresh do modo autenticado ainda dependem do grant local válido
quando o Supabase está indisponível.

### Navegadores suportados

- Chrome desktop e Chrome Android nas versões estáveis atual e anterior são o
  alvo primário e têm cobertura automatizada;
- Safari macOS e Safari iOS nas versões estáveis atual e anterior são alvo
  oficial; a interface de toque foi validada em iPhone físico em 2026-10-18, e
  a sincronização no Safari exige validação manual antes de autorizar novos
  convidados;
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
| Etapa             | item hierárquico dentro de uma meta                     |
| Subetapa          | descendente de uma etapa                                |
| Nível de marcação | grau de conclusão da tarefa ou etapa, de 1 até o máximo |
| Estado ignorado   | marcação opcional que exclui a tarefa das contagens     |
| Modo local        | uso sem conta, no escopo `guest:<installationId>`       |
| Modo autenticado  | uso no escopo `user:<supabaseUserId>`                   |
| Allowlist         | tabela `account_access` que libera as contas convidadas |

Os nomes técnicos principais continuam `ChecklistItem`, `Goal`, `GoalGroup` e
`GoalStep`. Menus de overflow são chamados de **opções extras**.

## Modos de uso atuais

### Local sem conta

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
- não importa dados do modo local.

O acesso remoto permanece fechado a convidados autorizados. O modo guest é
completo e gratuito, sem limite de tempo ou quantidade imposto pelo produto,
com dados somente no IndexedDB deste navegador. Fechar/reabrir o app não apaga
progresso. Limites físicos e limpeza do armazenamento pelo navegador continuam
possíveis; não há cópia remota dos dados guest.
A política está em [guest-and-invited-access.md](docs/planning/guest-and-invited-access.md),
e o backlog no [plano de implementação](docs/planning/implementation-plan.md).

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
- `make`, opcional;
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
Elas controlam a outbox funcional e a RPC transacional. Consulte o rollout
controlado antes de preenchê-las.

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
VERCEL_DEPLOY_HOOK_URL=
```

Esses valores são configurados fora do repositório. Nunca os adicione a um
arquivo versionado.

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
então dispara o Deploy Hook da Vercel. Ele depende do quality gate aprovado do
mesmo SHA e falha se a `main` avançar antes do disparo. A configuração externa
está concluída e a ordem foi comprovada com migration real; as evidências estão
em [deploy-hook-setup.md](docs/operations/deploy-hook-setup.md).

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

| Objetivo           | Comando                             |
| ------------------ | ----------------------------------- |
| instalar           | `make install` ou `make install-ci` |
| desenvolver        | `make dev`                          |
| build/start        | `make build`, `make start`          |
| typecheck          | `make typecheck`                    |
| lint               | `make lint`                         |
| testes             | `make test`                         |
| formatar/verificar | `make format`, `make format-check`  |
| gate atual         | `make check`                        |
| limpar gerados     | `make clean`                        |

Testes direcionados:

| Objetivo                   | Comando                         |
| -------------------------- | ------------------------------- |
| telemetria                 | `make test-telemetry`           |
| contrato transacional      | `make test-account-operations`  |
| outbox autenticada         | `make test-account-persistence` |
| guest e convidados         | `make test-access-policy`       |
| metas e etapas             | `make test-goals`               |
| cifra do backup            | `make test-backup`              |
| restore em Docker          | `make test-backup-restore`      |
| ordem do pipeline e Vercel | `make test-release-workflow`    |
| estatísticas de benchmark  | `make test-capacity`            |

E2E:

| Objetivo                   | Comando                           |
| -------------------------- | --------------------------------- |
| padrão, com build novo     | `make test-e2e`                   |
| iteração rápida, sem prova | `make test-e2e-reuse`             |
| layout mobile              | `make test-e2e-mobile`            |
| reload offline             | `make test-e2e-offline`           |
| autenticado                | `make test-e2e-account`           |
| instalar Chromium          | `make test-e2e-browsers`          |
| imagem Playwright          | `make e2e-container-prepare`      |
| padrão em container        | `make test-e2e-container`         |
| autenticado em container   | `make test-e2e-account-container` |

Os targets em container usam a imagem oficial do Playwright 1.62.1 com GNU
Make, o UID/GID local e nenhuma porta publicada. Use-os em Linux sem as
bibliotecas do Chromium no host. Não execute builds ou E2E simultâneos no mesmo
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
[guia de capacidade](docs/operations/cohort-capacity.md); os resultados não
representam capacidade aprovada de produção.

Backup, publicação e operação:

| Objetivo                    | Comando                                         |
| --------------------------- | ----------------------------------------------- |
| publicar em `main`          | `make publish`                                  |
| execuções recentes          | `make actions-status`                           |
| jobs de uma execução        | `make actions-run run=<run-id>`                 |
| issues operacionais abertas | `make operations-issues`                        |
| metadados do Deploy Hook    | `make deploy-hook-status`                       |
| execuções do backup         | `make backup-status`                            |
| log de backup falho         | `make backup-log run=<run-id>`                  |
| artefatos de backup         | `make backup-artifacts run=<run-id>`            |
| datas da chave de backup    | `make backup-key-status`                        |
| pg_dump da imagem GHCR      | `make backup-image-check`                       |
| comando de dump, sem rodar  | `make backup-command-check`                     |
| cifrar backup lógico        | `make backup-encrypt input=<dir> output=<file>` |
| baixar imagens do restore   | `make backup-restore-prepare`                   |
| restaurar backup            | `make backup-restore archive=<file>`            |

Supabase:

| Objetivo        | Comando                                     |
| --------------- | ------------------------------------------- |
| iniciar/parar   | `make supabase-start`, `make supabase-stop` |
| só o banco      | `make supabase-start-db`                    |
| banco e Auth    | `make supabase-start-account`               |
| status          | `make supabase-status`                      |
| reset           | `make supabase-reset`                       |
| diff            | `make supabase-diff`                        |
| conferir diff   | `make supabase-diff-check`                  |
| gerar migration | `make supabase-migration-diff name=<nome>`  |
| lint            | `make supabase-lint`                        |
| pgTAP           | `make supabase-test-db`                     |
| tipos           | `make supabase-types-local`                 |
| histórico prod. | `make supabase-prod-migrations-check`       |

Os targets `supabase-prod-*` só executam no GitHub Actions; o wrapper os
bloqueia fora dele.

`make check` executa typecheck, lint, Vitest, format-check e build. E2E e
validações de banco são separados. Os critérios de aprovação e gates
planejados ficam exclusivamente no [REVIEW.md](REVIEW.md).

## Deploy atual

O repositório documenta Vercel para o frontend e Supabase gerenciado para auth e
banco. O `vercel.json` desabilita o auto-deploy Git da `main`, mantendo os
previews das outras branches habilitados. A produção é publicada somente pelo
Deploy Hook, disparado pelo workflow de migrations depois do quality gate e das
migrations do mesmo SHA. A ordem foi comprovada em 2026-11-03 com a migration
`20261103001239_avoid_rpc_conflict_retries.sql` no SHA `b3ddc8f`, com um único
deployment de Production disparado pelo hook. Evidências em
[deploy-hook-setup.md](docs/operations/deploy-hook-setup.md).

O ambiente externo foi configurado em 11 de agosto de 2026 para a alfa
controlada. O domínio canônico de produção é
[https://tickapp.com.br](https://tickapp.com.br). Estão configurados a proteção
da `main` e os checks obrigatórios no GitHub, o projeto e os ambientes da
Vercel, o domínio e a autenticação do Supabase e o procedimento de backup
manual. As contas dos provedores usam autenticação em dois fatores.

Os previews da Vercel permanecem sem acesso ao Supabase de produção. Em 17 de
agosto de 2026, os secrets que autorizam migrations foram cadastrados no
ambiente GitHub `production` e o workflow executou com sucesso o quality gate e
as migrations de produção.

`.github/workflows/app-ci.yml` executa `make audit-prod` e `make check` em
PRs e pushes para `main`, além de dois jobs paralelos: `Check database` sobe apenas o
Postgres local com `make supabase-start-db`, recria o banco pelas migrations,
roda lint, `make supabase-diff-check` e pgTAP; `Check end-to-end` roda os E2E locais e
autenticados e guarda os artefatos do Playwright em caso de falha. Desde 25 de
agosto de 2026, o ruleset `main-protection` exige os três checks, de modo que um
SHA reprovado em banco ou E2E não alcança a `main`. Quando um push na `main`
falha, o job `Report failed run` abre a issue `App CI falhou na main` com o
rótulo `ci-failure`, atribuída ao dono do repositório, e comenta o link do run
nas falhas seguintes enquanto a issue continuar aberta; execuções bem-sucedidas
e pull requests não geram aviso. O workflow de produção usa a mesma action
composta com o rótulo `pipeline-failure` para migrations, deploy e auditoria.
Uma execução horária compara o histórico remoto de migrations com o
repositório e detecta eventos de publicação perdidos assim que o GitHub Actions
volta a operar. `.github/workflows/supabase-migrations.yml` só aceita o SHA de
um `App CI` aprovado na `main`; execução manual roda o mesmo quality gate antes
de acessar o environment `production`. O workflow registra o SHA, detecta
mudanças de banco, aplica migrations e depois dispara o Deploy Hook da Vercel.

O workflow `Production backup`, habilitado desde 2026-09-22, gera diariamente
às 03:17 UTC um dump lógico, cifra-o antes do upload e mantém somente o artefato
cifrado por 14 dias. As imagens da CLI do Supabase vêm do GHCR
(`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`) desde a publicação de `ce9e7d1`,
para evitar o limite do ECR público que fez falhar 9 de 13 execuções entre 19 e
31 de outubro. Falhas abrem ou comentam a issue `backup-failure`. O restore do
artefato real foi aprovado em outra máquina em 2026-11-02. A estabilidade com
GHCR ainda não foi observada; a verificação pendente está no
[plano de implementação](docs/planning/implementation-plan.md#pendências-abertas).
Configuração, alertas, restore isolado e medição de RPO/RTO estão no
[runbook operacional](docs/operations/observability-backup-restore.md).

A publicação cotidiana parte da branch `dev`. Depois de criar o commit, execute
`make publish`. O comando exige worktree limpo, envia `dev`, cria ou reutiliza
o pull request para `main` e silencia as notificações desse pull request para o
autor. O comando aguarda os checks obrigatórios, só então habilita squash
automático, continua aguardando enquanto o pull request estiver aberto,
confirma o merge e reconcilia `dev` com a nova `main` para preparar a publicação
seguinte. Um estado terminal diferente de merge encerra o comando com erro. Não
faça push direto para `main` nem
use force push para contornar essa proteção.

Commits e `make publish` são decisões manuais do desenvolvedor. Agentes devem
entregar alterações sem commit e não podem publicar, criar PR ou fazer merge sem
um pedido explícito para essa operação no turno atual.

Mudanças de banco usadas pelo frontend devem ser aditivas e publicadas em duas
etapas: migration compatível primeiro e aplicação depois. Procedimentos de
rollback estão no
[runbook operacional](docs/operations/observability-backup-restore.md).

O projeto mantém GitHub Free, Vercel Hobby e Supabase Free no ambiente atual.

## Escopo de uso

O uso atual é uma pessoa em três dispositivos; o teto conservador de
planejamento é 20 convidados. A interface deve continuar utilizável e as
alterações locais preservadas enquanto a sincronização acontece. Cerca de 20
segundos é uma referência prática para investigar demora, não um timeout de
descarte. Não há budgets de latência ou capacidade obrigatórios; o proprietário
acompanha quotas manualmente e os benchmarks são diagnóstico opcional.

## Documentação

Diretórios, arquivos, módulos, símbolos e demais identificadores técnicos usam
nomes em inglês em todo o repositório. Apenas o conteúdo textual de documentos
pode permanecer em português.

- [AGENTS.md](AGENTS.md): regras operacionais para agentes;
- [REVIEW.md](REVIEW.md): baselines, métricas, quality gates e histórico de
  evidências;
- [.agents/skills](.agents/skills): workflows reutilizáveis para agentes,
  espelhados em `.claude/skills` e `.codex/skills`.

Planejamento:

- [docs/planning/implementation-plan.md](docs/planning/implementation-plan.md):
  plano único de evolução, pendências abertas, rollouts e responsabilidades
  externas;
- [docs/planning/guest-and-invited-access.md](docs/planning/guest-and-invited-access.md):
  contrato do modo guest completo e das contas por convite.

Guias e operação:

- [docs/guides/calendar-task-json-import.md](docs/guides/calendar-task-json-import.md):
  guia funcional e contrato da importação JSON do calendário;
- [docs/operations/external-production-runbook.md](docs/operations/external-production-runbook.md):
  configurações externas de produção e o que exige outra máquina ou aparelho;
- [docs/operations/observability-backup-restore.md](docs/operations/observability-backup-restore.md):
  telemetria, backup, restore, rollback e comunicação de incidente;
- [docs/operations/two-machine-backup-restore.md](docs/operations/two-machine-backup-restore.md):
  roteiro do restore do backup de produção em uma segunda máquina;
- [docs/operations/deploy-hook-setup.md](docs/operations/deploy-hook-setup.md):
  Deploy Hook, deploy ordenado e suas evidências;
- [docs/operations/cohort-capacity.md](docs/operations/cohort-capacity.md):
  benchmarks locais opcionais e baselines em `docs/operations/baselines`;
- [docs/operations/dependency-maintenance-2026-11-02.md](docs/operations/dependency-maintenance-2026-11-02.md):
  atualização de dependências de 2026-11-02, licenças, overrides e rollback.

Incidentes:

- [2026-08-31-supabase-wal-read-only.md](docs/operations/incidents/2026-08-31-supabase-wal-read-only.md):
  saturação de WAL e modo somente leitura do Supabase;
- [2026-08-31-account-batch-stale-revision.md](docs/operations/incidents/2026-08-31-account-batch-stale-revision.md):
  rejeição `stale_revision` terminal na outbox;
- [2026-11-02-rpc-conflict-retries.md](docs/operations/incidents/2026-11-02-rpc-conflict-retries.md):
  retry indefinido do PostgREST em conflito da RPC.

`docs/planning/implementation-plan.md` é a fonte canônica do backlog técnico.
Os demais documentos em `docs/` cobrem contratos, procedimentos e registros
específicos que não pertencem ao plano geral.
