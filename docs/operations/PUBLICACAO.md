# Publicação e recuperação

## Contrato atual

A Vercel mantém conexão Git com o repositório. `vercel.json` desabilita o
auto-deploy de `main`, preservando previews das outras branches. O pipeline
usa a API Vercel com o SHA aprovado explícito; não utiliza Deploy Hook.

A publicação aceita somente `workflow_dispatch` com `expected_sha` completo e
`request_id` único, normalmente enviado por `make publish`. Não há gatilho por
conclusão de CI nem auditoria horária de migrations. Merge na `main` executa
CI, mas só a solicitação explícita inicia a publicação.
O SHA solicitado deve ser igual ao SHA do run e à ponta atual de `main`, com
App CI completo aprovado. Os jobs de aplicação, banco,
E2E e segurança pertencem à mesma execução bem-sucedida. Antes das migrations,
o preflight confere o projeto Vercel e seu vínculo GitHub. Em toda publicação,
repair conhecido, dry-run, push e conferência do histórico remoto executam em
sequência, inclusive quando o último commit não altera arquivos de banco.

O deploy confere SHA efetivo, projeto e Production, espera `READY` com polling
limitado e timeout do job de 15 minutos, e testa `/`, `/calendar`, `/goals` e `/recurring`.
O smoke exige HTTP bem-sucedido, HTML e marcador `tick-release` do SHA aprovado.
Ele roda na URL imutável do deployment, depois da promoção; não testa login,
API de dados ou resolução do domínio canônico.

## Configuração

`VERCEL_TOKEN`, `VERCEL_PROJECT_ID` e `VERCEL_AUTOMATION_BYPASS_SECRET` já estão
criados e cadastrados no environment GitHub `production`, com presença conferida
por metadados. O projeto fica na conta pessoal Hobby da Vercel, sem time, por
isso `VERCEL_TEAM_ID` não é cadastrado. O token
autoriza a API; o ID seleciona o projeto. Esse cadastro não comprova que o token
é válido ou tem o escopo necessário: o preflight faz essa verificação.
Origem, finalidade e consumidores de todas as credenciais estão no
[inventário operacional](AMBIENTE-DE-PRODUCAO.md#inventário-de-credenciais-do-github).

1. Manter o repositório conectado na Vercel, Production em `main` e
   `git.deploymentEnabled.main: false` no `vercel.json`.
2. No environment GitHub `production`, configurar `VERCEL_TOKEN` com acesso ao
   projeto e `VERCEL_PROJECT_ID`. Configurar `VERCEL_TEAM_ID` quando o projeto
   pertence a um time. Manter os valores somente no cofre e nos provedores.
3. Se a URL imutável exigir Deployment Protection, configurar
   `VERCEL_AUTOMATION_BYPASS_SECRET` para o smoke; sem ele, o teste rejeita a
   página de proteção. Não desabilitar proteção para contornar o gate.
4. Manter `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` e
   `SUPABASE_DB_PASSWORD` no mesmo environment.
5. O pipeline usa `GITHUB_REPOSITORY_ID`, `GITHUB_REPOSITORY` e o token de
   Actions para consultar o mesmo SHA no App CI. Não exige credencial GitHub
   adicional. Sem configuração válida, falha antes das migrations.

A referência do contrato da API está na documentação oficial de
[criação de deployment](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
e [consulta de deployments](https://vercel.com/docs/rest-api/deployments/list-deployments).

## Publicação cotidiana

O proprietário faz commit na `dev` e solicita a publicação explicitamente.
Agentes só executam cada operação de versionamento/publicação quando pedida no
turno atual. Não usar push direto na `main` nem force push para contornar gates.

```sh
make publish
```

O comando exige worktree limpo, prepara o PR, espera checks obrigatórios antes
de armar squash automático, confirma merge e reconcilia `dev`. Sua mensagem
informa o resultado da publicação. Depois do merge, captura o SHA efetivo do
PR, espera o App CI de push da `main` daquele SHA e verifica novamente se ele
continua na ponta da branch. A espera pelo CI é limitada a cerca de uma hora.
CI reprovado ou SHA superado impede a solicitação de produção.

O comando envia `expected_sha` e um UUID como `request_id`, localiza o run pelo
nome `Production <SHA> (<request_id>)` e mostra seu link. São até 30 consultas
para localizar o run e cerca de uma hora para acompanhar sua conclusão,
incluindo fila. Só confirma publicação depois de sucesso remoto, que exige
migrations, `READY` e smoke aprovados. Não repete um disparo com resposta perdida
ou run ainda não localizado.

Interromper antes de armar auto-merge deixa o PR aberto; depois de armado, o
merge pode acontecer sem o processo local continuar executando. Se o terminal
for fechado antes do disparo, o merge não publica. Depois do disparo, fechar o
terminal ou esgotar a espera local não cancela o run do Actions. Siga o link ou
procure o identificador impresso antes de solicitar outra execução.

## Ativação e acesso externo

O workflow novo precisa chegar à `main` para remover os gatilhos antigos e
aceitar os novos inputs. Ao usar `make publish` a partir deste código, o próprio
merge instala o workflow antes do disparo explícito. Não executar uma cópia
antiga do comando após a transição: ela termina no merge e não solicita deploy.
Antes da primeira publicação, conferir runs antigos ainda na fila ou executando;
a alteração do arquivo não cancela execuções já criadas.

Não são necessários novos secrets, Deploy Hooks, planos ou serviços. Manter os
secrets existentes do environment `production`, o auto-deploy Git de `main`
desabilitado na Vercel, os checks obrigatórios e o backup diário habilitado.
O GitHub CLI local deve estar autenticado com acesso ao repositório e permissão
para disparar Actions. Se houver erro 403 no disparo, revisar essa permissão;
para token fine-grained, é necessário `Actions: write` além das permissões já
usadas para PR e conteúdo. Aprovar manualmente o environment se houver uma
regra externa de aprovação configurada.

## Confirmar a publicação

```sh
make production-release-status
make actions-status
make actions-run run=<run-id>
make operations-issues
```

Quando um E2E reprova no App CI, o job publica `playwright-artifacts`. Baixe-o
para uma pasta vazia com
`make actions-artifact-download run=<run-id> name=playwright-artifacts dir=<pasta>`
e leia o `error-context.md` do teste, com o passo e o estado da página no
momento da falha, e o `trace.zip`, com a rede de cada contexto do navegador.

1. Localizar o App CI de push e o run de publicação do SHA solicitado,
   usando o link e o identificador impressos por `make publish`.
2. Conferir `Confirm quality gate`, `Apply production migrations` e
   `Deploy production application`, nessa ordem.
3. Conferir `Approved SHA` e `Production deployment` no summary. O sucesso
   exige `READY` e smoke aprovado, não apenas pedido aceito.
4. No domínio canônico, testar guest, login, calendário e metas, com dados
   sintéticos. Conferir SHA e ausência de deployment automático anterior ao banco.
5. Na conta habilitada, validar edição offline, reabertura e reconexão.

## Falha e retomada

- Falha no preflight interrompe o caminho antes de alterar o banco.
- Migration falha impede deploy; conferir histórico remoto antes de retomar,
  sem presumir rollback de todas as migrations do conjunto.
- Depois da migration, falha da Vercel deixa a aplicação anterior usando o
  banco atualizado. Toda migration deve ser compatível com ela e PWAs abertas.
- Avanço de `main` faz o SHA superado ser recusado. O próximo pipeline consulta
  todas as migrations pendentes, independentemente do último diff Git.
- Antes de criar, o pipeline procura deployment Production com o mesmo SHA.
  Se perder a resposta do POST, consulta novamente e não repete o POST naquela
  execução. Sem confirmação, falha e exige inspeção antes de retomar. A listagem
  considera os 100 deployments mais recentes; não representa retenção infinita.
- Timeout, erro de API, cancelamento ou falha no smoke reprovam o job. Inspecionar
  deployment, aliases e domínio antes de repetir. Um smoke falho pode ocorrer
  após a promoção; não há rollback automático.
- Se o merge já ocorreu, não criar outro commit ou PR só para retomar. No
  GitHub Actions, abrir `Supabase migrations` → `Run workflow`, escolher `main`,
  informar o SHA completo atual em `expected_sha` e um identificador novo e
  único em `request_id`. Essa ação é uma autorização explícita de publicação;
  o preflight continua exigindo todos os gates do mesmo SHA.
- Antes de novo disparo ou reexecução, verificar se a solicitação anterior ainda
  está na fila ou executando e inspecionar migrations, deployment e aliases.
  Retomadas reutilizam deployment compatível encontrado e confirmam novamente
  seu estado e saúde. Reexecutar um run de SHA superado será recusado.
- GitHub indisponível não interrompe a aplicação já servida pela Vercel, mas
  impede automações e avisos hospedados nele. Falhas da própria infraestrutura
  Vercel podem afetar a aplicação servida independentemente do pipeline.

Supabase e Vercel não compartilham transação de publicação. Durante instabilidade
conhecida, adiar publicações com migrations é uma decisão operacional válida.
Rollback de aplicação promove o último deployment saudável compatível e não
desfaz o banco. Banco usa migration compensatória aditiva pelo fluxo protegido;
restore destrutivo exige autorização específica. Procedimentos em
[telemetria e recuperação](MONITORAMENTO-E-RECUPERACAO.md).
