# Plano de implementação para produção

## Propósito e autoridade

Este é o único plano de evolução do Tick. Ele centraliza arquitetura, custos,
rollouts, decisões, trabalho de código, configuração externa, validação e
critérios de conclusão. O [README.md](README.md) descreve somente o que existe
hoje e o [REVIEW.md](REVIEW.md) define os gates de qualidade.

O objetivo é preparar o produto para aproximadamente **1.000 usuários ativos
por dia**, sem assumir que a stack atual precisa ser preservada. A execução
segue exatamente os oito passos abaixo, em ordem. Um passo só avança quando seus
critérios obrigatórios forem atendidos ou quando uma exceção estiver registrada
neste arquivo.

O desenvolvedor controla commits, publicação, contas externas, secrets,
contratações e decisões de produto. Agentes podem implementar e validar código,
mas só executam operações de versionamento ou publicação mediante pedido
explícito no turno atual.

## Decisões vigentes

- Continuar com **Vercel Hobby, Supabase Free e PowerSync gratuito** durante
  desenvolvimento e alfa privada.
- Não contratar Vercel Pro, Supabase Pro ou PowerSync Pro nesta fase.
- Manter PostgreSQL/Supabase como fonte canônica das contas.
- Manter `guest:<installationId>` exclusivamente local e isolado de
  `user:<supabaseUserId>`.
- Não migrar dados guest automaticamente durante login.
- Evitar dual-write: cada conta usa um único caminho remoto por vez.
- Usar o Makefile como única interface operacional.
- Não introduzir Redis, Kubernetes, microsserviços ou CRDTs para a meta atual de
  1.000 usuários diários.

## Estado resumido

| Passo | Estado                | Próximo marco                                       |
| ----- | --------------------- | --------------------------------------------------- |
| 1     | concluído             | manter rollout restrito durante a etapa 2           |
| 2     | código concluído      | validar Safari/iOS e quotas em aparelhos reais      |
| 3     | pendente              | registrar decisão PowerSync ou outbox própria       |
| 4     | pendente              | escolher observabilidade e comprovar restore        |
| 5     | parcialmente entregue | ordenar deploy e detectar pipeline parado           |
| 6     | não iniciado          | fechar decisões de produto e autenticação pública   |
| 7     | não iniciado          | criar baseline e carga para 1.000 DAU               |
| 8     | adiado                | avaliar frontend estático e planos no marco público |
| 9     | pendente              | validar a interface de toque em aparelho real       |

## 1. Publicar e validar o rollout controlado da outbox

### Resultado esperado

Comprovar em produção, para uma única conta interna, que a persistência
funcional em lote é segura antes de ampliar sua adoção. Este passo não depende
do PowerSync e não exige nenhum plano pago.

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

**Estado:** código concluído; ensaios externos Safari/iOS e quotas pendentes.

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
transferência, conexões e funções antes e depois. Não ativar planos pagos nem
executar o benchmark contra produção.

### Critérios de conclusão

- todos os dispositivos convergem segundo a política definida;
- nenhuma operação se perde após fechamento completo;
- nenhuma chamada cruza usuários ou parte de guest;
- p95 e taxa de erro do lote têm baseline registrado;
- não há fila, lock ou estado `syncing` permanente;
- fallback oferece erro recuperável e não corrompe dados;
- o volume do ensaio cabe nas quotas gratuitas com margem conhecida.

## 3. Escolher definitivamente entre PowerSync e outbox própria

### Resultado esperado

Encerrar a arquitetura paralela. Ao final haverá uma única estratégia de
persistência remota para contas autenticadas e um plano de migração ou remoção
do caminho rejeitado.

### Estado da prova PowerSync

Existe um POC isolado, desligado por padrão, com SQLite v2 por conta, Supabase
Auth, tabelas `powersync_poc_*`, Sync Streams filtrados, upload em uma RPC
atômica, RLS, recibos idempotentes e rota interna `/~powersync-poc`. Reload
offline, reconexão, dois contextos web, isolamento entre contas e Android já
foram validados. As telas funcionais ainda usam Dexie; o POC nunca deve escrever
nas tabelas funcionais.

Configuração externa já existente:

- instância PowerSync **Development** no plano gratuito;
- usuário exclusivo de replicação no Supabase;
- Supabase Auth habilitado no PowerSync;
- `powersync/sync-config.yaml` implantado sobre `powersync_poc_*`;
- `NEXT_PUBLIC_POWERSYNC_URL` cadastrado apenas em Vercel Production.

A ativação interna exige simultaneamente:

```dotenv
NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC=1
NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS=<auth.users.id-da-conta-interna>
```

### Comparação obrigatória

Avaliar PowerSync e outbox própria com os mesmos dados dos passos 1 e 2:

| Critério         | Evidência necessária                                 |
| ---------------- | ---------------------------------------------------- |
| perda e retry    | reload, fechamento, resposta perdida e reconexão     |
| conflito         | resultado simultâneo previsível em dois dispositivos |
| incrementalidade | linhas e bytes por pull e por alteração              |
| compatibilidade  | desktop, Android, Safari/iOS e fallback              |
| complexidade     | código próprio, operação, diagnóstico e upgrades     |
| custo            | alfa, 1.000 DAU e crescimento                        |
| lock-in e saída  | exportação, reconstrução local e rollback            |
| segurança        | JWT, ownership, RLS e isolamento negativo            |

### Decisão recomendada

Adotar PowerSync se ele aprovar todos os critérios e reduzir materialmente o
código proprietário de pull, outbox e conflitos. Nesse caso:

1. migrar uma superfície funcional por flag e UUID;
2. abrir uma base local nova e reconstruível a partir do servidor;
3. manter guest no Dexie;
4. nunca escrever a mesma conta simultaneamente em Dexie/outbox e PowerSync;
5. ampliar por coortes internas;
6. remover o caminho autenticado antigo somente após estabilidade e rollback
   comprovado.

Manter a outbox própria se o PowerSync falhar em compatibilidade, custo ou
controle operacional. Nesse caso, remover o POC, suas tabelas, publicação,
streams, dependência e flags em rollout aditivo e reversível, e concluir pull
incremental e observabilidade na implementação própria.

### Responsabilidade externa

- executar os ensaios restantes do POC em Safari/iOS e fechamento completo;
- fornecer as métricas do dashboard gratuito do PowerSync;
- confirmar termos, limites e preço vigentes antes de qualquer uso público;
- aprovar por escrito a escolha e o custo aceito;
- contratar PowerSync Pro somente antes de liberar sync a usuários externos ou
  quando quotas/garantias do plano gratuito deixarem de atender.

### Critérios de conclusão

Uma decisão registrada neste passo deve conter evidências, custo estimado,
navegadores suportados, política de conflito, plano de rollout, rollback e
remoção da alternativa rejeitada. `SYNC-01` só pode ser considerado concluído
depois da migração das telas reais e da retirada do caminho temporário.

## 4. Implementar observabilidade, backup e restauração

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
7. Automatizar backup externo quando o lançamento se aproximar.
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
- quotas possuem alerta antes da saturação;
- backup é restaurado por outra pessoa seguindo o runbook;
- RPO e RTO medidos estão registrados;
- rollback de aplicação, flag e banco foi ensaiado.

## 5. Fechar deploy ordenado entre GitHub, Supabase e Vercel

### Resultado esperado

Garantir a sequência `quality gate → migrations → deploy` para o mesmo SHA,
com rollback documentado.

### Estado atual

O ruleset da `main` exige `Check app`, `Check database` e `Check end-to-end`.
O workflow de migrations roda somente após App CI aprovado na `main`, usa o
`head_sha`, faz dry-run e aplica migrations pelo environment `production`. O
deploy automático da Vercel ainda pode começar em paralelo com as migrations.

Desde 27 de agosto de 2026, App CI e o workflow de migrations avisam falha pela
action composta `.github/actions/report-failure`, que abre ou comenta uma issue
atribuída ao dono do repositório. O aviso cobre somente execução que falhou.
Execução que nunca começa, por evento `workflow_run` não entregue ou por
indisponibilidade do GitHub Actions, continua sem detecção.

### Modos de falha do pipeline

Com o Actions indisponível antes do merge, o ruleset impede o merge e a produção
não muda. O risco vive depois do merge: a Vercel publica pela integração Git,
que não depende do Actions, enquanto a migration depende. Um App CI reprovado na
`main`, mesmo por falha de infraestrutura alheia ao código, publica o frontend e
não aplica a migration daquele SHA. Enquanto o deploy não for ordenado, a
compatibilidade N/N+1 é a única proteção dessa janela.

O `make publish` também degrada de forma pouco previsível: `gh pr merge --auto`
é armado antes da espera dos checks, então interromper o comando deixa o merge
armado para acontecer sem acompanhamento, e a espera pelo merge expira em
sessenta segundos mesmo quando o merge ainda vai ocorrer.

### Implementação recomendada

Usar um Deploy Hook da Vercel acionado pelo workflow após a migration:

1. adicionar job `deploy-production` em
   `.github/workflows/supabase-migrations.yml`;
2. fazê-lo depender de `migrate-production` e usar o mesmo SHA registrado;
3. tratar corretamente commits sem mudança de banco, sem impedir deploy;
4. falhar com mensagem clara quando o hook estiver ausente ou responder erro;
5. registrar URL/identificador do deployment como evidência;
6. manter migrations aditivas e compatíveis com versões N e N+1;
7. usar migration compensatória em rollback, nunca alterar migration aplicada;
8. detectar SHA da `main` sem migration aplicada, por verificação agendada que
   compare migrations do repositório com o histórico de produção e avise pela
   mesma action de falha, cobrindo evento perdido e workflow que nunca começou;
9. decidir e documentar o comportamento do `make publish` sob degradação do
   GitHub, definindo se o auto-merge é desarmado ao interromper o comando e
   separando merge lento de merge falho em vez de expirar em sessenta segundos.

### Responsabilidade externa

1. Em Vercel **Settings → Git**, desativar o auto-deploy de produção da `main`.
2. Criar Deploy Hook para `main`.
3. Cadastrar a URL como `VERCEL_DEPLOY_HOOK_URL` no environment GitHub
   `production`.
4. Publicar uma mudança inócua e confirmar pelos horários que migrations
   terminaram antes do deployment.
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

## 6. Implementar Auth, entitlement, trial, billing e migração guest

### Resultado esperado

Substituir a alfa por allowlist por um ciclo público completo de conta e
assinatura. A ordem interna obrigatória é **Auth → entitlement/trial → billing
→ migração guest**.

### 6.1 Autenticação pública

Implementar cadastro, confirmação de e-mail, login por senha e Google,
recuperação de senha, gestão de sessão, reautenticação para ações sensíveis,
exportação e exclusão completa. Preservar o grant offline recente somente para
a mesma conta e nunca converter indisponibilidade remota em negativa explícita.

Responsabilidade externa:

- escolher SMTP e domínio remetente;
- decidir CAPTCHA desde o cadastro e configurar quotas/rate limits;
- revisar redirects OAuth, templates pt-BR/en e políticas de retenção;
- definir prazo prometido de exportação e exclusão.

### 6.2 Guest, trial e entitlement

Centralizar uma política validada no servidor para `guest`, `trial`, `active`,
`grace` e `expired`. O trial autenticado dura sete dias pelo relógio canônico do
servidor. Expiração nunca apaga dados e trial/assinante usam o mesmo modelo de
persistência.

Decisões externas obrigatórias:

- limites exatos do guest e tratamento de usuários locais acima do limite;
- quando o trial começa e o que fica bloqueado ao expirar;
- se o trial é controlado por conta, e-mail ou dispositivo;
- momento de remover a allowlist.

### 6.3 Billing

Implementar catálogo centralizado por região/moeda, customer, checkout, portal,
subscription, event log, webhooks assinados e idempotentes, reconciliação,
renovação, cancelamento, grace period, falha e eventos fora de ordem.
Entitlement é derivado no servidor, nunca aceito da UI.

Decisões externas obrigatórias:

- provedor e entidade jurídica recebedora, incluindo emissão fiscal no Brasil;
- confirmar ou substituir os preços provisórios de `R$ 10,00/mês` e
  `US$ 5.00/mês`;
- tolerância e acesso durante falha de pagamento;
- secrets e sandbox do provedor.

### 6.4 Migração explícita de guest

Oferecer fluxo opcional e consentido depois que sync e API estiverem estáveis.
Inventariar o grafo guest, gerar `migration_id`, mapear IDs e relações, enviar
lotes transacionais, guardar checkpoint, permitir retry e só limpar a origem
após confirmação canônica.

Decisões externas obrigatórias:

- se e quando a migração será oferecida;
- política quando a conta já possui dados: mesclar, duplicar ou bloquear;
- preservar ou apagar a origem após confirmação.

### Segurança, testes e conclusão

- derivar usuário, preço e entitlement do token/servidor;
- cobrir enumeração, redirects, rate limit, CSRF, webhooks duplicados,
  out-of-order, ownership e deleção em cascade;
- testar pt-BR/en, offline, expiração, renovação, cancelamento e dois usuários;
- comprovar que repetição da migração não duplica e falha parcial retoma;
- publicar políticas de privacidade, retenção e termos antes do cadastro
  público.

O passo termina quando uma pessoa pode criar, confirmar, recuperar, exportar e
excluir a conta; iniciar e terminar trial; assinar, cancelar e recuperar falha
de pagamento; e migrar dados guest sem perda ou cruzamento de ownership.

## 7. Executar carga e capacidade para 1.000 usuários diários

### Resultado esperado

Substituir estimativas por um baseline reprodutível de capacidade, custo e
gargalos para 1.000 DAU e picos realistas.

### Implementação necessária

1. Modelar sessões, leituras, edições, sincronizações e pico por minuto.
2. Gerar dados sintéticos sem PII, incluindo contas com milhares de itens e
   hierarquias profundas.
3. Criar targets Make para preparação, execução e relatório da carga.
4. Medir p50/p95/p99, taxa de erro, queries, locks, CPU, memória, linhas/bytes,
   conexões, fila, convergência e primeiro pull.
5. Medir bundle, abertura em rede móvel e atualização do service worker.
6. Identificar N+1, consultas/payloads ilimitados, refresh redundante e índices
   ausentes.
7. Definir budgets e ratchets: regressão superior a 10% deve falhar ou exigir
   justificativa explícita.
8. Fazer carga progressiva somente em ambiente isolado.

### Responsabilidade externa

- aprovar o modelo de uso e o pico esperado;
- fornecer projeto isolado ou janela segura de benchmark;
- acompanhar dashboards de Vercel, Supabase e, se escolhido, PowerSync;
- autorizar qualquer custo de ambiente temporário;
- validar quotas e preços atuais nos sites dos fornecedores antes do lançamento.

### Critérios de conclusão

- pico de 1.000 DAU passa com margem definida e sem perda de dados;
- p95/p99 e tempo de convergência atendem os limites acordados;
- nenhuma consulta, payload ou fila cresce sem limite;
- gargalos e índices possuem evidência antes/depois;
- alertas disparam em 70% de quota crítica;
- relatório reproduzível registra capacidade, margem e custo projetado.

## 8. Avaliar frontend estático e planos no marco público

### Resultado esperado

Depois da sincronização, operação e carga estáveis, decidir a hospedagem final e
contratar somente o que for tecnicamente ou comercialmente necessário.

### Arquitetura preferida

- frontend React, TypeScript, Vite e Tailwind estático;
- PWA e service worker sem servidor Node permanente;
- Cloudflare para o app estático;
- Supabase Auth/PostgreSQL como backend canônico;
- estratégia de sync escolhida no passo 3;
- páginas públicas/SEO separadas apenas quando necessárias.

### Migração técnica

1. Remover dependência server-side de locale e preferências iniciais.
2. Prototipar build Vite estático sem alterar o produto em produção.
3. Preservar rotas instaláveis, manifest, deep links e fallback offline.
4. Testar instalação, atualização do service worker, cache antigo e rollback.
5. Configurar Cloudflare, domínio, DNS, headers, CSP e cache.
6. Executar paridade funcional, E2E desktop/mobile e medição de performance.
7. Fazer rollout reversível e remover a hospedagem antiga só após estabilidade.

### Planos e gatilhos

Valores são referências históricas de planejamento e devem ser conferidos
antes de contratar:

| Serviço     | Agora               | Gatilho de upgrade                                                                    |
| ----------- | ------------------- | ------------------------------------------------------------------------------------- |
| Vercel      | Hobby, alfa privada | Pro somente se uso comercial começar ainda hospedado na Vercel                        |
| Supabase    | Free                | lançamento público, risco de pausa, necessidade de backup/SLA ou 70% de quota crítica |
| PowerSync   | gratuito no POC     | sync para usuários externos, limite da prova ou necessidade de suporte/SLA            |
| Cloudflare  | Free inicialmente   | tráfego ou recurso que exceda o plano vigente                                         |
| Backup/PITR | ensaio local/manual | RPO/RTO público exigir automação ou recuperação ponto a ponto                         |

A referência anterior da arquitetura completa paga era aproximadamente US$ 79
por mês para Supabase Small e PowerSync Pro, sem Vercel Pro. Ela não é cotação
nem autorização de compra.

### Responsabilidade externa

- revisar termos comerciais dos planos no marco de lançamento;
- criar zona/projeto Cloudflare, configurar domínio e autorizar mudança de DNS;
- contratar Supabase/PowerSync apenas quando um gatilho ocorrer;
- aprovar janela de rollout e rollback;
- confirmar políticas legais, suporte, RPO/RTO e resposta a incidentes.

### Definição final de pronto

A implementação total está concluída quando:

- nenhuma limitação conhecida pode apagar ou ocultar dados locais;
- operações offline sobrevivem ao fechamento e convergem entre dispositivos;
- guest e contas permanecem rigorosamente isolados;
- conta, trial, assinatura, exportação, exclusão e migração funcionam;
- métricas, alertas, backup, restauração e rollback foram comprovados;
- a carga sustenta 1.000 DAU com margem e custo conhecidos;
- deploy e migrations usam o mesmo SHA aprovado;
- falha ou parada do pipeline de publicação é detectada e avisada;
- hospedagem, termos e planos são compatíveis com uso público;
- todos os gates aplicáveis do REVIEW passam.

## 9. Validar a interface de toque em aparelho real

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
2. Confirmar que o recuo de safe area não corta cabeçalho nem ações.
3. Confirmar que `interactiveWidget: 'resizes-content'` se comporta como
   esperado no Safari/iOS, que ainda não implementa a propriedade.
4. Registrar o resultado no REVIEW e abrir correção dedicada por divergência.

### Critérios de conclusão

- ensaio aprovado em pelo menos um Android e um iOS;
- divergências corrigidas ou registradas com plano;
- nenhuma regressão no desenho desktop.
