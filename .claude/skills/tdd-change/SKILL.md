---
name: tdd-change
description: >-
  Executar mudanças comportamentais do Tick com RED, GREEN e REFACTOR. Usar em features, bugfixes, regras de domínio, validações e refatorações que alterem comportamento observável.
---

# TDD change

## Preparar

1. Ler `../../../AGENTS.md` e os gates aplicáveis em `../../../REVIEW.md`.
2. Localizar o comportamento, seus consumidores, testes e implementações
   semelhantes.
3. Definir uma única expectativa observável e escolher o nível mais baixo que
   ainda prove o contrato: unitário, integração, banco ou E2E.
4. Identificar riscos de escopo, persistência, autorização, offline, i18n e UI.

## RED

1. Criar ou ajustar primeiro o menor teste representativo.
2. Usar dados isolados, sem PII, secrets ou produção.
3. Executar somente o teste direcionado.
4. Confirmar que ele falha pela ausência do comportamento, não por setup,
   import, mock ou expectativa incorreta.
5. Para bugfix, preservar a reprodução como teste de regressão.

Não prosseguir se o teste já passar sem a mudança; corrigir o recorte do teste
ou demonstrar que o comportamento não é testável naquele nível.

## GREEN

1. Implementar somente o necessário para satisfazer o contrato.
2. Preservar arquitetura, linguagem de domínio e padrões existentes.
3. Não enfraquecer a expectativa, ampliar mocks nem alterar dados apenas para
   produzir verde.
4. Executar novamente o teste direcionado e os testes imediatamente afetados.

## REFACTOR

1. Remover duplicação e responsabilidades misturadas.
2. Melhorar nomes, tipos e coesão sem adicionar comentários ao código.
3. Evitar abstração preventiva e mudanças fora do escopo.
4. Reexecutar os testes após cada refatoração significativa.

## Concluir

1. Executar a matriz aplicável do `REVIEW.md`.
2. Rodar `npm run check` para mudança ampla; rodar E2E e banco quando o REVIEW
   exigir.
3. Revisar o diff por ruído, logs, código morto e regressão de baseline.
4. Informar evidência RED/GREEN, gates aprovados, gates omitidos e problemas
   preexistentes.
