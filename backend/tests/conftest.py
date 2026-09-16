"""
Fixtures compartilhadas da suíte do backend.

A suíte é hermética: nenhum teste toca a API externa de previsões. Como
`fonte_previsoes` lê a chave de `backend/.env` via `os.environ.setdefault`,
basta deixar `GRAMA_API_KEY` já definida (vazia) no ambiente para que o
`.env` do desenvolvedor não sobrescreva — e a sincronização fica desligada.

Quem quiser exercitar a ingestão de verdade usa
`tests/test_fonte_previsoes.py`, que injeta uma planilha sintética em vez
de bater na rede.
"""
import os

import pytest


@pytest.fixture(autouse=True, scope="session")
def _desligar_sincronizacao_externa():
    anterior = os.environ.get("GRAMA_API_KEY")
    os.environ["GRAMA_API_KEY"] = ""
    yield
    if anterior is None:
        os.environ.pop("GRAMA_API_KEY", None)
    else:
        os.environ["GRAMA_API_KEY"] = anterior
