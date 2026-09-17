"""
Testes para analise_grama.py e o endpoint POST /grama/analisar.

Rodar: pytest tests/test_analise_grama.py -v
"""
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from analise_grama import (
    analisar_imagem,
    apply_mask,
    classify_frame_pct,
    classify_pct,
    margem_erro_pct,
    measure_top_y,
    y_para_altura_pct,
)
from server import app

client = TestClient(app)

VERDE_BGR = (40, 180, 40)
FUNDO_BGR = (40, 80, 120)


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
