# Sincronização e persistência

[Arquitetura](ARQUITETURA.md) · [Modos de acesso](MODOS-DE-ACESSO.md) · [Critérios de revisão](../../REVIEW.md#local-first-da-conta-autenticada)

## Fluxo de leitura e escrita

No modo local, a UI lê do IndexedDB e os comandos confirmam as alterações em
transações Dexie. Nenhuma entidade do usuário é enviada ao Supabase.

No modo autenticado, o app baixa snapshots das tabelas da conta para um cache
Dexie. Os snapshots são paginados em blocos de 1.000 linhas, ordenados apenas
pelo identificador, que é imutável, e só reconciliam exclusões das entidades depois que todas
as páginas terminam com sucesso. Preferências são atualizadas separadamente. Refreshes simultâneos do mesmo escopo
compartilham uma única leitura remota, e o merge compara a versão local capturada antes da rede com a versão atual.
Escritas criadas, alteradas ou confirmadas durante a leitura ficam protegidas,
assim como suas dependências. Revisões remotas inferiores ou iguais não
sobrescrevem versões sincronizadas mais recentes. No rollout controlado, a alteração funcional e seu lote
remoto são gravados atomicamente no IndexedDB. A outbox preserva o mesmo
`operation_id` entre reloads, mantém a ordem, agrupa até 100 mutações e envia
uma RPC transacional; falhas continuam visíveis e podem ser reenviadas. Contas
fora da coorte de lotes permanecem no caminho legado de `upsert` direto e fila em
memória. Não existe dual-write entre os dois caminhos.

Uma operação que falha é retentada automaticamente no máximo cinco vezes, com
espera exponencial de 1 s a 30 s entre as tentativas; reconexão e retry manual
ignoram essa espera. O limite de cinco bloqueia apenas operações rejeitadas pelo
servidor. Uma operação que esgotou as tentativas por falta de rede para de
agendar novos timers, mas continua pendente e é enviada na próxima reconexão,
foco ou retomada, sem depender de sincronização manual. A fila durável é limitada a 200 operações por conta: ao
atingir o limite, a alteração continua salva localmente, deixa de gerar novas
operações remotas e aparece como falha recuperável, resolvida pela
sincronização forçada. Uma rejeição `stale_revision` é rebaseada uma vez pela
revisão atual do servidor e reenviada automaticamente; se ainda assim falhar, a
operação permanece visível e recuperável. A drenagem da outbox usa um lock por
conta, compartilhado com a sincronização forçada e o envio de preferências,
para que abas do mesmo navegador não disputem o mesmo `operation_id`. Sem
Web Locks, a serialização cobre somente a aba atual.
Quando o navegador informa que está offline, uma operação nova permanece
pendente sem iniciar RPC. Se a conexão cai durante uma chamada, a operação volta
de `syncing` para `pending` e conserva o mesmo identificador para a retomada na
reconexão. O mesmo vale quando a RPC devolve um erro de transporte antes de
`navigator.onLine` refletir a queda: a primeira operação permanece pendente, o
dreno para e uma tentativa limitada usa o backoff da outbox. Refreshes remotos
disparados por foco ou sessão também não começam enquanto o navegador está
offline; indisponibilidade esperada não é apresentada como falha definitiva de
sincronização.

Preferências de conta confirmam localmente e guardam estado de envio, número
de tentativas e prazo de retry em `localPreferences`. Reabertura e reconexão
retomam o último valor local; falha remota não restaura um valor antigo. O
acknowledgement só confirma a versão enviada. São no máximo cinco tentativas
automáticas, com backoff de 1 s a 30 s; a sincronização forçada permite nova
tentativa. O indicador inclui entidades e preferências. Essa persistência de
preferências vale também fora da coorte funcional; guest permanece somente local.

O indicador de sincronização é acionável em qualquer estado. A ação baixa o
snapshot remoto e depois envia o que este dispositivo alterou, nessa ordem. O
pull aceita o valor remoto apenas para entidades já sincronizadas localmente e
nunca sobrescreve uma alteração local ainda pendente. O push envia somente
essas alterações pendentes, com `base_revision` rebaseada a partir do servidor,
de modo que o dispositivo atual vence o conflito. Entidades já convergidas não
são reenviadas, o que impede que dois dispositivos fiquem revertendo o valor um
do outro. A ação nunca apaga linhas que existam apenas no remoto, e é a saída
para um `stale_revision` que o retry automático não resolve sozinho.

Alterações pendentes carregam junto as entidades que referenciam. O pull não
remove um pai já sincronizado enquanto um filho pendente depender dele, e o
push reenvia esse pai quando ele não existe mais no servidor, antes do filho.
Sem isso, uma exclusão física no outro dispositivo deixaria a alteração local
presa em violação de chave estrangeira.

Refreshes de uma mesma conta são deduplicados. Foco e reconexão usam debounce
de 500 ms e só atualizam dados com pelo menos 60 segundos; refresh manual ignora
essa validade. A reconciliação só escreve no IndexedDB o que realmente mudou:
linhas com a mesma revisão remota e preferências com o mesmo valor não são
regravadas, então um refresh sem novidade não dispara nenhuma consulta viva nem
re-render da interface. O indicador de sincronização também só sai de
`Sincronizado` quando a atividade passa de 800 ms; ciclos rápidos permanecem
invisíveis, enquanto falha aparece imediatamente. A duração, páginas, linhas e
motivo ficam no resultado estruturado do refresh e são enviados ao Sentry pelo
adapter de telemetria quando o DSN está configurado.

Métricas de fila, tentativas, rejeições, falhas de transporte, conflitos,
tamanho e duração dos lotes, idade da operação mais antiga e latência de
confirmação são acumuladas por conta em
`src/lib/db/account-sync-metrics.ts`, sem conteúdo do usuário. Elas não
têm identidade nem conteúdo funcional. Um adapter independente envia os
agregados e resultados de refresh ao Sentry quando o DSN é configurado. Todas
as integrações automáticas ficam desligadas e uma allowlist remove identidade,
conteúdo funcional, tokens e payloads antes do fornecedor.

O backend contém `apply_account_operation_batch` e recibos por conta e
`operation_id`. O contrato aceita até 100 mutações de categoria, dia, tarefa,
grupo de metas, meta, etapa, recorrência e resposta, deriva ownership do JWT, aplica compare-and-set
por revisão e confirma o lote inteiro em uma transação. Cada chamada também
descarta os recibos da própria conta com mais de sete dias.

A estratégia de lotes usa Dexie e Supabase, sem outra fonte canônica. As
contas fora da coorte continuam no caminho legado descrito acima. Consultas
Supabase usam `cache: no-store`; autorização e dados não dependem do cache HTTP
do navegador. Quando o navegador informa ausência de rede, a verificação de
acesso usa o contrato de grant local e a atualização do perfil remoto é adiada.

## Escopo de uso

O uso atual é uma pessoa em três dispositivos; o teto conservador de
planejamento é 20 convidados. A interface deve continuar utilizável e as
alterações locais preservadas enquanto a sincronização acontece. Cerca de 20
segundos é uma referência prática para investigar demora, não um timeout de
descarte. Não há budgets de latência ou capacidade obrigatórios; o proprietário
acompanha quotas manualmente e os benchmarks são diagnóstico opcional.
