"""
Testes para analise_grama.py e o endpoint POST /grama/analisar.

Rodar: pytest tests/test_analise_grama.py -v
"""
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from analise_grama import (
    analisar_imagem,
    analisar_pick,
    apply_mask,
    calcular_px_por_cm,
    classify_frame_pct,
    classify_pct,
    contar_pontos_pick,
    margem_erro_pct,
    measure_top_y,
    y_para_altura_pct,
)
from server import app

client = TestClient(app)

VERDE_BGR = (40, 180, 40)
FUNDO_BGR = (40, 80, 120)

FIXTURE_GRAMA_COM_FITA = Path(__file__).parent / "fixtures" / "grama_com_fita.png"
# Ver tests/fixtures/gerar_grama_com_fita.py: grama 250x150px, px_por_cm=10
# exato com esses dois pontos -> valores esperados calculáveis à mão.
FIXTURE_P1 = (310, 50)
FIXTURE_P2 = (310, 150)
FIXTURE_DISTANCIA_CM = 10.0
FIXTURE_AREA_CM2_ESPERADA = 371.01
FIXTURE_ALTURA_MEDIA_CM_ESPERADA = 14.8404


def _imagem_png(altura=200, largura=300, fracao_verde_de_baixo=0.0):
    """Imagem sintética: fundo marrom com uma faixa verde saindo da base."""
    frame = np.zeros((altura, largura, 3), dtype=np.uint8)
    frame[:, :] = FUNDO_BGR
    if fracao_verde_de_baixo > 0:
        y_inicio = int(altura * (1 - fracao_verde_de_baixo))
        frame[y_inicio:, :] = VERDE_BGR
    ok, buf = cv2.imencode(".png", frame)
    assert ok
    return buf.tobytes()


# ── funções puras ────────────────────────────────────────────────────────────

class TestApplyMask:
    def test_segmenta_area_verde(self):
        frame = np.zeros((10, 10, 3), dtype=np.uint8)
        frame[:, :] = FUNDO_BGR
        frame[5:, :] = VERDE_BGR
        mask = apply_mask(frame)
        assert mask[9, 5] == 255
        assert mask[0, 5] == 0


class TestMeasureTopY:
    def test_retorna_none_sem_verde(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        assert measure_top_y(mask, (0.5,)) == [None]

    def test_retorna_y_do_primeiro_pixel_verde(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[6:, 5] = 255
        assert measure_top_y(mask, (0.5,)) == [6]


class TestYParaAlturaPct:
    def test_none_sem_verde(self):
        assert y_para_altura_pct(None, 100) is None

    def test_zero_quando_topo_na_base(self):
        assert y_para_altura_pct(99, 100) == 0.0

    def test_proporcional_a_altura_do_frame(self):
        # topo em y=0 numa imagem de 100px -> ~99% da altura
        assert y_para_altura_pct(0, 100) == pytest.approx(99.0)


class TestClassifyPct:
    def test_none_e_ausente(self):
        assert classify_pct(None, 15, 35) == (0, "AUSENTE")

    def test_dentro_da_faixa_baixa(self):
        assert classify_pct(10, 15, 35) == (1, "BAIXA")

    def test_dentro_da_faixa_media(self):
        assert classify_pct(20, 15, 35) == (2, "MEDIA")

    def test_acima_da_faixa_media_e_alta(self):
        assert classify_pct(50, 15, 35) == (3, "ALTA")


class TestClassifyFramePct:
    def test_todas_none_e_ausente(self):
        assert classify_frame_pct([None, None], 15, 35) == (0, "AUSENTE", None)

    def test_usa_mediana_das_colunas(self):
        nivel, categoria, mediana = classify_frame_pct([10, 20, 30], 15, 35)
        assert mediana == 20
        assert categoria == "MEDIA"


class TestMargemErroPct:
    def test_none_com_menos_de_duas_validas(self):
        assert margem_erro_pct([10]) is None
        assert margem_erro_pct([]) is None

    def test_metade_da_amplitude(self):
        assert margem_erro_pct([10, 20, None]) == 5.0


class TestCalcularPxPorCm:
    def test_caso_horizontal(self):
        assert calcular_px_por_cm((0, 0), (100, 0), 10.0) == pytest.approx(10.0)

    def test_caso_vertical_da_fixture(self):
        px_por_cm = calcular_px_por_cm(FIXTURE_P1, FIXTURE_P2, FIXTURE_DISTANCIA_CM)
        assert px_por_cm == pytest.approx(10.0)

    def test_distancia_cm_invalida_levanta_valueerror(self):
        with pytest.raises(ValueError):
            calcular_px_por_cm((0, 0), (100, 0), 0.0)
        with pytest.raises(ValueError):
            calcular_px_por_cm((0, 0), (100, 0), -5.0)

    def test_pontos_identicos_levanta_valueerror(self):
        with pytest.raises(ValueError):
            calcular_px_por_cm((10, 10), (10, 10), 10.0)


class TestContarPontosPick:
    def test_mascara_vazia(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        assert contar_pontos_pick(mask) == (0, 0)

    def test_bloco_1x1(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[5, 5] = 255
        assert contar_pontos_pick(mask) == (0, 1)

    def test_bloco_3x3(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[3:6, 3:6] = 255
        assert contar_pontos_pick(mask) == (1, 8)

    def test_bloco_5x4(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[2:6, 2:7] = 255  # 4 linhas (altura) x 5 colunas (largura)
        assert contar_pontos_pick(mask) == (6, 14)


class TestAnalisarPick:
    def test_retangulo_sintetico_bate_valores_esperados(self):
        mask = np.zeros((300, 400), dtype=np.uint8)
        mask[150:300, 0:250] = 255  # mesmo retângulo da fixture: 250x150px
        resultado = analisar_pick(mask, px_por_cm=10.0)
        assert resultado["pontosInteriores"] == 36704
        assert resultado["pontosBorda"] == 796
        assert resultado["areaCm2"] == pytest.approx(FIXTURE_AREA_CM2_ESPERADA)
        assert resultado["larguraCm"] == pytest.approx(25.0)
        assert resultado["alturaMediaCm"] == pytest.approx(FIXTURE_ALTURA_MEDIA_CM_ESPERADA)

    def test_none_sem_componente_verde(self):
        mask = np.zeros((50, 50), dtype=np.uint8)
        assert analisar_pick(mask, px_por_cm=10.0) is None

    def test_ignora_respingo_isolado_menor(self):
        mask = np.zeros((300, 400), dtype=np.uint8)
        mask[150:300, 0:250] = 255  # blob principal: 250x150px
        mask[0:3, 390:393] = 255  # respingo isolado, bem menor e distante
        resultado = analisar_pick(mask, px_por_cm=10.0)
        assert resultado["larguraCm"] == pytest.approx(25.0)


# ── pipeline completo ─────────────────────────────────────────────────────────

class TestAnalisarImagem:
    def test_levanta_valueerror_para_bytes_invalidos(self):
        with pytest.raises(ValueError):
            analisar_imagem(b"nao-e-uma-imagem")

    def test_sem_verde_classifica_ausente(self):
        resultado = analisar_imagem(_imagem_png(fracao_verde_de_baixo=0.0))
        assert resultado["categoria"] == "AUSENTE"
        assert resultado["coberturaVerdePct"] == 0.0

    def test_grama_alta_classifica_alta(self):
        resultado = analisar_imagem(_imagem_png(fracao_verde_de_baixo=0.5))
        assert resultado["categoria"] == "ALTA"
        assert resultado["alturaMedianaPct"] > FAIXA_MEDIA_PADRAO

    def test_retorna_png_anotado_nao_vazio(self):
        resultado = analisar_imagem(_imagem_png(fracao_verde_de_baixo=0.3))
        assert resultado["imagemAnotadaPng"].startswith(b"\x89PNG")


FAIXA_MEDIA_PADRAO = 35.0


# ── endpoint POST /grama/analisar ───────────────────────────────────────────

class TestEndpointAnalisarGrama:
    def test_upload_valido_retorna_200(self):
        arquivo = _imagem_png(fracao_verde_de_baixo=0.3)
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("grama.png", arquivo, "image/png")},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["categoria"] in ("AUSENTE", "BAIXA", "MEDIA", "ALTA")
        assert data["imagemAnotadaBase64"].startswith("data:image/png;base64,")
        assert len(data["porColuna"]) == 3

    def test_arquivo_vazio_retorna_400(self):
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("vazio.png", b"", "image/png")},
        )
        assert res.status_code == 400

    def test_bytes_invalidos_retorna_400(self):
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("naoimagem.txt", b"isto nao e uma imagem", "text/plain")},
        )
        assert res.status_code == 400

    def test_faixa_media_menor_que_baixa_retorna_422(self):
        arquivo = _imagem_png(fracao_verde_de_baixo=0.3)
        res = client.post(
            "/grama/analisar?faixaBaixaPct=40&faixaMediaPct=10",
            files={"arquivo": ("grama.png", arquivo, "image/png")},
        )
        assert res.status_code == 422

    def test_sem_calibracao_analisepick_e_none(self):
        arquivo = _imagem_png(fracao_verde_de_baixo=0.3)
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("grama.png", arquivo, "image/png")},
        )
        assert res.status_code == 200
        assert res.json()["analisePick"] is None


class TestEndpointAnalisarGramaComCalibracao:
    def _campos_calibracao(self):
        return {
            "calibP1X": str(FIXTURE_P1[0]),
            "calibP1Y": str(FIXTURE_P1[1]),
            "calibP2X": str(FIXTURE_P2[0]),
            "calibP2Y": str(FIXTURE_P2[1]),
            "calibDistanciaCm": str(FIXTURE_DISTANCIA_CM),
        }

    def test_upload_calibrado_retorna_analise_pick(self):
        conteudo = FIXTURE_GRAMA_COM_FITA.read_bytes()
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("grama_com_fita.png", conteudo, "image/png")},
            data=self._campos_calibracao(),
        )
        assert res.status_code == 200
        pick = res.json()["analisePick"]
        assert pick is not None
        assert pick["pxPorCm"] == pytest.approx(10.0)
        assert pick["alturaMediaCm"] == pytest.approx(FIXTURE_ALTURA_MEDIA_CM_ESPERADA, abs=0.01)

    def test_calibracao_parcial_retorna_422(self):
        conteudo = FIXTURE_GRAMA_COM_FITA.read_bytes()
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("grama_com_fita.png", conteudo, "image/png")},
            data={"calibP1X": "310"},
        )
        assert res.status_code == 422

    def test_distancia_cm_zero_retorna_422(self):
        conteudo = FIXTURE_GRAMA_COM_FITA.read_bytes()
        campos = self._campos_calibracao()
        campos["calibDistanciaCm"] = "0"
        res = client.post(
            "/grama/analisar",
            files={"arquivo": ("grama_com_fita.png", conteudo, "image/png")},
            data=campos,
        )
        assert res.status_code == 422
