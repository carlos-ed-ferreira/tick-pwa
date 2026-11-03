# Plano de implementação para produção

## Propósito e autoridade

Este é o único plano de evolução do Tick. Ele centraliza arquitetura, custos,
rollouts, decisões, trabalho de código, configuração externa, validação e
critérios de conclusão. O [README.md](../../README.md) descreve somente o que existe
hoje e o [REVIEW.md](../../REVIEW.md) define os gates de qualidade.

O objetivo é manter um aplicativo fechado, com acesso remoto somente para
convidados autorizados, e modo guest completo, gratuito e exclusivamente local,
sem prazo de expiração ou limites de uso impostos pelo produto. A execução
segue os passos abaixo, em ordem. Um passo só avança quando seus
critérios obrigatórios forem atendidos ou quando uma exceção estiver registrada
neste arquivo.

O desenvolvedor controla commits, publicação, contas externas, secrets,
contratações e decisões de produto. Agentes podem implementar e validar código,
mas só executam operações de versionamento ou publicação mediante pedido
explícito no turno atual.

## Decisões vigentes

- Manter o ambiente atual em **GitHub Free, Vercel Hobby e Supabase Free**.
- Manter acesso autenticado somente para convidados na allowlist.
- Oferecer todas as funcionalidades de organização no modo guest gratuito,
  sem limite de tempo ou quantidade e sem cadastro obrigatório.
- Preservar dados locais ao fechar/reabrir o app; não aplicar exclusão por prazo.
- PowerSync foi descartado.
- Manter PostgreSQL/Supabase como fonte canônica das contas.
- Manter `guest:<installationId>` exclusivamente local e isolado de
  `user:<supabaseUserId>`.
- Não migrar dados guest automaticamente durante login.
- Evitar dual-write: cada conta usa um único caminho remoto por vez.
- Usar o Makefile como única interface operacional.
- Não introduzir Redis, Kubernetes, microsserviços ou CRDTs sem necessidade
  comprovada na coorte de convidados.

## Escopo de uso e desempenho definido em 2026-11-02

O proprietário é o único usuário atual e utiliza três dispositivos. Para
planejamento, adotar teto conservador de 20 convidados, sem assumir 20 usuários
simultâneos ou um perfil de carga que ainda não existe. Não há ampliação de
acesso prevista nesta etapa. O ambiente atual permanece nos planos gratuitos.

A sincronização deve ocorrer em segundo plano, permitindo continuar editando.
Alterações feitas durante pull/push não podem ser apagadas ou substituídas por
snapshots anteriores; a fila deve preservar operações e permitir recuperação.
Até cerca de 20 segundos de sincronização é aceitável para o proprietário;
demora maior é referência prática para investigar, não um prazo para cancelar
operações, apagar dados ou declarar perda de acesso quando estiver offline.

Não definir budgets obrigatórios de p95/p99, primeiro pull, convergência ou
margem de capacidade nesta etapa. O uso real guia melhorias. Aplicar boas
práticas e preferir o caminho claramente mais eficiente para a mesma ação,
sem acrescentar complexidade por ganho pequeno. Benchmarks são ferramentas
opcionais de diagnóstico; não bloqueiam a publicação por metas arbitrárias.
O proprietário acompanha quotas manualmente e informa problemas observados.
Isso não dispensa os gates funcionais, de segurança, isolamento e integridade.

## Estado resumido

| Passo | Estado                          | Próximo marco                                      |
| ----- | ------------------------------- | -------------------------------------------------- |
| 1     | concluído                       | manter rollout restrito até ampliar a coorte       |
| 2     | concluído                       | validar Safari antes de autorizar novos convidados |
| 3     | concluído                       | manter outbox própria e recursos POC removidos     |
| 4     | concluído, verificação pendente | confirmar backups diários com GHCR                 |
| 5     | concluído                       | manter deploy ordenado e auditoria de migrations   |
| 6     | concluído e publicado           | manter guest completo e acesso remoto por convite  |
| 7     | escopo definido                 | observar uso real e investigar lentidão relevante  |
| 8     | contínuo                        | manter ambiente atual e acompanhar recursos        |
| 9     | concluído                       | repetir o ensaio físico em mudança de toque        |
| 10    | concluído e publicado           | manter módulos de metas coesos e suíte verde       |

O passo 4 foi encerrado por aceite explícito do proprietário em 2026-11-02,
com o restore real aprovado; a estabilidade do backup com GHCR continua como
verificação pendente. O passo 5 foi aceito após `ce9e7d1` e comprovado com
migration real em `b3ddc8f`, em 2026-11-03. Cenários de falha e rollback não
foram ensaiados e continuam como procedimentos operacionais. Evidências em
[deploy-hook-setup.md](../operations/deploy-hook-setup.md).

## Pendências abertas

### Verificar o backup diário com GHCR

Entre 19 e 31 de outubro de 2026, 9 das 13 execuções de `Production backup`
falharam com `toomanyrequests: Data limit exceeded` ao baixar imagens do ECR
público. A mitigação `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` foi publicada em
`ce9e7d1` em 2026-11-02, mas nenhuma execução agendada com ela foi observada
até 2026-11-03 01:00 UTC. A última execução conferida, `41520276777`, rodou no
SHA anterior `a00e5b4`.

Executar depois de cada execução agendada das 03:17 UTC:

```bash
make backup-status
```

Critério de conclusão: três execuções agendadas seguidas com `success`, todas
em SHA igual ou posterior a `ce9e7d1`. Para uma falha, rodar
`make backup-log run=<run-id>` e classificar a causa:

- limite de registro de imagens: a mitigação não bastou; reabrir o passo 4 e
  avaliar manter as imagens em cache ou outro registro;
- conexão, credencial ou banco: seguir o runbook de backup;
- outra causa: registrar e corrigir com teste antes de considerar estável.

Até a conclusão, não há garantia de RPO diário. Registrar o resultado neste
passo, em
[observability-backup-restore.md](../operations/observability-backup-restore.md)
e no registro geral do
[runbook externo](../operations/external-production-runbook.md).

### Antes de autorizar novos convidados

- validar a sincronização em Safari macOS e Safari iOS, conforme o passo 2;
- reavaliar a limitação de `user.geo` nos eventos do Sentry;
- revisar a allowlist `account_access` e as variáveis da outbox.

### Revisões técnicas

- revisar a exceção de override major de `glob` registrada no
  [relatório de manutenção](../operations/dependency-maintenance-2026-11-02.md);
- avaliar extração dos hotspots restantes quando uma mudança os tocar:
  `src/lib/db/goal-commands.ts`, `src/lib/db/checklist-commands.ts`,
  `src/features/checklist/checklist-surface.tsx`, `src/lib/db/database.ts` e
  `src/components/app/task-tree-editable-row.tsx`.

## 1. Publicar e validar o rollout controlado da outbox

### Resultado esperado

Comprovar em produção, para uma única conta interna, que a persistência
funcional em lote é segura antes de ampliar sua adoção. Este passo não depende
do PowerSync.

### Estado atual

As seis entidades funcionais — categorias, resumos diários, tarefas, grupos de
metas, metas e etapas — já registram, para contas autorizadas, a alteração local
e a operação remota na mesma transação Dexie. A outbox:

- usa `operation_id` estável e sobrevive a reload;
- envia até 100 mutações por RPC transacional;
- preserva ordem e reapresenta retries sem duplicar efeitos;
- limita a fila a 200 operações por conta;
- usa até cinco tentativas automáticas com backoff de 1 s a 30 s;
- retoma na reconexão e permite sincronização forçada;
- rebaseia uma vez uma rejeição `stale_revision`;
- usa lock de drenagem por conta entre abas;
- mantém recibos remotos por sete dias;
- registra métricas locais sem conteúdo do usuário.

Guest nunca cria outbox. Contas fora da liberação continuam temporariamente no
caminho legado de upserts diretos, sem dual-write.

### Implementação necessária

1. Manter o caminho novo atrás das duas flags e restrito inicialmente a um
   UUID.
2. Corrigir qualquer regressão encontrada com teste RED/GREEN antes de repetir
   o ensaio.
3. Não remover o caminho legado até os passos 2 e 3 aprovarem a estratégia
   definitiva.
4. Manter a sincronização forçada como recuperação explícita: primeiro baixar o
   snapshot remoto, depois enviar somente as alterações pendentes deste
   dispositivo, que vencem o conflito. Ela não pode reenviar entidades já
   convergidas nem apagar linhas existentes apenas no remoto.
5. Atualizar este passo com data e evidência de cada ensaio aprovado.

### Evidência automatizada de 28 de agosto de 2026

A parte executável pelo repositório está concluída. A revisão encontrou
cobertura para commit local, isolamento guest, seis entidades funcionais,
resposta perdida, reload, retry automático, lote limitado, fila cheia, backoff,
rebase stale, sincronização forçada, dependências pai/filho, ausência de
reenvio depois da convergência e métricas sem conteúdo privado. Nenhum teste RED
válido revelou comportamento ausente, portanto não houve alteração artificial
da lógica.

Os gates da etapa foram executados no estado atual:

- `make test-account-persistence`: 3 arquivos e 41 testes aprovados;
- `make test-e2e-account`: 4 cenários aprovados em desktop e mobile;
- `make test-e2e-offline`: 2 cenários aprovados em desktop e mobile;
- `make test-e2e`: 33 cenários aprovados e 7 cenários desktop específicos de
  toque ignorados conforme configuração;
- `make supabase-reset`, `make supabase-lint` e
  `make supabase-diff-check`: banco limpo, sem erros e sem divergência;
- `make supabase-test-db`: 80 testes pgTAP aprovados;
- `make check`: 73 arquivos e 566 testes aprovados, além de tipagem, lint,
  formatação e build.

Naquela data, a etapa ficou aberta somente para a ativação restrita, o novo
deploy e os ensaios reais, concluídos conforme registrado abaixo.

### Correção da inconsistência offline em 28 de agosto de 2026

O primeiro ensaio controlado confirmou toda a lógica funcional, mas revelou uma
corrida intermitente: depois de desligar a internet, um refresh de foco ainda
podia consultar o Supabase e a outbox podia iniciar a RPC antes de observar o
estado offline. O service worker registrava `no-response` e a operação aparecia
como `Falha ao sincronizar`, embora reload ou retry após reconexão convergissem.

O RED reproduziu os dois contratos ausentes: não iniciar refresh remoto offline
e manter uma escrita durável offline como pendente sem chamar a RPC. Um terceiro
caso cobriu a queda da conexão durante uma chamada já iniciada. O GREEN impede
novos refreshes e drenos enquanto `navigator.onLine` é falso e devolve operações
em voo para `pending` quando a conexão cai, preservando payload, ordem e
`operation_id`. A reconexão continua retomando automaticamente. A correção
foi validada localmente por 43 testes de persistência, 569 testes da suíte,
quatro cenários E2E de conta, dois cenários E2E offline e pelo gate completo
`make check`, e depois publicada e aprovada no ensaio real.

Um segundo ensaio expôs o caso em que o Chromium devolve
`ERR_INTERNET_DISCONNECTED`, mas `navigator.onLine` ainda permanece `true`. O
erro estruturado do Supabase chega sem código e com `TypeError: Failed to fetch`;
por isso ainda era tratado como rejeição remota. A outbox agora reconhece esse
erro de transporte, mantém a operação em `pending`, interrompe o restante do
lote e agenda retry com backoff. Isso evita disparar uma RPC para cada operação
pendente durante a indisponibilidade. Erros de domínio, autorização, validação e
conflito continuam no fluxo de falha recuperável. Na época, o aviso do POC
PowerSync sobre múltiplas abas era independente da persistência funcional; o
POC foi removido no passo 3.

A segunda correção foi validada por 44 testes direcionados de persistência, 570
testes da suíte, quatro cenários E2E autenticados em desktop e mobile, dois
cenários E2E de reload offline e pelo gate completo `make check`.

### Conclusão em 28 de agosto de 2026

O rollout restrito foi publicado e validado em produção com a conta interna
autorizada. Calendário e metas preservaram alterações após reload offline, a
reconexão convergiu, a sincronização entre janela normal e contexto anônimo
funcionou e contas guest ou fora da allowlist mantiveram seus respectivos
escopos. As duas corridas de transporte encontradas durante o ensaio foram
reproduzidas por testes e corrigidas antes da aprovação. A etapa 1 está
concluída; a flag permanece restrita à conta interna durante as medições da
etapa 2.

### Responsabilidade externa

Depois que a versão estiver publicada com as flags vazias, configurar em
**Vercel → Production**:

```dotenv
NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES=1
NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS=<auth.users.id-da-conta-interna>
```

O UUID é também o `profiles.id`. Essas variáveis são públicas no bundle e nunca
devem conter token ou senha. Como são `NEXT_PUBLIC_*`, a alteração exige novo
deploy.

Executar manualmente, na conta autorizada:

1. editar calendário, categorias e metas online;
2. editar offline, recarregar ainda offline e religar a rede sem clicar em
   sincronizar;
3. editar a mesma entidade em janela normal e anônima, deixando o segundo
   contexto offline até o primeiro confirmar;
4. opcionalmente gerar mais de 200 alterações offline para validar o limite;
5. confirmar que conta não listada permanece funcional e que guest não envia
   entidades.

### Aprovação e rollback

O passo passa quando o indicador retorna sozinho a `Sincronizado`, nenhuma
alteração desaparece, não há rajadas de retry, o conflito converge conforme a
regra documentada e a fila cheia continua preservando o estado local.

Se reprovar, não limpar IndexedDB ou dados do site. Registrar estado e erro,
usar sincronização forçada para reconciliar e manter somente a conta interna.
Para rollback, esvaziar `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` e gerar novo
deploy. Operações já persistidas devem permanecer disponíveis para diagnóstico.

### Gates

```bash
make test-account-persistence
make check
make test-e2e
make test-e2e-offline
make test-e2e-account
make supabase-reset
make supabase-lint
make supabase-diff-check
make supabase-test-db
```

## 2. Medir conflitos reais, lotes e compatibilidade Safari/iOS

**Estado:** concluído em 28 de agosto de 2026 por decisão do desenvolvedor.

### Resultado esperado

Transformar a validação funcional do passo 1 em evidência de capacidade e
compatibilidade. Este passo fecha os riscos que ainda impedem rollout amplo da
outbox e aprovação do PowerSync.

### Escopo técnico

- concorrência realmente simultânea entre dois dispositivos;
- resposta perdida e replay do mesmo `operation_id`;
- contenção, timeouts e ausência de operações presas em `syncing`;
- lotes com 1, 100 e mais de 100 mutações;
- fila próxima e acima de 200 operações;
- fechamento completo do navegador com operação pendente;
- Chrome desktop/Android, Safari desktop/iOS e fallback quando SQLite/WASM ou
  IndexedDB não estiver disponível;
- primeiro pull e conta madura com milhares de itens;
- isolamento entre dois usuários e ausência total de rede de entidades guest.

### Implementação necessária

1. Criar cenários automatizados de concorrência com Supabase local real e dois
   usuários, sem interceptar a API funcional.
2. Criar benchmark reprodutível da RPC `apply_account_operation_batch`,
   registrando p50, p95, p99, erros, locks e throughput.
3. Instrumentar duração, tamanho e resultado dos lotes e idade da operação mais
   antiga, sem tarefa, meta, e-mail ou outro conteúdo privado.
4. Testar atualização do service worker e reinício do navegador sem perder a
   base local.
5. Definir navegadores oficialmente suportados e uma mensagem recuperável para
   storage incompatível ou indisponível.
6. Verificar que a retenção de recibos de sete dias não remove a idempotência
   dentro da janela prometida.

### Evidência implementada

- as métricas locais agora distinguem confirmação, rejeição e indisponibilidade
  de transporte;
- cada tentativa registra duração e quantidade de mutações, incluindo máximos
  observados;
- idade da operação mais antiga, tamanho atual da fila, conflitos, tentativas e
  latência total de confirmação permanecem disponíveis sem conteúdo do usuário;
- o teste de regressão do transporte atrasado comprova que uma fila com duas
  operações faz somente uma tentativa antes do backoff e conserva ambas.
- `make benchmark-account-rpc` inicia somente o Supabase local, rejeita URL não
  local, usa dados sintéticos, mede lotes de 1 e 100, concorrência, p50, p95,
  p99, throughput, erros, timeouts, conflito simultâneo e replay idempotente;
- baseline local de 28 de agosto de 2026, com 30 iterações e concorrência 4:
  lote de 1 com p50 4,7 ms, p95 57,6 ms, p99 59,7 ms e 317,7 lotes/s; lote de
  100 com p50 16,8 ms, p95 27,4 ms, p99 68,0 ms e 196,0 lotes/s; zero erros,
  zero timeouts, um vencedor e um conflito stale na disputa simultânea;
- pgTAP cobre lote exato de 100 e rejeição de 101, ownership de dois usuários,
  rollback integral, replay, reutilização inválida do identificador e retenção
  de recibos dentro dos sete dias; são 81 testes de banco;
- snapshot paginado já cobre 1.001 linhas por tabela e falha da página final sem
  reconciliação parcial; a fila cobre o limite de 200 sem descartar a mudança;
- reload offline e fechamento sem perda são cobertos em desktop e mobile, e o
  service worker tem teste explícito de `skipWaiting`, `clientsClaim` e
  `navigationPreload` sem operação de limpeza do IndexedDB;
- a matriz oficial de navegadores está no README e o fallback de storage agora
  sai do loading para uma tela traduzida, acessível e recuperável.

Gates executados no fechamento da parte automatizável:

- `make benchmark-account-rpc`: baseline concluído sem erro ou timeout;
- `make supabase-reset`, `make supabase-lint` e
  `make supabase-diff-check`: banco limpo, sem erro e sem divergência;
- `make supabase-test-db`: 4 arquivos e 81 testes aprovados;
- `make test-e2e`: 33 cenários aprovados em desktop e mobile e 7 cenários de
  toque corretamente ignorados no projeto desktop;
- `make test-e2e-account`: 4 cenários autenticados aprovados em desktop e
  mobile;
- `make check`: 76 arquivos e 573 testes aprovados, além de tipagem, lint,
  formatação e build.

### Responsabilidade externa

- disponibilizar ao menos dois dispositivos reais, incluindo Safari/iOS;
- autorizar somente contas internas e um ambiente de teste sem dados pessoais;
- registrar modelo do aparelho, navegador, versão, rede e horário dos ensaios;
- acompanhar consumo de banco, transferência e conexões nos painéis gratuitos;
- não executar carga destrutiva no projeto de produção.

Executar a matriz manual em Chrome Android, Safari macOS e Safari iOS com uma
conta interna e dados sintéticos. Para cada ensaio, registrar modelo, versão do
sistema, versão do navegador, tipo de rede e horário; testar fechamento total
com operação pendente, retorno online, atualização da PWA e duas sessões da
mesma conta. Nos painéis gratuitos do Supabase e da Vercel, registrar banco,
transferência, conexões e funções antes e depois. Não executar o benchmark
contra produção.

### Critérios de conclusão

- todos os dispositivos convergem segundo a política definida;
- nenhuma operação se perde após fechamento completo;
- nenhuma chamada cruza usuários ou parte de guest;
- p95 e taxa de erro do lote têm baseline registrado;
- não há fila, lock ou estado `syncing` permanente;
- fallback oferece erro recuperável e não corrompe dados;
- o volume do ensaio cabe nas quotas gratuitas com margem conhecida.

### Conclusão em 28 de agosto de 2026

O desenvolvedor aprovou o baseline automatizado, os ensaios reais já realizados
em desktop e Android e o fallback recuperável de storage como evidência
suficiente para encerrar esta etapa. Safari macOS/iOS e a leitura periódica das
quotas permanecem gates operacionais obrigatórios antes de ampliar a coorte
de convidados; não são tratados como garantia já comprovada.

## 3. Escolher definitivamente entre PowerSync e outbox própria

**Estado:** concluído em 28 de agosto de 2026; outbox própria escolhida.

### Resultado esperado

Encerrar a arquitetura paralela. Ao final haverá uma única estratégia de
persistência remota para contas autenticadas e um plano de migração ou remoção
do caminho rejeitado.

### Decisão e evidências

A estratégia definitiva para contas autenticadas é Dexie com outbox durável e
RPC transacional no Supabase. O PowerSync foi rejeitado porque não reduzia o
código proprietário no estado real: nenhuma das seis entidades funcionais o
usava, enquanto a outbox já cobria calendário, categorias e metas. Adotá-lo
exigiria uma segunda migração local-first completa e manteria riscos distintos
de storage, worker, diagnóstico e rollout.

| Critério         | Outbox própria escolhida                                                                 | PowerSync rejeitado                                                      |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| perda e retry    | operação durável, reload, fechamento, resposta perdida, backoff e reconexão comprovados  | POC comprovou o fluxo isolado, mas nunca as telas funcionais             |
| conflito         | compare-and-set; um rebase automático; ação manual faz a alteração pendente local vencer | last-committed-wins no POC, sem migração funcional validada              |
| incrementalidade | push somente da fila; pull paginado evita reconciliação parcial, mas ainda é snapshot    | streams incrementais, ao custo de um segundo SQLite e serviço            |
| compatibilidade  | IndexedDB e service worker cobertos em desktop/Android; Safari/iOS segue gate manual     | WASM/SQLite, worker e multiaba exigem tratamento adicional por navegador |
| complexidade     | um único banco local, comandos e métricas já integrados às seis entidades                | runtime, schema, rota, flags, replicação e operação paralelos            |
| lock-in e saída  | Postgres canônico, IndexedDB descartável por conta e contratos próprios                  | saída exige retirar SDK, streams, SQLite e serviço                       |
| segurança        | JWT, ownership derivado no servidor, RLS e testes negativos entre usuários               | POC também tinha JWT/RLS, sem vantagem material para o fluxo funcional   |

A outbox mantém IndexedDB e Postgres como únicos bancos da aplicação, sem
acrescentar um serviço de sincronização. O uso e as quotas do Supabase continuam
sujeitos ao acompanhamento operacional dos passos 7 e 8.

### Implementação da retirada

- o pacote `@powersync/web`, seus seis transitivos e o runtime foram removidos;
- a rota `/~powersync-poc`, sua UI, dicionários, testes e target Make foram
  removidos;
- as três flags públicas e `powersync/sync-config.yaml` foram removidos;
- o início global do POC foi retirado do `AppProvider`;
- o schema declarativo, tipos e pgTAP não contêm mais objetos do POC;
- a migration `20260828180055_remove_powersync_poc.sql` remove funções, tabelas
  isoladas e a publicação na ordem segura;
- um teste arquitetural impede reintroduzir pacote, diretórios, flags ou schema
  PowerSync enquanto a decisão estiver vigente.

As migrations históricas permanecem intactas. Isso preserva a reprodução do
histórico e permite reconstruir a prova em ambiente isolado a partir do commit
anterior, sem restaurar dados funcionais ou criar dual-write.

### Evidência automatizada de 28 de agosto de 2026

- RED: o teste arquitetural falhou enquanto `@powersync/web` ainda constava no
  manifest;
- GREEN: 75 arquivos e 548 testes Vitest aprovados;
- `make check` aprovou tipagem, lint, proibição de comentários, testes,
  formatação e build; o mapa final não contém `/~powersync-poc`;
- `make supabase-reset`, `make supabase-lint` e
  `make supabase-diff-check` aprovaram banco limpo, lint e paridade declarativa;
- `make supabase-test-db` aprovou 2 arquivos e 50 testes pgTAP funcionais;
- `make test-e2e` aprovou 33 cenários e ignorou os 7 cenários de toque no
  projeto desktop conforme configurado;
- `make test-e2e-account` aprovou 4 cenários autenticados e
  `make test-e2e-offline` aprovou 2 cenários de reload offline;
- `make audit-prod` encontrou zero vulnerabilidades de produção.

### Rollout e rollback

O mesmo merge protegido entrega a aplicação sem rota, runtime e flags e aplica
a migration. A ordem externa entre Vercel e o workflow de banco não afeta as
telas funcionais porque o POC estava desligado e isolado; a ordem geral entre
migrations e deploy foi resolvida depois, no passo 5. A remoção afetou
exclusivamente dados
sintéticos das tabelas `powersync_poc_*`. Antes de aplicar em produção,
confirmar que não existe ensaio do POC em andamento e exportar as tabelas apenas
se houver valor de diagnóstico. O rollback funcional continua sendo esvaziar a
flag da outbox e usar o caminho legado. Reativar PowerSync exige
decisão nova, restauração explícita do POC em ambiente isolado e outra
migration; não faz parte do rollback operacional.

### Responsabilidade externa

Concluída em 2026-09-21; a verificação final está no
[registro do incidente](../operations/incidents/2026-08-31-supabase-wal-read-only.md).

- publicar a mudança pelo fluxo protegido e confirmar os checks;
- confirmar antes da migration que não existe ensaio do POC em andamento;
- remover da Vercel as três variáveis `NEXT_PUBLIC_*POWERSYNC*` após o deploy;
- no PowerSync Dashboard, parar e excluir a instância/projeto de desenvolvimento;
- no Supabase, revogar/remover o usuário exclusivo de replicação depois que a
  publicação e as tabelas tiverem sido removidas;
- verificar que calendário, categorias, metas, offline e reconexão continuam
  funcionando na conta interna após o deploy.

### Critérios de conclusão

A decisão contém evidências, custo estimado, navegadores suportados, política de
conflito, rollout e rollback. `SYNC-01` usa agora somente a outbox nas telas
reais; a retirada do caminho temporário está implementada e validada em banco
limpo. A etapa conclui após aprovação explícita do desenvolvedor neste turno.

### Incidente durante a retirada em produção

Em 31 de agosto de 2026, a limpeza externa encontrou um replication slot
inativo do PowerSync retendo WAL. O Supabase saturou recursos, ficou
temporariamente indisponível e depois entrou em modo somente leitura. A
migration de retirada já estava na `main`, mas o workflow de produção falhou
durante a indisponibilidade e abriu a issue `#32`. O slot e a role exclusiva
foram removidos, o banco voltou a `default_transaction_read_only = off` e o
disco iniciou recuperação de 96% para 93%. Em 2026-09-21, a verificação final
confirmou a migration aplicada, os objetos removidos e o banco fora do modo
somente leitura; a role remanescente foi removida em seguida.

O diagnóstico, a recuperação e a ordem segura para retirar futuros
consumidores de replicação estão no
[registro do incidente](../operations/incidents/2026-08-31-supabase-wal-read-only.md).

## 4. Implementar observabilidade, backup e restauração

### Estado atual

Implementação de código concluída em 31 de agosto de 2026. O adapter independente usa Sentry Free com
captura exclusivamente manual, allowlist e teste de redaction. Métricas
agregadas de outbox e refresh incluem release e navegador sem identidade ou
conteúdo funcional. O workflow diário gera dump lógico, cifra antes do upload,
retém o artefato no GitHub por 14 dias e abre issue em caso de falha. O comando
de restore usa um Postgres Supabase isolado e mede RPO/RTO.

A configuração externa do Sentry foi concluída em 22 de setembro de 2026:
projeto criado com apenas error monitoring, DSN e environment cadastrados
somente no escopo de produção da Vercel, cinco regras de alerta filtradas por
`telemetry_signal` e alerta sintético executado, inspecionado e revertido. As
evidências e a limitação de geolocalização estão em
`docs/operations/observability-backup-restore.md`.

O workflow diário de backup está habilitado desde 22 de setembro de 2026. As
falhas de 29 e 30 de setembro e as 9 falhas em 13 execuções entre 19 e 31 de
outubro tiveram a mesma causa: `toomanyrequests: Data limit exceeded` ao baixar
a imagem do Postgres usada pela CLI, no ECR público. A partir de `ce9e7d1`, o
workflow usa `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` com a CLI 2.98.2; a
imagem GHCR executa `pg_dump` 17.6. A estabilidade com essa configuração é a
[verificação pendente](#verificar-o-backup-diário-com-ghcr).

O restore do artefato real foi aprovado pelo proprietário em 2 de novembro de
2026, em uma segunda máquina Linux, com o run `41520276777`: 10 tabelas
públicas, `rpoMs = 2859601`, `rtoMs = 3454` e exit status 0, com limpeza
confirmada. Antes disso, a chave antiga não autenticou o artefato e foi
substituída com autorização do proprietário, e o utilitário de restore precisou
de quatro correções, cada uma reproduzida por teste antes da mudança:

- esperar o Postgres por TCP, não pelo servidor temporário do entrypoint;
- remover também os volumes anônimos do container;
- executar as migrations oficiais do Auth (GoTrue v2.197.0);
- executar as migrations oficiais do Storage (v1.81.0, pelo Docker Hub).

`make test-backup` cobre cifra, espera e timeout; `make test-backup-restore`
restaura em Docker um arquivo sintético com o schema completo do Tick, Auth e
Storage. O dump real nunca foi editado ou filtrado para obter sucesso. As
tentativas, horários e mensagens estão em
[observability-backup-restore.md](../operations/observability-backup-restore.md).

Por decisão do proprietário em 2026-11-02, o ensaio feito por ele em duas
máquinas é suficiente; a exigência de uma segunda pessoa foi dispensada e não
há revisão independente executada ou pendente. O passo 4 foi encerrado por
aceite, sem ensaio de rollback; o roteiro está em
[two-machine-backup-restore.md](../operations/two-machine-backup-restore.md).

### Resultado esperado

Permitir detectar, diagnosticar e recuperar falhas sem inspecionar manualmente
o navegador do usuário e sem enviar conteúdo privado.

### Implementação necessária

1. Escolher um destino de erros e métricas compatível com o plano atual.
2. Criar um adaptador de telemetria independente do fornecedor.
3. Enviar agregados de fila, idade, tentativas, conflitos, rejeições, latência,
   versão, navegador e resultado do refresh.
4. Aplicar redaction e allowlist explícita de campos; tarefa, meta, categoria,
   e-mail, token e payload nunca podem sair do dispositivo.
5. Criar alertas para fila acumulada, operação antiga, aumento de erro e
   indisponibilidade de API; quotas são acompanhadas manualmente pelo
   proprietário, por decisão de 2026-11-02.
6. Documentar runbooks de incidente, rollback de flag, migration compensatória
   e comunicação ao usuário.
7. Manter o backup externo automatizado para recuperar dados das contas convidadas.
8. Restaurar um backup em Postgres local ou projeto temporário isolado e medir
   RPO e RTO.

### Responsabilidade externa

- escolher provedor, retenção, região, acesso e limites de alerta;
- criar projeto/DSN e cadastrar secrets somente no ambiente necessário;
- definir RPO, RTO, política de privacidade e período de retenção;
- gerar backup e autorizar o ensaio em ambiente isolado, nunca em produção;
- revisar no painel que uma falha sintética alerta sem conteúdo do usuário.

### Critérios de conclusão

- falha de sincronização aparece no painel e dispara alerta acionável;
- teste de redaction impede PII e conteúdo funcional;
- o proprietário acompanha quotas manualmente; alertas existentes são preservados;
- backup é restaurado em uma segunda máquina pelo proprietário seguindo o runbook; segunda pessoa dispensada por decisão de 2026-11-02;
- RPO e RTO medidos estão registrados;
- rollback de aplicação, flag e banco foi ensaiado.

Os critérios de backup, restore, RPO e RTO foram atendidos; o ensaio de
rollback não foi executado e o aceite do proprietário o dispensou nesta etapa.
A estabilidade diária do backup segue em
[pendências abertas](#verificar-o-backup-diário-com-ghcr).

## 5. Fechar deploy ordenado entre GitHub, Supabase e Vercel

**Estado:** aceito pelo proprietário em 2 de novembro de 2026 e comprovado com
migration real em 3 de novembro de 2026.

### Resultado esperado

Garantir a sequência `quality gate → migrations → deploy` para o mesmo SHA,
com rollback documentado.

### Estado atual

O ruleset da `main` exige `Check app`, `Check database` e `Check end-to-end`.
O workflow `supabase-migrations.yml` roda somente após App CI aprovado na
`main`, usa o `head_sha`, faz dry-run, aplica migrations pelo environment
`production` e só então executa `deploy-production`. Esse job confirma que a
`main` ainda está no SHA aprovado e dispara o Deploy Hook
`VERCEL_DEPLOY_HOOK_URL`. Commits sem mudança de banco passam pelo mesmo
caminho sem executar a CLI do Supabase. Execuções de produção são serializadas
sem descartar pendentes.

O `vercel.json` desliga o auto-deploy Git da `main` por
`git.deploymentEnabled`; previews das outras branches continuam. A produção é
publicada somente pelo hook.

App CI e o workflow de migrations avisam falha pela action composta
`.github/actions/report-failure`, que abre ou comenta uma issue atribuída ao
dono do repositório. Uma auditoria horária compara migrations locais e remotas
e transforma divergência em `pipeline-failure`, detectando um `workflow_run`
perdido assim que o Actions volta a operar; nenhuma automação dentro do próprio
GitHub alerta enquanto a plataforma inteira estiver indisponível.

O `make publish` espera os checks obrigatórios antes de armar
`gh pr merge --auto`. Uma interrupção durante os checks deixa o pull request
aberto sem merge automático; depois que ele é armado, a espera continua enquanto
o pull request estiver aberto e falha somente quando o GitHub informa outro
estado terminal.

### Modos de falha do pipeline

Com o Actions indisponível antes do merge, o ruleset impede o merge e a produção
não muda. Depois do merge, um App CI reprovado na `main` não dispara migrations
nem deploy: a produção permanece na versão anterior até uma nova publicação.
Uma migration que falha impede o deploy. Se a `main` avançar durante o pipeline,
o deploy daquele SHA é abortado e a publicação seguinte refaz a sequência.
O Deploy Hook não recebe SHA no payload; a checagem da `main` imediatamente
antes do POST fecha essa janela.

### Evidências

| Data       | SHA       | Execuções                                                             | Resultado                                                            |
| ---------- | --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2026-09-23 | `a00e5b4` | `35898587204`                                                         | migrations aplicadas; deploy falhou por falta do secret, issue `#43` |
| 2026-11-02 | `ce9e7d1` | App CI `41535884511`, pipeline `41536456800`, auditoria `41537177311` | sem mudança de banco; hook disparado depois do job de migrations     |
| 2026-11-03 | `b3ddc8f` | App CI `41555806499`, pipeline `41556272686`                          | migration `20261103001239` aplicada às 00:56:44Z; hook às 00:56:48Z  |

Em 2026-11-03, o painel da Vercel mostrou um único deployment de Production
para `b3ddc8f` e outro para `ce9e7d1`, ambos `Ready` e disparados pelo hook. O
deployment de `a00e5b4` ainda veio da integração Git. O registro completo está
em [deploy-hook-setup.md](../operations/deploy-hook-setup.md).

### Responsabilidade externa

1. Manter `VERCEL_DEPLOY_HOOK_URL`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` somente no environment
   protegido `production`.
2. Tratar a URL do hook como secret; se vazar, revogá-la na Vercel e cadastrar
   uma nova.
3. Em cada publicação relevante, conferir a ordem dos jobs e o deployment único
   na Vercel.

### Critérios de conclusão

- gate falho não migra nem publica;
- banco e aplicação usam o mesmo SHA aprovado;
- commit sem migration ainda publica corretamente;
- migration falha impede deploy;
- execução manual respeita os mesmos gates;
- rollback compensatório e restauração isolada foram ensaiados;
- falha do pipeline gera aviso acionável sem depender da subscription do pull
  request silenciada pelo `make publish`;
- pipeline que não executa é detectado, e nenhum SHA da `main` permanece com
  migration pendente em silêncio;
- interrupção do `make publish` deixa estado previsível e documentado.

O mesmo SHA, a publicação sem migration, a publicação com migration, o aviso
de falha e a auditoria horária estão comprovados pelas execuções acima. A
dependência do deploy em relação às migrations e a recusa de SHA superado são
verificadas por `make test-release-workflow`. A execução manual roda
`make check` e `make audit-prod` antes das migrations. Migration falha em
produção, execução manual e rollback compensatório não foram ensaiados e
seguem como procedimento operacional.

## 6. Preservar guest completo e acesso remoto por convite

### Política definida em 2026-11-02

O aplicativo permanece fechado para contas remotas: somente convidados
explicitamente autorizados na allowlist podem usar Supabase Auth e sincronizar.
O modo guest continua disponível sem conta, com todas as funcionalidades de
organização, gratuito, sem prazo e sem limites de quantidade impostos pelo
produto. Não é uma demonstração com exemplos descartáveis.

O contrato completo está em [guest-and-invited-access.md](guest-and-invited-access.md).
Essa decisão preserva o comportamento atual e substitui as propostas anteriores.

### Evidência automatizada de 2026-11-02

`make test-access-policy` passou em 47 testes. O cenário guest importa 205
itens pelo comando existente, cria meta e etapa, fecha/reabre IndexedDB e avança
o relógio em dez anos. Os dados permanecem editáveis e o cliente de persistência
remota não é inicializado. O E2E acrescenta fechar/reabrir a página, continuar
editando e verificar ausência de requisições remotas de entidades. Os E2E
locais passaram em 43 cenários, com 19 skips condicionais, e os autenticados
em quatro cenários.

A política e os testes foram publicados em produção em 2026-11-03, no SHA
`b3ddc8f`, junto com o texto de login "O acesso à conta é somente por convite".

### Invariantes

- `guest:<installationId>` lê e grava somente no IndexedDB do dispositivo.
- Guest não envia entidades, não cria conta remota e não usa Supabase para
  persistir dados; o app continua utilizável sem rede.
- Fechar/reabrir o app ou decorrer um prazo não apaga nem bloqueia o progresso.
- `user:<supabaseUserId>` exige sessão e acesso permitido em `account_access`.
- Contas sem autorização não acessam dados remotos; RLS deriva ownership da sessão.
- Mudar de modo ou de conta nunca mistura entidades nem importa dados guest.
- Falha de rede mantém operações da conta na outbox e oferece recuperação.
- Limites físicos do navegador e quotas dos serviços não são limites de produto.

### Trabalho de manutenção

1. Preservar a allowlist no servidor e revisar acesso quando convidados entram
   ou saem; não abrir cadastro irrestrito.
2. Manter cobertura de guest offline, reload, persistência, escopos e ausência
   de chamadas remotas de dados guest.
3. Manter autorização negativa, retry e convergência das contas convidadas.
4. Explicar na interface que os dados guest ficam somente neste navegador,
   sem prometer cópia remota; manter os textos pt-BR/en coerentes.
5. Preservar os dados existentes em toda manutenção de schema e atualização.

### Critérios de conclusão

- funcionalidades locais completas sem ativação ou contagem de dias;
- dados guest permanecem após fechar/reabrir o app;
- nenhum dado guest é enviado ao Supabase;
- somente contas convidadas acessam persistência remota;
- dois usuários e a alternância guest/conta mantêm isolamento;
- gates do REVIEW continuam aprovados nas mudanças relevantes.

## 7. Acompanhar desempenho pelo uso real

### Decisão do proprietário

O escopo está definido: uma pessoa em três dispositivos, com teto conservador
de 20 convidados. Aprovação adicional de modelo de carga, budgets e ensaios de
capacidade não é pendência nem condição de publicação nesta etapa.

Investigar se a interface deixar de responder, se a sincronização normalmente
ultrapassar cerca de 20 segundos ou se surgir erro, perda, sobrescrita ou fila
que não progride. Preservar o trabalho do usuário durante toda a investigação.
Sem rede, preservar a fila e retomar quando possível, sem impor prazo de descarte.

### Política de otimização

- Evitar N+1, payloads desnecessários, trabalho repetido e consultas sem limite.
- Escolher alternativas evidentemente melhores quando o custo de implementação
  for semelhante; não exigir benchmark para cada decisão simples.
- Medir quando isso ajudar a explicar um problema real ou escolher uma mudança
  relevante; não otimizar preventivamente com abstrações de baixo retorno.
- Manter a ferramenta de comparação de 10% disponível para diagnóstico
  voluntário, sem convertê-la em gate obrigatório de release.
- Validar funcionalidade, autorização, retry e preservação de dados normalmente.

### Instrumentação e baseline entregues em 2026-11-02

`make benchmark-cohort` cria Supabase local temporário, executa migrations,
lint, diff declarativo, pgTAP e mede HTTP real de uma conta sintética, sem
reset do banco de trabalho. O primeiro baseline tem 5.000 etapas, profundidade
20, quatro workers e 30 requisições por tamanho de lote, sem erros. Primeiro
pull: 10 páginas de 500 linhas, cerca de 3,14 MB de JSON e 1,140 s.

P95 de lotes de uma mutação: 54,68 ms; de cem: 19,14 ms. Esses valores incluem
variação local/cache e não provam que lotes maiores são sempre mais rápidos.
Conflito retornou `PT409/stale_revision`, replay foi idempotente e a limpeza
terminou. Snapshots incluem memória, CPU, I/O e contadores do banco, sem medida
de pico sustentado. O
[guia de capacidade](../operations/cohort-capacity.md) descreve parâmetros,
limites, comparação de 10% e responsabilidade externa. `make bundle-report` preserva também o baseline
de assets JS do build padrão: 34 arquivos, cerca de 2,15 MB brutos e 647 KB
gzip, sem inferir payload inicial ou velocidade em rede móvel. O
[baseline JSON](../operations/baselines/cohort-local.json) é uma amostra
sintética, não aprovação do tamanho da coorte nem estimativa de custo remoto.

O ensaio reproduziu um problema anterior: `40001` em conflito de negócio fazia
o PostgREST repetir a transação até timeout. A correção declarativa usa `PT409`
e mantém as mensagens, com migration gerada por diff e validação isolada.
[Diagnóstico e rollout](../operations/incidents/2026-11-02-rpc-conflict-retries.md).
A migration `20261103001239_avoid_rpc_conflict_retries.sql` foi aplicada em
produção pelo pipeline ordenado em 2026-11-03, no SHA `b3ddc8f`.

### Acompanhamento

O proprietário observa sua utilização nos três dispositivos e acompanha os
painéis manualmente. Diante de lentidão concreta, registrar ação, volume,
dispositivo, rede e duração aproximada; então reproduzir, corrigir e validar.
Não há carga adicional em produção ou infraestrutura nova a preparar agora.
A extração do passo 10 e os testes de integridade permanecem válidos.

## 8. Manter o ambiente atual e acompanhar recursos

Manter GitHub Free, Vercel Hobby e Supabase Free, a integração Git, o pipeline
protegido, o backup cifrado e a auditoria já validados. O frontend permanece
Next.js; não há mudança de hospedagem ou visibilidade do repositório nesta etapa.

O proprietário acompanha manualmente armazenamento, WAL, conexões, tráfego,
erros e uso de Actions. Não adicionar monitoramento de capacidade, alertas de
quota ou nova infraestrutura como requisito desta etapa. Preservar os alertas
operacionais existentes e corrigir problemas se forem observados, sem apagar
dados, desativar backup ou enfraquecer autorização silenciosamente.

Critério de manutenção: convidados autorizados conseguem usar o app, o modo
guest permanece independente dos serviços remotos e incidentes têm evidência,
responsável e recuperação pelos runbooks existentes.

## 9. Validar a interface de toque em aparelho real

**Estado:** concluído em 18 de outubro de 2026 por aprovação do desenvolvedor
após o ensaio em aparelhos físicos.

### Resultado esperado

A adaptação mobile entregue por `(pointer: coarse)`, área de acerto de 44px,
drag de árvore por Pointer Events e densidade compacta do calendário precisa de
confirmação em aparelho físico, não apenas em emulação do Playwright.

### Estado atual

A cobertura automatizada roda no perfil Pixel 7 do Chromium, em
`tests/e2e/mobile-layout.spec.ts`, junto de testes unitários para o hook de
ponteiro, o contrato de placement do drag e a densidade do calendário. Nada
disso exercita Safari/iOS, teclado virtual real, gesto de arrasto com dedo nem
`env(safe-area-inset-*)` em aparelho com notch.

### Implementação necessária

1. Executar ensaio manual em Android e em iOS cobrindo criação de tarefa,
   reordenação por arrasto, abertura de dia por toque, tooltip por toque longo
   e teclado virtual sobre campos no fim da tela.
2. Confirmar que o recuo de safe area não corta cabeçalho nem ações, incluindo
   a barra de navegação inferior sob notch e sob indicador de home.
3. Confirmar que `interactiveWidget: 'resizes-content'` se comporta como
   esperado no Safari/iOS, que ainda não implementa a propriedade, com o campo
   de hora aberto dentro da folha de ações da linha.
4. Exercitar a faixa de semana: arrasto horizontal, troca de semana, virada de
   mês e persistência do dia selecionado ao reabrir o app.
5. Exercitar a folha de ações da linha com teclado virtual aberto e com texto
   longo, e a folha de visão de mês em tela pequena.
6. Registrar o resultado no REVIEW e abrir correção dedicada por divergência.

### Critérios de conclusão

- ensaio aprovado em pelo menos um Android e um iOS;
- divergências corrigidas ou registradas com plano;
- nenhuma regressão no desenho desktop.

## 10. Extrair responsabilidades de `goals-surface.tsx`

### Resultado esperado

`src/features/goals/goals-surface.tsx` deixa de ser um módulo único de mais de
quatro mil linhas e passa a expor componentes coesos, dentro do limite de 800
linhas lógicas por módulo definido no REVIEW.

### Implementação em 2026-11-02

`goals-surface.tsx` passou de 4.357 para 467 linhas físicas e concentra
roteamento e composição. Cards de meta/grupo, grid, cabeçalhos, menus de
categoria, edição de etapas e drafts possuem módulos próprios. O estado de
arrasto está em `use-goal-drag.ts`; seu contrato de placement foi preservado.
Todos os módulos da área permanecem abaixo de 800 linhas físicas e lógicas.

A suíte original de 74 testes foi preservada e dividida por contexto, usando
fixtures e mocks compartilhados em `tests/support/goals-surface-harness.tsx`.
`make test-goals` cobre esses cenários e testes próximos. Não houve mudança
intencional de regras, desenho, nomes acessíveis ou persistência.
Validação: 648 testes no gate completo, 43 E2E locais e quatro autenticados
aprovados; lint, tipos, formatação e build padrão aprovados. Publicado em produção
em 2026-11-03, no SHA `b3ddc8f`.

### Critérios de conclusão

- nenhum módulo de metas acima de 800 linhas lógicas;
- nenhuma mudança de comportamento observável;
- gates do REVIEW aprovados a cada extração.
