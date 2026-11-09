# Dependências e manutenção

## Fontes e comandos

`package.json` declara dependências e overrides; `package-lock.json` fixa a
resolução reproduzível. Os requisitos de Node e as versões principais estão
no README. O Makefile é a interface de instalação, consulta, atualização e gates.

```sh
make install-ci
make deps-tree
make audit-prod
make audit-all
make dependency-info package=<pacote>@<versao>
```

Uma auditoria informa a situação do registro no momento em que roda; este guia
não guarda contagens históricas de vulnerabilidades nem resultados de releases.
O gate de produção rejeita severidade alta ou crítica. Advisory de ferramentas
é classificado pelo alcance e compatibilidade sem aplicar downgrade automático.

## Falha transitória na instalação da CLI

`make install-ci` executa `scripts/install-ci.mjs`, que mantém `npm ci`, o
lockfile e os scripts de instalação originais. O script preserva a saída do
processo e examina somente o trecho final para classificar a falha.
Quando o erro identifica o postinstall de `node_modules/supabase`, a origem
GitHub Releases da CLI e um sinal transitório, repete a instalação: no máximo
três tentativas, com esperas de 5 e 10 segundos.

Os sinais recuperáveis incluem HTTP 500/502/503/504, falhas transitórias de rede
e arquivo gzip inválido ou incompleto. Erros explícitos de checksum ou
integridade, permissão, autenticação, recurso ausente, plataforma não suportada,
lockfile inválido, outro pacote ou erro desconhecido não recebem retry.
Interrupção por sinal também encerra o processo. Ao esgotar as tentativas, o
comando continua falhando com o status da última instalação.

Cada retry executa um `npm ci` novo, que remove a instalação parcial e reinstala
pelo lockfile. Não desabilita scripts nem verificações do instalador, não
atualiza versões e não repete comandos de banco ou publicação. Uma
indisponibilidade persistente do GitHub ainda exige aguardar a recuperação e
retomar explicitamente o fluxo afetado. Todos os jobs que usam `make install-ci`
recebem essa recuperação, incluindo CI, publicação e backup.

## Overrides atuais

| Consumidor/resolução     | Override |
| ------------------------ | -------- |
| `browserslist`           | `4.29.0` |
| `postcss`                | `8.5.23` |
| `glob@13.0.6`            | `14.0.3` |
| `zod@>=4 <5`             | `4.6.7`  |
| `tar@7.5.13`             | `7.5.22` |
| `brace-expansion@^1.1.0` | `1.1.21` |
| `qs`                     | `6.17.1` |

O override major de glob está restrito ao consumidor `13.0.6`; Serwist usa
`globSync` na geração de assets da PWA. Build e reload offline exercitam esse
caminho. Não estender overrides de major a consumidores sem revisar a API.

O override `qs` corrige advisories de parsing/stringify no cliente HTTP
transitivo do Stryker, dentro do major 6. A licença é BSD-3-Clause; ele permanece
restrito às ferramentas de desenvolvimento. As ferramentas de cobertura V8,
Stryker 9 e axe Playwright também são dependências de desenvolvimento, sem
entrada no bundle do produto. Suas versões preservam o contrato Node do projeto.

## Procedimento de mudança

1. Classificar dependência direta/transitiva, produção/desenvolvimento, advisory,
   severidade, alcance, licença, manutenção e compatibilidade de runtime/peers.
2. Ler changelog e preparar mudança dedicada, preservando o intervalo aprovado.
3. Alterar pelos targets `make add-dependency`, `make add-dev-dependency` ou
   `make update-dependency`, conforme o caso.
4. Revisar manifest e lockfile sem pacotes inesperados ou scripts novos não avaliados.
5. Executar `make check`, audit e os gates do caminho afetado definidos no REVIEW.
6. Em PWA, executar build e E2E offline; em CLI/schema, usar ambiente isolado.
7. Entregar justificativa, versões, evidências e rollback na revisão da mudança.

Não usar `--force`, audit fix destrutivo nem reintroduzir versão vulnerável
para satisfazer a ferramenta. Major exige revisão humana. Atualizar Supabase
CLI não autoriza gerar nem aplicar migrations.

## E2E e rollback

Os targets E2E em container usam a imagem Playwright correspondente ao pacote,
GNU Make e UID/GID local. Não executar builds/E2E simultâneos no mesmo checkout.
O gate normal reconstrói a aplicação; `make test-e2e-reuse` serve à iteração e
não comprova o código atual.

Rollback de dependências restaura manifest/lockfile coerentes, reinstala por
`make install-ci` e repete os gates. A escolha de versão deve manter as correções
de segurança exigidas. Publicação e rollback remoto dependem de autorização
explícita do proprietário no turno atual.
