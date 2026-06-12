# Painel Comparativo de Imóveis

Refatoração em **React + Vite + TypeScript** do antigo `painel_comparativo_casas.html`.
O layout é idêntico ao original; a única diferença é que os dados agora vêm de um arquivo
JSON em vez de estarem embutidos no HTML.

## Pré-requisito

Instale o **Node.js 18+** (https://nodejs.org). O `npm` vem junto.

## Como rodar

```bash
npm install      # instala as dependências (uma única vez)
npm run dev      # sobe o servidor de desenvolvimento (http://localhost:5173)
```

Outros comandos:

```bash
npm run build    # gera a versão de produção em /dist
npm run preview  # serve a versão de produção localmente
```

## Atualizando os imóveis

Os dados ficam em **`src/imoveis.json`** (mesmo formato do arquivo original na raiz do projeto).
É só editar/colar o JSON atualizado nesse arquivo e salvar — o painel recarrega sozinho
durante o `npm run dev`. Não há banco de dados nem persistência; tudo é "hardcoded" no JSON.

> O JSON usa uma estrutura aninhada (`valores`, `garagem`, `quintal_area_externa`, ...).
> A conversão para o formato que a tela usa acontece em `src/data.ts` (função `toImovel`),
> replicando as mesmas regras do HTML original (ex.: custo mensal = aluguel + condomínio + IPTU).

## Estrutura

```
src/
  imoveis.json          # fonte de dados (atualize aqui)
  types.ts              # tipos do JSON cru e do imóvel normalizado
  data.ts               # carrega o JSON, normaliza, filtra e ordena
  index.css             # estilos (cópia fiel do <style> do HTML original)
  main.tsx              # ponto de entrada
  App.tsx               # estado dos filtros + montagem da página
  components/
    Controls.tsx        # barra de filtros (tipo, cidade, ordenação, etc.)
    Stats.tsx           # cartões de estatística (menor/médio/maior custo)
    Card.tsx            # cartão de cada imóvel
    Legend.tsx          # legenda de cores no rodapé
```
