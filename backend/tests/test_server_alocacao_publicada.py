"""
Testes de integração para os endpoints de alocação publicada
(/alocacao/publicar, /alocacao/atual, /alocacao/locais/concluir) —
usados pelo site dos podadores para ver a agenda e marcar conclusão.

Rodar: pytest tests/test_server_alocacao_publicada.py -v
"""
import pytest
from fastapi.testclient import TestClient

import persistencia
from server import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def banco_temporario(tmp_path, monkeypatch):
    """Isola cada teste num arquivo SQLite novo, em vez do banco real."""
    monkeypatch.setattr(persistencia, "CAMINHO_DB_PADRAO", str(tmp_path / "podadores.db"))


ALOCACOES = [
    {
        "equipeId": "equipe_1",
        "dia": "2026-09-14",
        "locais": [
            {"localId": "local_1", "prioridade": "alta", "dificuldade": "facil"},
            {"localId": "local_2", "prioridade": "media", "dificuldade": "media"},
        ],
    },
]

NAO_ALOCADOS = [{"localId": "local_9", "prioridade": "baixa", "dificuldade": "facil"}]


def _publicar(alocacoes=ALOCACOES, nao_alocados=NAO_ALOCADOS, ano=2026, mes=9):
    return client.post(
        "/alocacao/publicar",
        json={"mesReferencia": {"ano": ano, "mes": mes}, "alocacoes": alocacoes, "naoAlocados": nao_alocados},
    )


class TestAlocacaoAtualSemPublicacao:
    def test_retorna_404(self):
        res = client.get("/alocacao/atual")
        assert res.status_code == 404


class TestPublicarAlocacao:
    def test_retorna_200_com_a_alocacao_publicada(self):
        res = _publicar()
        assert res.status_code == 200
        data = res.json()
        assert data["mesReferencia"] == {"ano": 2026, "mes": 9}
        assert len(data["alocacoes"]) == 1

    def test_locais_comecam_nao_concluidos(self):
        data = _publicar().json()
        for aloc in data["alocacoes"]:
            for local in aloc["locais"]:
                assert local["concluido"] is False

    def test_fica_disponivel_em_alocacao_atual(self):
        _publicar()
        res = client.get("/alocacao/atual")
        assert res.status_code == 200
        assert res.json()["mesReferencia"] == {"ano": 2026, "mes": 9}

    def test_publicar_de_novo_substitui_a_anterior(self):
        _publicar(mes=9)
        _publicar(mes=10)
        res = client.get("/alocacao/atual")
        assert res.json()["mesReferencia"] == {"ano": 2026, "mes": 10}


class TestConcluirLocal:
    def test_marca_local_como_concluido(self):
        _publicar()
        res = client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_1", "dia": "2026-09-14", "localId": "local_1", "concluido": True},
        )
        assert res.status_code == 200
        local_1 = next(
            local
            for aloc in res.json()["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is True

    def test_desmarca_local_concluido(self):
        _publicar()
        client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_1", "dia": "2026-09-14", "localId": "local_1", "concluido": True},
        )
        res = client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_1", "dia": "2026-09-14", "localId": "local_1", "concluido": False},
        )
        local_1 = next(
            local
            for aloc in res.json()["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is False

    def test_404_quando_nao_ha_alocacao_publicada(self):
        res = client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_1", "dia": "2026-09-14", "localId": "local_1", "concluido": True},
        )
        assert res.status_code == 404

    def test_404_quando_local_nao_existe_na_alocacao(self):
        _publicar()
        res = client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_1", "dia": "2026-09-14", "localId": "local_inexistente", "concluido": True},
        )
        assert res.status_code == 404

    def test_404_quando_equipe_ou_dia_nao_batem(self):
        _publicar()
        res = client.post(
            "/alocacao/locais/concluir",
            json={"equipeId": "equipe_9", "dia": "2026-09-14", "localId": "local_1", "concluido": True},
        )
        assert res.status_code == 404
