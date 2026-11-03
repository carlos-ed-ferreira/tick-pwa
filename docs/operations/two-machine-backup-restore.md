# Roteiro: restore do backup na máquina Ubuntu

Você vai provar que o backup de produção abre em outra máquina. Tudo acontece
no **Ubuntu**. O Windows/WSL2 só é usado no final, para registrar o resultado.
Nada aqui toca a produção.

Tempo estimado: 20 minutos.

## Último resultado

Aprovado em 2026-11-02 pelo proprietário em um Linux Acer A15 com Node
22.21.1, usando o run `41520276777`: 10 tabelas públicas, exit status 0, RTO de
3,454 s e idade do backup de 47 min 39,601 s. A limpeza foi confirmada. A
evidência está em [observability-backup-restore.md](observability-backup-restore.md).

Por decisão do proprietário, o ensaio feito por ele em duas máquinas é
suficiente; não há exigência de outra pessoa. Repita este roteiro pelo menos
mensalmente e depois de mudanças em backup, restore ou versões do Supabase.

Backups gerados em SHA igual ou posterior a `ce9e7d1` já contêm o utilitário de
restore com preparação de Auth e Storage. Um artefato gerado antes disso exige
aplicar essas correções ao checkout histórico; prefira um backup recente.

---

## Passo 1 — Abrir o terminal no Ubuntu

Abra o terminal no Ubuntu. Todos os comandos dos passos 1 a 9 são colados nele.
Use **o mesmo terminal** do passo 2 até o passo 9: os valores `RUN_ID` e `SHA`
se perdem se ele for fechado. Se fechar, repita a partir do passo 2.

Confira as ferramentas:

```bash
git --version && node --version && npm --version && docker info --format '{{.ServerVersion}}' && gh auth status
```

Deve aparecer, nesta ordem: versão do Git, versão do Node, versão do npm,
versão do Docker e `Logged in to github.com`. Confira também `make --version`.

Se o Docker responder `permission denied`, rode isto, **feche e abra o
terminal** e repita a conferência:

```bash
sudo usermod -aG docker "$USER"
```

---

## Passo 2 — Pegar o backup mais recente

```bash
RUN_ID=$(gh run list --repo carlos-ed-ferreira/tick-pwa --workflow "Production backup" --status success --limit 1 --json databaseId --jq '.[0].databaseId')
SHA=$(gh run view "$RUN_ID" --repo carlos-ed-ferreira/tick-pwa --json headSha --jq .headSha)
echo "RUN_ID=$RUN_ID"; echo "SHA=$SHA"
```

**Anote os dois valores.** Se algum vier vazio, pare e verifique se o workflow
`Production backup` teve execução verde nos últimos 14 dias.

---

## Passo 3 — Baixar o código na mesma versão do backup

```bash
rm -rf ~/tick-restore-check
git clone https://github.com/carlos-ed-ferreira/tick-pwa.git ~/tick-restore-check
cd ~/tick-restore-check
git checkout "$SHA"
ls -a | grep -E '^\.env'
```

A última linha deve mostrar **apenas** `.env.example`. Não crie `.env.local`
nesta pasta. Não rode `make install`.

---

## Passo 4 — Baixar as imagens do Postgres, Auth e Storage

```bash
make backup-restore-prepare
```

O target baixa `public.ecr.aws/supabase/postgres:17.6.1.121`,
`public.ecr.aws/supabase/gotrue:v2.197.0` e
`docker.io/supabase/storage-api:v1.81.0`. Espere terminar; isso fica fora do
tempo medido.

O restore prepara os schemas de Auth e Storage com as migrations oficiais
dessas imagens antes de importar o dump. Não crie colunas avulsas nem descarte
dados do backup para contornar falhas de compatibilidade.

---

## Passo 5 — Baixar o arquivo cifrado

```bash
gh run download "$RUN_ID" --repo carlos-ed-ferreira/tick-pwa --name "tick-production-backup-$RUN_ID" --dir ~/tick-restore-check/.restore
ls -l ~/tick-restore-check/.restore
```

Deve aparecer um único arquivo: `tick-production-backup.enc`.

---

## Passo 6 — Copiar a chave do gerenciador de senhas

1. No Ubuntu, abra o gerenciador de senhas pelo navegador ou pelo app.
2. Abra o item que guarda `TICK_BACKUP_ENCRYPTION_KEY`.
3. Copie o valor da chave. **Não** cole em arquivo, chat ou nota.

---

## Passo 7 — Anotar o horário de início

```bash
date -u; TZ=America/Sao_Paulo date
```

Anote os dois horários.

---

## Passo 8 — Rodar o restore

Cole o bloco inteiro. Quando aparecer `Backup encryption key:`, cole a chave
(nada vai aparecer na tela) e aperte **Enter**.

```bash
cd ~/tick-restore-check
read -r -s -p "Backup encryption key: " TICK_BACKUP_ENCRYPTION_KEY; echo
export TICK_BACKUP_ENCRYPTION_KEY
make backup-restore archive="$HOME/tick-restore-check/.restore/tick-production-backup.enc"
unset TICK_BACKUP_ENCRYPTION_KEY
date -u; TZ=America/Sao_Paulo date
```

No fim deve aparecer um bloco assim, seguido dos horários de término:

```json
{
  "publicTables": 12,
  "backupCreatedAt": "2026-10-18T03:28:30.000Z",
  "rpoMs": 43200000,
  "rtoMs": 95000
}
```

**Copie esse bloco e os horários de início e fim.**

Se aparecer erro, veja a tabela no fim deste roteiro. Não edite nenhum arquivo
para contornar.

---

## Passo 9 — Limpar o Ubuntu

```bash
docker ps -a --filter name=tick-backup-restore
cd ~ && rm -rf -- ~/tick-restore-check
```

A primeira linha deve mostrar só o cabeçalho, sem container. Depois disso:

- limpe a área de transferência copiando qualquer outro texto;
- no gerenciador de senhas, confirme que a chave continua salva no item original.

---

## Passo 10 — Registrar o resultado no Windows/WSL2

Volte ao Windows e, no Claude Code deste repositório, cole:

```text
Restore feito no Ubuntu.
RUN_ID=<valor do passo 2>
SHA=<valor do passo 2>
Início: <UTC> / <São Paulo>
Fim: <UTC> / <São Paulo>
Ubuntu: <saída de lsb_release -d>
Node: <saída de node --version>
Docker: <saída de docker --version>
<bloco JSON do passo 8>
Dúvidas durante o roteiro: <nenhuma ou quais>
```

Envie o resultado ao agente neste repositório para atualizar a tabela de
evidências, o registro do runbook, o checklist
e o estado do passo 4 do plano.

O ensaio aprova se:

- `publicTables` for maior que zero;
- `rtoMs` for menor que 1.800.000 (30 minutos);
- o container e a pasta tiverem sido removidos.

`rpoMs` só mostra quanto tempo passou entre o backup e o seu restore. O RPO
planejado do Tick é de até 24 horas mais a duração do job, porque o backup roda
uma vez por dia. Falhas do workflow aumentam esse intervalo; a estabilidade com
GHCR é uma verificação pendente no
[plano de implementação](../planning/implementation-plan.md#verificar-o-backup-diário-com-ghcr).

---

## Se der erro no passo 8

| Mensagem                                                       | O que fazer                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Erro: npm nao encontrado no PATH.`                            | Instale o Node.js com npm, abra um novo terminal e volte ao passo 1        |
| `TICK_BACKUP_ENCRYPTION_KEY must have at least 32 characters.` | A chave não foi colada; repita o passo 8 inteiro no mesmo terminal         |
| `Unsupported state or unable to authenticate data`             | Chave diferente da usada no backup; confira o item no gerenciador e repita |
| `Backup archive header is invalid.`                            | Arquivo corrompido; apague `.restore` e repita o passo 5                   |
| `Cannot connect to the Docker daemon`                          | Rode `sudo systemctl start docker` e repita o passo 8                      |
| `Isolated PostgreSQL did not become ready.`                    | Repita o passo 4 e depois o passo 8                                        |
| `toomanyrequests: Data limit exceeded`                         | Limite do registro de imagens; espere alguns minutos e repita o passo 4    |
| erro de `psql` em `roles.sql`, `schema.sql` ou `data.sql`      | Confira com `git rev-parse HEAD` se o SHA é o do passo 2 e repita          |
| `gh run download` sem artefato                                 | O backup expirou; volte ao passo 2 para pegar o mais recente               |

Se a chave não estiver no gerenciador de senhas, o backup não pode ser aberto.
Pare e registre a falha: será preciso gerar chave nova, atualizar o secret
`TICK_BACKUP_ENCRYPTION_KEY` no GitHub e esperar um novo backup.
