# Pendências temporárias do Tick

## Natureza e uso deste arquivo

**Este arquivo é temporário.** Centraliza as pendências reais de implementação,
investigação, revisão e validação identificadas no projeto. Não descreve
funcionalidades prontas, não autoriza publicação e não substitui o README nem
os gates do REVIEW. Remover cada item depois de resolvido e atualizar somente
o comportamento resultante nos documentos permanentes. Quando não houver
itens abertos, remover este arquivo e suas referências.

Os demais Markdown descrevem o estado atual, regras vigentes e procedimentos
operacionais. Não devem acumular histórico de releases, aceites, incidentes,
resultados antigos de testes ou listas de trabalho futuro.

## Terminologia e limites

- **Local-first:** usuário autenticado perde a internet e continua usando os
  dados da conta neste dispositivo; alterações ficam locais e sincronizam na
  reconexão. Guest não comprova esse contrato.
- **Guest:** uso sem conta, com dados exclusivamente locais, isolados da conta.
- **Confirmado:** comportamento reproduzido ou identificado diretamente no
  código. **Investigação:** risco identificado que exige reprodução.
- **Validação:** capacidade implementada cuja comprovação específica falta.
- P1 prioriza integridade e publicação; P2 cobre completude e operação; P3
  cobre manutenção incremental. A ordem não autoriza ignorar gates.

O escopo permanece uma pessoa em três dispositivos e teto de 20 convidados,
com GitHub Free, Vercel Hobby e Supabase Free. Não são pendências: abrir
cadastro, migrar guest para conta, adotar PowerSync, mudar hospedagem, exigir
segunda pessoa para restore, criar budgets de carga ou monitoramento automático
de quotas. O acompanhamento de recursos é manual.

## Local-first da conta autenticada

### LF-01 — Proteger escritas confirmadas durante refresh

**P1 · bug confirmado.** Origem: auditoria de persistência;
`src/lib/supabase/account-cache.ts`, funções `readAccountSnapshotIntoCache` e
`mergeRemoteRows`.

Reprodução sintética executada na auditoria: iniciar refresh com snapshots
vazios, atrasar a resposta de `goal_steps`, criar meta por `createGoal`,
confirmar a RPC e verificar `syncStatus: synced`; liberar a resposta atrasada.
Depois do refresh, `db.goals.get(goal.id)` retornou `undefined`. A meta foi
removida do cache local; não foi demonstrada exclusão no Supabase. O teste
diagnóstico temporário foi retirado depois do registro; os outros 46 testes
de persistência passaram.

- [ ] Reintroduzir essa reprodução como teste de regressão em RED.
- [ ] Proteger entidades criadas ou confirmadas após o início da leitura.
- [ ] Reproduzir também atualização confirmada durante pull, resposta com revisão
      inferior e exclusões concorrentes; o merge atual aceita revisões diferentes.
- [ ] Validar rede lenta, reconexão e edição contínua sem sumiço ou sobrescrita.

### LF-02 — Tornar preferências da conta recuperáveis offline

**P1 · lacuna confirmada.** Origem: `src/lib/db/scoped-preferences.ts` e
`src/lib/supabase/account-preferences.ts`.

Preferências confirmam localmente, mas fila e marcador pendente ficam em
memória. Uma falha pode restaurar o valor remoto; depois de reload, um refresh
não reconhece a alteração local como pendente. `user_preferences` não participa
da outbox das seis entidades funcionais.

- [ ] Preservar intenção local e estado pendente durável na conta.
- [ ] Implementar retry, proteção durante refresh e feedback recuperável.
- [ ] Cobrir offline, reload, fechamento, reconexão, concorrência e dois usuários.

### LF-03 — Completar o rollout da outbox e retirar o legado

**P2 · implementação e rollout controlado.** Origem: antigo plano, passos 1–3;
`src/lib/environment.ts` e `src/lib/db/account-persistence.ts`.

Somente UUIDs habilitados pelas flags usam outbox durável para calendário,
categorias e metas. As demais contas usam `upsert` e fila em memória, com
restauração canônica em determinadas falhas.

- [ ] Conferir flags e UUIDs efetivos em cada build/dispositivo autorizado.
- [ ] Cumprir os ensaios de conta, navegadores e integridade antes de ampliar.
- [ ] Definir transição preservando alterações locais e operações existentes.
- [ ] Retirar o legado após aprovação do rollout, sem dual-write nem sync paralelo.

### LF-04 — Coordenar sincronização forçada e drenagem automática

**P1 · investigação.** Origem: `src/lib/db/account-sync.ts`,
`account-persistence.ts` e `account-operation-outbox.ts`.

O push manual usa a fila de persistência; a drenagem tem fila própria e Web
Lock. O push manual não adquire esse lock. Não foi comprovada perda de dados
nesse cenário.

- [ ] Reproduzir push manual, dreno e edição simultâneos, inclusive entre abas.
- [ ] Verificar revisões, ordem, exclusão de operações substituídas e resposta perdida.
- [ ] Corrigir a coordenação se a reprodução demonstrar violação do contrato.

### LF-05 — Completar os ensaios integrados de conta sem rede

**P2 · validação.** Origem: antigo plano, passo 2. O E2E autenticado atual usa
Supabase simulado; o benchmark de RPC real não testa toda a outbox no navegador.

- [ ] Exercitar duas sessões/dispositivos com API real isolada, concorrência
      simultânea, conflito, revogação e isolamento entre dois usuários.
- [ ] Validar fechamento completo com operação pendente, reabertura offline e
      retomada automática; distinguir esse caso de simples reload com mocks.
- [ ] Exercitar atualização real da PWA/service worker com operações pendentes.
- [ ] Verificar resposta perdida e replay após retenção de recibos, documentando
      a janela de idempotência de sete dias sem prometer retenção infinita.
- [ ] Cobrir sessão expirada e grant local expirado: hoje a reabertura offline
      exige sessão disponível e grant positivo da mesma conta com até 24 horas.
      Avaliar qualquer mudança desse contrato sem enfraquecer autorização remota.

## Publicação e recuperação

### DEP-01 — Conferir migrations pendentes antes de todo deploy

**P1 · lacuna confirmada por inspeção.** Origem:
`.github/workflows/supabase-migrations.yml`, `Detect database changes`.

O workflow compara apenas `HEAD^ HEAD`. Uma release com migration que falha
ou não executa pode ser seguida de commit só de aplicação; o próximo pipeline
pode pular o banco. A auditoria horária não é dependência do deploy.

- [ ] Reproduzir a sequência de duas releases com falha na primeira.
- [ ] Basear a decisão no histórico remoto e impedir publicação com migration pendente.
- [ ] Cobrir execução sem migration, retomada e execução manual.

### DEP-02 — Fixar o código publicado no SHA aprovado

**P1 · risco confirmado pela forma de disparo.** Origem: workflow de produção
e Deploy Hook da branch `main`.

A checagem de `main` acontece antes do POST; o hook não recebe o SHA aprovado.
Outro merge entre a consulta e a resolução da branch pode causar divergência.
A serialização do workflow não bloqueia merges.

- [ ] Adotar disparo fixado no SHA aprovado, compatível com os planos atuais.
- [ ] Testar avanço de branch, execução enfileirada e commit superado.
- [ ] Conferir o SHA efetivo do deployment e o ambiente Production.

### DEP-03 — Confirmar deployment e saúde da aplicação

**P1 · lacuna confirmada.** Origem: job `deploy-production`.

Qualquer `job.state` não vazio, inclusive `PENDING`, encerra o job com sucesso.
Falha posterior na Vercel não aciona o aviso desse workflow. A auditoria
horária compara migrations, não a versão servida pela aplicação.

- [ ] Aguardar estado terminal, com timeout recuperável e diagnóstico.
- [ ] Falhar e avisar em deployment rejeitado, cancelado ou sem confirmação.
- [ ] Executar smoke test e conferir SHA/ambiente antes de declarar publicação concluída.
- [ ] Validar pedido aceito cuja resposta se perde, evitando disparos cegos duplicados.

### DEP-04 — Aplicar os gates completos na execução manual

**P1 · lacuna confirmada.** Origem: `quality-gate` com `workflow_dispatch`.

O caminho manual executa `make check` e `make audit-prod`; não executa banco,
pgTAP ou E2E, nem exige evidência de todos os jobs do App CI daquele SHA.

- [ ] Exigir os três jobs aprovados do SHA ou executar os gates equivalentes.
- [ ] Testar recusa com gate ausente, pendente, cancelado ou falho.

### DEP-05 — Ensaiar interrupções, retomada e rollback

**P1 · validação.** Origem: antigo plano, passos 4–5, e runbooks de publicação.

- [ ] Ensaiar migration falha, interrupção após migration e antes do deploy,
      indisponibilidade do GitHub/Vercel e falha posterior ao aceite do hook.
- [ ] Validar rollback de aplicação e flag e migration compensatória em ambiente
      isolado, mantendo compatibilidade com aplicação anterior e PWAs abertas.
- [ ] Validar retomada do mesmo pipeline sem republicações desnecessárias.
- [ ] Exercitar interrupção de `make publish` antes/depois de armar auto-merge;
      preservar distinção entre merge confirmado e aplicação publicada.
- [ ] Verificar avisos de falha e auditoria após recuperação do GitHub. Automação
      hospedada nele não alerta durante indisponibilidade total da plataforma.

## Operação e compatibilidade

### OPS-01 — Comprovar regularidade do backup com GHCR

**P2 · validação.** Origem: antigo plano, passo 4, e runbooks de backup.

A consulta de 2026-11-03 confirmou o primeiro sucesso agendado com GHCR:
[run 41571538651](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41571538651),
SHA `e5a91cd`, dump/cifra/upload aprovados e artefato não expirado. Não houve
novo restore desse artefato na auditoria. O restore real em segunda máquina
já foi aprovado; isso não comprova regularidade diária.

- [ ] Registrar três execuções agendadas consecutivas bem-sucedidas com GHCR.
- [ ] Usar `make backup-status` e `make backup-log run=<id>` para classificar falhas.
- [ ] Se o limite de imagens persistir, avaliar cache ou outro registro.
- [ ] Conferir o RPO operacional aceito de 26 horas; o RTO aceito é de 30 minutos
      para restore isolado, não para recuperação completa da produção.

### OPS-02 — Validar sincronização em Safari macOS/iOS

**P2 · validação obrigatória antes de ampliar convidados.** Origem: antigo
plano, passo 2. O aceite de interface de toque em aparelhos físicos não prova
sincronização no Safari.

- [ ] Exercitar os cenários LF-05 em Safari macOS e iOS reais.
- [ ] Incluir IndexedDB, Web Locks/fallback, fechamento e PWA instalada.
- [ ] Registrar aparelho, sistema, navegador, rede, horário e resultado.
- [ ] Corrigir divergências com RED/GREEN antes de ampliar a coorte.

### OPS-03 — Reavaliar geolocalização no Sentry

**P2 · revisão antes de ampliar convidados.** Origem: runbooks de telemetria.
O fornecedor acrescenta `user.geo` na ingestão mesmo com armazenamento de IP
desabilitado e scrubbing de usuário. Avaliar privacidade e alternativas sem
assumir que um endpoint próprio é necessário ou autorizado.

## Banco e dependências

### DB-01 — Revisar índices de foreign keys e policies RLS

**P3 · revisão dedicada.** Origem: documento de incidente de WAL.
Avaliar índices das consultas reais e initplan das funções nas policies;
alterar somente com justificativa, schema declarativo, diff e testes negativos.
Esses pontos não foram estabelecidos como causa de indisponibilidade.

### MAINT-01 — Revisar o override major de glob

**P2 · revisão humana.** Origem: relatório de dependências.
`glob@13.0.6` é sobrescrito por `14.0.3` para o consumidor Serwist.
Registrar compatibilidade, justificativa e resultado da revisão; preservar
build PWA e testes offline sem atualização destrutiva automática.

### MAINT-02 — Reavaliar advisories moderados de desenvolvimento

**P3 · manutenção condicionada à auditoria atual.** Origem: relatório de
dependências, que registrava 16 moderadas na cadeia minimatch/ESLint.
Consultar `make audit-all`, confirmar o alcance e corrigir em mudança dedicada
quando houver solução compatível. Não impor minimatch incompatível nem aceitar
downgrade automático de ESLint para satisfazer a auditoria.

### MAINT-03 — Reduzir hotspots ao alterar suas responsabilidades

**P3 · incremental.** Origem: antigo plano e REVIEW.
Áreas: `src/lib/db/goal-commands.ts`, `src/lib/db/checklist-commands.ts`,
`src/features/checklist/checklist-surface.tsx`, `src/lib/db/database.ts` e
`src/components/app/task-tree-editable-row.tsx`.
Medir antes de modificar, preservar ratchet e extrair responsabilidades coesas;
não fragmentar por LOC nem repetir a extração de metas já implementada.

## Automação dos gates de engenharia

Estes itens vieram das linhas `planned` do REVIEW. Os gates atuais continuam
definidos nele; estes objetivos não são apresentados como automação existente.

| ID    | Prioridade | Trabalho e critério                                                                                                               |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| QA-01 | P3         | Coverage com baseline/ratchet: linhas globais 80%, diff 90%; branches globais 70%, diff 80%, sem queda de baseline.               |
| QA-02 | P3         | Mutation testing em domínio/persistência, baseline sem queda e objetivo de 70%.                                                   |
| QA-03 | P3         | Automatizar complexidade ≤10, função ≤80 linhas lógicas e módulo ≤800, preservando ratchet do legado sem fragmentação artificial. |
| QA-04 | P3         | Medir arquitetura e bloquear ciclos novos e imports proibidos.                                                                    |
| QA-05 | P2         | Automatizar SAST e detecção de secrets; zero achado novo crítico/alto e zero secret confirmado.                                   |
| QA-06 | P3         | Medir e automatizar acessibilidade, sem violação nova crítica/séria; preservar revisão manual de teclado e nome acessível.        |

Performance continua acompanhada pelo uso real. Os benchmarks existentes são
diagnóstico opcional; não há gate novo de p95/p99, capacidade, margem estatística
ou regressão percentual obrigatório a implementar.
