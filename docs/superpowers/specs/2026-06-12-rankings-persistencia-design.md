# Design: Persistência de Rankings no Banco de Dados

**Data:** 2026-06-12  
**Status:** Aprovado

---

## Objetivo

Rankings gerados pela IA devem ser salvos no banco de dados e recarregados automaticamente ao abrir a página. O usuário pode gerar um novo ranking a qualquer momento, sobrescrevendo o anterior.

---

## Banco de Dados

Nova tabela `rankings` no Postgres (adicionada ao `docker/init.sql` e aplicada no banco vivo):

```sql
CREATE TABLE IF NOT EXISTS rankings (
  config_id   TEXT PRIMARY KEY,
  conteudo    TEXT NOT NULL,
  user_input  TEXT,
  gerado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `config_id`: chave do ranking (`'custo-beneficio'`, `'pets'`, `'melhores-imoveis'`, `'personalizado'`).
- `conteudo`: markdown retornado pela IA.
- `user_input`: preenchido apenas para o tipo `'personalizado'`; nulo nos demais.
- `gerado_em`: timestamp da última geração (atualizado a cada sobrescrita).

A gravação usa `UPSERT` via PostgREST (`POST` com header `Prefer: resolution=merge-duplicates`), o que garante que uma segunda chamada para o mesmo `config_id` substitua o registro existente.

---

## Camada de Dados (`src/data.ts`)

Duas novas funções exportadas:

### `carregarRankingSalvo(configId: string): Promise<RankingSalvo | null>`

- `GET /rankings?config_id=eq.<configId>&limit=1` no PostgREST.
- Retorna `{ conteudo, userInput, geradoEm }` se encontrado, `null` caso contrário.

### `salvarRanking(configId: string, conteudo: string, userInput?: string): Promise<void>`

- `POST /rankings` com header `Prefer: resolution=merge-duplicates`.
- Body: `{ config_id, conteudo, user_input, gerado_em: new Date().toISOString() }`.

Tipo auxiliar (em `data.ts`):

```ts
export interface RankingSalvo {
  conteudo: string
  userInput: string | null
  geradoEm: string
}
```

---

## Componente `RankingCard.tsx`

### Estado inicial

Ao montar o componente:
1. Entra em estado `'carregando'` (novo estado, exibe mensagem discreta "Carregando...").
2. Chama `carregarRankingSalvo(config.id)`.
3. Se encontrar resultado: define `resultado`, `userInput` (restaurando o campo de texto para o ranking personalizado) e `geradoEm`; avança para estado `'done'`.
4. Se não encontrar: avança para estado `'idle'`.

### Novos estados

```ts
type Estado = 'carregando' | 'idle' | 'loading' | 'done' | 'error'
```

### Exibição da data

No estado `'done'`, abaixo do resultado, exibir discretamente a data de geração:  
`"Gerado em DD/MM/AAAA às HH:MM"`

### Fluxo de geração (sobrescrita)

1. Usuário clica em "Gerar Ranking" (estado `idle`) ou "Gerar novamente" (estado `done`).
2. Entra em `'loading'`, chama `gerarRanking()`.
3. Ao receber resposta: chama `salvarRanking()` e avança para `'done'`.
4. Em caso de erro no salvamento: exibe aviso não-bloqueante (o resultado ainda é exibido).

### Campo de texto do Personalizado

- Ao carregar ranking salvo, o `userInput` do banco preenche o campo de texto.
- No estado `'done'`, o campo fica visível e editável (para o usuário poder ajustar antes de "Gerar novamente").

---

## Migrations

- `docker/init.sql`: adicionar o `CREATE TABLE IF NOT EXISTS rankings` ao final.
- Banco vivo: executar o mesmo DDL diretamente via `psql` (o volume já existe; não é possível recriar o container para reaplicar o init.sql).

---

## Fora de Escopo

- Histórico de versões de rankings (guarda apenas o último por `config_id`).
- Autenticação ou isolamento por usuário.
- Cache local (sessionStorage) dos rankings.
