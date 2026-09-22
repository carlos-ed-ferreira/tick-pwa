# Runbook de configuração externa de produção

## Objetivo

Registrar, em ordem de execução, as ações que o proprietário do Tick precisa
executar em painéis e ambientes externos. Complementa o
[plano de implementação](../planning/implementation-plan.md), o
[runbook de observabilidade e backup](observability-backup-restore.md) e o
[registro do incidente de WAL](incidents/2026-08-31-supabase-wal-read-only.md).

Execute um passo por vez. Um passo só está concluído quando a evidência
indicada existe, não quando a configuração foi salva.

## Regras de segurança

- Use contas com MFA em GitHub, Supabase, Vercel, Sentry, registrador do
  domínio e futuro provedor de cobrança.
- Não cole tokens, senhas, DSN privados, connection strings ou a chave de
  backup em issues, commits, screenshots, chats ou neste arquivo.
- Guarde secrets no cofre do provedor e uma cópia recuperável no gerenciador de
  senhas do proprietário.
- Use somente dados sintéticos nos ensaios.
- Não execute benchmark, restore ou teste destrutivo contra produção.
- Registre horários em UTC e em `America/Sao_Paulo`.
- Se a interface de um fornecedor não apresentar a opção descrita, pare e
  consulte a documentação oficial atual em vez de escolher uma opção parecida.

## Recursos além desta máquina

Estes itens não podem ser concluídos em uma única máquina. Planeje-os antes de
começar o passo correspondente.

| Passo | Recurso necessário                 | Motivo                                                                    |
| ----- | ---------------------------------- | ------------------------------------------------------------------------- |
| 1.4   | segunda sessão do app              | confirmar convergência entre dispositivos após reconexão                  |
| 3.5   | **segunda máquina com Docker**     | restaurar o backup fora do ambiente que o gerou                           |
| 3.5   | **segunda pessoa**                 | provar que o procedimento escrito basta para quem não construiu o sistema |
| 3.5   | canal separado para a chave        | provar que a chave é recuperável sem depender de quem fez o backup        |
| 7.3   | projeto Supabase dedicado          | carga não pode tocar produção                                             |
| 8     | **Android físico e iPhone físico** | arrasto, teclado virtual, tooltip e reconexão não se validam em emulador  |
| 9.5   | rede e resolvedor DNS alternativos | validar propagação fora do cache local                                    |

A segunda máquina do passo 3.5 precisa de Node >= 20.9, Docker funcional,
checkout do mesmo SHA do workflow e **nenhuma credencial de produção no
ambiente**. Não precisa de `npm ci`: os scripts de backup e restore usam apenas
módulos nativos do Node.

Quando não houver segunda pessoa disponível, execute o ensaio na segunda
máquina seguindo somente o que está escrito em
[observability-backup-restore.md](observability-backup-restore.md), sem
consultar histórico ou memória, e anote cada ponto em que foi preciso deduzir
algo ausente. Cada anotação é uma falha de documentação. Registre que o ensaio
de independência não foi feito; ele continua pendente até o cadastro público.

## Registro geral

| Passo | Responsável  | Data       | Evidência                               | Resultado              |
| ----- | ------------ | ---------- | --------------------------------------- | ---------------------- |
| 1     | proprietário | 2026-09-22 | consultas de verificação e ensaio 1.4   | aprovado               |
| 2     | proprietário | 2026-09-22 | eventos sintéticos e regras em Monitors | aprovado com limitação |
| 3     | proprietário | 2026-09-22 | run 35763900841; restore pendente       | em andamento           |
| 4     |              |            |                                         | pendente               |
| 5     |              |            |                                         | pendente               |
| 6     |              |            |                                         | pendente               |
| 7     |              |            |                                         | pendente               |
| 8     |              |            |                                         | pendente               |
| 9     |              |            |                                         | pendente               |

## 1. Fechar o incidente da retirada do PowerSync

Concluído em 2026-09-22.

### 1.1 Verificar o estado do banco

O SQL Editor do Supabase mostra apenas o resultado do último statement quando
vários são enviados juntos. Uma checagem intermediária executa, mas o resultado
não aparece, e é possível aprovar o passo sem ter visto a maior parte dele. Use
sempre uma consulta única:

```sql
select
  current_setting('default_transaction_read_only')                              as read_only,
  (select count(*) from pg_roles where rolname = 'powersync_role')              as powersync_role,
  (select count(*) from pg_replication_slots where slot_name like 'powersync%') as powersync_slots,
  (select string_agg(slot_name, ', ') from pg_replication_slots)                as all_slots,
  (select count(*) from pg_publication where pubname = 'powersync')             as powersync_publication,
  to_regclass('public.powersync_poc_category_tags')::text                       as category_tags,
  to_regclass('public.powersync_poc_daily_entries')::text                       as daily_entries,
  to_regclass('public.powersync_poc_checklist_items')::text                     as checklist_items,
  (select count(*) from supabase_migrations.schema_migrations
    where version = '20260828180055')                                           as migration;
```

Aprovação: `read_only = off`, as quatro contagens de PowerSync em `0`, as três
colunas de tabela `null` e `migration = 1`.

### 1.2 Remover slot externo abandonado

Nunca remova `supabase_realtime_replication_slot`. Um slot externo só sai depois
de confirmar no fornecedor que o consumidor foi encerrado e na consulta que
`active = false`:

```sql
set session characteristics as transaction read write;

select pg_drop_replication_slot('nome_exato_do_slot_inativo_confirmado');
```

Se o slot estiver ativo, o nome for duvidoso ou o banco voltar a somente
leitura, pare e acione o suporte do Supabase.

### 1.3 Remover a role do fornecedor

A limpeza externa de 2026-08-31 registrou a remoção de `powersync_role`, mas a
role havia permanecido, com `LOGIN`, `REPLICATION` e `BYPASSRLS` sem expiração.
Isso é acesso capaz de ignorar todas as policies de RLS. Confira o estado real
em `pg_roles` em vez de confiar no relato da limpeza.

Inspecione, neutralize e só então remova:

```sql
select
  r.rolcanlogin, r.rolreplication, r.rolbypassrls, r.rolvaliduntil,
  (select count(*) from pg_class c where c.relowner = r.oid) as owned_relations
from pg_roles r
where r.rolname = 'powersync_role';

alter role powersync_role nologin noreplication nobypassrls;

drop role powersync_role;
```

Não comece por `drop owned by`. Ele falha com `42501` mesmo para `postgres`,
porque a membership concedida por `supabase_admin` traz `ADMIN OPTION` sem
`INHERIT`. `DROP ROLE` exige apenas `ADMIN OPTION`. Se `owned_relations` for
maior que zero, pare e avalie cada objeto antes de conceder `INHERIT` e usar
`DROP OWNED BY`, que apagaria esses objetos.

### 1.4 Ensaio funcional

Com a conta interna, usando **duas sessões**:

1. crie e edite tarefa, categoria, meta e etapa online;
2. fique offline, altere algo e recarregue ainda offline;
3. volte online e aguarde o indicador retornar sozinho a `Sincronizado`;
4. confirme a convergência na segunda sessão;
5. confirme que guest não envia entidades e que conta fora da allowlist segue o
   caminho esperado.

## 2. Sentry, alertas e teste sintético

Concluído em 2026-09-22, com a limitação registrada em 2.4.

### 2.1 Criar o projeto

1. Plataforma **Browser JavaScript**, framework **Vanilla**. Não escolha Next.js:
   o Tick usa `@sentry/browser` com `init` manual, não `@sentry/nextjs`.
2. Habilite apenas **Error monitoring**. Deixe Logging, Session Replay, Tracing
   e Application Metrics desligados.
3. Nome `tick-production`; acesso restrito a responsáveis por incidentes.
4. Em Alert frequency, escolha criar os próprios alertas depois.
5. Desabilite armazenamento de IP em **projeto e organização**.
6. Ignore o snippet de onboarding; o código já inicializa o SDK. Copie apenas o
   **DSN público**, em Client Keys (DSN). Não confunda com Auth Token.

### 2.2 Variáveis na Vercel

Somente no escopo **Production**:

```text
NEXT_PUBLIC_TICK_TELEMETRY_DSN=<DSN público>
NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT=production
```

Gere novo deployment: variável `NEXT_PUBLIC_*` entra no build. Não cadastre
`NEXT_PUBLIC_TICK_RELEASE`; a release usa o SHA do deploy automaticamente.

### 2.3 Criar os alertas

O Sentry renomeou **Alerts** para **Monitors**. As regras ficam em
`https://<org>.sentry.io/monitors/alerts/` e são criadas a partir do monitor de
erro do projeto. Um único monitor recebe as cinco regras; elas se distinguem só
pelo filtro de tag.

Cada regra:

- **Source**: `Alert on specific monitors` com o Error Monitor de
  `tick-production`;
- **Filter Issues**: environment `production`;
- **WHEN**: `An event or issue activity is captured`;
- **IF**: uma única linha, `The event's` `telemetry_signal` `tag` `equals`
  `<valor>`;
- **THEN**: notificação por e-mail;
- **Throttling**: conforme a tabela.

| Nome                      | Valor da tag        | Action Throttle           |
| ------------------------- | ------------------- | ------------------------- |
| Tick API unavailable      | `api_unavailable`   | 1 hora                    |
| Tick old operation        | `old_operation`     | 1 hora                    |
| Tick queue accumulated    | `queue_accumulated` | 1 hora                    |
| Tick sync failures        | `sync_failure`      | 1 hora                    |
| Tick synthetic validation | `synthetic_failure` | every trigger; temporário |

Armadilhas confirmadas:

- o filtro é **uma linha só**, com chave, operador e valor; separar em linhas
  diferentes cria três filtros independentes e a regra nunca casa;
- `A new issue is created` não serve: cada sinal é uma issue única e a regra
  dispararia uma vez e nunca mais;
- a condição de frequência `5 eventos em 10 minutos` não existe mais no builder
  atual; o throttle cumpre o papel de limitar repetição;
- não crie regra para `telemetry_signal:healthy`, que é o caminho normal.

Configure também aviso de consumo do plano em **Settings da organização →
Subscription → Manage Spend Notifications**, com limiar de 70%.

### 2.4 Teste sintético

1. Crie `NEXT_PUBLIC_TICK_TELEMETRY_SYNTHETIC_FAILURE=1` somente em Production.
2. Gere deployment e abra a aplicação uma vez em janela limpa.
3. Em **Issues**, busque `telemetry_signal:synthetic_failure`. **Confira o
   seletor de período**: ele é global, fica gravado e pode estar em uma janela
   antiga, escondendo o evento.
4. Abra o evento e o link **JSON**, ao lado do horário.
5. Confirme ausência de `request.url`, `request.headers`, `breadcrumbs`,
   `ip_address`, User-Agent, identificador de usuário, e-mail, token e conteúdo
   funcional. O contexto `tick` deve conter apenas `appVersion`, `browserName`,
   `browserVersion`, `environment` e `signal`.
6. Confirme o recebimento do e-mail do alerta. Se a regra foi corrigida depois
   do evento chegar, ela não dispara retroativamente: recarregue para gerar
   outro evento.
7. Remova a variável, gere novo deployment e confirme ausência de novo evento.
8. Desative ou exclua somente o alerta sintético.

Limitação registrada: o evento retém `user.geo` com país, região e cidade. O
Sentry acrescenta o campo na ingestão, a partir do IP da conexão, depois do
estágio de scrubbing. Desabilitar armazenamento de IP em projeto e organização e
criar a regra `[Remove] [Anything] from [$user]` nos dois níveis não removeu o
campo, verificado em quatro eventos consecutivos. Nenhum IP é armazenado. A
única solução restante seria rotear os eventos por endpoint próprio, o que não
se justifica nesta fase. Reavaliar no passo 6.6.

## 3. Backup e primeiro restore

Backup concluído em 2026-09-22. Restore pendente: **exige segunda máquina**.

### 3.1 Decisões

Registre antes de habilitar:

| Campo                     | Decisão                |
| ------------------------- | ---------------------- |
| RPO máximo aceito         | `[DEFINIR]`            |
| RTO máximo aceito         | `[DEFINIR]`            |
| Retenção                  | 14 dias ou `[ALTERAR]` |
| Quem pode acessar a chave | `[DEFINIR]`            |
| Cofre externo             | `[DEFINIR]`            |

Com execução diária às 03:17 UTC, um primeiro objetivo coerente é RPO menor que
26 horas. É proposta operacional, não garantia, até o primeiro restore.

### 3.2 Obter os valores

1. Supabase → **Connect** → connection string do **Session pooler**, porta
   **5432**. A 6543 é do Transaction pooler e não serve para `pg_dump`, que
   precisa de sessão.
2. Gere uma chave aleatória com pelo menos 48 caracteres. O script exige 32.
   Guarde em item separado da senha do banco. A chave não pode ser
   `SUPABASE_DB_PASSWORD` e não deve existir na Vercel.

### 3.3 Configurar o GitHub

Os dois tipos de valor vão para lugares diferentes, e trocar isso quebra o
workflow de formas distintas.

**Environment secrets**, em Settings → Environments → `Production`:

```text
SUPABASE_DB_URL
TICK_BACKUP_ENCRYPTION_KEY
```

**Repository variable**, em Settings → Secrets and variables → Actions → aba
**Variables**:

```text
ENABLE_PRODUCTION_BACKUP=1
```

A variable precisa ser de repositório. O job usa
`if: vars.ENABLE_PRODUCTION_BACKUP == '1'`, e esse `if` é avaliado antes de o
environment ser resolvido: uma variable criada dentro do environment
`Production` não é enxergada e o job é pulado para sempre. Run com duração de
segundos e sem artifact é a assinatura desse caso.

A senha entra em dois formatos diferentes:

- `SUPABASE_DB_PASSWORD`: senha crua, sem codificação;
- `SUPABASE_DB_URL`: senha **percent-encoded** dentro da URI.

Qualquer caractere `@`, `:`, `/`, `?`, `#`, `%`, `&`, `+` ou espaço na senha
invalida a connection string se não for codificado. O erro aparece como
`failed to parse as DSN (invalid dsn)`. Monte e envie sem passar por arquivo,
tela ou histórico:

```bash
read -r -p "Usuário (postgres.<project-ref>): " DB_USER
read -r -s -p "Senha do banco: " DB_PASSWORD; echo
read -r -p "Host do Session pooler: " DB_HOST
export DB_USER DB_PASSWORD DB_HOST
printf '%s' "$DB_PASSWORD" | gh secret set SUPABASE_DB_PASSWORD --env production
node -e 'process.stdout.write(`postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:5432/postgres`)' \
  | gh secret set SUPABASE_DB_URL --env production
unset DB_USER DB_PASSWORD DB_HOST
```

O `printf '%s'` evita a quebra de linha final, outra causa clássica de secret
inválido.

Ao trocar a senha do banco, atualize os dois secrets e o gerenciador de senhas.
Vercel, `.env.local` e `.env.example` não contêm senha de banco e não precisam
de ajuste.

### 3.4 Gerar o primeiro backup

**Actions → Production backup → Run workflow** na `main`.

Aprovação: job `Create encrypted backup` verde, com os três steps
(`Create logical backup`, `Encrypt backup`, `Upload encrypted backup`) também
verdes; um único artifact terminando em `.enc`; retenção de 14 dias.

Um run falho abre issue com label `backup-failure`. Feche-a registrando a causa
depois de corrigir.

### 3.5 Ensaio de restore — exige segunda máquina

Requisitos da máquina do ensaio:

- Node >= 20.9 e Docker funcionando;
- checkout do mesmo SHA do workflow;
- artifact `.enc` baixado com `gh run download <run-id>`;
- chave recebida por canal separado;
- **nenhuma credencial de produção no ambiente**.

Não é necessário `npm ci`.

```bash
read -r -s -p "Backup encryption key: " TICK_BACKUP_ENCRYPTION_KEY
export TICK_BACKUP_ENCRYPTION_KEY; echo
make backup-restore archive=<caminho-absoluto-do-arquivo.enc>
unset TICK_BACKUP_ENCRYPTION_KEY
```

O comando sobe um Postgres 17 isolado, restaura roles, schema e dados, valida
tabelas, imprime `publicTables`, `backupCreatedAt`, `rpoMs` e `rtoMs`, e remove
o container ao final.

`rpoMs` mede a distância entre a criação do backup e o início do restore, ou
seja, depende de quando o ensaio for executado. Ele não representa o RPO
operacional, que é governado pelo agendamento diário. Registre o valor medido e
a interpretação.

Aprovação do passo: workflow diário habilitado; ao menos um artifact cifrado
válido; restore executado; `publicTables` maior que zero; RPO e RTO reais
registrados na tabela de evidências de
[observability-backup-restore.md](observability-backup-restore.md); chave
recuperável no cofre externo; container e temporários removidos.

## 4. Deploy Hook e controle do auto-deploy

Crie o hook e o secret **antes** de desligar o auto-deploy, para não deixar a
produção sem caminho de publicação. Não desconecte o repositório da Vercel:
Deploy Hooks exigem repositório conectado. Não use `github.enabled=false`, que
bloqueia Deploy Hooks.

### 4.1 Pré-requisito no repositório

O job `deploy-production`, que dispara o hook, precisa estar na `main`. Enquanto
não estiver, o hook nunca é acionado pelo GitHub. Confirme com
`git show origin/main:.github/workflows/supabase-migrations.yml | grep VERCEL_DEPLOY_HOOK_URL`.

### 4.2 Criar o hook

Vercel → Settings → Git → Deploy Hooks → Create Hook, nome
`tick-production-after-migrations`, branch `main`. Copie a URL uma única vez
para o gerenciador de senhas e trate-a como secret: qualquer pessoa com ela
inicia um deploy. Não dispare o hook manualmente agora.

### 4.3 Cadastrar no GitHub

Settings → Environments → `Production` → Environment secrets →
`VERCEL_DEPLOY_HOOK_URL`. Não crie como repository variable e não coloque na
Vercel. Confirme que `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` e
`SUPABASE_DB_PASSWORD` continuam no mesmo environment.

### 4.4 Desligar o auto-deploy da `main`

Vercel → Settings → Git → controle de automatic Git deployments ou regras por
branch. Desabilite o disparo automático para `main` preservando a conexão Git e
o funcionamento dos Deploy Hooks. Preserve previews de pull request, sem acesso
ao Supabase de produção.

Se o painel não oferecer regra que desligue somente o auto-deploy sem bloquear o
hook, pare. Não desative a integração inteira; registre a ausência da opção para
que a estratégia seja revista.

## 5. Publicar uma mudança inócua e comprovar a ordem

Use mudança exclusivamente documental, sem schema, dependência ou alteração
funcional. O objetivo é provar o pipeline.

1. Confirme que os passos 1 e 4 estão concluídos.
2. Rode os gates aplicáveis, faça commit e publique pelo fluxo protegido.
3. No pull request, confirme `Check app`, `Check database` e `Check end-to-end`.
4. Em **Actions → Supabase migrations**, confirme a ordem: `Confirm quality
gate`, depois `Apply production migrations`, depois `Deploy production
application`. Em commit documental, `Detect database changes` registra
   ausência de alteração e o job ainda conclui com sucesso.
5. Copie do summary o `Approved SHA` e o ID do job da Vercel.
6. Em Vercel → Deployments, confirme ambiente Production, branch `main`, commit
   idêntico ao `Approved SHA`, início posterior ao fim das migrations e estado
   `Ready`.
7. Faça smoke test de calendário, metas, login e modo guest no domínio canônico.
8. Confirme que existe **um único** deployment de produção para o SHA. Um
   deployment automático iniciado antes do fim das migrations reprova o passo.

Deploy Hooks não recebem o SHA no payload; por isso a comparação visual do
commit é obrigatória.

Em caso de falha: não reaplique migrations manualmente; preserve logs e ID do
job; confirme a issue `pipeline-failure`; promova o último deployment saudável
na Vercel; para banco, use somente migration compensatória aditiva criada e
validada no repositório; nunca edite migration já aplicada.

## 6. Decisões de Auth, guest, trial, billing e migração

Este passo produz decisões escritas. Não contrate provedor antes de preencher e
aprovar as tabelas.

### 6.1 SMTP, domínio e e-mails

O SMTP padrão do Supabase não serve para produção e envia somente para
endereços autorizados do time. Escolha provedor transacional com logs de
entrega, tratamento de bounce, MFA, SPF e DKIM; verifique o domínio e publique
SPF/DKIM/DMARC; desabilite tracking de links, que quebra links de confirmação;
configure **Authentication → Emails/SMTP Settings**; defina `Site URL` e
mantenha somente redirects conhecidos; revise os templates em pt-BR e en; teste
entrega, spam, expiração e uso único.

| Campo                      | Decisão     |
| -------------------------- | ----------- |
| Provedor SMTP              | `[DECIDIR]` |
| Região/retentor de dados   | `[DECIDIR]` |
| Remetente                  | `[DECIDIR]` |
| SPF/DKIM/DMARC verificados | `[SIM/NÃO]` |
| Rate limit inicial         | `[DECIDIR]` |
| Prazo de exportação        | `[DECIDIR]` |
| Prazo de exclusão          | `[DECIDIR]` |

### 6.2 CAPTCHA e abuso

Recomendação inicial: Cloudflare Turnstile desde a abertura do cadastro. Crie o
site para os domínios exatos de produção, guarde site key e secret
separadamente, habilite em **Authentication → Bot and Abuse Protection**,
cadastre o secret somente no Supabase, defina limites para cadastro,
recuperação e reenvio, e teste sucesso, token ausente, token inválido,
expiração e indisponibilidade.

### 6.3 Guest, trial e entitlement

Nunca apague dados ao atingir limite ou expiração: bloqueie apenas novas ações
definidas e preserve leitura, exportação e exclusão.

| Pergunta                   | Decisão                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Limite de tarefas guest    | `[DECIDIR NÚMERO]`                                                                    |
| Limite de metas guest      | `[DECIDIR NÚMERO]`                                                                    |
| Limite de categorias guest | `[DECIDIR NÚMERO]`                                                                    |
| Usuário já acima do limite | `[RECOMENDADO: preservar tudo e bloquear somente novas criações]`                     |
| Início do trial            | `[RECOMENDADO: primeira sessão após confirmação de e-mail, pelo relógio do servidor]` |
| Duração                    | `7 dias` ou `[ALTERAR]`                                                               |
| Unidade antifraude         | `[RECOMENDADO: conta; definir tratamento de e-mail/dispositivo]`                      |
| Acesso após expiração      | `[DECIDIR: leitura/sync/exportação e quais escritas ficam bloqueadas]`                |
| Remoção da allowlist       | `[DEFINIR MARCO]`                                                                     |

### 6.4 Billing e fiscal

Confirme a entidade jurídica; consulte contador e jurídico sobre emissão
fiscal, impostos, chargeback, cancelamento, reembolso e LGPD; compare
provedores por cartão nacional e internacional, Pix, moedas, portal do cliente,
webhooks, retries e taxas; use sandbox antes da integração de produção. O
frontend nunca concede entitlement.

| Campo                               | Decisão                                  |
| ----------------------------------- | ---------------------------------------- |
| Provedor                            | `[DECIDIR]`                              |
| Entidade recebedora                 | `[DECIDIR]`                              |
| Brasil                              | `R$ 10,00/mês` provisório ou `[ALTERAR]` |
| Exterior                            | `US$ 5.00/mês` provisório ou `[ALTERAR]` |
| Grace period                        | `[DECIDIR]`                              |
| Acesso durante inadimplência        | `[DECIDIR]`                              |
| Política de cancelamento/reembolso  | `[DECIDIR]`                              |
| Sandbox e responsável pelos secrets | `[DECIDIR]`                              |

### 6.5 Migração guest

Recomendação inicial: fluxo explícito e consentido, merge com remapeamento de
IDs, sem deduplicação por texto, preservando a origem guest até confirmação
canônica.

| Pergunta                   | Decisão                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Oferecer migração          | `[SIM/NÃO]`                                                        |
| Marco de ativação          | `[DECIDIR]`                                                        |
| Conta já contém dados      | `[RECOMENDADO: mesclar com IDs remapeados]`                        |
| Itens aparentemente iguais | `[RECOMENDADO: não deduplicar automaticamente]`                    |
| Origem guest após sucesso  | `[DECIDIR: preservar por N dias ou apagar com novo consentimento]` |
| Falha parcial              | `manter origem e permitir retry pelo mesmo migration_id`           |

### 6.6 Legal

Antes do cadastro público, publique e versione termos de uso, política de
privacidade, política de retenção e exclusão, subprocessadores e regiões, canal
para exportação, correção e exclusão, política de assinatura, renovação,
cancelamento e reembolso, e contato para incidentes. Inclua a limitação de
geolocalização registrada em 2.4. Peça revisão profissional; este runbook não
substitui orientação jurídica, fiscal ou contábil.

## 7. Modelo e ambiente para carga de 1.000 DAU

### 7.1 Aprovar o modelo

Proposta inicial, não resultado medido. Para cada linha, marque `APROVADO` ou
escreva o novo valor.

| Parâmetro                    | Proposta                        |
| ---------------------------- | ------------------------------- |
| Usuários ativos por dia      | 1.000                           |
| Pico simultâneo              | 100 usuários                    |
| Sessões por usuário/dia      | 2                               |
| Duração média                | 10 minutos                      |
| Refreshes remotos por sessão | 3                               |
| Edições por sessão           | 10                              |
| Mutações médias por lote     | 5                               |
| Conta madura                 | 5.000 itens funcionais          |
| Hierarquia profunda          | 20 níveis para teste de limite  |
| Distribuição de rede         | Wi-Fi, 4G rápido e 4G degradado |

Defina também duração do pico, proporção de navegadores, percentual de sessões
offline, percentual de conflitos entre dispositivos, crescimento mensal
esperado e margem mínima sobre o pico.

### 7.2 Budgets

| Métrica                           | Budget aprovado |
| --------------------------------- | --------------- |
| RPC p95                           | `[DECIDIR]`     |
| RPC p99                           | `[DECIDIR]`     |
| Primeiro pull p95                 | `[DECIDIR]`     |
| Convergência após reconexão p95   | `[DECIDIR]`     |
| Taxa de erro                      | `[DECIDIR]`     |
| Timeout                           | `[DECIDIR]`     |
| CPU máxima sustentada             | `[DECIDIR]`     |
| Conexões máximas                  | `[DECIDIR]`     |
| Quota de disco/egress para alerta | `70%`           |
| Regressão máxima contra baseline  | `10%`           |

### 7.3 Ambiente isolado

Projeto Supabase dedicado, nunca produção, com região e versão de Postgres
equivalentes; migrations apenas pelo fluxo preparado para o ambiente isolado;
contas e conteúdo sintéticos; nenhum dado, usuário ou secret copiado de
produção; deploy isolado do frontend apontando só para esse projeto; acesso
restrito ao time do ensaio; data de exclusão e teto de custo definidos e
autorizados por escrito.

O benchmark existente é local e mede a RPC; não simula 1.000 DAU sozinho:

```bash
make benchmark-account-rpc
```

Ele rejeita URL não local. Não altere a trava para apontá-lo para produção.

### 7.4 Critérios de aborto

Interrompa imediatamente se dados reais ou PII aparecerem no ambiente, se
tráfego chegar a produção, se erro de autorização cruzar usuários, se houver
perda de operação local ou duplicação remota, se a fila ficar sem limite, se
CPU, disco, conexões ou egress chegarem a 70%, se a taxa de erro exceder o
budget ou se o custo ultrapassar o teto.

## 8. Validar Android e iOS físicos — exige aparelhos reais

Emulador não valida arrasto por toque, teclado virtual, tooltip por toque longo
nem reconexão. Use ao menos um Android com Chrome estável e um iPhone com Safari
estável, preferencialmente com uma versão anterior de cada.

Registre antes do teste modelo, sistema e versão, navegador e versão, browser ou
PWA instalada, tipo de rede, viewport e orientação, data e horário. Use conta
interna com dados sintéticos e grave a tela quando possível, sem expor e-mail,
token ou conteúdo pessoal.

Roteiro em cada aparelho:

1. abra `/calendar` em retrato e crie tarefa pelo campo mais próximo do fim da
   tela;
2. com o teclado aberto, confirme que campo, ação e conteúdo em edição seguem
   alcançáveis por scroll;
3. feche e reabra o teclado e confirme ausência de salto ou conteúdo preso;
4. toque em um dia e confirme que abre sem iniciar arrasto acidental;
5. crie tarefa e subtarefa com textos longos;
6. arraste com o dedo para reordenar antes, depois e como filha de outro item;
7. confirme que o scroll da página não disputa o gesto de forma permanente;
8. toque longo no checkbox e confirme o seletor direto de estado;
9. toque longo em texto truncado e confirme o tooltip completo;
10. navegue somente por toque por menus, modais e ações de ícone;
11. abra `/goals`, crie grupo, meta e etapas e repita o arrasto;
12. gire para paisagem e volte;
13. em aparelho com notch, confirme cabeçalho, rodapé e ações dentro da safe
    area;
14. aumente zoom e tamanho de texto e verifique overflow;
15. fique offline, altere uma entidade, feche totalmente o navegador ou a PWA e
    reabra ainda offline;
16. confirme persistência local, volte online e aguarde convergência;
17. atualize a PWA e confirme que dados locais permanecem.

No Safari/iOS, registre especificamente o comportamento do teclado, porque
`interactiveWidget: 'resizes-content'` pode não ser implementado. O critério é a
interface permanecer utilizável.

Marque cada caso como `APROVADO`, `DIVERGÊNCIA NÃO BLOQUEANTE` com evidência e
plano, ou `REPROVADO` com gravação, aparelho, orientação e passos exatos.
Screenshot estático não prova arrasto, teclado, tooltip ou reconexão. Confirme
também que o desenho desktop não mudou após qualquer correção.

## 9. Cloudflare, DNS e upgrades no marco público

Não antecipe este passo durante a alfa. Comece quando observabilidade,
backup/restore, deploy ordenado, decisões comerciais e carga estiverem
aprovados.

### 9.1 Revisar a hospedagem

Compare permanecer na Vercel com migrar para Cloudflare, registrando para cada
alternativa custo mensal para o tráfego medido, limites e excedentes, uso
comercial permitido, SLA e suporte, logs, integração com GitHub, rollback,
impacto em PWA, deep links, locale e cache, e dependências server-side ainda
existentes. Não migre enquanto o build depender de comportamento dinâmico do
Next.js sem substituição comprovada.

### 9.2 Conferir planos no dia da decisão

Abra as páginas oficiais e registre URL, data e valores de Vercel, Supabase,
Cloudflare, Sentry, provedor SMTP, provedor de billing e PITR. Gatilhos: Vercel
Pro quando o uso comercial começar; Supabase Pro no lançamento público, risco de
pausa, necessidade de SLA/backup ou 70% de quota; plano Cloudflare pago somente
quando tráfego medido exceder o Free; PITR quando o RPO público exigir
recuperação mais curta. Nenhuma contratação sem custo, responsável e motivo
registrados.

### 9.3 Preparar sem mudar DNS

Conta Cloudflare com MFA; projeto separado em Workers & Pages; repositório
conectado apenas depois de o protótipo estático existir; publicação primeiro em
`*.pages.dev`; testes de rotas diretas, manifest, instalação, offline, service
worker, cache antigo, headers e CSP; E2E desktop e mobile; medição de
performance. Ainda não adicione o domínio final.

### 9.4 Inventariar e preparar DNS

Exporte todos os registros atuais; registre TTL, MX, SPF, DKIM, DMARC, CAA,
redirects e verificações de fornecedores; confirme acesso ao registrador;
documente os nameservers atuais para rollback; reduza TTL com antecedência;
verifique DNSSEC e o DS record; copie os registros para a zona Cloudflare e
revise um a um; valide e-mail e serviços auxiliares antes do corte.

Domínio apex em Cloudflare Pages exige nameservers da Cloudflare; subdomínio
aceita CNAME. Com DNSSEC ativo, siga a ordem oficial: remover o DS antigo,
aguardar o TTL, trocar nameservers, ativar DNSSEC na Cloudflare e publicar o
novo DS. Fora de ordem, o resultado é `SERVFAIL`.

### 9.5 Executar o corte — exige validação de outra rede

Janela de mudança comunicada; backup e restore recentes confirmados; Vercel
saudável para rollback; domínio associado primeiro em **Pages → Custom
domains**, não apenas por CNAME manual; troca de nameservers quando o apex for
migrado; aguardar a zona ficar `Active`; **validar resolução em redes e
resolvedores diferentes**; validar certificado, redirects e domínio canônico;
smoke test online, offline, login, OAuth, e-mails e sincronização; monitorar
erros, cache e tráfego durante a janela.

Rollback: defina responsável e limite de tempo antes do corte. Se reprovar,
interrompa novas mudanças, preserve logs, restaure registros ou nameservers
documentados, reaponte para o último deployment saudável da Vercel, considere
TTL e DNSSEC antes de declarar recuperação, confirme login, e-mail, OAuth e
sincronização após propagação, e mantenha o projeto Cloudflare isolado para
diagnóstico.

## Checklist final

- [x] Incidente PowerSync fechado e objetos removidos.
- [x] Sentry recebe e alerta sem conteúdo privado.
- [x] Backup diário cifrado habilitado.
- [ ] Restore executado em segunda máquina, com RPO/RTO registrados.
- [ ] Ensaio de independência com segunda pessoa.
- [ ] Auto-deploy paralelo removido sem bloquear o Deploy Hook.
- [ ] Pipeline migration para deploy comprovado com o mesmo SHA.
- [ ] Decisões de Auth, trial, billing, migração e legal aprovadas.
- [ ] Modelo, budgets e ambiente isolado de carga aprovados.
- [ ] Android e iOS físicos aprovados.
- [ ] Decisão de hospedagem pública, DNS, planos e rollback aprovada.
