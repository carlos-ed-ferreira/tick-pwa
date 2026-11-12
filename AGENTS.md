# AGENTS.md

## Autoridade e escopo

Este arquivo rege agentes no repositório inteiro, salvo `AGENTS.md` mais
específico. O [README.md](README.md) apresenta o produto; o
[guia de desenvolvimento](docs/development/DESENVOLVIMENTO.md) descreve o ambiente
e o [REVIEW.md](REVIEW.md) define gates e critérios de revisão. O
[arquivo temporário de trabalho](docs/planning/PENDENCIAS.md) concentra
as pendências; não trate um item dele como garantia implementada.

## Antes de editar

Em alterações com vários módulos, banco, autenticação, arquitetura ou rollout, apresente um plano curto e verificável. Ambiguidades de produto que mudem comportamento ou contratos precisam de esclarecimento; escolhas rotineiras de implementação seguem os padrões existentes e a autorização já concedida.

1. Entenda o pedido e não amplie o escopo.
2. Leia os documentos técnicos e as skills pertinentes na tabela abaixo.
3. Localize a área, testes relacionados e implementações semelhantes.
4. Procure primitives, componentes, hooks, helpers e comandos existentes.
5. Identifique regras de negócio, escopos e dados afetados.
6. Consulte os gates aplicáveis no REVIEW.
7. Verifique o worktree e preserve mudanças do usuário.
8. Liste riscos de dados, segurança, offline, i18n e responsividade.
9. Prefira uma mudança pequena, reversível e coerente.

## Leitura por tarefa

| Tarefa                                          | Referências                                                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup, comandos e ambiente local                | [Desenvolvimento](docs/development/DESENVOLVIMENTO.md)                                                                                                            |
| Módulos, domínio e contratos de funcionalidades | [Arquitetura](docs/development/ARQUITETURA.md)                                                                                                                    |
| Persistência, conta e offline                   | [Sincronização](docs/development/SINCRONIZACAO.md), [Modos de acesso](docs/development/MODOS-DE-ACESSO.md) e skill `local-first-change`                           |
| Desenho, implementação ou revisão de UI         | [Skill de frontend](.agents/skills/frontend-design/SKILL.md) e suas referências                                                                                   |
| Mudança comportamental                          | Skill `tdd-change` e matriz do REVIEW                                                                                                                             |
| Textos traduzíveis                              | Skill `i18n-dictionary`                                                                                                                                           |
| Dependências                                    | [Manutenção](docs/operations/DEPENDENCIAS.md) e skill `dependency-maintenance`                                                                                    |
| Publicação, credenciais ou recuperação          | Documentos de `docs/operations`, começando pelo [ambiente](docs/operations/AMBIENTE-DE-PRODUCAO.md) e pelo [runbook de publicação](docs/operations/PUBLICACAO.md) |

Consulte apenas o material pertinente ao escopo, sem tratar pendências como estado implementado. Os guias de `docs/guides` explicam o uso do aplicativo; contratos de implementação pertencem a `docs/development`.

## Interface de comandos

O `Makefile` é a interface operacional única do projeto. Pessoas, agentes e
workflows devem executar `make <target>` em vez de chamar `npm`, `npx`, CLIs de
serviço ou scripts do repositório diretamente. Quando uma operação recorrente
não tiver target, adicione primeiro um target pequeno e nomeado ao `Makefile` e
documente-o no `make help`. Os comandos internos podem continuar encapsulados
pelos targets; não replique sua implementação fora do `Makefile`.

## Controle manual de versão e publicação

O desenvolvedor controla commits e publicações. Um pedido para implementar,
corrigir, continuar ou concluir trabalho não autoriza o agente a executar
`git add`, `git commit`, `git commit --amend`, `git push`, `make publish`, criar
ou mesclar pull request, criar tag ou release. O agente deve deixar as mudanças
não commitadas, informar os arquivos alterados e entregar os gates executados.

Essas operações só podem ser feitas quando o usuário pedir explicitamente a
operação correspondente no turno atual. Autorização anterior não permanece para
turnos seguintes. Inspeções Git somente leitura continuam permitidas.

Não execute `git reset --hard`, `git clean -fd` ou descarte de alterações sem solicitação explícita.

Não redesenhe áreas não relacionadas. Não crie uma arquitetura paralela para
uma feature isolada.

## Skills locais

Use a Skill correspondente em `.agents/skills` quando a tarefa envolver TDD,
persistência local-first, design de frontend, UI, i18n ou dependências. A
Skill operacionaliza o workflow, mas não substitui este arquivo nem os gates do
REVIEW.

Antes de iniciar qualquer tarefa, o agente deve inspecionar os diretórios de
skills existentes no repositório, inclusive os específicos de cada agente. Se
encontrar uma skill aplicável para outro agente, mas não houver equivalente no
diretório do agente em execução, deve criar uma cópia espelhada antes de
prosseguir. Preserve o mesmo nome, conteúdo e estrutura, adaptando apenas o
formato ou metadados estritamente exigidos pelo agente de destino. Por exemplo,
uma skill em `.agents/skills/<nome>/SKILL.md` deve ter o equivalente em
`.claude/skills/<nome>/SKILL.md` para o Claude Code; o mesmo princípio vale
para os demais diretórios de agentes, como Codex. Depois de criar ou atualizar
um espelho, mantenha as versões sincronizadas em alterações futuras.

A skill `frontend-design` é a fonte dos procedimentos e padrões de UI, inclusive tooltips, composição de toque e acessibilidade. `REVIEW.md` é a fonte dos critérios de aprovação. Mantenha referências em vez de copiar essas regras entre documentos.

## Arquitetura e simplicidade

Respeite as fronteiras da [arquitetura](docs/development/ARQUITETURA.md) e a direção das dependências.
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

Mudança puramente visual, como classes, espaçamento, raio, cor, ícone ou
texto, não exige teste RED prévio. Ajuste os testes existentes que quebrarem
e cubra com teste apenas o que tiver comportamento, como clique, navegação,
estado ou acessibilidade.

Durante RED, GREEN e ajustes, rode somente os arquivos afetados com
`make test-file files="<arquivos>"`. Rode `make check` uma única vez ao
concluir; ele já inclui a suíte completa, então não o preceda de `make test`.
E2E roda uma vez, ao final, apenas quando a mudança afetar layout,
responsividade ou fluxo de navegador, e nunca em paralelo com `make check` ou
`make build`, que reescrevem `.next`.

Em feature full-stack, implemente primeiro domínio, invariantes, validação,
persistência, autorização, contrato e seus testes; depois UI, integração,
loading, vazio, erro e E2E. Tarefa puramente visual não exige backend artificial.

## Local-first autenticado, guest e escopos

Local-first significa que o usuário autenticado pode continuar usando os dados
da conta quando perde a internet e sincronizar ao reconectar. Guest é uso sem
conta, exclusivamente local. Testes de guest não comprovam o contrato da conta
offline; validar cada modo e o caminho remoto efetivamente habilitado.

A interação principal deve confirmar localmente antes da rede. Toda mudança de
persistência deve considerar retry, idempotência, ordem, duplicação, conflito,
rollback, reconexão, fila e estado canônico. Ação do usuário não pode
desaparecer silenciosamente.

Preserve isolamento estrito:

- `guest:<installationId>` nunca envia entidades ao Supabase;
- `user:<supabaseUserId>` nunca lê nem grava dados de outro usuário;
- trocar de modo não mistura escopos;
- falha remota precisa de feedback recuperável.

O caminho funcional de lotes possui outbox Dexie durável, habilitado por flags
e restrito à coorte configurada. Não atribua essa garantia ao caminho legado
nem crie sync paralelo sem decisão arquitetural.

O aplicativo permanece fechado para acesso remoto, restrito a convidados
explicitamente autorizados na allowlist. O modo guest oferece todas as
funcionalidades de organização gratuitamente, sem limite de tempo ou quantidade
imposto pelo produto, com dados exclusivamente locais. Fechar/reabrir o app
não apaga progresso e não há expiração deliberada dos dados guest.

Preserve GitHub Free, Vercel Hobby e Supabase Free no ambiente atual.

Não migre dados guest incidentalmente durante login. Guest e contas convidadas
permanecem em escopos independentes; entrar em uma conta não autoriza enviar os
dados locais ao Supabase. O contrato está em
`docs/development/MODOS-DE-ACESSO.md`.

## Banco, API e segurança

Nunca use credenciais, URL ou anon key de produção no ambiente local. Não leia, exponha, registre ou versione valores de secrets e arquivos de ambiente reais; consulte os exemplos e o inventário de nomes, finalidades e consumidores.

Trate `supabase/schemas/tick.sql` como fonte declarativa. Gere migrations por
diff, revise o SQL e valide banco limpo, constraints, RLS, policies e
compatibilidade de rollout. Produção só recebe migrations pelo fluxo autorizado.

Derive usuário do token no servidor; nunca confie em `user_id` ou permissão de
acesso enviados pela UI. Inclua testes negativos de autorização. Considere XSS,
CSRF, SSRF, injection, secrets, abuso, rate limit, operações destrutivas,
webhooks duplicados e ownership quando aplicável.

Não adicione dependência antes de verificar solução existente, manutenção,
compatibilidade, licença, vulnerabilidades e impacto em bundle/runtime. Nunca
use atualização destrutiva ou `--force` automaticamente.

## Código e comentários

Use inglês para nomes de diretórios, arquivos, módulos, símbolos, tipos,
funções, variáveis, targets, artefatos técnicos e demais identificadores do
repositório. Documentos Markdown usam nomes em português, em maiúsculas,
sem acentos e com palavras separadas por hífens, mantendo a extensão `.md`.
Escolha nomes curtos que indiquem a finalidade do documento, sem traduções
literais ou detalhes redundantes. Arquivos
convencionais como `README.md`, `AGENTS.md`, `CLAUDE.md`, `REVIEW.md` e
`SKILL.md` preservam seus nomes em inglês. Diretórios e identificadores de
skills continuam em inglês. Não introduza outros identificadores técnicos
em português.

Não adicione comentários de linha, bloco, JSDoc, TODO, código comentado ou
comentários gerados por IA em código, testes, CSS ou SQL. Expresse intenção com
nomes, tipos, funções coesas e módulos claros. Explicações duradouras pertencem
a Markdown. Arquivos gerados e service workers gerados não devem ser editados
manualmente.

## UI, mobile e acessibilidade

Use a [skill de frontend](.agents/skills/frontend-design/SKILL.md) para desenho, implementação e revisão. Ela concentra os padrões de controles, superfícies, tipografia, tooltips, formulários, foco e adaptação ao toque. As regras detalhadas ficam em suas referências, sem uma segunda especificação neste arquivo.

Preserve a linguagem visual e o desenho desktop em adaptações mobile. Não redesenhe áreas sem pedido. Regra de negócio, dados e semântica devem ser os mesmos nas composições desktop e toque. Uma divergência existente não autoriza perpetuar o erro; registre a correção fora do escopo em PENDENCIAS e aplique os critérios do REVIEW às alterações solicitadas.

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
sequenciais evitáveis, refresh redundante e fila sem limite. Prefira o caminho
claramente mais eficiente quando resolver a mesma ação com complexidade
semelhante. Não introduza complexidade por ganho pequeno nem exija medição
para cada escolha simples. Meça quando isso ajudar a investigar um problema
real ou uma alteração relevante.

O uso atual é uma pessoa em três dispositivos, com teto conservador de 20
convidados. Não criar gates de capacidade, budgets estatísticos ou exigências
de monitoramento automático nesta etapa. O proprietário acompanha quotas e
experiência manualmente. Sincronização em segundo plano deve permitir edição
contínua sem apagar ou sobrescrever alterações locais; cerca de 20 segundos
é referência de investigação, não timeout de descarte da fila. Preservar os
gates funcionais, de segurança e de integridade do REVIEW.

## Documentação e conclusão

Atualize o README quando mudar a apresentação ou as capacidades do produto.
Setup e comandos ficam no guia de desenvolvimento; arquitetura e contratos,
nos documentos técnicos; uso, nos guias; configuração e operação, nos runbooks. Atualize AGENTS quando mudar como o agente trabalha e
REVIEW quando mudar gates. Atualize a Skill quando mudar seu procedimento e
mantenha os espelhos sincronizados. Documentação detalhada fica em `docs/`.

Toda informação sobre produção e serviços externos entra na documentação no
mesmo turno em que é feita, descoberta ou informada pelo usuário: conta e plano
de cada provedor, secrets e variáveis criados, alterados ou removidos, hooks,
rulesets, proteções, flags e o resultado de consultas operacionais relevantes.
O inventário de credenciais e configuração fica em
`docs/operations/AMBIENTE-DE-PRODUCAO.md`; procedimentos de publicação, em
`docs/operations/PUBLICACAO.md`; o que ainda falta configurar ou validar, no
arquivo temporário de trabalho. Registre nomes, origem, finalidade e
consumidores, nunca valores. Ao encontrar documentação divergente do estado
real, corrija-a na mesma mudança.

Títulos e subtítulos usam capitalização natural e preservam termos técnicos,
nomes convencionais, marcas e siglas. Não usar caixa alta em todo o título;
a convenção de maiúsculas se aplica aos nomes dos arquivos.

Markdown permanente descreve comportamento, regras e procedimentos atuais,
sem histórico de releases, incidentes, aceites ou resultados antigos de gates.
Resultados específicos são entregues na tarefa ou revisão correspondente.
Concentre toda pendência no arquivo temporário de trabalho, com origem, estado
e critério de resolução. Remova itens resolvidos e atualize apenas o estado
resultante nos documentos permanentes. Remova o arquivo temporário e suas
referências quando não houver itens abertos.

Antes de concluir:

1. execute os gates aplicáveis do REVIEW pelos targets do `Makefile`;
2. corrija regressões causadas pela alteração;
3. revise o diff por ruído, código morto, logs e comentários;
4. informe resultados e comandos executados;
5. informe gates omitidos e motivo;
6. diferencie falhas preexistentes de regressões novas.
