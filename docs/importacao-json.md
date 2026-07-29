# Importação JSON nas tarefas do dia

Permite adicionar tarefas a vários dias colando um JSON pronto, em vez de
digitar tarefa por tarefa.

Em `/calendar`, use o botão **Importar JSON** na barra de ações (ao lado de
"Criar em lote" e "Limpar em lote"). O modal abre com um campo de texto: cole o
JSON, confirme em **Importar** e o app valida, cria as categorias que faltarem e
grava as tarefas nos dias informados.

## Formato recomendado

```json
{
  "version": 1,
  "days": [
    {
      "date": "2026-07-26",
      "items": [
        { "text": "Revisar PRs" },
        {
          "text": "Academia",
          "time": "07:30",
          "priority": true,
          "category": { "name": "Saúde", "color": "#16a34a" },
          "children": [{ "text": "Levar garrafa" }]
        }
      ]
    },
    {
      "date": "2026-07-27",
      "items": [{ "text": "Planejar a semana", "time": "9:00" }]
    }
  ]
}
```

`version` é opcional e ignorado hoje; existe para versionar o formato no futuro.
Um array puro de dias também é aceito:

```json
[{ "date": "2026-07-26", "items": [{ "text": "Revisar PRs" }] }]
```

## Campos

| Campo                | Obrigatório | Regra                                                                                     |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `days[].date`        | sim         | data real em `AAAA-MM-DD`. `2026-02-31` é rejeitada                                       |
| `days[].items[]`     | sim         | lista de tarefas. Dia com lista vazia é ignorado                                          |
| `items[].text`       | **sim**     | texto da tarefa. Não pode ser vazio nem só espaços                                        |
| `items[].time`       | não         | horário em `HH:mm` de 24 horas. `9:00` vira `09:00`. `""` e `null` valem como sem horário |
| `items[].priority`   | não         | `true` ou `false`. Padrão `false`                                                         |
| `items[].category`   | não         | objeto com `name` **e** `color`, os dois obrigatórios juntos                              |
| `items[].children[]` | não         | subtarefas, com as mesmas regras. Aninhamento livre                                       |

O texto é o único campo obrigatório da tarefa. Tarefas importadas sempre entram
desmarcadas e expandidas.

## Categorias

A categoria é informada pelo nome e pela cor:

```json
"category": { "name": "Saúde", "color": "#16a34a" }
```

- `name` e `color` são obrigatórios sempre que houver `category`.
- `color` deve ser hexadecimal de seis dígitos, como `#16a34a`. `#1a3`, `green`
  e `rgb(22,163,74)` são rejeitados.
- O nome é comparado sem diferenciar maiúsculas, minúsculas ou espaços nas
  bordas: `saúde`, `Saúde` e `  SAÚDE  ` são a mesma categoria.
- Se a categoria **não existir**, ela é criada nas categorias de tarefas com
  a cor informada.
- Se a categoria **já existir**, ela é reaproveitada e a cor do JSON é
  **ignorada** — a importação nunca troca a cor de uma categoria existente. Para
  mudar a cor, use o gerenciador de categorias em `/calendar`.

## Regras da importação

- A importação **anexa**: as tarefas entram no fim da lista do dia e nada do que
  já existe é apagado ou substituído.
- A validação é total e acontece antes de qualquer escrita. Se houver um erro,
  nada é gravado e o modal lista os problemas com o caminho de cada um, como
  `days[0].items[2].time`. São exibidos até 10 erros por vez.
- O mesmo dia pode aparecer mais de uma vez em `days`; as listas são somadas.
- Limites por importação: 366 dias e 2000 tarefas.
- Importar o mesmo JSON duas vezes duplica as tarefas, mas não duplica as
  categorias.

## Modo local e modo com conta

- **Sem conta**: tudo é gravado apenas no IndexedDB do dispositivo e nada é
  enviado ao Supabase.
- **Com conta**: as tarefas e as categorias criadas são gravadas primeiro no
  cache local e depois enviadas ao Supabase, associadas ao usuário autenticado.

Como os dois modos usam escopos separados, uma importação feita sem conta não
aparece na conta autenticada, e vice-versa.

## Erros comuns

| Mensagem                                                                         | Causa                                          |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `JSON inválido: ...`                                                             | o texto colado não é um JSON válido            |
| `O JSON deve ser um objeto com a lista "days".`                                  | falta a chave `days` na raiz                   |
| `days[0].date: data inválida. Use AAAA-MM-DD.`                                   | data ausente, em `DD-MM-AAAA` ou inexistente   |
| `days[0].items[1].text: "text" é obrigatório e não pode ser vazio.`              | tarefa sem texto                               |
| `days[0].items[0].time: horário inválido...`                                     | horário fora de `HH:mm` ou fora de 00:00–23:59 |
| `days[0].items[0].category: "category" deve ser um objeto com "name" e "color".` | categoria sem nome ou sem cor                  |
| `days[0].items[0].category.color: cor inválida...`                               | cor fora do formato `#rrggbb`                  |
| `O JSON não tem nenhuma tarefa para importar.`                                   | `days` vazio ou todos os dias sem tarefas      |
