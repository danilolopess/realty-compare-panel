# Painel Comparativo de Imóveis — Manual de Instruções

SPA em **React + Vite + TypeScript** para pesquisa, comparação e acompanhamento de imóveis para aluguel ou venda. Os dados são armazenados em **PostgreSQL** e expostos via **PostgREST**. A interface inclui filtros avançados, geração de rankings por IA e um chat em linguagem natural sobre os imóveis cadastrados.

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Instalação](#2-instalação)
3. [Configuração do ambiente (.env)](#3-configuração-do-ambiente-env)
   - [OpenRouter](#openrouter-recomendado)
   - [OpenAI](#openai)
   - [IPTU estimado](#iptu-estimado)
4. [Como executar](#4-como-executar)
5. [Abas do painel](#5-abas-do-painel)
   - [Painel](#painel)
   - [Imóveis](#imóveis)
   - [Favoritos](#favoritos)
   - [Flow (Kanban)](#flow-kanban)
   - [Rankings](#rankings)
   - [Chat](#chat)
6. [Como adicionar imóveis](#6-como-adicionar-imóveis)
   - [Cadastro assistido por IA](#cadastro-assistido-por-ia)
   - [Cadastro em lote](#cadastro-em-lote)
   - [Revisão e salvamento](#revisão-e-salvamento)
7. [Gerenciar imóveis existentes](#7-gerenciar-imóveis-existentes)
8. [Exportação de dados](#8-exportação-de-dados)
9. [Estrutura do projeto](#9-estrutura-do-projeto)
10. [Solução de problemas](#10-solução-de-problemas)

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Finalidade |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ | Executa o servidor de desenvolvimento e o build |
| [Docker](https://www.docker.com) | qualquer recente | Sobe o banco de dados PostgreSQL e a API PostgREST |
| Chave de API LLM | — | Necessária para Chat, Rankings e cadastro assistido por IA |

> **Nota:** O Docker deve estar em execução antes de iniciar a aplicação. Sem o banco de dados ativo, a aba **Painel** fica em estado de carregamento indefinidamente.

---

## 2. Instalação

```bash
# 1. Clone o repositório (ou descompacte o projeto)
cd imoveis

# 2. Instale as dependências Node.js (executar apenas uma vez)
npm install

# 3. Suba o banco de dados e a API
docker compose up -d
```

O comando `docker compose up -d` inicia dois contêineres:

- **`db`** — PostgreSQL 16, porta `5432`, com o schema criado automaticamente a partir de `docker/init.sql`.
- **`postgrest`** — PostgREST, porta `3000`, que expõe a tabela `imoveis` como API REST.

> Na primeira execução, o Docker baixa as imagens necessárias. Nas execuções seguintes, o processo é instantâneo.

---

## 3. Configuração do ambiente (.env)

Crie o arquivo `.env` na raiz do projeto. Ele **não é versionado** (está no `.gitignore`).

```bash
# Copie o exemplo e edite com suas credenciais
cp .env.example .env   # se existir, ou crie manualmente conforme abaixo
```

### OpenRouter (recomendado)

O [OpenRouter](https://openrouter.ai) agrega centenas de modelos de diferentes provedores (Google, Anthropic, Meta, Mistral, etc.) em uma única API compatível com o padrão OpenAI. Ideal para experimentar diferentes modelos sem criar múltiplas contas.

```dotenv
VITE_LLM_API_KEY=sk-or-v1-...           # chave gerada em openrouter.ai/keys
VITE_LLM_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
VITE_LLM_MODEL=google/gemini-2.5-flash-lite-preview-09-2025:nitro
```

Exemplos de modelos disponíveis no OpenRouter:
- `google/gemini-2.5-flash-lite-preview-09-2025:nitro` — rápido e econômico (padrão atual)
- `anthropic/claude-sonnet-4-5` — alta qualidade para análises complexas
- `openai/gpt-4o-mini` — equilibrio entre custo e qualidade

### OpenAI

Para usar diretamente a API da OpenAI, altere as três variáveis:

```dotenv
VITE_LLM_API_KEY=sk-proj-...            # chave gerada em platform.openai.com/api-keys
VITE_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
VITE_LLM_MODEL=gpt-4o-mini
```

> A aplicação é compatível com qualquer API que siga o padrão OpenAI Chat Completions. Basta ajustar `VITE_LLM_ENDPOINT` e `VITE_LLM_MODEL`.

### IPTU estimado

Quando o IPTU de um imóvel não é informado, o sistema usa um valor estimado padrão. Configure conforme a realidade local:

```dotenv
VITE_IPTU_ESTIMADO=80    # valor em reais, aplicado a imóveis sem IPTU informado
```

> **Importante:** Sempre que alterar o `.env`, reinicie o servidor de desenvolvimento (`Ctrl+C` e `npm run dev`) para que as novas variáveis sejam carregadas.

---

## 4. Como executar

A aplicação requer **dois processos simultâneos**:

```bash
# Terminal 1 — banco de dados e API (manter em execução)
docker compose up -d

# Terminal 2 — servidor de desenvolvimento front-end
npm run dev
```

Acesse **http://localhost:5173** no navegador.

| Serviço | Endereço | Descrição |
|---|---|---|
| Front-end (Vite) | http://localhost:5173 | Interface da aplicação |
| API (PostgREST) | http://localhost:3000 | API REST do banco de dados |
| Banco (PostgreSQL) | localhost:5432 | Banco de dados direto |

### Outros comandos disponíveis

```bash
npm run build    # compila o projeto para produção (saída em /dist)
npm run preview  # serve a versão de produção localmente

docker compose down          # para e remove os contêineres
docker compose down -v       # para, remove os contêineres E apaga os dados do banco
```

> **Atenção:** `docker compose down -v` apaga permanentemente todos os imóveis cadastrados. Use somente se desejar reiniciar do zero.

---

## 5. Abas do painel

A aplicação é organizada em seis abas, acessíveis pela barra de navegação superior.

### Painel

A aba principal. Exibe todos os imóveis cadastrados em formato de cartões, com filtros e ordenação.

**Filtros disponíveis:**
- Tipo (Casa / Apartamento)
- Cidade
- Bairro
- Custo máximo mensal (aluguel + condomínio + IPTU)
- Garagem (com / sem)
- Quintal (com / sem)
- Aceita pet
- Status (não analisado / aguardando / todos)
- Campo de busca livre (bairro, imobiliária, observações)

**Ações por cartão:**
- Alterar status: **Não analisado**, **Aguardando** ou **Inviabilizado**
- Registrar notas pessoais
- Salvar número de WhatsApp para contato direto
- Marcar como favorito (estrela)
- Abrir link do anúncio original

> Imóveis com status **Inviabilizado** são ocultados no filtro padrão "Todos". Para visualizá-los, selecione o filtro de status correspondente.

---

### Imóveis

Aba de gerenciamento do cadastro. Apresenta todos os imóveis em tabela com busca e ordenação por qualquer coluna.

**Funcionalidades:**
- Buscar por tipo, bairro, cidade ou operação
- Ordenar por qualquer coluna (clique no cabeçalho)
- Editar dados de um imóvel individualmente
- Excluir imóvel individual (ícone de lixeira)
- Selecionar múltiplos imóveis para exclusão em lote
- **Adicionar novo imóvel** com assistência de IA

Consulte a seção [Como adicionar imóveis](#6-como-adicionar-imóveis) para o fluxo completo de cadastro.

---

### Favoritos

Exibe apenas os imóveis marcados com estrela (favoritos), com os mesmos filtros e funcionalidades da aba Painel. Útil para acompanhar os imóveis de maior interesse sem perder de vista os demais.

---

### Flow (Kanban)

Visualização em quadro Kanban com três colunas correspondentes aos status possíveis:

| Coluna | Descrição |
|---|---|
| **Não analisado** | Imóvel recém-cadastrado, ainda sem avaliação |
| **Aguardando** | Imóvel em análise, aguardando visita ou informação |
| **Inviabilizado** | Descartado (oculto no Painel por padrão) |

**Como usar:** Arraste um cartão de uma coluna para outra. A mudança de status é salva automaticamente no banco de dados. Clique em um cartão para abrir seus detalhes completos em modal.

---

### Rankings

Gera classificações comparativas dos imóveis cadastrados utilizando inteligência artificial. Cada ranking analisa todos os imóveis sob uma perspectiva específica e os ordena com justificativas.

**Rankings disponíveis:**
- **Custo-benefício** — melhor relação entre preço e características
- **Para pets** — avaliação das condições de bem-estar para animais
- **Melhores imóveis** — qualidade absoluta considerando todos os atributos
- **Personalizado** — defina seus próprios critérios em linguagem natural

Os resultados são salvos no banco de dados e reutilizados até que o cadastro de imóveis seja alterado (adição, edição ou exclusão invalida os rankings automaticamente).

> É necessário ter a variável `VITE_LLM_API_KEY` configurada no `.env`.

---

### Chat

Interface de conversa em linguagem natural sobre os imóveis cadastrados. Permite fazer perguntas como:

- *"Qual imóvel tem o menor custo mensal com pelo menos 2 quartos?"*
- *"Quais imóveis aceitam pets e têm quintal?"*
- *"Compare os imóveis do centro com os do bairro X."*
- *"Liste todos os apartamentos com garagem abaixo de R$ 1.500."*

**Características:**
- O assistente recebe como contexto a lista completa dos imóveis cadastrados em cada mensagem (sem RAG — o contexto é enviado integralmente)
- Histórico de conversas salvo no banco de dados com título gerado automaticamente
- Suporte a múltiplas sessões simultâneas (barra lateral esquerda)
- Exportação da conversa em formato Markdown
- Seleção de modelo de IA diretamente na interface

> É necessário ter a variável `VITE_LLM_API_KEY` configurada no `.env`.

---

## 6. Como adicionar imóveis

O cadastro de imóveis é assistido por inteligência artificial. O fluxo aceita tanto descrições em linguagem natural quanto texto copiado diretamente de sites de imobiliárias.

### Cadastro assistido por IA

1. Acesse a aba **Imóveis**
2. Clique em **+ Adicionar imóvel**
3. No campo de texto, descreva o imóvel ou cole o conteúdo copiado de um site

**O sistema aceita qualquer formato de entrada**, por exemplo:

- Descrição resumida:
  ```
  Apartamento no Centro, 2 quartos, 1 vaga de garagem, aceita pet,
  aluguel R$ 950, condomínio R$ 180. Imobiliária XYZ, WhatsApp 5535999990000.
  ```

- **Texto copiado diretamente de um site de imobiliária** (incluindo textos longos com informações irrelevantes — o modelo de IA extrai apenas o que é pertinente):
  ```
  Apartamento tipo Studio no Condomínio Alphaville Garden, localizado na Rua
  das Flores, 123, Bairro Jardim Europa, Poços de Caldas - MG. Área privativa
  de 42m². 1 suíte, 1 vaga de garagem coberta. Lazer completo: piscina,
  academia, salão de festas. Aluguel: R$ 1.200,00 | Condomínio: R$ 350,00.
  IPTU parcelado no condomínio. Contato: (35) 3722-0000 | imobiliaria@exemplo.com.br
  ```

4. Clique em **Interpretar**

O modelo de IA analisa o texto e preenche automaticamente os campos: tipo, cidade, bairro, aluguel, condomínio, IPTU, garagem, quartos, banheiros, área, pets, entre outros.

5. Revise os dados extraídos no formulário e faça ajustes se necessário
6. Clique em **Adicionar** para salvar

### Cadastro em lote

É possível cadastrar **múltiplos imóveis em uma única operação**. Separe as descrições com qualquer delimitador claro:

```
Apartamento no Centro, 2 quartos, R$ 900/mês, sem garagem

---

Casa no Bairro das Rosas, 3 quartos, quintal, garagem 2 vagas,
aluguel R$ 1.400, condomínio R$ 0. Aceita pets.

===

Imóvel 3: Kitnet no Jardim Paulista, 1 quarto, R$ 650/mês.
```

Separadores aceitos: `---`, `===`, `...`, linhas em branco múltiplas, ou qualquer divisor textual claro entre os blocos.

Após a interpretação, a interface apresenta cada imóvel individualmente para revisão. O botão **Adicionar todos** fica disponível somente após a revisão de todos os imóveis do lote.

### Revisão e salvamento

Após a interpretação, é possível:
- Corrigir qualquer campo extraído incorretamente
- Navegar entre os imóveis do lote (botões **Anterior / Próximo**)
- Voltar à etapa de descrição para alterar o texto original

> Se a chave de API (`VITE_LLM_API_KEY`) não estiver configurada ou o serviço retornar erro, o sistema tentará a interpretação até 5 vezes automaticamente antes de exibir a mensagem de falha.

---

## 7. Gerenciar imóveis existentes

### Editar um imóvel

Na aba **Imóveis**, clique no ícone de lápis (✏️) na linha do imóvel desejado. Um modal será aberto com todos os campos editáveis. Salve ao concluir.

### Excluir um imóvel

- **Exclusão individual:** clique no ícone de lixeira (🗑️) na linha do imóvel e confirme no popover.
- **Exclusão em lote:** marque as caixas de seleção dos imóveis desejados (ou use o checkbox do cabeçalho para selecionar todos), clique em **Excluir** e confirme.

> A exclusão é **irreversível**. Não há lixeira ou desfazer.

> Após qualquer alteração no cadastro (adição, edição ou exclusão), os rankings gerados anteriormente são invalidados e precisarão ser regenerados na aba **Rankings**.

---

## 8. Exportação de dados

### Exportar lista de imóveis (JSON)

Na aba **Painel**, com os filtros desejados aplicados, o botão **Exportar JSON** baixa um arquivo `imoveis.json` com os imóveis **atualmente visíveis** (respeitando os filtros selecionados).

### Exportar conversa do Chat (Markdown)

Na aba **Chat**, com uma sessão aberta, clique no ícone de exportação para baixar a conversa completa em formato `.md`.

---

## 9. Estrutura do projeto

```
imoveis/
├── docker/
│   ├── init.sql          # schema do banco (tabelas imoveis, chat_sessions, rankings)
│   └── seed.js           # popula o banco a partir de src/imoveis.json (uso opcional)
├── public/
│   └── prompts/          # configurações de ranking em JSON (carregadas em runtime)
│       ├── ranking-custo-beneficio.json
│       ├── ranking-pets.json
│       ├── ranking-melhores-imoveis.json
│       └── ranking-personalizado.json
├── src/
│   ├── types.ts           # definição de tipos TypeScript
│   ├── data.ts            # camada de acesso a dados (fetch, filtros, persistência)
│   ├── openrouter.ts      # cliente da API LLM (Chat, Rankings, extração)
│   ├── rankings.ts        # lógica de geração de rankings por IA
│   ├── rankingParse.ts    # parser da resposta Markdown do LLM
│   ├── App.tsx            # componente raiz — navegação entre abas
│   └── components/
│       ├── Painel.tsx         # aba Painel (filtros + lista de cartões)
│       ├── GerenciarImoveis.tsx  # aba Imóveis (tabela + ações CRUD)
│       ├── AdicionarImovelForm.tsx # formulário de cadastro com IA
│       ├── EditarImovelModal.tsx   # modal de edição
│       ├── ImovelFormFields.tsx    # campos reutilizáveis do formulário
│       ├── Workflow.tsx       # aba Flow (Kanban drag-and-drop)
│       ├── Rankings.tsx       # aba Rankings
│       ├── Chat.tsx           # aba Chat
│       ├── Card.tsx           # cartão individual de imóvel
│       ├── Controls.tsx       # barra de filtros
│       └── Stats.tsx          # cartões de estatística (menor/médio/maior custo)
├── docker-compose.yml    # orquestra PostgreSQL + PostgREST
├── .env                  # variáveis de ambiente (não versionado)
└── package.json
```

**Três formatos de dados coexistem internamente:**

| Formato | Onde | Descrição |
|---|---|---|
| `RawImovel` | `types.ts`, `src/imoveis.json` | JSON aninhado (seed / importação) |
| `DbRow` | `data.ts` | Linha achatada do banco de dados |
| `Imovel` | componentes | Objeto normalizado com nomes curtos |

Ao adicionar um novo campo, é necessário propagá-lo pelos três formatos e pelo `docker/init.sql`.

---

## 10. Solução de problemas

### A aba Painel fica em "Carregando..."

O PostgREST (`localhost:3000`) não está acessível. Verifique:

```bash
docker compose ps          # todos os contêineres devem estar "Up"
docker compose up -d       # inicia os contêineres caso estejam parados
curl http://localhost:3000/imoveis   # deve retornar um array JSON
```

### Erro "Chave da API ausente"

O arquivo `.env` não foi criado ou a variável `VITE_LLM_API_KEY` não está definida. Crie o arquivo conforme a [seção 3](#3-configuração-do-ambiente-env) e reinicie o servidor:

```bash
# Pare o servidor (Ctrl+C) e reinicie
npm run dev
```

### O Chat / Rankings não respondem

1. Verifique se a chave de API é válida (sem espaços extras ou caracteres invisíveis)
2. Confirme se o modelo configurado em `VITE_LLM_MODEL` existe no provedor escolhido
3. Verifique o console do navegador (F12) para mensagens de erro detalhadas

### O build falha com erros de TypeScript

O `tsconfig.json` é configurado com modo estrito (`strict`, `noUnusedLocals`, `noUnusedParameters`). Qualquer variável ou import não utilizado quebra o build:

```bash
npm run build    # exibe todos os erros com localização exata
```

### Reiniciar o banco de dados do zero

```bash
docker compose down -v    # remove contêineres E volume de dados
docker compose up -d      # recria tudo (schema aplicado automaticamente)
```

> Esta operação **apaga todos os imóveis cadastrados**. Exporte os dados antes, se necessário (aba Painel → Exportar JSON).
