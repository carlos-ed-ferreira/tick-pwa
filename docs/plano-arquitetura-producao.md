# Plano de arquitetura e evolução para produção

## Objetivo

Este documento transforma a avaliação técnica do Tick em um plano de
implementação para atender inicialmente cerca de **1.000 usuários ativos por
dia**, mantendo o produto simples de operar e preparado para crescer.

A direção arquitetural é independente do código atual: refatorações grandes e
trocas de tecnologia são aceitáveis quando reduzirem risco, custo operacional
ou complexidade no longo prazo.

## Decisão de planos nesta fase

Nesta fase, o Tick **não contratará Vercel Pro nem Supabase Pro**. As primeiras
etapas devem ser desenvolvidas e validadas com os planos gratuitos e com o
Supabase local.

Também não é necessário contratar PowerSync Pro para iniciar. O plano gratuito
do PowerSync será usado somente para prova de conceito, desenvolvimento e
validação controlada. O uso público da sincronização dependerá da contratação
do plano adequado ou de uma nova avaliação antes do lançamento.

Consequências dessa decisão:

- o ambiente atual na Vercel permanece no plano gratuito enquanto for de uso
  privado, pessoal ou não comercial;
- a Vercel Hobby não deve ser considerada a hospedagem de um produto comercial;
- o Supabase Free pode pausar projetos inativos e não oferece as mesmas
  garantias operacionais, backups e recursos do Pro;
- os limites gratuitos são adequados para desenvolvimento, testes e uma fase
  alfa controlada, mas não são a meta final de produção;
- nenhuma implementação desta fase pode depender de um recurso exclusivo dos
  planos pagos;
- preços, quotas e termos devem ser conferidos novamente antes de qualquer
  contratação ou lançamento público.

## Estado da configuração externa

Configuração concluída manualmente em 11 de agosto de 2026 para a alfa
controlada:

- [x] autenticação em dois fatores no GitHub, Vercel, Supabase e Google Cloud;
- [x] proteção da `main`, pull requests, required checks e environment
      `production` no GitHub;
- [x] projeto Vercel vinculado, `main` como branch de produção, variáveis
      separadas por ambiente e previews protegidos sem acesso ao Supabase de
      produção;
- [x] domínio canônico de produção definido como
      [https://tickapp.com.br](https://tickapp.com.br);
- [x] Site URL, redirects, Google OAuth, allowlist, RLS e SSL configurados no
      Supabase;
- [x] procedimento manual de backup e restauração preparado e validado.

Os secrets `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` e
`SUPABASE_DB_PASSWORD` não devem ser habilitados no environment GitHub
`production` até o novo workflow de `CICD-01` ser mesclado e validado no
GitHub. O código já exige o quality gate do mesmo SHA, mas a proteção só pode
ser considerada operacional depois desse ensaio externo.

Continuam fora desta fase Vercel Pro, Supabase Pro, PowerSync Pro, SMTP próprio,
CAPTCHA para cadastro público, pagamentos, observabilidade de produção e a
migração para Cloudflare.

## Arquitetura-alvo

```text
PWA React + TypeScript
        |
        +-- modo convidado --> banco local, sem rede e sem migração automática
        |
        +-- modo autenticado --> banco local sincronizável
                                  |
                                  +-- PowerSync
                                  |     |
                                  |     +-- leitura incremental
                                  |     +-- fila local durável
                                  |
                                  +-- API de escrita em lote
                                        |
                                        +-- Supabase Auth
                                        +-- Postgres

Frontend estático --> Cloudflare Pages/Workers ou equivalente
Observabilidade --> erros, métricas de sync e alertas
```

### Stack recomendada

- frontend: React, TypeScript, Vite e Tailwind CSS;
- PWA: service worker e assets estáticos, sem servidor Node permanente;
- hospedagem: Cloudflare na migração final do frontend;
- autenticação e banco canônico: Supabase Auth e PostgreSQL;
- sincronização autenticada: PowerSync;
- persistência local autenticada: SQLite web usado pelo PowerSync;
- persistência do convidado: banco exclusivamente local, sem conexão com a
  conta;
- escrita remota: Supabase Edge Function ou função PostgreSQL transacional com
  operações em lote;
- monitoramento: captura de erros e métricas funcionais de sincronização.

O PostgreSQL continua sendo a fonte canônica das contas. Redis, Kubernetes,
microsserviços e CRDTs não são necessários para 1.000 usuários ativos por dia.

## Princípios obrigatórios

1. O modo convidado e o modo autenticado permanecem isolados.
2. Dados de convidado nunca são enviados ao servidor.
3. Não haverá migração automática de dados de convidado para uma conta.
4. Toda alteração comportamental começa por testes.
5. Uma resposta parcial do servidor nunca pode ser tratada como snapshot
   completo.
6. Repetir uma operação remota não pode duplicar o efeito da operação.
7. A interface deve continuar responsiva e utilizável sem rede.
8. O navegador não deve coordenar operações de domínio complexas por meio de
   várias gravações remotas independentes.
9. Mudanças de banco e aplicação devem permitir rollout compatível e reversão.

## Fase 0 — proteger a implementação atual

Esta fase é prioritária e não depende de serviços pagos. Ela evita perda de
dados enquanto a arquitetura-alvo é construída.

### 0.1 Corrigir a leitura de snapshots

**Concluído em 11 de agosto de 2026.** As tabelas funcionais usam páginas de
1.000 linhas ordenadas por revisão e identificador. A reconciliação ocorre em
uma única transação somente após todas as páginas terminarem, e o refresh
retorna métricas estruturadas de duração, páginas e linhas.

Hoje, o carregamento remoto consulta tabelas inteiras sem paginação e depois
remove do cache registros que não apareceram na resposta. Como a API possui
limite de linhas por resposta, uma conta com muitos registros pode receber um
snapshot truncado e perder dados no cache local.

Entregue:

- paginação determinística de todas as tabelas sincronizadas;
- ordem estável usando revisão do servidor e identificador;
- conclusão de todas as páginas antes de reconciliar exclusões;
- cancelamento da reconciliação destrutiva se qualquer página falhar;
- contagem e registro da quantidade de páginas e linhas recebidas;
- teste de regressão com mais de 1.000 registros por entidade;
- teste em que a última página falha e nenhum registro local é removido.

Arquivos inicialmente envolvidos:

- `src/lib/supabase/account-cache.ts`;
- `supabase/config.toml`;
- testes de integração da persistência autenticada.

### 0.2 Reduzir atualizações e requisições redundantes

**Concluído em 11 de agosto de 2026.** A atualização inicial é reaproveitada
por chamadas concorrentes, não é repetida pelo efeito de sessão e os eventos de
foco/reconexão usam debounce de 500 ms e validade de 60 segundos. A atualização
manual continua imediata.

Entregue:

- uma única atualização inicial por sessão autenticada;
- deduplicação de atualizações concorrentes;
- debounce para eventos de foco e retorno da rede;
- atualização apenas quando os dados estiverem expirados;
- medição de duração, número de linhas e motivo de cada atualização.

O objetivo é eliminar downloads completos repetidos e preparar uma linha de
base para comparar a sincronização incremental.

### 0.3 Tornar falhas de sincronização visíveis

**Concluído em 11 de agosto de 2026 para a fila transitória atual.** O cabeçalho
da conta autenticada observa as seis tabelas funcionais no Dexie e mostra
estados claros:

- salvo localmente;
- aguardando envio;
- sincronizando;
- falha ao sincronizar;
- ação para tentar novamente.

Antes de uma requisição remota, a entidade passa a `syncing`; falhas que não
podem ser restauradas passam a `failed`. A ação manual reenvia somente versões
falhas ainda atuais, preserva o mesmo identificador e nunca atravessa o escopo
da conta. Estados e ações foram adicionados em pt-BR e inglês com anúncio
acessível.

Esta entrega torna a falha visível e recuperável na aba atual, mas não muda a
decisão da seção 0.4: a fila continua em memória, sem backoff, idempotency key
formal ou replay garantido depois de fechar/recarregar. Não é uma substituição
para a prova de conceito do PowerSync.

### 0.4 Decidir o tratamento transitório da fila

A fila atual existe apenas em memória e é perdida ao recarregar ou fechar a
aba. Não será criada uma sincronização proprietária completa se o PowerSync for
aprovado na prova de conceito.

Até a migração:

- contas públicas não devem depender da fila volátil;
- se o modo autenticado precisar ser liberado antes do PowerSync, a fila deve
  ser persistida no banco local com identificador idempotente, tentativas e
  estado;
- se o acesso continuar restrito à alfa privada, é preferível limitar o uso e
  concentrar o esforço na prova de conceito.

## Fase 1 — prova de conceito do PowerSync no plano gratuito

Esta fase valida a decisão técnica antes de alterar toda a persistência.

Em 11 de agosto de 2026, a configuração externa e a superfície isolada ficaram
prontas e permanecem desligadas: SDK, SQLite por conta, JWT Supabase, conector,
schema das entidades da prova, Sync Streams, operações locais da hierarquia e
visibilidade da fila. Ainda faltam a ativação controlada, os ensaios dos
critérios abaixo e, se a prova for aprovada, a migração das telas reais. O passo
a passo está em [powersync-poc.md](powersync-poc.md).

### Escopo da prova

- autenticar com o JWT do Supabase;
- sincronizar uma entidade simples e uma hierarquia completa;
- filtrar todos os dados por usuário no servidor;
- criar, editar, reordenar e excluir offline;
- fechar e reabrir o navegador preservando operações pendentes;
- sincronizar dois dispositivos da mesma conta;
- confirmar que uma conta nunca recebe dados de outra;
- manter o modo convidado totalmente desconectado;
- validar navegadores móveis suportados e o fallback de armazenamento.

### Critérios para aprovação

- nenhuma operação pendente é perdida em reload, fechamento da aba ou queda de
  rede;
- o estado converge após reconexão;
- conflitos têm comportamento determinístico e documentado;
- o volume transferido é incremental e mensurável;
- o desempenho de abertura e edição é adequado em celular;
- os testes usam Supabase local real para os contratos principais;
- a solução não exige recurso pago para continuar o desenvolvimento.

Se a prova falhar, registrar os motivos e comparar novamente PowerSync,
Replicache e uma sincronização própria antes de prosseguir. Não iniciar uma
reescrita proprietária apenas para contornar uma limitação isolada.

## Fase 2 — criar a API transacional de escrita

Após a prova de conceito, as gravações do modo autenticado passam por uma API
de domínio. Ela pode ser implementada como Supabase Edge Function ou como RPC
PostgreSQL, conforme o contrato de sincronização escolhido.

Cada lote deve conter:

- `operation_id` único e persistente;
- usuário autenticado derivado do JWT;
- entidade e intenção da operação;
- versão base conhecida pelo cliente;
- conteúdo validado;
- data local apenas quando fizer parte do domínio, nunca como relógio canônico.

O servidor deve:

- validar propriedade de todas as entidades;
- rejeitar referências a dados de outro usuário;
- aplicar o lote em uma transação;
- detectar repetição por `operation_id` e retornar o resultado anterior;
- atribuir revisão e horário canônicos;
- aplicar regras de conflito explicitamente;
- atualizar agregados e hierarquias atomicamente;
- retornar erros estruturados e recuperáveis.

Operações em massa, como concluir, mover ou excluir uma árvore, devem produzir
um lote lógico. O frontend não deve enviar dezenas de requisições sequenciais
para representar uma única ação do usuário.

## Fase 3 — migrar o modo autenticado

A migração substitui o cache Dexie da conta pelo banco local sincronizável. O
Dexie pode continuar atendendo o modo convidado durante essa etapa.

### Estratégia de rollout

1. Adicionar alterações compatíveis ao banco remoto.
2. Publicar a nova persistência atrás de feature flag.
3. Ativar primeiro para contas internas.
4. Abrir uma base local nova para a conta e fazer o primeiro pull do servidor.
5. Não copiar dados do escopo `guest:*`.
6. Comparar contagens e invariantes entre servidor e banco local.
7. Ampliar gradualmente para a alfa controlada.
8. Remover a persistência autenticada antiga somente após o período de
   estabilidade e uma versão de rollback.

Dual write prolongado deve ser evitado. Ele aumenta o risco de divergência e
torna a reversão difícil. Durante o rollout, o servidor continua canônico e uma
desativação da feature flag deve permitir reconstruir o banco local.

## Fase 4 — migrar o frontend para hospedagem estática

Depois que a nova sincronização estiver estável:

- substituir dependências de execução do Next.js por uma aplicação Vite
  estática;
- manter React, TypeScript e Tailwind;
- mover idioma e preferências que hoje dependam do servidor para uma estratégia
  compatível com renderização estática;
- publicar a PWA na Cloudflare;
- preservar manifest, cache de assets, atualização segura do service worker e
  rotas instaláveis;
- separar páginas públicas que realmente precisem de SEO, se elas surgirem.

Essa migração remove a necessidade de Vercel Pro para o app principal. Se o
produto comercial for lançado antes dela e continuar hospedado na Vercel, os
termos do plano vigente deverão ser revistos e o Pro poderá se tornar
obrigatório.

## Fase 5 — preparação para lançamento público

Antes de considerar o ambiente pronto para usuários reais:

- cadastro, confirmação de e-mail e recuperação de senha;
- exportação e exclusão de conta;
- política de privacidade e retenção de dados;
- backup externo automatizado e teste de restauração;
- monitoramento de erros e alertas de sincronização;
- painel de consumo do banco, armazenamento e transferência;
- rate limiting e proteção contra abuso;
- teste de carga e de concorrência;
- procedimento de incidente e rollback;
- teste E2E nos modos convidado, autenticado, offline e multidispositivo.

O allowlist atual pode continuar durante desenvolvimento e alfa privada, mas
não é um fluxo de autenticação de produto público.

## Testes obrigatórios

Além dos testes existentes, a evolução deve cobrir:

- snapshot com mais de 1.000 linhas sem truncamento;
- falha em uma página sem exclusão local;
- nenhuma chamada remota no modo convidado;
- isolamento entre dois usuários;
- fila persistida após reload e reinício do navegador;
- repetição da mesma operação sem duplicar efeitos;
- lote aplicado por inteiro ou não aplicado;
- conflito simultâneo em dois dispositivos;
- exclusão, restauração e reordenação de hierarquias;
- troca entre convidado e conta sem mistura de dados;
- primeiro acesso autenticado sem rede;
- atualização do service worker sem perda da base local;
- conta madura com milhares de itens;
- carga compatível com 1.000 usuários ativos por dia e picos realistas.

Cada fase deve manter `make check` aprovado. Os fluxos críticos também devem
passar nos testes E2E e nos testes de banco do Supabase local.

## Métricas operacionais

Registrar, sem incluir conteúdo privado do usuário:

- duração e resultado do primeiro pull;
- linhas e bytes baixados por sincronização;
- tamanho da fila e idade da operação mais antiga;
- quantidade de tentativas e falhas definitivas;
- tempo entre edição local e confirmação remota;
- conflitos por tipo de entidade;
- lotes processados e rejeitados;
- tamanho do banco e consumo de transferência;
- erros por versão do frontend e navegador.

Alertas iniciais devem cobrir fila acumulada, aumento de erros, falhas de API e
consumo próximo das quotas contratadas.

## Custos e gatilhos de contratação

Valores abaixo são referências de planejamento e não autorização de compra.
Devem ser validados nos sites dos fornecedores antes da contratação.

| Componente     |                  Nesta fase |                               Futuro esperado | Gatilho                                                            |
| -------------- | --------------------------: | --------------------------------------------: | ------------------------------------------------------------------ |
| Vercel         |  Hobby, sem custo adicional | Sem Pro se a migração para Cloudflare ocorrer | Pro apenas se o produto comercial permanecer na Vercel             |
| Supabase       |   Free, sem custo adicional |  Aproximadamente US$ 30/mês com compute Small | Antes do lançamento público ou ao atingir 70% de uma quota crítica |
| PowerSync      | Free para prova de conceito |             Aproximadamente US$ 49/mês no Pro | Antes de liberar sync público ou exceder limites da prova          |
| Cloudflare     | Free na implantação inicial |            Conforme tráfego e produtos usados | Quando a aplicação estática estiver pronta para sair da Vercel     |
| Backup externo | Processo de desenvolvimento |      Armazenamento e automação de baixo custo | Antes de aceitar dados de usuários públicos                        |
| PITR           |         Não contratar agora |                   Custo adicional no Supabase | Quando o RPO do produto exigir recuperação ponto a ponto           |

O cenário-base pago estimado para a arquitetura recomendada é de cerca de
**US$ 79 por mês**, somando Supabase com compute Small e PowerSync Pro, sem
Vercel Pro. Esse valor não será assumido nesta fase.

### Gatilhos objetivos

Contratar Supabase Pro quando ocorrer o primeiro destes eventos:

- preparação do lançamento público/comercial;
- necessidade de evitar pausa por inatividade;
- necessidade de garantias e backups incompatíveis com o Free;
- consumo sustentado acima de 70% de banco, transferência, armazenamento ou
  outra quota crítica;
- exigência operacional ou contratual não atendida pelo Free.

Contratar PowerSync Pro quando ocorrer o primeiro destes eventos:

- sincronização autenticada for liberada para usuários externos;
- limites de armazenamento, transferência ou conexões do plano de avaliação
  deixarem de atender a alfa;
- for necessário eliminar suspensão por inatividade ou obter suporte e
  garantias de produção.

Vercel Pro não faz parte da arquitetura-alvo. Ele só será avaliado se a
migração estática não estiver concluída quando o uso comercial começar.

## Ordem de implementação

- [x] Paginar snapshots e impedir reconciliação destrutiva parcial.
- [x] Remover atualizações completas duplicadas e instrumentar o fluxo atual.
- [x] Exibir estado e falhas de sincronização.
- [ ] Executar a prova de conceito do PowerSync no plano gratuito.
- [ ] Registrar a decisão técnica da prova de conceito.
- [ ] Implementar operações idempotentes e transacionais em lote.
- [ ] Migrar gradualmente a persistência do modo autenticado.
- [ ] Validar offline, concorrência, isolamento e restauração.
- [ ] Migrar a PWA para frontend estático na Cloudflare.
- [ ] Implementar os requisitos de lançamento público.
- [ ] Reavaliar quotas e contratar os planos necessários somente no marco de
      lançamento.

## Definição de pronto

A arquitetura estará pronta para produção quando:

- nenhuma limitação conhecida puder apagar ou ocultar dados locais;
- operações offline sobreviverem ao fechamento do navegador;
- retries forem idempotentes e lotes forem atômicos;
- dois dispositivos convergirem de forma previsível;
- convidado e conta permanecerem rigorosamente isolados;
- backup e restauração tiverem sido testados;
- métricas e alertas permitirem diagnosticar falhas;
- os testes de carga sustentarem o pico definido para 1.000 usuários diários;
- os termos e quotas dos planos contratados forem compatíveis com o lançamento;
- houver procedimento documentado de deploy, migração e rollback.
