# Account batch stale revision error surge

## Resumo

Em 31 de agosto de 2026, durante o rollout restrito da outbox autenticada, o
painel do Supabase registrou aproximadamente 203 mil execuções PostgreSQL com
taxa de sucesso próxima de 0,1% em uma hora. A consulta predominante era o
wrapper PostgREST da RPC `apply_account_operation_batch`. O erro confirmado foi
`stale_revision`.

O evento é separado do incidente anterior de retenção de WAL. Neste caso, o
banco estava saudável em CPU e conexões, mas recebia lotes cuja
`base_revision` já não correspondia à revisão canônica.

## Contenção

- manter `NEXT_PUBLIC_TICK_ENABLE_ACCOUNT_BATCHES` desativada em Production;
- redeployar para que a variável pública seja incorporada ao build;
- não limpar IndexedDB nem a outbox do navegador;
- acompanhar a queda da taxa de chamadas e erros no Supabase;
- não reativar a coorte até publicar e validar a correção.

## Correção no código

A retomada por montagem ou reconexão foi separada da drenagem iniciada por uma
nova gravação. Uma operação terminal com `stale_revision` não é reaberta pela
retomada automática. Falhas interrompidas ainda podem ser retomadas, e o limite
de cinco tentativas agora também se aplica a operações pendentes, não apenas às
marcadas como falha.

O teste de regressão prova que:

1. a operação stale tenta o envio original e um único rebase;
2. permanece recuperável após a segunda rejeição;
3. a retomada automática não produz uma terceira RPC;
4. o retry explícito continua disponível ao usuário.

## Limites da conclusão

O código anterior explica tentativas adicionais durante ciclo de vida e
reconexão, mas sozinho não prova toda a contagem agregada apresentada no painel.
É necessário confirmar após o deploy que a frequência caiu e verificar se
havia várias sessões, operações ou clientes antigos ativos. A causa raiz só
deve ser encerrada depois dessa comparação.

## Critérios para reativação

- testes da outbox, gate completo e E2E autenticado aprovados;
- nova release implantada com a flag ainda desligada;
- erro sintético de telemetria visível sem conteúdo do usuário;
- reativação para um único UUID interno;
- edição concorrente em duas sessões produz no máximo o envio, o rebase e uma
  falha recuperável;
- nenhuma subida contínua de `stale_revision` após fechar as sessões de teste.
