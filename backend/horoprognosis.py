"""
Horoprognosis — Alocação de Equipes de Poda
=============================================
Variante da família Horótimo (mesmo motor de otimização do CronoManeger e
da Atos: Programação Linear Inteira Binária com PuLP), aplicada a um
domínio diferente: alocar equipes de poda a locais de poda dentro de um
mês, respeitando dias úteis e a capacidade diária de cada equipe.

H[a, c, d] = 1 → local de poda 'a' é podado pela equipe 'c' no dia 'd'.

Diferente do CronoManeger/Atos (onde 'matéria' é recorrente, com mínimo de
aulas por semana), aqui cada local é uma tarefa única: podado no máximo
uma vez dentro do mês (R1, ver `restricao_um`). Os locais chegam prontos de
um sistema externo (IA), cada um já com prioridade e dificuldade
definidas — por isso esses dois atributos são parâmetros de 'a', não
índices de H (ver MODELO_MATEMATICO.md, seção "Nota de design").

Ver MODELO_MATEMATICO.md (pasta horoprognosis/) para a formulação
completa: conjuntos, parâmetros, função objetivo, restrições e o alerta de
capacidade insuficiente.
"""

import calendar
import datetime
import math
from itertools import product

import pulp as plp


# ---------------------------------------------------------------------------
# Dados do problema
# ---------------------------------------------------------------------------

PESOS_PRIORIDADE = {"baixa": 1, "media": 2, "alta": 3}
CUSTOS_DIFICULDADE = {"facil": 1, "media": 1.5, "dificil": 3}
CAPACIDADE_DIARIA = 3


def gerar_equipes(quantidade):
    """Gera a lista de IDs de equipe ('equipe_1'..'equipe_N') para N equipes."""
    return [f"equipe_{i}" for i in range(1, quantidade + 1)]


def gerar_dias_uteis(ano, mes):
    """Dias úteis (segunda a sexta) do mês/ano informado, como strings ISO
    'AAAA-MM-DD', na ordem do calendário."""
    _, ultimo_dia = calendar.monthrange(ano, mes)
    dias_uteis = []
    for dia in range(1, ultimo_dia + 1):
        data = datetime.date(ano, mes, dia)
        if data.weekday() < 5:  # 0=segunda ... 4=sexta
            dias_uteis.append(data.isoformat())
    return dias_uteis


# ---------------------------------------------------------------------------
# Restrições
# ---------------------------------------------------------------------------

def restricao_um(prob, a, c, d, dict_variaveis):
    """R1: cada local podado no máximo uma vez dentro do mês."""
    for ia in a:
        linha = [dict_variaveis[(ia, ic, id_)] for ic, id_ in product(c, d)]
        prob += (sum(linha) <= 1, f"r1_{ia}")
    return prob


def restricao_dois(prob, a, c, d, dict_variaveis, custos, capacidade_diaria=CAPACIDADE_DIARIA):
    """R2: capacidade diária por equipe, ponderada pela dificuldade —
    orçamento de `capacidade_diaria` pontos por (equipe, dia). Permite
    misturar dificuldades diferentes no mesmo dia, contanto que a soma dos
    custos não ultrapasse o orçamento."""
    contador = 0
    for ic, id_ in product(c, d):
        linha = [custos[ia] * dict_variaveis[(ia, ic, id_)] for ia in a]
        prob += (sum(linha) <= capacidade_diaria, f"r2_{contador}")
        contador += 1
    return prob


# ---------------------------------------------------------------------------
# Construção do modelo
# ---------------------------------------------------------------------------

def gerar_prob_horoprognosis(a, c, d, pesos):
    """Cria o LpProblem e define a Função Objetivo: maximizar a soma das
    variáveis Horótimas ponderada pela prioridade de cada local
    (`pesos[ia]`), para que locais mais urgentes sejam preferidos quando a
    capacidade do mês não bastar para todos."""
    variaveis = list(product(a, c, d))
    prob = plp.LpProblem(name="Horoprognosis", sense=plp.LpMaximize)
    dict_variaveis = plp.LpVariable.dicts("H", variaveis, cat=plp.LpBinary)
    prob += (
        sum(pesos[ia] * dict_variaveis[(ia, ic, id_)] for ia, ic, id_ in variaveis),
        "FO",
    )
    return prob, dict_variaveis


def monta_lista_restricoes(prob, a, c, d, dict_variaveis, custos, capacidade_diaria=CAPACIDADE_DIARIA):
    return [
        {"callable": restricao_um, "argumentos": [prob, a, c, d, dict_variaveis]},
        {"callable": restricao_dois, "argumentos": [prob, a, c, d, dict_variaveis, custos, capacidade_diaria]},
    ]


def rodar_modelo_horoprognosis(locais, quantidade_equipes, ano, mes,
                                capacidade_diaria=CAPACIDADE_DIARIA,
                                pesos_prioridade=None, custos_dificuldade=None):
    """Resolve o modelo completo a partir de um lote de locais.

    `locais`: list[dict] com chaves 'id', 'prioridade' (baixa/media/alta) e
    'dificuldade' (facil/media/dificil).

    Retorna (prob, locais, equipes, dias) — os três últimos na mesma ordem
    usada para montar as variáveis (necessários para decodificar a solução).
    """
    pesos_prioridade = pesos_prioridade or PESOS_PRIORIDADE
    custos_dificuldade = custos_dificuldade or CUSTOS_DIFICULDADE

    equipes = gerar_equipes(quantidade_equipes)
    dias = gerar_dias_uteis(ano, mes)

    a, c, d = range(len(locais)), range(len(equipes)), range(len(dias))
    pesos = [pesos_prioridade[loc["prioridade"]] for loc in locais]
    custos = [custos_dificuldade[loc["dificuldade"]] for loc in locais]

    prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
    for rest in monta_lista_restricoes(prob, a, c, d, dvars, custos, capacidade_diaria):
        prob = rest["callable"](*rest["argumentos"])

    prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))
    return prob, locais, equipes, dias


# ---------------------------------------------------------------------------
# Formatação dos resultados
# ---------------------------------------------------------------------------

def gerar_alocacao(prob, locais, equipes, dias):
    """Converte a solução do PuLP em ({equipeId: {dia: [localId, ...]}},
    [localId não alocado, ...])."""
    alocacao = {equipe: {dia: [] for dia in dias} for equipe in equipes}
    alocados_ids = set()

    for var in prob.variables():
        if var.varValue != 1:
            continue
        indices = var.name.replace("H_(", "").replace(")", "").split(",_")
        ia, ic, id_ = map(int, indices)
        local_id = locais[ia]["id"]
        alocacao[equipes[ic]][dias[id_]].append(local_id)
        alocados_ids.add(local_id)

    nao_alocados = [loc["id"] for loc in locais if loc["id"] not in alocados_ids]
    return alocacao, nao_alocados


def calcular_alerta_capacidade(locais, quantidade_equipes, dias,
                                custos_dificuldade=None, capacidade_diaria=CAPACIDADE_DIARIA):
    """Se a demanda total do lote (soma dos custos de dificuldade) exceder
    a capacidade total do mês (equipes × dias úteis × capacidade diária),
    devolve um dict com o déficit e o número sugerido de equipes extras.
    Devolve None quando a capacidade é suficiente."""
    custos_dificuldade = custos_dificuldade or CUSTOS_DIFICULDADE

    capacidade_total_mes = quantidade_equipes * len(dias) * capacidade_diaria
    demanda_total = sum(custos_dificuldade[loc["dificuldade"]] for loc in locais)

    if demanda_total <= capacidade_total_mes:
        return None

    deficit = demanda_total - capacidade_total_mes
    equipes_dia_adicionais = math.ceil(deficit / capacidade_diaria)
    equipes_extras_sugeridas = math.ceil(equipes_dia_adicionais / len(dias)) if dias else equipes_dia_adicionais

    return {
        "capacidadeTotalMes": capacidade_total_mes,
        "demandaTotal": demanda_total,
        "deficit": deficit,
        "equipesDiaAdicionais": equipes_dia_adicionais,
        "equipesExtrasSugeridas": equipes_extras_sugeridas,
        "mensagem": (
            f"Capacidade insuficiente para cobrir todos os locais deste mês. "
            f"Faltam {deficit:g} pontos de capacidade — considere aumentar em "
            f"cerca de {equipes_extras_sugeridas} equipe(s)."
        ),
    }
