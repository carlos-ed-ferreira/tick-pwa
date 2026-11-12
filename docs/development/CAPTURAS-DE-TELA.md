# Capturas de tela

[Desenvolvimento](DESENVOLVIMENTO.md) · [Apresentação do aplicativo](../../README.md)

## Gerar as capturas

Com as dependências instaladas e Chromium disponível, execute:

```bash
make screenshots
```

O comando gera um build, inicia um servidor local na porta 3200 e captura a
interface nos dois idiomas nos tamanhos desktop (1440 × 960) e mobile (412 × 915).
Usa um contexto de navegador temporário em modo guest, bloqueia requisições
externas e insere os dados pelos fluxos do aplicativo, sem acessar contas ou
alterar dados de outros perfis. O servidor é encerrado ao terminar.

O calendário fictício está em [calendar-demo.json](../examples/calendar-demo.json);
a versão do dia em inglês está em [calendar-demo-en.json](../examples/calendar-demo-en.json).
O script cria também cinco metas, dois grupos e cinco atividades recorrentes.
Os exemplos usam categorias distintas para grupos, metas e etapas, datas em
duas etapas do portfólio e dez dias de registros das recorrentes, de 2 a 11 de
novembro de 2026. O calendário contém compromissos de setembro a dezembro,
com dias livres e volumes diferentes de tarefas. As recorrentes misturam
atividades quantitativas e binárias, com frequências diárias e semanais.
As capturas usam o dia 11 de novembro de 2026 e são gravadas em `docs/images/`,
incluindo preferências, visão geral de metas, quantidades, desempenho e
histórico. As tarefas no computador, as metas detalhadas e o desempenho são capturados
em um segundo perfil guest em inglês, com interface, categorias e conteúdo
traduzidos, datas em mês/dia e horários com AM/PM; as demais telas
são capturadas em português. Cada combinação de tela e dispositivo aparece
uma vez, sem cópias adicionais apenas para trocar o idioma.
O Chromium instalado pelo
Playwright tem preferência; no Ubuntu, há fallback para `/snap/bin/chromium`.
Para outro executável, defina `SCREENSHOT_BROWSER_PATH` ao chamar o target.

Para revisar a composição de toque em 320, 360, 390, 430 e 768px, sem alterar
as imagens do README:

```bash
SCREENSHOT_REVIEW=1 SCREENSHOT_OUTPUT_DIR=.next/visual-review make screenshots
```

## Auditar superfícies sem alterar a galeria

```bash
make audit-ui
```

Esse target reutiliza a geração isolada e acrescenta inspeções de telas, menus, formulários, confirmações, filtros e variações de largura em português e inglês. Todas as capturas e o relatório `audit.json` ficam em `.next/ui-audit`; `docs/images` não é substituído. A auditoria não usa credenciais reais nem envia requisições aos provedores: acesso negado e conta autorizada são reproduzidos por respostas locais sintéticas.

O relatório distingue superfícies observadas, falhas de reprodução, overflow e achados do axe. A execução coleta achados, sem aprovar automaticamente a UI ou provar sincronização remota. Uma falha de reprodução precisa ser inspecionada antes de afirmar cobertura. Loading transitório, indisponibilidade de armazenamento e teclado virtual físico exigem comprovação específica quando não observados.

Ao revisar as imagens, diferencie padrão coerente, exceção funcional e divergência. Os padrões e o inventário atual ficam na [skill de frontend](../../.agents/skills/frontend-design/SKILL.md); trabalho corretivo fica somente em [PENDENCIAS](../planning/PENDENCIAS.md). Não acumule resultados de execuções neste guia permanente.
