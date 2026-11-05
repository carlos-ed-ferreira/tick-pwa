# Guest completo e contas por convite

## Política atual

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
- Nas contas habilitadas para lotes, entidades funcionais usam outbox durável,
  feedback e retry. Contas fora da coorte usam fila legada em memória, e
  preferências sincronizadas possuem estado pendente durável e retry separado,
  compartilhando a coordenação de envio da conta.
- A negativa explícita de autorização não equivale a falha transitória de rede.

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

## Conta autenticada sem internet

Local-first é a continuidade do uso da conta depois da perda de conexão,
com dados no cache e mudanças locais recuperáveis na reconexão. Guest é uso
sem conta, sem sincronização remota e em outro escopo.

O shell da PWA e os dados locais precisam estar disponíveis neste navegador.
A reabertura autenticada usa sessão disponível e grant positivo da mesma
conta/e-mail com até 24 horas quando o Supabase não responde. Não há acesso
remoto autorizado por esse grant depois de uma negativa explícita do servidor.

A outbox das seis entidades funcionais depende de flag e UUID habilitados no
build. Preferências usam fila durável para qualquer conta convidada. O indicador
resume os dois caminhos. O refresh compara a versão anterior à rede com a
versão local atual, preservando alterações e confirmações durante a leitura.
O caminho legado das entidades continua com garantia diferente da outbox.
