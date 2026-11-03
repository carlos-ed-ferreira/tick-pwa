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
  fila em memória. Não há garantia universal de outbox para toda escrita da conta.

## GitHub e Vercel

O ruleset da `main` exige `Check app`, `Check database` e `Check end-to-end`.
O environment `production` guarda os secrets abaixo. O Deploy Hook aponta
para `main`; auto-deploy Git dessa branch está desligado no `vercel.json`.

| Local                           | Nome                         | Uso                          |
| ------------------------------- | ---------------------------- | ---------------------------- |
| GitHub environment `production` | `SUPABASE_PROJECT_REF`       | Projeto das migrations       |
| GitHub environment `production` | `SUPABASE_ACCESS_TOKEN`      | Acesso da CLI                |
| GitHub environment `production` | `SUPABASE_DB_PASSWORD`       | Senha crua do banco          |
| GitHub environment `production` | `VERCEL_DEPLOY_HOOK_URL`     | Disparo de deploy            |
| GitHub environment `production` | `SUPABASE_DB_URL`            | Session pooler para dump     |
| GitHub environment `production` | `TICK_BACKUP_ENCRYPTION_KEY` | Cifra do backup              |
| GitHub repository variable      | `ENABLE_PRODUCTION_BACKUP=1` | Habilitação do job de backup |

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
make deploy-hook-status
make backup-key-status
make actions-status
make actions-run run=<run-id>
make backup-status
make backup-artifacts run=<run-id>
make operations-issues
```

A publicação e sua confirmação manual estão no
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
produz o mesmo alerta. A auditoria horária e os avisos dependem do GitHub.
Durante instabilidade conhecida, avaliar adiamento de publicações com migration.
Não limpar IndexedDB nem enfraquecer acesso para contornar falha de infraestrutura.
