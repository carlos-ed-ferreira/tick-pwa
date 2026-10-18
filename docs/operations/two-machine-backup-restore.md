# Roteiro: restore do backup na máquina Ubuntu

Você vai provar que o backup de produção abre em outra máquina. Tudo acontece
no **Ubuntu**. O Windows/WSL2 só é usado no final, para registrar o resultado.
Nada aqui toca a produção.

Tempo estimado: 20 minutos.

---

## Passo 1 — Abrir o terminal no Ubuntu

Abra o terminal no Ubuntu. Todos os comandos dos passos 1 a 9 são colados nele.
Use **o mesmo terminal** do passo 2 até o passo 9: os valores `RUN_ID` e `SHA`
se perdem se ele for fechado. Se fechar, repita a partir do passo 2.

Confira as ferramentas:

```bash
git --version && node --version && npm --version && docker info --format '{{.ServerVersion}}' && gh auth status
```

Deve aparecer, nesta ordem: versão do Git, Node `v20.9` ou maior, versão do npm,
versão do Docker e `Logged in to github.com`.

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

## Passo 4 — Baixar a imagem do Postgres

```bash
docker pull public.ecr.aws/supabase/postgres:17.6.1.121
```

Espere terminar. Isso fica fora do tempo medido.

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
cd ~ && rm -rf ~/tick-restore-check
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

Com isso, eu atualizo a tabela de evidências, o registro do runbook, o checklist
e o estado do passo 4 do plano.

O ensaio aprova se:

- `publicTables` for maior que zero;
- `rtoMs` for menor que 1.800.000 (30 minutos);
- o container e a pasta tiverem sido removidos.

`rpoMs` só mostra quanto tempo passou entre o backup e o seu restore. O RPO
real do Tick é de até 24 horas mais a duração do job, porque o backup roda uma
vez por dia.

Como foi você quem fez os dois lados, o item **Ensaio de independência com
segunda pessoa** continua aberto até outra pessoa repetir este roteiro.

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
| erro de `psql` em `roles.sql`, `schema.sql` ou `data.sql`      | Confira com `git rev-parse HEAD` se o SHA é o do passo 2 e repita          |
| `gh run download` sem artefato                                 | O backup expirou; volte ao passo 2 para pegar o mais recente               |

Se a chave não estiver no gerenciador de senhas, o backup não pode ser aberto.
Pare e me avise: será preciso gerar chave nova, atualizar o secret no GitHub e
esperar um novo backup.
