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

### LF-04 — Validar coordenação entre abas e respostas perdidas

**P1 · validação integrada.** Drenagem funcional, push forçado e preferências
compartilham fila por conta e Web Lock. Sem Web Locks, a serialização cobre
somente a aba atual.

- [ ] Exercitar push manual, drenagem e edição simultâneos entre abas reais,
      incluindo fechamento da aba que detém o lock.
- [ ] Verificar resposta perdida durante push forçado e preservação das operações
      criadas enquanto o lote anterior está em trânsito.

### LF-06 — Investigar instabilidade dos ensaios de conta com API real

**P1 · investigação.** Origem: App CI de 2026-11-05. No `df80a15`, o ensaio de
fechamento completo e reabertura offline excedeu 90 s; no `44cdc07`, a
convergência de duas sessões terminou com a edição do primeiro dispositivo em
vez da do segundo após o push forçado. Cada execução falhou em um teste
diferente, e ambos passaram no `1fc3c42`.

- [ ] Reexecutar o job e, se repetir, analisar o trace do Playwright publicado
      como artefato.
- [ ] Distinguir instabilidade do teste de corrida real entre push forçado,
      drenagem e refresh canônico, relacionando com LF-04.

### LF-05 — Completar os ensaios integrados de conta sem rede

**P2 · validação complementar.** O Chromium com API real isolada cobre
fechamento completo, reabertura offline, retomada automática e conflito de duas
sessões da mesma conta. Permanecem os cenários abaixo.

- [ ] Exercitar revogação e isolamento entre dois usuários no navegador com
      API real, complementando os testes negativos de RPC/RLS do pgTAP.
- [ ] Exercitar atualização real da PWA/service worker com operações pendentes.
- [ ] Verificar resposta perdida e replay após retenção de recibos, documentando
      a janela de idempotência de sete dias sem prometer retenção infinita.
- [ ] Cobrir sessão expirada e grant local expirado: hoje a reabertura offline
      exige sessão disponível e grant positivo da mesma conta com até 24 horas.
      Avaliar qualquer mudança desse contrato sem enfraquecer autorização remota.

## Publicação e recuperação

### DEP-01 — Validar a publicação por SHA no provedor

**P1 · validação.** O pipeline exige credenciais da API Vercel e falha no
preflight, antes das migrations, se faltarem. Não existe fallback para Deploy
Hook. A configuração externa está completa: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`
e `VERCEL_AUTOMATION_BYPASS_SECRET` estão cadastrados, e `VERCEL_TEAM_ID` não se
aplica à conta pessoal Hobby. A próxima publicação depende do App CI da `main`
voltar a passar (QA-05); até lá, a migration `20261103180224` segue sem aplicar
e a auditoria horária do histórico de migrations reprova.

- [ ] Na próxima publicação autorizada, validar permissões do token, contrato
      real da API, SHA, Production, `READY`, smoke e domínio canônico.
- [ ] Conferir execução manual com evidência completa do App CI do mesmo SHA.
- [ ] Após validar e ativar o fluxo por API, conferir consumidores do hook antigo;
      quando não houver dependência ativa, remover `VERCEL_DEPLOY_HOOK_URL` do
      GitHub e revogar o hook na Vercel.

### DEP-05 — Ensaiar interrupções, retomada e rollback

**P1 · validação.** Origem: antigo plano, passos 4–5, e runbooks de publicação.

- [ ] Ensaiar migration falha, interrupção após migration e antes do deploy,
      indisponibilidade do GitHub/Vercel e falha posterior ao aceite da API Vercel.
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

Três execuções agendadas consecutivas com GHCR foram bem-sucedidas, de
2026-11-03 a 2026-11-05, no SHA `e5a91cd`. O restore real em segunda máquina já
foi aprovado. Resta acompanhar a regularidade e os critérios abaixo.

- [ ] Usar `make backup-status` e `make backup-log run=<id>` para classificar falhas.
- [ ] Se o limite de imagens persistir, avaliar cache ou outro registro.
- [ ] Conferir o RPO operacional aceito de 26 horas; o RTO aceito é de 30 minutos
      para restore isolado, não para recuperação completa da produção.

### OPS-03 — Reavaliar geolocalização no Sentry

**P2 · revisão antes de ampliar convidados.** Origem: runbooks de telemetria.
O fornecedor acrescenta `user.geo` na ingestão mesmo com armazenamento de IP
desabilitado e scrubbing de usuário. Avaliar privacidade e alternativas sem
assumir que um endpoint próprio é necessário ou autorizado.

## Dependências e manutenção

### MAINT-01 — Revisar o override major de glob

**P2 · revisão humana.** Origem: relatório de dependências.
`glob@13.0.6` é sobrescrito por `14.0.3` para o consumidor Serwist.
Registrar compatibilidade, justificativa e resultado da revisão; preservar
build PWA e testes offline sem atualização destrutiva automática.

### MAINT-02 — Reavaliar advisories moderados de desenvolvimento

**P3 · manutenção condicionada à auditoria atual.** Origem: relatório de
dependências. A cadeia minimatch/ESLint/Stryker permanece com advisories
moderados de desenvolvimento, sem solução aprovada dentro dos majors atuais.
Os padrões analisados são arquivos/configuração do repositório, não entradas
de usuários do aplicativo. Consultar `make audit-all`, confirmar o alcance e corrigir em mudança dedicada
quando houver solução compatível. Não impor minimatch incompatível nem aceitar
downgrade automático de ESLint para satisfazer a auditoria.

## Automação dos gates de engenharia

### QA-01 — Elevar a cobertura global até os objetivos

**P3 · melhoria incremental.** O ratchet e os limites do diff estão automatizados.
A cobertura global medida permanece abaixo dos objetivos de 80% de linhas e
70% de branches. Não baixar o baseline nem ampliar exclusões para atingir o gate.

- [ ] Aumentar cobertura com cenários de contrato relevantes nas áreas alteradas.
- [ ] Após melhoria comprovada, revisar e elevar o piso versionado.

### QA-05 — Validar o scanner SAST no Actions

**P1 · validação externa.** Gitleaks e o verificador SARIF possuem gates;
CodeQL `security-extended` está configurado no App CI e não foi executado
localmente. O repositório público preserva o plano GitHub Free. As primeiras
execuções na `main` (`0669711` e `1fc3c42`) reprovaram no passo do gate, sem
log recuperável pelo `gh`. A causa provável era o verificador não reconhecer as
regras agrupadas por pacote em `tool.extensions`, formato do CodeQL do Actions;
o verificador foi corrigido e coberto por testes. Com a correção, o App CI do
`44cdc07` reprovou por um achado real, `js/file-system-race`, sem localização
no log. O verificador passou a listar arquivo e linha de cada achado alto, e o
par verificar-depois-escrever do relatório em `scripts/benchmark-cohort.mjs`
foi removido.

- [ ] Confirmar no próximo App CI que `Check security` passa; se reprovar,
      tratar cada achado pela localização informada.
- [ ] Avaliar adicionar `Check security` ao ruleset remoto da `main`; o pipeline
      de produção já exige esse job e a execução completa aprovada.

Performance continua acompanhada pelo uso real. Os benchmarks existentes são
diagnóstico opcional; não há gate novo de p95/p99, capacidade, margem estatística
ou regressão percentual obrigatório a implementar.
