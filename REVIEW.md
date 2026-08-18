# REVIEW.md

## Propósito

Este documento define como provar que uma alteração está pronta. Métricas
substituem opiniões quando a propriedade é mensurável; revisão humana continua
obrigatória para intenção, regra de negócio, arquitetura, abstração e UX.

Estados:

- `enforced`: automatizado no repositório e executado pelo gate indicado;
- `manual`: verificável hoje, mas não integrado ao gate principal;
- `planned`: ferramenta, baseline ou automação ainda não existe.

## Política de baseline e ratchet

Código legado pode permanecer temporariamente abaixo do objetivo. Nenhuma
mudança pode piorar o baseline da métrica que afeta. Código novo ou
substancialmente alterado obedece ao objetivo mais rigoroso.

Para cada nova métrica:

1. medir o repositório sem alterar código;
2. registrar data, ferramenta, versão, escopo e resultado;
3. adotar o resultado como piso ou teto temporário;
4. bloquear regressão;
5. apertar o limite somente após melhoria real.

Não refatore áreas não relacionadas para tornar uma métrica global verde. Uma
exceção requer justificativa, risco, responsável e prazo; não pode esconder
falha de segurança ou perda de dados.

## Baseline em 2026-08-10

Ambiente da medição: Node 22.21.1, npm 10.9.4, Linux.

| Medida                                       | Resultado                                                    |
| -------------------------------------------- | ------------------------------------------------------------ |
| Vitest                                       | 56 arquivos, 394 testes aprovados, 12,51 s                   |
| Playwright local                             | 22 testes aprovados, Chromium desktop e Pixel 7              |
| Playwright autenticado                       | 2 testes aprovados com Supabase simulado e latência          |
| pgTAP                                        | 1 arquivo, 22 testes aprovados                               |
| Schema lint                                  | 0 erros                                                      |
| Typecheck, lint, comentários, format e build | aprovados                                                    |
| Build das rotas principais                   | dinâmico, renderizado sob demanda                            |
| Dependências de produção                     | 5 vulnerabilidades altas e 0 críticas pelo `make audit-prod` |
| Complexidade ciclomática                     | 40 funções acima de 10; máximo observado 60                  |
| Funções                                      | 54 acima de 80 linhas lógicas; máximo observado 749          |
| Módulos                                      | 6 acima de 800 linhas lógicas; máximo observado 3.861        |
| Cobertura e mutation score                   | não medidos; ferramenta ausente                              |
| Performance, bundle e acessibilidade         | sem baseline automatizado                                    |

Os comandos ad hoc de complexidade e tamanho usaram regras nativas do ESLint
com `skipBlankLines` e `skipComments`. Arquivos gerados não definem o ratchet.

Avisos preexistentes observados: o Vitest emite um aviso React sobre o atributo
`priority` em teste e logs esperados de falha remota; Playwright emite avisos de
cor do processo. Eles não falham o gate atual.

## Ratchet em 2026-08-11

- Vitest: 57 arquivos e 402 testes aprovados;
- dependências de produção: 0 vulnerabilidades pelo `make audit-prod`;
- audit de produção automatizado no App CI e no gate manual de migrations;
- snapshot autenticado: 1.001 linhas em cada tabela e falha da página final;
- refresh autenticado: testes de deduplicação, validade e isolamento por conta.

## Ratchet em 2026-08-14

- pgTAP: 31 testes aprovados, incluindo tabelas, RLS e chaves por usuário do
  POC PowerSync isolado;
- schema declarativo e migrations sem diferenças pelo `make supabase-diff`;
- lint do schema PostgreSQL com 0 erros.

## Ratchet em 2026-08-17

- Vitest: 61 arquivos e 439 testes aprovados;
- pgTAP: 56 testes aprovados, incluindo negativas comportamentais de leitura e
  escrita entre contas nas tabelas isoladas do PowerSync e o primeiro contrato
  transacional de escrita do calendário;
- allowlist distingue acesso negado de indisponibilidade remota;
- fallback offline aceita somente grant positivo com até 24 horas, mesmo UUID
  e mesmo e-mail; grant expirado ou divergente não autentica;
- erro retornado ou exceção de rede produzem o mesmo estado recuperável.
- ensaio real: cenário autenticado preservado após reload offline e fila zerada
  na reconexão sem repetição manual.
- POC PowerSync usa adapter single-tab sem Web Worker, timeout recuperável de
  inicialização e escrita bloqueada enquanto o SQLite não estiver pronto.
- ensaio mobile físico aprovou inicialização do SQLite, leitura do snapshot e
  interação com os controles depois do deploy.

## Ratchet em 2026-08-18

- Vitest: 61 arquivos e 441 testes aprovados;
- pgTAP: 74 testes aprovados;
- inicialização do POC separa abertura local e conexão remota; atraso ou falha
  de conexão não fecha o SQLite pronto nem impede leitura e escrita locais;
- ensaio manual pós-deploy em produção aprovou abertura do SQLite e uso da rota
  sem espera seguida de erro;
- RPC transacional estendida a grupos de metas, metas e etapas, com criação
  atômica da hierarquia, ownership derivado do JWT, compare-and-set e rejeição
  determinística de revisão stale;
- banco recriado desde zero, lint sem erros e migrations sem divergência do
  schema declarativo.
- upload do POC transforma uma transação SQLite em uma RPC com recibo
  idempotente, ownership derivado do JWT e rollback integral; o estado canônico
  entre commits válidos segue last-committed-wins.

## Matriz de quality gates

| Gate               | Métrica e threshold                                                                 | Escopo                              | Estado         | Legado                                    | Bloqueia?                   |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------- | -------------- | ----------------------------------------- | --------------------------- |
| TypeScript         | 0 erros em `make typecheck`                                                         | TS/TSX                              | enforced       | todo o código                             | sim                         |
| Comentários e lint | 0 comentários proibidos e 0 erros em `make lint`                                    | código, teste, CSS e SQL suportados | enforced       | exceções geradas configuradas             | sim                         |
| Formatação         | 0 diferenças em `make format-check`                                                 | arquivos suportados                 | enforced       | todo o código                             | sim                         |
| Unit/integration   | 100% dos testes Vitest aprovados                                                    | suíte existente                     | enforced       | sem redução de testes válida sem revisão  | sim                         |
| Build              | exit 0 em `make build`                                                              | aplicação e PWA                     | enforced       | todo o código                             | sim                         |
| E2E local          | 100% aprovados em desktop e mobile                                                  | fluxos Playwright existentes        | manual         | manter baseline de 22                     | sim quando aplicável        |
| E2E autenticado    | 100% aprovados em desktop e mobile                                                  | fluxo de latência simulado          | manual         | manter baseline de 2                      | sim para auth/sync          |
| Schema lint        | 0 erros                                                                             | Postgres local                      | manual         | sem regressão                             | sim para banco              |
| pgTAP              | 100% aprovados                                                                      | `supabase/tests`                    | manual         | manter ao menos 74; remoção exige revisão | sim para banco              |
| Banco limpo        | reset, migrations e seed com exit 0                                                 | todas as migrations                 | manual         | compatibilidade obrigatória               | sim para banco              |
| Dependency audit   | 0 críticas e 0 altas em `make audit-prod`                                           | dependências de produção            | enforced no CI | baseline reduzido a zero                  | sim para dependência/deploy |
| Line coverage      | baseline inicial sem queda; objetivo global 80%; diff 90%                           | código não gerado                   | planned        | ratchet global                            | sim após automação          |
| Branch coverage    | baseline inicial sem queda; objetivo global 70%; diff 80%                           | código não gerado                   | planned        | ratchet global                            | sim após automação          |
| Mutation testing   | score não cai; objetivo 70% em domínio/persistência                                 | módulos críticos alterados          | planned        | baseline por módulo                       | sim após automação          |
| Complexidade       | nova função ≤10; função legada alterada não aumenta e deve caminhar a ≤10           | funções alteradas                   | planned        | máximo atual 60                           | sim após automação          |
| Tamanho de função  | nova função ≤80 linhas lógicas; legado alterado não aumenta                         | funções alteradas                   | planned        | máximo atual 749                          | sim após automação          |
| Tamanho de módulo  | novo módulo ≤800 linhas lógicas; hotspot alterado não aumenta sem plano de extração | módulos alterados                   | planned        | 6 hotspots, máximo 3.861                  | sim após automação          |
| Arquitetura        | 0 ciclos novos e 0 imports proibidos                                                | `src`                               | planned        | baseline a medir                          | sim após automação          |
| SAST e secrets     | 0 achados críticos/altos novos e 0 secret confirmado                                | repositório e diff                  | planned        | baseline por finding                      | sim                         |
| Acessibilidade     | 0 violação crítica/séria nova; teclado e nome acessível                             | UI alterada                         | manual/planned | baseline a medir                          | sim quando aplicável        |
| Performance        | p95 e bundle não pioram mais de 10% sem justificativa                               | caminho medido                      | planned        | baseline por cenário                      | sim após estabilidade       |
| Local-first        | nenhum dado perdido; retry idempotente; reconexão converge                          | persistência alterada               | manual/planned | limitações no IMPLEMENTATION              | sim quando aplicável        |
| i18n               | tipos válidos e chaves pt/en presentes; 0 string nova fora do mecanismo             | UI alterada                         | manual         | shape tipado já existe                    | sim quando aplicável        |
| UI responsiva      | cenários mobile e desktop aprovados                                                 | UI alterada                         | manual         | preservar comportamento                   | sim quando aplicável        |

`make check` é o gate automatizado atual. Ele não inclui E2E, banco,
coverage, segurança, complexidade ou performance.

## Thresholds estruturais

Complexidade e LOC são sinais, não metas de fragmentação. Quando um limite for
excedido, a revisão deve avaliar coesão, responsabilidades e testabilidade. Não
extraia wrappers sem significado apenas para reduzir números.

Até a automação:

- use as regras ESLint ad hoc registradas no baseline quando a mudança tocar um
  hotspot;
- não aumente complexidade, tamanho de função ou tamanho de arquivo acima do
  valor anterior;
- código novo deve respeitar 10/80/800;
- alteração substancial em hotspot deve reduzir pelo menos uma responsabilidade
  ou registrar plano explícito no `IMPLEMENTATION.md`.

## Matriz de testes por tipo de mudança

| Mudança                     | Evidência mínima                                                        |
| --------------------------- | ----------------------------------------------------------------------- |
| regra pura, data, validação | unit test RED/GREEN, typecheck e lint                                   |
| comando Dexie               | integração com fake-indexeddb, escopo guest e user quando aplicável     |
| auth/RLS                    | caso positivo, negativas entre usuários, pgTAP e integração             |
| sync/local-first            | offline, reload, retry, duplicação, conflito, reconexão e dois usuários |
| migration Dexie             | upgrade desde a versão afetada e preservação de escopos                 |
| migration Postgres          | reset limpo, lint, pgTAP, dry-run e compatibilidade de rollout          |
| componente                  | unit/component, teclado, loading, vazio, erro e i18n                    |
| fluxo visual                | E2E desktop e mobile, overflow e conteúdo longo                         |
| PWA                         | build, instalação/fallback e atualização sem perda local                |
| bugfix                      | teste que falha sem a correção e passa com ela                          |
| dependência                 | audit, lockfile revisado, gates completos e teste do caminho afetado    |

## Local-first

Mudança de persistência só é aprovada quando a evidência aplicável demonstra:

- commit local independe da rede;
- ação pendente sobrevive ao ciclo de vida prometido;
- retry não duplica efeito;
- ordem de operações é preservada;
- falha parcial não produz snapshot destrutivo;
- dois dispositivos convergem segundo regra documentada;
- usuário A não observa nem altera dados de B;
- guest não faz chamada remota de entidades;
- fila tem limite, backoff, estado visível e recuperação;
- conflitos e estado canônico têm contrato explícito.

Enquanto essas garantias não existirem, testes que apenas simulam `upsert`
direto não podem ser apresentados como prova de sincronização resiliente.

## Segurança e banco

Uma alteração bloqueia quando introduz vulnerabilidade crítica/alta de produção,
secret confirmado, bypass de autorização, perda de isolamento, migration não
reproduzível ou policy sem teste negativo.

Para banco, verificar constraints, foreign keys, índices das consultas críticas,
RLS, grants e comportamento de cascade. Rollout deve ser compatível com a
versão anterior e a nova da aplicação. Nenhuma migration de produção deve rodar
enquanto os gates obrigatórios do mesmo SHA estiverem pendentes ou falhando.

O fluxo-alvo é:

```text
PR/commit
  → quality gate
  → testes e segurança
  → banco e E2E quando aplicáveis
  → revisão
  → merge
  → confirmação dos gates do SHA de produção
  → migration
  → deploy
```

O workflow atual ainda não impõe toda essa ordem; a correção está no
`IMPLEMENTATION.md`.

## Trial, assinatura e migração guest

Quando implementados, devem existir testes para:

- guest limitado por regra centralizada;
- trial autenticado inicia uma vez e dura 7 dias segundo relógio do servidor;
- trial usa o mesmo armazenamento e sync do assinante;
- expiração remove entitlement sem apagar dados;
- assinatura ativa, cancelada, expirada e inadimplente;
- preço/moeda corretos por região a partir de configuração central;
- webhook duplicado ou fora de ordem é idempotente;
- frontend não concede entitlement sozinho;
- migração guest preserva ownership e é idempotente;
- retry e falha parcial não duplicam nem corrompem;
- usuário A nunca recebe dados migrados de B;
- sync converge depois da migração.

## Revisão visual

Para UI alterada, registrar viewport mobile e desktop e verificar:

- touch targets, foco e teclado;
- viewport pequeno, teclado virtual, scroll e overflow;
- conteúdo longo e zoom;
- loading, vazio, erro e indisponibilidade de rede;
- contraste, semântica e nome acessível;
- consistência com primitives, tokens e terminologia;
- ausência de bordas, caixas e cards aninhados sem função.

Screenshot isolado não substitui interação. Mudança visual relevante deve ter
evidência nos dois tamanhos; layout mobile próprio exige testes dos dois
desenhos.

## Manutenção de dependências

1. Detectar advisory ou versão nova.
2. Classificar produção/desenvolvimento, severidade e alcance real.
3. Criar alteração dedicada e nunca usar `--force` automaticamente.
4. Atualizar manifest/lockfile somente no escopo aprovado.
5. Executar audit e a matriz de testes afetada.
6. Fazer revisão independente do diff e changelog.

Patch/minor só pode ser candidato a auto-merge depois de todos os gates e sem
mudança comportamental relevante. Major exige revisão manual e plano de
migração. Atualizar Supabase CLI não autoriza gerar ou aplicar migration.

## Evidência de conclusão

Use este formato curto na entrega:

```text
Escopo:
Testes RED/GREEN:
Typecheck/lint/format/build:
Unit/integration:
Coverage e mutation:
Complexidade/tamanho:
Security audit:
Banco:
E2E:
Performance/local-first:
UI mobile/desktop/a11y:
Gates não executados e motivo:
Problemas preexistentes observados:
```

Não declare um gate aprovado sem executar o comando correspondente. Falha
preexistente deve ser evidenciada e não pode ser agravada pela alteração.
