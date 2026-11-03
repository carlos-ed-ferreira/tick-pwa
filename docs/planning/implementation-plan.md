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

| Passo | Estado               | Próximo marco                                     |
| ----- | -------------------- | ------------------------------------------------- |
| 1     | concluído            | manter rollout restrito até ampliar a coorte      |
| 2     | concluído            | manter a matriz real ao ampliar convidados        |
| 3     | concluído            | manter outbox própria e recursos POC removidos    |
| 4     | concluído por aceite | monitorar backup e reabrir se houver falha        |
| 5     | concluído por aceite | manter deploy ordenado e auditoria de migrations  |
| 6     | validado localmente  | manter guest completo e acesso remoto por convite |
| 7     | escopo definido      | observar uso real e investigar lentidão relevante |
| 8     | contínuo             | manter ambiente atual e acompanhar recursos       |
| 9     | concluído            | repetir o ensaio físico em mudança de toque       |
| 10    | implementado         | manter módulos de metas coesos e suíte verde      |

Os passos 4 e 5 foram encerrados por aceite explícito do proprietário após a
publicação bem-sucedida de `ce9e7d1`, em 2026-11-02. App CI, migrations/deploy
e auditoria foram conferidos no GitHub. O aceite encerra as pendências de funcionamento dos workflows, sem aguardar
nova série de backups. Cenários adicionais de falha e rollback não foram
ensaiados nesta rodada e continuam como procedimentos operacionais. Evidências e limites em
[deploy-hook-setup.md](../operations/deploy-hook-setup.md).

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

A etapa permanece aberta somente para a ativação restrita, o novo deploy e os
ensaios reais descritos abaixo. Evidência simulada ou local não substitui essa
validação de produção.

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
`make check`. Ela aguarda publicação e repetição do ensaio real antes de concluir
a etapa.

Um segundo ensaio expôs o caso em que o Chromium devolve
`ERR_INTERNET_DISCONNECTED`, mas `navigator.onLine` ainda permanece `true`. O
erro estruturado do Supabase chega sem código e com `TypeError: Failed to fetch`;
por isso ainda era tratado como rejeição remota. A outbox agora reconhece esse
erro de transporte, mantém a operação em `pending`, interrompe o restante do
lote e agenda retry com backoff. Isso evita disparar uma RPC para cada operação
pendente durante a indisponibilidade. Erros de domínio, autorização, validação e
conflito continuam no fluxo de falha recuperável. O aviso de PowerSync sobre
múltiplas abas é independente: a prova permanece intencionalmente em modo
single-tab e não participa da persistência funcional dessas telas.

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
deploy. Não alterar as flags do PowerSync neste ensaio.

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
telas funcionais porque o POC está desligado e isolado; ordenar deploys de forma
geral continua sendo a lacuna do passo 5. A remoção afeta exclusivamente dados
sintéticos das tabelas `powersync_poc_*`. Antes de aplicar em produção,
confirmar que não existe ensaio do POC em andamento e exportar as tabelas apenas
se houver valor de diagnóstico. O rollback funcional continua sendo esvaziar a
flag da outbox e usar o caminho legado durante a alfa. Reativar PowerSync exige
decisão nova, restauração explícita do POC em ambiente isolado e outra
migration; não faz parte do rollback operacional.

### Responsabilidade externa

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
disco iniciou recuperação de 96% para 93%. A execução manual do workflow e a
confirmação da remoção dos objetos permanecem como fechamento externo.

O diagnóstico, a recuperação e a ordem segura para retirar futuros
consumidores de replicação estão no
[registro do incidente](../operations/incidents/2026-08-31-supabase-wal-read-only.md).

## 4. Implementar observabilidade, backup e restauração

### Estado em 31 de agosto de 2026

Implementação de código concluída. O adapter independente usa Sentry Free com
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

Os secrets de backup foram cadastrados e o workflow diário está habilitado desde
22 de setembro de 2026. As execuções de 29 e 30 de setembro falharam ao baixar a
imagem usada pela CLI do Supabase, com `toomanyrequests: Data limit exceeded` do
Docker Hub, e abriram a issue `#44`. Todas as execuções de 1º a 18 de outubro
terminaram com sucesso.

Na revisão de 2 de novembro de 2026, `make backup-status` confirmou dez falhas
entre 19 e 31 de outubro, intercaladas com sucessos. O log do run
`41163812529`, de 31 de outubro, mostra `toomanyrequests: Data limit exceeded`
ao baixar `public.ecr.aws/supabase/postgres:17.6.1.106`, antes do dump de roles.
Portanto, esse caso é limitação do registro público ECR, não do Docker Hub nem
evidência de senha inválida. A mitigação preparada em 2026-11-02 usa
`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`, mantendo a CLI 2.98.2. A imagem
GHCR executou pg_dump 17.6, o dry-run local passou e o workflow tem teste de
regressão. É necessário publicar e observar novas execuções no GitHub.
Não há garantia de RPO diário enquanto houver execuções perdidas.

Os runs de 1º e 2 de novembro passaram. O run `41382697246`, de 2 de novembro,
tem o artefato `tick-production-backup-41382697246`, não expirado, de 364.412
bytes, com expiração em `2026-11-16T03:23:31Z`. Seu SHA é
`a00e5b4303b09d2f687b885c6ceeb69ce03cb7ec`. Isso permite iniciar o restore na
segunda máquina sem aguardar uma nova publicação; sucesso de upload ainda não
comprova a restauração.

No ensaio externo de 2 de novembro, a chave recuperada não autenticou o arquivo.
O proprietário autorizou sua substituição e gerou o run `41520276777`, concluído
com sucesso. O novo artefato passou da decifragem no Linux, mas a restauração
encontrou `pg_stat_statements` em criação concorrente no container. A correção
aguarda o servidor definitivo por TCP e remove também os volumes temporários;
regressão e restore sintético são cobertos por `make test-backup` e
`make test-backup-restore`. Naquela etapa a repetição externa ainda estava
pendente; ela foi aprovada depois, conforme o registro abaixo. Detalhes em
[observability-backup-restore.md](../operations/observability-backup-restore.md).

A repetição externa com a espera TCP expôs a ausência de `auth.jwt()` na imagem
Postgres sem as migrations do serviço Auth. O primeiro ajuste preparou essa
função pela definição oficial, somente no container isolado. O teste sintético passou
a usar o schema completo do Tick, usuário, perfil e verificação de claims e
acesso; reproduziu o erro antes da correção e restaurou as 10 tabelas depois.
Naquela etapa a prova externa ainda estava pendente; o ensaio não pode ignorar incompatibilidades
de Auth/Storage nem ser apresentado como validação de login.

O ensaio seguinte encontrou `audit_log_entries.ip_address` ausente. A preparação
pontual de `auth.jwt()` foi substituída pela execução de `auth migrate` na imagem
oficial GoTrue v2.197.0, usando somente o Postgres isolado e credenciais
aleatórias locais. O teste Docker reproduziu o erro com um `COPY` de auditoria e
passou após a preparação completa de Auth, incluindo o campo `is_anonymous` de
usuários. `make backup-restore-prepare` baixa as imagens antes de medir o
RTO. Naquela etapa o restore de produção no Linux ainda estava pendente; não remover dados ou
ignorar erros de tabelas internas para declarar aprovação.

A tentativa seguinte expôs `storage.buckets` ausente. O ambiente de restore
também passou a executar as migrations oficiais de Storage v1.54.1, somente no
Postgres temporário. Um `COPY` de bucket reproduziu o erro antes da correção;
o teste passou com essa preparação e inclui metadados de objeto sintéticos.
O preparo baixa agora Postgres, Auth e Storage. O artefato não foi filtrado ou
alterado para contornar a falha, e naquela etapa a repetição externa ainda estava pendente; foi aprovada depois, conforme a evidência abaixo.

A v1.54.1 não possuía `storage.buckets.versioning_status`, presente no dump.
Depois de reproduzir essa incompatibilidade, o ambiente de restore passou para
Storage v1.81.0, versão fixada a partir do Compose oficial atual, usando Docker
Hub como origem para evitar o limite do ECR. O teste inclui agora os campos de
versionamento de buckets, objetos e configuração de ciclo de vida. A versão
dos serviços deve acompanhar o schema do backup; uma restauração sintética
parcial não substitui o ensaio completo do artefato real.

O restore do arquivo real foi executado com sucesso pelo proprietário no Linux
Acer A15 em 2 de novembro de 2026, entre `21:22:27Z` e `21:22:43Z`
(`18:22:27` a `18:22:43` em São Paulo), usando o run `41520276777` e o checkout
histórico com as correções locais do utilitário. Resultado: 10 tabelas públicas,
`backupCreatedAt = 2026-11-02T20:34:59.902Z`, `rpoMs = 2859601`,
`rtoMs = 3454` e exit status 0. A idade do artefato foi de 47 min 39,601 s;
isso não comprova RPO diário durante as falhas intermitentes do workflow.

Por decisão explícita do proprietário em 2026-11-02, o ensaio conduzido por
ele em dois dispositivos é suficiente para a validação de restore. A exigência
de segunda pessoa foi dispensada, para os ensaios futuros. Isso
aceita a ausência de uma revisão humana independente; essa revisão não foi
executada nem fica como pendência. O restore real já foi comprovado.

A saída da limpeza confirmou ausência de containers do ensaio. A remoção
inicial parou nos arquivos protegidos de `.git/objects/pack`, mas a repetição
com `rm -rf --` somente nos dois caminhos temporários retornou
`Limpeza concluída.`. O restore e a limpeza em duas máquinas estão concluídos.
Após a publicação, o proprietário aceitou encerrar a etapa sem aguardar
nova série de backups ou ensaios operacionais adicionais. O passo 4 está
concluído por esse aceite; a prova de restore e limpeza está em
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
5. Criar alertas para fila acumulada, operação antiga, aumento de erro,
   indisponibilidade de API e 70% de quota crítica.
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

## 5. Fechar deploy ordenado entre GitHub, Supabase e Vercel

### Resultado esperado

Garantir a sequência `quality gate → migrations → deploy` para o mesmo SHA,
com rollback documentado.

### Estado atual

O ruleset da `main` exige `Check app`, `Check database` e `Check end-to-end`.
O workflow de migrations roda somente após App CI aprovado na `main`, usa o
`head_sha`, faz dry-run e aplica migrations pelo environment `production`. Em
14 de setembro de 2026, o workflow passou a disparar o Deploy Hook somente após
a migration e a falhar se a `main` tiver avançado antes do disparo. Commits sem
mudança de banco seguem pelo mesmo job e chegam ao deploy sem executar a CLI do
Supabase.

Desde 27 de agosto de 2026, App CI e o workflow de migrations avisam falha pela
action composta `.github/actions/report-failure`, que abre ou comenta uma issue
atribuída ao dono do repositório. O aviso cobre somente execução que falhou.
Uma auditoria horária agora compara migrations locais e remotas e transforma
divergência em `pipeline-failure`. Ela detecta um `workflow_run` perdido assim
que o Actions volta a operar; nenhuma automação dentro do próprio GitHub pode
alertar enquanto a plataforma inteira estiver indisponível.

O Deploy Hook é vinculado à branch e não recebe SHA no payload. A checagem da
`main` fecha a janela anterior ao POST e o resumo registra o SHA aprovado e o
identificador do job aceito, mas a associação final precisa ser confirmada no
primeiro deploy real da Vercel.

### Modos de falha do pipeline

Com o Actions indisponível antes do merge, o ruleset impede o merge e a produção
não muda. O risco vive depois do merge: a Vercel publica pela integração Git,
que não depende do Actions, enquanto a migration depende. Um App CI reprovado na
`main`, mesmo por falha de infraestrutura alheia ao código, publica o frontend e
não aplica a migration daquele SHA. Enquanto o deploy não for ordenado, a
compatibilidade N/N+1 é a única proteção dessa janela.

O `make publish` agora espera os checks obrigatórios antes de armar
`gh pr merge --auto`. Uma interrupção durante os checks deixa o pull request
aberto sem merge automático; depois que ele é armado, a espera continua enquanto
o pull request estiver aberto e falha somente quando o GitHub informa outro
estado terminal.

### Implementação entregue em 14 de setembro de 2026

O repositório agora:

1. executa `deploy-production` somente depois de `migrate-production`;
2. trata commit sem mudança de banco sem impedir o deploy;
3. falha com mensagem clara quando o hook está ausente ou responde erro;
4. registra SHA aprovado, identificador e estado inicial do job da Vercel;
5. audita a cada hora o histórico local e remoto de migrations;
6. reporta falha de migration, deploy ou auditoria pela mesma issue;
7. serializa execuções de produção sem descartar execuções pendentes;
8. espera os checks obrigatórios antes de armar o auto-merge no `make publish`.

RED/GREEN: testes novos falharam pela ausência do job de deploy, agendamento,
detector de drift e ordem segura do auto-merge; depois da implementação, 79
arquivos e 565 testes Vitest passaram.

### Estado em 18 de outubro de 2026

A publicação de `a00e5b4` em 23 de setembro aplicou as migrations e falhou no
job de deploy com `Missing VERCEL_DEPLOY_HOOK_URL in the production
environment.`, abrindo a issue `#43`. O secret continua ausente, então toda
publicação falhará no mesmo ponto até a configuração externa; a produção segue
atualizada apenas pelo auto-deploy da Vercel, sem ordem garantida. As falhas da
auditoria horária em 5 e 6 de outubro foram `FGA Authentication Error` da API do
Supabase, transitórias; as execuções seguintes passaram.

O painel da Vercel não oferece desligar o auto-deploy de uma única branch. O
caminho adotado é `vercel.json` com `git.deploymentEnabled` desligado para
`main`, adicionado somente depois de o hook estar cadastrado e testado. O
roteiro exato está em
[deploy-hook-setup.md](../operations/deploy-hook-setup.md).

### Estado antes da publicação em 2 de novembro de 2026

O proprietário informou a criação do hook. A API do GitHub confirmou o secret
`VERCEL_DEPLOY_HOOK_URL` no environment `production`, com criação e atualização
em `2026-11-02T21:39:25Z`. A URL não foi lida nem acionada. O `vercel.json`
foi preparado no worktree para impedir auto-deploy Git da `main`, e o teste de
release passou em RED/GREEN. Isso só altera a produção após publicação; a
execução real do hook, a ordem e o SHA ainda não foram comprovados.

Os bloqueios encontrados em ambiente e dependências foram corrigidos na
manutenção de 2026-11-02. `make check`, reset/lint/diff/pgTAP em banco isolado,
restore Docker e audit de produção passaram. O audit completo não tem achados
altos ou críticos; permanecem 16 moderados em ferramentas de desenvolvimento.
A evidência final e os E2E estão no
[relatório de manutenção](../operations/dependency-maintenance-2026-11-02.md).
As mudanças continuam sem commit e sem publicação, sob controle do proprietário.

### Conclusão por aceite em 2 de novembro de 2026

O proprietário confirmou o deployment completo. App CI `41535884511`,
migrations/deploy `41536456800` e auditoria `41537177311` passaram no mesmo
SHA `ce9e7d1`. A ordem observada foi quality gate → migrations → hook.
O funcionamento do passo 5 foi aceito pelo proprietário. Os critérios abaixo
continuam como referência operacional; cenários não executados não são
registrados como ensaiados. Nova falha reabre a investigação.

### Responsabilidade externa

1. Criar Deploy Hook para `main`, informado como concluído pelo proprietário em
   2026-11-02.
2. Cadastrar a URL como `VERCEL_DEPLOY_HOOK_URL` no environment GitHub
   `production`, confirmado por metadados em 2026-11-02. O prazo da reexecução
   histórica expirou; comprovar a entrega pela próxima publicação autorizada.
3. Desligar o auto-deploy de produção da `main` por `vercel.json`.
4. Publicar uma mudança inócua e confirmar pelos horários que migrations
   terminaram antes do deployment e que o commit exibido pela Vercel coincide
   com o SHA registrado no resumo do workflow.
5. Manter os secrets `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` e
   `SUPABASE_DB_PASSWORD` somente no environment protegido.

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

`goals-surface.tsx` passou de 4.357 para cerca de 470 linhas físicas e concentra
roteamento e composição. Cards de meta/grupo, grid, cabeçalhos, menus de
categoria, edição de etapas e drafts possuem módulos próprios. O estado de
arrasto está em `use-goal-drag.ts`; seu contrato de placement foi preservado.
Todos os módulos da área permanecem abaixo de 800 linhas físicas e lógicas.

A suíte original de 74 testes foi preservada e dividida por contexto, usando
fixtures e mocks compartilhados em `tests/support/goals-surface-harness.tsx`.
`make test-goals` cobre esses cenários e testes próximos. Não houve mudança
intencional de regras, desenho, nomes acessíveis ou persistência.
Validação: 648 testes no gate completo, 43 E2E locais e quatro autenticados
aprovados; lint, tipos, formatação e build padrão aprovados.

### Critérios de conclusão

- nenhum módulo de metas acima de 800 linhas lógicas;
- nenhuma mudança de comportamento observável;
- gates do REVIEW aprovados a cada extração.
