"""
Clusterização de regiões por rota, altura e tendência de crescimento
=====================================================================
Camada de **análise**, deliberadamente separada do solver
(`horoprognosis.py`): agrupa as regiões por perfil de crescimento para
dar leitura de conjunto ("quais trechos estão no mesmo estágio?"). Pode
virar parâmetro da Otimização no futuro, mas hoje não alimenta o modelo.

Três features por região, padronizadas antes do k-means:

1. **rota** — categórica, one-hot. ⚠️ SIMULADA: o CSV de previsão só tem
   `id_regiao`, sem nenhum campo geográfico. `ROTAS_SIMULADAS` abaixo é um
   mapa fixo, de mentira, para a arquitetura ficar pronta — trocar por
   dado real é substituir esse dicionário (e `rotaSimulada` vira `False`).
2. **altura mais recente** — último `altura_prevista_cm` da série.
3. **tendência de crescimento** — cm/semana, ver `tendencia_crescimento`.

Sobre a tendência: a série do CSV é *serrilhada*, porque `houve_poda`
marca as semanas em que a previsão já embute um corte e a altura volta à
linha de base. Regredir sobre a série inteira (ou sobre "as últimas N
semanas") dá lixo — uma região que acabou de ser podada apareceria com
tendência **negativa** de ~1,4 cm/semana, quando na verdade está
crescendo normal. Por isso a inclinação é medida **dentro do ciclo de
crescimento corrente** (desde a última poda), com a média dos ciclos
completos como fallback quando o ciclo corrente ainda é curto demais.
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from previsoes import carregar_series_com_poda

# ⚠️ DADOS DE ROTA SIMULADOS — pendente integração com a base real.
# Duas rotas para as quatro regiões conhecidas, só para a feature existir.
ROTAS_SIMULADAS = {
    "RA-01": "SP-330 · km 0–40",
    "RA-02": "SP-330 · km 0–40",
    "RA-03": "SP-348 · km 40–90",
    "RA-04": "SP-348 · km 40–90",
}

ROTA_DESCONHECIDA = "rota não mapeada"

AVISO_ROTA_SIMULADA = (
    "Dados de rota simulados — pendente integração com a base geográfica real. "
    "Altura e tendência de crescimento vêm das previsões reais."
)

# Mínimo de pontos para uma reta significar alguma coisa.
MIN_PONTOS_PARA_SLOPE = 3


# ---------------------------------------------------------------------------
# Tendência de crescimento
# ---------------------------------------------------------------------------

def separar_ciclos(semanas):
    """Quebra a série nos pontos de poda. `houvePoda=True` marca a semana em
    que o corte acontece — ela é o **primeiro ponto** do ciclo seguinte (a
    altura já vem resetada nela). Devolve list[list[semana]], na ordem."""
    ciclos = []
    atual = []
    for semana in semanas:
        if semana["houvePoda"] and atual:
            ciclos.append(atual)
            atual = []
        atual.append(semana)
    if atual:
        ciclos.append(atual)
    return ciclos


def _slope(alturas):
    """Inclinação (cm/semana) por mínimos quadrados sobre pontos igualmente
    espaçados. None quando não há pontos suficientes."""
    if len(alturas) < MIN_PONTOS_PARA_SLOPE:
        return None
    x = np.arange(len(alturas), dtype=float)
    return float(np.polyfit(x, np.asarray(alturas, dtype=float), 1)[0])


def tendencia_crescimento(semanas):
    """cm/semana esperados na próxima semana, medidos **dentro do ciclo de
    crescimento corrente** (desde a última poda).

    Se o ciclo corrente ainda for curto demais (a região acabou de ser
    podada), usa a média das inclinações dos ciclos completos anteriores —
    é a melhor estimativa disponível de como aquela região cresce. Sem
    nenhum ciclo utilizável, devolve 0.0.
    """
    ciclos = separar_ciclos(semanas)
    if not ciclos:
        return 0.0

    corrente = _slope([s["alturaPrevistaCm"] for s in ciclos[-1]])
    if corrente is not None:
        return corrente

    anteriores = [
        slope
        for ciclo in ciclos[:-1]
        if (slope := _slope([s["alturaPrevistaCm"] for s in ciclo])) is not None
    ]
    return float(np.mean(anteriores)) if anteriores else 0.0


def semanas_desde_ultima_poda(semanas):
    """Quantas semanas se passaram desde o último corte. Igual ao tamanho do
    ciclo corrente menos 1 (a semana da poda em si conta como zero)."""
    ciclos = separar_ciclos(semanas)
    return len(ciclos[-1]) - 1 if ciclos else 0


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------

def montar_features(series):
    """Uma linha por região: rota (simulada), altura mais recente, tendência
    de crescimento e semanas desde a última poda."""
    return [
        {
            "idRegiao": regiao["idRegiao"],
            "rota": ROTAS_SIMULADAS.get(regiao["idRegiao"], ROTA_DESCONHECIDA),
            "rotaSimulada": True,
            "alturaAtualCm": round(regiao["semanas"][-1]["alturaPrevistaCm"], 2),
            "tendenciaCmPorSemana": round(tendencia_crescimento(regiao["semanas"]), 3),
            "semanasDesdeUltimaPoda": semanas_desde_ultima_poda(regiao["semanas"]),
        }
        for regiao in series
        if regiao["semanas"]
    ]


def numero_de_clusters(quantidade_regioes, k=None):
    """k explícito manda (limitado ao nº de regiões). Sem k, mira ~2 regiões
    por grupo e teto de 4 — com 4 regiões dá 2 grupos, o que é o máximo que
    um lote desse tamanho comporta sem virar 1 região por cluster."""
    if quantidade_regioes <= 0:
        return 0
    if k is not None:
        return max(1, min(k, quantidade_regioes))
    return max(1, min(4, quantidade_regioes // 2))


def _matriz_de_features(features):
    """Rota vira one-hot **sem a primeira categoria**, altura e tendência
    entram como estão, e o `StandardScaler` deixa todas na mesma escala
    (senão a altura, em cm, dominaria a tendência, em décimos de cm).

    O `drop_first` não é cosmético: com one-hot completo, N rotas viram N
    colunas contra 1 de altura e 1 de tendência, e o k-means passa a
    reproduzir só o mapa de rotas — que hoje é justamente o dado
    **simulado**. Com N-1 colunas a rota pesa como as outras features.
    """
    rotas = sorted({f["rota"] for f in features})[1:]
    linhas = [
        [1.0 if f["rota"] == rota else 0.0 for rota in rotas]
        + [f["alturaAtualCm"], f["tendenciaCmPorSemana"]]
        for f in features
    ]
    matriz = np.asarray(linhas, dtype=float)
    # Colunas constantes (rota única no lote, ou uma região só) não informam
    # nada e o scaler as zera de qualquer forma — tirar evita divisão por
    # desvio zero. Se sobrar nenhuma, todas as regiões são idênticas do
    # ponto de vista das features: uma coluna de zeros as põe no mesmo ponto.
    variaveis = matriz[:, matriz.std(axis=0) > 0]
    if variaveis.shape[1] == 0:
        return np.zeros((len(linhas), 1))
    return StandardScaler().fit_transform(variaveis)


# ---------------------------------------------------------------------------
# Clusterização
# ---------------------------------------------------------------------------

def _rotulo(altura_media, tendencia_media, limiar):
    """Rótulo legível a partir do centro do grupo. `semanas até o limiar`
    é o que interessa na prática: altura alta + crescendo rápido = urgente."""
    if tendencia_media <= 0:
        return "estável" if altura_media < limiar else "acima do limiar"
    semanas_ate_limiar = (limiar - altura_media) / tendencia_media
    if semanas_ate_limiar <= 0:
        return "acima do limiar"
    # Faixas ancoradas no ciclo de poda observado no CSV (~6 semanas entre
    # cortes): "crítico" = não dá pra esperar a próxima janela; "atenção" =
    # cabe neste ciclo; "estável" = passa deste ciclo.
    if semanas_ate_limiar <= 2:
        return "crítico"
    if semanas_ate_limiar <= 6:
        return "atenção"
    return "estável"


def clusterizar(series, k=None, limiar_poda_cm=None):
    """Agrupa as regiões por perfil de crescimento.

    Devolve {avisoRota, clusters, regioes}. `clusters` vem ordenado do mais
    urgente (maior altura média) para o menos, e o `clusterId` é reatribuído
    nessa ordem — o rótulo numérico cru do k-means não tem significado e
    muda entre execuções.
    """
    from previsoes import LIMIAR_PODA_CM

    limiar = LIMIAR_PODA_CM if limiar_poda_cm is None else limiar_poda_cm
    features = montar_features(series)
    total_clusters = numero_de_clusters(len(features), k)

    if total_clusters == 0:
        return {"avisoRota": AVISO_ROTA_SIMULADA, "clusters": [], "regioes": []}

    modelo = KMeans(n_clusters=total_clusters, random_state=42, n_init=10)
    brutos = modelo.fit_predict(_matriz_de_features(features))

    grupos = {}
    for feature, bruto in zip(features, brutos):
        grupos.setdefault(int(bruto), []).append(feature)

    # Do mais alto para o mais baixo: quem está mais perto do limiar primeiro.
    ordenados = sorted(
        grupos.values(),
        key=lambda membros: -np.mean([m["alturaAtualCm"] for m in membros]),
    )

    clusters = []
    regioes = []
    for cluster_id, membros in enumerate(ordenados):
        altura_media = float(np.mean([m["alturaAtualCm"] for m in membros]))
        tendencia_media = float(np.mean([m["tendenciaCmPorSemana"] for m in membros]))
        clusters.append({
            "clusterId": cluster_id,
            "rotulo": _rotulo(altura_media, tendencia_media, limiar),
            "regioes": [m["idRegiao"] for m in membros],
            "rotas": sorted({m["rota"] for m in membros}),
            "alturaMediaCm": round(altura_media, 2),
            "tendenciaMediaCmPorSemana": round(tendencia_media, 3),
        })
        regioes.extend({**m, "clusterId": cluster_id} for m in membros)

    regioes.sort(key=lambda r: r["idRegiao"])
    return {"avisoRota": AVISO_ROTA_SIMULADA, "clusters": clusters, "regioes": regioes}


def clusterizar_do_csv(caminho=None, k=None, limiar_poda_cm=None):
    return clusterizar(carregar_series_com_poda(caminho), k=k, limiar_poda_cm=limiar_poda_cm)
