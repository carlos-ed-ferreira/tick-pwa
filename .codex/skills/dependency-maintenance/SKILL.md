---
name: dependency-maintenance
description: >-
  Auditar, classificar, atualizar e validar dependências npm do Tick com mudanças dedicadas e seguras. Usar para advisories, upgrades patch/minor/major, atualização do Supabase CLI ou manutenção de package.json e package-lock.json.
---

# Dependency maintenance

## Classificar

1. Ler a política em `../../../REVIEW.md`, as regras em
   `../../../AGENTS.md` e gaps em
   `../../../docs/planning/implementation-plan.md`.
2. Identificar se a dependência é direta ou transitiva e de produção ou
   desenvolvimento.
3. Registrar versão atual, versão alvo, severidade, alcance real, licença,
   manutenção e impacto em bundle/runtime.
4. Verificar se a stack atual já resolve o problema sem nova dependência.
5. Separar patch, minor, major e security update.

Não usar `--force`, atualização destrutiva ou auto-fix sem revisar o plano
resultante.

## Preparar a mudança

1. Trabalhar em alteração dedicada e pequena.
2. Ler changelog, migration guide, peer dependencies e requisitos de runtime.
3. Atualizar somente manifest e lockfile necessários pelo npm.
4. Inspecionar o diff por pacotes inesperados, scripts de instalação e mudança
   de resolução.
5. Para major, definir migração e rollback antes de editar consumidores.
6. Tratar atualização da Supabase CLI separadamente; ela não autoriza gerar ou
   aplicar migrations.

## Validar

1. Executar `npm ls --depth=0` e o audit aplicável.
2. Rodar `npm run check`.
3. Rodar E2E, banco e PWA conforme os pacotes afetados.
4. Comparar vulnerabilidades com o baseline: não aceitar crítica/alta nova.
5. Medir bundle ou runtime quando a dependência os afetar.
6. Revisar compatibilidade com Node, Next, React, Dexie, Serwist e Supabase
   conforme o alcance.

## Entregar

Informar versões anterior/alvo, motivação, advisories, changelog, gates, impacto
e rollback. Patch/minor só pode ser candidato a auto-merge depois de todos os
gates; major exige revisão manual.
