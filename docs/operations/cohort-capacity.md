# Capacidade local da coorte de convidados

## Escopo

`make benchmark-cohort` prepara e remove um ambiente Supabase local isolado.
Não usa projeto remoto, secrets de produção ou o banco de trabalho. Copia
configuração, migrations e seed para um diretório temporário; usa project_id
exclusivo, portas 56320–56329 e os node_modules já instalados.

O target sobe banco, Auth, REST e gateway, recria o banco isolado pelas
migrations e executa lint, diff declarativo e pgTAP. Em seguida autentica o
usuário sintético do seed, prepara uma meta com 5.000 etapas em árvores de
profundidade 20 e mede o pull paginado dessas etapas. Não é o refresh completo das seis entidades. Mede lotes de uma e cem
mutações, conflito concorrente e replay idempotente pela API real local.

São quatro workers para uma conta sintética, não quatro usuários independentes
nem 20 usuários simultâneos. O proprietário definiu uso atual de uma pessoa
em três dispositivos e teto conservador de 20 convidados. Este ensaio não
comprova capacidade em produção e não é requisito para continuar a manutenção.

## Política de uso das ferramentas

O proprietário decidiu priorizar uso real e otimização simples, proporcional
ao benefício. Não existem budgets obrigatórios de latência ou capacidade nesta
etapa. Sincronização em segundo plano deve permitir edição contínua sem perder
ou sobrescrever alterações locais. Cerca de 20 segundos é uma referência para
investigar demora, não um timeout configurado ou garantia de tempo máximo.
O comparador de 10% é opcional e só falha a execução explicitamente solicitada;
não integra o CI nem bloqueia publicação. Quotas são acompanhadas manualmente.

## Execução e parâmetros

```sh
make benchmark-cohort
```

Docker e dependências instaladas são necessários. O Supabase CLI mantém sua
configuração padrão de binding dos serviços locais; usar uma máquina e rede de
desenvolvimento confiáveis, sem dados reais. O benchmark envia requisições
somente para API HTTP em loopback, com porta explícita e sem credenciais na URL.
Não copia arquivos de ambiente ou metadados de vínculo com projetos remotos.

| Variável de ambiente        | Padrão                 | Faixa aceita                  |
| --------------------------- | ---------------------- | ----------------------------- |
| TICK_BENCHMARK_ITERATIONS   | 30 por tamanho de lote | 1–1.000                       |
| TICK_BENCHMARK_CONCURRENCY  | 4                      | 1–32                          |
| TICK_BENCHMARK_TIMEOUT_MS   | 10.000                 | 1–60.000                      |
| TICK_BENCHMARK_FIXTURE_ROWS | 5.000                  | 1–10.000                      |
| TICK_BENCHMARK_BASE_PORT    | 56320                  | 1024–65000, dez portas livres |

Executar sequencialmente, sem builds/E2E ou outro benchmark simultâneo. As
portas são verificadas antes do preparo. A API usa timeout cancelável; a taxa
de sucesso e os percentis não contam requisições que falharam. O Make habilita
WebSocket nativo experimental para compatibilidade do cliente Supabase com
Node 20; o ensaio utiliza HTTP, sem canal Realtime.

## Relatório e comparação

O artefato é `.next/benchmarks/cohort-latest.json`, com:

- opções, runtime, host e horário UTC;
- p50/p95/p99, erros, timeouts e throughput de requisições bem-sucedidas;
- linhas, páginas, bytes serializados e duração do primeiro pull;
- uma confirmação e uma rejeição por revisão desatualizada no conflito;
- replay idempotente e verificação de cardinalidade do pull;
- snapshots de CPU, memória, I/O e contadores do Postgres antes/depois;
- confirmação da limpeza após `supabase-stop --no-backup`.

Os snapshots não medem pico ou CPU sustentada e os bytes representam JSON de
dados, não tráfego faturado. Contadores de banco incluem trabalho do ambiente
local e não são estimativa de custo dos provedores. O benchmark não mede render
no browser, consumo IndexedDB, banda móvel nem convergência da outbox; os fluxos
de interação/offline são exercitados nos E2E separados.

O comando falha com requisições malsucedidas, pull incompleto, conflito
inesperado ou replay não idempotente. Remove os dados sintéticos do ensaio e
encerra o projeto isolado, inclusive em falha. Se a limpeza falhar, retorna erro
e informa o diretório retido para intervenção; não tenta parar outro projeto.
Uma interrupção forçada do processo pode exigir essa mesma limpeza manual.

Para comparar um relatório completo anterior, no mesmo host/runtime e com
workload equivalente:

```sh
TICK_BENCHMARK_BASELINE=docs/operations/baselines/cohort-local.json make benchmark-compare
```

O comando rejeita opções ou cardinalidades diferentes e falha se p95 por lote
ou duração do primeiro pull piorarem mais de 10%. Só aceita relatórios com
checagens de correção e limpeza concluídas. O primeiro pull desta amostra tem
uma medição, não um p95 entre sessões. Não atualizar baseline para esconder
regressão; reproduzir em ambiente comparável e justificar a mudança.

`make test-capacity` cobre estatísticas, limites, URL remota disfarçada,
contabilização de falhas e o limiar de comparação. `make test-access-policy`
cobre guest, allowlist e isolamento. Os relatórios em `.next` podem ser
removidos por builds; preservar a amostra aprovada antes de reconstruir o app.

## Acompanhamento pelo proprietário

Observar uso nos três dispositivos e acompanhar manualmente os painéis. Relatar
lentidão ou falhas concretas para investigação. Não há aprovação adicional de
budgets, modelo de carga, monitoramento automático ou ambiente novo pendente.
O ensaio sintético permanece disponível para uso voluntário, sem acesso a
produção e sem necessidade de credenciais reais.

## Primeira amostra em 2026-11-02

O [baseline preservado](baselines/cohort-local.json) foi medido às
00:14:54Z de 2026-11-03, 21:14:54 de 2026-11-02 em São Paulo, em Node 20.20.2,
Linux x64 com 12 CPUs lógicas. Foram 30 sucessos e zero erros/timeouts por
lote; p95 de 54,68 ms para uma mutação e 19,14 ms para cem. O primeiro pull
leu 5.000 linhas em 10 páginas, 3.140.610 bytes, em 1.139,80 ms.

Uma das duas atualizações concorrentes foi confirmada e a outra respondeu
PT409/stale_revision. Replay idempotente passou. Os snapshots de memória do
Postgres foram 84,79 MiB e 109,4 MiB antes/depois, sem deadlocks registrados.
Reset, lint, diff, 50 testes pgTAP e limpeza do projeto temporário passaram.
Essa é a primeira referência: não há comparação entre versões do app nem
aprovação de budgets reais. O compare com a própria amostra valida o comando;
os testes unitários exercitam a detecção de regressão maior que 10%.

## Build e limpeza

`make bundle-report` mede o build padrão já existente, sem reconstruí-lo. O
[baseline de assets](baselines/bundle-local.json) registra 34 arquivos JS,
incluindo chunks e service worker: 2.145.045 bytes brutos e 646.913 bytes gzip.
São todos os assets JS produzidos, inclusive chunks lazy; não é payload da
primeira rota, tamanho instalado ou medição de abertura em rede móvel.

`make cohort-status` lista containers e volumes com o prefixo do benchmark;
após este ensaio ambas as listas estavam vazias. Se uma execução informar um
diretório temporário retido por falha de limpeza, usar naquele diretório
`make supabase-stop args=--no-backup`, conferindo o project_id antes. Não executar
o comando de limpeza no checkout de trabalho para remover um ensaio isolado.
