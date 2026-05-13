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

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

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
