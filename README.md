# Tick

Tick é uma aplicação pessoal de produtividade construída como uma Progressive Web App (PWA), focada em controle diário de tarefas, metas e organização pessoal.

O projeto foi desenhado com arquitetura offline-first e mobile-first, permitindo uso fluido tanto em desktop quanto Android sem necessidade de publicação na Play Store.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- IndexedDB (Dexie)
- PWA
- Vercel

## Filosofia do projeto

O Tick prioriza:

- rapidez
- baixa fricção
- mínimo de cliques
- persistência offline
- UX moderna
- interface limpa
- experiência semelhante a aplicativo nativo

O sistema evita excesso de botões e prioriza interações contextuais, como double click, edição inline e auto-save.

## Arquitetura

O projeto segue uma arquitetura híbrida:

### Usuário autenticado

Dados persistidos em:

- Supabase PostgreSQL

Incluindo:

- tarefas diárias
- metas
- preferências
- cores globais
- estrutura de checklists

### Guest mode

Usuários não autenticados utilizam persistência exclusivamente local.

Dados ficam armazenados em:

- IndexedDB via Dexie

Nenhum dado guest é enviado ao backend.

## Offline-first

O projeto foi planejado como offline-first desde o início.

A aplicação deve:

- continuar funcional sem internet
- permitir edição offline
- sincronizar automaticamente quando necessário
- priorizar persistência local antes da rede

Tecnologias utilizadas:

- Service Worker
- Cache API
- IndexedDB
- Background sync

## Estrutura principal do produto

## Home

Tela inicial do sistema.

O usuário escolhe entre:

- Calendário diário
- Metas

## Calendário diário

Visualização mensal moderna em grid tradicional.

Características:

- calendário grande
- preview do conteúdo diário
- double click abre modal do dia
- edição inline
- auto-save
- checklists infinitamente aninhados
- cores globais reutilizáveis
- legenda contextual no modal
- interface extremamente fluida

## Metas

Sistema separado das tarefas diárias.

Categorias:

- curto prazo
- médio prazo
- longo prazo

Metas possuem progresso e organização independente do calendário diário.

## PWA

A aplicação deve funcionar como app instalável no Android.

Requisitos:

- manifest.json
- service worker
- offline support
- install prompt
- mobile experience otimizada

O projeto NÃO será publicado inicialmente na Google Play Store.

## Idioma e fuso horário

O Tick deve oferecer controle de idioma para:

- Português do Brasil (`pt-BR`)
- Inglês (`en`)

O idioma padrão deve ser inferido pela região atual do usuário quando possível, usando preferências do navegador e APIs de internacionalização do ambiente.

O usuário deve poder trocar o idioma manualmente dentro do aplicativo.

O idioma selecionado também influencia o fuso horário usado para identificar o dia atual:

- `pt-BR` usa o perfil Brasil, com fuso padrão `UTC-03:00` (`America/Sao_Paulo`)
- `en` usa o fuso horário detectado pelo navegador quando disponível

Todas as decisões de calendário diário devem usar o fuso do aplicativo, nunca apenas UTC. O dia atual deve ser calculado a partir do idioma/região/fuso ativo para evitar que tarefas mudem de dia incorretamente.

Preferências simples como idioma e fuso podem ser mantidas em `localStorage`. Entidades principais, como tarefas, metas e checklists, continuam obrigatoriamente em IndexedDB.

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
make check
make format
make clean
```

Os comandos `make` apenas encapsulam scripts `npm`; o projeto não usa Docker, Laradock, Laravel, PHP, Vite ou banco local via Makefile.

## Build

```bash
npm run build
npm run start
```

Verificação completa:

```bash
npm run check
make check
```

## Deploy

O deploy inicial é direcionado para a Vercel.

Configuração recomendada:

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: padrão da Vercel para Next.js
- Node.js: `>=20.9.0`

O modo real autenticado usa Supabase e login com Google ou e-mail e senha. Configure as variáveis abaixo no `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

Na Vercel, configure apenas as variáveis públicas do frontend:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

O Supabase deve estar com Google OAuth habilitado e as URLs de redirect configuradas para produção e desenvolvimento. O app não possui cadastro público: apenas e-mails ativos na tabela `account_access` podem entrar para salvar e sincronizar dados na nuvem. Usuários fora da allowlist ainda podem usar o modo local de demonstração, com dados salvos apenas no próprio dispositivo.

Se você quiser usar login com e-mail e senha, crie os usuários no Supabase Auth e mantenha o e-mail correspondente ativo na tabela `account_access`. O fluxo continua sem cadastro público dentro do app.

Para manter Google e e-mail/senha na mesma conta, prefira este fluxo:

- crie primeiro o usuário com e-mail e senha no Supabase Auth
- mantenha esse e-mail ativo em `account_access`
- depois permita login com Google usando o mesmo e-mail

O Supabase faz o vínculo automático das identidades quando o e-mail coincide e pode ser verificado com segurança. Para contas que já existem apenas com Google, qualquer criação ou gestão de senha deve ser feita diretamente no Supabase Auth, fora do app, para evitar contas separadas com o mesmo e-mail.

Para evitar rodar migration manualmente no SQL Editor, use o Supabase CLI via os comandos do projeto:

```bash
make supabase-link
make supabase-dry-run
make supabase-push
make supabase-types
```

Esses comandos leem o `.env.local` e executam `supabase link`, `db push` e geração de tipos automaticamente.

Onde encontrar cada valor:

- `SUPABASE_PROJECT_REF`: subdomínio do projeto no painel do Supabase.
- `SUPABASE_ACCESS_TOKEN`: token pessoal em Account > Access Tokens no Supabase.
- `SUPABASE_DB_PASSWORD`: senha do banco configurada na criação do projeto.
- `NEXT_PUBLIC_SUPABASE_URL`: `API URL` do projeto no painel do Supabase. Use a URL base do projeto, como `https://<project-ref>.supabase.co`, sem `/rest/v1`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública `anon` ou `publishable` do projeto no painel do Supabase.

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

Para liberar um usuário autenticado no app, adicione seu e-mail na allowlist:

```sql
insert into public.account_access (email, active)
values ('carlosedalmeidafer@gmail.com', true)
on conflict (email)
do update set active = excluded.active;
```

Antes de publicar, rode:

```bash
npm run check
```

O service worker é gerado durante `npm run build` pelo Serwist. Os arquivos gerados em `public/sw*` são artefatos de build e permanecem ignorados pelo Git.

## Qualidade de código

Objetivos principais:

- componentes pequenos
- tipagem forte
- baixa complexidade
- mínima abstração desnecessária
- arquitetura previsível
- performance
- UX fluida

## Regras importantes

- evitar excesso de modais desnecessários
- evitar excesso de botões
- priorizar auto-save
- priorizar edição inline
- evitar loaders agressivos
- manter experiência instantânea
- UI deve parecer um app moderno e premium
- design deve funcionar extremamente bem em mobile

## Persistência local

Guest mode utiliza IndexedDB como source of truth local.

localStorage deve ser usado apenas para:

- preferências simples
- tema
- flags pequenas

Nunca para estruturas principais do sistema.

## Futuro

O projeto deve permanecer simples e pessoal.

Evitar:

- microservices
- overengineering
- arquiteturas enterprise desnecessárias
- complexidade prematura
