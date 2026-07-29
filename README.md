# Tick

Tick é uma PWA de produtividade pessoal para acompanhamento de tarefas e metas.
O produto é mobile-first, responsivo e deve continuar útil
sem conta, com dados salvos no próprio dispositivo.

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

O repositório é um app web único em Next.js. A UI fica em `src/app`,
`src/features`, `src/components`, `src/hooks` e `src/providers`. Regras de
domínio, datas, persistência local e Supabase ficam em `src/lib`.

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

## Modos de uso

Tick tem dois modos separados.

Modo local sem conta:

- escopo `guest:<installationId>`;
- salva entidades no IndexedDB do dispositivo;
- não envia dados ao Supabase;
- não migra dados automaticamente para uma conta.

Modo autenticado com conta:

- escopo `user:<supabaseUserId>`;
- autentica com Supabase;
- persiste dados da conta no Supabase;
- confirma alterações primeiro no cache IndexedDB para manter a UI responsiva;
- envia as alterações ao Supabase em ordem, depois do commit local;
- mantém preferências de interface, como as ações visíveis nas linhas de tarefa,
  associadas ao usuário em `user_preferences`;
- restaura o valor remoto e mostra feedback se a persistência falhar;
- não importa nem sincroniza dados do modo local.

Não existe sync ou migração automática do modo local para o modo autenticado.
Essa separação é intencional.

## Importação JSON

Em `/calendar`, o botão **Importar JSON** abre um modal onde você cola um JSON
com dias e tarefas. `text` é o único campo obrigatório da tarefa; horário,
prioridade e categoria são opcionais, e categorias que não existirem são criadas
com a cor informada. A importação anexa às tarefas do dia e funciona nos dois
modos de uso.

Formato, regras completas e mensagens de erro em
[docs/importacao-json.md](docs/importacao-json.md).

## Setup local

Requisitos:

- Node.js `>=20.9.0`
- npm
- Docker, para Supabase local
- `make` opcional

Instale dependências:

```bash
npm install
# ou
make install
```

Configure `.env.local` para usar Supabase local:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key local>
NEXT_PUBLIC_TICK_DISABLE_SUPABASE=
```

Em `localhost`, o app só habilita Supabase quando
`NEXT_PUBLIC_TICK_SUPABASE_ENV=local` e a URL aponta para `localhost`,
`127.0.0.1` ou `::1`. Não use credenciais de produção em `.env.local`.

Suba o ambiente:

```bash
make dev
```

Sem `make`:

```bash
npm run supabase:start
npm run dev
```

## Supabase local

Comandos úteis:

```bash
make supabase-start
make supabase-stop
make supabase-status
make supabase-reset
make supabase-diff
make supabase-lint
make supabase-test-db
make supabase-types-local
```

`make supabase-reset` aplica migrations e seed local. O seed cria/libera o
usuário `dev@email.com` com senha `12341234` para desenvolvimento.

O estado desejado do banco fica em `supabase/schemas/tick.sql`. Altere esse
arquivo e use `make supabase-diff` para gerar/revisar migrations incrementais.
`make supabase-test-db` executa os testes pgTAP e `make supabase-lint` valida o
schema local.

## Produção

O frontend roda na Vercel. Em produção, configure:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Fora de `localhost`, Supabase só é habilitado quando
`NEXT_PUBLIC_TICK_SUPABASE_ENV=production` está explícito.

Migrations de produção são aplicadas pelo GitHub Actions em pushes para `main`
quando arquivos de Supabase mudam. Configure os secrets do ambiente
`production` no GitHub:

```bash
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

O workflow roda `npm run supabase:prod:db:dry-run` antes de
`npm run supabase:prod:db:push`. Esses comandos são bloqueados fora do GitHub
Actions.

Mudanças que adicionam campos usados pelo frontend devem ser publicadas em duas
etapas: primeiro a migration aditiva e, após sua confirmação, o frontend que
passa a gravar o novo campo.

## Comandos

Make:

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

Scripts npm equivalentes:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:account
npm run format
npm run format:check
npm run check
npm run clean
npm run supabase:start
npm run supabase:stop
npm run supabase:status
npm run supabase:db:reset
npm run supabase:types:local
```

`npm run check` e `make check` executam typecheck, lint, testes, format-check e
build. E2E roda separadamente com `npm run test:e2e` ou `make test-e2e`; o
Playwright gera um build e sobe `next start` em `127.0.0.1:3100`.
`npm run test:e2e:account` executa o cenário autenticado com Supabase simulado
e gravações atrasadas em `127.0.0.1:3101`.

## Qualidade e testes

Use TDD para mudanças comportamentais: crie ou ajuste testes antes de alterar a
feature/refatoração.

Use:

- unitários para domínio, datas, validações, hooks e componentes isolados;
- integração para Dexie, escopos, persistência de conta, Supabase local e auth;
- E2E para fluxos críticos de navegador e responsividade.

Checks principais:

```bash
make typecheck
make lint
make test
make format-check
make build
make check
```

## PWA e offline

Serwist gera o service worker no build a partir de `src/app/sw.ts`. O fallback
offline fica em `/~offline`.

O modo local deve funcionar offline. O modo autenticado depende do Supabase para
confirmar gravações de conta; falhas de rede devem preservar o contexto e
mostrar feedback sem misturar dados locais com dados de conta.

## CI/CD

- `.github/workflows/app-ci.yml`: roda `npm run check` em PRs e pushes para
  `main`.
- `.github/workflows/supabase-migrations.yml`: aplica migrations de produção no
  Supabase via GitHub Actions.
- Vercel faz deploy automático a partir da `main`.

## Troubleshooting

- Se login local não aparecer, confira `.env.local` e rode
  `make supabase-status`.
- Se o banco local estiver inconsistente, rode `make supabase-reset`.
- Se E2E falhar ao subir servidor, verifique se já há `next dev` rodando no
  mesmo repositório.
- Se tipos Supabase ficarem defasados, rode `make supabase-types-local`.
