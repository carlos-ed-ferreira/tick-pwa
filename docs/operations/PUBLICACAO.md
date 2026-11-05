# Publicação e recuperação

## Contrato atual

A Vercel mantém conexão Git com o repositório. `vercel.json` desabilita o
auto-deploy de `main`, preservando previews das outras branches. O pipeline
usa a API Vercel com o SHA aprovado explícito; não utiliza Deploy Hook.

Tanto `workflow_run` quanto `workflow_dispatch` exigem o App CI completo
aprovado daquele SHA e a ponta atual de `main`. Os jobs de aplicação, banco,
E2E e segurança pertencem à mesma execução bem-sucedida. Antes das migrations,
o preflight confere o projeto Vercel e seu vínculo GitHub. Em toda publicação,
repair conhecido, dry-run, push e conferência do histórico remoto executam em
sequência, inclusive quando o último commit não altera arquivos de banco.

O deploy confere SHA efetivo, projeto e Production, espera `READY` com polling
limitado e timeout do job de 15 minutos, e testa `/`, `/calendar` e `/goals`.
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
final confirma `main` atualizada. O processo local não espera migrations nem
deployment. Interromper antes de armar auto-merge deixa o PR aberto; depois de
armado, o merge pode acontecer sem o processo local continuar executando.

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

1. Localizar o App CI e o pipeline do mesmo SHA; distinguir auditoria horária
   de execução de publicação.
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
- Reexecutar o workflow pela interface GitHub somente com autorização explícita
  de publicação e gates do SHA revisados. Retomadas reutilizam deployment
  compatível encontrado e confirmam novamente seu estado e saúde.
- GitHub indisponível não interrompe a aplicação já servida pela Vercel, mas
  impede automações e avisos hospedados nele. Falhas da própria infraestrutura
  Vercel podem afetar a aplicação servida independentemente do pipeline.

Supabase e Vercel não compartilham transação de publicação. Durante instabilidade
conhecida, adiar publicações com migrations é uma decisão operacional válida.
Rollback de aplicação promove o último deployment saudável compatível e não
desfaz o banco. Banco usa migration compensatória aditiva pelo fluxo protegido;
restore destrutivo exige autorização específica. Procedimentos em
[telemetria e recuperação](MONITORAMENTO-E-RECUPERACAO.md).
