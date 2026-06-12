# Design: Skill `docs-sync` — Sincronização de docs antes de commits

**Data:** 2026-06-12
**Status:** Aprovado

---

## Contexto

O projeto acumula mudanças rapidamente (novas tabelas, componentes, modelos de IA) e a
documentação (README.md, CLAUDE.md, comentários inline) acaba ficando para trás. A solução é
uma skill de projeto que Claude invoca antes de qualquer `git commit`, garantindo que toda a
documentação reflita o estado real do código.

## Escopo

A skill cobre três camadas:
1. **README.md** — visão geral para novos colaboradores / GitHub
2. **CLAUDE.md** — guia técnico interno para Claude Code
3. **Comentários inline** — `src/**/*.ts`, `src/**/*.tsx`, `docker/*.sql`, `docker/*.js`

## Gatilho

- **Regra no CLAUDE.md:** instrução explícita para invocar `/docs-sync` antes de qualquer commit
- **Hook `PreToolUse`** em `.claude/settings.json`: detecta `git commit` no Bash e imprime
  lembrete visível no contexto de Claude

## O que a skill faz (passo a passo)

1. Ler todos os arquivos fonte listados acima
2. Comparar com o conteúdo atual de README.md e CLAUDE.md
3. Atualizar README.md para refletir a arquitetura real (Postgres → PostgREST → React, abas,
   tabelas, comandos)
4. Atualizar CLAUDE.md corrigindo qualquer informação obsoleta
5. Revisar comentários inline buscando: referências a modelos hardcoded, paths de arquivos
   removidos, features que não existem mais
6. Fazer `git add` nos arquivos alterados para incluí-los no commit em andamento
7. Reportar um resumo conciso do que foi atualizado

## Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `.claude/skills/docs-sync.md` | Criar (skill de projeto) |
| `.claude/settings.json` | Criar (hook PreToolUse) |
| `.gitignore` | Atualizar (rastrear `.claude/skills/` e `docs/`, excluir só arquivos locais) |
| `CLAUDE.md` | Atualizar (regra de pré-commit + dados de arquitetura) |
| `README.md` | Reescrever completo |
| `src/components/Chat.tsx` | Corrigir comentário linha 154 |
| `src/data.ts` | Investigar e limpar `const semDados = false` |

## O que NÃO está no escopo

- Adicionar comentários onde não existem (só corrigir os desatualizados)
- Refatorar código
- Atualizar `docs/superpowers/plans/` ou `docs/superpowers/specs/` (são artefatos de design)

## Verificação

Após implementação:
1. Abrir `README.md` e confirmar que descreve o fluxo real (Docker + PostgREST + Chat + Rankings)
2. Abrir `CLAUDE.md` e confirmar a regra de pré-commit e dados corretos
3. Invocar `/docs-sync` manualmente e verificar que o resumo final lista as mudanças
4. Tentar `git commit` e confirmar que o hook imprime o lembrete
5. `git status` após a skill rodar deve mostrar os arquivos de docs staged
