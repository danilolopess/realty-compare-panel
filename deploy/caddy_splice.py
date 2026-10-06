#!/usr/bin/env python3
"""Insere ou remove o bloco marcado no Caddyfile. Não imprime o conteúdo."""

import pathlib
import sys

BEGIN = "# BEGIN realty-compare\n"
END = "# END realty-compare\n"


def ler(caminho: pathlib.Path) -> str:
    texto = caminho.read_text()
    if texto and not texto.endswith("\n"):
        texto += "\n"
    return texto


def checar_marcadores(texto: str) -> None:
    if texto.count(BEGIN) > 1 or texto.count(END) > 1:
        sys.exit("marcadores realty-compare duplicados")
    if (BEGIN in texto) != (END in texto):
        sys.exit("marcadores realty-compare inconsistentes")


def aplicar(texto: str, bloco: str) -> str:
    checar_marcadores(texto)
    if not bloco.endswith("\n"):
        bloco += "\n"
    if BEGIN not in bloco or END not in bloco:
        sys.exit("snippet sem marcadores BEGIN/END")
    if BEGIN in texto:
        pre, resto = texto.split(BEGIN, 1)
        _, pos = resto.split(END, 1)
        return pre + bloco + pos
    base = texto.rstrip() + "\n\n"
    return base + bloco


def remover(texto: str) -> str:
    checar_marcadores(texto)
    if BEGIN not in texto:
        return texto
    pre, resto = texto.split(BEGIN, 1)
    _, pos = resto.split(END, 1)
    return pre + pos


def main() -> None:
    if len(sys.argv) != 4 or sys.argv[1] not in {"apply", "remove"}:
        sys.exit("uso: caddy_splice.py apply|remove Caddyfile snippet")
    modo, caddy_path, snippet_path = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
    texto = ler(caddy_path)
    if modo == "apply":
        novo = aplicar(texto, ler(snippet_path))
    else:
        novo = remover(texto)
    caddy_path.write_text(novo)


if __name__ == "__main__":
    main()
