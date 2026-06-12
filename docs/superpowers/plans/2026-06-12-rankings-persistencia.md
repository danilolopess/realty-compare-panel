# Rankings — Persistência no Banco de Dados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvar rankings gerados pela IA no banco de dados e recarregá-los automaticamente ao abrir a página, permitindo sobrescrever com uma nova geração.

**Architecture:** Nova tabela `rankings` no Postgres (chave primária = `config_id`). Duas funções em `data.ts` fazem leitura e UPSERT via PostgREST. `RankingCard` carrega do banco no mount e salva após cada geração.

**Tech Stack:** React + TypeScript, PostgREST (http://localhost:3000), Postgres (docker).

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `docker/init.sql` | Adicionar `CREATE TABLE IF NOT EXISTS rankings` |
| `src/data.ts` | Adicionar `RankingSalvo`, `carregarRankingSalvo()`, `salvarRanking()` |
| `src/components/RankingCard.tsx` | Estado `'carregando'`, `useEffect` de carga, `geradoEm`, salvar após geração |

---

## Task 1: Criar tabela `rankings` no banco

**Files:**
- Modify: `docker/init.sql`

- [ ] **Step 1: Adicionar o DDL ao `docker/init.sql`**

Abrir `docker/init.sql` e adicionar ao final (após o bloco de `chat_sessions`):

```sql
-- Rankings gerados por IA. Um registro por config_id (chave primária).
-- Sobrescrito a cada nova geração.
CREATE TABLE IF NOT EXISTS rankings (
  config_id   TEXT PRIMARY KEY,
  conteudo    TEXT NOT NULL,
  user_input  TEXT,
  gerado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Aplicar o DDL no banco vivo**

O volume Postgres já existe, então o `init.sql` não roda novamente no container. Executar o DDL diretamente:

```bash
docker exec -i imoveis-db-1 psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS rankings (
  config_id   TEXT PRIMARY KEY,
  conteudo    TEXT NOT NULL,
  user_input  TEXT,
  gerado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);"
```

Saída esperada: `CREATE TABLE`

> **Nota:** o nome do container pode variar. Se `imoveis-db-1` não existir, verificar com `docker ps` e ajustar.

- [ ] **Step 3: Verificar a tabela no banco**

```bash
docker exec -i imoveis-db-1 psql -U postgres -d postgres -c "\d rankings"
```

Esperado: listagem das 4 colunas (`config_id`, `conteudo`, `user_input`, `gerado_em`).

- [ ] **Step 4: Recarregar o schema do PostgREST**

O PostgREST cacheia o schema. Forçar reload sem derrubar o container:

```bash
docker kill --signal=SIGUSR1 imoveis-postgrest-1
```

> Verificar o nome do container PostgREST com `docker ps` se necessário. Aguardar ~2 s e testar:

```bash
curl -s http://localhost:3000/rankings
```

Esperado: `[]` (array vazio — tabela existe e está acessível).

---

## Task 2: Funções de acesso em `data.ts`

**Files:**
- Modify: `src/data.ts`

- [ ] **Step 1: Adicionar tipo `RankingSalvo` em `data.ts`**

Localizar o bloco de exports de tipos/interfaces no início do arquivo (após os imports de `types`) e adicionar após a interface `DbRow`:

```ts
export interface RankingSalvo {
  conteudo: string
  userInput: string | null
  geradoEm: string
}
```

- [ ] **Step 2: Adicionar função `carregarRankingSalvo` em `data.ts`**

Adicionar ao final do arquivo (antes ou depois do bloco de sessões — qualquer posição é válida):

```ts
// =====================================================================
// Rankings gerados por IA (tabela rankings via PostgREST)
// =====================================================================

export async function carregarRankingSalvo(configId: string): Promise<RankingSalvo | null> {
  const res = await fetch(`${API}/rankings?config_id=eq.${configId}&limit=1`)
  if (!res.ok) return null
  const rows: { config_id: string; conteudo: string; user_input: string | null; gerado_em: string }[] =
    await res.json()
  if (!rows.length) return null
  const r = rows[0]
  return { conteudo: r.conteudo, userInput: r.user_input, geradoEm: r.gerado_em }
}
```

- [ ] **Step 3: Adicionar função `salvarRanking` em `data.ts`**

Logo após `carregarRankingSalvo`:

```ts
export async function salvarRanking(
  configId: string,
  conteudo: string,
  userInput?: string,
): Promise<void> {
  const res = await fetch(`${API}/rankings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      config_id: configId,
      conteudo,
      user_input: userInput ?? null,
      gerado_em: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Falha ao salvar ranking (${res.status})`)
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: sem erros de TypeScript. Se aparecer `noUnusedLocals` para as novas funções, verificar se os imports em `RankingCard.tsx` já foram adicionados (próxima task).

---

## Task 3: Atualizar `RankingCard.tsx`

**Files:**
- Modify: `src/components/RankingCard.tsx`

- [ ] **Step 1: Atualizar imports — adicionar as novas funções de `data.ts`**

No topo do arquivo, o import atual é:

```ts
import { gerarRanking } from '../rankings'
```

Acrescentar as funções de data:

```ts
import { carregarRankingSalvo, salvarRanking } from '../data'
import type { RankingSalvo } from '../data'
import { gerarRanking } from '../rankings'
```

- [ ] **Step 2: Expandir o tipo `Estado` para incluir `'carregando'`**

Substituir:

```ts
type Estado = 'idle' | 'loading' | 'done' | 'error'
```

Por:

```ts
type Estado = 'carregando' | 'idle' | 'loading' | 'done' | 'error'
```

- [ ] **Step 3: Atualizar o estado inicial e adicionar estados novos**

Substituir o bloco de `useState` e a constante `isPersonalizado` atual:

```ts
const [estado, setEstado] = useState<Estado>('idle')
const [resultado, setResultado] = useState('')
const [erro, setErro] = useState<string | null>(null)
const [userInput, setUserInput] = useState('')
```

Por:

```ts
const [estado, setEstado] = useState<Estado>('carregando')
const [resultado, setResultado] = useState('')
const [erro, setErro] = useState<string | null>(null)
const [userInput, setUserInput] = useState('')
const [geradoEm, setGeradoEm] = useState<string | null>(null)
const [erroSalvar, setErroSalvar] = useState<string | null>(null)
```

- [ ] **Step 4: Adicionar `useEffect` para carregar ranking salvo no mount**

Adicionar logo após o bloco de `useState`, antes da constante `isPersonalizado`:

```ts
useEffect(() => {
  carregarRankingSalvo(config.id)
    .then((salvo: RankingSalvo | null) => {
      if (salvo) {
        setResultado(salvo.conteudo)
        if (salvo.userInput) setUserInput(salvo.userInput)
        setGeradoEm(salvo.geradoEm)
        setEstado('done')
      } else {
        setEstado('idle')
      }
    })
    .catch(() => setEstado('idle'))
}, [config.id])
```

- [ ] **Step 5: Atualizar a função `gerar` para salvar no banco após geração**

Substituir a função `gerar` atual:

```ts
async function gerar() {
  if (!podeGerar) return
  setEstado('loading')
  setErro(null)
  try {
    const texto = await gerarRanking(config, isPersonalizado ? userInput : undefined)
    setResultado(texto)
    setEstado('done')
  } catch (e) {
    setErro(e instanceof Error ? e.message : 'Erro ao gerar o ranking.')
    setEstado('error')
  }
}
```

Por:

```ts
async function gerar() {
  if (!podeGerar) return
  setEstado('loading')
  setErro(null)
  setErroSalvar(null)
  try {
    const texto = await gerarRanking(config, isPersonalizado ? userInput : undefined)
    const agora = new Date().toISOString()
    setResultado(texto)
    setGeradoEm(agora)
    setEstado('done')
    salvarRanking(config.id, texto, isPersonalizado ? userInput : undefined).catch(() =>
      setErroSalvar('Não foi possível salvar o ranking.'),
    )
  } catch (e) {
    setErro(e instanceof Error ? e.message : 'Erro ao gerar o ranking.')
    setEstado('error')
  }
}
```

- [ ] **Step 6: Adicionar helper de formatação de data (dentro do componente, antes do return)**

```ts
function formatarData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 7: Adicionar render para estado `'carregando'`**

No JSX, localizar a condição de `estado !== 'loading' && estado !== 'done'` e adicionar antes dela o bloco do estado de carregamento inicial:

```tsx
{estado === 'carregando' && (
  <div className="ranking-loading">
    <p className="ranking-loading-msg">Carregando...</p>
  </div>
)}
```

A condição do `ranking-card-body` existente deve excluir `'carregando'` também. Substituir:

```tsx
{estado !== 'loading' && estado !== 'done' && (
```

Por:

```tsx
{estado !== 'loading' && estado !== 'done' && estado !== 'carregando' && (
```

- [ ] **Step 8: Atualizar o bloco `estado === 'done'` para mostrar a data e erro de salvamento**

Substituir o bloco `{estado === 'done' && (` atual:

```tsx
{estado === 'done' && (
  <div className="ranking-resultado">
    <div className="ranking-resultado-conteudo chat-bolha">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {resultado}
      </ReactMarkdown>
    </div>
    <button
      className="btn ranking-btn-refazer"
      onClick={() => {
        setEstado('idle')
        setResultado('')
      }}
    >
      Gerar novamente
    </button>
  </div>
)}
```

Por:

```tsx
{estado === 'done' && (
  <div className="ranking-resultado">
    <div className="ranking-resultado-conteudo chat-bolha">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {resultado}
      </ReactMarkdown>
    </div>
    {geradoEm && (
      <p className="ranking-gerado-em">Gerado em {formatarData(geradoEm)}</p>
    )}
    {erroSalvar && (
      <div className="ranking-erro">{erroSalvar}</div>
    )}
    {isPersonalizado && (
      <textarea
        className="ranking-textarea"
        placeholder="Descreva o ranking que você quer..."
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        rows={3}
      />
    )}
    <button
      className="btn ranking-btn-refazer"
      onClick={() => {
        setEstado('idle')
        setResultado('')
      }}
    >
      Gerar novamente
    </button>
  </div>
)}
```

- [ ] **Step 9: Verificar build sem erros**

```bash
npm run build
```

Esperado: compilação limpa sem erros TypeScript. Se `RankingSalvo` for apontado como importado mas não usado diretamente no JSX, verificar que o `useEffect` o referencia corretamente.

---

## Task 4: Smoke test manual

- [ ] **Step 1: Subir os processos**

```bash
docker compose up -d   # banco + PostgREST
npm run dev            # Vite em http://localhost:5173
```

- [ ] **Step 2: Verificar carregamento inicial (sem dados)**

Abrir `http://localhost:5173`, navegar para a aba Rankings. Cada card deve aparecer com o botão "Gerar Ranking" (estado `idle`), sem mensagem de erro.

- [ ] **Step 3: Gerar e verificar persistência**

1. Clicar em "Gerar Ranking" em qualquer card (ex: Custo-Benefício).
2. Aguardar a geração. O resultado deve aparecer com a data no rodapé ("Gerado em DD/MM/AAAA às HH:MM").
3. **Recarregar a página** (F5). O card deve voltar em estado `done` com o mesmo resultado — confirmando que foi lido do banco.

- [ ] **Step 4: Verificar sobrescrita**

1. Com um ranking já carregado, clicar em "Gerar novamente".
2. Aguardar nova geração. Data deve atualizar.
3. Recarregar a página e confirmar que o novo ranking é exibido (não o anterior).

- [ ] **Step 5: Verificar Personalizado**

1. No card "Personalizado", digitar um critério (ex: "melhores para home office").
2. Gerar, aguardar.
3. Recarregar a página: o card Personalizado deve aparecer em `done` com o resultado e o campo de texto preenchido com o critério anterior.

- [ ] **Step 6: Verificar diretamente no banco**

```bash
docker exec -i imoveis-db-1 psql -U postgres -d postgres -c "SELECT config_id, length(conteudo), user_input, gerado_em FROM rankings;"
```

Esperado: linhas para os rankings gerados, com `length(conteudo)` > 0 e `gerado_em` recente.
