# Observability, backup and restore

## Estado implementado

O Tick possui um adaptador próprio em `src/lib/telemetry`. O primeiro destino é
o Sentry Free, carregado dinamicamente apenas quando existe DSN. A integração
desativa todas as integrações automáticas e envia somente eventos criados pelo
Tick. Não há captura automática de exceções, console, DOM, URL, sessão, replay,
tracing ou dados de usuário.

A allowlist aceita apenas agregados de sincronização, duração e volume do
refresh, versão da aplicação, nome do navegador e versão principal. Tarefa,
meta, etapa, categoria, e-mail, identificador de usuário, token, payload e
User-Agent completo são descartados antes do adapter. O teste de regressão é
executado por `make test-telemetry`.

Cada evento é agrupado pelo fingerprint `['tick', <nome do evento>, <sinal>]`,
de modo que `healthy`, `api_unavailable`, `old_operation`, `queue_accumulated`,
`sync_failure` e `synthetic_failure` formam issues separadas no Sentry. Sem essa
separação, todos os sinais de sincronização cairiam na mesma issue e alertas por
primeiro evento ou por frequência não conseguiriam distinguir falha de operação
normal.

O SDK adotado é `@sentry/browser` 10.72.0, licença MIT. Ele fica isolado pelo
adapter e pode ser substituído sem alterar a outbox. A produção continuou com
Vercel Hobby e Supabase Free.

## Configuração externa do Sentry

1. Criar um projeto Sentry do tipo JavaScript/Browser.
2. Desabilitar armazenamento de endereço IP nas configurações de segurança e
   privacidade, em projeto e em organização.
3. Restringir acesso ao proprietário e a pessoas responsáveis por incidentes.
4. Na Vercel, cadastrar apenas em Production:

```text
NEXT_PUBLIC_TICK_TELEMETRY_DSN=<DSN público do projeto Sentry>
NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT=production
```

5. Fazer um novo deploy. A release usa automaticamente o SHA do deploy; uma
   substituição explícita pode usar `NEXT_PUBLIC_TICK_RELEASE`.
6. Configurar alertas no Sentry. A lista fica em **Monitors**, nome atual da
   seção antes chamada Alerts, e as regras são penduradas no monitor de erro do
   projeto. Cada regra usa `Alert on specific monitors`, environment
   `production`, condição `An event or issue activity is captured` e um único
   filtro `The event's telemetry_signal tag equals <valor>`:
   - `api_unavailable`, throttle de 1 hora;
   - `old_operation`, throttle de 1 hora;
   - `queue_accumulated`, throttle de 1 hora;
   - `sync_failure`, throttle de 1 hora;
   - `synthetic_failure`, sem throttle, temporário durante a validação;
   - uso do plano Sentry em 70%: alertar por e-mail ao proprietário.

   Não criar regra para `telemetry_signal = healthy`. Não usar
   `A new issue is created`: como cada sinal é uma issue única, a regra
   dispararia uma vez e nunca mais. A condição de frequência do builder antigo
   não existe mais; o throttle limita a repetição.

7. Cadastrar temporariamente
   `NEXT_PUBLIC_TICK_TELEMETRY_SYNTHETIC_FAILURE=1`, gerar um deploy, abrir a
   aplicação, confirmar recebimento e alerta e então remover a variável e gerar
   outro deploy. Cada carregamento envia no máximo um evento. O evento
   contém apenas `signal`, versão, ambiente e navegador.

O evento retém `user.geo` com país, região e cidade, acrescentado pelo Sentry na
ingestão a partir do IP da conexão, depois do estágio de scrubbing. Desabilitar
o armazenamento de IP em projeto e organização e criar a regra
`[Remove] [Anything] from [$user]` nos dois níveis não remove o campo. Nenhum IP
é armazenado. A limitação está registrada e deve ser reavaliada ao ampliar a coorte de convidados.

Os limites iniciais são uma fila de 25 operações e uma operação com cinco
minutos. Eles devem ser ajustados somente com evidência de uso real.

## Quotas do Supabase Free

O Supabase Free não fornece log drain nem backup automático como garantia do
plano. No painel do Supabase, habilitar todas as notificações de uso disponíveis
e tratar 70% de database size, disk, egress ou conexões como aviso crítico. Se o
painel não permitir um limiar customizado, criar um lembrete operacional diário
para conferir Usage até a automação por API estar disponível.

Ao atingir 70%:

1. interromper rollout e migrations não essenciais;
2. verificar crescimento de WAL, slots de replicação, tabelas e índices;
3. confirmar que o backup mais recente terminou;
4. reduzir a causa mensurada;
5. avaliar upgrade somente se a carga legítima justificar, sem assumir Pro
   antecipadamente.

## Backup externo automatizado

O workflow `Production backup` roda diariamente às 03:17 UTC e também aceita
execução manual. Ele gera os dumps oficiais de roles, schema e dados, cifra o
arquivo com AES-256-GCM antes do upload e retém somente o artefato cifrado por
14 dias no GitHub Actions.

Cadastrar no environment GitHub `production`:

```text
SUPABASE_DB_URL=<Session pooler connection string>
TICK_BACKUP_ENCRYPTION_KEY=<segredo aleatório com no mínimo 32 caracteres>
```

Cadastrar a repository variable abaixo somente depois dos secrets:

```text
ENABLE_PRODUCTION_BACKUP=1
```

A chave de backup não deve ser `SUPABASE_DB_PASSWORD`, não deve ir para Vercel
e precisa existir também no cofre externo do proprietário. O artefato sem essa
chave é irrecuperável. Falhas abrem ou atualizam uma issue `backup-failure`.

O backup não inclui arquivos do Supabase Storage. O Tick atualmente não depende
de objetos de usuário no Storage; se isso mudar, o workflow deve ser ampliado
antes do lançamento da feature.

## Ensaio de restauração

1. No GitHub Actions, abrir a última execução bem-sucedida de `Production
backup` e baixar o artefato `.enc`.
2. Disponibilizar `TICK_BACKUP_ENCRYPTION_KEY` somente na sessão local segura.
3. Com Docker ativo, executar:

```text
make backup-restore archive=<caminho-do-arquivo.enc>
```

4. O comando decifra em diretório temporário, cria um container PostgreSQL 17
   isolado, restaura roles, schema e dados, valida a quantidade de tabelas
   públicas, imprime RPO e RTO e remove o container e os arquivos temporários.
5. Registrar data, responsável, `backupCreatedAt`, `publicTables`, `rpoMs` e
   `rtoMs` na seção de evidências deste documento.

Nunca apontar esse comando para produção. Por decisão explícita do
proprietário em 2026-11-02, ele executa o ensaio em uma segunda máquina, sem
exigência de outra pessoa. A revisão humana independente foi dispensada, não
executada. Repetir pelo menos mensalmente e antes de mudanças operacionais relevantes.

O restore aguarda `pg_isready --host 127.0.0.1` dentro do container. O servidor
temporário do entrypoint aceita conexões por socket durante a instalação das
extensões; aceitar esse estado como pronto pode fazer o dump disputar a criação
de `pg_stat_statements`. A limpeza usa `docker rm --force --volumes` para remover
também os volumes anônimos do container do ensaio. `make test-backup` cobre a
espera e o timeout; `make test-backup-restore` valida um arquivo cifrado sintético
na mesma imagem Postgres, sem acessar produção. O teste Docker é separado do
gate padrão e não usa credenciais nem conteúdo real.

A imagem Postgres não executa todas as migrations do serviço Supabase Auth.
Antes de aplicar o dump, o ensaio executa `auth migrate` pela imagem oficial
`public.ecr.aws/supabase/gotrue:v2.197.0`, versão fixada a partir do
[Compose oficial do Supabase](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
consultado em 2026-11-02. O
[comando oficial de migrations](https://github.com/supabase/auth/blob/master/cmd/migrate_cmd.go)
prepara as tabelas, colunas e funções do Auth, incluindo `auth.jwt()` e
`audit_log_entries.ip_address`, sem iniciar o servidor HTTP de autenticação.
Ele usa somente a rede do container Postgres, uma URL em `127.0.0.1` e a senha
aleatória do ensaio para `supabase_auth_admin`. Nenhuma credencial de produção
é necessária além da chave de decifragem. O container de migrations é removido
ao terminar, inclusive em falha.

O schema Storage é preparado depois do Auth pelo comando
`node dist/scripts/migrate-call.js` da imagem oficial
`docker.io/supabase/storage-api:v1.81.0`, versão do Compose oficial consultado
em 2026-11-02, pelo
[entrypoint de migrations do fornecedor](https://github.com/supabase/storage/blob/v1.81.0/src/scripts/migrate-call.ts).
Ele usa `supabase_storage_admin` com senha aleatória e loopback na rede do
container Postgres. Nenhum servidor HTTP, acesso S3 ou endpoint de produção é
iniciado. A limpeza remove também esse container. `make backup-restore-prepare`
baixa as três imagens antes da medição de RTO.

O restore continua interrompendo no primeiro erro. O teste Docker restaura o
schema completo do Tick, uma entrada de auditoria com `ip_address`, um usuário
com `is_anonymous`, um perfil, um bucket e metadados de objeto sintéticos, e verifica claims JWT e a regra de
acesso. Não comprova login nem compatibilidade com todas as versões de
Auth/Storage; diferenças continuam sendo erros bloqueantes do ensaio externo,
sem descartar trechos do dump para obter sucesso.

## Runbook de incidente de sincronização

1. Confirmar o sinal e a release no Sentry sem procurar conteúdo do usuário.
2. Se a falha estiver no caminho de lotes, limpar
   `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` em Production e redeployar a última
   release saudável.
3. Não limpar IndexedDB: a outbox é a cópia recuperável das mudanças locais.
4. Confirmar que a taxa de erro estabilizou e que novas operações não são
   enviadas pelo caminho desativado.
5. Corrigir com teste de regressão, passar os gates e reativar primeiro para um
   único UUID interno.
6. Se houver indisponibilidade do banco, seguir o runbook específico do
   incidente e pausar migrations.

## Rollback de aplicação, flag e banco

- Aplicação: promover na Vercel o último deployment saudável do mesmo ambiente.
- Flag: limpar a variável problemática e gerar novo deploy, pois variáveis
  `NEXT_PUBLIC_*` são incorporadas no build.
- Banco: preferir migration compensatória aditiva. Criá-la no schema
  declarativo, gerar o diff por `make supabase-migration-diff name=<name>`,
  validar banco limpo e publicar pelo workflow. Não editar produção com SQL
  avulso.
- Restore destrutivo: somente após incidente confirmado, autorização explícita,
  backup preservado e janela comunicada. O ensaio normal nunca usa produção.

## Comunicação ao usuário

A mensagem deve informar período, capacidade afetada, preservação local dos
dados e ação necessária sem prometer sincronização concluída antes da prova.

Modelo:

> Identificamos instabilidade na sincronização entre HH:MM e HH:MM. Alterações
> feitas neste dispositivo permanecem salvas localmente. Evite limpar os dados
> do navegador. Avisaremos quando o envio remoto estiver normalizado.

Após a recuperação, comunicar a validação, o risco residual e se o usuário deve
abrir o aplicativo online para drenar a fila.

## Evidências de telemetria

Configuração externa do Sentry concluída em 2026-09-22.

| Item                          | Resultado                                                 |
| ----------------------------- | --------------------------------------------------------- |
| Projeto                       | `tick-production`, plataforma Browser JavaScript          |
| Produtos habilitados          | apenas Error monitoring                                   |
| Session Replay, tracing, logs | desabilitados                                             |
| Armazenamento de IP           | desabilitado em projeto e organização                     |
| Variáveis na Vercel           | DSN e environment somente no escopo Production            |
| Regras de alerta              | cinco, filtradas por `telemetry_signal`                   |
| Release observada             | `efc7c3a9abf92310b170465bab348fad092eac4a`                |
| Evento sintético              | recebido e inspecionado em quatro ocorrências             |
| Variável sintética            | removida, com novo deploy e ausência de evento confirmada |
| Regra sintética               | desativada; as quatro operacionais permanecem ativas      |
| Aviso de consumo do plano     | limiares de 70%, 80% e 90% em Manage Spend Notifications  |

O payload inspecionado não contém IP, URL, cabeçalhos, User-Agent, breadcrumbs,
identificador de usuário, e-mail, token nem conteúdo funcional. O contexto
`tick` traz apenas `appVersion`, `browserName`, `browserVersion`, `environment`
e `signal`.

Limitação registrada: `user.geo` com país, região e cidade permanece no evento.
Reavaliar ao ampliar a coorte de convidados.

## Evidências de restore

Restore do artefato real executado com sucesso na segunda máquina em
2026-11-02, com ausência de containers e remoção das pastas confirmadas pelo
proprietário. A exigência de outra pessoa foi dispensada por ele nessa data. As tentativas abaixo registram os problemas encontrados
antes do resultado bem-sucedido.

Em 2026-11-02, o proprietário tentou o restore no Linux Acer A15 com Node
22.21.1, usando o SHA `a00e5b4303b09d2f687b885c6ceeb69ce03cb7ec`.
O arquivo do run `41382697246` falhou na autenticação AES-GCM com a chave
recuperada; dois downloads tiveram o mesmo SHA-256
`91b40ba90a201f36ea4e17452e08fc6db89c7aafb740a7b8b732757943d37d1e`.
Após substituição autorizada da chave, o run `41520276777` gerou novo artefato.
O ensaio de `20:44:34Z` a `20:44:57Z` (`17:44:34` a `17:44:57` em São Paulo)
passou da decifragem e falhou com `pg_extension_name_index` para
`pg_stat_statements`. O teste de regressão reproduz a corrida com a inicialização
temporária; a correção ainda precisa ser aplicada no checkout histórico e
validada pelo proprietário no Linux. Não há RPO/RTO aprovado desse restore.

Na repetição de `20:58:27Z` a `20:58:43Z` (`17:58:27` a `17:58:43` em São
Paulo), após aplicar a espera por TCP, o restore avançou e falhou com
`function auth.jwt() does not exist`. O primeiro teste sintético cobria apenas
uma tabela e não detectava essa dependência. O teste foi ampliado para o schema
completo do Tick e reproduziu a mesma falha na imagem real antes da correção.
A preparação de `auth.jwt()` permitiu restaurar localmente as 10 tabelas
públicas, o usuário e o perfil sintéticos. A repetição com o artefato real no
Linux continua pendente.

Na repetição de `21:05:25Z` a `21:05:43Z` (`18:05:25` a `18:05:43` em São
Paulo), o restore passou do schema público e falhou no dado gerenciado com
`column "ip_address" of relation "audit_log_entries" does not exist`.
Adicionar somente `auth.jwt()` era insuficiente: o ambiente precisa das
migrations do serviço Auth. Um `COPY` sintético de auditoria reproduziu a mesma
falha antes da alteração. A preparação foi substituída pelas migrations da
imagem oficial GoTrue v2.197.0, e o mesmo teste passou, incluindo usuário com
`is_anonymous`. A aprovação externa do arquivo real permanece pendente.

Na tentativa de `21:12:05Z` a `21:12:20Z` (`18:12:05` a `18:12:20` em São
Paulo), a preparação de Auth permitiu avançar até os dados de Storage, onde
faltou `storage.buckets`. O teste Docker passou a incluir `COPY storage.buckets`
e reproduziu a mesma falha antes da correção. A execução das migrations do
Storage pela imagem oficial v1.54.1 permitiu restaurar esse dado sintético.
Metadados de objeto também integram o teste. O artefato original continua sem
alterações e o restore externo ainda não está aprovado.

Na tentativa de `21:17:23Z` a `21:17:39Z` (`18:17:23` a `18:17:39` em São
Paulo), o download da imagem v1.54.1 funcionou após limite transitório do ECR,
mas o restore encontrou `storage.buckets.versioning_status` ausente. Essa
versão não continha a
[migration de versionamento de objetos](https://github.com/supabase/storage/blob/v1.81.0/migrations/tenant/0062-object-versioning-core.sql)
usada pelo backup. O teste reproduziu a mesma falha com essa coluna antes da
troca para v1.81.0. O restore passou a usar essa versão fixada do Compose oficial,
baixada pelo Docker Hub para evitar o limite observado no ECR. O teste cobre
também `lifecycle_configuration`, `lifecycle_configuration_generation`,
`archived_at`, `is_delete_marker` e `is_versioned`; o arquivo real permanece
pendente de aprovação externa.

### Resultado externo em 2026-11-02

O proprietário executou o restore no Linux Acer A15, com Node 22.21.1, do
artefato `tick-production-backup-41520276777`, gerado pelo
[run 41520276777](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41520276777).
O checkout era `a00e5b4303b09d2f687b885c6ceeb69ce03cb7ec`, com correções locais
do utilitário: espera por TCP, remoção de volumes temporários, migrations de
Auth GoTrue v2.197.0 e Storage v1.81.0. Os dumps de roles, schema e dados não
foram editados, filtrados ou importados com tolerância a erro.

Janela observada: `21:22:27Z` a `21:22:43Z`, correspondente a `18:22:27` a
`18:22:43` em São Paulo. Essa janela inclui a entrada manual da chave; o RTO
abaixo foi medido pelo script, com as imagens já baixadas. Distribuição e
versão do Docker não foram informadas.

| Data       | Responsável  | Backup criado em         | Tabelas | RPO medido                     | RTO                | Resultado                                   |
| ---------- | ------------ | ------------------------ | ------- | ------------------------------ | ------------------ | ------------------------------------------- |
| 2026-11-02 | proprietário | 2026-11-02T20:34:59.902Z | 10      | 2.859.601 ms (47 min 39,601 s) | 3.454 ms (3,454 s) | aprovado; exit status 0; limpeza confirmada |

O RPO medido é a idade desse artefato no início do restore, não comprovação da
regularidade do backup diário. O RTO ficou abaixo do limite proposto de 30
minutos. O sucesso valida o arquivo real e a nova chave nessa máquina; não
comprova login do aplicativo, restore destrutivo em produção, estabilização do
workflow diário ou independência do procedimento. O proprietário dispensou a
segunda pessoa e adotou o ensaio por ele em dois dispositivos; não existe
revisão independente executada ou pendente.

A saída posterior da limpeza confirmou que a consulta Docker não encontrou
containers do ensaio, pois entrou no ramo de remoção das pastas. A limpeza
inicial não terminou: `rm -r` pediu confirmação para os arquivos protegidos em
`.git/objects/pack` e terminou com `Directory not empty`. O proprietário repetiu a remoção somente de
`$HOME/tick-restore-41382697246` e `$HOME/tick-backup-check.Q3sdAh` com `rm -rf --`
e recebeu `Limpeza concluída.`. A limpeza está confirmada; a instalação habitual
do projeto foi preservada. O ensaio de restore em duas máquinas está concluído.
A estabilização das execuções diárias do backup continua aberta.

## Mitigação do limite de imagens em 2026-11-02

O workflow `production-backup.yml` passa
`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` ao Supabase CLI 2.98.2 para evitar o
limite compartilhado do ECR público. Não houve atualização major da CLI.
`make backup-image-check` executou `pg_dump (PostgreSQL) 17.6` na imagem
`ghcr.io/supabase/postgres:17.6.1.106`; `make backup-command-check` passou em
modo dry-run e `make test-release-workflow` cobre a configuração do workflow.
A alteração ainda precisa ser publicada e observada no GitHub Actions.
Aprovação do restore real não comprova estabilidade de execuções diárias.

## Aceite após publicação em 2026-11-02

O proprietário confirmou deploy completo e aceitou backup e GitHub Actions
como funcionais, sem aguardar série adicional de execuções. Os passos 4 e 5
foram encerrados por aceite, com reabertura em nova falha. Evidências conferidas,
SHA publicado, origem da confirmação da Vercel e limites estão no
[registro operacional](deploy-hook-setup.md#aceite-operacional-em-2026-11-02-após-publicação).
As pendências de publicação descritas acima são histórico da preparação local.
