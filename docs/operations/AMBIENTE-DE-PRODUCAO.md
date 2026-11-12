# Configuração externa e operação

## Escopo

Este guia descreve a configuração e os procedimentos do ambiente atual:
GitHub Free, Vercel Hobby, Supabase Free e Sentry Free. O proprietário controla
contas, convites, secrets, commits e publicações. Usar MFA nos provedores e no
registrador do domínio. Nunca registrar tokens, senhas, connection strings ou
chaves de backup em arquivos versionados, chat ou screenshots.

O uso atual é uma pessoa em três dispositivos, com teto conservador de 20
convidados. O proprietário acompanha quotas e experiência manualmente. O
aplicativo não coleta automaticamente métricas de disco/WAL/conexões dos
provedores nem impõe budgets estatísticos de capacidade.

## Contas e ambientes

- Supabase Auth e `account_access` controlam contas convidadas. Não há cadastro
  remoto irrestrito. Manter OAuth Google e redirects do domínio canônico.
- Guest usa somente o IndexedDB no navegador e não é importado durante login.
- Local-first significa uso da conta autenticada sem internet. A reabertura
  depende da sessão disponível e de grant positivo da mesma conta/e-mail com
  até 24 horas; a negativa remota de acesso invalida esse grant.
- Production da Vercel recebe ambiente explícito `production`, URL e anon key
  públicas do Supabase. Previews não recebem configuração de produção.
- A flag `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES=1` e os UUIDs em
  `NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS` habilitam a outbox daquela coorte.
  Variáveis públicas são incorporadas no build e exigem novo deploy ao mudar.
- Contas fora da coorte de lotes usam persistência legada; preferências usam
  estado pendente durável e retry em IndexedDB. As entidades legadas continuam
  sem a mesma garantia de outbox da coorte.

## GitHub e Vercel

O ruleset da `main` exige `Check app`, `Check database`, `Check end-to-end` e
`Check security`, conferido por `make main-ruleset-status`.
`make pr-checks-status args=--required` consulta o estado desses checks no PR
aberto da `dev`, incluindo checks pendentes.
O environment `production` guarda os secrets abaixo. O pipeline publica o SHA aprovado pela API Vercel; auto-deploy Git de `main`
está desligado no `vercel.json`. O preflight exige os secrets da API antes de
qualquer migration, sem fallback para hook.

### Inventário de credenciais do GitHub

A Vercel usa uma conta pessoal no plano Hobby, sem time. `VERCEL_TOKEN`,
`VERCEL_PROJECT_ID` e `VERCEL_AUTOMATION_BYPASS_SECRET` estão criados e
cadastrados no environment GitHub `production`, com presença confirmada pelos
metadados de secrets, assim como os outros cinco secrets abaixo: o environment
tem oito secrets, listados por nome e data com `make production-secrets-status`.
Não há Deploy Hook ativo cadastrado para publicação: o hook anterior está
revogado e a publicação usa somente a API. Cadastro confirma a existência do
nome; validade e escopo são conferidos
pelos respectivos consumidores. Os tokens de integração criados manualmente
pelo proprietário, incluindo `VERCEL_TOKEN` e `SUPABASE_ACCESS_TOKEN`, estão
configurados sem expiração automática, conforme informado pelo proprietário.
Essa configuração não impede revogação ou perda de permissão no provedor.
Este inventário registra finalidade e estado atual, sem armazenar valores.

| Secret em `production`            | Origem e finalidade                                                                                                                                                                             | Consumidor e efeito da ausência ou revogação                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VERCEL_TOKEN`                    | Token de acesso criado na conta Vercel, com escopo de acesso ao projeto Tick. Autoriza consultar o projeto, criar deployments e acompanhar seu estado.                                          | `scripts/production-release.mjs`, nos jobs de preflight e deploy de `supabase-migrations.yml`. Sem acesso válido, a publicação é bloqueada; não é uma credencial de login dos usuários do Tick.                                                  |
| `VERCEL_PROJECT_ID`               | Identificador do projeto Vercel, encontrado em Settings → General → Project ID. É um identificador, não uma senha.                                                                              | O mesmo script seleciona e confere o projeto autorizado antes de publicar. Ausente ou incorreto, bloqueia a publicação.                                                                                                                          |
| `SUPABASE_ACCESS_TOKEN`           | Token pessoal da conta Supabase usado para autenticar a CLI nas operações de gestão do projeto. É diferente da anon key do aplicativo.                                                          | `supabase-migrations.yml`, por meio do wrapper `scripts/supabase-cli.mjs`. Sua revogação impede as operações da CLI em produção; não é usado pelo navegador para sincronizar dados.                                                              |
| `SUPABASE_PROJECT_REF`            | Referência do projeto Supabase, disponível nas configurações do projeto. É um identificador, não uma senha.                                                                                     | O wrapper da CLI seleciona o banco de produção para migrations e auditoria do histórico. Um valor errado aponta para o projeto errado ou faz a operação falhar.                                                                                  |
| `SUPABASE_DB_PASSWORD`            | Senha do banco PostgreSQL definida no Supabase.                                                                                                                                                 | Os comandos de migrations e auditoria usam a conexão ao banco. A rotação exige atualizar também a senha contida em `SUPABASE_DB_URL` e no cofre.                                                                                                 |
| `SUPABASE_DB_URL`                 | Connection string do Session pooler do Supabase, incluindo usuário e senha do banco.                                                                                                            | `production-backup.yml` e o comando de dump. Ausente ou inválida, o backup falha. Não é a URL pública da API usada pelo aplicativo.                                                                                                              |
| `TICK_BACKUP_ENCRYPTION_KEY`      | Chave independente gerada pelo proprietário para cifrar os backups.                                                                                                                             | O workflow de backup cifra os dumps; o restore precisa da chave correspondente ao arquivo. Perder a chave impede recuperar os backups cifrados com ela. Ao rotacionar, preservar no cofre as chaves necessárias aos backups ainda retidos.       |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Segredo gerado em Project Settings → Deployment Protection → Protection Bypass for Automation, na Vercel. Permite que a automação acesse a URL imutável `*.vercel.app` do deployment protegido. | `scripts/production-release.mjs` envia o valor no cabeçalho `x-vercel-protection-bypass` durante o smoke pós-deploy de `/`, `/calendar`, `/goals` e `/recurring`. Ausente ou revogado, o smoke recebe a página de proteção e a publicação falha. |

`VERCEL_TEAM_ID` não é cadastrado: o projeto pertence à conta pessoal Hobby,
sem time, e o script só envia `teamId` à API quando o secret existe. Cadastrá-lo
somente se o projeto passar a pertencer a um time da Vercel.

O `GITHUB_TOKEN` é fornecido automaticamente pelo GitHub Actions a cada job;
o workflow o expõe como `GH_TOKEN` onde necessário. Não é outro token que o
proprietário precise criar para esse pipeline.

A variável de repositório `ENABLE_PRODUCTION_BACKUP=1` habilita o backup.
É configuração operacional, não uma credencial.

### Inventário de variáveis da Vercel

As sete variáveis abaixo estão cadastradas no ambiente Production, conforme o
painel informado pelo proprietário. Seus valores não são registrados aqui.
O prefixo `NEXT_PUBLIC_` indica que o valor pode chegar ao navegador pelo build;
mascarar o campo no painel não o torna uma credencial privada de administração.

| Variável em Production                    | Origem e finalidade                                                                                                                           | Consumidor e efeito de mudar ou remover                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                | URL pública da API do projeto Supabase.                                                                                                       | O cliente Supabase do aplicativo usa esse endereço para login e dados remotos. Sem ela, a integração de conta fica indisponível.                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`           | Chave pública de cliente obtida nas configurações de API do Supabase. Não é a senha do banco, o access token da CLI nem uma service role key. | Inicializa o cliente do navegador. O acesso aos dados continua protegido por sessão, allowlist e RLS. Nunca substituir por uma chave administrativa.              |
| `NEXT_PUBLIC_TICK_SUPABASE_ENV`           | Configuração do Tick que seleciona o ambiente remoto; Production usa `production`.                                                            | `src/lib/environment.ts` decide se o aplicativo pode usar Supabase no hostname atual. Ausente ou inválida, desabilita essa integração.                            |
| `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` | Flag do Tick; `1` habilita o caminho de lotes para a coorte configurada.                                                                      | Seleciona a outbox funcional durável em conjunto com a lista de usuários. Alterá-la muda o caminho de persistência e exige o procedimento de rollout/rollback.    |
| `NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS` | Lista de UUIDs de contas, separados por vírgula, autorizadas para o caminho de lotes. Não é uma senha nem a allowlist de acesso ao produto.   | `src/lib/environment.ts` seleciona a coorte. Remover um UUID muda o caminho de sincronização daquela conta; não remove seu convite em `account_access`.           |
| `NEXT_PUBLIC_TICK_TELEMETRY_DSN`          | Endereço de ingestão obtido no projeto Sentry para enviar os eventos permitidos pelo aplicativo. Não é um token administrativo do Sentry.     | `src/lib/telemetry/browser.ts` configura o envio de telemetria. Sem DSN, o envio fica desabilitado; organização local e sincronização não dependem dele.          |
| `NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT`  | Rótulo de ambiente dos eventos Sentry; Production usa `production`.                                                                           | Permite aos filtros e alertas reconhecerem o ambiente. Alterá-lo muda a classificação dos eventos e pode fazê-los deixar de corresponder aos filtros de produção. |

Alterações nessas variáveis exigem novo build/deploy para chegar ao aplicativo.
Elas não devem receber `VERCEL_TOKEN`, senha do banco ou chave de backup.

### Custódia e rotação

No cofre do proprietário, manter uma entrada por credencial com nome, provedor,
finalidade, escopo, local de cadastro e consumidor. Para os tokens criados
manualmente pelo proprietário, registrar `expiração: sem expiração automática`.
Ao criar ou remover uma integração, atualizar este inventário e as referências
nos runbooks. Não salvar os valores em Markdown, issues, screenshots ou no chat.
Para aposentar uma credencial, identificar os consumidores ativos e revogar
no provedor de origem; apagar somente a cópia do GitHub não revoga o acesso.

A variável de habilitação do backup é de repositório: o `if` do job é avaliado
antes de resolver o environment. Se estiver apenas no environment, o job pode
ser ignorado sem gerar artefato.

Cadastrar/rotacionar valores pelas interfaces dos provedores, sem imprimir os
secrets. Na URL de banco, usar senha percent-encoded e Session pooler na porta
5432; a porta 6543 de Transaction pooler não atende ao dump. Ao rotacionar a
senha, atualizar `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL` e o cofre. Não
cadastrar senha de banco na Vercel nem nos arquivos locais de ambiente.

A chave de cifra é independente da senha do banco, exige ao menos 32 caracteres
e fica também no cofre do proprietário. Somente o proprietário acessa a chave.
Retenção do artefato: 14 dias; RPO operacional aceito: 26 horas; RTO do restore
isolado: 30 minutos. O backup não inclui binários do Supabase Storage; o produto
não depende de arquivos de usuário nesse serviço.

Conferir metadados e execuções sem expor valores:

```sh
make backup-key-status
make production-release-status
make actions-status
make actions-run run=<run-id>
make backup-status
make backup-artifacts run=<run-id>
make operations-issues
```

A publicação e sua verificação estão no
[guia de deploy](PUBLICACAO.md). Dump, cifra, recuperação e rollback
estão em [telemetria e backup](MONITORAMENTO-E-RECUPERACAO.md). O ensaio em
segunda máquina tem [roteiro próprio](TESTE-DE-RESTAURACAO.md).

## Sentry

O projeto de produção usa Browser JavaScript e somente Error monitoring.
Integrações automáticas, replay, tracing e logs estão desabilitados. A Vercel
recebe `NEXT_PUBLIC_TICK_TELEMETRY_DSN` e
`NEXT_PUBLIC_TICK_TELEMETRY_ENVIRONMENT=production` somente em Production.
A release usa o SHA do deploy, com override opcional por `NEXT_PUBLIC_TICK_RELEASE`.

Manter armazenamento de IP desabilitado em projeto e organização e restringir
acesso ao proprietário/responsáveis. O fornecedor acrescenta `user.geo` na
ingestão; a allowlist do aplicativo não remove esse enriquecimento posterior.

Alertas operacionais usam ambiente `production`, evento/atividade capturada e
um filtro único `telemetry_signal` com o valor do sinal:

| Sinal               | Throttle                       |
| ------------------- | ------------------------------ |
| `api_unavailable`   | Uma hora                       |
| `old_operation`     | Uma hora                       |
| `queue_accumulated` | Uma hora                       |
| `sync_failure`      | Uma hora                       |
| `synthetic_failure` | Sem throttle durante validação |

Não alertar `healthy`. Usar evento/atividade, não somente criação de issue:
sinais compartilham fingerprint e precisam alertar também em recorrência.
Manter avisos de uso do plano pelo fornecedor. A interface do Sentry organiza
essas regras em Monitors; conferir o período global ao procurar um evento.

Para testar o canal, habilitar temporariamente
`NEXT_PUBLIC_TICK_TELEMETRY_SYNTHETIC_FAILURE=1`, gerar deployment autorizado,
abrir o app e conferir evento, payload e e-mail. Remover a variável, gerar novo
deploy e desativar somente a regra sintética. Não deixar geração sintética
habilitada em operação normal. O payload permitido não contém conteúdo de
entidades, identidade, tokens, URLs, cabeçalhos ou User-Agent completo.

## Verificação funcional de conta

Usar conta interna e dados sintéticos. Conferir duas sessões/dispositivos:

1. Editar tarefa, categoria, meta e etapa online.
2. Perder conexão, continuar editando e recarregar ainda offline.
3. Fechar/reabrir o aplicativo, preservando escopo e trabalho pendente.
4. Voltar online e aguardar retomada; confirmar o resultado no outro dispositivo.
5. Editar durante refresh lento, verificando que a versão mostrada corresponde
   ao resultado confirmado e não apenas ao indicador de sincronização.
6. Exercitar conflito da mesma entidade, retry e isolamento entre contas.
7. Conferir guest independente, sem chamadas remotas de entidades.

O teste de conta deve registrar o caminho remoto usado: coorte durável ou
legado. Guest funcionando offline não aprova o cenário autenticado.

## Verificação em aparelhos físicos

Para alterações de composição de toque, teclado virtual, safe area ou arrasto,
validar Android/Chrome e iPhone/Safari reais. Registrar modelo, versões,
orientação, rede e browser/PWA. Usar dados sintéticos.

- Criar e editar tarefas, subtarefas, metas e etapas com texto longo.
- Testar campos no fim da tela com teclado aberto, scroll e foco preservado.
- Arrastar com o dedo para reordenar e criar hierarquia; conferir disputa com scroll.
- Abrir dia por toque, mudar semana/mês e reabrir o dia selecionado.
- Testar toque longo em checkbox e texto truncado, menus e folhas inferiores.
- Conferir retrato/paisagem, safe area e zoom sem corte de ações.
- Na conta, testar offline, fechamento completo, reconexão e atualização da PWA.
- Conferir que o desenho desktop com ponteiro fino permanece igual.

Aprovar interações, não somente screenshots. Resultados pertencem à entrega da
validação, sem histórico de aparelhos ou execuções neste documento.

## Acompanhamento operacional

Observar latência, erros, fila, banco, disco/WAL, conexões, transferência e uso
de Actions nos painéis. Cerca de 20 segundos de sync é referência para
investigar, não timeout para descartar trabalho. Preservar fila e dados locais
mesmo durante uma indisponibilidade prolongada.

Falhas dos jobs geram issues pelos workflows; execução que não acontece não
produz o mesmo alerta. Os avisos dependem do GitHub.
O workflow `Supabase migrations` aceita somente solicitação explícita por
`workflow_dispatch`, com `expected_sha` e `request_id`; `make publish` envia
os inputs depois do merge e da aprovação do App CI daquele SHA. O histórico
remoto é conferido em cada publicação; não existe auditoria horária agendada.
A instalação de dependências baixa a CLI do Supabase pelo GitHub Releases e
pode falhar antes de consultar o banco. `make install-ci` repete somente falhas
transitórias identificadas desse download, com até três tentativas e esperas de
5 e 10 segundos. Erros permanentes e esgotamento continuam reprovando o job;
migrations e deploy não são reenviados por essa recuperação. Consulte evento,
data e etapas com
`make actions-run run=<run-id>` e o log bruto com
`make actions-job-log job=<job-id>` quando `make backup-log` não retornar texto.
Falhas de publicação recebem o título `Pipeline de produção falhou` e o rótulo
`pipeline-failure`. A automação comenta na issue aberta do mesmo rótulo e não a
encerra quando uma execução posterior passa. O backup diário mantém seu
agendamento e o rótulo separado `backup-failure`.
Os novos inputs não são secrets e não exigem credenciais adicionais no
GitHub, Supabase ou Vercel. A conta local que executa `make publish` precisa
ter permissão de disparo de Actions, além das permissões de PR e conteúdo.
Durante instabilidade conhecida, avaliar adiamento de publicações com migration.
Não limpar IndexedDB nem enfraquecer acesso para contornar falha de infraestrutura.

## Consultas de configuração e estado

O domínio canônico `tickapp.com.br` redireciona para `www.tickapp.com.br`. Previews não recebem configuração do Supabase de produção. A configuração de publicação e os critérios do SHA estão no [runbook de publicação](PUBLICACAO.md); os gates pertencem ao [REVIEW](../../REVIEW.md).

```sh
make production-release-status
make production-secrets-status
make main-ruleset-status
```

O primeiro comando consulta nomes e datas dos secrets da API Vercel; o segundo lista os secrets do environment `production`; o terceiro consulta os checks obrigatórios da `main`. Eles não exibem valores. Falhas do App CI em push na `main` abrem ou comentam issue `ci-failure` atribuída ao proprietário. Os valores das credenciais permanecem nos provedores e no cofre do proprietário.
