"""
Testes unitários e de integração para previsoes.py e os endpoints
/previsoes e /previsoes/gerar-alocacao (server.py).

Rodar: pytest tests/test_previsoes.py -v
"""
from fastapi.testclient import TestClient

from previsoes import (
    LIMIAR_PODA_CM,
    carregar_previsoes,
    derivar_locais_de_poda,
    faixa_dificuldade,
)
from server import app

client = TestClient(app)


# ── carregar_previsoes ───────────────────────────────────────────────────────

class TestCarregarPrevisoes:
    def test_quatro_regioes(self):
        previsoes = carregar_previsoes()
        assert {r["idRegiao"] for r in previsoes} == {"RA-01", "RA-02", "RA-03", "RA-04"}

    def test_doze_semanas_por_regiao(self):
        previsoes = carregar_previsoes()
        for regiao in previsoes:
            assert len(regiao["semanas"]) == 12

    def test_semanas_mantem_ordem_cronologica(self):
        previsoes = carregar_previsoes()
        regiao = next(r for r in previsoes if r["idRegiao"] == "RA-01")
        datas = [s["data"] for s in regiao["semanas"]]
        assert datas == sorted(datas)

    def test_tipos_numericos_convertidos(self):
        previsoes = carregar_previsoes()
        regiao = previsoes[0]
        assert isinstance(regiao["inclinacaoGraus"], float)
        assert isinstance(regiao["semanas"][0]["alturaPrevistaCm"], float)


# ── faixa_dificuldade ────────────────────────────────────────────────────────

class TestFaixaDificuldade:
    def test_inclinacao_baixa_e_facil(self):
        assert faixa_dificuldade(4.5) == "facil"

    def test_inclinacao_media_e_media(self):
        assert faixa_dificuldade(9.2) == "media"
        assert faixa_dificuldade(11.8) == "media"

    def test_inclinacao_alta_e_dificil(self):
        assert faixa_dificuldade(22.3) == "dificil"

    def test_limites_das_faixas(self):
        assert faixa_dificuldade(7) == "facil"
        assert faixa_dificuldade(7.01) == "media"
        assert faixa_dificuldade(15) == "media"
        assert faixa_dificuldade(15.01) == "dificil"


# ── derivar_locais_de_poda ───────────────────────────────────────────────────

def _previsoes_fake():
    return [
        {
            "idRegiao": "RA-01",
            "inclinacaoGraus": 4.5,
            "areaDeRisco": "baixo",
            "semanas": [
                {"data": "2026-09-07", "alturaPrevistaCm": 8.0, "nivelAlerta": "baixo"},
                {"data": "2026-09-14", "alturaPrevistaCm": 10.5, "nivelAlerta": "medio"},
                {"data": "2026-09-21", "alturaPrevistaCm": 11.5, "nivelAlerta": "alto"},
            ],
        },
        {
            "idRegiao": "RA-02",
            "inclinacaoGraus": 22.0,
            "areaDeRisco": "alto",
            "semanas": [
                {"data": "2026-10-05", "alturaPrevistaCm": 10.2, "nivelAlerta": "alto"},
            ],
        },
        {
            "idRegiao": "RA-03",
            "inclinacaoGraus": 9.0,
            "areaDeRisco": "medio",
            "semanas": [
                {"data": "2026-09-07", "alturaPrevistaCm": 5.0, "nivelAlerta": "baixo"},
            ],
        },
    ]


class TestDerivarLocaisDePoda:
    def test_acha_primeira_semana_que_cruza_limiar(self):
        resultado = derivar_locais_de_poda(_previsoes_fake(), ano=2026, mes=9)
        ra01 = next(loc for loc in resultado["locais"] if loc["id"] == "RA-01")
        assert ra01["dataAlvo"] == "2026-09-14"
        assert ra01["alturaPrevistaCm"] == 10.5

    def test_mapeia_nivel_alerta_para_prioridade(self):
        resultado = derivar_locais_de_poda(_previsoes_fake(), ano=2026, mes=9)
        ra01 = next(loc for loc in resultado["locais"] if loc["id"] == "RA-01")
        assert ra01["prioridade"] == "media"

    def test_regiao_sem_semana_no_limiar_fica_sem_alerta_no_horizonte(self):
        resultado = derivar_locais_de_poda(_previsoes_fake(), ano=2026, mes=9)
        assert "RA-03" in resultado["semAlertaNoHorizonte"]

    def test_regiao_fora_do_mes_pedido(self):
        resultado = derivar_locais_de_poda(_previsoes_fake(), ano=2026, mes=9)
        assert any(loc["id"] == "RA-02" for loc in resultado["foraDoMes"])
        assert not any(loc["id"] == "RA-02" for loc in resultado["locais"])

    def test_sem_ano_mes_deduz_mes_mais_urgente(self):
        resultado = derivar_locais_de_poda(_previsoes_fake())
        assert (resultado["anoUsado"], resultado["mesUsado"]) == (2026, 9)
        assert {loc["id"] for loc in resultado["locais"]} == {"RA-01"}

    def test_limiar_customizado(self):
        resultado = derivar_locais_de_poda(_previsoes_fake(), ano=2026, mes=9, limiar=11.0)
        ra01 = next(loc for loc in resultado["locais"] if loc["id"] == "RA-01")
        assert ra01["dataAlvo"] == "2026-09-21"

    def test_nenhuma_regiao_no_limiar_retorna_locais_vazio(self):
        previsoes = [
            {
                "idRegiao": "RA-99",
                "inclinacaoGraus": 5.0,
                "areaDeRisco": "baixo",
                "semanas": [{"data": "2026-09-07", "alturaPrevistaCm": 1.0, "nivelAlerta": "baixo"}],
            }
        ]
        resultado = derivar_locais_de_poda(previsoes)
        assert resultado["locais"] == []
        assert resultado["semAlertaNoHorizonte"] == ["RA-99"]


# ── GET /previsoes ────────────────────────────────────────────────────────────

class TestPrevisoesEndpoint:
    def test_retorna_200_com_quatro_regioes(self):
        res = client.get("/previsoes")
        assert res.status_code == 200
        assert len(res.json()) == 4

    def test_cada_regiao_tem_doze_semanas(self):
        res = client.get("/previsoes")
        for regiao in res.json():
            assert len(regiao["semanas"]) == 12


# ── POST /previsoes/gerar-alocacao ───────────────────────────────────────────

class TestGerarAlocacaoDePrevisoesEndpoint:
    def test_caminho_feliz_retorna_200(self):
        res = client.post("/previsoes/gerar-alocacao", json={"quantidadeEquipes": 4})
        assert res.status_code == 200
        data = res.json()
        assert data["locaisDerivados"]
        assert "mesReferencia" in data

    def test_locais_derivados_aparecem_na_alocacao_ou_nao_alocados(self):
        res = client.post("/previsoes/gerar-alocacao", json={"quantidadeEquipes": 4})
        data = res.json()
        ids_derivados = {loc["id"] for loc in data["locaisDerivados"]}
        alocados = {loc["localId"] for aloc in data["alocacoes"] for loc in aloc["locais"]}
        nao_alocados = {loc["localId"] for loc in data["naoAlocados"]}
        assert ids_derivados == alocados | nao_alocados

    def test_ano_mes_explicitos_sem_regiao_no_mes_retorna_422(self):
        res = client.post(
            "/previsoes/gerar-alocacao",
            json={"quantidadeEquipes": 1, "ano": 2020, "mes": 1},
        )
        assert res.status_code == 422

    def test_quantidade_equipes_zero_retorna_422(self):
        res = client.post("/previsoes/gerar-alocacao", json={"quantidadeEquipes": 0})
        assert res.status_code == 422

    def test_limiar_padrao_e_dez_cm(self):
        assert LIMIAR_PODA_CM == 10.0
