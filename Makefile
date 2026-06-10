NPM = npm

.PHONY: help require-npm install dev build start lint typecheck test test-e2e format format-check check clean supabase-start supabase-stop supabase-status supabase-reset supabase-types-local
.DEFAULT_GOAL := help

help:
	@printf "\n"
	@printf "  %-26s %s\n" "make install" "Instala dependencias do projeto"
	@printf "  %-26s %s\n" "make dev" "Instala dependencias, inicia o Supabase local e o Next.js"
	@printf "  %-26s %s\n" "make build" "Gera build de producao com PWA"
	@printf "  %-26s %s\n" "make start" "Inicia o servidor de producao apos o build"
	@printf "  %-26s %s\n" "make lint" "Roda ESLint"
	@printf "  %-26s %s\n" "make typecheck" "Roda TypeScript sem emitir arquivos"
	@printf "  %-26s %s\n" "make test" "Roda testes unitarios e de integracao"
	@printf "  %-26s %s\n" "make test-e2e" "Roda testes end-to-end"
	@printf "  %-26s %s\n" "make format" "Formata o codigo com Prettier"
	@printf "  %-26s %s\n" "make format-check" "Verifica formatacao com Prettier"
	@printf "  %-26s %s\n" "make check" "Roda typecheck, lint, format-check e build"
	@printf "  %-26s %s\n" "make supabase-start" "Inicia o Supabase local"
	@printf "  %-26s %s\n" "make supabase-stop" "Para o Supabase local"
	@printf "  %-26s %s\n" "make supabase-status" "Mostra URLs e chaves do Supabase local"
	@printf "  %-26s %s\n" "make supabase-reset" "Reseta o banco Supabase local com migrations e seed"
	@printf "  %-26s %s\n" "make supabase-types-local" "Gera tipos TypeScript do schema Supabase local"
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

test-e2e: require-npm
	$(NPM) run test:e2e

format: require-npm
	$(NPM) run format

format-check: require-npm
	$(NPM) run format:check

check: require-npm
	$(NPM) run check

supabase-start: require-npm
	$(NPM) run supabase:start

supabase-stop: require-npm
	$(NPM) run supabase:stop

supabase-status: require-npm
	$(NPM) run supabase:status

supabase-reset: require-npm
	$(NPM) run supabase:db:reset

supabase-types-local: require-npm
	$(NPM) run supabase:types:local

clean: require-npm
	$(NPM) run clean
