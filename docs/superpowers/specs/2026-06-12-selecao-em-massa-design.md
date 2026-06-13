# Seleção em massa na tabela de imóveis

**Data:** 2026-06-12
**Escopo:** Aba "Imóveis" (`GerenciarImoveis.tsx`) — seleção múltipla com exclusão e alteração de status em lote.

---

## Contexto

A tabela de imóveis cadastrados exibe todos os registros sem capacidade de operação em lote. O objetivo é adicionar checkboxes para seleção múltipla e uma barra de ações que apareça quando há itens selecionados, permitindo excluir ou alterar o status de vários imóveis de uma só vez.

---

## Estrutura da tabela

- Nova primeira coluna `☐` inserida antes de `#`.
- **Header `<th>`**: checkbox "selecionar todos" com estado `indeterminate` (via `useRef`) quando a seleção é parcial.
- **`<td>` de cada linha**: checkbox individual; o `<td>` chama `e.stopPropagation()` para evitar duplo toggle.
- Clicar em qualquer outra célula da linha também alterna a seleção (handler `onClick` no `<tr>`).
- Linha selecionada recebe classe CSS `selecionada` → fundo `#eef2fb`.
- A media query que esconde a 4ª coluna em mobile (`nth-child(4)`) passa para `nth-child(5)` devido ao deslocamento.

---

## Barra de ações em massa

Renderizada entre o header da página e a tabela, visível somente quando `selecionados.size > 0`.

Controlada por `modo: 'idle' | 'status' | 'excluir'`:

**idle**
```
[ N selecionado(s) ]  [ Limpar seleção ]  [ Alterar status ▾ ]  [ Excluir ]
```

**status** (após clicar "Alterar status")
```
[ Novo status: <select> ]  [ Cancelar ]  [ Aplicar a N imóveis ]
```
O `<select>` oferece as três opções de `StatusImovel`: `nao_analisado`, `aguardando`, `inviabilizado`.

**excluir** (após clicar "Excluir")
```
[ Excluir N imóveis? Esta ação é irreversível. ]  [ Cancelar ]  [ Confirmar ]
```

Durante execução o botão ativo exibe "Salvando…" / "Excluindo…" e fica `disabled`. Erros são exibidos em uma `div.imoveis-barra-erro` acima da barra.

---

## Camada de dados — `src/data.ts`

Duas novas funções exportadas:

```ts
// Exclui N imóveis em uma única requisição DELETE
export async function excluirImoveis(ids: number[]): Promise<void>
// DELETE /imoveis?id=in.(1,2,3)

// Altera o status de N imóveis em uma única requisição PATCH
export async function alterarStatusEmLote(
  ids: number[],
  status: StatusImovel,
): Promise<void>
// PATCH /imoveis?id=in.(1,2,3) → { status, status_changed_at: now }
```

---

## Pós-operação (ambas)

1. `purgarTodosRankings()` — rankings ficam obsoletos ao alterar/excluir imóveis.
2. `sessionStorage.removeItem('imoveis_chat_json')` — força regeneração do contexto do chat.
3. `fetchImoveis()` → atualiza lista local.
4. `setSelecionados(new Set())` — limpa seleção.
5. `setModo('idle')` — reseta estado da barra.

---

## Estado em `GerenciarImoveis.tsx`

| Estado | Tipo | Descrição |
|---|---|---|
| `selecionados` | `Set<number>` | IDs selecionados |
| `modo` | `'idle' \| 'status' \| 'excluir'` | Estado da barra de ações |
| `statusPendente` | `StatusImovel` | Valor do select na tela de status |
| `operando` | `boolean` | Requisição em andamento |
| `erroOperacao` | `string \| null` | Mensagem de erro |

---

## CSS

Novas classes na seção "Aba Imóveis" de `index.css`:

- `.th-check`, `.td-check` — coluna de checkbox (36 px, centralizado)
- `.imoveis-tabela input[type=checkbox]` — tamanho e `accent-color`
- `.imoveis-tabela tr.selecionada td` — fundo azul claro
- `.imoveis-tabela tr.selecionada:hover td` — fundo azul ligeiramente mais escuro
- `.imoveis-barra-massa` — barra de ações (fundo `var(--azul)`, branco, flex, gap)
- `.imoveis-barra-massa-count` — flex:1 para empurrar botões à direita
- `.imoveis-barra-erro` — fundo vermelho claro para erros

---

## Fora do escopo

- Persistência da seleção entre navegações de aba.
- Exportação dos itens selecionados (avaliada para versão futura).
- Edição de outros campos em lote (link, notas, WhatsApp).
