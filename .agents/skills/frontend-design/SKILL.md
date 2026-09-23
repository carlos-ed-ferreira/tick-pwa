---
name: frontend-design
description: >-
  Decidir o desenho visual de telas, fluxos e superfícies novas do Tick antes de implementar. Usar ao projetar layout, hierarquia, uso de cor, tipografia, densidade, estados e paleta.
---

# Frontend design

Esta Skill cobre a decisão de desenho. A execução, o reuso de primitives, a
acessibilidade e a validação final seguem a Skill `ui-consistency`.

## Enquadrar antes de desenhar

1. Nomear o objetivo da tela, a ação principal e a decisão que o usuário toma
   nela.
2. Listar os dados reais, incluindo o caso vazio, o caso denso e o texto longo.
3. Ler as regras de UI em `../../../AGENTS.md` e os critérios de
   `Revisão visual` em `../../../REVIEW.md`.
4. Procurar tela equivalente já existente e reaproveitar sua estrutura antes de
   propor uma nova.

Não redesenhar áreas não solicitadas. Uma feature isolada não justifica uma
linguagem visual paralela.

## Compor a hierarquia

- Estabelecer a ordem de leitura com espaço, alinhamento, tamanho e contraste
  antes de recorrer a borda, caixa ou card.
- Containers de tarefas, etapas, metas e grupos usam superfície e sombra, sem
  borda padrão: `card-surface`, `card-surface-soft`, `card-surface-strong`,
  `modal-surface` e `modal-panel`.
- Quando um traço for necessário, usar os rings existentes; para traço
  interrompido, `DashedRing`.
- Evitar cards aninhados e uma caixa por bloco de conteúdo.
- Uma ação primária por contexto; o resto é secundário ou apenas ícone.

## Decidir tipografia e densidade

- Usar o primitive `Text` e suas variantes de `size`, `tone`, `weight` e
  `leading` em vez de classes soltas.
- Diferenciar nível por peso e tom antes de aumentar o tamanho.
- Texto de apoio usa `tone="muted"`; não criar cinzas fora dos tokens.
- Definir a densidade pelo conteúdo real, não pelo mockup vazio.
- Todo texto que possa truncar expõe o conteúdo completo em `Tooltip` com
  `whenTruncated`; rótulo apenas de ícone usa tooltip sempre visível.

## Usar a paleta

Os tokens de `src/app/globals.css` são a fonte da paleta, nos dois esquemas de
cor. Restrições permanentes:

- o âmbar `#f0c38e` e sua escala quente são fixos;
- escuros e neutros saem do hue 212°, complementar do âmbar;
- roxo e teal foram rejeitados e não devem voltar como base;
- rose de erro, emerald de sucesso, rampa de progresso, cores de categoria e a
  marca Google ficam fora da paleta e não se alteram.

Ao derivar um tom novo, casar a luminância relativa WCAG do tom substituído, e
não a lightness HSL, amortecendo a saturação nos extremos. Conferir contraste de
texto, ícone e estado de foco nos temas claro e escuro.

O `<main>` pinta `bg-background` sobre o gradiente do `body`; em `/calendar` e
`/goals` o que aparece é o overlay radial da própria página. Ajustar o fundo
dessas telas ali, não apenas no `body`.

## Projetar os estados

Desenhar, no mesmo passo, carregamento, vazio, sucesso, erro, indisponibilidade
de rede e conteúdo excedente. O estado vazio explica o próximo passo. O erro
oferece recuperação. Ação local confirma antes da rede e a falha remota precisa
de feedback visível.

Toda string nova entra nos dicionários `pt-BR` e `en` na mesma mudança; o
desenho precisa caber no texto mais longo dos dois idiomas.

## Desenhar mobile-first sem mover o desktop

1. Resolver hierarquia, ação principal e alcance do polegar no viewport pequeno.
2. Expandir para desktop preservando o desenho atual de 640px para cima.
3. Escrever o utilitário novo com a base igual ao desktop atual e a variante
   `touch:` como override; a consulta é
   `(pointer: coarse) and (max-width: 899.98px)`, com fonte única em
   `src/hooks/use-touch-composition.ts`. Nunca misturar `sm:` e `touch:` na
   mesma propriedade.
4. Usar `useTouchComposition` apenas quando o DOM precisar ser estruturalmente
   outro, e só dentro de caixa cuja altura já esteja fixada nos dois ramos; o
   chrome de página sai por CSS, para não deslocar o layout na hidratação.
5. Reservar `useCoarsePointer` para afordância de toque pura e a largura medida
   em runtime para densidade.
6. Obter os 44px de alvo com `touch-target`, sem aumentar o desenho do controle.
7. Dar caminho equivalente por toque a arrasto e a hover; menu ancorado que
   dependa de hover vira folha inferior (`BottomSheet`) no toque.

## Fechar a decisão

Registrar as escolhas de hierarquia, tokens, estados e composição mobile antes
de implementar; implementar pela Skill `ui-consistency`; validar com
`make lint`, `make test` e, quando o fluxo de navegador ou a responsividade
forem afetados, `make test-e2e` e `make test-e2e-mobile`; registrar a evidência
visual exigida pelo REVIEW nos dois tamanhos.
