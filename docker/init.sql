CREATE TABLE imoveis (
  id                   SERIAL PRIMARY KEY,
  tipo_imovel          VARCHAR(20),
  imobiliaria_corretor VARCHAR(255),
  bairro               VARCHAR(255),
  cidade               VARCHAR(100),
  operacao             VARCHAR(100),
  aluguel              NUMERIC(10,2),
  venda                NUMERIC(15,2),
  condominio           NUMERIC(10,2),
  iptu                 NUMERIC(10,2),
  iptu_estimado        BOOLEAN,
  custo_mensal_total   NUMERIC(10,2),
  garagem_vagas        INTEGER,
  garagem_detalhe      TEXT,
  quintal_tem          BOOLEAN,
  quintal_observacao   TEXT,
  quartos              INTEGER,
  banheiros            INTEGER,
  area_m2              NUMERIC(8,2),
  aceita_pet           VARCHAR(20),
  entrar_em_contato    BOOLEAN,
  a_verificar          TEXT,
  observacoes          TEXT,
  link                 TEXT,
  whatsapp             TEXT,
  status               TEXT DEFAULT 'nao_analisado',
  status_changed_at    TIMESTAMPTZ,
  notas                TEXT,
  favorito             BOOLEAN DEFAULT false
);

-- Sessões de conversa do Chat (estilo ChatGPT/Claude).
-- mensagens: array JSON de {role:'user'|'assistant', content:string}.
-- O system prompt (JSON dos imóveis) NÃO é salvo — é remontado a cada envio.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo        TEXT NOT NULL DEFAULT 'Nova conversa',
  mensagens     JSONB NOT NULL DEFAULT '[]'::jsonb,
  modelo        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rankings gerados por IA. Um registro por config_id (chave primária).
-- Sobrescrito a cada nova geração.
CREATE TABLE IF NOT EXISTS rankings (
  config_id   TEXT PRIMARY KEY,
  conteudo    TEXT NOT NULL,
  user_input  TEXT,
  gerado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
