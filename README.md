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

No estado atual do produto, o modo guest local-first já funciona sem variáveis de ambiente. Supabase, autenticação e sincronização ainda fazem parte do backlog, então as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` não são necessárias para este primeiro deploy.

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
