NPM = npm

.PHONY: help install dev build start lint typecheck format format-check check clean
.DEFAULT_GOAL := help

help:
	@printf "\n"
	@printf "  %-18s %s\n" "make install" "Instala dependencias do projeto"
	@printf "  %-18s %s\n" "make dev" "Inicia o Next.js em modo desenvolvimento"
	@printf "  %-18s %s\n" "make build" "Gera build de producao com PWA"
	@printf "  %-18s %s\n" "make start" "Inicia o servidor de producao apos o build"
	@printf "  %-18s %s\n" "make lint" "Roda ESLint"
	@printf "  %-18s %s\n" "make typecheck" "Roda TypeScript sem emitir arquivos"
	@printf "  %-18s %s\n" "make format" "Formata o codigo com Prettier"
	@printf "  %-18s %s\n" "make format-check" "Verifica formatacao com Prettier"
	@printf "  %-18s %s\n" "make check" "Roda typecheck, lint, format-check e build"
	@printf "  %-18s %s\n" "make clean" "Remove artefatos locais de build"
	@printf "\n"

install:
	$(NPM) install

dev:
	$(NPM) run dev

build:
	$(NPM) run build

start:
	$(NPM) run start

lint:
	$(NPM) run lint

typecheck:
	$(NPM) run typecheck

format:
	$(NPM) run format

format-check:
	$(NPM) run format:check

check:
	$(NPM) run check

clean:
	$(NPM) run clean
