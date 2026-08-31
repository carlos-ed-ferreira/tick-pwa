# Supabase WAL exhaustion and read-only recovery

## Resumo

Em 31 de agosto de 2026, o Postgres de produção do Tick ficou indisponível e,
após o primeiro restart, entrou em modo somente leitura por pressão de disco.
O evento ocorreu durante a retirada definitiva do POC do PowerSync. Um slot de
replicação lógica inativo permaneceu no banco depois da exclusão do projeto no
PowerSync e reteve WAL.

Não houve evidência de perda de dados. Escritas remotas ficaram indisponíveis
durante o incidente e o workflow de migrations de produção falhou. A outbox
local-first permaneceu como mecanismo de retenção local, mas o evento não foi
usado como ensaio formal de recuperação ponta a ponta.

## Impacto

- o banco recusou conexões com `57P03` e `Hot standby mode is disabled`;
- após o restart, o projeto ativou `default_transaction_read_only`;
- escritas remotas e DDL foram rejeitadas com `25006`;
- o workflow `Supabase migrations` não aplicou a migration pendente;
- a automação abriu a issue GitHub `#32` com o rótulo `migration-failure`;
- o painel marcou o projeto como `Unhealthy` e informou esgotamento de
  múltiplos recursos.

## Evidências

Durante o diagnóstico, o painel mostrou:

| Métrica  |                                   Valor observado |
| -------- | ------------------------------------------------: |
| Compute  |                                          até 100% |
| CPU      |                                           até 98% |
| Disk I/O |                                          até 100% |
| Disk     |                             96% no pico observado |
| Database |                             aproximadamente 52 MB |
| WAL      |                              aproximadamente 1 GB |
| System   | aproximadamente 776 MB após a recuperação inicial |

O slot abandonado foi identificado como:

```text
powersync_6a7b733ef16f906784415d96_2_234a
```

Ele era lógico, estava inativo, tinha `wal_status = reserved` e retinha 214 MB
no momento da consulta. A quantidade total de WAL no disco era maior que a
retenção atribuída ao slot naquele instante. O slot é tratado como o principal
fator contribuinte identificado, não como explicação exclusiva para todo o uso
reportado.

## Linha do tempo

1. O projeto de desenvolvimento foi excluído no PowerSync Dashboard.
2. O banco apresentou saturação de CPU e I/O e deixou de aceitar conexões.
3. Um restart restaurou consultas de leitura, mas o projeto entrou em modo
   somente leitura com disco em 96%.
4. A role exclusiva `powersync_role` foi removida durante a limpeza externa.
5. A inspeção de `pg_replication_slots` encontrou o slot lógico inativo.
6. O modo de escrita foi habilitado apenas para a sessão de manutenção e o slot
   foi removido com `pg_drop_replication_slot`.
7. Um `CHECKPOINT` manual não pôde ser executado porque o usuário gerenciado não
   pertence a `pg_checkpoint`.
8. Um novo restart, já sem o slot, permitiu a reciclagem progressiva do WAL.
9. `default_transaction_read_only` retornou `off` e o disco caiu de 96% para
   94% e depois 93%.
10. A migration de retirada do POC permaneceu pendente para nova execução do
    workflow de produção depois da estabilização.

## Causa e fatores contribuintes

A causa operacional mais provável foi a permanência de um replication slot do
PowerSync sem consumidor. Slots lógicos preservam WAL necessário ao consumidor
e sobrevivem a restart. Excluir o projeto no fornecedor não removeu o slot no
Postgres gerenciado.

Contribuíram para o impacto:

- pouca margem de disco e compute no Supabase Free/Nano;
- ausência de alerta preventivo específico para crescimento de WAL e lag de
  replication slots;
- limpeza do fornecedor e do banco realizada em etapas externas separadas;
- migration de produção concorrendo com um banco já degradado;
- métricas agregadas do painel demorando para refletir a recuperação.

Os avisos de índices de foreign keys e avaliação de funções nas policies RLS
são melhorias legítimas, mas não foram estabelecidos como causa deste evento.
Devem ser tratados por schema declarativo, migration e testes próprios, sem SQL
avulso no painel.

## Procedimento de recuperação

### Diagnóstico

Consultar o estado sem alterar o banco:

```sql
show default_transaction_read_only;

select
  slot_name,
  slot_type,
  active,
  active_pid,
  wal_status,
  pg_size_pretty(
    pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
  ) as retained_wal
from pg_replication_slots
order by slot_name;

select pg_size_pretty(sum(size)) as wal_size
from pg_ls_waldir();
```

Nunca remover `supabase_realtime_replication_slot`. Um slot externo só pode
ser removido depois de confirmar que o consumidor foi desativado e que o slot
está inativo.

### Remoção de slot abandonado em modo somente leitura

Executar o bloco na mesma sessão, substituindo o nome pelo slot confirmado:

```sql
set session characteristics as transaction read write;

select pg_drop_replication_slot('confirmed_inactive_external_slot');
```

`pg_drop_replication_slot` retorna `void`; uma célula vazia representa sucesso.
Confirmar a remoção consultando `pg_replication_slots` novamente.

### Restauração do serviço

1. Aguardar a reciclagem automática do WAL.
2. Se o banco permanecer bloqueado, executar um único restart gerenciado depois
   da remoção do slot.
3. Não tentar conceder `pg_checkpoint` nem alterar configurações avançadas para
   contornar o serviço gerenciado.
4. Confirmar `default_transaction_read_only = off`.
5. Acompanhar a tendência de disco, CPU e I/O; não repetir restarts enquanto os
   indicadores estiverem melhorando.
6. Se o disco voltar a 95%, o modo somente leitura retornar ou o WAL crescer
   sem slot inativo, interromper carga não essencial e acionar o suporte do
   Supabase.

### Retomada da publicação

Depois da estabilização, executar manualmente o workflow `Supabase migrations`
na branch `main`. Não criar outro commit ou repetir `make publish` apenas para
reaplicar migrations já presentes na `main`.

Confirmar a retirada do POC:

```sql
select
  to_regclass('public.powersync_poc_category_tags') as category_tags,
  to_regclass('public.powersync_poc_daily_entries') as daily_entries,
  to_regclass('public.powersync_poc_checklist_items') as checklist_items;

select pubname
from pg_publication
where pubname = 'powersync';
```

As colunas devem retornar `null` e a publicação não deve existir. A issue de
falha pode ser encerrada depois que o workflow e as verificações passarem.

## Acompanhamentos

- aplicar e confirmar `20260828180055_remove_powersync_poc.sql` em produção;
- verificar calendário, categorias, metas, offline e reconexão depois da
  migration;
- adicionar observabilidade para uso de disco, WAL e replication slot lag;
- definir alerta anterior ao limite de read-only;
- documentar a ordem de retirada de futuros consumidores de replicação;
- tratar índices de foreign keys e initplan de RLS em mudança dedicada;
- manter Vercel Hobby e Supabase Free nesta fase, sem interpretar este registro
  como autorização para contratar planos pagos.

## Ordem segura para retirar consumidores de replicação

1. interromper novas escritas ou conexões do consumidor;
2. confirmar que o slot ficou inativo;
3. remover o slot externo e verificar o WAL;
4. aplicar a migration que remove publicação e objetos isolados;
5. remover role, grants, secrets e variáveis do fornecedor;
6. excluir o projeto no fornecedor;
7. verificar recursos e executar o fluxo funcional após a limpeza.
