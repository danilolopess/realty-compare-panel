-- Login de usuário único. Idempotente: o Vite aplica de novo em volume já existente.
-- init.sql cola o mesmo bloco para o primeiro boot do Postgres.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.painel_config (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  CREATE ROLE web_anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE ROLE painel_app NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

GRANT USAGE ON SCHEMA public TO painel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO painel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO painel_app;

DO $$
BEGIN
  EXECUTE format('GRANT web_anon TO %I', current_user);
  EXECUTE format('GRANT painel_app TO %I', current_user);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO painel_app',
    current_user
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO painel_app',
    current_user
  );
END
$$;

REVOKE ALL ON SCHEMA auth FROM web_anon;
REVOKE ALL ON SCHEMA auth FROM painel_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM web_anon;
