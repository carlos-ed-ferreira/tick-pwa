# IMPLEMENTATION.md

## Propósito

Este é o backlog canônico de lacunas técnicas e de produto encontradas na
auditoria de 2026-08-10. Cada item distingue o estado já entregue do trabalho
restante; um item planejado não deve ser tratado como implementado sem status e
evidência registrados aqui.

Prioridades:

- `P0`: segurança, risco de perda de dados ou bloqueio crítico;
- `P1`: necessário antes de produção ou de uma feature dependente;
- `P2`: melhoria importante;
- `P3`: evolução não urgente.

O plano de arquitetura e custos em
[docs/plano-arquitetura-producao.md](docs/plano-arquitetura-producao.md) contém
o racional da direção futura. Este arquivo prevalece como lista de execução e
estado de conformidade.

## Resumo

| ID         | Prioridade | Domínio      | Lacuna                                                          |
| ---------- | ---------- | ------------ | --------------------------------------------------------------- |
| DATA-01    | P0         | local-first  | snapshot remoto sem paginação pode apagar cache válido          |
| SYNC-01    | P0         | local-first  | fila autenticada volátil, sem retry durável ou idempotência     |
| SEC-01     | P0         | dependências | 5 vulnerabilidades altas em dependências de produção            |
| CICD-01    | P0         | CI/CD        | deploy Vercel ainda não está coordenado ao SHA migrado          |
| API-01     | P1         | API/banco    | escrita direta, granular e sem controle efetivo de revisão      |
| AUTH-01    | P1         | autenticação | allowlist de protótipo, sem ciclo de vida público de conta      |
| ACCESS-01  | P1         | guest/trial  | guest não é limitado e trial/entitlement não existem            |
| BILLING-01 | P1         | assinatura   | pagamentos, webhooks e reconciliação inexistentes               |
| MIGRATE-01 | P1         | dados        | migração guest para conta inexistente                           |
| OPS-01     | P1         | operação     | observabilidade, backup e restauração insuficientes             |
| QUALITY-01 | P1         | qualidade    | coverage, mutation, estrutura e segurança fora do gate          |
| TEST-01    | P1         | testes       | E2E/banco/RLS reais não fazem parte do CI completo              |
| SCALE-01   | P1         | performance  | sem baseline de carga, bundle, sync ou quotas                   |
| HOST-01    | P2         | arquitetura  | frontend depende de runtime Next e hospedagem futura pendente   |
| MOD-01     | P2         | modularidade | hotspots extensos e complexos sem ratchet automatizado          |
| UX-01      | P2         | UI/i18n      | acessibilidade e integridade i18n parcialmente manuais          |
| DEPS-01    | P2         | manutenção   | atualização de dependências sem automação ou política no GitHub |
| HYGIENE-01 | P3         | processo     | warnings de teste e módulos extraneous no ambiente atual        |

## DATA-01 — Paginação e reconciliação segura

**Status:** concluído em 11 de agosto de 2026.

**Problema/lacuna — `P0`, código e testes:** `refreshAccountCache` trata cada
resposta como snapshot completo, embora a API limite linhas por resposta.

**Estado atual:** `src/lib/supabase/account-cache.ts` pagina todas as tabelas
funcionais em blocos de 1.000 linhas, com ordem por `revision` e `id`. Todas as
páginas são carregadas antes da transação Dexie; qualquer erro aborta a
reconciliação. O resultado informa duração, páginas e linhas por tabela.

**Estado desejado:** paginação determinística e reconciliação destrutiva apenas
depois que todas as páginas de todas as entidades necessárias forem validadas.

**Mudanças entregues:** paginação por revisão/ID ou range estável; resultado
tipado como completo/incompleto; staging do snapshot; telemetria de páginas e
linhas; testes em `tests/integration/account-persistence.test.ts`.

**Dependências:** contrato de ordenação estável e decisão sobre a transição para
sincronização incremental.

**Riscos:** exclusão ou ocultação de dados, corrida com alterações pendentes,
payload crescente e reconciliação parcial.

**Critérios de aceite:** mais de 1.000 registros por tabela são carregados;
falha em qualquer página não remove nada; itens pendentes permanecem; duas
execuções produzem o mesmo estado.

**Validação:** integração com >1.000 linhas, falha na página final, concorrência
com write pendente, E2E autenticado e métricas de contagem.

## SYNC-01 — Sincronização durável e resiliente

**Status:** em andamento; proteção de refresh da Fase 0.2, estados/retry
visíveis da Fase 0.3, configuração externa e superfície funcional isolada da
prova PowerSync concluídos em 11 de agosto de 2026. O HTTP 409 do primeiro
ensaio revelou escrita remota nas tabelas funcionais; a correção com tabelas
`powersync_poc_*` e SQLite `v2` foi preparada em 14 de agosto de 2026. Migration,
novos Sync Streams, reativação controlada, migração das telas reais e ensaios
reais ainda estão pendentes.

**Problema/lacuna — `P0`, arquitetura/código/serviço externo:** operações da
conta podem desaparecer ao fechar ou recarregar a aba.

**Estado atual:** `src/lib/db/account-persistence.ts` usa `Map` em memória.
Outbox e cursores Dexie antigos foram removidos na versão 7. Não há backoff,
operação idempotente, limite de fila, replay após reload ou contrato formal de
conflito. O refresh inicial e os eventos concorrentes são deduplicados por
conta; foco e retorno da rede têm debounce e validade de 60 segundos. As seis
tabelas funcionais alimentam um estado agregado no cabeçalho. Escritas em voo
são marcadas como `syncing`, falhas irrecuperáveis como `failed`, e a ação
manual reenvia apenas a mesma versão local falha, com o mesmo ID e escopo.

**Estado desejado:** banco local sincronizável com fila durável, pull
incremental, retry com backoff, idempotência, conflitos determinísticos, estado
visível e convergência multidispositivo.

**Mudanças necessárias:** prova de conceito PowerSync no plano gratuito;
schema local autenticado; conector de upload; sync rules por usuário; feature
flag e rollout gradual. Criar outbox transitória própria apenas se conta
pública precisar sair antes da migração.

**Dependências:** DATA-01 como proteção transitória, API-01, projeto PowerSync,
JWT Supabase e decisão de navegadores suportados.

**Riscos:** perda ou duplicação, conflito destrutivo, incompatibilidade de
storage web, custo de serviço e mistura de escopos.

**Critérios de aceite:** edição offline sobrevive a reload; retry é seguro;
dois dispositivos convergem; guest não conecta; usuário A não recebe B; fila e
falhas são visíveis e limitadas.

**Validação:** testes local-first do REVIEW, E2E offline/reload, dois usuários,
dois dispositivos, carga de conta madura e restore/rollback da feature flag.

**Evidência da Fase 0.3:** integração cobre transição `syncing`, falha, resumo
agregado, retry com o mesmo ID e proteção por versão; teste de UI cobre a ação
acessível. O gate `make check` passou com 57 arquivos e 402 testes em 11 de
agosto de 2026; os E2E locais passaram em 22 cenários e os autenticados em 2,
ambos em desktop e mobile, incluindo as transições `Syncing` e `Synced` sob
latência remota simulada.

**Evidência da fundação PowerSync:** `@powersync/web` está atrás de feature
flag desligada por padrão; schema SQLite, normalização dos tipos Postgres,
conector Supabase, ciclo de vida isolado por usuário e Sync Streams edition 3
para as tabelas `powersync_poc_*` estão versionados. O
guest não inicia o serviço e a troca de conta fecha o banco anterior. O guia de
ativação controlada está em `docs/powersync-poc.md`. Essa entrega ainda não
altera as leituras e escritas funcionais do produto.

O rollout também exige uma lista explícita de IDs de conta. O adapter isolado
do POC lê somente linhas do usuário autenticado, rejeita guest e gera
`INSERT`/`UPDATE` locais com booleanos e JSON compatíveis com SQLite. Ele ainda
não foi conectado aos comandos Dexie para impedir dual-write durante a prova.
A rota interna `/~powersync-poc` usa esse adapter para gravar categoria, dia,
tarefa e duas subtarefas em uma única transação local. Edição, conclusão,
reordenação e exclusão atualizam as entidades e o resumo diário em lotes
atômicos. A superfície mostra conexão e quantidade pendente sem expor erros
internos, atualiza o estado remoto enquanto permanece aberta, tem textos
pt-BR/en e permanece bloqueada para contas fora do rollout. A ativação
controlada chegou ao primeiro cenário local; convergência remota e os demais
ensaios reais continuam pendentes.

**Evidência da superfície isolada:** `make check` passou com 60 arquivos e 429
testes; `make test-e2e` passou em 22 cenários desktop/mobile e
`make test-e2e-account` em 2 cenários autenticados. `make audit-prod` encontrou
0 vulnerabilidades. Esses gates mantiveram a flag ausente e, portanto, não
substituem os ensaios reais no PowerSync Cloud.

**Incidente e correção v2:** o primeiro ensaio real retornou HTTP 409 ao criar
outro `daily_entries` para o mesmo usuário/data e deixou 10 operações locais
pendentes. A v2 separa as três tabelas remotas, remove as tabelas funcionais da
publicação PowerSync, aplica RLS e chaves por usuário, permite vários cenários
na mesma data e troca o nome do SQLite para não reabrir a fila v1. A flag deve
permanecer desligada até migration e Sync Streams serem confirmados.

**Evidência da correção v2:** RED do cliente com 6 falhas e GREEN com 19
testes direcionados; RED do banco com 8 falhas e GREEN com 31 testes pgTAP.
Banco limpo, lint e diff declarativo passaram. `make check` aprovou 60 arquivos
e 429 testes; E2E local aprovou 22 cenários e E2E autenticado aprovou 2.

**Ensaio v2 em 17 de agosto de 2026:** o primeiro cenário persistiu as cinco
operações no SQLite isolado. A superfície mantinha o primeiro retrato da fila e
não exibia a conclusão posterior do upload. Um teste de regressão reproduziu a
ausência de atualização; a tela agora relê o status sem sobrepor consultas e
transita automaticamente de pendente para sincronizado. Depois do reload, a
fila retornou a zero e o cenário local permaneceu disponível, confirmando o
primeiro upload remoto da v2. O teste direcionado passou com 20 cenários e
`make check` aprovou 60 arquivos e 430 testes, lint, tipagem, formato e build.

## SEC-01 — Vulnerabilidades de dependências

**Status:** concluído em 11 de agosto de 2026 para dependências de produção.

**Problema/lacuna — `P0`, dependências/segurança:** o audit atual reporta cinco
vulnerabilidades altas em dependências de produção.

**Estado atual:** Next e `eslint-config-next` estão em 16.3.0; PostCSS, Nano ID,
Sharp e Brace Expansion foram resolvidos em versões corrigidas. O comando
`make audit-prod` reporta 0 vulnerabilidades e é obrigatório no App CI e em
releases manuais de migrations.

**Estado desejado:** vulnerabilidades analisadas e corrigidas em PR dedicada;
nenhuma crítica/alta nova; audit recorrente no CI.

**Mudanças entregues:** mapear alcance real; atualizar versões sem `--force`;
revisar changelogs e lockfile; testar Next/PWA/imagens; adicionar audit com
política de severidade e baseline zero.

**Dependências:** releases corrigidas compatíveis e revisão de impacto da
atualização Next.

**Riscos:** regressão de framework/PWA, falsa sensação de segurança por
advisory não alcançável e exposição enquanto não corrigido.

**Critérios de aceite:** audit sem altas/críticas ou exceção documentada com
prazo; suíte, build e E2E aprovados; nenhuma alteração automática destrutiva.

**Validação:** `make audit-prod`, `make check`, dois E2E e revisão do
grafo de dependências.

## CICD-01 — Ordenar quality gate, migrations e deploy

**Status:** gate do mesmo SHA concluído em 11 de agosto de 2026 e validado no
GitHub em 17 de agosto de 2026; coordenação comprovável do deploy Vercel
pendente.

**Problema/lacuna — `P0`, CI/CD/GitHub:** migrations podem ser aplicadas por um
workflow separado sem depender do sucesso do quality gate do mesmo commit.

**Estado atual:** `app-ci.yml` roda `make audit-prod` e `make check`. Os
workflows usam Node.js 22, `actions/checkout@v6` e `actions/setup-node@v7`,
eliminando o aviso de runtime Node.js 20 das actions anteriores.
`supabase-migrations.yml` é acionado por `workflow_run`, aceita somente App CI
aprovado em push da `main`, faz checkout do `head_sha`, registra e verifica o
SHA e só executa comandos de banco quando há caminhos relevantes alterados. A
execução manual repete o quality gate antes de acessar secrets. O deploy Vercel
continua externo.

**Estado desejado:** nenhum SHA alcança banco ou aplicação de produção antes de
todos os gates obrigatórios aplicáveis terminarem com sucesso.

**Mudanças entregues:** `workflow_run` restrito a push aprovado da `main`, gate
manual equivalente, checkout e registro do SHA, environment protegido,
concurrency e detecção de caminhos de banco. O primeiro fluxo remoto validado
concluiu `Confirm quality gate` e `Apply production migrations`.

**Mudanças restantes:** incluir banco e E2E definidos como obrigatórios,
documentar e ensaiar rollback e alinhar o deploy Vercel ao mesmo SHA.

**Dependências:** QUALITY-01, TEST-01 e configuração manual de branch/environment
protection no GitHub e Vercel.

**Riscos:** migration aplicada com aplicação inválida, deploy antes do schema,
deadlock de workflows e execução de SHA diferente.

**Critérios de aceite:** tentativa com gate falho não migra nem publica;
migration registra SHA aprovado; rollout aditivo mantém versões N e N+1;
workflow manual respeita as mesmas proteções.

**Validação:** testes do workflow em branch segura, dry-run, inspeção de checks
obrigatórios e ensaio documentado de falha/rollback.

## API-01 — Escrita transacional, idempotente e versionada

**Problema/lacuna — `P1`, arquitetura/API/banco:** o navegador executa upserts
inteiros por entidade e operações em massa ampliam o número de requisições.

**Estado atual:** `src/lib/supabase/account-data.ts` ignora `baseRevision` na
escrita. `changedFields` não controla update remoto. A revisão sobe por trigger,
mas não é usada para compare-and-set. Resumos diários e hierarquias podem gerar
várias gravações independentes.

**Estado desejado:** API de domínio em lote, autenticada, transacional,
idempotente e com política explícita de conflito.

**Mudanças necessárias:** Edge Function ou RPC; `operation_id`; versão base;
JWT como identidade; validação de payload/ownership; transação; resultado
repetível; horário/revisão do servidor; lotes para árvores e agregados.

**Dependências:** SYNC-01, schema aditivo e definição de conflitos por entidade.

**Riscos:** dupla aplicação, deadlock, rejeição incorreta offline, escalada de
privilégio e quebra durante rollout.

**Critérios de aceite:** retry não duplica; lote é todo aplicado ou todo
rejeitado; stale write segue regra documentada; `user_id` do cliente é ignorado;
operação em massa usa um contrato lógico.

**Validação:** integração real Supabase, concorrência, repetição, rollback,
payload inválido, negativas de ownership e benchmark de lote.

## AUTH-01 — Ciclo de vida público de conta

**Problema/lacuna — `P1`, produto/auth/serviço externo:** o fluxo autenticado é
um protótipo por allowlist.

**Estado atual:** existem login por senha e Google, perfil e `account_access`.
Não existem cadastro de produto, confirmação adequada, recuperação de senha,
gestão de sessão, exportação, exclusão completa ou política de retenção.

**Estado desejado:** onboarding e ciclo de vida de conta seguros, localizados e
testáveis, integrados ao entitlement.

**Mudanças necessárias:** telas e contratos de signup/confirm/reset; templates
e SMTP; OAuth production; export/delete; reautenticação para ações sensíveis;
retenção; remover dependência da allowlist quando o entitlement assumir acesso.

**Dependências:** ACCESS-01, BILLING-01, política de privacidade e configuração
manual do Supabase Auth.

**Riscos:** takeover, enumeração de e-mail, perda de conta, retenção indevida e
redirect OAuth incorreto.

**Critérios de aceite:** fluxos positivos e negativos em pt/en; rate limit;
sessão offline não vira “não autorizado” por falha de rede; export e exclusão
verificados.

**Validação:** E2E com Supabase local real, testes de auth/RLS, segurança de
redirect, recuperação e deleção em cascade.

## ACCESS-01 — Guest limitado, trial e entitlement

**Problema/lacuna — `P1`, produto/domínio/banco:** os três estados comerciais
desejados não existem.

**Estado atual:** guest oferece as funcionalidades principais sem limite;
usuário autenticado depende apenas da allowlist. Não há trial, assinatura ou
entitlement.

**Estado desejado:** guest oferece preview limitado; trial autenticado começa
uma vez e dura 7 dias; assinante ativo recebe acesso completo. Trial e assinante
usam exatamente a mesma persistência e sincronização.

**Mudanças necessárias:** modelo central de entitlement; relógio canônico do
servidor; regras de limite guest no domínio; estados trial/active/grace/expired;
UI e dicionários; autorização remota; proteção contra abuso.

**Dependências:** AUTH-01, BILLING-01 e decisão de quais capacidades compõem o
preview.

**Riscos:** bypass no frontend, trial repetido, relógio local manipulado,
arquitetura de dados paralela e bloqueio indevido de dados existentes.

**Critérios de aceite:** trial dura 7 dias por tempo do servidor; expiração não
apaga dados; frontend sozinho não libera acesso; regras guest são centralizadas;
mesmo fluxo de dados atende trial e assinante.

**Validação:** matriz de entitlement do REVIEW, timezone/fronteira temporal,
offline, mudança de plano e testes negativos de API/RLS.

## BILLING-01 — Assinatura e pagamentos

**Problema/lacuna — `P1`, produto/serviço externo/API:** não existe integração
de cobrança mensal.

**Estado atual:** nenhum catálogo, checkout, customer, subscription, webhook ou
reconciliação. Os preços provisórios são R$ 10,00/mês no Brasil e US$ 5.00/mês
nos demais países.

**Estado desejado:** catálogo centralizado por região/moeda, checkout seguro,
status canônico de assinatura e entitlement derivado no servidor.

**Mudanças necessárias:** escolher provedor; modelar customer/subscription e
event log; checkout/portal; webhooks assinados e idempotentes; renovação,
cancelamento, grace period, falha de pagamento e job de reconciliação.

**Dependências:** conta jurídica/comercial, políticas fiscais, AUTH-01 e
ACCESS-01. Os preços continuam placeholders até decisão de produto.

**Riscos:** cobrança duplicada, acesso indevido, webhook fora de ordem, moeda
errada, chargeback e divergência provedor/banco.

**Critérios de aceite:** preços vêm de configuração; webhook duplicado não muda
resultado; reconciliação corrige eventos perdidos; estados comerciais concedem
ou removem entitlement conforme contrato.

**Validação:** sandbox do provedor, assinatura de webhook, replay/out-of-order,
matriz regional, cancelamento/renovação/falha e auditoria de segurança.

## MIGRATE-01 — Migração explícita de guest para conta

**Problema/lacuna — `P1`, dados/local-first:** dados locais não podem ser
transferidos para uma conta.

**Estado atual:** escopos são separados e login não migra. O banco guarda
`installationId`, mas não existe plano, operação ou registro de migração.

**Estado desejado:** fluxo opcional e explícito para dados elegíveis, seguro,
idempotente, recuperável e preservando ownership.

**Mudanças necessárias:** definir elegibilidade e UX; inventariar grafo guest;
gerar `migration_id`; mapear IDs/relações; lote transacional; checkpoint local;
relatório; retry e limpeza somente após confirmação canônica.

**Dependências:** API-01, SYNC-01, AUTH-01 e decisão de merge quando a conta já
possui dados.

**Riscos:** duplicação, cruzamento de usuários, perda parcial, referências
quebradas e exclusão prematura do guest.

**Critérios de aceite:** repetir não duplica; falha parcial pode retomar;
usuário A nunca recebe B; relações permanecem válidas; origem só é removida com
consentimento e confirmação.

**Validação:** grafos grandes, conta vazia/não vazia, interrupção em cada fase,
dois usuários, retry e convergência posterior.

## OPS-01 — Observabilidade, backup e restauração

**Problema/lacuna — `P1`, infraestrutura/operação:** falhas aparecem
principalmente em `console.error`; não há monitoramento ou restore drill.

**Estado atual:** nenhum SDK de observabilidade, métricas de sync, alertas,
backup externo documentado ou teste de restauração. Supabase Free e Vercel
Hobby permanecem nesta fase.

**Estado desejado:** erros acionáveis sem PII, métricas de sync, alertas de
quota/falha, backup independente e restauração comprovada.

**Mudanças necessárias:** escolher observabilidade; definir eventos e redaction;
dashboards; alertas; export/backup automatizado; criptografia/retenção; runbooks
de incidente, restore e rollback.

**Dependências:** definição de RPO/RTO, contas externas e arquitetura SYNC-01.

**Riscos:** vazamento de conteúdo em logs, custo, alerta ruidoso e backup não
restaurável.

**Critérios de aceite:** falha crítica gera alerta; nenhuma tarefa/texto privado
vai para telemetria; backup restaurado em ambiente isolado; RPO/RTO medidos.

**Validação:** teste de redaction, falha sintética, restore drill, revisão de
acesso e simulação de quota.

## QUALITY-01 — Quality gate mensurável

**Problema/lacuna — `P1`, qualidade/CI:** cobertura, mutation testing,
complexidade, tamanho, dependências arquiteturais, SAST e secrets não fazem
parte do gate.

**Estado atual:** `make check` cobre typecheck, comentários, ESLint, Vitest,
Prettier e build. Baselines estruturais e de segurança estão no REVIEW.

**Estado desejado:** gate rápido local e gate completo CI com coverage, ratchets,
mutation em módulos críticos, arquitetura, audit e scanners apropriados.

**Mudanças necessárias:** selecionar ferramentas TypeScript; gerar baselines
versionados; configurar escopo diff-aware; relatórios de PR; agregar comandos;
documentar exceções e custo de execução.

**Dependências:** capacidade do CI e calibração com o legado, sem instalar
ferramentas incompatíveis apenas para cumprir lista genérica.

**Riscos:** CI lento/flaky, thresholds arbitrários, gaming de LOC/cobertura e
falso positivo de scanner.

**Critérios de aceite:** tabela do REVIEW reflete automação real; regressão falha
com mensagem útil; código novo obedece thresholds; baseline só melhora por PR
revisada.

**Validação:** introduzir regressões sintéticas para cada gate, medir tempo local
e CI e revisar relatórios gerados.

## TEST-01 — CI completo, banco real e autorização negativa

**Problema/lacuna — `P1`, testes/CI/banco:** E2E e checks de banco são manuais;
o E2E autenticado intercepta HTTP e não prova integração real ou RLS.

**Estado atual:** 394 Vitest, 22 E2E locais, 2 E2E autenticados simulados e 22
pgTAP passam. pgTAP verifica sobretudo estrutura e presença de policies.

**Estado desejado:** CI executa a matriz aplicável, incluindo Supabase local
real, policies negativas, auth e migrations limpas.

**Mudanças necessárias:** job Docker/Supabase; reset; pgTAP; E2E autenticado
real; fixtures de dois usuários; testes de CRUD negado; artifacts Playwright;
sharding/cache estáveis.

**Dependências:** CICD-01 e tempo aceitável de CI.

**Riscos:** flakiness, conflito de portas, teste simulado confundido com real e
secrets de teste mal geridos.

**Critérios de aceite:** PR de banco/auth não passa com policy permissiva;
ambiente nasce do zero; E2E real usa usuários isolados; falhas guardam artifacts
sem dados sensíveis.

**Validação:** pipeline em PR, mutation manual de uma policy, execução repetida
e medição de estabilidade.

## SCALE-01 — Performance, carga e capacidade

**Problema/lacuna — `P1`, performance/operação:** não há baseline para 1.000
usuários diários, conta madura, bundle ou sincronização.

**Estado atual:** build não informa budgets; refresh baixa tabelas completas;
operações em massa podem gerar requisições sequenciais; não há load test.

**Estado desejado:** cenários representativos com p95/p99, bytes, queries,
fila, tempo de convergência, bundle e quotas monitorados.

**Mudanças necessárias:** modelo de tráfego e pico; dataset com milhares de
itens; benchmark reprodutível; instrumentar pulls/writes; budget de bundle;
teste de carga de API/Postgres; índices orientados por queries reais.

**Dependências:** SYNC-01 e API-01 estáveis.

**Riscos:** benchmark artificial, custo contra SaaS, otimização prematura e
teste destrutivo em produção.

**Critérios de aceite:** arquitetura sustenta pico acordado para 1.000 DAU com
margem; nenhuma consulta/payload ilimitado; regressão >10% falha ou exige
justificativa; quotas têm alerta em 70%.

**Validação:** ambiente isolado, carga progressiva, conta madura, rede móvel e
relatório de gargalos/capacidade.

## HOST-01 — Frontend estático e planos futuros

**Problema/lacuna — `P2`, arquitetura/deploy:** rotas principais exigem runtime
Next por locale no servidor e a hospedagem comercial futura não está resolvida.

**Estado atual:** Next App Router na Vercel, rotas dinâmicas, Serwist e Supabase.
O projeto decidiu não contratar Vercel Pro nem Supabase Pro agora.

**Estado desejado:** após estabilizar sync, avaliar migração React/TypeScript
para Vite estático na Cloudflare, mantendo PWA; Supabase continua canônico.

**Mudanças necessárias:** remover dependência server-side de locale; protótipo
de build estático; adaptar service worker, metadata e rotas; configurar
Cloudflare; plano de DNS, cache, rollback e páginas públicas com SEO separadas.

**Dependências:** SYNC-01 estável e decisão comercial.

**Riscos:** update quebrado da PWA, cache antigo, perda de SEO/headers e dois
frontends em paralelo.

**Critérios de aceite:** paridade funcional/E2E, offline preservado, rollback,
headers corretos e custo/termos adequados. Vercel Pro só é avaliado se uso
comercial começar antes da migração.

**Validação:** build estático, instalação/upgrade PWA, E2E, Lighthouse ou
equivalente e ensaio de deploy/rollback.

## MOD-01 — Hotspots de modularidade

**Problema/lacuna — `P2`, arquitetura/código:** módulos e componentes concentram
responsabilidades e complexidade elevadas.

**Estado atual:** 6 módulos excedem 800 linhas lógicas; máximo 3.861. Há 40
funções com complexidade >10 e 54 com >80 linhas. Principais hotspots incluem
`goals-surface.tsx`, comandos de metas/checklist, `checklist-surface.tsx`,
`database.ts` e `task-tree-editable-row.tsx`.

**Estado desejado:** responsabilidades coesas, fronteiras testáveis e ratchet
que impede crescimento sem refatoração geral.

**Mudanças necessárias:** mapear responsabilidades por hotspot; extrair domínio,
estado e UI por mudança funcional; adicionar regra diff-aware; preservar APIs e
testes.

**Dependências:** QUALITY-01. Refatorar somente quando uma tarefa tocar a área
ou quando houver iniciativa dedicada aprovada.

**Riscos:** quebra visual/comportamental, abstrações artificiais e diff grande.

**Critérios de aceite:** hotspot tocado não piora baseline; extração tem
responsabilidade nomeável; nenhum ciclo novo; comportamento permanece coberto.

**Validação:** complexidade/LOC, testes direcionados, E2E da área e revisão de
dependências.

## UX-01 — Acessibilidade e integridade i18n

**Problema/lacuna — `P2`, UI/qualidade:** dicionários são tipados, mas não há
scanner de strings, axe, budget de contraste ou gate de acessibilidade.

**Estado atual:** `pt-BR` e `en` satisfazem a mesma interface TypeScript;
Playwright cobre desktop/mobile em fluxos selecionados; verificações visuais e
de teclado são majoritariamente manuais.

**Estado desejado:** nenhuma chave ausente, nenhuma string nova fora do
mecanismo oficial e zero violação crítica/séria nova de acessibilidade.

**Mudanças necessárias:** teste de paridade/uso de chaves; detector calibrado de
string traduzível; axe ou equivalente; cenários de teclado, zoom, contraste,
conteúdo longo e estados assíncronos.

**Dependências:** QUALITY-01 e seleção de ferramenta compatível com React 19.

**Riscos:** falsos positivos em termos técnicos, snapshot frágil e confiança
excessiva em scanner automático.

**Critérios de aceite:** pt/en completos; fallback testado; sem string nova
indevida; UI alterada navegável por teclado e sem finding crítico/sério novo.

**Validação:** typecheck, testes i18n, scanner, axe, E2E mobile/desktop e revisão
manual do REVIEW.

## DEPS-01 — Automação de manutenção de dependências

**Problema/lacuna — `P2`, GitHub/processo:** não há Renovate/Dependabot ou
workflow documentado para updates.

**Estado atual:** npm lockfile; atualizações manuais; Supabase CLI instalada
2.98.2 enquanto o ambiente informou versão mais nova. O `make deps-tree` local também
mostrou módulos extraneous, sem prova de problema no lockfile.

**Estado desejado:** detecção recorrente, PRs pequenas, classificação de risco,
gates completos e auto-merge somente para mudanças elegíveis.

**Mudanças necessárias:** configurar ferramenta no GitHub; agrupar com cuidado;
separar production/dev; labels/reviewers; calendário; policy patch/minor/major e
security; não gerar migration por atualização da CLI.

**Dependências:** QUALITY-01 e configurações externas de branch protection.

**Riscos:** avalanche de PRs, major automático, lockfile inconsistente e
migration acidental.

**Critérios de aceite:** update tem changelog, audit e evidência; major nunca
auto-merge; security update recebe prioridade; CLI não altera schema sozinha.

**Validação:** PR piloto patch, minor e major; falha deliberada de gate e revisão
das regras de merge.

## HYGIENE-01 — Warnings e ambiente reprodutível

**Problema/lacuna — `P3`, testes/processo:** suítes verdes ainda emitem ruído e
o ambiente instalado possui pacotes extraneous.

**Estado atual:** Vitest avisa sobre `priority` não booleano em mock de
`next/image` e imprime falhas remotas esperadas; Playwright avisa sobre
`NO_COLOR`; após instalação limpa, `make deps-tree` lista cinco módulos
extraneous ligados ao fallback WASM opcional do Sharp 0.35.3.

**Estado desejado:** saída de teste limpa ou ruído esperado capturado
explicitamente; `make install-ci` reproduz árvore sem drift relevante.

**Mudanças necessárias:** corrigir mocks/spies de teste; investigar ambiente
extraneous a partir de instalação limpa; evitar esconder erro real com filtros
globais.

**Dependências:** nenhuma.

**Riscos:** silenciar falha legítima ou remover pacote necessário do ambiente.

**Critérios de aceite:** suítes aprovam sem warnings não explicados; instalação
limpa reproduz a árvore do lockfile.

**Validação:** `make install-ci` em ambiente descartável, `make deps-tree`, Vitest e os
dois comandos E2E.

## Estado das configurações externas

Concluído manualmente em 11 de agosto de 2026 para a alfa controlada:

- autenticação em dois fatores nas contas dos provedores;
- branch protection, required checks e environment `production` no GitHub;
- vínculo do repositório, ambientes, variáveis, domínio e proteção de previews
  na Vercel;
- domínio canônico [https://tickapp.com.br](https://tickapp.com.br), redirects,
  Google OAuth, allowlist, RLS e SSL no Supabase;
- procedimento manual de backup e restauração do Supabase.

Continuam pendentes ou intencionalmente adiados:

- secrets de migrations no ambiente GitHub `production`, bloqueados até o novo
  workflow ser mesclado e validado no GitHub;
- SMTP, CAPTCHA e revisão de quotas do Supabase antes do cadastro público;
- ordem coordenada de migrations e deploy na Vercel, coberta por `CICD-01`;
- ativação de uma conta interna e ensaios offline, reload, multidispositivo e
  isolamento no PowerSync gratuito;
- conta, catálogo, moedas, webhooks e secrets do provedor de pagamento;
- projeto, DSN, retenção, alertas e redaction da observabilidade;
- zona, domínio, headers e rollback na Cloudflare após a migração estática;
- políticas legais, privacidade, retenção, RPO/RTO e resposta a incidentes.

Supabase Pro, Vercel Pro e PowerSync Pro não serão contratados nesta fase. Cada
upgrade depende dos gatilhos técnicos e comerciais documentados no plano de
arquitetura.
