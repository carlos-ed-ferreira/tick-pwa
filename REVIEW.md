# REVIEW.md

## Propósito

Este documento define os gates e o processo de revisão vigentes. Resultados
específicos de execução são entregues na tarefa ou revisão correspondente;
este arquivo não mantém histórico de execuções, releases ou aceites.

Os estados abaixo descrevem o processo atual: `enforced` identifica automação
existente; `manual` identifica verificação humana exigida conforme o alcance.
O [arquivo temporário de trabalho](docs/planning/PENDENCIAS.md) concentra
os objetivos de automação e as correções ainda não executadas.

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

## Matriz de quality gates atuais

| Gate                    | Critério                                                                                  | Execução atual                                                        | Alcance                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| TypeScript              | Zero erros                                                                                | `make typecheck`, enforced                                            | TS/TSX                                        |
| Comentários e lint      | Zero comentários proibidos e erros                                                        | `make lint`, enforced                                                 | Código, testes, CSS e SQL suportados          |
| Formatação              | Zero diferenças                                                                           | `make format-check`, enforced                                         | Arquivos suportados                           |
| Unit/integration        | Todos os testes aprovados; skips justificados                                             | `make test`, enforced                                                 | Suíte existente                               |
| Build                   | Exit status zero                                                                          | `make build`, enforced                                                | Aplicação e PWA                               |
| Dependency audit        | Zero vulnerabilidades altas ou críticas de produção                                       | `make audit-prod`, enforced no CI                                     | Dependências e deploy                         |
| E2E local               | Cenários desktop e mobile aprovados; manter ao menos 24                                   | `make test-e2e`, enforced no CI                                       | Fluxos do navegador                           |
| E2E autenticado         | Conta com latência simulada e API real isolada aprovadas; manter ao menos 6               | `make test-e2e-account` e `make test-account-browser`, enforced no CI | Auth e sincronização                          |
| Banco limpo             | Migrations e seed reproduzíveis                                                           | `make supabase-reset`, enforced no CI                                 | Banco local isolado                           |
| Schema lint             | Zero erros                                                                                | `make supabase-lint`, enforced no CI                                  | Postgres                                      |
| Schema declarativo      | Zero divergências                                                                         | `make supabase-diff-check`, enforced no CI                            | Schema e migrations                           |
| pgTAP                   | Todos aprovados; manter ao menos 55, remoção exige revisão                                | `make supabase-test-db`, enforced no CI                               | Contratos e autorização                       |
| Estrutura e arquitetura | Ratchet, complexidade ≤10, função ≤80, módulo ≤800, sem ciclos novos ou imports proibidos | `make quality-check`, enforced no CI                                  | TS/TSX de `src`, exceto tipos gerados         |
| Coverage                | Sem queda global; diff ≥90% linhas e ≥80% branches                                        | `make test-coverage`, `make coverage-check`, enforced no CI           | Código de `src` suportado pelo V8             |
| Mutation                | Sem queda por módulo/global e ≥70%                                                        | `make test-mutation`, enforced no CI                                  | Módulos críticos definidos no Stryker         |
| Segurança               | Sem secret confirmado, bypass ou vulnerabilidade nova crítica/alta                        | `make check-secrets`, CodeQL e revisão manual                         | Diff, auth e dados                            |
| Local-first autenticado | Preservação local, recuperação e reconexão                                                | Testes existentes e revisão manual                                    | Persistência da conta                         |
| Guest                   | Persistência exclusivamente local e isolamento                                            | `make test-access-policy` e revisão manual                            | Uso sem conta                                 |
| i18n                    | Tipos e paridade pt-BR/en; strings pelo dicionário                                        | Typecheck e revisão manual                                            | UI alterada                                   |
| UI responsiva           | Cenários mobile e desktop aprovados; manter ao menos 15 de layout mobile                  | `make test-e2e-mobile` e revisão visual                               | UI alterada                                   |
| Acessibilidade          | Sem violação crítica/séria no axe; teclado, foco e nome acessível                         | Axe no E2E local e revisão manual                                     | Calendário/metas desktop/mobile e UI alterada |
| Performance             | Interface utilizável e dados preservados durante sync                                     | Observação manual e testes do caminho                                 | Uso real                                      |

`make check` executa typecheck, lint, Vitest, formatação e build. O App CI
acrescenta cobertura, mutação, estrutura/arquitetura, auditoria, SAST/secrets,
banco e E2E. Esses gates não dispensam revisão manual dos contratos.

Os baselines revisáveis estão em `docs/operations/baselines/`. Cobertura V8
inclui `src`, exceto tipos Supabase e service worker; seus objetivos globais
são 80% de linhas e 70% de branches. Enquanto abaixo deles, o piso medido não
pode cair. O diff usa o SHA base do PR/push e, localmente, `HEAD`, incluindo
arquivos novos. `COVERAGE_BASE_REF` permite outro ponto de comparação.

Stryker mede conclusão de tarefas, metadados de persistência e proteção de
snapshot. Seu baseline preserva o escopo e o score de cada módulo. Não remover
módulos ou mutantes para obter aprovação. Ampliação exige medir e revisar o
novo piso. `make coverage-baseline`, `make mutation-baseline` e
`make quality-baseline ref=<sha>` gravam evidência para revisão; o CI nunca
regrava baseline automaticamente nem autoriza reduzir limites.

Gitleaks varre o histórico Git com redação integral; `.gitleaksignore` contém
somente o fingerprint do JWT sintético sem assinatura válida do fixture de
Playwright. Nova exceção exige comprovação de falso positivo. CodeQL executa
`security-extended` no job de segurança, produz SARIF local ao runner e bloqueia
severity de segurança ≥7. O gate resolve a regra de cada achado no `driver` e
nos pacotes de consultas em `tool.extensions`, formato agrupado que o CodeQL do
Actions produz, e lista todos os achados altos com regra, arquivo e linha, sem
trecho de código. Em pull request, o CodeQL analisa só as linhas alteradas; no
push para a `main`, analisa o repositório inteiro e pode reprovar achados
antigos que o PR não mostrou. Relatório ausente/inválido ou achado sem regra reprova. Não há upload de
SARIF habilitado. `make check-sast` exige `.next/codeql` previamente produzido;
o scanner completo é executado no Actions.

## Thresholds estruturais

Complexidade e LOC são sinais, não metas de fragmentação. Quando um limite for
excedido, a revisão deve avaliar coesão, responsabilidades e testabilidade. Não
extraia wrappers sem significado apenas para reduzir números.

A análise usa AST TypeScript, linhas não vazias e decisões por função, sem
contar decisões de funções filhas na função pai. O grafo inclui imports e
reexports estáticos resolvidos por caminhos relativos e alias `@/`. A fronteira
de domínio rejeita UI, Dexie e Supabase; imports dinâmicos exigem revisão manual.

- medir antes/depois quando a mudança tocar um hotspot;
- não aumente complexidade, tamanho de função ou tamanho de arquivo acima do
  valor anterior;
- código novo: complexidade por função ≤10, função ≤80 linhas lógicas e
  módulo ≤800 linhas lógicas;
- alteração substancial em hotspot deve reduzir pelo menos uma responsabilidade
  ou registrar o recorte no arquivo temporário de trabalho.

## Matriz de testes por tipo de mudança

| Mudança                     | Evidência mínima                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| documentação e skills       | `make check-docs`, formatação, links/âncoras, recursos e espelhos válidos; secrets quando aplicável; sem suíte do app se não houver mudança funcional |
| regra pura, data, validação | unit test RED/GREEN, typecheck e lint                                                                                                                 |
| comando Dexie               | integração com fake-indexeddb, escopo guest e user quando aplicável                                                                                   |
| auth/RLS                    | caso positivo, negativas entre usuários, pgTAP e integração                                                                                           |
| sync/local-first            | offline, reload, retry, duplicação, conflito, reconexão e dois usuários                                                                               |
| migration Dexie             | upgrade desde a versão afetada e preservação de escopos                                                                                               |
| migration Postgres          | reset limpo, lint, pgTAP, dry-run e compatibilidade de rollout                                                                                        |
| componente                  | unit/component, teclado, loading, vazio, erro e i18n                                                                                                  |
| fluxo visual                | E2E desktop e mobile, overflow e conteúdo longo, uma vez ao concluir                                                                                  |
| ajuste puramente visual     | testes existentes ajustados e `make check`; E2E se mudar layout                                                                                       |
| adaptação mobile            | `make test-e2e-mobile`, área de toque, toque em vez de hover e densidade                                                                              |
| PWA                         | build, instalação/fallback e atualização sem perda local                                                                                              |
| bugfix                      | teste que falha sem a correção e passa com ela                                                                                                        |
| dependência                 | audit, lockfile revisado, gates completos e teste do caminho afetado                                                                                  |

## Local-first da conta autenticada

Local-first significa continuar usando os dados da conta ao perder a internet,
confirmar alterações localmente e recuperá-las na reconexão. Uso sem conta é
guest e tem validação própria; não comprova o funcionamento da conta offline.

Mudança de persistência só é aprovada quando a evidência aplicável demonstra:

- commit local independe da rede;
- ação pendente sobrevive ao ciclo de vida prometido;
- retry não duplica efeito;
- ordem de operações é preservada;
- falha parcial não produz snapshot destrutivo;
- dois dispositivos convergem segundo regra documentada;
- usuário A não observa nem altera dados de B;
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

A publicação exige solicitação explícita por `workflow_dispatch` e App CI
completo aprovado para o SHA solicitado, igual ao SHA do run e à ponta de
`main`, incluindo segurança. Merge e conclusão do CI não autorizam deploy. O preflight verifica Vercel antes
das migrations; histórico remoto é conferido em toda publicação. A API publica
SHA explícito e só aprova o job depois de conferir identidade, `READY` e smoke.
O domínio canônico e os fluxos de conta continuam com verificação funcional
conforme o [runbook](docs/operations/PUBLICACAO.md). Falha após migration não
desfaz banco; compatibilidade com a aplicação anterior é obrigatória.

## Guest completo e contas convidadas

Nas mudanças desses fluxos, validar:

- guest oferece as funcionalidades de organização sem prazo ou limite de produto;
- fechar/reabrir o app preserva os dados guest no IndexedDB;
- guest funciona offline e não envia entidades ao Supabase;
- autenticação remota exige conta autorizada pela allowlist;
- usuário não autorizado e tentativas de ownership cruzado são rejeitados;
- alternância guest/conta e troca entre contas não misturam dados;
- login não importa dados guest nem altera sua origem;
- contas habilitadas para lotes preservam outbox durável, retry e reconexão;
- contas fora da coorte são avaliadas pelo contrato legado efetivamente usado;
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

A fonte dos padrões de desenho e implementação é a [skill de frontend](.agents/skills/frontend-design/SKILL.md), com [padrões visuais](.agents/skills/frontend-design/references/PADROES-VISUAIS.md) e [mapa de telas](.agents/skills/frontend-design/references/MAPA-DE-TELAS.md). Esta seção define a evidência de aprovação, sem duplicar o procedimento da skill.

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

Auditorias devem distinguir observação no navegador, reprodução com fixtures e inspeção estática. Estados não observados precisam ser explicitados; divergências fora do escopo entram em PENDENCIAS. Uma auditoria pode produzir achados sem alterar a UI, e sua execução não equivale à aprovação visual do aplicativo.

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
