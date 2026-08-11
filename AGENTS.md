# AGENTS.md

## Autoridade e escopo

Este arquivo rege agentes no repositório inteiro, salvo `AGENTS.md` mais
específico. Leia primeiro o [README.md](README.md) para o estado real e o
[REVIEW.md](REVIEW.md) para gates e evidências. Consulte o
[IMPLEMENTATION.md](IMPLEMENTATION.md) para lacunas futuras; não trate um item
planejado como já implementado.

## Antes de editar

1. Entenda o pedido e não amplie o escopo.
2. Leia a arquitetura e os fluxos relevantes no README.
3. Localize a área, testes relacionados e implementações semelhantes.
4. Procure primitives, componentes, hooks, helpers e comandos existentes.
5. Identifique regras de negócio, escopos e dados afetados.
6. Consulte os gates aplicáveis no REVIEW.
7. Verifique o worktree e preserve mudanças do usuário.
8. Liste riscos de dados, segurança, offline, i18n e responsividade.
9. Prefira uma mudança pequena, reversível e coerente.

## Interface de comandos

O `Makefile` é a interface operacional única do projeto. Pessoas, agentes e
workflows devem executar `make <target>` em vez de chamar `npm`, `npx`, CLIs de
serviço ou scripts do repositório diretamente. Quando uma operação recorrente
não tiver target, adicione primeiro um target pequeno e nomeado ao `Makefile` e
documente-o no `make help`. Os comandos internos podem continuar encapsulados
pelos targets; não replique sua implementação fora do `Makefile`.

Não redesenhe áreas não relacionadas. Não crie uma arquitetura paralela para
uma feature isolada.

## Skills locais

Use a Skill correspondente em `.agents/skills` quando a tarefa envolver TDD,
persistência local-first, UI, i18n ou dependências. A Skill operacionaliza o
workflow, mas não substitui este arquivo nem os gates do REVIEW.

## Arquitetura e simplicidade

Respeite as fronteiras documentadas no README e a direção das dependências.
Regra de domínio não pertence à UI. Escritas IndexedDB passam por comandos de
`src/lib/db`; não escreva diretamente em tabelas Dexie a partir de componentes.
Acesso Supabase pertence a `src/lib/supabase` ou ao contrato de servidor
adotado pelo projeto.

Preserve linguagem de domínio, invariantes e contratos. Use DDD apenas onde a
complexidade justificar; CRUD não precisa de repositories, services, DTOs ou
factories cerimoniais.

Antes de abstrair, procure repetição real e avalie se a abstração reduz
complexidade. Prefira código explícito e design incremental. Não divida módulos
apenas para satisfazer LOC e não aumente hotspots sem avaliar uma extração
coesa.

## TDD e ordem de implementação

Para regra nova, bug ou refatoração comportamental, trabalhe em RED, GREEN e
REFACTOR:

1. escreva um teste que falhe pelo motivo correto;
2. implemente somente o necessário;
3. simplifique com a suíte verde;
4. execute os gates aplicáveis.

Bugfix deve reproduzir o bug em teste sempre que tecnicamente viável. Não
enfraqueça teste para aceitar comportamento incorreto. Use dados isolados e
nunca PII, secrets ou dados de produção.

Em feature full-stack, implemente primeiro domínio, invariantes, validação,
persistência, autorização, contrato e seus testes; depois UI, integração,
loading, vazio, erro e E2E. Tarefa puramente visual não exige backend artificial.

## Local-first e escopos

A interação principal deve confirmar localmente antes da rede. Toda mudança de
persistência deve considerar retry, idempotência, ordem, duplicação, conflito,
rollback, reconexão, fila e estado canônico. Ação do usuário não pode
desaparecer silenciosamente.

Preserve isolamento estrito:

- `guest:<installationId>` nunca envia entidades ao Supabase;
- `user:<supabaseUserId>` nunca lê nem grava dados de outro usuário;
- trocar de modo não mistura escopos;
- falha remota precisa de feedback recuperável.

O estado atual não possui fila remota durável. Não prometa garantia inexistente
e não crie sync paralelo sem decisão arquitetural.

O produto futuro terá guest limitado, trial autenticado de 7 dias e assinatura.
Trial e assinante devem usar o mesmo modelo de dados e persistência; somente o
entitlement difere. O backend deve validar entitlement. Preços provisórios
(`R$ 10,00/mês` no Brasil e `US$ 5.00/mês` fora) devem ser centralizados quando
implementados.

Não migre dados guest incidentalmente durante login. A migração futura deve ser
uma feature explícita, idempotente, testável, com ownership, retry e tratamento
de falha parcial, conforme `IMPLEMENTATION.md`.

## Banco, API e segurança

Trate `supabase/schemas/tick.sql` como fonte declarativa. Gere migrations por
diff, revise o SQL e valide banco limpo, constraints, RLS, policies e
compatibilidade de rollout. Produção só recebe migrations pelo fluxo autorizado.

Derive usuário do token no servidor; nunca confie em `user_id`, entitlement ou
preço enviados pela UI. Inclua testes negativos de autorização. Considere XSS,
CSRF, SSRF, injection, secrets, abuso, rate limit, operações destrutivas,
webhooks duplicados e ownership quando aplicável.

Não adicione dependência antes de verificar solução existente, manutenção,
compatibilidade, licença, vulnerabilidades e impacto em bundle/runtime. Nunca
use atualização destrutiva ou `--force` automaticamente.

## Código e comentários

Não adicione comentários de linha, bloco, JSDoc, TODO, código comentado ou
comentários gerados por IA em código, testes, CSS ou SQL. Expresse intenção com
nomes, tipos, funções coesas e módulos claros. Explicações duradouras pertencem
a Markdown. Arquivos gerados e service workers gerados não devem ser editados
manualmente.

## UI, mobile e acessibilidade

Projete mobile-first e depois expanda. Avalie touch targets, teclado virtual,
overflow, scroll, conteúdo longo, loading, vazio, erro e desktop. Quando mobile
precisar de composição diferente, preserve semântica e regra de negócio em vez
de comprimir o desktop.

Reutilize primitives, tokens e padrões antes de criar componentes. Não force
reutilização sem equivalência semântica. Preserve a linguagem visual e não
redesenhe telas sem pedido.

Prefira hierarquia, espaço, alinhamento e contraste a bordas. Evite caixas em
excesso e cards aninhados. Containers de tarefas, etapas, metas e grupos usam
superfície e sombra, sem borda padrão. Quando necessária, use os primitives de
ring existentes; para traço, use `DashedRing`.

Formulários controlados usam `noValidate` e feedback do app. Não use
`window.alert`, `window.confirm` ou `window.prompt`. Inputs estruturados devem
desabilitar assistência automática quando adequado. Preserve foco, teclado,
semântica, nome acessível e contraste.

## i18n, datas e timezone

Toda string de produto nova deve entrar nos dicionários tipados `pt-BR` e `en`
na mesma mudança. Preserve fallback, interpolação, pluralização e terminologia.
Não espalhe texto traduzível em componentes.

Datas de calendário usam helpers timezone-aware de `src/lib/time`. Não recorte
UTC manualmente para representar um dia local.

## Robustez e performance

Teste entradas inválidas, ausência de dados, rede indisponível, timeout,
concorrência, retry, duplicação, estado parcial, rollback e permissão negada
quando aplicável. Não engula exceções silenciosamente.

Evite N+1, consultas ilimitadas, payload excessivo, loops sem limite, chamadas
sequenciais evitáveis, refresh redundante e fila sem limite. Meça caminhos
críticos antes de otimizar. Siga baselines e ratchets do REVIEW.

## Documentação e conclusão

Atualize o README quando mudar estado real, setup, arquitetura, comandos,
integrações ou operação. Atualize AGENTS quando mudar como o agente trabalha,
REVIEW quando mudar gates e IMPLEMENTATION quando descobrir uma lacuna ainda
não resolvida. Atualize a Skill quando mudar o procedimento que ela
operacionaliza. Documentação detalhada de feature fica em `docs/`.

Antes de concluir:

1. execute os gates aplicáveis do REVIEW pelos targets do `Makefile`;
2. corrija regressões causadas pela alteração;
3. revise o diff por ruído, código morto, logs e comentários;
4. informe resultados e comandos executados;
5. informe gates omitidos e motivo;
6. diferencie falhas preexistentes de regressões novas.
