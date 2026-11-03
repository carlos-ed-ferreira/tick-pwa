# Roteiro: Deploy Hook e deploy ordenado

Você vai fazer a produção ser publicada **somente depois** das migrations, pelo
mesmo SHA aprovado. Isso fecha o passo 5 do
[plano de implementação](../planning/implementation-plan.md) e a issue `#43`.

Tudo é feito no Windows/WSL2, no navegador e no terminal deste repositório.

Tempo estimado: 30 minutos, mais o tempo de uma publicação.

## Aceite operacional em 2026-11-02 após publicação

O proprietário confirmou o deploy completo com sucesso e autorizou considerar
os workflows funcionais, reabrindo o incidente se houver nova falha.
A consulta ao GitHub confirmou no SHA `ce9e7d1d97f374f23dccaee36680385f70cb3e41`:

| Execução                                                                                                   | Resultado                                 |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [App CI 41535884511](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41535884511)              | aplicação, banco e E2E aprovados          |
| [Migrations e deploy 41536456800](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41536456800) | quality gate, migrations e hook aprovados |
| [Auditoria 41537177311](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41537177311)           | histórico de migrations aprovado          |

As migrations terminaram às `22:21:00Z` e o job de deploy começou às
`22:21:04Z` (`19:21:00` e `19:21:04` em São Paulo). A conclusão do deployment
na Vercel foi confirmada pelo proprietário; não houve inspeção independente
do painel nesta revisão. A consulta de issues abertas retornou lista vazia.

O último backup consultado é o
[run 41520276777](https://github.com/carlos-ed-ferreira/tick-pwa/actions/runs/41520276777),
aprovado e restaurado na segunda máquina, ainda no SHA anterior `a00e5b4`.
Não há execução observada do novo workflow GHCR nesta consulta. O proprietário
aceitou encerrar esta validação sem aguardar nova execução ou série diária.
Isso encerra as pendências de funcionamento dos workflows nos passos 4 e 5
por aceite explícito. Não registra novos ensaios de falha, rollback, estabilidade
ou unicidade de deployment como executados; esses procedimentos permanecem
como referência operacional.
Os avisos automáticos permanecem ativos. Reabrir a investigação se houver falha.

## Histórico anterior à publicação, em 2 de novembro de 2026

O restore em duas máquinas e a limpeza foram concluídos pelo proprietário.
Depois da criação do hook informada por ele, `make deploy-hook-status` confirmou
`VERCEL_DEPLOY_HOOK_URL` no environment `production`, criado em
`2026-11-02T21:39:25Z` (`18:39:25` em São Paulo). A consulta leu somente nome e
datas; a URL não foi acessada nem disparada.

O `vercel.json` já está preparado no worktree, com auto-deploy Git desabilitado
somente para `main`. `make test-release-workflow` teve RED antes do arquivo e
GREEN com quatro testes depois dele; a suíte agora inclui cinco testes. A configuração só passa a valer em
produção após publicação pelo proprietário, e não comprova por si só a entrega
real do hook.

Os bloqueios locais foram corrigidos: dependências instaladas a partir do
lockfile, tipos gerados antigos removidos por `make clean`, atualizações de
segurança e normalização de finais de linha. `make check` e os gates de banco
passaram; `make audit-prod` reportou zero vulnerabilidades. O audit completo
não tem achados altos ou críticos e mantém 16 moderados de desenvolvimento.
A validação final está no
[relatório de manutenção](dependency-maintenance-2026-11-02.md).

O prazo de 23/10/2026 do passo 3 já passou: essa reexecução histórica deve ser
pulada. A comprovação do deploy depende de uma publicação futura explicitamente
autorizada pelo proprietário. A mitigação da falha intermitente usa GHCR no workflow ainda não publicado; concluir o restore não comprova estabilidade do workflow diário.

---

## Passo 1 — Criar o Deploy Hook na Vercel

1. Abra [vercel.com](https://vercel.com) e entre no projeto do Tick.
2. Clique em **Settings** → **Git**.
3. Role até **Deploy Hooks**.
4. Preencha:
   - **Name**: `tick-production-after-migrations`
   - **Branch**: `main`
5. Clique em **Create Hook**.
6. Copie a URL gerada e salve no gerenciador de senhas, em um item chamado
   `Tick — VERCEL_DEPLOY_HOOK_URL`.

**Não** abra a URL no navegador nem rode `curl` nela: qualquer chamada publica
a produção.

Nesta tela, **não** clique em **Disconnect** e não altere mais nada.

---

## Passo 2 — Cadastrar o hook no GitHub

No terminal do WSL2, na pasta do repositório, cole o bloco. Quando aparecer
`Deploy hook URL:`, cole a URL (nada aparece na tela) e aperte **Enter**.

```bash
read -r -s -p "Deploy hook URL: " HOOK_URL; echo
printf '%s' "$HOOK_URL" | gh secret set VERCEL_DEPLOY_HOOK_URL --env production --repo carlos-ed-ferreira/tick-pwa
unset HOOK_URL
gh secret list --env production --repo carlos-ed-ferreira/tick-pwa
```

A lista final deve ter **seis** linhas, incluindo `VERCEL_DEPLOY_HOOK_URL` com
a data de hoje.

---

## Passo 3 — Testar o hook sem publicar nada novo

A execução que abriu a `#43` falhou só no último job, por falta do hook. A
`main` ainda está no mesmo commit (`a00e5b4`), então dá para reexecutar só
esse job.

**Prazo: até 23/10/2026.** Depois disso o GitHub não permite reexecutar. Se o
prazo passou ou a `main` mudou, pule para o passo 4.

```bash
gh api repos/carlos-ed-ferreira/tick-pwa/commits/main --jq .sha
```

Deve mostrar `a00e5b4303b09d2f687b885c6ceeb69ce03cb7ec`. Se mostrar outro
valor, pule para o passo 4.

```bash
gh run rerun 35898587204 --failed --repo carlos-ed-ferreira/tick-pwa
sleep 10
gh run watch 35898587204 --repo carlos-ed-ferreira/tick-pwa --exit-status
```

Resultado esperado: `Deploy production application` verde.

Confira na Vercel:

1. Abra **Deployments**.
2. O deployment mais recente deve estar em **Production**, branch `main`,
   commit `a00e5b4`, marcado como disparado por Deploy Hook e em estado
   **Ready**.
3. Abra [tickapp.com.br](https://tickapp.com.br) e confira se calendário, metas,
   login e modo sem conta abrem.

Se o job falhar, copie a mensagem de erro e me envie. Não siga para o passo 4.

---

## Passo 4 — Desligar o auto-deploy da `main`

O painel da Vercel **não tem** opção para desligar o auto-deploy de uma branch
só. A forma oficial é um arquivo `vercel.json` no repositório com
`git.deploymentEnabled`. Não use `github.enabled: false`: essa opção bloqueia
os Deploy Hooks.

O arquivo já foi preparado no worktree em 2026-11-02 com este conteúdo:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

Os previews da branch `dev` continuam funcionando.

---

## Passo 5 — Publicar e comprovar a ordem

Esta publicação é a prova final. Ela leva o `vercel.json` para a `main`, e a
Vercel lê a configuração do próprio commit. Por isso, esse merge já não gera
auto-deploy.

1. Faça o commit na `dev` e rode:

```bash
make publish
```

2. Espere o comando terminar com o merge confirmado.
3. Acompanhe o pipeline:

```bash
sleep 60
gh run list --workflow "Supabase migrations" --event workflow_run --limit 1 --repo carlos-ed-ferreira/tick-pwa
```

Anote o número do run (sétima coluna) e rode:

```bash
gh run watch <run-id> --repo carlos-ed-ferreira/tick-pwa --exit-status
gh run view <run-id> --repo carlos-ed-ferreira/tick-pwa --json jobs --jq '.jobs[]|"\(.name)  \(.conclusion)  \(.startedAt)  \(.completedAt)"'
```

A ordem deve ser: `Confirm quality gate` → `Apply production migrations` →
`Deploy production application`, todos `success`.

4. Abra o run no navegador e copie do **Summary** as linhas `Approved SHA` e
   `Vercel deploy hook job`.
5. Na Vercel → **Deployments**, confira:
   - existe **um único** deployment de Production para esse SHA;
   - ele foi disparado por Deploy Hook;
   - o commit é igual ao `Approved SHA`;
   - ele começou **depois** do fim de `Apply production migrations`;
   - o estado é **Ready**.
6. Abra [tickapp.com.br](https://tickapp.com.br) e confira se calendário, metas,
   login e modo sem conta abrem.

---

## Passo 6 — Registrar

Cole no Claude Code:

```text
Deploy ordenado comprovado.
Run de reexecução (passo 3): <aprovado, pulado ou erro>
Run da publicação: <run-id>
Approved SHA: <valor>
Vercel deploy hook job: <valor>
Horários dos jobs: <saída do gh run view do passo 5>
Deployment na Vercel: <único, via hook, Ready, iniciado às HH:MM>
Smoke test: <ok ou o que falhou>
```

Com isso, eu atualizo o runbook, o plano e o checklist, e você fecha a `#43`.

---

## Se der errado

| Situação                                                          | O que fazer                                                                                                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passo 3: `Missing VERCEL_DEPLOY_HOOK_URL`                         | O secret foi para o lugar errado. Repita o passo 2 com `--env production`                                                                                       |
| Passo 3: `curl: (22) ... 404`                                     | URL copiada errada ou hook apagado. Crie outro hook no passo 1 e repita o passo 2                                                                               |
| Passo 3: `gh run rerun` recusado                                  | O prazo de 30 dias passou. Vá para o passo 4                                                                                                                    |
| Passo 5: `Confirm approved SHA is still current` falhou           | Outro merge entrou na `main` durante o pipeline. Nada foi publicado; a próxima publicação refaz o processo                                                      |
| Passo 5: job de deploy verde, mas **nenhum** deployment na Vercel | O `vercel.json` bloqueou também o hook. Vercel → Deployments → último deployment da `main` → **⋯** → **Redeploy**. Depois me avise para retirar o `vercel.json` |
| Passo 5: **dois** deployments de Production para o mesmo SHA      | O auto-deploy não foi desligado. Confira se o `vercel.json` está na raiz da `main` e me avise                                                                   |
| Passo 5: deployment começou antes do fim das migrations           | Reprovado pelo mesmo motivo da linha anterior                                                                                                                   |
| Passo 5: deployment em **Error**                                  | Vercel → Deployments → último deployment saudável → **⋯** → **Promote to Production**. Copie o log do build e me envie                                          |

Nunca reaplique migrations à mão e nunca dispare a URL do hook manualmente.
