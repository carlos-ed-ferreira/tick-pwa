# AGENTS.md

## Propósito

Este guia orienta agentes de código ao alterar o Tick. Ele vale para todo o
repositório, salvo quando houver um `AGENTS.md` mais específico.

Tick é um app web único, uma PWA de produtividade pessoal mobile-first para
tarefas diárias, checklists e metas. Preserve simplicidade, velocidade,
responsividade e uso frequente em dispositivos móveis.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Dexie + IndexedDB
- Supabase Auth + Postgres
- Serwist PWA
- Vercel

## Arquitetura

Estrutura principal:

```text
src/app           rotas Next.js e PWA
src/components    componentes compartilhados
src/features      áreas funcionais
src/hooks         hooks reutilizáveis
src/lib/db        Dexie, schema local e comandos locais/cache
src/lib/domain    tipos e regras de domínio
src/lib/i18n      idioma e dicionários
src/lib/supabase  client, auth, persistência de conta e cache
src/lib/time      helpers de data e timezone
src/providers     providers globais
tests             testes unitários, integração e E2E
supabase          configuração, seed e migrations SQL
```

Mantenha regras de domínio perto da feature ou da camada responsável. UI não
deve escrever diretamente em tabelas Dexie; use comandos em `src/lib/db` ou a
camada de persistência apropriada.

## Modos de uso

Existem dois modos separados.

Modo local sem conta:

- escopo `guest:<installationId>`;
- entidades ficam apenas no IndexedDB do dispositivo;
- dados locais não são enviados ao Supabase;
- dados locais não são migrados automaticamente para conta.

Modo autenticado com conta:

- escopo `user:<supabaseUserId>`;
- autenticação via Supabase;
- dados da conta são persistidos no Supabase;
- alterações são confirmadas primeiro no cache IndexedDB da conta;
- gravações Supabase são executadas em ordem depois do commit local;
- falhas remotas devem restaurar o valor canônico e mostrar feedback;
- dados locais de convidado não entram na conta.

Não implemente sync ou migração automática do modo local para o modo
autenticado. Se uma mudança parecer exigir isso, pare e valide a decisão de
produto antes de codar.

## Banco, ambientes e segurança

IndexedDB/Dexie é a base do modo local. Entidades principais não devem ir para
`localStorage`; use `localStorage` apenas para preferências pequenas, como
idioma ou flags de UI.

Em desenvolvimento, Supabase autenticado usa Supabase local via Docker. O
ambiente local deve usar:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

Em `localhost`, o app só habilita Supabase quando a URL é local. Nunca use URL
ou anon key de produção em `.env.local`.

Produção roda na Vercel e usa:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=production
```

Fora de `localhost`, Supabase só deve ser habilitado quando o ambiente
`production` estiver explícito. Migrations remotas são restritas ao GitHub
Actions.

O estado declarativo do Postgres fica em `supabase/schemas/tick.sql`.
Migrations futuras devem ser geradas por diff a partir desse arquivo e
revisadas antes de serem aplicadas. Testes estruturais do banco ficam em
`supabase/tests` e rodam com `make supabase-test-db`.

O banco local é gerenciado pelo Supabase CLI/Docker. O banco production é o
Supabase production configurado na Vercel e no GitHub Actions.

## UX e responsividade

Tick é uma PWA mobile-first. Toda interface deve ser amigável para celulares,
tablets, notebooks pequenos e desktops grandes.

Ao alterar UI, trate consistência visual e UX como critério de aceite: preserve
hierarquia clara, espaçamentos confortáveis, controles próximos do contexto em
que atuam, alturas coerentes entre elementos relacionados e padrões visuais já
usados pelo sistema.

Prefira auto-save, edição inline, feedback contextual e estados mínimos de
loading. Não bloqueie fluxos do modo local por rede. Para conta autenticada,
falhas de Supabase devem ter feedback claro sem misturar dados locais e dados da
conta.

Use superfícies compartilhadas (`card-surface`, `card-surface-soft`,
`card-surface-strong`) quando fizer sentido. Evite abstrações visuais sem ganho
real e evite cards aninhados desnecessários.

## Formulários e feedback

Formulários React controlados pela aplicação devem usar `noValidate`.
Validação visível deve ser local e estilizada pelo app.

Não use `window.alert`, `window.confirm` ou `window.prompt`. Use mensagens
inline, toast, banner, modal ou sheet.

Inputs curtos/estruturados devem desabilitar assistência automática quando
adequado:

```tsx
spellCheck={false}
autoCorrect="off"
autoCapitalize="none"
```

Prefira o primitivo `Input` quando ele já centraliza esses padrões.

## Datas e localização

O app suporta `pt-BR` e `en`. Datas diárias devem usar helpers timezone-aware em
`src/lib/time`; não recorte strings UTC manualmente para representar dias de
calendário.

## TDD e testes

Regra obrigatória: antes de codar qualquer feature ou refatoração
comportamental, crie ou ajuste testes primeiro.

Use:

- unitários para domínio, helpers, datas, validações, hooks e componentes;
- integração para Dexie, escopos, modo local, modo autenticado, Supabase local e
  auth;
- E2E para fluxos críticos de navegador e responsividade.

Inclua regressões para:

- modo local sem conta;
- modo autenticado com conta;
- troca entre local e conta;
- garantia de que dados locais não vão para Supabase;
- garantia de que dados autenticados ficam associados ao usuário correto.

## Validações

Comandos Make:

```bash
make install
make dev
make build
make start
make lint
make typecheck
make test
make test-e2e
make format
make format-check
make check
make clean
make supabase-start
make supabase-stop
make supabase-status
make supabase-reset
make supabase-diff
make supabase-lint
make supabase-test-db
make supabase-types-local
```

`make check` delega para `npm run check`, que executa typecheck, lint, testes,
format-check e build. E2E roda separadamente com `make test-e2e` ou
`npm run test:e2e`. O cenário autenticado com latência simulada roda com
`npm run test:e2e:account`.

Antes de finalizar mudanças de código, rode os checks aplicáveis. Se não rodar
algum check, informe o motivo.

## CI/CD

- `.github/workflows/app-ci.yml`: roda `npm run check` em PRs e pushes para
  `main`.
- `.github/workflows/supabase-migrations.yml`: aplica migrations production via
  GitHub Actions.
- Vercel faz deploy automático a partir da `main`.

Migrations em `supabase/migrations` devem ser compatíveis com a versão anterior
e a nova versão da aplicação, já que Vercel e migrations são acionados a partir
da `main`. Quando o frontend passar a gravar uma coluna nova, faça rollout em
duas etapas: migration aditiva primeiro e frontend depois da confirmação.

## Documentação

Atualize `README.md` quando mudar setup, comandos, deploy, autenticação,
persistência, PWA, Supabase, testes ou comportamento relevante para humanos.

Atualize `AGENTS.md` quando mudar regras do projeto, decisões arquiteturais,
persistência, validação, UX base, testes, CI/CD ou fluxo de trabalho para
agentes.

Mantenha documentação curta, atual e acionável.
