---
name: ui-consistency
description: >-
  Preservar a linguagem visual, componentização, mobile-first, acessibilidade e responsividade do Tick. Usar ao criar ou alterar componentes, telas, formulários, menus, modais, árvores ou interações visuais.
---

# UI consistency

## Descobrir o padrão

1. Ler as regras de UI em `../../../AGENTS.md` e os critérios visuais em
   `../../../REVIEW.md`.
2. Localizar telas semelhantes, primitives em `src/components/ui`, componentes
   em `src/components/app`, tokens e testes visuais próximos.
3. Inspecionar variantes antes de criar componente ou classe nova.
4. Preservar terminologia, densidade, tipografia, cores, espaçamento e padrões
   de interação.

Não redesenhar áreas não solicitadas. Não forçar reutilização entre elementos
semanticamente diferentes.

## Projetar mobile-first

1. Definir hierarquia, ação principal e touch targets no viewport pequeno.
2. Avaliar teclado virtual, scroll, overflow, conteúdo longo e orientação.
3. Expandir para desktop sem prejudicar o fluxo mobile.
4. Criar composição mobile própria quando comprimir desktop não atender à
   experiência.
5. Preservar semântica e regra de negócio entre layouts.

## Adaptar para mobile sem alterar o desktop

O desenho desktop existente é intocável. Toda adaptação mobile usa os sinais já
adotados pelo projeto, nunca breakpoints novos que mudem 640px para cima:

- `(pointer: coarse)` em CSS, ou o hook `useCoarsePointer`, para interação e
  área de toque;
- largura medida em runtime, quando o layout já mede o container, para
  densidade.

Regras práticas:

- ao escrever utilitário mobile, restaure o valor desktop atual em `sm:`;
- alvo de toque mínimo de 44px vem de `touch-target`, que amplia só a área de
  acerto e não altera o tamanho pintado do controle;
- interação por arrasto precisa de caminho equivalente no toque;
- conteúdo que depende de hover precisa de alternativa no toque;
- tooltip continua acessível por mouse, teclado e toque longo;
- respeite `env(safe-area-inset-*)` nas superfícies de borda com
  `.app-safe-padding`.

Registre a evidência mobile com `make test-e2e-mobile`.

## Compor a interface

- Preferir primitives e composição existentes.
- Extrair componente apenas por reutilização, responsabilidade visual clara ou
  ganho de legibilidade/testabilidade.
- Preferir espaço, alinhamento, contraste e tipografia a bordas.
- Evitar caixas excessivas, cards para cada bloco e cards aninhados.
- Usar superfícies e rings existentes; usar `DashedRing` para traço.
- Usar `noValidate` e feedback do app em formulários controlados.
- Não usar alert, confirm ou prompt nativos.
- Preservar foco, nome acessível, teclado, semântica e contraste.
- Enviar strings traduzíveis pelos dicionários `pt-BR` e `en`.

## Validar

Testar pelo menos mobile e desktop, além de loading, vazio, erro, conteúdo
longo, overflow, teclado e touch. Exercitar interação; não depender apenas de
screenshot. Executar unit/component e E2E aplicáveis, revisar consistência
visual e registrar a evidência solicitada no REVIEW.
