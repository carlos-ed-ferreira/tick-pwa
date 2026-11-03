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

## Ratchet em 2026-08-20

- Vitest: 63 arquivos e 469 testes aprovados;
- persistência autenticada direcionada: 26 testes de outbox, migration Dexie e
  contrato transacional aprovados;
- outbox Dexie v16 registra entidade e operação funcional atomicamente, preserva
  o mesmo UUID em retry/reload, mantém ordem e divide lotes em no máximo 100;
- calendário, categorias e metas usam uma RPC lógica por transação local para a
  conta autorizada, sem dual-write; guest permanece sem rede;
- pgTAP: 74 testes aprovados, lint PostgreSQL sem erros e schema declarativo sem
  divergência;
- audit de produção: 0 vulnerabilidades;
- Playwright local: 24 cenários aprovados em desktop e mobile, mais 7 cenários
  exclusivos de layout mobile em `tests/e2e/mobile-layout.spec.ts`;
- Playwright autenticado: 4 cenários aprovados em desktop e mobile, incluindo
  retry automático da outbox após reconexão;
- Playwright offline: reload direto de calendário e metas aprovado em desktop e
  mobile com o shell funcional precacheado, inclusive URLs parametrizadas de
  dia e meta e dados preservados no IndexedDB;
- módulo novo da outbox com 547 linhas e funções novas limitadas a 80 linhas.

## Ratchet em 2026-08-25

- Vitest: 64 arquivos e 479 testes aprovados;
- pgTAP: 77 testes aprovados, incluindo retenção de recibos e bloqueio da purga
  direta pelo cliente autenticado;
- outbox autenticada com backoff exponencial de 1 s a 30 s, retomada agendada e
  cancelamento da espera na reconexão e no retry manual;
- fila durável limitada a 200 operações por conta, sem descartar a alteração
  local e mantendo a sincronização forçada como saída;
- rejeição `stale_revision` rebaseada uma vez pela revisão do servidor e
  reenviada com o mesmo `operation_id`; a segunda rejeição não rebaseia de novo;
- métricas locais de fila, tentativas, rejeições, conflitos e latência sem
  conteúdo do usuário;
- migration Dexie v17 preserva operações enfileiradas ao acrescentar
  `nextAttemptAt` e `rebasedAt`;
- App CI executa banco e E2E como jobs próprios, com paridade declarativa
  verificada por `make supabase-diff-check`; os três checks são obrigatórios na
  branch padrão desde 25 de agosto de 2026;
- o job de banco sobe apenas o container do Postgres, reduzindo a superfície que
  derrubou o servidor na primeira execução remota;
- reconciliação silenciosa: refresh sem mudança remota não escreve entidade nem
  preferência no IndexedDB, comprovado por espiões de `put` e `delete`;
- indicador de sincronização com atraso de 800 ms para estados transitórios,
  falha imediata e cobertura de fila crescente sem reiniciar a janela;
- Playwright local: 24 cenários aprovados; Playwright autenticado: 4 cenários.

## Ratchet em 2026-08-28

- a outbox própria passou a ser a única estratégia autenticada do produto;
- um teste arquitetural impede reintroduzir pacote, runtime, rota, flags,
  configuração ou objetos declarativos do POC PowerSync;
- o pacote direto `@powersync/web` e seis pacotes transitivos foram removidos;
- banco limpo aplica a migration de retirada das funções, tabelas e publicação
  isoladas e gera tipos sem os objetos descartados;
- Vitest: 75 arquivos e 548 testes aprovados depois da retirada dos testes
  exclusivos da alternativa rejeitada;
- a redução intencional do pgTAP remove 31 asserções exclusivas do POC e
  preserva 50 testes; os contratos funcionais e negativos da outbox permanecem
  obrigatórios.

## Ratchet em 2026-08-31

- Vitest: 77 arquivos e 552 testes aprovados;
- `stale_revision` terminal não é reaberto pela retomada automática, com retry
  explícito preservado e limite de tentativas aplicado a todo estado da outbox;
- adapter de telemetria com captura exclusivamente manual e allowlist testada
  contra tarefa, categoria, e-mail, token, payload e identificador de usuário;
- `@sentry/browser` 10.72.0 isolado em chunk dinâmico, licença MIT e audit de
  produção sem vulnerabilidades;
- cifra AES-256-GCM do backup lógico aprovada por round-trip e rejeição de chave
  incorreta;
- Playwright local: 33 cenários aprovados e 7 cenários desktop intencionalmente
  ignorados por serem exclusivos de mobile; Playwright autenticado: 4 cenários;
- restore real e alertas do fornecedor permanecem evidências externas e não são
  considerados aprovados pelo gate local.

## Ratchet em 2026-09-14

- Vitest: 79 arquivos e 565 testes aprovados;
- workflow de produção ordena migrations antes do Deploy Hook e bloqueia o
  disparo quando a `main` já avançou para outro SHA;
- auditoria horária falha quando o histórico remoto de migrations diverge do
  repositório e usa o mesmo aviso operacional do pipeline;
- `make publish` só arma o auto-merge depois dos checks obrigatórios;
- configuração do hook e comprovação do primeiro deploy continuam externas.

## Ratchet em 2026-09-22

- Vitest: 79 arquivos e 577 testes aprovados;
- Playwright local: 33 testes aprovados e 7 ignorados;
- marcador de seleção usa o primitive de checkbox compartilhado, com o mesmo
  desenho e estado do checkbox de conclusão;
- edição inline preserva os caracteres digitados enquanto a própria gravação
  está em voo, e continua adotando alterações remotas quando não há rascunho
  local;
- exclusão em árvore deriva a subárvore por `parentId`, não por profundidade
  visual da lista renderizada;
- seleção preserva o estado anterior ao alternar itens e não é oferecida em
  linhas que ainda são rascunho no checklist e nas metas;
- snapshot remoto pagina por chave imutável, deduplica refreshes simultâneos do
  mesmo escopo e captura o conjunto protegido dentro da transação de merge;
- hover da scrollbar deixa de usar a cor de acento.

## Ratchet em 2026-09-22 (composição de toque)

- Vitest: 82 arquivos e 630 testes aprovados;
- Playwright local: 39 aprovados e 17 ignorados, com a baseline de layout mobile
  de 7 para 15 cenários;
- a composição de toque é escolhida por
  `(pointer: coarse) and (max-width: 899.98px)`, com fonte única em
  `src/hooks/use-touch-composition.ts` e variante `touch` no `globals.css`;
  nenhum utilitário base foi alterado, então o desenho de 640px para cima
  permanece idêntico;
- calendário de toque usa faixa de semana e agenda do dia, com a grade do mês em
  folha inferior e sem consulta nova ao Dexie;
- linha de tarefa e de etapa em toque expõe todas as ações por folha inferior,
  com hora e data dentro dela;
- `Dialog` ganhou `size`, focus trap, `aria-labelledby`, pilha de `Escape` e
  contador de bloqueio de rolagem; `ConfirmationDialog` deixou de ocupar a tela
  inteira no toque;
- navegação de toque é a mesma lista do cabeçalho reposicionada no rodapé, com
  reserva de espaço por `--app-bottom-nav-height` e safe area;
- submenu de categoria das metas passou a ser clampado na viewport;
- removidos a classe morta `.calendar-chip-muted` e a chave morta
  `calendar.emptyDay`.

## Ratchet em 2026-09-23

- `next` 16.3.0 para 16.3.6, corrigindo duas execuções remotas de código
  classificadas como críticas; `sharp` acompanhou para 0.35.4;
- `baseline-browser-mapping` atualizado para 2.11.25 dentro do intervalo já
  declarado;
- `browserslist` fixado em 4.29.0 por `overrides`, porque `@serwist/next` fixa
  a versão exata e nem a 9.5.12 sai do intervalo vulnerável; a exposição real é
  de build, não de runtime, mas o gate não aceita advisory alto;
- `make update-dependency package=<pacote>` passa a cobrir atualização de
  dependência transitiva dentro do intervalo declarado;
- `make audit-prod` volta a reportar zero vulnerabilidades.

## Ratchet em 2026-09-23, composição de toque da árvore

- na composição de toque, o texto da tarefa ocupa uma linha própria abaixo dos
  controles, por `touch:flex-wrap` na linha e `touch:order-last`
  `touch:basis-full` no campo de texto;
- `touch:w-full` não resolve o caso: com `flex-1` o tamanho hipotético do item
  é `flex-basis: 0%`, então ele cabe na linha e só depois estica; a quebra exige
  `basis-full`;
- Playwright local: 41 testes aprovados e 19 ignorados, com build novo;
- o gate E2E deixou de reaproveitar servidor em execução: `reuseExistingServer`
  passou a exigir `TICK_E2E_REUSE_SERVER=1`, de modo que `make test-e2e`
  reconstrói a aplicação e produz o mesmo resultado local e no CI;
- `make test-e2e-reuse` cobre a iteração rápida e está marcado como não válido
  para evidência;
- `make test-e2e` falha com mensagem própria quando a porta 3100 já está
  ocupada, em vez de testar um build antigo;
- cobertura geométrica nos dois sentidos: o campo ocupa mais de 85% da linha em
  toque e menos de 85% em ponteiro fino.

## Validação em aparelho físico em 2026-10-18

- o desenvolvedor aprovou o ensaio da interface de toque em Android e iOS
  físicos, encerrando o passo 9 do plano de implementação;
- mudanças futuras em composição de toque, teclado virtual, safe area ou
  arrasto por toque devem repetir o roteiro do passo 8 do runbook externo.

## Validação de manutenção em 2026-11-02

- `make check`: tipos, lint, 636 testes aprovados, um teste Docker opt-in
  ignorado, formatação e build Next 16.4.4/PWA aprovados.
- `make audit-prod`: zero vulnerabilidades; `make audit-all`: zero altas ou
  críticas, 16 moderadas na cadeia minimatch de desenvolvimento.
- `make test-e2e-account-container`: quatro testes aprovados, incluindo
  interação com Supabase lento e retry após reconexão em desktop e mobile.
- `make test-release-workflow`: cinco testes aprovados, incluindo configuração
  do mirror GHCR para backup e desativação de auto-deploy Git somente na main.
- `make test-backup-restore`: restauração sintética Docker aprovada com Auth,
  Storage e schema Tick completos.
- Banco isolado: reset, lint, diff declarativo e 50 testes pgTAP aprovados;
  nenhum reset do banco de trabalho ou de produção.
- `make test-e2e-container`: 41 aprovados e 19 ignorados, com build novo,
  incluindo reload offline. Não exigiu instalar bibliotecas no host com sudo.
- Restore real em Linux e limpeza aprovados pelo proprietário, sem exigência
  de segunda pessoa. Deploy ordenado e estabilidade do backup diário ainda
  dependem de publicação e observação externa.

Versões, licenças, overrides, limites e rollback estão no
[relatório de manutenção](docs/operations/dependency-maintenance-2026-11-02.md).

## Aceite operacional após publicação em 2026-11-02

O proprietário confirmou deploy completo e aceitou os workflows como funcionais.
A consulta de GitHub confirmou App CI `41535884511`, migrations/deploy
`41536456800` e auditoria `41537177311` aprovados no SHA `ce9e7d1`.
Migrations terminaram antes do acionamento do hook. O backup previamente
restaurado foi aceito sem aguardar nova série. Não houve novo ensaio de falhas
ou rollback nem consulta independente ao painel Vercel nesta rodada.
[Registro e limites](docs/operations/deploy-hook-setup.md).

## Implementação do plano em 2026-11-02

- Guest completo e contas por convite: `make test-access-policy`, 47 testes,
  incluindo 205 itens locais, reabertura e edição após avanço de dez anos,
  sem inicializar persistência remota.
- Metas: extração de cards, menus, cabeçalhos, etapas, drafts e hook de arrasto;
  módulo principal de 4.357 para 467 linhas físicas, todos os módulos da área
  abaixo de 800. A suíte original de 74 casos foi preservada em arquivos por
  contexto, com fixtures compartilhadas.
- `make test-capacity`: 10 testes de limites, percentis, falhas e comparação;
  RED antes das implementações de estatística e regressão, GREEN depois.
- `make benchmark-cohort`: 5.000 etapas, profundidade 20, quatro workers,
  30 requisições por lote, zero erros/timeouts, replay idempotente e conflito
  retornando PT409. Snapshots e limpeza concluídos; baseline preservado.
- Banco isolado: reset, lint, diff e 50 testes pgTAP aprovados. A migration
  gerada por diff corrige o retry indefinido de conflitos 40001 no PostgREST,
  reproduzido pelo benchmark HTTP antes da correção.
- `make test-e2e-container`: 43 aprovados e 19 ignorados, incluindo reabertura
  de página guest sem requisições remotas de entidades e reload offline.

O baseline local é diagnóstico opcional; não comprova capacidade remota.
O proprietário definiu um usuário, três dispositivos e teto conservador de
20 convidados, sem budgets estatísticos ou aprovação adicional de carga.
Detalhes em
[cohort-capacity.md](docs/operations/cohort-capacity.md).

Gates finais desta implementação: `make check` com 648 testes aprovados e um
restore Docker opt-in ignorado; `make test-e2e-account-container` com quatro
casos aprovados; `make test-backup-restore` aprovado; `make audit-prod` com zero
vulnerabilidades. O build padrão foi refeito após os builds especiais de E2E.
Não houve alteração visual de composição; não foi solicitado repetir o ensaio
em aparelhos físicos. O SQL foi aplicado somente no projeto local isolado.

## Publicação em 2026-11-03

- `b3ddc8f` publicou a extração das metas, a política guest/convidados, os
  benchmarks opcionais e a migration `20261103001239_avoid_rpc_conflict_retries.sql`;
- App CI `41555806499` aprovado na `main`; pipeline `41556272686` com
  `Confirm quality gate`, `Apply production migrations` concluído às
  00:56:44Z e `Deploy production application` iniciado às 00:56:48Z;
- a Vercel mostrou um único deployment de Production `Ready` para o SHA,
  disparado pelo Deploy Hook;
- a primeira execução agendada do backup com GHCR ainda não havia ocorrido;
  a verificação está nas pendências abertas do plano de implementação.

## Matriz de quality gates

| Gate               | Métrica e threshold                                                                 | Escopo                              | Estado         | Legado                                          | Bloqueia?                                        |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------- | -------------- | ----------------------------------------------- | ------------------------------------------------ |
| TypeScript         | 0 erros em `make typecheck`                                                         | TS/TSX                              | enforced       | todo o código                                   | sim                                              |
| Comentários e lint | 0 comentários proibidos e 0 erros em `make lint`                                    | código, teste, CSS e SQL suportados | enforced       | exceções geradas configuradas                   | sim                                              |
| Formatação         | 0 diferenças em `make format-check`                                                 | arquivos suportados                 | enforced       | todo o código                                   | sim                                              |
| Unit/integration   | 100% dos testes Vitest aprovados                                                    | suíte existente                     | enforced       | sem redução de testes válida sem revisão        | sim                                              |
| Build              | exit 0 em `make build`                                                              | aplicação e PWA                     | enforced       | todo o código                                   | sim                                              |
| E2E local          | 100% aprovados em desktop e mobile                                                  | fluxos Playwright existentes        | enforced no CI | manter baseline de 24                           | sim quando aplicável                             |
| E2E autenticado    | 100% aprovados em desktop e mobile                                                  | fluxo de latência simulado          | enforced no CI | manter baseline de 4                            | sim para auth/sync                               |
| Schema lint        | 0 erros                                                                             | Postgres local                      | enforced no CI | sem regressão                                   | sim para banco                                   |
| pgTAP              | 100% aprovados                                                                      | `supabase/tests`                    | enforced no CI | manter ao menos 50; remoção exige revisão       | sim para banco                                   |
| Banco limpo        | reset, migrations e seed com exit 0                                                 | todas as migrations                 | enforced no CI | compatibilidade obrigatória                     | sim para banco                                   |
| Schema declarativo | 0 divergências em `make supabase-diff-check`                                        | `supabase/schemas` e migrations     | enforced no CI | sem divergência                                 | sim para banco                                   |
| Dependency audit   | 0 críticas e 0 altas em `make audit-prod`                                           | dependências de produção            | enforced no CI | baseline reduzido a zero                        | sim para dependência/deploy                      |
| Line coverage      | baseline inicial sem queda; objetivo global 80%; diff 90%                           | código não gerado                   | planned        | ratchet global                                  | sim após automação                               |
| Branch coverage    | baseline inicial sem queda; objetivo global 70%; diff 80%                           | código não gerado                   | planned        | ratchet global                                  | sim após automação                               |
| Mutation testing   | score não cai; objetivo 70% em domínio/persistência                                 | módulos críticos alterados          | planned        | baseline por módulo                             | sim após automação                               |
| Complexidade       | nova função ≤10; função legada alterada não aumenta e deve caminhar a ≤10           | funções alteradas                   | planned        | máximo atual 60                                 | sim após automação                               |
| Tamanho de função  | nova função ≤80 linhas lógicas; legado alterado não aumenta                         | funções alteradas                   | planned        | máximo atual 749                                | sim após automação                               |
| Tamanho de módulo  | novo módulo ≤800 linhas lógicas; hotspot alterado não aumenta sem plano de extração | módulos alterados                   | planned        | 5 hotspots, máximo 1.631 linhas não vazias      | sim após automação                               |
| Arquitetura        | 0 ciclos novos e 0 imports proibidos                                                | `src`                               | planned        | baseline a medir                                | sim após automação                               |
| SAST e secrets     | 0 achados críticos/altos novos e 0 secret confirmado                                | repositório e diff                  | planned        | baseline por finding                            | sim                                              |
| Acessibilidade     | 0 violação crítica/séria nova; teclado e nome acessível                             | UI alterada                         | manual/planned | baseline a medir                                | sim quando aplicável                             |
| Performance        | Interface utilizável durante sync; investigar lentidão observada sem perda de dados | uso real e caminho alterado         | manual         | otimização proporcional, sem budget obrigatório | sim para perda de dados ou bloqueio da interação |
| Local-first        | nenhum dado perdido; retry idempotente; reconexão converge                          | persistência alterada               | manual/planned | limitações no plano de implementação            | sim quando aplicável                             |
| i18n               | tipos válidos e chaves pt/en presentes; 0 string nova fora do mecanismo             | UI alterada                         | manual         | shape tipado já existe                          | sim quando aplicável                             |
| UI responsiva      | cenários mobile e desktop aprovados                                                 | UI alterada                         | enforced no CI | manter baseline de 15 no layout mobile          | sim quando aplicável                             |

`make check` é o gate local. O App CI acrescenta `make audit-prod`, o job de
banco e o job de E2E. Coverage, segurança, complexidade e performance continuam
fora de qualquer gate automatizado.

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
  ou registrar plano explícito em `docs/planning/implementation-plan.md`.

## Matriz de testes por tipo de mudança

| Mudança                     | Evidência mínima                                                         |
| --------------------------- | ------------------------------------------------------------------------ |
| regra pura, data, validação | unit test RED/GREEN, typecheck e lint                                    |
| comando Dexie               | integração com fake-indexeddb, escopo guest e user quando aplicável      |
| auth/RLS                    | caso positivo, negativas entre usuários, pgTAP e integração              |
| sync/local-first            | offline, reload, retry, duplicação, conflito, reconexão e dois usuários  |
| migration Dexie             | upgrade desde a versão afetada e preservação de escopos                  |
| migration Postgres          | reset limpo, lint, pgTAP, dry-run e compatibilidade de rollout           |
| componente                  | unit/component, teclado, loading, vazio, erro e i18n                     |
| fluxo visual                | E2E desktop e mobile, overflow e conteúdo longo                          |
| adaptação mobile            | `make test-e2e-mobile`, área de toque, toque em vez de hover e densidade |
| PWA                         | build, instalação/fallback e atualização sem perda local                 |
| bugfix                      | teste que falha sem a correção e passa com ela                           |
| dependência                 | audit, lockfile revisado, gates completos e teste do caminho afetado     |

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

O fluxo de produção é:

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

O ruleset da `main`, o workflow `supabase-migrations.yml` e o Deploy Hook
impõem essa ordem para o mesmo SHA desde 2026-11-02; a Vercel não publica a
`main` pela integração Git. A revisão humana continua sendo responsabilidade
do proprietário antes do merge.

## Guest completo e contas convidadas

Nas mudanças desses fluxos, validar:

- guest oferece as funcionalidades de organização sem prazo ou limite de produto;
- fechar/reabrir o app preserva os dados guest no IndexedDB;
- guest funciona offline e não envia entidades ao Supabase;
- autenticação remota exige conta autorizada pela allowlist;
- usuário não autorizado e tentativas de ownership cruzado são rejeitados;
- alternância guest/conta e troca entre contas não misturam dados;
- login não importa dados guest nem altera sua origem;
- operações da conta usam outbox durável, retry idempotente e reconexão;
- ausência de rede não apaga trabalho nem vira negativa remota definitiva.

## Diretriz de desempenho

O uso real orienta ajustes, sem otimização compulsiva ou regressão estatística
obrigatória de 10%. Manter decisões simples e eficientes. A sincronização pode
ocorrer em segundo plano por cerca de 20 segundos, preservando interação e
alterações locais. Acima disso, investigar a experiência observada; não alterar
timeouts, apagar dados ou descartar a fila por essa referência. Os gates de
correção, segurança, isolamento e integridade continuam obrigatórios.
Acompanhamento de quotas é manual pelo proprietário, sem nova automação exigida.

## Revisão visual

Para UI alterada, registrar viewport mobile e desktop e verificar:

- desenho desktop inalterado de 640px para cima;
- touch targets de 44px em ponteiro grosso, por área de acerto;
- caminho de toque equivalente para toda interação de arrasto;
- foco e teclado;
- viewport pequeno, teclado virtual, scroll e overflow;
- conteúdo longo e zoom;
- loading, vazio, erro e indisponibilidade de rede;
- contraste, semântica e nome acessível;
- consistência com primitives, tokens e terminologia;
- ausência de bordas, caixas e cards aninhados sem função;
- composição de toque própria validada nos dois desenhos, sem alterar o desktop.

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
E2E mobile:
Performance/local-first:
UI mobile/desktop/a11y:
Gates não executados e motivo:
Problemas preexistentes observados:
```

Não declare um gate aprovado sem executar o comando correspondente. Falha
preexistente deve ser evidenciada e não pode ser agravada pela alteração.
