# Conflito de revisão repetido pelo PostgREST

## Reprodução e alcance

Em 2026-11-02, o benchmark HTTP em Supabase local isolado confirmou uma escrita
e deixou a segunda atualização concorrente da mesma entidade terminar em
timeout de 10 segundos. Lotes sem conflito e replay idempotente passaram.
Não houve acesso a produção nem confirmação de incidente remoto nesta revisão.

O contrato declarativo usava SQLSTATE `40001` para `stale_revision` e
`operation_in_progress`. Esses erros de negócio não se resolvem repetindo a
mesma transação. A
[documentação do Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions)
confirma que esse código pode provocar retries indefinidos no PostgREST 14 e
recomenda exceção padrão ou código HTTP explícito. O teste pgTAP direto não
exercitava esse comportamento da camada HTTP.

## Correção

O schema declarativo passa a usar `PT409` nos dois casos, preservando as
mensagens e o contrato JSON. O PostgREST responde HTTP 409 e o cliente continua
reconhecendo revisão desatualizada pela mensagem. A migration
`20261103001239_avoid_rpc_conflict_retries.sql` foi gerada por
`make supabase-migration-diff name=avoid_rpc_conflict_retries` e altera somente
a função RPC, sem modificar entidades, ownership ou dados.

pgTAP exige o novo SQLSTATE; testes do cliente preservam compatibilidade com
mensagens antigas e novas. O benchmark HTTP exige uma rejeição por conflito,
sem aceitar timeout como resultado normal. O ensaio HTTP corrigido respondeu PT409/stale_revision, sem timeout. Reset,
lint, diff declarativo e 50 testes pgTAP passaram no ambiente isolado.
A migration foi aplicada em produção pelo pipeline ordenado em 2026-11-03,
no SHA `b3ddc8f`, pela execução `41556272686`, antes do deploy do mesmo SHA.

## Operação

Observar conflitos e fila nas próximas edições simultâneas entre dispositivos. Trocar a função não encerra
automaticamente requisições antigas que já estejam presas em retry; investigar
somente se houver evidência no ambiente remoto e seguir o procedimento do
fornecedor com autorização específica. Não foram encerradas sessões de produção.
