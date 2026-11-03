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

| Passo | Recurso necessário                 | Motivo                                                                   |
| ----- | ---------------------------------- | ------------------------------------------------------------------------ |
| 1.4   | segunda sessão do app              | confirmar convergência entre dispositivos após reconexão                 |
| 3.5   | **segunda máquina com Docker**     | restaurar o backup fora do ambiente que o gerou                          |
| 3.5   | canal separado para a chave        | provar que a chave é recuperável sem depender de quem fez o backup       |
| 7.3   | projeto Supabase dedicado          | carga não pode tocar produção                                            |
| 8     | **Android físico e iPhone físico** | arrasto, teclado virtual, tooltip e reconexão não se validam em emulador |
| 9.5   | rede e resolvedor DNS alternativos | validar propagação fora do cache local                                   |

A segunda máquina do passo 3.5 precisa de Node >= 20.9, Docker funcional,
checkout do mesmo SHA do workflow e **nenhuma credencial de produção no
ambiente**. Não precisa de `npm ci`: os scripts de backup e restore usam apenas
módulos nativos do Node.

Por decisão explícita do proprietário em 2026-11-02, a validação de restore
será feita por ele em dois dispositivos distintos. Uma segunda pessoa não é
requisito dos ensaios de recuperação. O ensaio comprova recuperação
em outra máquina; a revisão humana independente foi dispensada e não é
registrada como executada. Seguir o roteiro escrito e anotar instruções
ausentes continua obrigatório para melhorar sua reprodutibilidade.

## Registro geral

| Passo | Responsável  | Data       | Evidência                                         | Resultado                                  |
| ----- | ------------ | ---------- | ------------------------------------------------- | ------------------------------------------ |
| 1     | proprietário | 2026-09-22 | consultas de verificação e ensaio 1.4             | aprovado                                   |
| 2     | proprietário | 2026-09-22 | eventos sintéticos e regras em Monitors           | aprovado com limitação                     |
| 3     | proprietário | 2026-11-02 | run 41520276777; 10 tabelas; RTO 3,454 s          | restore e backup aceitos pelo proprietário |
| 4     | proprietário | 2026-11-02 | SHA ce9e7d1; run 41536456800; confirmação do dono | deploy completo aprovado pelo proprietário |
| 5     |              |            |                                                   | pendente                                   |
| 6     |              |            |                                                   | pendente                                   |
| 7     |              |            |                                                   | pendente                                   |
| 8     | proprietário | 2026-10-18 | ensaio em Android e iOS físicos                   | aprovado                                   |
| 9     |              |            |                                                   | pendente                                   |

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

Backup habilitado em 2026-09-22. Restore executado com sucesso na segunda
máquina Linux em 2026-11-02 pelo proprietário, com o run `41520276777`:
10 tabelas, `rpoMs = 2859601`, `rtoMs = 3454` e exit status 0.
Containers ausentes e limpeza das pastas confirmada pelo proprietário.
Backup aceito como funcional pelo proprietário após a publicação; reabrir em nova falha.
A exigência de segunda pessoa foi dispensada pelo proprietário em 2026-11-02. Evidência completa em
[observability-backup-restore.md](observability-backup-restore.md).

Revisão em 2026-11-02: configuração habilitada, mas execução intermitente.
O run `41163812529` falhou ao baixar a imagem do Postgres do ECR público com
`toomanyrequests: Data limit exceeded`. Os runs de 1º e 2 de novembro passaram;
o artefato não expirado do run `41382697246` permite executar o passo 3.5 agora.
Esse registro descreve o diagnóstico anterior à correção e ao aceite.
O restore posterior passou; o proprietário dispensou aguardar uma série diária.

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

O passo a passo completo, com a divisão entre as duas máquinas, está em
[two-machine-backup-restore.md](two-machine-backup-restore.md).

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

Em 2026-11-02, o proprietário informou a criação do hook e a consulta de
metadados confirmou `VERCEL_DEPLOY_HOOK_URL` no environment `production`.
O `vercel.json` foi publicado e o deployment completo foi confirmado pelo
proprietário. App CI, migrations/deploy e auditoria passaram no SHA `ce9e7d1`.
O aceite operacional e seus limites estão em
[deploy-hook-setup.md](deploy-hook-setup.md). Os procedimentos abaixo ficam
como referência para nova configuração ou investigação.

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

Em 18 de outubro de 2026 foi confirmado na documentação oficial da Vercel que o
painel não tem controle de auto-deploy por branch. O caminho suportado é
`vercel.json` com `git.deploymentEnabled: { "main": false }`, que preserva a
conexão Git, os previews da `dev` e, pela documentação, os Deploy Hooks; somente
`github.enabled: false` é documentado como bloqueio dos hooks. A primeira
publicação com o arquivo comprova o comportamento real.

O roteiro exato dos passos 4 e 5, incluindo a reexecução do job que falhou na
issue `#43` e a reversão caso o hook seja bloqueado, está em
[deploy-hook-setup.md](deploy-hook-setup.md).

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

## 6. Acesso por convite e modo guest completo

### 6.1 Contas convidadas

Manter Supabase Auth e a allowlist `account_access`. O proprietário autoriza
cada conta remota explicitamente, revisa acessos e mantém OAuth/redirects e
sessões pelos contratos atuais. Não abrir cadastro irrestrito.

Validar login permitido, login sem autorização, revogação de acesso, sessão
expirada e ausência de rede. Proteger ownership por RLS e manter a outbox
recuperável na reconexão. A autorização offline atual pertence somente à mesma
conta e não equivale a liberar acesso remoto após revogação.

### 6.2 Guest local

Todas as funcionalidades de organização ficam disponíveis sem conta, sem
prazo e sem limites de quantidade impostos pelo produto. Os dados ficam apenas
no IndexedDB deste navegador e permanecem ao fechar/reabrir o app.

Não enviar entidades guest ao Supabase, não exigir cartão ou ativação e não
substituir dados reais por exemplos. Entrar em conta convidada troca o escopo;
não importa nem apaga dados guest. O proprietário deve considerar que limpeza
ou remoção do armazenamento pelo navegador pode apagar a única cópia local.

### 6.3 Verificação de manutenção

Conferir guest sem rede, reload, reabertura, dados reais preservados, ausência
de envios remotos guest e isolamento entre duas contas convidadas. Manter os
gates e os runbooks de incidentes. Contrato canônico em
[guest-and-invited-access.md](../planning/guest-and-invited-access.md).

## 7. Desempenho e capacidade no uso atual

### Escopo definido pelo proprietário

Uma pessoa usa o sistema em três dispositivos. O teto conservador de
planejamento é 20 convidados, sem ampliação de acesso prevista nesta etapa.
Não é necessário aprovar carga sintética, pico simultâneo ou budgets de latência
para continuar ou publicar as alterações atuais.

### Experiência esperada

A interface continua utilizável enquanto a sincronização ocorre. Alterações
locais feitas durante o envio/refresh permanecem preservadas; não podem ser
substituídas por dados remotos anteriores. Até cerca de 20 segundos é aceitável
para sincronizar; demora maior recorrente deve ser investigada. Isso não é
um timeout para apagar ou descartar operações, especialmente sem rede.

### Acompanhamento manual e diagnóstico

O proprietário acompanha o uso e os painéis dos serviços. Corrigir lentidão
observada, preferindo soluções simples e eficientes. Não acrescentar complexidade
por ganho pequeno ou tornar metas estatísticas pré-requisito de manutenção.

O [benchmark local existente](cohort-capacity.md) e o comparador de 10% são
ferramentas opcionais para explicar problemas. Não há novo ensaio de carga,
monitoramento de quota ou ambiente dedicado pendente agora. Se houver ensaio,
usar somente dados sintéticos em ambiente isolado; interromper diante de acesso
a produção, dados reais, falha de autorização ou perda de trabalho.

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

## 9. Operação do ambiente atual

Manter GitHub Free, Vercel Hobby e Supabase Free, domínio atual, integração Git,
proteção da main, backup e auditoria. Acompanhar quotas e capacidade com dados
reais da coorte de convidados. Não alterar hospedagem, DNS ou visibilidade do
repositório nesta etapa.

Ao detectar pressão de recursos, registrar métricas, preservar os dados e
tratar consultas redundantes, retenção e frequência de trabalho não essencial.
Uma limitação externa não deve apagar o progresso local ou desativar os
controles de acesso e backup silenciosamente.

## Checklist final

- [x] Incidente PowerSync fechado e objetos removidos.
- [x] Sentry recebe e alerta sem conteúdo privado.
- [x] Backup diário cifrado habilitado.
- [x] Restore executado em segunda máquina, com RPO/RTO registrados.
- [x] Limpeza dos containers e pastas do ensaio confirmada.
- [x] Validação pelo proprietário em dois dispositivos; segunda pessoa dispensada por decisão de 2026-11-02.
- [x] Auto-deploy e Deploy Hook aceitos após confirmação do deploy pelo proprietário.
- [x] Pipeline migrations → hook aprovado no SHA ce9e7d1; deploy completo confirmado pelo proprietário.
- [x] Política definida: contas remotas por convite e guest completo, gratuito e local, sem prazo.
- [x] Escopo definido: um usuário, três dispositivos, teto conservador de 20 convidados; acompanhamento manual pelo uso.
- [x] Android e iOS físicos aprovados.
- [x] Ambiente atual mantido: GitHub Free, Vercel Hobby e Supabase Free.
