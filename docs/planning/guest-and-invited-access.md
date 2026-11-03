# Guest completo e contas por convite

## Política vigente em 2026-11-02

Tick permanece fechado para contas remotas, acessíveis somente por convidados
explicitamente autorizados. O modo guest permite usar todas as funcionalidades
de organização gratuitamente, sem cadastro, limite de tempo ou quantidade
imposto pelo produto. Essa política preserva os dois modos existentes.

| Modo            | Acesso e funcionalidades                                               | Persistência                                             |
| --------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Guest           | Calendário, tarefas, categorias, metas e etapas completos, sem prazo   | IndexedDB deste navegador, no escopo guest da instalação |
| Conta convidada | Funcionalidades de organização e sincronização para a conta autorizada | Cache local e Supabase no escopo do usuário autenticado  |

O uso guest é permanente, sem ativação, exigência de cartão ou contagem de dias.
Dados reais não são substituídos por demonstrações. Fechar ou reabrir o app não
remove o progresso; não há expiração deliberada dos dados.

## Contratos de dados e acesso

- `guest:<installationId>` nunca envia entidades ao Supabase.
- Alterações guest confirmam no IndexedDB e continuam disponíveis sem rede.
- Somente usuários autorizados em `account_access` usam a persistência remota.
- O servidor deriva identidade da sessão e aplica ownership por RLS.
- `user:<supabaseUserId>` nunca lê nem grava dados de outra conta.
- Alternar modo ou conta não mistura escopos, importa dados ou limpa a origem.
- Falhas remotas mantêm operações da conta na outbox durável, com feedback e
  retry idempotente. A negativa explícita de autorização não equivale a uma
  falha transitória de rede.

Dados guest não possuem cópia no Supabase. Limpeza de dados do navegador,
perfil diferente, navegação privada ou remoção do armazenamento podem tornar
os dados locais indisponíveis. Isso não é um prazo ou limite imposto pelo
produto. A UI deve informar que os dados ficam somente neste navegador.

Os limites físicos do navegador e as quotas dos serviços continuam existindo;
a política não promete armazenamento físico infinito ou sincronização guest.

## Ambiente e operação

Manter GitHub Free, Vercel Hobby e Supabase Free. Preservar a allowlist,
proteção da main, deploy ordenado, backup cifrado e auditoria de migrations.
Acompanhar capacidade conforme o uso real dos convidados, sem alterar planos,
hospedagem, visibilidade ou escopo dos secrets nesta etapa.

## Validação de manutenção

Cobrir os cenários pelos gates do REVIEW sempre que o fluxo for alterado:

1. Guest cria e altera dados nas superfícies de calendário e metas sem conta.
2. Reload e reabertura preservam os dados; passar tempo não bloqueia edição.
3. Guest funciona offline e não envia entidades aos endpoints remotos.
4. Entrar/sair de uma conta convidada mantém o conjunto guest independente.
5. Usuários sem convite e acessos cruzados são rejeitados no servidor.
6. Retry, reload com operações pendentes e reconexão não perdem dados da conta.

Não há feature nova de ativação ou prazo a implementar. O trabalho futuro é
manutenção, isolamento, robustez, capacidade e redução dos hotspots indicados
no [plano de implementação](implementation-plan.md).
