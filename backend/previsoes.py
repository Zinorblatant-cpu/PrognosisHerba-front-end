"""
Previsões — adaptador entre a IA de crescimento e o horoprognosis
====================================================================
A IA de crescimento de grama (`IAs---Challenge-Motiva/`, notebook
`main_v3.ipynb`) prevê, por região, a altura da grama ao longo de um
horizonte de N semanas (N vem do CSV carregado — não é fixo no código) e
devolve `nivel_alerta` (baixo/medio/alto), `inclinacao_graus` (fixo por
região), `area_de_risco` e `houve_poda`. Esse formato não tem os campos
que o solver de horoprognosis.py espera (`prioridade`, `dificuldade`) —
este módulo faz a tradução: lê o CSV de previsão, acha a primeira semana
em que cada região atinge a altura de poda (`LIMIAR_PODA_CM`) e converte
isso em um lote de `locais` pronto para `rodar_modelo_horoprognosis`.

Sobre `houve_poda` (coluna presente no CSV de 52 semanas): marca as
semanas em que a previsão já embute um corte — a altura volta à linha de
base logo depois. Este módulo **ainda não lê essa coluna** (o
`csv.DictReader` simplesmente a ignora); ela é o insumo natural da
análise de tendência de crescimento / clusterização, não da derivação de
locais.

Ver MODELO_MATEMATICO.md para o modelo de alocação em si; este módulo só
cuida da etapa anterior (previsão → locais de poda).
"""
import csv
import os

CAMINHO_CSV_PADRAO = os.path.join(os.path.dirname(__file__), "data", "previsoes_v3_52_semanas.csv")

# Altura a partir da qual a região entra na fila de poda. Calibrado para o
# CSV padrão: nele a previsão já embute os cortes (`houve_poda`), então a
# curva é serrilhada e nunca passa de ~9,9 cm — com o limiar antigo de
# 10,0 cm nenhuma região cruzaria e não haveria o que otimizar.
LIMIAR_PODA_CM = 9.0

MAPA_PRIORIDADE = {"baixo": "baixa", "medio": "media", "alto": "alta"}


# ---------------------------------------------------------------------------
# Carga do CSV
# ---------------------------------------------------------------------------

def _texto_para_bool(valor):
    """`houve_poda` vem como texto no CSV ("True"/"False"). Coluna ausente
    (CSV antigo de 12 semanas) conta como "nunca houve poda"."""
    return str(valor).strip().lower() in {"true", "1", "sim"}


def carregar_series_com_poda(caminho=None):
    """Como `carregar_previsoes`, mas mantendo `houvePoda` em cada semana.

    Existe separado porque `houvePoda` **não faz parte do contrato de
    `GET /previsoes`** — é insumo da análise de crescimento
    (`clusterizacao.py`), onde marca os pontos em que a curva reseta.
    """
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
                "houvePoda": _texto_para_bool(linha.get("houve_poda", "")),
            })

    return [regioes[id_regiao] for id_regiao in ordem]


def carregar_previsoes(caminho=None):
    """Lê o CSV de previsões e agrupa por região, preservando a ordem das
    semanas. Devolve list[dict]: [{idRegiao, inclinacaoGraus, areaDeRisco,
    semanas: [{data, alturaPrevistaCm, nivelAlerta}, ...]}, ...]."""
    return [
        {**regiao, "semanas": [
            {k: v for k, v in semana.items() if k != "houvePoda"}
            for semana in regiao["semanas"]
        ]}
        for regiao in carregar_series_com_poda(caminho)
    ]


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
    """A partir das previsões por região (horizonte completo do CSV
    carregado), deriva o lote de `locais`
    (id/prioridade/dificuldade/dataAlvo) que
    `rodar_modelo_horoprognosis_com_prazos` espera: TODAS as regiões que
    cruzam `limiar` em algum momento do horizonte — não só as de um mês —
    cada uma com seu próprio prazo (`dataAlvo`, a primeira semana em que a
    altura prevista atinge o limiar).

    Regiões que não cruzam o limiar dentro do horizonte ficam em
    `sem_alerta_no_horizonte` (não têm o que podar ainda).

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
