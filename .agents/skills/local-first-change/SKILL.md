---
name: local-first-change
description: >-
  Planejar, implementar e validar alterações do Tick que toquem IndexedDB, Dexie, Supabase, sincronização, escopos guest/user, offline, retry ou conflitos. Usar sempre que uma ação possa afetar persistência local ou remota.
---

# Local-first change

## Delimitar o contrato

1. Ler os fluxos atuais no `../../../README.md`, as regras em
   `../../../AGENTS.md` e a matriz local-first em `../../../REVIEW.md`.
2. Mapear entidade, comando de `src/lib/db`, tabela Dexie, mapeador Supabase,
   tabela Postgres e testes existentes.
3. Preencher a matriz para `guest:<installationId>` e
   `user:<supabaseUserId>`: leitura, commit local, envio remoto, falha, retry,
   reconexão e troca de modo.
4. Distinguir garantia existente de item planejado em
   `../../../IMPLEMENTATION.md`.

Parar e registrar decisão antes de criar sync paralelo, migrar guest durante
login ou introduzir uma nova fonte canônica.

## Especificar invariantes

- Confirmar ação local antes de depender da rede.
- Nunca enviar entidade guest ao Supabase.
- Nunca cruzar dados ou operações entre usuários.
- Preservar operação prometida no ciclo de vida suportado.
- Tornar retry idempotente e ordem determinística.
- Impedir snapshot parcial de excluir dados válidos.
- Definir conflito, rollback e estado canônico.
- Expor falha recuperável; não perder ação silenciosamente.
- Limitar fila, tentativas e trabalho repetido.

## Implementar com TDD

1. Usar a Skill `tdd-change`.
2. Começar pelas regras, comandos e persistência antes da UI.
3. Fazer escrita IndexedDB somente pelos comandos de `src/lib/db`.
4. Derivar ownership remoto da sessão, não do payload confiado.
5. Manter migrations Dexie e Postgres reproduzíveis e compatíveis.
6. Adicionar feedback da UI somente depois do contrato persistente.

## Validar falhas e convergência

Testar, conforme o alcance:

- guest sem nenhuma chamada remota;
- dois usuários e tentativas de acesso cruzado;
- rede lenta, indisponível e retorno online;
- reload e fechamento com operação pendente;
- retry duplicado e operações rápidas em sequência;
- conflito de dois dispositivos;
- falha parcial de lote ou página;
- troca guest/conta sem mistura;
- conta madura e fila sob carga.

Executar testes direcionados, E2E autenticado/local, pgTAP e gates do REVIEW.
Registrar limitações ainda não resolvidas no `IMPLEMENTATION.md`.
