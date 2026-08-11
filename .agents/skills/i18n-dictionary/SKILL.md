---
name: i18n-dictionary
description: >-
  Adicionar, alterar ou revisar textos traduzíveis nos dicionários tipados pt-BR e en do Tick. Usar em novas strings de produto, mensagens, labels, pluralização, interpolação, terminologia ou fallback de locale.
---

# I18n dictionary

## Localizar o contrato

1. Ler as regras de i18n em `../../../AGENTS.md` e os gates em
   `../../../REVIEW.md`.
2. Localizar a seção correspondente em
   `src/lib/i18n/dictionaries/types.ts`, `pt-BR.ts` e `en.ts`.
3. Procurar chave ou terminologia equivalente antes de criar outra.
4. Confirmar se o texto é de produto, termo técnico ou conteúdo do usuário.

## Alterar os dicionários

1. Criar chave semântica baseada na intenção, não no texto literal ou na
   posição visual.
2. Atualizar o tipo e os dois idiomas na mesma alteração.
3. Preservar a terminologia canônica de tarefa, subtarefa, grupo de metas, meta,
   etapa e subetapa.
4. Modelar interpolação e pluralização explicitamente quando valores variarem.
5. Não concatenar fragmentos traduzidos para formar frases.
6. Não traduzir identificadores, nomes técnicos ou conteúdo informado pelo
   usuário.
7. Manter fallback e locale padrão existentes, salvo decisão de produto
   explícita.

## Integrar

Obter o dicionário pelo mecanismo oficial e evitar strings traduzíveis soltas
em componentes. Para datas, números e horários, reutilizar formatadores e
helpers timezone-aware de `src/lib/time` e `src/lib/i18n`.

## Validar

1. Rodar testes direcionados e `npm run typecheck` para provar paridade de
   shape.
2. Renderizar os dois idiomas no fluxo afetado.
3. Verificar conteúdo longo, placeholders, pluralização e interpolação.
4. Confirmar ausência de chave faltante e de nova string fora do dicionário.
5. Rodar E2E quando o texto alterar layout, navegação ou fluxo crítico.
