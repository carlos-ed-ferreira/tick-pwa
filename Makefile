NPM = npm

.PHONY: help require-npm install install-ci dev build start lint typecheck test test-account-operations test-account-persistence test-powersync test-e2e test-e2e-offline test-e2e-account format format-check check audit-prod deps-tree publish clean supabase-start supabase-stop supabase-status supabase-reset supabase-diff supabase-diff-check supabase-migration-diff supabase-lint supabase-test-db supabase-types-local supabase-prod-migrations-repair supabase-prod-db-dry-run supabase-prod-db-push
.DEFAULT_GOAL := help

help:
	@printf "\n"
	@printf "  %-26s %s\n" "make install" "Instala dependencias do projeto"
	@printf "  %-26s %s\n" "make install-ci" "Instala dependencias exatamente como no lockfile"
	@printf "  %-26s %s\n" "make dev" "Instala dependencias, inicia o Supabase local e o Next.js"
	@printf "  %-26s %s\n" "make build" "Gera build de producao com PWA"
	@printf "  %-26s %s\n" "make start" "Inicia o servidor de producao apos o build"
	@printf "  %-26s %s\n" "make lint" "Proibe comentarios de codigo e roda ESLint"
	@printf "  %-26s %s\n" "make typecheck" "Roda TypeScript sem emitir arquivos"
	@printf "  %-26s %s\n" "make test" "Roda testes unitarios e de integracao"
	@printf "  %-26s %s\n" "make test-account-operations" "Roda testes do contrato transacional"
	@printf "  %-26s %s\n" "make test-account-persistence" "Roda testes da outbox autenticada"
	@printf "  %-26s %s\n" "make test-powersync" "Roda testes direcionados do POC PowerSync"
	@printf "  %-26s %s\n" "make test-e2e" "Roda testes end-to-end"
	@printf "  %-26s %s\n" "make test-e2e-offline" "Roda E2E de reload offline"
	@printf "  %-26s %s\n" "make test-e2e-account" "Roda E2E autenticado"
	@printf "  %-26s %s\n" "make format" "Formata o codigo com Prettier"
	@printf "  %-26s %s\n" "make format-check" "Verifica formatacao com Prettier"
	@printf "  %-26s %s\n" "make check" "Roda typecheck, lint, testes, format-check e build"
	@printf "  %-26s %s\n" "make audit-prod" "Audita vulnerabilidades de producao"
	@printf "  %-26s %s\n" "make deps-tree" "Mostra dependencias diretas instaladas"
	@printf "  %-26s %s\n" "make publish" "Publica dev em main pelo fluxo protegido"
	@printf "  %-26s %s\n" "make supabase-start" "Inicia o Supabase local"
	@printf "  %-26s %s\n" "make supabase-stop" "Para o Supabase local"
	@printf "  %-26s %s\n" "make supabase-status" "Mostra URLs e chaves do Supabase local"
	@printf "  %-26s %s\n" "make supabase-reset" "Reseta o banco Supabase local com migrations e seed"
	@printf "  %-26s %s\n" "make supabase-diff" "Compara migrations com o schema declarativo"
	@printf "  %-26s %s\n" "make supabase-diff-check" "Falha quando o schema declarativo diverge"
	@printf "  %-26s %s\n" "make supabase-migration-diff name=<nome>" "Gera migration pelo diff declarativo"
	@printf "  %-26s %s\n" "make supabase-lint" "Valida o schema Postgres local"
	@printf "  %-26s %s\n" "make supabase-test-db" "Roda os testes pgTAP do banco"
	@printf "  %-26s %s\n" "make supabase-types-local" "Gera tipos TypeScript do schema Supabase local"
	@printf "  %-26s %s\n" "make supabase-prod-migrations-repair" "Repara historico remoto no CI"
	@printf "  %-26s %s\n" "make supabase-prod-db-dry-run" "Previsualiza migrations remotas no CI"
	@printf "  %-26s %s\n" "make supabase-prod-db-push" "Aplica migrations remotas no CI"
	@printf "  %-26s %s\n" "make clean" "Remove artefatos locais de build"
	@printf "\n"

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

test-account-operations: require-npm
	$(NPM) run test -- tests/unit/account-operations.test.ts

test-account-persistence: require-npm
	$(NPM) run test -- tests/integration/account-persistence.test.ts tests/integration/database-v16-migration.test.ts tests/unit/account-operations.test.ts

test-powersync: require-npm
	$(NPM) run test -- tests/unit/powersync-poc.test.ts tests/unit/powersync-poc-surface.test.tsx

test-e2e: require-npm
	$(NPM) run test:e2e

test-e2e-offline: require-npm
	$(NPM) run test:e2e -- tests/e2e/offline-navigation.spec.ts

test-e2e-account: require-npm
	$(NPM) run test:e2e:account

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

supabase-start: require-npm
	$(NPM) run supabase:start

supabase-stop: require-npm
	$(NPM) run supabase:stop

supabase-status: require-npm
	$(NPM) run supabase:status

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

supabase-prod-migrations-repair: require-npm
	$(NPM) run supabase:prod:migrations:repair

supabase-prod-db-dry-run: require-npm
	$(NPM) run supabase:prod:db:dry-run

supabase-prod-db-push: require-npm
	$(NPM) run supabase:prod:db:push

clean: require-npm
	$(NPM) run clean
