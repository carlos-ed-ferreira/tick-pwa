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
- espera exponencial de 1 s a 30 s entre tentativas automáticas, com retomada
  agendada por conta; reconexão e retry manual cancelam a espera;
- limite de 200 operações por conta na fila durável: a alteração continua salva
  no IndexedDB, nenhuma operação nova é registrada e a entidade aparece como
  falha recuperável pela sincronização forçada;
- rebase automático de uma rejeição `stale_revision`, que reenvia o mesmo
  `operation_id` com a revisão atual do servidor; a segunda rejeição não
  rebaseia novamente;
- métricas locais por conta de fila, idade da operação mais antiga, tentativas,
  rejeições, conflitos e latência de confirmação, sem conteúdo do usuário;
- recibos do servidor com retenção de sete dias, descartados a cada chamada da
  RPC para a própria conta;
- `lock_timeout` de 3 s e `statement_timeout` de 20 s dentro da RPC, para que
  contenção de lock falhe rápido em vez de expirar no gateway;
- lock de drenagem por conta, impedindo que duas abas disputem o mesmo
  `operation_id`;
- sincronização forçada pelo usuário: o estado local do dispositivo é enviado
  com `base_revision` rebaseada a partir do servidor e sobrescreve a revisão
  remota, sem apagar linhas que só existam no remoto.

Ainda não estão concluídos o envio das métricas para observabilidade externa, a
validação de concorrência realmente simultânea entre dois dispositivos e o
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
   qualquer estado de conflito; confirme que uma rejeição por revisão stale
   volta sozinha para salvo depois do rebase automático e não amplie a allowlist
   se uma operação ficar permanentemente falha.
8. Confirme que uma conta não listada continua funcional pelo caminho legado e
   que o modo guest não faz chamadas remotas de entidades.

## Ensaio dos comportamentos de resiliência

Execute cada cenário com a conta autorizada, um de cada vez, e registre o
resultado. Todos usam apenas o navegador e as ferramentas de desenvolvedor.

### Backoff e retomada automática

1. Abra o app autenticado e deixe as ferramentas de desenvolvedor em **Network**.
2. Ative **Offline** e faça uma alteração no calendário.
3. Observe o indicador: ele deve permanecer em `Sincronizado` por cerca de um
   segundo e só então mostrar o estado transitório, porque estados rápidos são
   suprimidos por 800 ms.
4. Continue offline por dois minutos. As tentativas devem se espaçar, não se
   repetir a cada instante.
5. Volte para **Online** sem clicar em nada.

**Aprovado quando:** o indicador volta sozinho para `Sincronizado`, sem ação
manual, e a aba **Network** não mostra rajadas de chamadas repetidas durante o
período offline.

### Limite da fila durável

Cenário opcional, porque exige gerar volume. Ele comprova que uma fila presa não
cresce sem limite.

1. Fique offline e faça mais de duzentas alterações, por exemplo marcando e
   desmarcando itens em sequência.
2. Continue alterando depois de passar do limite.

**Aprovado quando:** as alterações continuam salvas na tela mesmo depois do
limite, o indicador mostra falha recuperável e a sincronização forçada, ao
voltar online, envia o estado local e devolve o indicador para `Sincronizado`.

### Rebase de revisão stale

1. Abra a mesma conta em dois contextos, por exemplo uma janela normal e uma
   anônima, e carregue a mesma tarefa nos dois.
2. Deixe o segundo contexto offline.
3. Edite a tarefa no primeiro contexto e aguarde a confirmação.
4. Edite a mesma tarefa no segundo contexto e volte a ficar online.

**Aprovado quando:** o segundo contexto reenvia sozinho, o indicador volta para
`Sincronizado` sem intervenção e o valor final é o do segundo contexto, que foi
o último a gravar. Uma operação que permanecer falha depois disso é motivo para
não ampliar a allowlist.

### O que fazer se um cenário reprovar

Não limpe dados do site nem o IndexedDB. Use a sincronização forçada para
reconciliar, registre o estado do indicador e o código de erro exibido no
console e mantenha a conta única até a causa ser corrigida.

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
make supabase-reset
make supabase-lint
make supabase-diff-check
make supabase-test-db
```

O teste direcionado cobre upgrade Dexie, lote funcional, perda de resposta,
reload, ordem, retry, seis tipos de entidade, alterações rápidas, limite de 100
mutações, janela de backoff, limite da fila, rebase de revisão stale, métricas
sem conteúdo do usuário e isolamento do guest. O E2E autenticado executa o caminho novo com
flag e UUID e comprova a retomada automática em desktop e mobile. O E2E offline
recarrega diretamente calendário e metas pelo service worker.
