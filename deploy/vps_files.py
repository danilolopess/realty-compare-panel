#!/usr/bin/env python3
"""Prepara senha e o snippet do Caddy sem imprimir segredos."""

import base64
import os
import pathlib
import re
import secrets
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VPS_ENV = ROOT / "deploy" / "vps.env"
SNIPPET = ROOT / "deploy" / "Caddyfile.snippet"
USER_RE = re.compile(r"[A-Za-z0-9_-]{1,32}")
HASH_RE = re.compile(r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]+")
SENHA_RE = re.compile(r"[0-9a-f]{16,128}")


def ler_env(caminho: pathlib.Path) -> dict[str, str]:
    if not caminho.is_file():
        sys.exit(f"Arquivo ausente: {caminho}")
    valores: dict[str, str] = {}
    for linha in caminho.read_text().splitlines():
        texto = linha.strip()
        if not texto or texto.startswith("#") or "=" not in texto:
            continue
        chave, valor = texto.split("=", 1)
        valores[chave.strip()] = valor.strip().strip('"').strip("'")
    return valores


def escrever_chave(caminho: pathlib.Path, chave: str, valor: str) -> None:
    linhas = caminho.read_text().splitlines()
    achou = False
    novas: list[str] = []
    prefixo = f"{chave}="
    for linha in linhas:
        if linha.startswith(prefixo):
            novas.append(prefixo + valor)
            achou = True
        else:
            novas.append(linha)
    if not achou:
        novas.append(prefixo + valor)
    caminho.write_text("\n".join(novas) + "\n")
    os.chmod(caminho, 0o600)


def senha() -> str:
    valores = ler_env(VPS_ENV)
    atual = valores.get("POSTGRES_PASSWORD", "")
    if atual:
        if not SENHA_RE.fullmatch(atual):
            sys.exit(
                "POSTGRES_PASSWORD em deploy/vps.env precisa ser hexadecimal "
                "(16 a 128 caracteres), sem @ : / #. Apague o valor para gerar outra."
            )
        return atual
    gerada = secrets.token_hex(24)
    escrever_chave(VPS_ENV, "POSTGRES_PASSWORD", gerada)
    return gerada


def exigir_auth() -> tuple[str, str]:
    valores = ler_env(VPS_ENV)
    usuario = valores.get("BASIC_AUTH_USER", "")
    hash_senha = valores.get("BASIC_AUTH_HASH", "")
    if not USER_RE.fullmatch(usuario):
        sys.exit("BASIC_AUTH_USER deve ter só letras, números, _ ou - (até 32).")
    if not hash_senha:
        sys.exit(
            "BASIC_AUTH_HASH vazio em deploy/vps.env.\n"
            "Gere o hash sem gravar a senha:\n\n"
            "  docker run --rm caddy:2-alpine caddy hash-password --plaintext 'escolha-uma-senha'\n\n"
            "Cole só o hash na linha BASIC_AUTH_HASH= e rode de novo."
        )
    if not HASH_RE.fullmatch(hash_senha):
        sys.exit("BASIC_AUTH_HASH não parece a saída de caddy hash-password.")
    return usuario, hash_senha


def escrever_modo(destino: pathlib.Path, conteudo: str) -> None:
    fd = os.open(destino, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as arquivo:
        arquivo.write(conteudo)


def cmd_ensure_password() -> None:
    senha()


def hash_de_senha_ok(valor: str) -> bool:
    if HASH_RE.fullmatch(valor):
        return True
    try:
        decodificado = base64.b64decode(valor, validate=True).decode("utf-8")
    except (ValueError, UnicodeError):
        return False
    return bool(HASH_RE.fullmatch(decodificado))


def cmd_write_remote_env(destino: str) -> None:
    raiz = ler_env(ROOT / ".env")
    faltando = [
        chave
        for chave in ("AUTH_EMAIL", "AUTH_SECRET", "AUTH_PASSWORD_HASH")
        if not raiz.get(chave)
    ]
    if faltando:
        sys.exit(
            "Faltam no .env: "
            + ", ".join(faltando)
            + ". Veja as linhas AUTH_* de .env.example e rode npm run hash-password."
        )
    if raiz["AUTH_SECRET"] == "dev-auth-secret-must-be-at-least-32-chars" or len(raiz["AUTH_SECRET"]) < 32:
        sys.exit("Gere um AUTH_SECRET novo (openssl rand -hex 32). O valor de exemplo não vai para a VPS.")
    if raiz["AUTH_EMAIL"] == "seu@email.com" or "@" not in raiz["AUTH_EMAIL"]:
        sys.exit("Defina AUTH_EMAIL com o email de login. O valor de exemplo não vai para a VPS.")
    if raiz["AUTH_PASSWORD_HASH"].startswith("JDJiJDEyJFQxZXN1TFRR"):
        sys.exit("AUTH_PASSWORD_HASH ainda é o exemplo do .env.example. Rode npm run hash-password.")
    if not hash_de_senha_ok(raiz["AUTH_PASSWORD_HASH"]):
        sys.exit("AUTH_PASSWORD_HASH inválido. Rode npm run hash-password e cole a linha no .env.")
    if any(c.isspace() for c in raiz["AUTH_SECRET"] + raiz["AUTH_PASSWORD_HASH"]):
        sys.exit("AUTH_SECRET e AUTH_PASSWORD_HASH não podem ter espaço ou quebra de linha.")
    linhas = [
        f"POSTGRES_PASSWORD={senha()}",
        f"AUTH_EMAIL={raiz['AUTH_EMAIL']}",
        f"AUTH_SECRET={raiz['AUTH_SECRET']}",
        f"AUTH_PASSWORD_HASH={raiz['AUTH_PASSWORD_HASH']}",
    ]
    escrever_modo(pathlib.Path(destino), "\n".join(linhas) + "\n")


def cmd_render_snippet(destino: str) -> None:
    usuario, hash_senha = exigir_auth()
    modelo = SNIPPET.read_text()
    if "__BASIC_AUTH_USER__" not in modelo or "__BASIC_AUTH_HASH__" not in modelo:
        sys.exit("deploy/Caddyfile.snippet sem os marcadores de usuário e hash.")
    bloco = modelo.replace("__BASIC_AUTH_USER__", usuario).replace("__BASIC_AUTH_HASH__", hash_senha)
    if not bloco.endswith("\n"):
        bloco += "\n"
    escrever_modo(pathlib.Path(destino), bloco)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("uso: vps_files.py ensure-password | write-remote-env DEST | render-snippet DEST")
    cmd = sys.argv[1]
    if cmd == "ensure-password":
        cmd_ensure_password()
    elif cmd == "write-remote-env" and len(sys.argv) == 3:
        cmd_write_remote_env(sys.argv[2])
    elif cmd == "render-snippet" and len(sys.argv) == 3:
        cmd_render_snippet(sys.argv[2])
    else:
        sys.exit("uso: vps_files.py ensure-password | write-remote-env DEST | render-snippet DEST")


if __name__ == "__main__":
    main()
