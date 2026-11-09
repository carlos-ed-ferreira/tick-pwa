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
adapter e pode ser substituído sem alterar a outbox. O ambiente usa
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
é armazenado. Esse campo faz parte do comportamento atual da ingestão do fornecedor.

Os limites iniciais são uma fila de 25 operações e uma operação com cinco
minutos. Eles devem ser ajustados somente com evidência de uso real.

## Quotas do Supabase Free

O Supabase Free não fornece log drain nem backup automático como garantia do
plano. No painel do Supabase, habilitar todas as notificações de uso disponíveis
e tratar 70% de database size, disk, egress ou conexões como aviso crítico. O proprietário acompanha Usage manualmente; não há coleta automática de
quotas pelo aplicativo.

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
14 dias no GitHub Actions. A CLI do Supabase baixa suas imagens do GHCR, por
`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`.

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
make backup-restore-prepare
make backup-restore archive=<caminho-do-arquivo.enc>
```

4. O comando decifra em diretório temporário, cria um container PostgreSQL 17
   isolado, prepara os schemas Auth e Storage, restaura roles, schema e dados,
   valida a quantidade de tabelas públicas, imprime RPO e RTO e remove
   containers, volumes anônimos e arquivos temporários.
5. Entregar data, responsável, `backupCreatedAt`, `publicTables`, `rpoMs` e
   `rtoMs` no resultado da tarefa de validação, sem anexar dados do backup.

Nunca apontar esse comando para produção. O proprietário executa o ensaio em
uma segunda máquina; não há exigência de outra pessoa. Repetir pelo menos
mensalmente e antes de mudanças operacionais relevantes.

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
`public.ecr.aws/supabase/gotrue:v2.197.0`, versão fixada no Makefile e no utilitário de restore. O
[comando oficial de migrations](https://github.com/supabase/auth/blob/master/cmd/migrate_cmd.go)
prepara as tabelas, colunas e funções do Auth, incluindo `auth.jwt()` e
`audit_log_entries.ip_address`, sem iniciar o servidor HTTP de autenticação.
Ele usa somente a rede do container Postgres, uma URL em `127.0.0.1` e a senha
aleatória do ensaio para `supabase_auth_admin`. Nenhuma credencial de produção
é necessária além da chave de decifragem. O container de migrations é removido
ao terminar, inclusive em falha.

O schema Storage é preparado depois do Auth pelo comando
`node dist/scripts/migrate-call.js` da imagem oficial
`docker.io/supabase/storage-api:v1.81.0`, versão fixada no Makefile e no utilitário, pelo
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
6. Se houver indisponibilidade do banco, seguir a recuperação abaixo e pausar
   migrations.

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
> pendentes devem ser preservadas neste dispositivo. Evite limpar os dados do
> navegador. Estamos verificando o estado local e o envio remoto.

Após a recuperação, comunicar a validação, o risco residual e se o usuário deve
abrir o aplicativo online para drenar a fila.

## Objetivos operacionais e limites do restore

O RPO máximo aceito é de 26 horas. A regularidade real depende das execuções
bem-sucedidas do backup; um agendamento diário não garante esse objetivo quando
o workflow falha ou não executa. O RTO aceito é de 30 minutos para o ensaio de
restore isolado, com imagens já baixadas, não para recuperação completa da produção.

O resultado `rpoMs` mostra a idade do artefato no início daquele ensaio. Não
mede a regularidade dos agendamentos. O restore verifica schema, dados e claims;
não inicia a aplicação nem comprova login funcional ou restore em produção.

## Recuperação de indisponibilidade do banco

Diagnosticar no painel do Supabase sem expor conteúdo ou credenciais:

```sql
select
  current_setting('default_transaction_read_only') as read_only,
  pg_size_pretty(pg_database_size(current_database())) as database_size;

select
  slot_name,
  active,
  wal_status,
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal
from pg_replication_slots
order by slot_name;
```

Consultar cada resultado. Manter acompanhamento manual de disco, WAL, CPU,
I/O, conexões e Usage. Não remover `supabase_realtime_replication_slot`.

Um slot externo só pode ser removido com autorização de manutenção, consumidor
comprovadamente desativado e slot inativo. Quando o banco estiver read-only,
a mudança de modo pertence apenas à sessão autorizada de manutenção:

```sql
set session characteristics as transaction read write;
select pg_drop_replication_slot('confirmed_inactive_external_slot');
```

Confirmar a remoção e aguardar reciclagem do WAL. Se o banco continuar
bloqueado, avaliar um único restart gerenciado; não repetir restarts enquanto
os indicadores melhoram. Se disco voltar a 95%, read-only retornar ou WAL
crescer sem causa identificada, interromper carga não essencial e acionar o
suporte. Não tentar conceder privilégios gerenciados como `pg_checkpoint`.

Depois de estabilizar, retomar o workflow de produção pelo GitHub conforme o
runbook de deploy. Não fazer nova publicação apenas para reaplicar migrations
já presentes na `main`.

## Retirada de consumidor externo de replicação

1. Interromper novas escritas e conexões do consumidor.
2. Confirmar que o slot está inativo e remover somente o slot externo autorizado.
3. Aplicar a migration declarativa de retirada de publicação e objetos exclusivos.
4. Conferir ownership, remover role, grants, secrets e variáveis do consumidor.
5. Excluir o projeto no fornecedor e verificar recursos e fluxos funcionais.

Roles com `LOGIN`, `REPLICATION` ou `BYPASSRLS` precisam de verificação explícita.
`DROP OWNED BY` é destrutivo e exige privilégios herdados; não é um substituto
para inspecionar ownership. Não conceder `INHERIT` nem apagar objetos sem
avaliar o efeito e obter autorização para a manutenção correspondente.

## Diagnóstico de conflitos

A RPC usa `PT409` para `stale_revision` e `operation_in_progress`. O cliente
reconhece revisão desatualizada pela mensagem, faz um rebase automático e mantém
falha recuperável se não convergir. Na retomada após abrir ou reconectar, uma
falha com código de conflito e rebase já tentado aguarda o reenvio manual, enquanto
`operation_in_progress`, que não passou por rebase, é retomada. Não usar SQLSTATE `40001` para conflito de
negócio: o PostgREST pode repetir a transação sem resolver a revisão enviada.
O benchmark HTTP local exercita esse contrato além dos testes pgTAP.

Uma operação stale tem limite de tentativas. Conferir a fila, a release e
clientes antigos antes de reativar uma flag; não limpar IndexedDB. Investigar
requisições antigas presas somente diante de evidência e com autorização para
qualquer intervenção remota.
