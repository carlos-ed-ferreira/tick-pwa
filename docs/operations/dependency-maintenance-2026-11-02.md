# Manutenção de dependências e operação em 2026-11-02

## Escopo e resultado

A preparação do restore em outra máquina e do deploy ordenado revelou um
ambiente local fora do lockfile e advisories novos. A manutenção preserva o
modelo local-first, os dados, a UI e a CLI Supabase 2.98.2. Nenhuma migration
foi criada ou aplicada em produção. As alterações estão sem commit/publicação.

## Atualizações revisadas

| Pacote                          | Antes                              | Depois | Motivo e alcance                                                        |
| ------------------------------- | ---------------------------------- | ------ | ----------------------------------------------------------------------- |
| next                            | 16.3.6 declarado; 16.3.0 instalado | 16.4.4 | Correções de segurança de runtime                                       |
| eslint-config-next              | 16.3.0                             | 16.4.4 | Compatibilidade com o framework                                         |
| @playwright/test                | 1.60.0                             | 1.62.1 | Compatibilidade com a imagem oficial disponível e suporte ao host atual |
| vitest / @vitest/mocker         | 4.1.6                              | 4.1.12 | Correções sem migrar para major 5                                       |
| vite                            | 8.0.12                             | 8.3.5  | Correções transitivas de desenvolvimento                                |
| @babel/core                     | 7.29.0                             | 7.29.7 | Correção transitiva de desenvolvimento                                  |
| sharp                           | 0.35.4                             | 0.35.5 | Correção transitiva de produção                                         |
| source-map-js                   | 1.2.1                              | 1.2.2  | Correção transitiva                                                     |
| js-yaml                         | 4.1.1                              | 4.3.2  | Correções transitivas                                                   |
| undici                          | 7.25.0                             | 7.30.1 | Correções transitivas                                                   |
| glob, somente consumidor 13.0.6 | 13.0.6                             | 14.0.3 | Evitar minimatch vulnerável no build do Serwist                         |
| zod 4.x                         | resolução vulnerável               | 4.6.7  | Correção transitiva de produção                                         |
| tar, somente consumidor 7.5.13  | 7.5.13                             | 7.5.22 | Corrigir instalação da CLI sem migrar para Supabase 3                   |
| brace-expansion 1.x             | resolução vulnerável               | 1.1.21 | Correção compatível com consumidores legados                            |

Foram preservados os overrides existentes de browserslist 4.29.0 e postcss
8.5.23. Metadados npm, engines, peers e licenças foram consultados antes das
alterações. Next, ESLint, Vitest e Zod usam MIT; Playwright usa Apache-2.0;
Sharp usa Apache-2.0; source-map-js usa BSD-3-Clause; glob e tar usam
BlueOak-1.0.0. Os requisitos atuais de desenvolvimento são Node 20.19+ ou
22.12+; o host usa 20.20.2, e a máquina do restore usou 22.21.1.

O override major de glob é restrito a 13.0.6. O consumidor Serwist usa a API
pública globSync com cwd, follow, ignore e nodir. A
[mudança upstream](https://github.com/isaacs/node-glob/blob/main/changelog.md)
remove APIs internas de Pattern e opções de depuração; não foi preciso mudar
consumidores. Build PWA e testes offline são a validação do caminho afetado.
A revisão humana dessa exceção deve acompanhar a publicação.

O [advisory do Next](https://github.com/advisories/GHSA-673q-mjm6-r5xr) e as
[notas da versão 16.4.4](https://github.com/vercel/next.js/releases/tag/v16.4.4)
fundamentam a atualização do framework. O
[advisory do Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) fundamenta
sua resolução corrigida.

## Auditoria e limitações

`make audit-prod`: zero vulnerabilidades. `make audit-all`: zero altas ou
críticas, com 16 moderadas na cadeia minimatch das ferramentas ESLint. A
migração dessas cadeias exige compatibilidade com a API legada; não foi imposto
minimatch 11 a consumidores incompatíveis. A sugestão automática de downgrade
para ESLint 4 não foi aplicada. Não foi usado audit fix --force.

`make install-ci` e `make deps-tree` verificaram a resolução do lockfile. A
normalização por `make format` corrigiu finais de linha CRLF sem redesenhar ou
reescrever componentes. Tipos antigos da rota removida do PowerSync foram
removidos por `make clean`; a dependência Sentry existente voltou pela instalação
coerente. Avisos não bloqueantes do Vite sobre futuro carregamento de config não
foram mascarados.

## Validação

- `make check`: tipos, lint, 636 testes aprovados, um teste Docker opt-in
  ignorado, formatação e build Next/PWA aprovados.
- `make test-e2e-container`: 41 aprovados e 19 ignorados, incluindo reload offline.
- `make test-e2e-account-container`: quatro testes aprovados, incluindo
  interação com Supabase simulado lento e retry após reconexão em desktop e mobile.
- `make test-release-workflow`: cinco testes aprovados.
- `make test-backup-restore`: restore Docker de conteúdo sintético aprovado,
  incluindo schema Tick, Auth, Storage e claims JWT.
- Banco em projeto e portas isolados: `make supabase-reset`,
  `make supabase-lint`, `make supabase-diff-check` e `make supabase-test-db`
  aprovados; 50 testes pgTAP, sem divergência declarativa.
- `make backup-image-check`: pg_dump 17.6 na imagem GHCR da CLI.
- `make backup-command-check`: dump local em dry-run aprovado.

Os comandos de banco foram executados em cópia temporária com project_id
`tick-validation-20261102` e portas 55320–55329. Não houve reset do banco de
trabalho nem acesso a dados de produção. O teste de restore usa dados fictícios.
Ao terminar, `make supabase-stop args=--no-backup` removeu os recursos isolados
e a cópia temporária foi excluída.

O primeiro E2E no host não abriu o Chromium por ausência de libnspr4.so;
o instalador de Playwright 1.60 não suportava Ubuntu 26.04 e sudo exigia
interação. Os targets Docker preparam a
[imagem oficial](https://playwright.dev/docs/docker) correspondente ao pacote
1.62.1, acrescentam GNU Make e executam builds e testes com UID/GID local.
Não há reaproveitamento de servidor ou relaxamento de asserções.

Não foi medida uma comparação percentual de bundle com um build anterior
coerente; não se declara ganho ou equivalência percentual de performance.

## Rollback e responsabilidade externa

As alterações locais são reversíveis antes da publicação. Um rollback de
manifest deve restaurar package.json e package-lock.json coerentes, seguido de
`make install-ci` e dos gates. Não usar downgrade automático de ESLint nem
reintroduzir um Next vulnerável em produção. Para falha após release, seguir
o rollback compensatório do runbook e escolher uma versão corrigida validada.

O proprietário controla commit/publicação. Depois dela, ainda é necessário
observar App CI, migrations e Deploy Hook no mesmo SHA; confirmar um único
deployment Production Ready na Vercel; executar smoke funcional e conferir o
backup cifrado de uma execução com o novo workflow. A mitigação GHCR não é
prova de estabilidade diária antes dessa observação. Nenhuma nova prova com
segunda pessoa é exigida; restore em dois dispositivos e limpeza já passaram.
