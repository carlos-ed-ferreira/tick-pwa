# Tick

Tick é uma PWA mobile-first de produtividade pessoal para organizar tarefas
diárias, checklists hierárquicos, categorias, grupos de metas, metas e etapas.
O produto funciona no navegador em dois modos: local sem conta e autenticado
com persistência remota.

## Capacidades atuais

- calendário mensal e tarefas por dia;
- tarefas e subtarefas hierárquicas;
- criação e limpeza em lote;
- importação JSON;
- categorias separadas por superfície;
- grupos de metas, metas e etapas hierárquicas;
- instalação como PWA e fallback de navegação offline;
- interface em português do Brasil e inglês;
- modo local e modo autenticado por allowlist.

## Arquitetura atual

O repositório contém uma única aplicação web Next.js. Não há BFF, API Route,
worker de aplicação, fila externa ou microsserviço. O navegador acessa o
Supabase por `@supabase/supabase-js`. Uma RPC PostgreSQL aditiva implementa o
primeiro contrato transacional e idempotente para lotes de calendário e metas,
mas ainda não está ligada aos comandos funcionais nem substitui o fluxo atual.

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

### Fluxo de leitura e escrita

No modo local, a UI lê do IndexedDB e os comandos confirmam as alterações em
transações Dexie. Nenhuma entidade do usuário é enviada ao Supabase.

No modo autenticado, o app baixa snapshots das tabelas da conta para um cache
Dexie. Os snapshots são paginados em blocos de 1.000 linhas, ordenados por
revisão e identificador, e só reconciliam exclusões depois que todas as páginas
terminam com sucesso. As alterações são confirmadas primeiro no cache local e
depois enfileiradas em memória, por escopo, para `upsert` direto no Supabase. Em
falha, o app marca a versão local como falha ou tenta restaurar o valor remoto.
O cabeçalho da conta mostra os estados salvo, aguardando envio, sincronizando e
falha; entidades falhas podem ser reenviadas manualmente com o mesmo ID local.
Essa fila e a ação de retry não oferecem replay automático nem sobrevivem como
operação durável ao fechamento ou recarregamento da página.

Refreshes de uma mesma conta são deduplicados. Foco e reconexão usam debounce
de 500 ms e só atualizam dados com pelo menos 60 segundos; refresh manual ignora
essa validade. A duração, páginas, linhas e motivo ficam disponíveis no
resultado estruturado do refresh, ainda sem envio para observabilidade externa.

O estado atual ainda tem limitações conhecidas de retry durável, idempotência,
conflitos e observabilidade externa. Elas estão registradas no
[IMPLEMENTATION.md](IMPLEMENTATION.md); não devem ser confundidas com garantias
já implementadas.

O backend contém `apply_account_operation_batch` e recibos por conta e
`operation_id`. O contrato aceita até 100 mutações de categoria, dia, tarefa,
grupo de metas, meta e etapa, deriva ownership do JWT, aplica compare-and-set
por revisão e confirma o lote inteiro em uma transação. Ele permanece aditivo e
sem consumidor funcional até o rollout da nova persistência, evitando
dual-write com o caminho atual.

Existe uma fundação desativada para a prova de conceito do PowerSync. Ela cria
um SQLite `v2` isolado por conta e usa tabelas PostgreSQL `powersync_poc_*`
exclusivas, com schema, autenticação, upload e Sync Streams próprios. O adapter
web opera em modo single-tab sem Web Worker para ampliar a compatibilidade em
navegadores mobile, com timeout recuperável de inicialização. A rota interna
`/~powersync-poc` exercita criação, edição, conclusão, reordenação, exclusão e
visibilidade da fila sem ler ou escrever as tabelas funcionais. Ela permanece
bloqueada sem flag e UUID autorizado e não substitui a persistência funcional
Dexie. O preparo externo e os limites estão em
[docs/powersync-poc.md](docs/powersync-poc.md).

### PWA e offline

Serwist gera `public/sw.js` durante o build. Assets usam estratégias de cache e
navegações usam `NetworkFirst` com fallback em `/~offline`. O modo local
continua funcional sem Supabase. A sessão e o refresh do modo autenticado ainda
possuem limitações em abertura offline.

## Stack verificada

| Área               | Tecnologia                                                    |
| ------------------ | ------------------------------------------------------------- |
| Linguagem          | TypeScript 5, configuração `strict`                           |
| Runtime            | Node.js `>=20.9.0`                                            |
| Package manager    | npm, lockfile v3                                              |
| Framework          | Next.js 16.3.0, App Router e React 19.2.4                     |
| UI                 | Tailwind CSS 4, Lucide e React Icons                          |
| PWA                | Serwist 9                                                     |
| Banco local        | IndexedDB com Dexie 4                                         |
| Banco remoto       | PostgreSQL 17 no ambiente local do Supabase                   |
| Query layer        | Dexie local e cliente REST do Supabase; não há ORM relacional |
| Autenticação       | Supabase Auth, senha e Google, com allowlist própria          |
| i18n               | dicionários tipados `pt-BR` e `en`                            |
| Unit/integration   | Vitest 4, Testing Library, jsdom e fake-indexeddb             |
| E2E                | Playwright 1.60, Chromium desktop e perfil Pixel 7            |
| Banco              | Supabase CLI e pgTAP                                          |
| Análise            | TypeScript, ESLint 9 e verificador próprio de comentários     |
| Formatação         | Prettier 3 e EditorConfig                                     |
| CI                 | GitHub Actions                                                |
| Deploy documentado | Vercel e Supabase gerenciado                                  |

Não há cache de servidor, broker de filas, storage de arquivos usado pela
aplicação ou pooler habilitado. O Supabase CLI gerencia seus próprios
containers; o projeto não possui Dockerfile nem Compose próprios.

## Terminologia

| Termo            | Significado no produto                                     |
| ---------------- | ---------------------------------------------------------- |
| Tarefa           | item de checklist associado a um dia em `/calendar`        |
| Subtarefa        | descendente hierárquico de uma tarefa                      |
| Categoria        | marcador visual pertencente a uma superfície específica    |
| Grupo de metas   | agrupador opcional de metas                                |
| Meta             | resultado acompanhado em `/goals`                          |
| Etapa            | item hierárquico dentro de uma meta                        |
| Subetapa         | descendente de uma etapa                                   |
| Modo local       | uso sem conta, no escopo `guest:<installationId>`          |
| Modo autenticado | uso no escopo `user:<supabaseUserId>`                      |
| Allowlist        | tabela `account_access` que libera o protótipo autenticado |

Os nomes técnicos principais continuam `ChecklistItem`, `Goal`, `GoalGroup` e
`GoalStep`. Menus de overflow são chamados de **opções extras**.

## Modos de uso atuais

### Local sem conta

- usa o escopo `guest:<installationId>`;
- salva entidades apenas no IndexedDB do dispositivo;
- não envia entidades ao Supabase;
- oferece atualmente as funcionalidades principais, não apenas um preview;
- não migra dados automaticamente para uma conta.

### Autenticado

- usa o escopo `user:<supabaseUserId>`;
- exige sessão Supabase e uma linha ativa em `account_access`;
- conserva por até 24 horas a última autorização positiva da mesma conta para
  permitir reload offline, sem converter falha de rede em acesso negado;
- mantém cache IndexedDB separado por usuário;
- persiste entidades no Postgres protegido por RLS;
- não importa dados do modo local.

Guest limitado, trial, assinatura, entitlement e migração explícita de dados
para conta são requisitos futuros, não comportamento existente. O backlog
canônico está no [IMPLEMENTATION.md](IMPLEMENTATION.md).

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
- Node.js `>=20.9.0` com npm;
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
NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC=
NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS=
NEXT_PUBLIC_POWERSYNC_URL=
```

Defina `NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1` para forçar execução local sem
Supabase. Em `localhost`, a aplicação só aceita `local` com uma URL local. Fora
de localhost, só aceita o ambiente explícito `production`.

As variáveis de ativação do PowerSync permanecem vazias no fluxo normal. A
prova só é carregada quando a URL usa HTTPS, o sync Supabase está permitido e
`NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC=1`. Além da flag, o ID da conta precisa
estar em `NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS`. Não habilite o rollout antes
de concluir a validação descrita em `docs/powersync-poc.md`.

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
workflow de migrations faz repair do histórico conhecido, dry-run e push. A
dependência obrigatória desse workflow em relação ao quality gate ainda é uma
lacuna registrada no `IMPLEMENTATION.md`.

## APIs e serviços externos

- Supabase Auth: senha e OAuth Google;
- Supabase REST/Postgres: leitura e escrita das contas;
- Vercel: hospedagem documentada do frontend;
- GitHub Actions: CI e migrations de produção;
- Google Fonts: carregadas pelo Next.js e cobertas pelo cache da PWA.

Não existem webhooks, pagamentos, e-mail de produção, observabilidade ou API de
domínio próprios no estado atual. Configuração do provedor Google, URLs de
redirect, projeto Supabase, domínio e integração Vercel são externas ao Git.

## Comandos de desenvolvimento

O `Makefile` é a interface única para operações do projeto. Não execute
`npm`, `npx`, CLIs de serviço ou scripts diretamente. Se surgir uma rotina
recorrente sem target, adicione-a ao `Makefile` e ao `make help` primeiro.

| Objetivo           | Comando                             |
| ------------------ | ----------------------------------- |
| instalar           | `make install` ou `make install-ci` |
| desenvolver        | `make dev`                          |
| build/start        | `make build`, `make start`          |
| typecheck          | `make typecheck`                    |
| lint               | `make lint`                         |
| testes             | `make test`                         |
| testes PowerSync   | `make test-powersync`               |
| E2E padrão         | `make test-e2e`                     |
| E2E autenticado    | `make test-e2e-account`             |
| publicar em `main` | `make publish`                      |
| auditar produção   | `make audit-prod`                   |
| dependências       | `make deps-tree`                    |
| formatar/verificar | `make format`, `make format-check`  |
| gate atual         | `make check`                        |
| limpar gerados     | `make clean`                        |

Supabase:

| Objetivo        | Comando                                     |
| --------------- | ------------------------------------------- |
| iniciar/parar   | `make supabase-start`, `make supabase-stop` |
| status          | `make supabase-status`                      |
| reset           | `make supabase-reset`                       |
| diff            | `make supabase-diff`                        |
| gerar migration | `make supabase-migration-diff name=<nome>`  |
| lint            | `make supabase-lint`                        |
| pgTAP           | `make supabase-test-db`                     |
| tipos           | `make supabase-types-local`                 |

`make check` executa typecheck, lint, Vitest, format-check e build. E2E e
validações de banco são separados. Os critérios de aprovação e gates
planejados ficam exclusivamente no [REVIEW.md](REVIEW.md).

## Deploy atual

O repositório documenta Vercel para o frontend e Supabase gerenciado para auth e
banco. A Vercel é uma integração externa; não há `vercel.json` nem como
comprovar pelo Git a configuração atual do projeto.

O ambiente externo foi configurado em 11 de agosto de 2026 para a alfa
controlada. O domínio canônico de produção é
[https://tickapp.com.br](https://tickapp.com.br). Estão configurados a proteção
da `main` e os checks obrigatórios no GitHub, o projeto e os ambientes da
Vercel, o domínio e a autenticação do Supabase e o procedimento de backup
manual. As contas dos provedores usam autenticação em dois fatores.

Os previews da Vercel permanecem sem acesso ao Supabase de produção. Em 17 de
agosto de 2026, os secrets que autorizam migrations foram cadastrados no
ambiente GitHub `production` e o workflow executou com sucesso o quality gate e
a aplicação da migration isolada do PowerSync.

`.github/workflows/app-ci.yml` executa `make audit-prod` e `make check` em
PRs e pushes para `main`. `.github/workflows/supabase-migrations.yml` só aceita
o SHA de um `App CI` aprovado na `main`; execução manual roda o mesmo quality
gate antes de acessar o environment `production`. O workflow registra o SHA,
detecta mudanças de banco, faz dry-run e então aplica migrations.

A publicação cotidiana parte da branch `dev`. Depois de criar o commit, execute
`make publish`. O comando exige worktree limpo, envia `dev`, cria ou reutiliza
o pull request para `main` e habilita squash automático. O comando aguarda o
check obrigatório `Check app`, confirma o merge e reconcilia `dev` com a nova
`main` para preparar a publicação seguinte. Não faça push direto para `main` nem
use force push para contornar essa proteção.

Commits e `make publish` são decisões manuais do desenvolvedor. Agentes devem
entregar alterações sem commit e não podem publicar, criar PR ou fazer merge sem
um pedido explícito para essa operação no turno atual.

Mudanças de banco usadas pelo frontend devem ser aditivas e publicadas em duas
etapas: migration compatível primeiro e aplicação depois. O fluxo desejado de
produção e as lacunas de segurança estão no `IMPLEMENTATION.md`.

O projeto continuará nos planos gratuitos nesta fase: não há decisão para
contratar Vercel Pro ou Supabase Pro agora. O racional de custos e a
arquitetura-alvo estão em
[docs/plano-arquitetura-producao.md](docs/plano-arquitetura-producao.md).

## Documentação

- [AGENTS.md](AGENTS.md): regras operacionais para agentes;
- [REVIEW.md](REVIEW.md): baselines, métricas e quality gates;
- [IMPLEMENTATION.md](IMPLEMENTATION.md): lacunas e mudanças futuras;
- [.agents/skills](.agents/skills): workflows reutilizáveis para agentes;
- [docs/importacao-json.md](docs/importacao-json.md): contrato da importação;
- [docs/plano-arquitetura-producao.md](docs/plano-arquitetura-producao.md):
  avaliação de arquitetura e custos.

`IMPLEMENTATION.md` é a fonte canônica do backlog técnico. Documentos de
decisão e features fornecem contexto, mas não substituem esse backlog.
