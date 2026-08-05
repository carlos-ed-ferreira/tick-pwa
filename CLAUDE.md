# Claude Code — Tick

@AGENTS.md

## Relação com o guia principal

`AGENTS.md` é a fonte canônica das regras do projeto. Este arquivo apenas
complementa essas regras com instruções operacionais específicas para o Claude
Code. Não duplique, enfraqueça ou contradiga o guia principal.

## Fluxo de trabalho obrigatório

1. Antes de editar, inspecione a estrutura do repositório, os arquivos
   relevantes, os testes existentes e os padrões já usados pela feature.
2. Para feature nova, correção comportamental ou refatoração com mudança de
   comportamento, crie ou ajuste os testes primeiro.
3. Faça a menor alteração coerente que resolva a tarefa. Evite refatorações,
   renomeações e formatações fora do escopo solicitado.
4. Preserve compatibilidade com os modos local e autenticado e verifique os
   dois fluxos sempre que a mudança tocar persistência, autenticação, escopo ou
   sincronização.
5. Use os alvos do `Makefile` quando houver um comando equivalente.
6. Rode primeiro as validações direcionadas à área alterada e, antes de
   concluir mudanças amplas, rode `make check`. E2E continua separado e deve ser
   executado quando o fluxo de navegador ou a responsividade forem afetados.
7. Revise o diff final para remover código morto, logs temporários, qualquer
   comentário de código, arquivos de teste descartáveis e alterações
   acidentais.

## Planejamento e execução

- Para tarefas pequenas e inequívocas, execute diretamente.
- Para mudanças que envolvam vários módulos, banco, autenticação, arquitetura
  ou rollout, apresente primeiro um plano curto e verificável.
- Não presuma decisões de produto. Pare e peça validação quando a tarefa puder
  introduzir sync, migração automática entre convidado e conta, mistura de
  escopos ou mudança relevante de comportamento.
- Quando houver ambiguidade apenas de implementação, siga os padrões existentes
  no repositório em vez de criar uma abstração nova.

## Segurança e limites

- Nunca use credenciais, URL ou anon key de produção no ambiente local.
- Nunca aplique migrations diretamente no Supabase de produção. Alterações
  remotas são responsabilidade do fluxo de GitHub Actions definido pelo
  projeto.
- Não leia, exponha, registre ou versione segredos e arquivos de ambiente.
- Não execute comandos destrutivos de Git, como `reset --hard`, `clean -fd` ou
  descarte de alterações, sem solicitação explícita.
- Não faça commit, push, merge, deploy ou publicação sem solicitação explícita.
- Preserve alterações existentes do usuário que não pertençam à tarefa.
- Não adicione dependências quando a solução puder usar a stack e os padrões já
  presentes. Quando uma dependência for realmente necessária, justifique o
  custo e o impacto.

## Regras de implementação

- UI não deve acessar tabelas Dexie diretamente; use os comandos e camadas de
  persistência definidos no projeto.
- Mudanças de UI devem reutilizar componentes, superfícies e padrões visuais já
  existentes antes de criar novos primitives.
- Mantenha o modo local funcional sem rede.
- Em conta autenticada, preserve commit local primeiro, fila remota ordenada,
  restauração do valor canônico em falha e feedback visível ao usuário.
- Para mudanças no Postgres, trate `supabase/schemas/tick.sql` como estado
  declarativo canônico. Gere migrations por diff e revise o SQL antes de
  considerá-las prontas.
- Não edite arquivos gerados quando existir uma fonte declarativa ou comando de
  geração correspondente.
- Atualize `README.md` e `AGENTS.md` quando a mudança alterar regras, setup,
  arquitetura, persistência, testes, deploy ou comportamento relevante.

## Critérios de conclusão

Uma tarefa só está concluída quando:

- a implementação atende ao pedido sem ampliar o escopo;
- os testes relevantes foram criados ou atualizados antes da implementação
  comportamental;
- typecheck, lint, testes e build aplicáveis passaram;
- os fluxos local e autenticado foram considerados quando pertinentes;
- estados de loading, vazio, sucesso e erro foram tratados quando aplicáveis;
- a interface continua responsiva nos tamanhos relevantes;
- a documentação necessária foi atualizada;
- o diff final não contém ruído ou alterações não relacionadas.

## Resposta final

Ao terminar, informe de forma objetiva:

1. o que foi alterado;
2. os arquivos principais envolvidos;
3. as validações executadas e seus resultados;
4. qualquer validação não executada, com o motivo;
5. riscos, limitações ou decisões pendentes reais.

Não declare que algo foi testado, validado ou corrigido sem ter executado a
verificação correspondente.
