# Padrões visuais do Tick

[Skill](../SKILL.md) · [Mapa de telas](MAPA-DE-TELAS.md)

## Fonte e aplicação

Os tokens, primitives e componentes citados são as fontes executáveis. Use as regras deste documento para escolher o componente; consulte seu contrato no código antes de ajustar variantes. Valores descritos são os existentes, sem criar uma escala paralela. Divergências observadas ficam nas pendências, não são exemplos normativos.

## Paleta e superfícies

Fonte: [globals.css](../../../../src/app/globals.css).

- Tema único escuro, independente da preferência clara/escura do sistema. Fundos atuais: `--background: #0c121a`, `--surface: #16202c`, `--surface-2: #1e2938`, `--surface-3: #243345`; `--accent: #f0c38e` e `--muted: #aebac8`.
- A escala âmbar quente é fixa; neutros derivam do hue 212°. Roxo e teal não compõem a paleta base. Cores de categoria, rose de erro, emerald de sucesso, rampa de progresso e marca Google têm função semântica própria e ficam fora dessa restrição.
- Ao derivar um tom, preserve luminância relativa e contraste, não apenas lightness HSL; reduza saturação nos extremos. Texto de apoio usa o tom muted; não invente cinzas por tela.
- `card-surface`, `card-surface-soft` e `card-surface-strong` representam contextos; listas usam `taskListSurfaceClassName`. Containers de tarefas, etapas, metas e grupos usam superfície e sombra, sem borda padrão.
- `modal-surface` representa uma sobreposição; `modal-panel` abriga menus. Rings existentes servem a campos, seleção e foco; `DashedRing` serve a traço interrompido, como o card de criação.
- Não acrescente fundo decorativo à barra de ações que já pertence ao container da lista. Um card interno exige um contexto distinto.
- `<main>` pinta `bg-background` sobre o fundo do body. Calendário e metas têm overlays próprios; alterações de fundo precisam considerar essa camada, não apenas o body.

## Hierarquia, texto e densidade

Fontes: [Text](../../../../src/components/ui/text.tsx), [AuthShell](../../../../src/features/auth/auth-shell.tsx), [DayDetail](../../../../src/features/day-editor/day-detail.tsx).

| Papel                                 | Padrão                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Corpo e rótulos de controles          | `text-sm`/14px; `Text` é o primitive para corpo, tom, peso e entrelinha |
| Texto editável de tarefa/etapa        | 14px no desktop; 16px e linha de 24px no toque                          |
| Metadados, horários e chips compactos | `text-xs`/12px; muted e números tabulares quando pertinente             |
| Títulos internos de dia/meta          | 24px desktop; 18px na composição de toque                               |
| Título de modal                       | 18px, semibold; nome acessível ligado ao diálogo                        |
| Título de acesso                      | Exceção de apresentação: `AuthShell` usa 30/36/48px conforme largura    |

Hierarquia vem primeiro de peso, espaço e tom. Categorias podem usar caixa alta como conteúdo/rótulo, sem impor caixa alta ao texto das tarefas. Títulos de acesso são uma composição própria, não a escala dos cabeçalhos de listas. Preserve heading semântico em vez de converter tudo em parágrafo para usar um primitive.

Gaps de 4/6/8px aparecem nas ações e metadados; listas usam `p-3` e `sm:p-4`; formulários e modais usam os espaçamentos do primitive e de sua família. Não uniformize essas funções distintas com um único padding global.

## Controles e prioridades

Fontes: [filled-control](../../../../src/components/ui/filled-control.ts), [ModalActionButton](../../../../src/components/ui/modal-action-button.tsx), [IconButton](../../../../src/components/ui/icon-button.tsx).

| Papel                  | Componente/variante                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Ação textual de página | `filledPillControlClassName`, 40px; variante medium, 36px                                |
| Ação compacta de barra | `filledCompactPillControlClassName`, 32px, preenchimento translúcido neutro/âmbar/perigo |
| Ação só com ícone      | `FilledIconButton` ou variante round; 40px/36px nas variantes correspondentes            |
| Ação densa da linha    | `IconButton`, raio redondo e tamanho pela prop `size`, sem `size-*` no className         |
| Escolha exclusiva      | Pill tabs; ativo com âmbar sólido, demais neutros                                        |
| Ação de modal          | `ModalActionButton`, 32px; primary em âmbar, destructive em rose                         |
| Voltar                 | Pill com ícone e texto curto `actions.back`                                              |

Botões são preenchidos e sem borda. Controles preenchidos usam elevação/sombra de hover e foco visível. Diferencie uma ação primária por contexto; criar ações secundárias em âmbar sólido disputa atenção com o seletor ativo e com a confirmação principal.

Os tamanhos pintados não substituem o alvo de toque de 44px. A marca Google preserva suas cores. `ActionButton` no acesso admite título, descrição e ícone: é uma escolha de acesso, não o botão compacto de uma toolbar.

## Formulários e seletores

Fontes: [FormField](../../../../src/components/ui/form-field.tsx), [DatePicker](../../../../src/components/app/date-picker.tsx), [preferências](../../../../src/components/app/task-tree-row-actions-menu.tsx).

- Use `FormField`/`FormTextareaField`, com label na borda e erro associado ao campo. Calendário e outros controles internos entram por `endAdornment`.
- Use `noValidate`, validação do app e foco preservado. Não use alert, confirm ou prompt nativos. Campos estruturados desabilitam assistência automática quando inadequada; e-mail e senha preservam seus autocompletes semânticos.
- Edição inline de nomes e conteúdo usa input/textarea simples, sem label na borda. Conteúdo longo cresce em altura nas tarefas/etapas.
- DataPicker é a seleção de data compartilhada. Data de calendário usa helpers locais/timezone-aware. Inglês exibe mês/dia e AM/PM; português usa dia/mês e 24 horas. O JSON de importação continua com datas ISO e horário canônico.
- Opções de preferência usam colunas conforme a quantidade de escolhas e permitem quebra de rótulos; o texto deve caber integralmente no controle.

## Cabeçalhos e navegação

Fonte: [AppHeader](../../../../src/components/app/app-header.tsx) e famílias no [mapa](MAPA-DE-TELAS.md).

- Desktop: marca, navegação central e ações da conta/idioma. Toque: cabeçalho compacto e navegação fixa no rodapé, sem cobrir o conteúdo.
- `Entrar` mantém texto no toque. Ícones não substituem um rótulo textual disponível apenas para economizar espaço sem necessidade.
- Categorias do dia ficam no cabeçalho do dia; categorias de metas ficam na visão geral e nos cabeçalhos de grupo/meta. No toque, as ações de categorias das barras de dia/visão geral alinham à direita.
- No detalhe de uma meta, categoria acompanha o título; ações complementares vão para a folha no toque. Conteúdo longo pode truncar com tooltip completo, sem deslocar os controles para fora do container.
- Filtros e seleção de seção usam os mesmos estados e componentes de pill; não são botões de confirmar formulário.

## Linhas, árvores e indicadores

Fontes: [TaskTreeRowLayout](../../../../src/components/app/task-tree-row-layout.tsx), [TaskTreeEditableRow](../../../../src/components/app/task-tree-editable-row.tsx), [RecurringOccurrence](../../../../src/features/recurring/recurring-occurrence.tsx).

- Conclusão, texto e ações da tarefa/etapa compartilham o eixo principal; metadados de hora, data e categoria acompanham o conteúdo no toque. Itens concluídos usam contraste atenuado preservando leitura.
- Recuo da árvore é 14px por nível no desktop e limitado a 36px no toque. Esse limite preserva a leitura, sem alterar parentesco.
- Na recorrência quantitativa no toque, nome e categoria ficam no primeiro bloco; quantidade, barra e edição ficam em bloco separado. A barra não passa por cima do badge nem do botão de registro.
- Progresso, estado, categoria e prioridade são informações diferentes. Cores de categoria não substituem status. Dados quantitativos usam formatação por idioma; unidades diferentes não são somadas.
- Ações de mover, promover/rebaixar e selecionar oferecem alternativa ao arrasto; no toque, alça de arrasto e seleção ficam nas ações da linha, e a seleção permanece acessível quando ativa.

## Sobreposições, foco e feedback

Fontes: [Dialog](../../../../src/components/ui/dialog.tsx), [BottomSheet](../../../../src/components/ui/bottom-sheet.tsx), [Tooltip](../../../../src/components/ui/tooltip.tsx), [toast](../../../../src/components/ui/toast.tsx).

- Menu ancorado serve a escolhas contextuais no mouse. No toque, ações densas usam folha inferior; nenhuma ação essencial depende de hover.
- `BottomSheet` compõe `Dialog size="sheet"`, com limite de 85dvh e rolagem própria. Formulários grandes usam a variante de diálogo correspondente, sem criar uma folha paralela.
- Preserve nome acessível, foco inicial, contenção de Tab, Escape e retorno do foco ao fechar. O fechar é redondo; confirmações destrutivas explicam a ação antes de executar.
- Todo texto truncável, inclusive título de modal, usa tooltip com conteúdo integral. Quando repetir o texto, `whenTruncated`; ações somente com ícone têm tooltip sempre disponível. Tooltip descreve só a ação; identificação repetida fica no nome acessível. Não usar HTML `title` como substituto.
- Loading, vazio, erro, sucesso e desabilitado fazem parte do desenho. Vazio oferece um próximo passo; falha oferece recuperação; ação pendente não se apresenta como sincronização remota concluída. Não validar a conta offline usando somente guest.

## Responsividade e acessibilidade

Fontes: [useTouchComposition](../../../../src/hooks/use-touch-composition.ts), [globals.css](../../../../src/app/globals.css).

Use a conjunção de ponteiro grosso e largura abaixo de 900px para composição; capacidade do ponteiro para interação; largura medida para densidade. `getCalendarDayDensity` compacta células abaixo de 72px, e `getCalendarWeekDensity` abaixo de 48px. Mês e semana reutilizam o range de 42 dias já carregado; escolher o dia não cria um caminho de dados novo.

A consulta `touchCompositionQuery` deve permanecer equivalente à variante CSS `touch`. Em código novo: base desktop e override `touch:`; não combinar `sm:` e `touch:` na mesma propriedade. O legado restaura desktop por `sm:`. Ponteiro fino mantém o desenho desktop de 640px para cima; tablet largo com toque usa a composição desktop a partir de 900px.

`touch-target` amplia apenas a área de acerto para pelo menos 44px. Preserve o posicionamento do controle pintado, rolagem da página, faixa semanal interna e alternativa de toque a drag/hover. HTML5 drag sozinho não atende ao toque; a árvore usa Pointer Events com o mesmo contrato de placement.

A reserva do rodapé usa `--app-bottom-nav-height`, incluindo `safe-area-inset-bottom`; superfícies de borda usam `.app-safe-padding` e `viewportFit`. Preserve `interactiveWidget: 'resizes-content'` para o teclado virtual. A rolagem de um painel não deve empurrar ações para fora sem caminho de acesso.

Textos, foco e controles precisam de contraste legível, semântica e nomes acessíveis. Conferir zoom, textos longos, dois idiomas e sistema claro/escuro mantendo o tema único. A matriz de aceitação é a do [REVIEW](../../../../REVIEW.md#revisão-visual), sem duplicar gates aqui.
