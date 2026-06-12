# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Painel comparativo de imóveis (aluguel/venda em Poços de Caldas + São João da Boa Vista/SP).
SPA em React + Vite + TypeScript com duas abas: **Painel** (lista filtrável/ordenável de cartões,
com edição de status/notas/WhatsApp) e **Chat** (perguntas em linguagem natural sobre os imóveis
via OpenRouter). Toda a UI em **português do Brasil**.

## Comandos

```bash
npm install              # dependências (uma vez)
npm run dev              # Vite dev server em http://localhost:5173
npm run build            # tsc -b + vite build → /dist
npm run preview          # serve o /dist

docker compose up -d     # sobe Postgres (5432) + PostgREST (3000)
node docker/seed.js      # popula a tabela a partir de src/imoveis.json (requer o arquivo)
```

Não há suíte de testes nem linter configurado — `npm run build` (que roda `tsc -b`) é a única
verificação automática. O `tsconfig.json` é estrito (`strict`, `noUnusedLocals`,
`noUnusedParameters`), então qualquer import/variável não usada quebra o build.

### Para rodar o app de verdade

São **três processos**: `docker compose up -d` (banco + API), `npm run dev` (front). O Painel
busca de `http://localhost:3000` (PostgREST) — sem o Docker no ar, a aba Painel fica em
"Carregando..." indefinidamente. O Chat exige `VITE_OPENROUTER_API_KEY` no `.env`.

## Arquitetura — o fluxo de dados

O `README.md` está **desatualizado**: ele descreve a versão antiga onde os dados vinham só de um
JSON estático. Hoje o caminho real é:

```
Postgres (docker/init.sql)  →  PostgREST :3000  →  src/data.ts (fetch)  →  React
```

- **`docker/init.sql`** define a tabela `imoveis` (uma linha por imóvel, campos achatados:
  `tipo_imovel`, `custo_mensal_total`, `garagem_vagas`, `status`, `notas`, `whatsapp`, ...).
  Essa é a fonte de verdade do schema. `docker/seed.js` carrega `src/imoveis.json` (estrutura
  **aninhada** — `valores`, `garagem`, `quintal_area_externa`) e achata para a tabela.
- **`src/data.ts`** é a única camada de acesso. `DbRow` (formato achatado do banco) →
  `toImovel()` → `Imovel` (formato curto que a UI usa, ex.: `n`, `cond`, `gar`, `custo`).
  Escritas vão direto via `PATCH` do PostgREST: `salvarStatus`, `salvarNotas`, `salvarWhatsapp`.
  Há um cache `rowsById` das linhas cruas para o export JSON preservar o formato original do banco.
- **Três formatos coexistem** e é fácil confundi-los: `RawImovel` (JSON aninhado, em `types.ts`,
  usado pelo seed), `DbRow` (achatado, em `data.ts`, espelha a tabela) e `Imovel` (normalizado,
  nomes curtos, consumido pelos componentes). Ao adicionar um campo, propague pelos três + `init.sql`.

### Painel vs. Chat

- **`App.tsx`** só alterna entre `<Painel/>` e `<Chat/>`.
- **`Painel.tsx`** detém o estado: lista de imóveis + `FilterState`. `filtra()` (em `data.ts`)
  aplica filtros e ordenação — **replica fielmente a função `filtra()` do HTML original**, então
  mudanças de lógica de filtro/ordenação devem manter essa paridade. As mutações são otimistas:
  o handler chama `salvar*` e atualiza o estado local com o valor retornado.
- **`Chat.tsx`** + **`openrouter.ts`**: gera o JSON completo dos imóveis (`gerarJsonImoveis`),
  guarda no `sessionStorage`, e o reenvia **inteiro como system prompt em toda mensagem**
  (sem RAG, por decisão de projeto). Chamada direta do browser para `openrouter.ai`. Modelos
  ficam hardcoded em `MODELOS` (`openrouter.ts`). Headers HTTP só aceitam ISO-8859-1, então o
  `X-Title` é mantido em ASCII puro de propósito.

## Convenções específicas

- **Status do imóvel** (`StatusImovel`): `'nao_analisado' | 'aguardando' | 'inviabilizado'`.
  No filtro "todos", imóveis `inviabilizado` são **ocultados** (ver `filtra()`).
- Valores monetários: sempre `brl()` (em `data.ts`). Custo mensal = `aluguel + condominio + iptu`.
- WhatsApp: `salvarWhatsapp` grava só dígitos; `linkWhatsapp` monta o `wa.me`. Número deve incluir DDI.
- A chave do OpenRouter precisa do prefixo **`VITE_`** para chegar ao client via `import.meta.env`.
  O `.env` está no `.gitignore` — não commitar.
