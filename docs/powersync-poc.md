# Prova de conceito PowerSync

## Objetivo e limite atual

Esta prova usa o PowerSync Cloud gratuito para validar a sincronização do modo
autenticado antes de migrar a persistência principal. Ela não depende de
Vercel Pro, Supabase Pro ou PowerSync Pro.

O código entregue nesta etapa contém:

- SDK web carregado sob demanda;
- banco SQLite separado por usuário autenticado;
- autenticação pelo JWT atual do Supabase;
- schema local para categorias, dias e a hierarquia completa do checklist;
- conector de upload com ownership derivado da sessão;
- Sync Streams filtrados por `auth.user_id()`;
- rollout bloqueado por flag e lista explícita de contas;
- desligamento total para convidado e quando a flag está ausente;
- fechamento do banco ao trocar de conta;
- cenário isolado com pai e duas subtarefas;
- edição, conclusão, reordenação e exclusão local transacional;
- contagem da fila de upload e estado de conexão sem expor erros internos.

A flag permanece desligada por padrão. O fluxo funcional do produto ainda usa
Dexie e o conector atual do Supabase; portanto esta fundação não deve ser
descrita como sincronização durável concluída nem liberada para usuários. A
superfície isolada já lê e escreve as entidades da prova no SQLite do PowerSync.
A próxima etapa é publicar o código sem ativá-lo, liberar uma única conta
interna e executar os ensaios reais offline e multidispositivo.

## Ambientes usados nesta prova

Os nomes dos ambientes têm significados diferentes em cada provedor:

- **Supabase:** o projeto remoto atual do Tick, que contém as contas da alfa;
- **PowerSync:** a instância chamada **Development**, usada somente para a
  prova de conceito;
- **Vercel:** o ambiente **Production**, porque é o único deploy autorizado a
  acessar o Supabase remoto atual;
- **Vercel Preview:** permanece sem Supabase e sem PowerSync;
- **desenvolvimento local:** continua usando o Supabase local e não usa a
  instância PowerSync Cloud.

Cadastrar a URL no ambiente Production da Vercel não ativa o PowerSync. A
ativação depende de outra variável, que permanecerá ausente. Nenhum plano Pro é
necessário nesta etapa.

## Estado da configuração externa

Registrado em 11 de agosto de 2026 conforme confirmação manual:

- [x] usuário de replicação e publicação criados no Supabase;
- [x] instância Development gratuita criada no PowerSync e conectada ao banco;
- [x] Supabase Auth habilitado no PowerSync;
- [x] Sync Streams validados e implantados;
- [x] URL pública da instância cadastrada na Vercel sem ativar a prova;
- [x] contrato isolado de leitura e escrita SQLite coberto por testes;
- [x] superfície funcional isolada criada sem integração com o Dexie;
- [x] criação, edição, conclusão, reordenação e exclusão cobertas por testes;
- [x] fila e estado de conexão expostos de forma segura na superfície isolada;
- [ ] telas funcionais reais migradas para o SQLite do PowerSync;
- [ ] ativação controlada e ensaios offline executados.

## Configuração externa realizada

### 1. Supabase

**Status: concluído.** Foi criado um usuário exclusivo de replicação com leitura
somente das três tabelas da prova. A publicação também ficou restrita a elas.
O SQL aplicado foi:

```sql
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD '<SENHA_ALEATORIA_FORTE>';
GRANT USAGE ON SCHEMA public TO powersync_role;
GRANT SELECT ON public.category_tags, public.daily_entries, public.checklist_items TO powersync_role;
CREATE PUBLICATION powersync FOR TABLE public.category_tags, public.daily_entries, public.checklist_items;
```

A senha não deve ser gravada no repositório, na Vercel ou em `.env.local`. Ela
pertence somente à conexão entre PowerSync Cloud e Postgres.

### 2. Instância gratuita do PowerSync

**Status: concluído.** Foi usada a instância **Development** do projeto Tick no
PowerSync Cloud gratuito. A conexão usa:

- conexão direta do Supabase;
- usuário `powersync_role`;
- senha exclusiva de replicação;
- SSL `verify-full`;
- teste de conexão aprovado.

### 3. Autenticação

**Status: concluído.** Em **Client Auth**, foi habilitado **Use Supabase Auth**.
Com as chaves JWT atuais do Supabase, o PowerSync usa o endpoint JWKS sem exigir
um secret legado.

### 4. Sync Streams

**Status: concluído.** O conteúdo de `powersync/sync-config.yaml` foi validado e
implantado em **Sync Streams**. A configuração possui colunas explícitas,
assinatura automática e filtro por usuário em todas as consultas.

## Configuração externa finalizada

### 5. Cadastrar somente a URL na Vercel

**Status: concluído.** Na Vercel foi cadastrada somente no ambiente
**Production**:

```dotenv
NEXT_PUBLIC_POWERSYNC_URL=https://<instancia-development>.powersync.journeyapps.com
```

Essa URL é pública e aponta para a instância **Development** do PowerSync já
configurada nos itens anteriores.

Não crie e não configure esta variável ainda:

```dotenv
NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC
```

Também não cadastre as variáveis do PowerSync em **Preview** ou
**Development** na Vercel. Esses ambientes não possuem acesso ao Supabase
remoto usado pela prova.

Como a variável de ativação não existe, o aplicativo não abre o SQLite, não
conecta ao PowerSync e mantém integralmente o fluxo Dexie/Supabase atual.

Essa configuração foi suficiente para concluir a implementação isolada sem
ativar nenhuma conta.

## Ativação futura

O código já exige rollout restrito por conta. A flag só poderá ser definida
como `1` depois que esta alteração for publicada sem ativação e o calendário
normal for validado, sempre em um deploy controlado. Até lá:

- não criar `NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC`;
- não liberar a prova para toda a allowlist;
- não contratar Vercel Pro, Supabase Pro ou PowerSync Pro;
- não considerar `SYNC-01` concluído.

Quando a ativação for autorizada, ela exigirá as duas variáveis abaixo ao mesmo
tempo. A lista aceitará somente os UUIDs das contas internas selecionadas:

```dotenv
NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC=1
NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS=<uuid-da-conta-interna>
```

## Próxima ação externa: ativar uma conta interna

A etapa de código isolada está concluída. Faça a ativação nesta ordem:

1. publique primeiro o código atual mantendo as duas variáveis de ativação
   ausentes;
2. confirme que `https://tickapp.com.br/calendar` continua funcionando com o
   fluxo atual;
3. no Supabase Dashboard, abra **Authentication → Users** e copie o UUID de uma
   única conta interna destinada ao teste;
4. na Vercel, crie somente em **Production**:

```dotenv
NEXT_PUBLIC_TICK_ENABLE_POWERSYNC_POC=1
NEXT_PUBLIC_TICK_POWERSYNC_POC_USER_IDS=<uuid-da-conta-interna>
```

5. gere um novo deploy de Production;
6. entre com essa conta e abra
   `https://tickapp.com.br/~powersync-poc`.

Não informe o UUID neste documento nem adicione outras contas. O UUID não é um
secret de autenticação, mas a lista controla o alcance da prova e deve continuar
mínima.

Na página da prova, confirme o formulário, o estado do SQLite e a fila. Execute
primeiro criação, edição, conclusão, reordenação e exclusão em um único
dispositivo. Os ensaios de desconexão, reload e segundo dispositivo devem ser
registrados separadamente, sem ampliar a lista de contas.

## Implementação isolada concluída

O contrato de persistência do POC já produz mutações SQLite com ownership
derivado do escopo autenticado, converte booleanos e JSON para tipos
compatíveis e rejeita dados guest. A rota interna `/~powersync-poc` cria uma
categoria, um dia, uma tarefa e duas subtarefas em uma única transação SQLite.
Nela é possível editar, concluir ou reabrir, reordenar e excluir; cada alteração
relacionada ao resumo diário é gravada no mesmo lote local. A rota também relê
o snapshot e a contagem da fila. Ela não está ligada aos comandos do produto e
só fica disponível quando flag e UUID autorizado coincidirem.

A futura migração das telas reais seguirá estas regras:

- não escrever simultaneamente no Dexie e no PowerSync;
- manter o guest exclusivamente no Dexie;
- manter contas fora do rollout no fluxo Dexie/Supabase atual;
- executar o POC em uma superfície isolada antes de trocar a persistência das
  telas existentes;
- só migrar as telas reais depois dos testes de reload, offline e isolamento.

## Validação antes de aprovar a tecnologia

A prova só pode ser aprovada depois de validar:

- operação offline pendente após reload e fechamento da aba;
- reconexão e convergência em dois dispositivos;
- isolamento negativo entre duas contas;
- convidado sem conexão ou banco PowerSync;
- criação, edição, reordenação e exclusão da hierarquia;
- Chrome/Android, Safari/iOS e fallback de armazenamento;
- volume, latência, fila, erros e uso dentro do plano gratuito.

Até esses resultados existirem, `SYNC-01` permanece em andamento e a fila
atual continua sendo uma limitação conhecida.

## Evidência automatizada desta etapa

Executado em 11 de agosto de 2026, ainda sem ativar a flag:

- `make check`: 60 arquivos e 429 testes, lint, tipagem, formato e build;
- `make test-e2e`: 22 cenários desktop e mobile;
- `make test-e2e-account`: 2 cenários autenticados;
- `make audit-prod`: 0 vulnerabilidades de produção.

O build informa que os dois artefatos WASM do SQLite excedem o limite de
precache do service worker. Isso não bloqueia o POC carregado online, mas o
reload inteiramente offline e o fallback de armazenamento continuam como
critérios obrigatórios do ensaio real.
