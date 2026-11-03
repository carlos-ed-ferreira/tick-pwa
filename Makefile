NPM = npm
E2E_PORT = 3100
PLAYWRIGHT_IMAGE = tick-playwright:1.62.1
E2E_CONTAINER = docker run --rm --init --ipc=host --user "$$(id -u):$$(id -g)" --volume "$(CURDIR):/workspace" --workdir /workspace --env HOME=/tmp --env NPM_CONFIG_CACHE=/tmp/npm-cache $(PLAYWRIGHT_IMAGE)

.PHONY: test-e2e-container test-e2e-account-container e2e-container-prepare

e2e-container-prepare:
	docker build --tag $(PLAYWRIGHT_IMAGE) --file docker/playwright.Dockerfile docker

test-e2e-container: e2e-container-prepare
	$(E2E_CONTAINER) make test-e2e

test-e2e-account-container: e2e-container-prepare
	$(E2E_CONTAINER) make test-e2e-account

.PHONY: help require-npm require-free-e2e-port install install-ci add-dependency update-dependency dev build start lint typecheck test test-telemetry test-backup test-account-operations test-account-persistence test-e2e test-e2e-reuse test-e2e-mobile test-e2e-offline test-e2e-account test-e2e-browsers format format-check check audit-prod deps-tree publish clean benchmark-account-rpc backup-encrypt backup-restore supabase-start supabase-start-db supabase-stop supabase-status supabase-reset supabase-diff supabase-diff-check supabase-migration-diff supabase-lint supabase-test-db supabase-types-local supabase-prod-backup supabase-prod-migrations-repair supabase-prod-migrations-check supabase-prod-db-dry-run supabase-prod-db-push
.DEFAULT_GOAL := help

.PHONY: bundle-report

bundle-report: require-npm
	node scripts/measure-bundle.mjs

.PHONY: cohort-status

cohort-status:
	docker ps -a --filter name=tick-cohort- --format '{{.Names}}'
	docker volume ls --filter name=tick-cohort- --format '{{.Name}}'

.PHONY: test-goals test-access-policy test-capacity benchmark-cohort benchmark-cohort-run benchmark-compare supabase-start-account

benchmark-compare: require-npm
	node scripts/compare-benchmark.mjs

test-capacity: require-npm
	$(NPM) run test -- tests/unit/benchmark-statistics.test.mjs

benchmark-cohort: require-npm
	node scripts/benchmark-cohort.mjs

benchmark-cohort-run: require-npm
	NODE_OPTIONS="$${NODE_OPTIONS:+$$NODE_OPTIONS }--experimental-websocket" $(NPM) run supabase:benchmark:account

supabase-start-account: require-npm
	$(NPM) run supabase:start -- -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit

test-goals: require-npm
	$(NPM) run test -- tests/unit/goals-surface.test.tsx tests/unit/goal-

test-access-policy: require-npm
	$(NPM) run test -- tests/integration/guest-access-policy.test.ts tests/integration/scope-isolation.test.ts tests/integration/allowlist.test.ts tests/integration/account-persistence.test.ts

.PHONY: actions-status actions-run operations-issues

actions-status:
	gh run list --repo carlos-ed-ferreira/tick-pwa --limit 15 --json databaseId,name,status,conclusion,headSha,createdAt,url

actions-run:
	@test -n "$(run)" || { printf "Erro: informe run=<run-id>.\n"; exit 2; }
	gh run view "$(run)" --repo carlos-ed-ferreira/tick-pwa --json databaseId,name,headSha,conclusion,url,jobs

operations-issues:
	gh issue list --repo carlos-ed-ferreira/tick-pwa --state open --json number,title,url,labels

.PHONY: backup-image-check

backup-image-check:
	docker run --rm ghcr.io/supabase/postgres:17.6.1.106 pg_dump --version

.PHONY: backup-command-check

backup-command-check: require-npm
	SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io $(NPM) exec -- supabase db dump --local --dry-run

.PHONY: add-dev-dependency

add-dev-dependency: require-npm
	@test -n "$(package)" || { printf "Erro: informe package=<pacote>@<versao>.\n"; exit 2; }
	$(NPM) install --save-dev --save-exact $(package)

.PHONY: dependency-info audit-all

dependency-info: require-npm
	@test -n "$(package)" || { printf "Erro: informe package=<pacote>@<versao>.\n"; exit 2; }
	$(NPM) view $(package) version engines peerDependencies dependencies license --json

audit-all: require-npm
	$(NPM) audit --audit-level=high

.PHONY: test-release-workflow

test-release-workflow: require-npm
	$(NPM) run test -- tests/unit/release-workflow.test.mjs

.PHONY: deploy-hook-status

deploy-hook-status:
	gh api repos/carlos-ed-ferreira/tick-pwa/environments/production/secrets/VERCEL_DEPLOY_HOOK_URL --jq '{name, created_at, updated_at}'

.PHONY: backup-restore-prepare

backup-restore-prepare:
	docker pull public.ecr.aws/supabase/postgres:17.6.1.121
	docker pull public.ecr.aws/supabase/gotrue:v2.197.0
	docker pull docker.io/supabase/storage-api:v1.81.0

.PHONY: backup-status backup-log backup-artifacts backup-key-status

backup-key-status:
	gh api repos/carlos-ed-ferreira/tick-pwa/environments/production/secrets/TICK_BACKUP_ENCRYPTION_KEY --jq '{name, created_at, updated_at}'

backup-status:
	gh run list --repo carlos-ed-ferreira/tick-pwa --workflow production-backup.yml --limit 20 --json databaseId,createdAt,conclusion,headSha,url

backup-log:
	@test -n "$(run)" || { printf "Erro: informe run=<run-id>.\n"; exit 2; }
	gh run view "$(run)" --repo carlos-ed-ferreira/tick-pwa --log-failed

backup-artifacts:
	@test -n "$(run)" || { printf "Erro: informe run=<run-id>.\n"; exit 2; }
	gh api "repos/carlos-ed-ferreira/tick-pwa/actions/runs/$(run)/artifacts" --jq '.artifacts[] | {name, size_in_bytes, expired, expires_at}'

help:
	@printf "  %-26s %s\n" "make bundle-report" "Mede JS bruto/gzip e service worker do build existente"
	@printf "  %-26s %s\n" "make cohort-status" "Confere containers e volumes de benchmarks isolados"
	@printf "  %-26s %s\n" "make benchmark-compare" "Compara o ultimo relatorio com TICK_BENCHMARK_BASELINE; tolerancia de 10%"
	@printf "  %-26s %s\n" "make test-capacity" "Valida estatisticas e limites do benchmark"
	@printf "  %-26s %s\n" "make benchmark-cohort" "Prepara, mede e limpa Supabase isolado com dados sinteticos"
	@printf "  %-26s %s\n" "make benchmark-cohort-run" "Executa o benchmark no ambiente local preparado"
	@printf "  %-26s %s\n" "make supabase-start-account" "Sobe somente banco, Auth, REST e gateway locais"
	@printf "  %-26s %s\n" "make test-goals" "Valida metas, grupos e arvore de etapas"
	@printf "  %-26s %s\n" "make test-access-policy" "Valida isolamento guest e autorizacao de convidados"
	@printf "  %-26s %s\n" "make actions-status" "Consulta as execucoes recentes do GitHub Actions"
	@printf "  %-26s %s\n" "make actions-run run=<run-id>" "Confere jobs e etapas de uma execucao"
	@printf "  %-26s %s\n" "make operations-issues" "Lista issues operacionais abertas"
	@printf "  %-26s %s\n" "make backup-command-check" "Mostra o comando de dump local usando o mirror GHCR"
	@printf "  %-26s %s\n" "make backup-image-check" "Valida pg_dump da imagem oficial GHCR usada pelo backup"
	@printf "  %-26s %s\n" "make add-dev-dependency package=<pacote>" "Adiciona ou atualiza uma dependencia de desenvolvimento"
	@printf "  %-26s %s\n" "make dependency-info package=<pacote>" "Consulta versao, runtime, peers e licenca no registro npm"
	@printf "  %-26s %s\n" "make audit-all" "Audita dependencias de producao e desenvolvimento"
	@printf "  %-26s %s\n" "make test-release-workflow" "Valida a ordem do pipeline e a configuracao Git da Vercel"
	@printf "  %-26s %s\n" "make deploy-hook-status" "Consulta somente os metadados do secret do Deploy Hook"
	@printf "  %-26s %s\n" "make backup-restore-prepare" "Baixa as imagens Postgres, Auth e Storage antes do restore"
	@printf "  %-26s %s\n" "make test-backup-restore" "Testa restore sintetico em container Postgres isolado"
	@printf "  %-26s %s\n" "make backup-key-status" "Consulta somente as datas do secret de cifra do backup"
	@printf "  %-26s %s\n" "make backup-status" "Consulta as ultimas execucoes do backup no GitHub"
	@printf "  %-26s %s\n" "make backup-log run=<run-id>" "Consulta o log de falha do backup no GitHub"
	@printf "  %-26s %s\n" "make backup-artifacts run=<run-id>" "Confere os artefatos e a validade do backup no GitHub"
	@printf "\n"
	@printf "  %-26s %s\n" "make install" "Instala dependencias do projeto"
	@printf "  %-26s %s\n" "make install-ci" "Instala dependencias exatamente como no lockfile"
	@printf "  %-26s %s\n" "make add-dependency package=<pacote>" "Adiciona uma dependencia de producao"
	@printf "  %-26s %s\n" "make update-dependency package=<pacote>" "Atualiza uma dependencia dentro do intervalo declarado"
	@printf "  %-26s %s\n" "make dev" "Instala dependencias, inicia o Supabase local e o Next.js"
	@printf "  %-26s %s\n" "make build" "Gera build de producao com PWA"
	@printf "  %-26s %s\n" "make start" "Inicia o servidor de producao apos o build"
	@printf "  %-26s %s\n" "make lint" "Proibe comentarios de codigo e roda ESLint"
	@printf "  %-26s %s\n" "make typecheck" "Roda TypeScript sem emitir arquivos"
	@printf "  %-26s %s\n" "make test" "Roda testes unitarios e de integracao"
	@printf "  %-26s %s\n" "make test-telemetry" "Roda testes de telemetria e redaction"
	@printf "  %-26s %s\n" "make test-backup" "Roda testes de cifra e integridade do backup"
	@printf "  %-26s %s\n" "make test-account-operations" "Roda testes do contrato transacional"
	@printf "  %-26s %s\n" "make test-account-persistence" "Roda testes da outbox autenticada"
	@printf "  %-26s %s\n" "make test-e2e" "Roda testes end-to-end"
	@printf "  %-26s %s\n" "make test-e2e-reuse" "Roda E2E reaproveitando o servidor; nao serve como evidencia"
	@printf "  %-26s %s\n" "make test-e2e-mobile" "Roda E2E do layout mobile"
	@printf "  %-26s %s\n" "make test-e2e-offline" "Roda E2E de reload offline"
	@printf "  %-26s %s\n" "make test-e2e-account" "Roda E2E autenticado"
	@printf "  %-26s %s\n" "make test-e2e-browsers" "Instala o Chromium do Playwright"
	@printf "  %-26s %s\n" "make test-e2e-container" "Roda E2E na imagem oficial do Playwright"
	@printf "  %-26s %s\n" "make e2e-container-prepare" "Prepara a imagem dos testes E2E"
	@printf "  %-26s %s\n" "make test-e2e-account-container" "Roda E2E autenticado na imagem oficial"
	@printf "  %-26s %s\n" "make format" "Formata o codigo com Prettier"
	@printf "  %-26s %s\n" "make format-check" "Verifica formatacao com Prettier"
	@printf "  %-26s %s\n" "make check" "Roda typecheck, lint, testes, format-check e build"
	@printf "  %-26s %s\n" "make audit-prod" "Audita vulnerabilidades de producao"
	@printf "  %-26s %s\n" "make deps-tree" "Mostra dependencias diretas instaladas"
	@printf "  %-26s %s\n" "make publish" "Publica dev em main pelo fluxo protegido"
	@printf "  %-26s %s\n" "make benchmark-account-rpc" "Mede lotes e concorrencia no Supabase local"
	@printf "  %-26s %s\n" "make backup-encrypt input=<dir> output=<file>" "Criptografa um backup logico"
	@printf "  %-26s %s\n" "make backup-restore archive=<file>" "Restaura e valida backup em Postgres isolado"
	@printf "  %-26s %s\n" "make supabase-start" "Inicia o Supabase local"
	@printf "  %-26s %s\n" "make supabase-start-db" "Inicia apenas o Postgres local"
	@printf "  %-26s %s\n" "make supabase-stop" "Para o Supabase local"
	@printf "  %-26s %s\n" "make supabase-status" "Mostra URLs e chaves do Supabase local"
	@printf "  %-26s %s\n" "make supabase-reset" "Reseta o banco Supabase local com migrations e seed"
	@printf "  %-26s %s\n" "make supabase-diff" "Compara migrations com o schema declarativo"
	@printf "  %-26s %s\n" "make supabase-diff-check" "Falha quando o schema declarativo diverge"
	@printf "  %-26s %s\n" "make supabase-migration-diff name=<nome>" "Gera migration pelo diff declarativo"
	@printf "  %-26s %s\n" "make supabase-lint" "Valida o schema Postgres local"
	@printf "  %-26s %s\n" "make supabase-test-db" "Roda os testes pgTAP do banco"
	@printf "  %-26s %s\n" "make supabase-types-local" "Gera tipos TypeScript do schema Supabase local"
	@printf "  %-26s %s\n" "make supabase-prod-backup" "Gera backup logico de producao no CI"
	@printf "  %-26s %s\n" "make supabase-prod-migrations-repair" "Repara historico remoto no CI"
	@printf "  %-26s %s\n" "make supabase-prod-migrations-check" "Compara historicos local e remoto no CI"
	@printf "  %-26s %s\n" "make supabase-prod-db-dry-run" "Previsualiza migrations remotas no CI"
	@printf "  %-26s %s\n" "make supabase-prod-db-push" "Aplica migrations remotas no CI"
	@printf "  %-26s %s\n" "make clean" "Remove artefatos locais de build"
	@printf "\n"

require-free-e2e-port:
	@if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$(E2E_PORT)[[:space:]]"; then \
		printf "Erro: a porta $(E2E_PORT) esta ocupada.\n"; \
		printf "O gate E2E reconstroi a aplicacao para testar o codigo atual.\n"; \
		printf "Pare o servidor, ou use 'make test-e2e-reuse' para iterar sem evidencia.\n"; \
		exit 2; \
	fi

require-npm:
	@command -v $(NPM) >/dev/null 2>&1 || { \
		printf "Erro: npm nao encontrado no PATH.\n"; \
		printf "Instale Node.js >=20.9.0 com npm antes de rodar este comando.\n"; \
		printf "Veja a secao Requisitos do README.md.\n"; \
		exit 127; \
	}

install: require-npm
	$(NPM) install

install-ci: require-npm
	$(NPM) ci

add-dependency: require-npm
	@test -n "$(package)" || { printf "Erro: informe package=<pacote>@<versao>.\n"; exit 2; }
	$(NPM) install --save-exact $(package)

update-dependency: require-npm
	@test -n "$(package)" || { printf "Erro: informe package=<pacote>.\n"; exit 2; }
	$(NPM) update $(package)

dev: install
	@set -e; \
	if output="$$( $(NPM) run supabase:start 2>&1 )"; then \
		printf "%s\n" "$$output"; \
	else \
		status=$$?; \
		printf "%s\n" "$$output"; \
		if printf "%s\n" "$$output" | grep -q "supabase start is already running" && \
			printf "%s\n" "$$output" | grep -q "container is not ready: starting"; then \
			printf "%s\n" "Supabase local ja esta subindo; mantendo containers e iniciando apenas o frontend."; \
		else \
			exit $$status; \
		fi; \
	fi
	$(NPM) run dev

build: require-npm
	$(NPM) run build

start: require-npm
	$(NPM) run start

lint: require-npm
	$(NPM) run lint

typecheck: require-npm
	$(NPM) run typecheck

test: require-npm
	$(NPM) run test

test-telemetry: require-npm
	$(NPM) run test -- tests/unit/telemetry.test.ts

test-backup: require-npm
	$(NPM) run test -- tests/unit/backup-archive.test.mjs tests/unit/restore-backup.test.mjs

.PHONY: test-backup-restore

test-backup-restore: require-npm
	TICK_TEST_BACKUP_RESTORE=1 $(NPM) run test -- tests/integration/backup-restore.test.mjs

test-account-operations: require-npm
	$(NPM) run test -- tests/unit/account-operations.test.ts

test-account-persistence: require-npm
	$(NPM) run test -- tests/integration/account-persistence.test.ts tests/integration/database-v16-migration.test.ts tests/unit/account-operations.test.ts

test-e2e: require-npm require-free-e2e-port
	$(NPM) run test:e2e

test-e2e-reuse: require-npm
	TICK_E2E_REUSE_SERVER=1 $(NPM) run test:e2e -- $(args)

test-e2e-mobile: require-npm
	$(NPM) run test:e2e -- --project=mobile-chrome tests/e2e/mobile-layout.spec.ts

test-e2e-offline: require-npm
	$(NPM) run test:e2e -- tests/e2e/offline-navigation.spec.ts

test-e2e-account: require-npm
	$(NPM) run test:e2e:account

test-e2e-browsers: require-npm
	$(NPM) run test:e2e:browsers

format: require-npm
	$(NPM) run format

format-check: require-npm
	$(NPM) run format:check

check: require-npm
	$(NPM) run check

audit-prod: require-npm
	$(NPM) run audit:prod

deps-tree: require-npm
	$(NPM) ls --depth=0

publish: require-npm
	$(NPM) run publish

benchmark-account-rpc: supabase-start
	$(MAKE) benchmark-cohort-run

backup-encrypt: require-npm
	@test -n "$(input)" || { printf "Erro: informe input=<diretorio>.\n"; exit 2; }
	@test -n "$(output)" || { printf "Erro: informe output=<arquivo>.\n"; exit 2; }
	$(NPM) run backup:encrypt -- $(input) $(output)

backup-restore: require-npm
	@test -n "$(archive)" || { printf "Erro: informe archive=<arquivo>.\n"; exit 2; }
	$(NPM) run backup:restore -- $(archive)

supabase-start: require-npm
	$(NPM) run supabase:start

supabase-start-db: require-npm
	$(NPM) run supabase:start:db

supabase-stop: require-npm
	$(NPM) run supabase:stop -- $(args)

supabase-status: require-npm
	$(NPM) run supabase:status -- $(args)

supabase-reset: require-npm
	$(NPM) run supabase:db:reset

supabase-diff: require-npm
	$(NPM) run supabase:db:diff

supabase-diff-check: require-npm
	$(NPM) run supabase:db:diff:check

supabase-migration-diff: require-npm
	@test -n "$(name)" || { printf "Erro: informe name=<nome_da_migration>.\n"; exit 2; }
	$(NPM) run supabase:db:diff -- -f $(name)

supabase-lint: require-npm
	$(NPM) run supabase:db:lint

supabase-test-db: require-npm
	$(NPM) run supabase:test:db

supabase-types-local: require-npm
	$(NPM) run supabase:types:local

supabase-prod-backup: require-npm
	$(NPM) run supabase:prod:backup

supabase-prod-migrations-repair: require-npm
	$(NPM) run supabase:prod:migrations:repair

supabase-prod-migrations-check: require-npm
	$(NPM) run supabase:prod:migrations:check

supabase-prod-db-dry-run: require-npm
	$(NPM) run supabase:prod:db:dry-run

supabase-prod-db-push: require-npm
	$(NPM) run supabase:prod:db:push

clean: require-npm
	$(NPM) run clean
