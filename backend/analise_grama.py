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


def calcular_px_por_cm(
    p1: tuple[float, float], p2: tuple[float, float], distancia_cm: float
) -> float:
    """Escala px/cm a partir de 2 pontos clicados na fita métrica + a
    distância real (cm) conhecida entre eles.

    Porta pura de `Challenge-Grama-Webcam-Exato/calibrar.py:calcular_px_por_cm`
    (mesma fórmula), sem dependência de webcam/OpenCV UI.
    """
    if distancia_cm <= 0:
        raise ValueError("distanciaCm deve ser > 0.")
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist_px = float(np.hypot(dx, dy))
    if dist_px == 0:
        raise ValueError("Os dois pontos de calibração são idênticos.")
    return dist_px / distancia_cm


def _mascara_interior_pick(mask: np.ndarray) -> np.ndarray:
    """Pixels verdes cujos 4 vizinhos ortogonais também são verdes.

    `borderValue=0` é explícito porque o default do OpenCV trata "fora da
    imagem" como foreground — sem isso, um pixel de grama que toca a borda da
    foto (comum) seria contado como interior mesmo sem vizinho real ali.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    return cv2.erode(mask, kernel, iterations=1, borderValue=0)


def contar_pontos_pick(mask: np.ndarray) -> tuple[int, int]:
    """Conta pontos interiores (I) e de borda (B) da máscara pro Teorema de Pick.

    Cada pixel verde é um ponto de uma malha unitária (lattice point = centro
    do pixel). Interior: ver `_mascara_interior_pick`. Borda: os demais
    pixels verdes.

    Nota: nessa convenção (lattice = centro do pixel), a área de Pick
    (I + B/2 - 1) NÃO reproduz a contagem bruta de pixels — desconta
    aproximadamente metade do perímetro, o que amortece bordas serrilhadas
    (pontas de grama) em vez de ser um sinônimo redundante da contagem.
    """
    interior = _mascara_interior_pick(mask)
    total = int(np.count_nonzero(mask))
    pontos_interiores = int(np.count_nonzero(interior))
    pontos_borda = total - pontos_interiores
    return pontos_interiores, pontos_borda


def maior_componente(mask: np.ndarray) -> np.ndarray | None:
    """Isola o maior componente conexo da máscara (ignora respingos menores
    e ruído). None se não há nenhum componente verde."""
    num_labels, labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, connectivity=4)
    if num_labels <= 1:  # só o fundo (label 0)
        return None
    maior_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(labels == maior_label, 255, 0).astype(np.uint8)


def analisar_pick(mask: np.ndarray, px_por_cm: float) -> dict | None:
    """Teorema de Pick sobre o maior componente conexo da máscara, convertido
    pra cm² via `px_por_cm`, e transformado numa altura MÉDIA (área da mancha
    ÷ largura do seu bounding box — como se fosse um retângulo equivalente).

    Restringir ao maior componente evita que um respingo verde isolado
    (ruído, anti-aliasing) infle a largura e distorça a altura média. None se
    não há nenhum componente verde.
    """
    num_labels, labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, connectivity=4)
    if num_labels <= 1:  # só o fundo (label 0)
        return None

    maior_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    largura_px = int(stats[maior_label, cv2.CC_STAT_WIDTH])
    if largura_px <= 0:
        return None

    mascara_componente = np.where(labels == maior_label, 255, 0).astype(np.uint8)
    pontos_interiores, pontos_borda = contar_pontos_pick(mascara_componente)
    area_px2 = max(pontos_interiores + pontos_borda / 2 - 1, 0.0)

    area_cm2 = area_px2 / (px_por_cm ** 2)
    largura_cm = largura_px / px_por_cm
    altura_media_cm = area_cm2 / largura_cm

    return {
        "pxPorCm": px_por_cm,
        "pontosInteriores": pontos_interiores,
        "pontosBorda": pontos_borda,
        "areaCm2": area_cm2,
        "larguraCm": largura_cm,
        "alturaMediaCm": altura_media_cm,
    }


def _formatar_pct(valor: float | None) -> str:
    if valor is None:
        return "—"
    return f"{valor:.1f}%"


# Verde = ponto interior (I); laranja = ponto de borda (B) — mesmas cores da
# legenda mostrada no frontend.
COR_PICK_INTERIOR_BGR = (0, 220, 0)
COR_PICK_BORDA_BGR = (0, 140, 255)
COR_PICK_CAIXA_BGR = (255, 0, 255)


def _desenhar_pontos_pick(annotated: np.ndarray, mask: np.ndarray, analise_pick: dict) -> None:
    """Amostra e desenha uma "bolinha" por ponto da malha do Teorema de Pick
    (verde=interior, laranja=borda) sobre o maior componente da máscara —
    não dá pra desenhar 1 bolinha por pixel (seriam dezenas de milhares,
    ilegível), então amostra numa grade espaçada proporcional ao tamanho da
    mancha. Também desenha a caixa delimitadora usada como "largura" e um
    resumo da área/altura calculadas.
    """
    componente = maior_componente(mask)
    if componente is None:
        return
    interior = _mascara_interior_pick(componente)

    x, y, largura, altura = cv2.boundingRect(componente)
    espacamento = max(min(largura, altura) // 20, 5)

    # Garante que a última linha/coluna da caixa entra na amostra mesmo
    # quando largura/altura não é múltiplo de `espacamento` — senão os
    # cantos direito/inferior da mancha ficam sem nenhuma bolinha de borda,
    # dando a impressão errada de que só o topo/esquerda tem borda.
    xs = list(range(x, x + largura, espacamento))
    if xs[-1] != x + largura - 1:
        xs.append(x + largura - 1)
    ys = list(range(y, y + altura, espacamento))
    if ys[-1] != y + altura - 1:
        ys.append(y + altura - 1)

    for py in ys:
        for px in xs:
            if componente[py, px] == 0:
                continue
            cor = COR_PICK_INTERIOR_BGR if interior[py, px] == 255 else COR_PICK_BORDA_BGR
            cv2.circle(annotated, (px, py), 2, cor, -1)

    cv2.rectangle(annotated, (x, y), (x + largura, y + altura), COR_PICK_CAIXA_BGR, 1)
    legenda = (
        f"Pick: {analise_pick['alturaMediaCm']:.1f}cm "
        f"({analise_pick['areaCm2']:.0f}cm2 / {analise_pick['larguraCm']:.1f}cm)"
    )
    cv2.putText(
        annotated, legenda, (x, max(y - 8, 14)),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, COR_PICK_CAIXA_BGR, 1,
    )


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
    analise_pick: dict | None = None,
) -> np.ndarray:
    """Desenha a máscara sobreposta + colunas amostradas + categoria sobre a
    imagem. Com `analise_pick` (calibração por fita métrica), também desenha
    os pontos amostrados da malha do Teorema de Pick — ver `_desenhar_pontos_pick`.
    """
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

    if analise_pick is not None:
        _desenhar_pontos_pick(annotated, mask, analise_pick)

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
    px_por_cm: float | None = None,
) -> dict:
    """Pipeline completo: decodifica, segmenta, mede e classifica uma imagem.

    `px_por_cm` é opcional — quando informado (calibração por fita métrica),
    a chave `analisePick` do retorno traz a altura média em cm via Teorema de
    Pick (ver `analisar_pick`); sem calibração, vem `None` e o resultado em %
    (sempre calculado) continua sendo a única leitura disponível.

    Retorna um dict serializável com os campos usados pelo endpoint
    `/grama/analisar` (chave `imagemAnotadaPng` traz os bytes crus do PNG,
    a codificação em base64 fica por conta do chamador).
    """
    frame = decodificar_imagem(conteudo)
    mask = apply_mask(frame)
    altura_frame, largura_frame = mask.shape[:2]

    analise_pick = analisar_pick(mask, px_por_cm) if px_por_cm is not None else None

    top_ys = measure_top_y(mask, SAMPLE_COLS)
    alturas_pct = [y_para_altura_pct(y, altura_frame) for y in top_ys]
    nivel, categoria, mediana = classify_frame_pct(alturas_pct, faixa_baixa_pct, faixa_media_pct)
    margem = margem_erro_pct(alturas_pct)
    cobertura = cobertura_verde_pct(mask)

    anotada = desenhar_anotacoes(
        frame, mask, top_ys, alturas_pct, SAMPLE_COLS,
        mediana, margem, categoria, faixa_baixa_pct, faixa_media_pct,
        analise_pick,
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
        "analisePick": analise_pick,
    }
