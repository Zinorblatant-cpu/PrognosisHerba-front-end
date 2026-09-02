"""
Testes para clusterizacao.py e o endpoint GET /clusterizacao.

Rodar: pytest tests/test_clusterizacao.py -v
"""
import pytest
from fastapi.testclient import TestClient

from clusterizacao import (
    AVISO_ROTA_SIMULADA,
    ROTA_DESCONHECIDA,
    clusterizar,
    clusterizar_do_csv,
    montar_features,
    numero_de_clusters,
    semanas_desde_ultima_poda,
    separar_ciclos,
    tendencia_crescimento,
)
from previsoes import carregar_series_com_poda
from server import app

client = TestClient(app)


def _semanas(alturas, podas=()):
    """Série sintética: `podas` são os índices em que houve corte."""
    return [
        {
            "data": f"2026-01-{i + 1:02d}",
            "alturaPrevistaCm": float(altura),
            "nivelAlerta": "baixo",
            "houvePoda": i in set(podas),
        }
        for i, altura in enumerate(alturas)
    ]


def _regiao(id_regiao, alturas, podas=()):
    return {
        "idRegiao": id_regiao,
        "inclinacaoGraus": 10.0,
        "areaDeRisco": "medio",
        "semanas": _semanas(alturas, podas),
    }


# ── separar_ciclos ───────────────────────────────────────────────────────────

class TestSepararCiclos:
    def test_serie_sem_poda_e_um_ciclo_so(self):
        ciclos = separar_ciclos(_semanas([1, 2, 3, 4]))
        assert len(ciclos) == 1
        assert len(ciclos[0]) == 4

    def test_poda_abre_um_ciclo_novo(self):
        # corte no índice 3: [1,2,3] e depois [1,2,3]
        ciclos = separar_ciclos(_semanas([1, 2, 3, 1, 2, 3], podas=[3]))
        assert [len(c) for c in ciclos] == [3, 3]

    def test_poda_na_primeira_semana_nao_cria_ciclo_vazio(self):
        ciclos = separar_ciclos(_semanas([1, 2, 3], podas=[0]))
        assert [len(c) for c in ciclos] == [3]

    def test_serie_vazia(self):
        assert separar_ciclos([]) == []


# ── tendencia_crescimento ────────────────────────────────────────────────────

class TestTendenciaCrescimento:
    def test_crescimento_linear_devolve_a_inclinacao(self):
        assert tendencia_crescimento(_semanas([2, 3, 4, 5])) == pytest.approx(1.0)

    def test_ignora_ciclos_antigos_quando_o_corrente_basta(self):
        # O ciclo antigo cresce 1 cm/semana; o corrente, 2 cm/semana.
        semanas = _semanas([1, 2, 3, 4, 2, 4, 6, 8], podas=[4])
        assert tendencia_crescimento(semanas) == pytest.approx(2.0)

    def test_a_poda_nao_vira_tendencia_negativa(self):
        # É o bug que o CSV de 52 semanas expõe: a queda do corte, medida
        # sobre a série inteira, daria inclinação negativa numa região que
        # na verdade está crescendo.
        semanas = _semanas([2, 4, 6, 8, 2, 4, 6, 8], podas=[4])
        assert tendencia_crescimento(semanas) > 0

    def test_ciclo_corrente_curto_cai_na_media_dos_anteriores(self):
        # Último ciclo tem 1 ponto só (podada agora) — sem fallback, não
        # haveria inclinação nenhuma para essa região.
        semanas = _semanas([2, 4, 6, 8, 2], podas=[4])
        assert tendencia_crescimento(semanas) == pytest.approx(2.0)

    def test_sem_nenhum_ciclo_utilizavel_devolve_zero(self):
        assert tendencia_crescimento(_semanas([5, 6])) == 0.0

    def test_serie_vazia_devolve_zero(self):
        assert tendencia_crescimento([]) == 0.0


# ── semanas_desde_ultima_poda ────────────────────────────────────────────────

class TestSemanasDesdeUltimaPoda:
    def test_conta_do_corte_para_frente(self):
        assert semanas_desde_ultima_poda(_semanas([1, 2, 3, 1, 2], podas=[3])) == 1

    def test_sem_poda_conta_a_serie_inteira(self):
        assert semanas_desde_ultima_poda(_semanas([1, 2, 3])) == 2

    def test_serie_vazia(self):
        assert semanas_desde_ultima_poda([]) == 0


# ── montar_features ──────────────────────────────────────────────────────────

class TestMontarFeatures:
    def test_uma_linha_por_regiao_com_os_tres_indicadores(self):
        features = montar_features([_regiao("RA-01", [2, 4, 6])])
        assert len(features) == 1
        assert features[0]["idRegiao"] == "RA-01"
        assert features[0]["alturaAtualCm"] == 6.0
        assert features[0]["tendenciaCmPorSemana"] == 2.0
        assert features[0]["rota"]

    def test_rota_e_marcada_como_simulada(self):
        features = montar_features([_regiao("RA-01", [2, 4, 6])])
        assert features[0]["rotaSimulada"] is True

    def test_regiao_fora_do_mapa_de_rotas_nao_quebra(self):
        features = montar_features([_regiao("RA-99", [2, 4, 6])])
        assert features[0]["rota"] == ROTA_DESCONHECIDA

    def test_regiao_sem_semanas_e_descartada(self):
        assert montar_features([_regiao("RA-01", [])]) == []


# ── numero_de_clusters ───────────────────────────────────────────────────────

class TestNumeroDeClusters:
    def test_coerente_com_o_tamanho_do_lote(self):
        # ~2 regiões por grupo, nunca 1 grupo por região.
        assert numero_de_clusters(4) == 2
        assert numero_de_clusters(9) == 4
        assert numero_de_clusters(2) == 1

    def test_nunca_passa_do_numero_de_regioes(self):
        assert numero_de_clusters(1) == 1
        assert numero_de_clusters(3, k=10) == 3

    def test_k_explicito_manda(self):
        assert numero_de_clusters(8, k=3) == 3

    def test_lote_vazio(self):
        assert numero_de_clusters(0) == 0


# ── clusterizar ──────────────────────────────────────────────────────────────

class TestClusterizar:
    def test_regioes_com_perfil_parecido_caem_no_mesmo_grupo(self):
        # Dois pares bem separados: dois trechos baixos e lentos, dois altos
        # e rápidos. Qualquer clustering decente tem que separar assim.
        series = [
            _regiao("RA-01", [1.0, 1.2, 1.4]),
            _regiao("RA-02", [1.1, 1.3, 1.5]),
            _regiao("RA-03", [5.0, 7.0, 9.0]),
            _regiao("RA-04", [5.2, 7.2, 9.2]),
        ]
        grupo = {r["idRegiao"]: r["clusterId"] for r in clusterizar(series, k=2)["regioes"]}
        assert grupo["RA-01"] == grupo["RA-02"]
        assert grupo["RA-03"] == grupo["RA-04"]
        assert grupo["RA-01"] != grupo["RA-03"]

    def test_numero_de_clusters_bate_com_o_pedido(self):
        series = [_regiao(f"RA-0{i}", [i, i + 2, i + 4]) for i in range(1, 5)]
        assert len(clusterizar(series, k=3)["clusters"]) == 3

    def test_toda_regiao_cai_em_exatamente_um_cluster(self):
        series = [_regiao(f"RA-0{i}", [i, i + 2, i + 4]) for i in range(1, 5)]
        resultado = clusterizar(series)
        das_regioes = {r["idRegiao"] for r in resultado["regioes"]}
        dos_clusters = [id_ for c in resultado["clusters"] for id_ in c["regioes"]]
        assert das_regioes == set(dos_clusters)
        assert len(dos_clusters) == len(das_regioes)

    def test_clusters_ordenados_do_mais_alto_para_o_mais_baixo(self):
        series = [
            _regiao("RA-01", [1.0, 1.2, 1.4]),
            _regiao("RA-02", [1.1, 1.3, 1.5]),
            _regiao("RA-03", [5.0, 7.0, 9.0]),
            _regiao("RA-04", [5.2, 7.2, 9.2]),
        ]
        alturas = [c["alturaMediaCm"] for c in clusterizar(series, k=2)["clusters"]]
        assert alturas == sorted(alturas, reverse=True)

    def test_resultado_e_deterministico(self):
        series = [_regiao(f"RA-0{i}", [i, i + 2, i + 4]) for i in range(1, 5)]
        assert clusterizar(series) == clusterizar(series)

    def test_lote_vazio_devolve_estrutura_vazia(self):
        resultado = clusterizar([])
        assert resultado["clusters"] == []
        assert resultado["regioes"] == []
        assert resultado["avisoRota"] == AVISO_ROTA_SIMULADA

    def test_rota_unica_no_lote_nao_quebra_a_padronizacao(self):
        # Coluna constante: desvio zero, teria virado divisão por zero.
        series = [_regiao("RA-01", [1, 2, 3]), _regiao("RA-02", [5, 7, 9])]
        assert len(clusterizar(series, k=2)["clusters"]) == 2


# ── rótulos ──────────────────────────────────────────────────────────────────

class TestRotulos:
    def test_regiao_ja_acima_do_limiar(self):
        series = [_regiao("RA-01", [10, 12, 14])]
        assert clusterizar(series, limiar_poda_cm=9.0)["clusters"][0]["rotulo"] == "acima do limiar"

    def test_regiao_prestes_a_cruzar_o_limiar_e_critica(self):
        series = [_regiao("RA-01", [4, 6, 8])]
        assert clusterizar(series, limiar_poda_cm=9.0)["clusters"][0]["rotulo"] == "crítico"

    def test_regiao_a_meio_ciclo_do_limiar_e_atencao(self):
        series = [_regiao("RA-01", [1.0, 1.5, 2.0])]
        assert clusterizar(series, limiar_poda_cm=4.0)["clusters"][0]["rotulo"] == "atenção"

    def test_regiao_longe_do_limiar_e_estavel(self):
        series = [_regiao("RA-01", [1.0, 1.1, 1.2])]
        assert clusterizar(series, limiar_poda_cm=9.0)["clusters"][0]["rotulo"] == "estável"

    def test_regiao_sem_crescimento_abaixo_do_limiar_e_estavel(self):
        series = [_regiao("RA-01", [2.0, 2.0, 2.0])]
        assert clusterizar(series, limiar_poda_cm=9.0)["clusters"][0]["rotulo"] == "estável"

    def test_regiao_sem_crescimento_acima_do_limiar(self):
        series = [_regiao("RA-01", [12.0, 12.0, 12.0])]
        assert clusterizar(series, limiar_poda_cm=9.0)["clusters"][0]["rotulo"] == "acima do limiar"


# ── dados reais ──────────────────────────────────────────────────────────────

class TestComOCsvPadrao:
    def test_toda_regiao_do_csv_aparece_no_resultado(self):
        ids = {r["idRegiao"] for r in carregar_series_com_poda()}
        assert {r["idRegiao"] for r in clusterizar_do_csv()["regioes"]} == ids

    def test_nenhuma_tendencia_negativa_por_causa_do_reset_de_poda(self):
        # No CSV real toda região está em crescimento; se alguma saísse
        # negativa, o slope estaria atravessando um corte.
        for regiao in clusterizar_do_csv()["regioes"]:
            assert regiao["tendenciaCmPorSemana"] > 0


# ── GET /clusterizacao ───────────────────────────────────────────────────────

class TestClusterizacaoEndpoint:
    def test_responde_200_com_o_schema_esperado(self):
        res = client.get("/clusterizacao")
        assert res.status_code == 200
        corpo = res.json()
        assert set(corpo) == {"avisoRota", "clusters", "regioes"}
        assert corpo["clusters"] and corpo["regioes"]

    def test_cada_regiao_traz_os_tres_indicadores_e_o_cluster(self):
        regiao = client.get("/clusterizacao").json()["regioes"][0]
        assert set(regiao) == {
            "idRegiao", "rota", "rotaSimulada", "alturaAtualCm",
            "tendenciaCmPorSemana", "semanasDesdeUltimaPoda", "clusterId",
        }

    def test_avisa_que_a_rota_e_simulada(self):
        assert "simulados" in client.get("/clusterizacao").json()["avisoRota"]

    def test_aceita_k_explicito(self):
        assert len(client.get("/clusterizacao?k=3").json()["clusters"]) == 3

    def test_k_invalido_retorna_422(self):
        assert client.get("/clusterizacao?k=0").status_code == 422
