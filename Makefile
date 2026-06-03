NPM = npm

.PHONY: help require-npm install dev build start lint typecheck test test-e2e format format-check check clean supabase-link supabase-push supabase-dry-run supabase-types supabase-migrations
.DEFAULT_GOAL := help

help:
	@printf "\n"
	@printf "  %-18s %s\n" "make install" "Instala dependencias do projeto"
	@printf "  %-18s %s\n" "make dev" "Inicia o Next.js em modo desenvolvimento"
	@printf "  %-18s %s\n" "make build" "Gera build de producao com PWA"
	@printf "  %-18s %s\n" "make start" "Inicia o servidor de producao apos o build"
	@printf "  %-18s %s\n" "make lint" "Roda ESLint"
	@printf "  %-18s %s\n" "make typecheck" "Roda TypeScript sem emitir arquivos"
	@printf "  %-18s %s\n" "make test" "Roda testes unitarios e de integracao"
	@printf "  %-18s %s\n" "make test-e2e" "Roda testes end-to-end"
	@printf "  %-18s %s\n" "make format" "Formata o codigo com Prettier"
	@printf "  %-18s %s\n" "make format-check" "Verifica formatacao com Prettier"
	@printf "  %-18s %s\n" "make check" "Roda typecheck, lint, format-check e build"
	@printf "  %-18s %s\n" "make supabase-link" "Vincula o projeto local ao projeto Supabase remoto"
	@printf "  %-18s %s\n" "make supabase-push" "Aplica migrations locais no projeto Supabase remoto"
	@printf "  %-18s %s\n" "make supabase-dry-run" "Mostra quais migrations seriam aplicadas no Supabase"
	@printf "  %-18s %s\n" "make supabase-types" "Gera tipos TypeScript do schema Supabase remoto"
	@printf "  %-18s %s\n" "make supabase-migrations" "Lista migrations locais e remotas do projeto Supabase"
	@printf "  %-18s %s\n" "make clean" "Remove artefatos locais de build"
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

dev: require-npm
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

supabase-link: require-npm
	$(NPM) run supabase:link

supabase-push: require-npm
	$(NPM) run supabase:db:push

supabase-dry-run: require-npm
	$(NPM) run supabase:db:dry-run

supabase-types: require-npm
	$(NPM) run supabase:types

supabase-migrations: require-npm
	$(NPM) run supabase:migration:list

clean: require-npm
	$(NPM) run clean
