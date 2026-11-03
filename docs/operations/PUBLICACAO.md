# Deploy Hook e publicação

## Contrato atual

A Vercel mantém conexão Git com o repositório. `vercel.json` desabilita o
auto-deploy da `main`, preservando previews das outras branches e Deploy Hooks.
O hook de produção aponta para `main` e é chamado pelo workflow de migrations.

No caminho automático, App CI aprovado na `main` habilita o workflow de
produção. Ele faz checkout do SHA aprovado e compara `HEAD^ HEAD` nos arquivos
de banco. Se detectar alteração, executa repair do histórico conhecido, dry-run
e push. Depois confere a ponta da `main` e dispara o hook.

No caminho manual, o workflow exige `main`, executa `make check` e
`make audit-prod` e força a etapa de banco. Esse caminho não executa os jobs
de pgTAP ou E2E do App CI.

O hook resolve a branch, não recebe `APPROVED_SHA` no payload. A consulta da
`main` anterior ao POST não fixa o commit efetivo na Vercel. O job aceita o
retorno do pedido, inclusive `PENDING`; não espera `Ready`. A confirmação
operacional abaixo é manual. O sucesso do GitHub não substitui essa confirmação.

## Configuração

1. Na Vercel, manter o repositório conectado e a branch de produção `main`.
2. Em Settings → Git → Deploy Hooks, manter o hook
   `tick-production-after-migrations` apontando para `main`.
3. Guardar a URL no gerenciador de senhas e no environment GitHub `production`,
   secret `VERCEL_DEPLOY_HOOK_URL`. A URL autoriza deploy; não abri-la no navegador.
4. Manter `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` e
   `SUPABASE_DB_PASSWORD` no mesmo environment.
5. Confirmar `git.deploymentEnabled.main: false` no `vercel.json`. Não usar
   `github.enabled: false`, que bloqueia os hooks.
6. Conferir metadados do secret sem imprimir seu valor:

```sh
make deploy-hook-status
```

## Publicação cotidiana

O proprietário faz commit na `dev` e solicita a publicação explicitamente.
Agentes só executam cada operação de versionamento/publicação quando pedida no
turno atual. Não usar push direto na `main` nem force push para contornar gates.

```sh
make publish
```

O comando exige worktree limpo, prepara o PR, espera checks obrigatórios antes
de armar squash automático, confirma merge e reconcilia `dev`. A mensagem final
confirma `main` atualizada. Não espera migrations nem deployment da aplicação.

Interrupção antes de armar auto-merge deixa o PR aberto; depois de armado, o
merge pode acontecer sem o processo local. Consultar o estado do PR e dos
workflows antes de repetir operações.

## Confirmar a publicação

```sh
make actions-status
make actions-run run=<run-id>
make operations-issues
```

1. Localizar o App CI e o pipeline do SHA da publicação; distinguir auditorias
   horárias de execuções que efetivamente migram e disparam deploy.
2. Conferir os jobs `Confirm quality gate`, `Apply production migrations` e
   `Deploy production application`, nessa ordem.
3. Copiar do summary `Approved SHA` e ID do job do hook.
4. Na Vercel, conferir Production, branch `main`, commit idêntico ao aprovado,
   estado `Ready` e início posterior às migrations.
5. Verificar que não há deployment duplicado ou automático anterior ao banco.
6. No domínio canônico, testar guest, login, calendário e metas, com dados de
   teste isolados e sem expor credenciais.
7. Na conta habilitada, validar edição offline, reload e reconexão.

O deployment com SHA divergente ou estado `Error` reprova a confirmação,
mesmo com workflow verde. Não declarar publicação completa apenas pelo hook.

## Falha e retomada

- Falha antes das migrations interrompe o caminho sem atualizar o banco.
- Migration falha impede o job de deploy; conferir o histórico remoto antes de
  retomar, sem presumir rollback de todas as migrations do conjunto.
- Depois da migration, uma falha de deploy deixa a aplicação anterior usando o
  banco atualizado. Migrations devem ser compatíveis com ela e com PWAs abertas.
- Se a checagem de SHA falhar, conferir o SHA da `main` e os workflows antes de
  retomar. Não presumir que a execução seguinte aplicará migrations pendentes:
  a detecção automática compara apenas o último commit.
- Se o hook responder erro, preservar logs e ID; se aceitar e o deployment
  falhar depois, verificar diretamente a Vercel e registrar a falha na tarefa.
- Em recuperação, reexecutar o workflow apropriado pela interface GitHub somente
  com autorização explícita de publicação e gates correspondentes revisados.
- A auditoria horária compara histórico de migrations e avisa divergências;
  não verifica o deployment atual e depende da disponibilidade do GitHub.

Rollback de aplicação promove o último deployment saudável compatível na
Vercel; não desfaz o banco. Banco usa migration compensatória aditiva pelo fluxo
protegido. Restore destrutivo exige autorização específica. Procedimentos em
[telemetria e recuperação](MONITORAMENTO-E-RECUPERACAO.md).
