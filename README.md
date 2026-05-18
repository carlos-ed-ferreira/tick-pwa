# Tick

Tick é uma Progressive Web App pessoal de produtividade, focada em calendário diário, checklists e organização de metas. O projeto é offline-first, mobile-first e está rodando em produção na Vercel com Supabase para autenticação e persistência remota de usuários permitidos.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- IndexedDB com Dexie
- Serwist PWA
- Vercel

## Produto

O Tick prioriza rapidez, baixa fricção, auto-save e uma experiência próxima de aplicativo nativo. A interface evita fluxos de dashboard e ações pesadas, favorecendo edição inline, interações contextuais e uso confortável em Android e desktop.

Áreas principais:

- Home: rota inicial de navegação para calendário e metas, sem estrutura de landing page.
- Calendário diário: grade mensal com preview de conteúdo por dia, abertura do editor pelo estado da URL em `/calendar?day=YYYY-MM-DD` e um modal de aplicação em lote por intervalo com datas digitadas em `DD-MM-YYYY`, seleção de dias da semana e replicação dos itens nos dias compatíveis.
- Editor do dia: modal amplo com checklists aninhados sem limite artificial, edição inline, auto-save, collapse/expand, indentação, reordenação entre irmãos, prioridade por item e cores por linha.
- Categorias: gerenciamento global de tags de cor reutilizáveis para os itens de checklist.
- Metas: área separada das tarefas diárias, com seções empilhadas por curto, médio e longo prazo, lista única de itens por seção, subitens aninhados, categorias por item, reordenação entre irmãos e persistência local-first.

## Arquitetura

O projeto usa uma arquitetura híbrida de persistência.

### Usuário autenticado

Usuários autenticados usam escopo `user:<supabaseUserId>`. As alterações são gravadas primeiro no IndexedDB e entram na fila local de sincronização. O Supabase PostgreSQL funciona como persistência remota, com RLS e allowlist de acesso.

A sincronização usa o outbox local e roda em momentos como inicialização da sessão autenticada, retorno ao foco, evento `online` e intervalo enquanto a aplicação está aberta. A rede é tratada como melhoria, não como requisito para interação.

### Modo local

Usuários sem acesso autenticado podem entrar no modo local de demonstração. Esse modo usa escopo `guest:<installationId>` e mantém dados exclusivamente no IndexedDB via Dexie.

Dados do modo local nunca são enviados ao backend.

### Persistência

Use IndexedDB para entidades da aplicação:

- entradas diárias
- itens de checklist
- tags de cor
- metas e passos de metas
- filas de sincronização
- entidades em cache

Use `localStorage` apenas para preferências pequenas, como idioma, tema ou flags de UI. Entidades da aplicação não devem ser armazenadas em `localStorage`.

## Autenticação e acesso

O app suporta autenticação pelo Supabase Auth com:

- Google OAuth
- e-mail e senha

Não existe cadastro público dentro do app. Para salvar e sincronizar dados na nuvem, o e-mail do usuário precisa estar ativo na tabela `public.account_access`. Usuários fora da allowlist podem usar o modo local, com dados salvos apenas no dispositivo.

Para liberar um usuário autenticado:

```sql
insert into public.account_access (email, active)
values ('usuario@example.com', true)
on conflict (email)
do update set active = excluded.active;
```

Para manter Google e e-mail/senha na mesma conta, prefira criar primeiro o usuário com e-mail e senha no Supabase Auth, manter esse e-mail ativo em `account_access` e depois permitir login com Google usando o mesmo e-mail.

## Offline-first

O Tick permanece utilizável sem internet. Escritas são locais primeiro, a UI é otimista e as interações não devem aguardar chamadas de rede. O service worker é gerado pelo Serwist durante o build e a aplicação mantém a rota offline em `/~offline`.

Tecnologias usadas:

- Service Worker
- Cache API
- IndexedDB
- Dexie
- Outbox local de sincronização

## Idioma e fuso horário

O Tick suporta:

- Português do Brasil (`pt-BR`)
- Inglês (`en`)

O idioma padrão é inferido do navegador quando possível, e o usuário pode trocar manualmente no app. A preferência de idioma também afeta o fuso usado para calcular o dia atual:

- `pt-BR` usa o perfil Brasil com `America/Sao_Paulo`.
- `en` usa o fuso horário detectado pelo navegador quando disponível.

Decisões de calendário diário devem usar os helpers timezone-aware do app. Não use recorte direto de string UTC para calcular dias, entradas diárias, limites de calendário ou exibição de vencimento de metas.

## Desenvolvimento

```bash
npm install
npm run dev
```

Também existem atalhos via `make`:

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
```

Os comandos `make` apenas encapsulam scripts `npm`; o projeto não usa Docker, Laradock, Laravel, PHP, Vite ou banco local via Makefile.

## Qualidade

Ao alterar código, adicione ou atualize testes automatizados relevantes. Use testes unitários para lógica pura, integração para comandos IndexedDB/sync e Playwright para fluxos críticos de interface.

Antes de finalizar uma mudança de código, rode os comandos aplicáveis:

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
```

Para verificação completa:

```bash
npm run check
make check
```

Atualize este README quando a mudança alterar comportamento visível, setup, autenticação, persistência, deploy ou comandos de desenvolvimento. Atualize `.github/copilot-instructions.md` quando a mudança alterar regras arquiteturais, padrões de persistência, workflow de desenvolvimento ou diretrizes de UX.

## Build e produção

```bash
npm run build
npm run start
```

A produção roda na Vercel com configuração padrão de Next.js:

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: padrão da Vercel para Next.js
- Node.js: `>=20.9.0`

O service worker é gerado durante `npm run build` pelo Serwist. Os arquivos gerados em `public/sw*` são artefatos de build e permanecem ignorados pelo Git.

## Variáveis de ambiente

Para desenvolvimento local com Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

Na Vercel, configure apenas as variáveis públicas usadas pelo frontend:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Onde encontrar cada valor:

- `SUPABASE_PROJECT_REF`: subdomínio do projeto no painel do Supabase.
- `SUPABASE_ACCESS_TOKEN`: token pessoal em Account > Access Tokens no Supabase.
- `SUPABASE_DB_PASSWORD`: senha do banco configurada na criação do projeto.
- `NEXT_PUBLIC_SUPABASE_URL`: `API URL` do projeto no painel do Supabase. Use a URL base do projeto, como `https://<project-ref>.supabase.co`, sem `/rest/v1`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública `anon` ou `publishable` do projeto no painel do Supabase.

## Supabase

O schema remoto usa migration SQL versionada, RLS e tabela `account_access` para controlar quem pode salvar e sincronizar dados. Para evitar rodar migration manualmente no SQL Editor, use o Supabase CLI via os comandos do projeto:

```bash
make supabase-link
make supabase-dry-run
make supabase-push
make supabase-types
make supabase-migrations
```

Esses comandos leem o `.env.local` e executam `supabase link`, `db push`, listagem de migrations e geração de tipos automaticamente.

Configuração mínima de Google OAuth:

- `Authorized JavaScript origins` no Google Cloud:
  - `http://localhost:3000`
  - `https://tickapp.com.br`
- `Authorized redirect URIs` no Google Cloud:
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- `Site URL` no Supabase Auth:
  - `https://tickapp.com.br`
- `Redirect URLs` no Supabase Auth:
  - `http://localhost:3000`
  - `https://tickapp.com.br`

Se usar login com e-mail e senha, crie os usuários no Supabase Auth e mantenha o e-mail correspondente ativo em `account_access`.

## Diretrizes de código

- Prefira componentes pequenos, tipagem forte e implementações diretas.
- Evite abstrações prematuras, estado global pesado e arquitetura enterprise.
- Preserve auto-save, edição inline, baixa fricção e comportamento mobile-first.
- Mantenha o backend fino: autenticação, sincronização, persistência e validação de ownership.
- Use os comandos locais de persistência em vez de escrever diretamente nas tabelas do Dexie a partir da UI.
- Mantenha a experiência funcional offline e trate rede como aprimoramento.
