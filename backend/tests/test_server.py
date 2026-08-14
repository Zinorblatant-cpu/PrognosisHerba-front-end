"""
Testes de integração para server.py (FastAPI).

Rodar: pytest tests/test_server.py -v
"""
from fastapi.testclient import TestClient

from server import app

client = TestClient(app)


def _payload(locais, quantidade_equipes=1, ano=2026, mes=9, capacidade_diaria=None):
    payload = {
        "locais": locais,
        "quantidadeEquipes": quantidade_equipes,
        "ano": ano,
        "mes": mes,
    }
    if capacidade_diaria is not None:
        payload["capacidadeDiaria"] = capacidade_diaria
    return payload


# ── /health ───────────────────────────────────────────────────────────────────

def test_health_retorna_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


# ── /gerar-alocacao — caminho feliz ──────────────────────────────────────────

class TestGerarAlocacaoSucesso:
    def test_locais_cabem_na_capacidade_retorna_200(self):
        locais = [
            {"id": "local_1", "prioridade": "alta", "dificuldade": "facil"},
            {"id": "local_2", "prioridade": "media", "dificuldade": "media"},
        ]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=2))
        assert res.status_code == 200

    def test_todos_os_locais_aparecem_alocados(self):
        locais = [
            {"id": "local_1", "prioridade": "alta", "dificuldade": "facil"},
            {"id": "local_2", "prioridade": "media", "dificuldade": "media"},
            {"id": "local_3", "prioridade": "baixa", "dificuldade": "dificil"},
        ]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=3))
        data = res.json()
        assert data["naoAlocados"] == []
        alocados = {loc["localId"] for aloc in data["alocacoes"] for loc in aloc["locais"]}
        assert alocados == {"local_1", "local_2", "local_3"}

    def test_sem_alerta_quando_capacidade_e_suficiente(self):
        locais = [{"id": "local_1", "prioridade": "alta", "dificuldade": "facil"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1))
        assert res.json()["alerta"] is None

    def test_resposta_tem_equipeid_e_dia_por_alocacao(self):
        locais = [{"id": "local_1", "prioridade": "alta", "dificuldade": "facil"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1))
        alocacoes = res.json()["alocacoes"]
        assert len(alocacoes) == 1
        assert alocacoes[0]["equipeId"] == "equipe_1"
        assert alocacoes[0]["dia"].startswith("2026-09")


# ── /gerar-alocacao — capacidade insuficiente ────────────────────────────────

class TestGerarAlocacaoCapacidadeInsuficiente:
    # Setembro/2026 tem 22 dias úteis; com 1 equipe e capacidadeDiaria=3, a
    # capacidade do mês é 22*3=66 pontos. 30 locais difíceis (custo 3 cada,
    # só 1 cabe por dia) somam 90 pontos de demanda -> excede a capacidade,
    # já que a equipe só consegue espalhar 1 local difícil por dia útil.
    def _locais_dificeis(self, quantidade=30):
        return [
            {"id": f"local_{i}", "prioridade": "alta" if i == 0 else "baixa", "dificuldade": "dificil"}
            for i in range(quantidade)
        ]

    def test_continua_200_mesmo_sem_capacidade_para_todos(self):
        locais = self._locais_dificeis()
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1, capacidade_diaria=3))
        assert res.status_code == 200

    def test_alerta_presente_com_mensagem(self):
        locais = self._locais_dificeis()
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1, capacidade_diaria=3))
        alerta = res.json()["alerta"]
        assert alerta is not None
        assert alerta["equipesExtrasSugeridas"] >= 1
        assert "mensagem" in alerta and len(alerta["mensagem"]) > 0

    def test_local_de_maior_prioridade_fica_alocado(self):
        locais = self._locais_dificeis()  # local_0 é "alta", os demais "baixa"
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1, capacidade_diaria=3))
        data = res.json()
        alocados = {loc["localId"] for aloc in data["alocacoes"] for loc in aloc["locais"]}
        assert "local_0" in alocados


# ── /gerar-alocacao — validação ───────────────────────────────────────────────

class TestGerarAlocacaoValidacao:
    def test_lista_vazia_retorna_422(self):
        res = client.post("/gerar-alocacao", json=_payload([], quantidade_equipes=1))
        assert res.status_code == 422

    def test_ids_duplicados_retorna_422(self):
        locais = [
            {"id": "local_1", "prioridade": "alta", "dificuldade": "facil"},
            {"id": "local_1", "prioridade": "baixa", "dificuldade": "facil"},
        ]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1))
        assert res.status_code == 422

    def test_prioridade_invalida_retorna_422(self):
        locais = [{"id": "local_1", "prioridade": "urgente", "dificuldade": "facil"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1))
        assert res.status_code == 422

    def test_dificuldade_invalida_retorna_422(self):
        locais = [{"id": "local_1", "prioridade": "alta", "dificuldade": "impossivel"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1))
        assert res.status_code == 422

    def test_quantidade_equipes_zero_retorna_422(self):
        locais = [{"id": "local_1", "prioridade": "alta", "dificuldade": "facil"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=0))
        assert res.status_code == 422

    def test_mes_invalido_retorna_422(self):
        locais = [{"id": "local_1", "prioridade": "alta", "dificuldade": "facil"}]
        res = client.post("/gerar-alocacao", json=_payload(locais, quantidade_equipes=1, mes=13))
        assert res.status_code == 422
