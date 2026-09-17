"""
Análise de altura de grama a partir de uma única imagem enviada pelo usuário.
==============================================================================
Adaptado do pipeline de visão de `Challenge-Grama-Webcam-Exato/medir_grama.py`
(segmentação HSV + amostragem por coluna + mediana), mas operando sobre uma
imagem avulsa em vez de uma webcam fixa e calibrada.

Sem `calibration.json` não existe `px_por_cm` nem `y_chao` reais, então a
altura não pode ser expressa em centímetros — é expressa como % da altura do
frame, medida a partir da base da imagem (assumida como "chão").
"""
from __future__ import annotations

import cv2
import numpy as np

HSV_LOWER = (35, 40, 40)
HSV_UPPER = (85, 255, 255)
SAMPLE_COLS = (0.25, 0.50, 0.75)
LEVEL_NAMES = ("AUSENTE", "BAIXA", "MEDIA", "ALTA")
# Cores BGR (OpenCV) por nível — usadas nas bolinhas/legenda da imagem anotada.
LEVEL_COLORS_BGR = (
    (150, 150, 150),  # AUSENTE — cinza
    (0, 255, 0),      # BAIXA — verde
    (0, 255, 255),    # MEDIA — amarelo
    (0, 0, 255),      # ALTA — vermelho
)
FAIXA_BAIXA_PCT = 15.0   # altura <= FAIXA_BAIXA_PCT (% do frame) → BAIXA
FAIXA_MEDIA_PCT = 35.0   # FAIXA_BAIXA_PCT < altura <= FAIXA_MEDIA_PCT → MEDIA
                         # altura > FAIXA_MEDIA_PCT → ALTA


def decodificar_imagem(conteudo: bytes) -> np.ndarray:
    """Decodifica bytes de upload (JPEG/PNG/...) numa imagem BGR do OpenCV.

    Levanta ValueError se o conteúdo não for uma imagem decodificável.
    """
    array = np.frombuffer(conteudo, dtype=np.uint8)
    imagem = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if imagem is None:
        raise ValueError("Não foi possível decodificar a imagem enviada.")
    return imagem


def apply_mask(frame_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array(HSV_LOWER), np.array(HSV_UPPER))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


def measure_top_y(mask: np.ndarray, col_fractions: tuple[float, ...]) -> list[int | None]:
    """Retorna Y do primeiro pixel verde de cima em cada coluna, ou None se vazio."""
    _altura_frame, largura_frame = mask.shape[:2]
    top_ys: list[int | None] = []
    for frac in col_fractions:
        x = min(int(largura_frame * frac), largura_frame - 1)
        coluna = mask[:, x]
        indices = np.where(coluna == 255)[0]
        top_ys.append(int(indices[0]) if indices.size else None)
    return top_ys


def y_para_altura_pct(y_topo: int | None, altura_frame: int) -> float | None:
    """Converte y do topo do verde em % da altura do frame, a partir da base
    da imagem (assumida como chão, já que não há calibração de câmera).

    None se sem verde. 0.0 se o topo estiver na base ou abaixo dela.
    """
    if y_topo is None:
        return None
    y_chao = altura_frame - 1
    if y_topo >= y_chao:
        return 0.0
    return (y_chao - y_topo) / altura_frame * 100.0


def classify_pct(
    altura_pct: float | None, faixa_baixa: float, faixa_media: float
) -> tuple[int, str]:
    """Classifica altura (% do frame) em (nivel, nome).

    None → AUSENTE. <= faixa_baixa → BAIXA. <= faixa_media → MEDIA. Senão ALTA.
    """
    if altura_pct is None:
        return 0, LEVEL_NAMES[0]
    if altura_pct <= faixa_baixa:
        return 1, LEVEL_NAMES[1]
    if altura_pct <= faixa_media:
        return 2, LEVEL_NAMES[2]
    return 3, LEVEL_NAMES[3]


def classify_frame_pct(
    alturas_pct: list[float | None], faixa_baixa: float, faixa_media: float
) -> tuple[int, str, float | None]:
    """Agrega alturas das colunas via mediana. Retorna (nivel, categoria, mediana_pct)."""
    validas = [a for a in alturas_pct if a is not None]
    if not validas:
        return 0, LEVEL_NAMES[0], None
    mediana = float(np.median(validas))
    nivel, categoria = classify_pct(mediana, faixa_baixa, faixa_media)
    return nivel, categoria, mediana


def margem_erro_pct(alturas_pct: list[float | None]) -> float | None:
    """Metade da amplitude (max - min) das alturas válidas em %.

    None se menos de 2 colunas válidas. 0.0 se todas iguais.
    """
    validas = [a for a in alturas_pct if a is not None]
    if len(validas) < 2:
        return None
    return (max(validas) - min(validas)) / 2.0


def cobertura_verde_pct(mask: np.ndarray) -> float:
    """% de pixels do frame classificados como verde pela máscara HSV."""
    return float(np.count_nonzero(mask == 255)) / mask.size * 100.0


def _formatar_pct(valor: float | None) -> str:
    if valor is None:
        return "—"
    return f"{valor:.1f}%"


def desenhar_anotacoes(
    frame_bgr: np.ndarray,
    mask: np.ndarray,
    top_ys: list[int | None],
    alturas_pct: list[float | None],
    col_fractions: tuple[float, ...],
    altura_mediana_pct: float | None,
    margem_pct: float | None,
    categoria: str,
    faixa_baixa: float,
    faixa_media: float,
) -> np.ndarray:
    """Desenha a máscara sobreposta + colunas amostradas + categoria sobre a imagem."""
    annotated = frame_bgr.copy()
    altura_frame, largura_frame = annotated.shape[:2]

    mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
    annotated = cv2.addWeighted(annotated, 0.7, mask_bgr, 0.3, 0)

    # Colunas verticais + marca do topo colorida pela categoria + label em %
    for frac, y_topo, altura in zip(col_fractions, top_ys, alturas_pct):
        x = min(int(largura_frame * frac), largura_frame - 1)
        cv2.line(annotated, (x, 0), (x, altura_frame), (0, 255, 255), 1)
        if y_topo is not None:
            nivel_col, _ = classify_pct(altura, faixa_baixa, faixa_media)
            cor = LEVEL_COLORS_BGR[nivel_col]
            cv2.circle(annotated, (x, y_topo), 5, cor, -1)
            cv2.putText(
                annotated, _formatar_pct(altura), (x + 8, max(y_topo - 4, 14)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, cor, 1,
            )

    titulo = f"{_formatar_pct(altura_mediana_pct)} ± {_formatar_pct(margem_pct)} - {categoria}"
    (tw, _), _ = cv2.getTextSize(titulo, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
    x_titulo = max((largura_frame - tw) // 2, 4)
    cv2.putText(
        annotated, titulo, (x_titulo, 28),
        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2,
    )

    return annotated


def analisar_imagem(
    conteudo: bytes,
    faixa_baixa_pct: float = FAIXA_BAIXA_PCT,
    faixa_media_pct: float = FAIXA_MEDIA_PCT,
) -> dict:
    """Pipeline completo: decodifica, segmenta, mede e classifica uma imagem.

    Retorna um dict serializável com os campos usados pelo endpoint
    `/grama/analisar` (chave `imagemAnotadaPng` traz os bytes crus do PNG,
    a codificação em base64 fica por conta do chamador).
    """
    frame = decodificar_imagem(conteudo)
    mask = apply_mask(frame)
    altura_frame, largura_frame = mask.shape[:2]

    top_ys = measure_top_y(mask, SAMPLE_COLS)
    alturas_pct = [y_para_altura_pct(y, altura_frame) for y in top_ys]
    nivel, categoria, mediana = classify_frame_pct(alturas_pct, faixa_baixa_pct, faixa_media_pct)
    margem = margem_erro_pct(alturas_pct)
    cobertura = cobertura_verde_pct(mask)

    anotada = desenhar_anotacoes(
        frame, mask, top_ys, alturas_pct, SAMPLE_COLS,
        mediana, margem, categoria, faixa_baixa_pct, faixa_media_pct,
    )
    ok, buffer = cv2.imencode(".png", anotada)
    if not ok:
        raise ValueError("Falha ao codificar a imagem anotada.")

    por_coluna = []
    for frac, altura in zip(SAMPLE_COLS, alturas_pct):
        nivel_col, categoria_col = classify_pct(altura, faixa_baixa_pct, faixa_media_pct)
        por_coluna.append({
            "fracaoX": frac,
            "alturaPct": altura,
            "nivel": nivel_col,
            "categoria": categoria_col,
        })

    return {
        "nivel": nivel,
        "categoria": categoria,
        "alturaMedianaPct": mediana,
        "margemErroPct": margem,
        "coberturaVerdePct": cobertura,
        "porColuna": por_coluna,
        "larguraPx": largura_frame,
        "alturaPx": altura_frame,
        "imagemAnotadaPng": buffer.tobytes(),
    }
