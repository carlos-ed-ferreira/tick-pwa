# Tick

## Visão geral

Tick é uma PWA de produtividade pessoal para acompanhamento diário de tarefas, checklists e metas. O projeto é local-first, funciona offline e sincroniza dados com Supabase para usuários autenticados.

O foco do produto é uma experiência rápida, mobile-first, com persistência local confiável e sincronização posterior quando a rede estiver disponível.

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

A aplicação usa persistência híbrida.

Dados são gravados primeiro no IndexedDB. Para usuários autenticados, alterações locais entram na fila de sincronização e são enviadas ao Supabase. Para usuários convidados, os dados permanecem somente no dispositivo.

Escopos principais:

- `guest:<installationId>` para modo local;
- `user:<supabaseUserId>` para usuário autenticado.

`AppProvider` coordena inicialização, autenticação, escopo ativo, idioma, timezone e agendamento de sincronização.

## Estrutura do projeto

```text
src/app           rotas Next.js e PWA
src/components    componentes compartilhados
src/features      áreas funcionais da aplicação
src/hooks         hooks reutilizáveis
src/lib/db        Dexie, schema local e comandos de escrita
src/lib/domain    tipos e regras de domínio
src/lib/i18n      idioma e dicionários
src/lib/supabase  cliente, auth e tipos Supabase
src/lib/sync      sincronização local-remota
src/lib/time      helpers de data e timezone
src/providers     providers globais
tests             testes unitários, integração e E2E
supabase          configuração e migrations SQL
```

## Requisitos

- Node.js `>=20.9.0`
- npm
- Docker, para o Supabase local
- make opcional, apenas para atalhos de comandos

No Ubuntu/WSL, instale `make` com:

```bash
sudo apt install make
```

Se `npm` não existir no terminal, instale o Node.js 20 ou superior antes de
continuar. Uma opção é usar `nvm`:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

## Configuração local

Instale as dependências:

```bash
npm install
```

Se `make` estiver instalado, o comando equivalente pelo Makefile é:

```bash
make install
```

Prepare o Supabase local:

```bash
make supabase-reset
make supabase-status
```

Use a `API URL` e a `anon key` exibidas por `make supabase-status` no arquivo
`.env.local`:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key local>
NEXT_PUBLIC_TICK_DISABLE_SUPABASE=
```

O seed local permite o email `dev@tick.local` na tabela `account_access`.
Crie um usuário com esse email e uma senha de desenvolvimento no Supabase
Studio local ou pela API Auth local. O login local suportado pelo app é
email/senha; Google local não faz parte do setup padrão.

Rode o ambiente de desenvolvimento com o Makefile. O comando inicia o Supabase
local antes do Next.js:

```bash
make dev
```

Se `make` não existir no ambiente, suba o Supabase local e depois rode o Next.js
com npm:

```bash
npm run supabase:start
npm run dev
```

Se `make` não existir no ambiente, use os scripts `npm` equivalentes listados no
`package.json`.

## Variáveis de ambiente

O arquivo `.env.example` lista as variáveis usadas pelo projeto:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TICK_DISABLE_SUPABASE=
```

Uso principal:

- `NEXT_PUBLIC_TICK_SUPABASE_ENV=local`: usa somente Supabase local em `localhost`;
- `NEXT_PUBLIC_TICK_SUPABASE_ENV=production`: usado em produção, fora de `localhost`;
- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto Supabase;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública anon/publishable;
- `NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1`: desliga Supabase por completo, incluindo login.

Em `localhost`, o app só autentica e sincroniza quando
`NEXT_PUBLIC_TICK_SUPABASE_ENV=local` e `NEXT_PUBLIC_SUPABASE_URL` aponta para
`localhost` ou `127.0.0.1`. Credenciais de produção não devem ser usadas em
`.env.local`.

## Comandos

Comandos Make disponíveis:

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
make supabase-types-local
```

Scripts npm equivalentes estão definidos em `package.json`.

`npm run check` executa typecheck, lint, testes, verificação de formatação e build. Os testes E2E são executados separadamente com `npm run test:e2e` ou `make test-e2e`.

## Testes e qualidade

Use:

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run build
```

Para verificação completa:

```bash
npm run check
make check
```

Testes E2E usam Playwright. A configuração atual inicia a aplicação em `http://127.0.0.1:3100` com `NEXT_PUBLIC_TICK_DISABLE_SUPABASE=1` e grava artefatos em `.next/playwright-*`.

## Persistência e sincronização

IndexedDB é a fonte local de dados da aplicação. Escritas de entidades devem passar pelos comandos em `src/lib/db`.

`localStorage` deve ser usado apenas para preferências pequenas, como idioma, tema ou flags de UI. Entidades principais não devem ser armazenadas nele.

Usuários autenticados sincronizam com Supabase por outbox local. Usuários convidados permanecem locais e não enviam dados ao backend.

O Supabase também é usado para autenticação, allowlist de acesso e persistência remota. Em `localhost`, autenticação e sincronização só podem usar o Supabase CLI local. Migrations versionadas ficam em `supabase/migrations`.

Comandos úteis para Supabase local:

```bash
make supabase-start
make supabase-reset
make supabase-status
make supabase-types-local
```

## PWA e offline

A aplicação deve funcionar bem sem internet. O service worker é gerado pelo Serwist durante o build, usando `src/app/sw.ts`, e há fallback offline em `/~offline`.

Fluxos de escrita devem ser locais primeiro. A sincronização acontece depois, quando houver usuário autenticado e rede disponível.

## Deploy

O deploy de produção roda na Vercel com o preset padrão de Next.js.

Configure na Vercel as variáveis públicas do Supabase quando o ambiente precisar de autenticação e sincronização:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Migrations do Supabase são aplicadas pelo GitHub Actions em pushes para `main`
quando há alterações em `supabase/migrations`, `supabase/config.toml` ou nos
scripts relacionados. Configure os secrets do ambiente `production` no GitHub:

```bash
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

O workflow executa `npm run supabase:prod:db:dry-run` antes de
`npm run supabase:prod:db:push`. Esses comandos de produção falham fora do
GitHub Actions. Como a Vercel também inicia deploy automaticamente em pushes
para `main`, migrations de produção devem ser compatíveis com a versão anterior
e a nova versão da aplicação.
