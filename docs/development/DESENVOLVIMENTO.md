# Desenvolvimento do Tick

Este é o ponto de entrada para executar e manter o projeto. Para conhecer o produto, leia o [README](../../README.md). Para contribuir com agentes, leia [AGENTS](../../AGENTS.md); os critérios de aprovação estão em [REVIEW](../../REVIEW.md).

## Pré-requisitos

- Git;
- Node.js 20.19+ ou 22.12+ com npm, conforme o `engines` do `package.json` e
  o requisito do Vite 8 usado pelas ferramentas de teste;
- Docker acessível ao usuário local;
- GNU Make;
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
Elas controlam a outbox funcional e a RPC transacional; somente UUIDs
listados usam esse caminho. A configuração está no runbook de operação.

Produção requer:

```bash
NEXT_PUBLIC_TICK_SUPABASE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Configuração de produção, nomes de secrets, origem, finalidade e consumidores ficam no [inventário operacional](../operations/AMBIENTE-DE-PRODUCAO.md). O [runbook de publicação](../operations/PUBLICACAO.md) descreve o uso dessas credenciais; elas não pertencem ao ambiente local.

A instalação reproduzível por `make install-ci` mantém o lockfile e os scripts
normais do npm. Em falhas transitórias identificadas no download da CLI
Supabase pelo GitHub Releases, repete a instalação até três vezes no total,
com esperas de 5 e 10 segundos. Outros erros interrompem imediatamente. Essa
recuperação vale para os jobs de CI, publicação e backup que usam o target;
não repete migrations, deploys ou o workflow inteiro.

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
então publica o SHA aprovado pela API da Vercel. Ele depende do quality gate aprovado do
mesmo SHA e falha se a `main` avançar antes do disparo. A confirmação do deployment segue o
[runbook de deploy](../operations/PUBLICACAO.md).

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

## Comandos essenciais

O Makefile é a interface única de operação; o catálogo executável está em `make help`. Não execute npm, npx, CLIs de serviço ou scripts do repositório diretamente. Rotinas recorrentes novas recebem primeiro um target e uma entrada no help.

| Necessidade                                  | Comando                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| Instalar versões do lockfile                 | `make install-ci`                                            |
| Desenvolver com Supabase local               | `make dev`                                                   |
| Conferir ambiente local                      | `make supabase-status`                                       |
| Recriar banco local isolado                  | `make supabase-reset`                                        |
| Rodar testes afetados                        | `make test-file files="tests/unit/arquivo.test.ts"`          |
| Conferir TypeScript e lint                   | `make typecheck`, `make lint`                                |
| Formatar e conferir estilo                   | `make format`, `make format-check`                           |
| Validar a implementação ao concluir          | `make check`                                                 |
| Conferir estrutura e segurança               | `make quality-check`, `make check-secrets`                   |
| Testar navegador e toque                     | `make test-e2e`, `make test-e2e-mobile`                      |
| Testar conta com API real temporária         | `make test-account-browser`                                  |
| Testar navegador em container                | `make test-e2e-container`, `make test-e2e-account-container` |
| Gerar galeria do produto                     | `make screenshots`                                           |
| Auditar superfícies sem substituir a galeria | `make audit-ui`                                              |
| Gerar e servir produção local                | `make build`, `make start`                                   |

`make check` inclui typecheck, lint, Vitest, format-check e build; banco e E2E são separados. Durante a implementação, use testes direcionados; execute o check completo uma vez ao concluir. Não execute builds, check e E2E simultaneamente no mesmo checkout, pois reescrevem `.next`. A matriz de aprovação pertence ao [REVIEW](../../REVIEW.md).

Os targets de E2E em container usam a imagem oficial do Playwright com GNU Make, UID/GID local e nenhuma porta publicada. Use-os em Linux sem as bibliotecas do Chromium no host; mantenha a versão da imagem igual à dependência Playwright.

`make test-account-browser` cria checkout e Supabase temporários nas portas 56320–56329 e app em 3102, usa rede host no container e uma conta sintética do seed. Não lê `.env` nem reseta o banco de trabalho. Os artefatos ficam em `.next/playwright-account-real-results`. Os cenários de conflito incluem latência controlada e aguardam a confirmação da RPC correspondente e o esvaziamento da outbox local antes de conferir convergência. O indicador visual possui atraso de apresentação e não é usado sozinho como confirmação de envio.

Os comandos de dependências, diagnóstico, backup e publicação estão nos runbooks ligados abaixo. Diagnóstico é opcional e local; seu resultado não aprova capacidade de produção. Targets `supabase-prod-*` só executam no GitHub Actions; o wrapper os bloqueia fora dele.

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
containers; o projeto não possui Compose próprio; a imagem de E2E está em `docker/playwright.Dockerfile`.

## Referências por tarefa

| Necessidade                         | Documento                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Módulos, domínio, recorrentes e PWA | [Arquitetura](ARQUITETURA.md)                                               |
| Escritas, outbox, retry e conflitos | [Sincronização](SINCRONIZACAO.md)                                           |
| Guest e contas convidadas           | [Modos de acesso](MODOS-DE-ACESSO.md)                                       |
| UI e composição de toque            | [Skill de frontend](../../.agents/skills/frontend-design/SKILL.md)          |
| Imagens de demonstração             | [Capturas de tela](CAPTURAS-DE-TELA.md)                                     |
| Ambiente externo e credenciais      | [Ambiente de produção](../operations/AMBIENTE-DE-PRODUCAO.md)               |
| Deploy, preflight e retomada        | [Publicação](../operations/PUBLICACAO.md)                                   |
| Backup, conflitos e rollback        | [Monitoramento e recuperação](../operations/MONITORAMENTO-E-RECUPERACAO.md) |
| Restaurar em outra máquina          | [Teste de restauração](../operations/TESTE-DE-RESTAURACAO.md)               |
| Medir lentidão                      | [Diagnóstico de desempenho](../operations/DIAGNOSTICO-DE-DESEMPENHO.md)     |
| Atualizar pacotes                   | [Dependências](../operations/DEPENDENCIAS.md)                               |
| Trabalho ainda aberto               | [Pendências](../planning/PENDENCIAS.md)                                     |

O Makefile é a fonte executável dos comandos: consulte `make help`. O catálogo acima descreve sua finalidade; não substitui os gates do REVIEW. Produção, commits e publicações continuam sob controle manual do desenvolvedor.
