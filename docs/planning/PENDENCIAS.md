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

### LF-06 — Confirmar a retomada após falhas de rede e a convergência

**P1 · validação.** Origem: App CI de 2026-11-05. O ensaio de fechamento
completo e reabertura offline excedeu 90 s em duas de três execuções. O trace
mostrou cinco tentativas de envio falhando por falta de rede, duas antes do
fechamento e três na reabertura; a quinta esgotou as tentativas automáticas e a
drenagem deixou de enviar a operação mesmo após a reconexão. O limite passou a
bloquear somente operações rejeitadas pelo servidor, com teste de integração.
Em outra execução, a convergência de duas sessões terminou com a edição do
primeiro dispositivo em vez da do segundo após o push forçado.

O ensaio passou no App CI do `59c372b`. Em 2026-11-06, a convergência de duas
sessões voltou a falhar com o mesmo sintoma em `make test-account-browser` local,
com a máquina sob carga, e passou nas repetições.

- [ ] Acompanhar as próximas execuções do App CI para confirmar estabilidade.
- [ ] Se a convergência voltar a falhar, analisar o trace e distinguir
      instabilidade do teste de corrida entre push forçado, drenagem e refresh
      canônico, relacionando com LF-04.

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
aplica à conta pessoal Hobby. Em 2026-11-05, a primeira publicação pela API
aplicou a migration `20261103180224` e publicou o `59c372b`: quality gate,
migrations e deploy com smoke aprovados, e o domínio canônico serve o mesmo
SHA. O Deploy Hook antigo foi removido do GitHub e revogado na Vercel.

- [ ] Validar a primeira publicação pelo novo `make publish`, depois de o
      workflow explícito chegar à `main`: confirmar CI do SHA do merge, um
      único dispatch com `expected_sha` e `request_id`, migrations, deploy e
      smoke antes da mensagem final. Origem: decisão do proprietário de
      publicar somente mediante solicitação deliberada.
- [ ] Conferir e encerrar ou cancelar, conforme o caso, execuções antigas
      ainda pendentes na transição; alteração do workflow não cancela runs
      já criados. Confirmar ausência de novos runs de auditoria horária.
- [ ] Conferir a retomada pela interface com `main`, SHA completo atual e um
      identificador único, sem repetir solicitação ainda em execução.

### DEP-05 — Ensaiar interrupções, retomada e rollback

**P1 · validação.** Origem: antigo plano, passos 4–5, e runbooks de publicação.

- [ ] Ensaiar migration falha, interrupção após migration e antes do deploy,
      indisponibilidade do GitHub/Vercel e falha posterior ao aceite da API Vercel.
- [ ] Validar rollback de aplicação e flag e migration compensatória em ambiente
      isolado, mantendo compatibilidade com aplicação anterior e PWAs abertas.
- [ ] Validar retomada do mesmo pipeline sem republicações desnecessárias.
- [ ] Exercitar interrupção de `make publish` antes/depois de armar auto-merge;
      preservar distinção entre merge confirmado e aplicação publicada.
- [ ] Verificar avisos de falha de publicação e backup após recuperação do GitHub. Automação
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

Performance continua acompanhada pelo uso real. Os benchmarks existentes são
diagnóstico opcional; não há gate novo de p95/p99, capacidade, margem estatística
ou regressão percentual obrigatório a implementar.

## Interface e acessibilidade

### UI-01 — Remover interação aninhada nos cards de metas e grupos

**P2 · confirmado na auditoria local e no código.** Origem: `make audit-ui`, visão geral preenchida de metas, e `src/features/goals/goal-card.tsx` / `goal-group-card.tsx`.

Os cards usam `article` com `role="button"` e contêm controles interativos para ações próprias. O axe identifica `nested-interactive` (serious) e `aria-allowed-role` (minor). A tela vazia não reproduz o caso.

- [ ] Separar a ação de abrir o card dos controles internos com semântica válida, preservando mouse, teclado, toque e organização dos cards.
- [ ] Cobrir a visão preenchida com metas e grupos no E2E de acessibilidade, em desktop/mobile e nos dois idiomas.
- [ ] Encerrar quando não houver esses achados e todos os controles forem alcançáveis e acionáveis independentemente.

### UI-02 — Expor o título integral dos modais quando truncado

**P2 · confirmado no código; reprodução com título longo a concluir.** Origem: `src/components/ui/dialog.tsx`, heading com `truncate` sem `Tooltip`.

- [ ] Usar o primitive Tooltip com `whenTruncated`, preservando `aria-labelledby`, foco e o texto integral.
- [ ] Validar título longo em 320px, mouse e teclado, sem tooltip redundante quando o título couber.

### UI-03 — Localizar o fallback offline

**P2 · confirmado no código e na inspeção visual.** Origem: `src/app/~offline/page.tsx` e captura do fallback nos dois idiomas.

Os textos do fallback permanecem fixos em inglês. A padronização deve considerar que a rota é usada quando faltam recursos em cache.

- [ ] Definir o carregamento do idioma disponível nesse contexto e usar textos tipados nos dicionários pt-BR/en, preservando o funcionamento offline.
- [ ] Encerrar quando a rota exibir o idioma esperado e continuar funcionando sem rede, sem alterar o contrato de dados.

### UI-04 — Revisar o título principal das páginas internas

**P3 · confirmado pelo axe na auditoria local.** Origem: telas de calendário, dia, metas e recorrentes; regra `page-has-heading-one` (moderate).

- [ ] Definir um heading principal semântico por página e preservar a hierarquia de seções e a aparência atual.
- [ ] Validar com leitor de árvore acessível e axe nas telas preenchidas e vazias, sem headings decorativos ou duplicados.

### UI-05 — Completar a observação dos estados transitórios e do teclado físico

**P3 · validação visual pendente.** Origem: cobertura declarada por `make audit-ui` e componentes `AuthGate`, `Dialog` e campos de formulário.

A auditoria com navegador cobre acesso, erros de validação e autorização simulada. Loading transitório, armazenamento indisponível e o teclado virtual de um aparelho físico não foram observados visualmente; leitura do código ou testes de guest não comprovam esses estados.

- [ ] Reproduzir loading e indisponibilidade de armazenamento em perfil isolado com mecanismo determinístico, sem modificar a interface de produção.
- [ ] Verificar teclado virtual em aparelho real: foco, campo visível, rolagem da folha/modal, ações acessíveis e recuperação de foco.
- [ ] Registrar a evidência na entrega correspondente e remover este item quando os três cenários forem comprovados; não confundir autorização simulada com conta real ou convergência remota.
