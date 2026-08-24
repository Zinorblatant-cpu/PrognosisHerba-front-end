"""
Previsões — adaptador entre a IA de crescimento e o horoprognosis
====================================================================
A IA de crescimento de grama (`IAs---Challenge-Motiva/`, notebook
`main_v3.ipynb`) prevê, por região, a altura da grama nas próximas 12
semanas e devolve `nivel_alerta` (baixo/medio/alto), `inclinacao_graus`
(fixo por região) e `area_de_risco`. Esse formato não tem os campos que o
solver de horoprognosis.py espera (`prioridade`, `dificuldade`) — este
módulo faz a tradução: lê o CSV de previsão, acha a primeira semana em que
cada região atinge a altura de poda (`LIMIAR_PODA_CM`) e converte isso em
um lote de `locais` pronto para `rodar_modelo_horoprognosis`.

Ver MODELO_MATEMATICO.md para o modelo de alocação em si; este módulo só
cuida da etapa anterior (previsão → locais de poda).
"""

import csv
import os

CAMINHO_CSV_PADRAO = os.path.join(os.path.dirname(__file__), "data", "previsoes_v3_12_semanas.csv")

LIMIAR_PODA_CM = 10.0

MAPA_PRIORIDADE = {"baixo": "baixa", "medio": "media", "alto": "alta"}


# ---------------------------------------------------------------------------
# Carga do CSV
# ---------------------------------------------------------------------------

def carregar_previsoes(caminho=None):
    """Lê o CSV de previsões e agrupa por região, preservando a ordem das
    semanas. Devolve list[dict]: [{idRegiao, inclinacaoGraus, areaDeRisco,
    semanas: [{data, alturaPrevistaCm, nivelAlerta}, ...]}, ...]."""
    caminho = caminho or CAMINHO_CSV_PADRAO

    regioes = {}
    ordem = []
    with open(caminho, newline="", encoding="utf-8") as f:
        for linha in csv.DictReader(f):
            id_regiao = linha["id_regiao"]
            if id_regiao not in regioes:
                regioes[id_regiao] = {
                    "idRegiao": id_regiao,
                    "inclinacaoGraus": float(linha["inclinacao_graus"]),
                    "areaDeRisco": linha["area_de_risco"],
                    "semanas": [],
                }
                ordem.append(id_regiao)
            regioes[id_regiao]["semanas"].append({
                "data": linha["data"],
                "alturaPrevistaCm": float(linha["altura_prevista_cm"]),
                "nivelAlerta": linha["nivel_alerta"],
            })

    return [regioes[id_regiao] for id_regiao in ordem]


# ---------------------------------------------------------------------------
# Tradução previsão -> parâmetros do solver
# ---------------------------------------------------------------------------

def faixa_dificuldade(inclinacao_graus):
    """Converte a inclinação do terreno (graus) em dificuldade de poda.
    Faixas calibradas nos 4 valores reais das regiões (4.5/9.2/11.8/22.3),
    cobrindo as 3 categorias: quanto mais íngreme, mais difícil podar."""
    if inclinacao_graus <= 7:
        return "facil"
    if inclinacao_graus <= 15:
        return "media"
    return "dificil"


def _primeira_semana_no_limiar(semanas, limiar):
    for semana in semanas:
        if semana["alturaPrevistaCm"] >= limiar:
            return semana
    return None


def derivar_locais_de_poda(previsoes_por_regiao, limiar=LIMIAR_PODA_CM):
    """A partir das previsões de 12 semanas por região, deriva o lote de
    `locais` (id/prioridade/dificuldade/dataAlvo) que
    `rodar_modelo_horoprognosis_com_prazos` espera: TODAS as regiões que
    cruzam `limiar` em algum momento do horizonte de 12 semanas — não só
    as de um mês — cada uma com seu próprio prazo (`dataAlvo`, a primeira
    semana em que a altura prevista atinge o limiar).

    Regiões que não cruzam o limiar dentro do horizonte de 12 semanas
    ficam em `sem_alerta_no_horizonte` (não têm o que podar ainda).

    Retorna dict: {locais, semAlertaNoHorizonte}.
    """
    locais = []
    sem_alerta_no_horizonte = []

    for regiao in previsoes_por_regiao:
        semana_alvo = _primeira_semana_no_limiar(regiao["semanas"], limiar)
        if semana_alvo is None:
            sem_alerta_no_horizonte.append(regiao["idRegiao"])
            continue
        locais.append({
            "id": regiao["idRegiao"],
            "prioridade": MAPA_PRIORIDADE[semana_alvo["nivelAlerta"]],
            "dificuldade": faixa_dificuldade(regiao["inclinacaoGraus"]),
            "dataAlvo": semana_alvo["data"],
            "alturaPrevistaCm": semana_alvo["alturaPrevistaCm"],
        })

    return {"locais": locais, "semAlertaNoHorizonte": sem_alerta_no_horizonte}
