---
name: frontend-design
description: >-
  Projetar, implementar ou revisar interfaces do Tick preservando os padrões visuais, os componentes, a acessibilidade e a composição desktop/toque. Usar em telas, componentes, formulários, menus, modais e interações visuais.
---

# Frontend design do Tick

## Escolher as referências

Leia [AGENTS](../../../AGENTS.md) para autoridade e limites e [REVIEW](../../../REVIEW.md#revisão-visual) para aceitação. Consulte os [padrões visuais](references/PADROES-VISUAIS.md) nas famílias afetadas e o [mapa de telas](references/MAPA-DE-TELAS.md) para localizar implementações equivalentes. A arquitetura está em [Arquitetura](../../../docs/development/ARQUITETURA.md).

Esta skill reúne decisão de desenho, implementação e revisão. Na tarefa normal, examine o contexto afetado; a auditoria completa do sistema não é requisito para cada edição. Siga o escopo pedido e preserve o desenho desktop quando a mudança for de adaptação mobile.

## Enquadrar e decidir

1. Identifique objetivo, ação principal, dados e contexto de uso da superfície.
2. Localize o primitive, token ou composição equivalente antes de criar outro.
3. Defina hierarquia, densidade, estados e diferenças desktop/toque com conteúdo real, inclusive vazio e texto longo.
4. Registre escolhas que mudem composição, interação ou semântica. Uma exceção precisa de justificativa funcional; repetição acidental no código não cria um padrão.

## Implementar com o padrão existente

- Use o tema escuro único, a escala quente de âmbar e os neutros existentes.
- Componha com superfícies e sombra; campos e seletores têm rings próprios. Evite caixas aninhadas que não representam um novo contexto.
- Use controles preenchidos: pill com texto, redondo só com ícone. Escolha a variante por papel, não por preferência da tela.
- Em formulários, use `FormField`/`FormTextareaField`, `noValidate` e feedback do app. Edição inline mantém input simples.
- Todo texto truncável oferece conteúdo integral no `Tooltip`, acessível por mouse e teclado; use `whenTruncated` quando o tooltip repete o texto. Tooltip de ação descreve a ação; a identidade do item fica no nome acessível.
- Reutilize sem forçar equivalência semântica. Extraia componentes por responsabilidade ou repetição real; uma tela isolada não justifica uma arquitetura paralela.
- Preserve domínio e dados entre composições. Mudanças comportamentais seguem a skill [TDD](../tdd-change/SKILL.md); persistência segue [Local-first](../local-first-change/SKILL.md); textos novos seguem [i18n](../i18n-dictionary/SKILL.md).

## Adaptar ao toque

A base nova corresponde ao desktop atual; `touch:` aplica os overrides de composição. A consulta canônica é `(pointer: coarse) and (max-width: 899.98px)` em `useTouchComposition` e `globals.css`. Use `useCoarsePointer` para capacidade de interação e largura medida para densidade.

Nunca misture `sm:` e `touch:` na mesma propriedade nova. Composições legadas continuam restaurando o desenho desktop por `sm:`. Preserve o desenho existente de 640px para cima com ponteiro fino.

`useTouchComposition` escolhe DOM diferente somente quando necessário e dentro de caixa com altura já fixada nos dois ramos; o chrome da página muda por CSS para evitar deslocamento na hidratação. Alvos menores que 44px usam `touch-target`, ampliando a área de acerto, não o tamanho pintado. Arrasto e hover precisam de alternativa no toque. Preserve safe areas, espaço do rodapé, rolagem e recuperação de foco.

## Revisar e validar

Compare a alteração com as referências da mesma família, diferenciando padrão, exceção e divergência. Exercite teclado, foco, toque, rolagem, dois idiomas, conteúdo longo e estados aplicáveis; screenshot isolada não comprova interação nem conta offline.

Use a matriz do REVIEW para selecionar os gates. Durante ajustes comportamentais, use `make test-file files="<arquivos>"`; ao concluir implementação, `make check` uma vez. Layout ou fluxo alterado exige E2E desktop/mobile; adaptação ao toque inclui `make test-e2e-mobile`. Execute sem paralelismo com build/check. Mudança documental segue os gates documentais.

A evidência de uma auditoria fica na entrega e em artefatos temporários. Pendências reais entram somente em [PENDENCIAS](../../../docs/planning/PENDENCIAS.md), com origem, estado e critério de resolução. O mapa permanente descreve superfícies e regras atuais, sem histórico de resultados.
