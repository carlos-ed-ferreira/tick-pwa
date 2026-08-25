# Próximos passos externos e decisões pendentes

## Para que serve este documento

O [IMPLEMENTATION.md](../IMPLEMENTATION.md) continua sendo o backlog canônico e
a fonte de status. Este guia complementa aquele backlog respondendo, para cada
item que depende de você, três perguntas: **o que decidir**, **como executar** e
**como saber que terminou**. Nada aqui autoriza o agente a executar por conta
própria; tudo depende de um pedido explícito ou de acesso que só você possui.

Itens já concluídos em 25 de agosto de 2026:

- `Check app`, `Check database` e `Check end-to-end` são checks obrigatórios da
  branch padrão no ruleset `main-protection`;
- o SQL da migration de retenção de recibos foi revisado.

## 1. Ensaio do rollout da outbox

**Decisão:** qual conta interna recebe o ensaio e se você aceita rodar o teste
de fila cheia, que exige gerar muitas operações offline.

**Pré-requisito:** a versão com backoff, limite de fila e rebase de revisão
stale precisa estar publicada em produção antes de ligar as variáveis.

**Como executar:** siga a sequência de ativação de
[account-operation-rollout.md](account-operation-rollout.md). Os cenários novos
estão detalhados lá, na seção de ensaio. Em resumo:

1. edição comum online, para confirmar que o indicador não pisca;
2. edição offline, reload offline, reconexão sem ação manual;
3. duas abas da mesma conta editando a mesma entidade, para observar o rebase
   automático de `stale_revision`;
4. opcionalmente, acúmulo de mais de 200 operações offline, para observar o
   limite da fila.

**Como saber que terminou:** o indicador volta a `Sincronizado` sozinho em todos
os cenários, nenhuma operação fica permanentemente falha e nenhuma alteração
local desaparece. Se algo ficar preso, não amplie a allowlist: registre o estado
e use a sincronização forçada antes de investigar.

## 2. Ordem entre migration e deploy da Vercel

**Problema:** hoje o push para `main` dispara, em paralelo, o workflow de
migrations e o build automático da Vercel. Nada garante que o schema chegue
antes da aplicação.

**Decisão:** escolher uma das três alternativas.

| Opção                                                             | Custo                                         | Risco residual                                                  |
| ----------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| A. Manter o paralelo e depender de migrations sempre aditivas     | zero                                          | app novo pode rodar por segundos sobre o schema antigo          |
| B. Desligar o auto-deploy e disparar o deploy após as migrations  | um secret e um job novo                       | deploy não acontece se o job falhar; exige monitorar o workflow |
| C. Manter o auto-deploy e bloquear o build com Ignored Build Step | script na Vercel, difícil de auditar pelo Git | lógica de deploy espalhada entre dois lugares                   |

**Recomendação:** opção B, porque torna a ordem explícita e auditável pelo Git.

**Como executar a opção B:**

1. na Vercel, em **Settings → Git**, desative o deploy automático da branch de
   produção;
2. ainda na Vercel, crie um **Deploy Hook** para `main` e copie a URL;
3. no GitHub, cadastre a URL como secret `VERCEL_DEPLOY_HOOK_URL` no environment
   `production`;
4. peça a inclusão de um job `deploy-production` em
   `.github/workflows/supabase-migrations.yml`, com `needs: migrate-production`,
   que apenas chama a URL do hook;
5. publique uma alteração inócua e confirme, pelos horários, que o deploy
   começou depois do passo de migrations.

**Como saber que terminou:** um push para `main` produz, nesta ordem, quality
gate aprovado, migrations aplicadas e só então um novo deployment na Vercel.

## 3. Ensaio de rollback

**Decisão:** onde ensaiar a restauração, já que o plano Free tem um único
projeto Supabase. As opções são um projeto Free temporário criado só para o
ensaio ou a restauração do dump em um Postgres local.

**Como executar:**

1. gere um backup pelo procedimento manual já documentado;
2. restaure em ambiente isolado, nunca no projeto de produção;
3. registre o tempo de restauração e a perda máxima aceitável, para transformar
   RPO e RTO em números reais;
4. escreva o passo a passo do que fazer quando uma migration precisar ser
   revertida: qual migration compensatória escrever, quem aprova e como avisar
   os usuários da alfa.

**Como saber que terminou:** existe um documento com tempos medidos e um
procedimento que outra pessoa conseguiria seguir sem você.

## 4. Observabilidade das métricas de sincronização

**Estado:** `src/lib/db/account-sync-metrics.ts` já acumula, por conta, fila,
idade da operação mais antiga, tentativas, rejeições, conflitos e latência de
confirmação, sem conteúdo do usuário. Falta um destino.

**Decisões:**

- provedor: um SaaS com plano gratuito, um coletor próprio ou nenhum destino
  externo por enquanto;
- quais eventos saem do dispositivo e com que frequência;
- retenção e quem pode ler os dados;
- limites que geram alerta, por exemplo fila acima de N ou operação pendente há
  mais de X minutos;
- confirmação explícita de que nenhum texto de tarefa, meta ou e-mail acompanha
  a métrica.

**Como executar depois de decidir:** o consumo das métricas é uma mudança
pequena de código, porque a coleta já existe; o trabalho real é criar a conta,
guardar a chave como variável de ambiente e definir os alertas.

**Como saber que terminou:** uma falha sintética de sincronização aparece no
painel escolhido e dispara o alerta, sem vazar conteúdo do usuário.

## 5. Decisões de produto que bloqueiam código

Estes itens não podem ser implementados por inferência. Cada um exige uma
decisão sua registrada no `IMPLEMENTATION.md` antes de virar tarefa.

### ACCESS-01 — guest limitado, trial e entitlement

- o que exatamente o convidado perde: quantidade de dias, de tarefas, de metas,
  ausência de exportação, ou outra combinação;
- se o convidado que hoje já excede o limite futuro continua funcionando;
- quando os sete dias de trial começam a contar e o que acontece ao expirar,
  lembrando que os dados nunca são apagados;
- se o trial é por conta, por e-mail ou por dispositivo, o que muda a proteção
  contra abuso.

### AUTH-01 — ciclo de vida público de conta

- provedor de SMTP e domínio remetente;
- se o cadastro público abre com CAPTCHA desde o início;
- prazo prometido para exportação e exclusão de conta;
- se a allowlist é removida quando o entitlement assumir o controle de acesso.

### BILLING-01 — assinatura e pagamentos

- provedor de pagamento, considerando emissão fiscal no Brasil;
- entidade jurídica que recebe;
- se os preços provisórios de `R$ 10,00/mês` e `US$ 5.00/mês` são definitivos;
- comportamento em falha de pagamento: período de tolerância e o que acontece
  com o acesso durante ele.

### MIGRATE-01 — migração de convidado para conta

- se a migração será oferecida e em que momento da experiência;
- o que fazer quando a conta de destino já tem dados: mesclar, duplicar ou
  bloquear;
- se os dados de convidado são apagados após a confirmação ou preservados.

**Ordem de dependência:** AUTH-01 vem antes de ACCESS-01, que vem antes de
BILLING-01. MIGRATE-01 depende de SYNC-01 e API-01 estáveis e deve ser a última
das quatro.
