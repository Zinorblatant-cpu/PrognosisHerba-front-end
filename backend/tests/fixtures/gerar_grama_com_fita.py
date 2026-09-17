"""Gera backend/tests/fixtures/grama_com_fita.png.

Não roda em CI (nome sem prefixo `test_`, pytest não coleta). Executar
manualmente e commitar o PNG resultante quando o layout mudar:

    python tests/fixtures/gerar_grama_com_fita.py

Layout (canvas 400x300, largura x altura):
- Fundo marrom em tudo.
- Grama: retângulo verde sólido x em [0,250), y em [150,300) -> 250x150px.
- Fita métrica: faixa branca vertical x em [300,330), altura toda, com
  marcas pretas em y=50 (rótulo "0") e y=150 (rótulo "10").

Pontos de calibração usados nos testes: p1=(310,50), p2=(310,150),
distancia_cm=10.0 -> px_por_cm = 10.0 exato.
"""
import os

import cv2
import numpy as np

LARGURA, ALTURA = 400, 300
FUNDO_BGR = (40, 80, 120)
VERDE_BGR = (40, 180, 40)
BRANCO_BGR = (255, 255, 255)
PRETO_BGR = (0, 0, 0)


def gerar() -> np.ndarray:
    img = np.zeros((ALTURA, LARGURA, 3), dtype=np.uint8)
    img[:, :] = FUNDO_BGR

    # Grama: retângulo sólido, x em [0,250), y em [150,300).
    img[150:300, 0:250] = VERDE_BGR

    # Fita métrica: faixa branca vertical, x em [300,330).
    img[:, 300:330] = BRANCO_BGR
    for y, rotulo in ((50, "0"), (150, "10")):
        cv2.line(img, (300, y), (330, y), PRETO_BGR, 2)
        cv2.putText(
            img, rotulo, (335, y + 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, PRETO_BGR, 1,
        )
    return img


if __name__ == "__main__":
    caminho = os.path.join(os.path.dirname(__file__), "grama_com_fita.png")
    ok = cv2.imwrite(caminho, gerar())
    if not ok:
        raise SystemExit(f"Falha ao salvar {caminho}")
    print(f"OK: {caminho}")
