# AGENTS.md

## Propósito

Este guia orienta agentes de código ao alterar o Tick. Ele vale para todo o repositório, salvo quando houver um `AGENTS.md` mais específico em algum subdiretório.

Use este arquivo para preservar as decisões centrais do projeto: offline-first, persistência local, sincronização segura, UX rápida e documentação atualizada.

## Fundamentos do projeto

Tick é uma PWA de produtividade pessoal, local-first e mobile-first. A aplicação deve continuar útil sem internet e tratar a rede como melhoria, não como requisito para interação.

Mantenha o produto simples, responsivo e direto. Prefira auto-save, edição inline, feedback contextual e estados mínimos de carregamento.

## Arquitetura e persistência

IndexedDB, via Dexie, é a base da persistência local. Entidades principais da aplicação devem viver no IndexedDB, incluindo tarefas, checklists, metas, entradas diárias, filas de sincronização e entidades em cache.

Escritas de entidades feitas pela UI devem passar pelos comandos locais em `src/lib/db`. Componentes não devem escrever diretamente nas tabelas Dexie, para preservar escopo, metadados, resumos e outbox.

Use `localStorage` apenas para preferências pequenas, como idioma, tema, flags de UI e escolhas locais simples. Não use `localStorage` para entidades principais da aplicação.

## Autenticação, escopos e sincronização

Usuários autenticados usam Supabase para autenticação, persistência em nuvem e sincronização. O escopo autenticado segue o formato:

```text
user:<supabaseUserId>
```

Usuários convidados são locais. Dados de convidados permanecem no dispositivo e não devem ser enviados ao backend. O escopo local segue o formato:

```text
guest:<installationId>
```

Escritas autenticadas devem ser local-first, marcar entidades como pendentes quando aplicável e sincronizar depois pelo outbox. Escritas de convidados devem permanecer locais e não devem criar itens de sincronização remota.

Não implemente migração automática de dados de convidado para usuário autenticado sem uma decisão explícita de produto.

Em `localhost`, o app deve autenticar e sincronizar apenas contra o Supabase CLI local. Não use credenciais, URL ou chaves públicas do Supabase de produção em `.env.local`. O ambiente local deve usar `NEXT_PUBLIC_TICK_SUPABASE_ENV=local` e uma URL local (`localhost` ou `127.0.0.1`).

Produção deve usar `NEXT_PUBLIC_TICK_SUPABASE_ENV=production` fora de `localhost`. Comandos que aplicam migrations remotas são restritos ao GitHub Actions; o fluxo local deve usar comandos do Supabase local.

## UX e comportamento da aplicação

A experiência deve parecer rápida, fluida e adequada a uso móvel. Prefira interações imediatas, auto-save quando fizer sentido e feedback local.

Evite bloquear fluxos esperando respostas de API. Quando a rede falhar ou estiver ausente, mantenha o usuário no contexto e preserve os dados localmente.

Use componentes compartilhados quando eles reduzirem repetição real e mantiverem clareza. Não extraia abstrações apenas porque dois trechos são parecidos.

## Sistema visual

Prefira cards, painéis, dialogs e contêineres principais sem bordas visíveis. Use as superfícies compartilhadas `card-surface`, `card-surface-soft` e `card-surface-strong` como base para elevação e profundidade.

Quando precisar de uma identidade de cor consistente, ancore a interface no conjunto `#312c51`, `#48426d`, `#f0c38e` e `#f1aa9b`, preservando os fundos neutros quentes e os contrastes suaves já definidos no tema.

## Formulários, validação e feedback

Validação deve ser controlada pela aplicação e exibida com componentes locais. Formulários React controlados pela aplicação devem usar `noValidate` para impedir popups nativos de validação HTML5.

Não dependa de `required`, `pattern`, `minLength`, `maxLength` ou `type="email"` como experiência visível de validação. Se tipos semânticos forem usados por ergonomia, a mensagem visível ainda deve ser local e estilizada pelo app.

Inputs curtos e estruturados devem desabilitar assistência automática do navegador por padrão:

```tsx
spellCheck={false}
autoCorrect="off"
autoCapitalize="none"
```

Use os primitivos do projeto, como `Input`, quando eles já centralizam esses padrões.

Não use `window.alert`, `window.confirm`, `window.prompt` nem bibliotecas com comportamento equivalente. Use mensagens inline, toast, banner, modal ou sheet da aplicação.

## Localização e datas

O app suporta `pt-BR` e `en`. Preferências de idioma e timezone são pequenas preferências de UI e podem usar armazenamento local apropriado.

Datas diárias devem usar os helpers timezone-aware em `src/lib/time`. Não calcule dias do calendário por recorte bruto de strings UTC.

## Organização de código

Mantenha regras de negócio perto da feature ou da camada de persistência responsável. Preserve componentes pequenos, props claras e tipagem forte.

Use hooks e componentes compartilhados quando o mesmo comportamento aparece em mais de uma superfície e a extração melhora manutenção. Mantenha comandos, labels e regras de domínio dentro da feature dona quando forem específicos.

Não adicione infraestrutura, backend ou bibliotecas pesadas sem necessidade clara para a tarefa.

## Testes e verificação

Alterações de código devem vir com testes compatíveis com o risco da mudança. Use o menor nível que cubra o comportamento:

- unitários para lógica pura, helpers, hooks e componentes isolados;
- integração para comandos Dexie, escopo, outbox, sync e auth;
- E2E para fluxos críticos de navegador.

Antes de finalizar mudanças de código, rode as verificações aplicáveis. Prefira `make check` ou `npm run check` quando a mudança não for apenas documental.

Se não rodar algum check, informe o motivo.

## Documentação

Atualize `README.md` quando mudar setup, comandos, deploy, autenticação, persistência, sincronização, PWA ou comportamento relevante para humanos usando o repositório.

Atualize `AGENTS.md` quando mudar regras do projeto, decisões arquiteturais, persistência, validação, UX base, testes ou fluxo de trabalho para agentes.

Mantenha a documentação curta, atual e acionável.

## Deploy e migrations

Migrations em `supabase/migrations` são aplicadas em produção por GitHub Actions
em pushes para `main`. Como a Vercel também deploya automaticamente a partir da
`main`, mantenha migrations compatíveis com a versão anterior e a nova versão da
aplicação, salvo quando o fluxo de deploy for explicitamente alterado.

## Comandos úteis

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
