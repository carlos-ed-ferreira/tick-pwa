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

O SDK adotado é `@sentry/browser` 10.72.0, licença MIT. Ele fica isolado pelo
adapter e pode ser substituído sem alterar a outbox. A produção continuou com
Vercel Hobby e Supabase Free; esta etapa não autoriza Vercel Pro, Supabase Pro
ou PowerSync Pro.

## Configuração externa do Sentry

1. Criar um projeto Sentry do tipo JavaScript/Browser.
2. Desabilitar armazenamento de endereço IP nas configurações de segurança e
   privacidade do projeto.
3. Restringir acesso ao proprietário e a pessoas responsáveis por incidentes.
4. Na Vercel, cadastrar apenas em Production:

```text
NEXT_PUBLIC_TICK_TELEMETRY_DSN=<DSN público do projeto Sentry>
NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT=production
```

5. Fazer um novo deploy. A release usa automaticamente o SHA do deploy; uma
   substituição explícita pode usar `NEXT_PUBLIC_TICK_RELEASE`.
6. Configurar alertas no Sentry:
   - `telemetry_signal = api_unavailable`: alertar no primeiro evento;
   - `telemetry_signal = old_operation`: alertar no primeiro evento;
   - `telemetry_signal = queue_accumulated`: alertar no primeiro evento;
   - `telemetry_signal = sync_failure`: alertar quando houver 5 eventos em 10
     minutos;
   - uso do plano Sentry em 70%: alertar por e-mail ao proprietário.
7. Cadastrar temporariamente
   `NEXT_PUBLIC_TICK_TELEMETRY_SYNTHETIC_FAILURE=1`, gerar um deploy, abrir a
   aplicação, confirmar recebimento e alerta e então remover a variável e gerar
   outro deploy. Cada carregamento envia no máximo um evento. O evento
   contém apenas `signal`, versão, ambiente e navegador.

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

Nunca apontar esse comando para produção. O ensaio deve ser feito por outra
pessoa além de quem implementou o workflow, pelo menos mensalmente e antes de
cada lançamento público relevante.

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

## Evidências de restore

Ainda pendente de execução externa.

| Data | Responsável | Backup criado em | Tabelas | RPO | RTO | Resultado |
| ---- | ----------- | ---------------- | ------- | --- | --- | --------- |
| —    | —           | —                | —       | —   | —   | pendente  |
