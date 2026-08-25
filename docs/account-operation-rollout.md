# Rollout da persistência funcional em lote

## Objetivo e estado

O modo autenticado possui um caminho funcional novo, desligado por padrão, que
grava a alteração local e uma operação remota na mesma transação Dexie. A fila
durável usa um UUID estável como `operation_id`, sobrevive a reload, retoma
operações interrompidas e envia lotes de até 100 mutações para
`apply_account_operation_batch`.

O rollout inclui categorias, resumos diários, tarefas, grupos de metas, metas e
etapas. Uma ação composta gera um lote lógico quando suas mutações acontecem na
mesma transação local. Não há escrita simultânea pelo caminho antigo e pelo
novo.

Esta etapa usa os planos gratuitos atuais. Não requer Vercel Pro, Supabase Pro
nem PowerSync Pro. A outbox funcional também não depende da ativação do POC
PowerSync.

## Garantias já cobertas

- confirmação local independente da rede;
- registro atômico entre entidade e outbox no IndexedDB;
- isolamento por `user:<supabaseUserId>` e ausência de outbox para guest;
- replay com o mesmo `operation_id` após resposta perdida ou reload;
- retry automático das operações falhas quando o navegador retorna ao estado
  online;
- ordenação por conta, bloqueando operações mais novas quando uma anterior
  falha;
- agrupamento, limite de 100 mutações por RPC e divisão ordenada de lotes
  maiores;
- compare-and-set por revisão e rebase da próxima alteração local após sucesso;
- estado pendente, sincronizando e falho visível pelo resumo existente.

- limite de cinco tentativas automáticas por operação, para que uma falha
  determinística não vire tempestade de requisições;
- `lock_timeout` de 3 s e `statement_timeout` de 20 s dentro da RPC, para que
  contenção de lock falhe rápido em vez de expirar no gateway;
- lock de drenagem por conta, impedindo que duas abas disputem o mesmo
  `operation_id`;
- sincronização forçada pelo usuário: o estado local do dispositivo é enviado
  com `base_revision` rebaseada a partir do servidor e sobrescreve a revisão
  remota, sem apagar linhas que só existam no remoto.

Ainda não estão concluídos backoff temporal, resolução automática de conflito
stale entre dispositivos, retenção dos recibos no servidor, métricas externas e
rollout amplo. Por isso a liberação continua limitada a uma conta interna.

## Variáveis de ambiente

Cadastre na Vercel somente depois que a versão contendo esta implementação
estiver em produção:

```text
NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES=1
NEXT_PUBLIC_TICK_ACCOUNT_BATCH_USER_IDS=<uuid-da-conta-interna>
```

O UUID é o identificador do usuário autenticado no Supabase, o mesmo valor de
`auth.users.id` e `profiles.id`. Use inicialmente uma única conta interna. As
variáveis são públicas por natureza e não devem conter token, senha ou segredo.

Como variáveis `NEXT_PUBLIC_*` são incorporadas ao build, salvar a configuração
exige um novo deploy. Não altere as flags do PowerSync para este rollout.

## Sequência externa de ativação

1. Publique o código com as duas variáveis ainda ausentes ou vazias.
2. Confirme `Check app` e o deploy de produção em
   [https://tickapp.com.br](https://tickapp.com.br).
3. Cadastre as duas variáveis no ambiente **Production** da Vercel para uma
   única conta interna.
4. Gere um novo deploy de produção para incorporar as variáveis.
5. Entre com a conta autorizada e altere calendário, categorias e metas.
6. Faça uma alteração offline, recarregue a página ainda offline, reconecte e
   confirme que o estado volta a salvo automaticamente, sem repetir a ação nem
   clicar em sincronizar.
7. Em dois navegadores da mesma conta, teste edições sequenciais e registre
   qualquer estado de conflito; não amplie a allowlist se uma operação ficar
   permanentemente falha.
8. Confirme que uma conta não listada continua funcional pelo caminho legado e
   que o modo guest não faz chamadas remotas de entidades.

## Rollback

Remova ou esvazie `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` e faça novo deploy.
Isso interrompe novos lotes e retorna contas ao caminho legado. O rollback não
apaga a outbox local: operações já registradas ficam preservadas para análise,
evitando descarte silencioso. Não reative a flag para uma conta com fila falha
sem antes reconciliar o estado remoto e local.

Não limpe dados do site, IndexedDB ou storage como procedimento de rollback.
Essa limpeza poderia apagar operações que ainda não chegaram ao servidor.

## Validação pelo repositório

Use exclusivamente os targets do Makefile:

```bash
make test-account-persistence
make check
make test-e2e
make test-e2e-offline
make test-e2e-account
```

O teste direcionado cobre upgrade Dexie, lote funcional, perda de resposta,
reload, ordem, retry, seis tipos de entidade, alterações rápidas, limite de 100
mutações e isolamento do guest. O E2E autenticado executa o caminho novo com
flag e UUID e comprova a retomada automática em desktop e mobile. O E2E offline
recarrega diretamente calendário e metas pelo service worker.
