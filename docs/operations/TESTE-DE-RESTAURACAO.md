# Restore de backup em outra máquina

## Escopo e requisitos

O proprietário executa este ensaio em uma segunda máquina com Git, Node com
npm, GNU Make, GitHub autenticado e Docker funcional. Não há exigência de outra
pessoa. O restore é isolado: não aponta para produção nem usa credenciais do
banco remoto. A única chave necessária é a de decifragem do artefato.

Repetir mensalmente e após mudanças operacionais relevantes. Os scripts usam
módulos nativos do Node e não exigem instalação de dependências. Não criar
`.env.local` na cópia do ensaio.

## Preparar código e artefato

1. No GitHub Actions, selecionar uma execução `Production backup` bem-sucedida
   com artefato disponível. Anotar o ID e o SHA.
2. Baixar pela interface o artefato `tick-production-backup-<run-id>`.
3. Preparar uma cópia do repositório em diretório novo e exclusivo e fazer
   checkout do SHA correspondente, usando o cliente Git. Não reutilizar ou
   apagar a instalação habitual do projeto.
4. Extrair o único arquivo `tick-production-backup.enc` em pasta privada.
5. Guardar a chave `TICK_BACKUP_ENCRYPTION_KEY` no gerenciador de senhas, separada
   da senha do banco. Não colar a chave em chat, arquivo, log ou histórico.

Conferir execuções e metadados, quando necessário, pelos targets:

```sh
make backup-status
make actions-run run=<run-id>
make backup-artifacts run=<run-id>
```

## Executar

Baixar as imagens antes da medição de RTO:

```sh
make backup-restore-prepare
```

No mesmo terminal, ler a chave de forma oculta e executar o restore:

```sh
read -r -s -p "Backup encryption key: " TICK_BACKUP_ENCRYPTION_KEY
export TICK_BACKUP_ENCRYPTION_KEY
make backup-restore archive=<caminho-absoluto-do-arquivo.enc>
unset TICK_BACKUP_ENCRYPTION_KEY
```

O utilitário decifra em diretório temporário, sobe Postgres 17 isolado, prepara
Auth e Storage com migrations das imagens fixadas, importa roles/schema/dados
parando no primeiro erro e remove containers, volumes anônimos e temporários.
Ele espera prontidão por TCP antes de importar; não editar dumps para contornar
incompatibilidade.

## Avaliar o resultado

Entregar na tarefa de validação: ID/SHA do backup, modelo da máquina, sistema,
Node/Docker, início/fim UTC e São Paulo, `publicTables`, `backupCreatedAt`,
`rpoMs`, `rtoMs`, exit status e confirmação de limpeza. Não acrescentar histórico
de execuções aos guias permanentes.

O ensaio exige exit status zero, tabelas públicas restauradas e RTO abaixo de
30 minutos com imagens já baixadas. `rpoMs` mede a idade daquele artefato no
início do ensaio; o objetivo operacional é backup com até 26 horas. O ensaio
não inicia a aplicação, não comprova login nem recuperação completa da produção.

Confirmar ausência de containers/volumes do ensaio no Docker antes de remover
somente a cópia temporária e o artefato local. Limpar a área de transferência e
conservar a chave no cofre. Não executar limpeza na pasta habitual do projeto.

## Diagnóstico

| Erro                                 | Ação                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Falha de autenticação AES-GCM        | Conferir a chave daquele backup e a integridade do download; não substituir dumps.        |
| Artefato ausente ou expirado         | Selecionar uma execução recente bem-sucedida, dentro da retenção de 14 dias.              |
| Limite de registro de imagens        | Repetir a preparação após recuperação do registro; o restore depende das imagens fixadas. |
| Docker indisponível ou sem permissão | Corrigir o acesso local ao Docker antes de repetir.                                       |
| Postgres não ficou pronto            | Conferir recursos e logs do ensaio, sem apontar o comando a outro banco.                  |
| Erro em roles/schema/dados           | Conferir checkout, versões de Auth/Storage e compatibilidade; não ignorar o erro.         |

Se a chave não estiver recuperável, preservar o artefato e registrar o bloqueio.
Rotação de chave/secrets e geração de novo backup exigem autorização própria;
uma chave nova não abre arquivos cifrados com a chave anterior.
