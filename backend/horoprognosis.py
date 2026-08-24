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
uma vez dentro do período (R1, ver `restricao_um`). Os locais chegam
prontos de um sistema externo (IA), cada um já com prioridade e
dificuldade definidas — por isso esses dois atributos são parâmetros de
'a', não índices de H (ver MODELO_MATEMATICO.md, seção "Nota de design").

Duas variantes:
- `rodar_modelo_horoprognosis` — mês fixo (ano/mês informados), sem prazo
  por local. Usada pelo endpoint manual `/gerar-alocacao`.
- `rodar_modelo_horoprognosis_com_prazos` — sem mês fixo: os dias úteis
  cobrem o horizonte de previsão inteiro (do prazo mais próximo ao mais
  distante do lote) e cada local só pode ser alocado até o seu próprio
  prazo (R3). Usada pelo endpoint `/previsoes/gerar-alocacao`, que é como
  o cronograma completo é gerado a partir das previsões da IA.

As duas aplicam também R4 (`aplicar_balanceamento_de_carga`): como as
equipes são intercambiáveis, a Função Objetivo sozinha é indiferente
entre concentrar tudo numa equipe ou espalhar por todas — R4 desempata a
favor de espalhar, sem nunca mudar quais locais entram no cronograma.

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


def gerar_dias_uteis_intervalo(data_inicio, data_fim):
    """Dias úteis (segunda a sexta) entre `data_inicio` e `data_fim`
    (strings ISO 'AAAA-MM-DD', ambas incluídas), na ordem do calendário.
    Usado pelo modelo de horizonte completo (`rodar_modelo_horoprognosis_com_prazos`),
    que não fica preso a um único mês."""
    inicio = datetime.date.fromisoformat(data_inicio)
    fim = datetime.date.fromisoformat(data_fim)
    dias_uteis = []
    data = inicio
    while data <= fim:
        if data.weekday() < 5:  # 0=segunda ... 4=sexta
            dias_uteis.append(data.isoformat())
        data += datetime.timedelta(days=1)
    return dias_uteis


# ---------------------------------------------------------------------------
# Restrições
# ---------------------------------------------------------------------------

def restricao_um(prob, a, c, d, dict_variaveis):
    """R1: cada local podado no máximo uma vez dentro do período.

    Itera só sobre as variáveis que existem em `dict_variaveis`: no modo
    de horizonte completo (`rodar_modelo_horoprognosis_com_prazos`), dias
    depois do prazo de um local nem chegam a virar variável (R3, ver
    esse módulo) — aqui isso só significa "essa combinação não contribui
    para a soma", sem precisar de nenhum caso especial."""
    for ia in a:
        linha = [dict_variaveis[(ia, ic, id_)] for ic, id_ in product(c, d) if (ia, ic, id_) in dict_variaveis]
        prob += (sum(linha) <= 1, f"r1_{ia}")
    return prob


def restricao_dois(prob, a, c, d, dict_variaveis, custos, capacidade_diaria=CAPACIDADE_DIARIA):
    """R2: capacidade diária por equipe, ponderada pela dificuldade —
    orçamento de `capacidade_diaria` pontos por (equipe, dia). Permite
    misturar dificuldades diferentes no mesmo dia, contanto que a soma dos
    custos não ultrapasse o orçamento."""
    contador = 0
    for ic, id_ in product(c, d):
        linha = [custos[ia] * dict_variaveis[(ia, ic, id_)] for ia in a if (ia, ic, id_) in dict_variaveis]
        prob += (sum(linha) <= capacidade_diaria, f"r2_{contador}")
        contador += 1
    return prob


def aplicar_balanceamento_de_carga(prob, a, c, d, dict_variaveis, custos):
    """R4: equilibra a carga entre as equipes.

    As equipes são intercambiáveis para o modelo (nenhuma tem custo ou
    habilidade diferente) — por isso, sem essa restrição, a Função
    Objetivo (que só maximiza prioridade coberta) fica indiferente entre
    concentrar tudo numa equipe só ou espalhar por todas: ambas valem o
    mesmo. Isso já foi observado na prática — com 4 equipes configuradas,
    o solver deixou 2 completamente ociosas mesmo sobrando capacidade.

    A correção usa duas variáveis contínuas: `carga_maxima` (o maior
    custo total que qualquer equipe carrega, somado em todos os dias do
    período) e `carga_minima` (o menor). Cada equipe fica presa entre as
    duas (`carga_minima ≤ carga da equipe ≤ carga_maxima`), e a função
    objetivo ganha dois termos: `- epsilon_max × carga_maxima` (achata o
    topo) e `+ epsilon_min × carga_minima`, com `epsilon_min ≪
    epsilon_max` (levanta o piso só como desempate secundário — sem isso,
    minimizar só o topo pode empatar entre "espalhar por todas" e
    "concentrar em algumas e deixar outras ociosas", já que ambas as
    soluções têm a mesma carga máxima).

    Os dois epsilons são calculados a partir da demanda total do lote
    para serem pequenos o bastante — juntos nunca chegam a valer 1 ponto
    de prioridade, então nunca mudam quais locais entram no cronograma
    (isso continua 100% decidido por R1/R2/FO original); só desempatam,
    entre soluções de mesma prioridade total, a favor da que distribui
    melhor a carga entre as equipes."""
    demanda_total = sum(custos[ia] for ia in a)
    epsilon_max = 1 / (2 * (demanda_total + 1))
    epsilon_min = epsilon_max / (2 * (demanda_total + 1))

    carga_maxima = plp.LpVariable("carga_maxima", lowBound=0)
    carga_minima = plp.LpVariable("carga_minima", lowBound=0)
    for ic in c:
        linha = [custos[ia] * dict_variaveis[(ia, ic, id_)] for ia, id_ in product(a, d) if (ia, ic, id_) in dict_variaveis]
        carga_equipe = sum(linha)
        prob += (carga_equipe <= carga_maxima, f"r4_max_{ic}")
        prob += (carga_equipe >= carga_minima, f"r4_min_{ic}")

    prob.objective += -epsilon_max * carga_maxima + epsilon_min * carga_minima
    return prob


# ---------------------------------------------------------------------------
# Construção do modelo
# ---------------------------------------------------------------------------

def gerar_prob_horoprognosis(a, c, d, pesos, variaveis=None):
    """Cria o LpProblem e define a Função Objetivo: maximizar a soma das
    variáveis Horótimas ponderada pela prioridade de cada local
    (`pesos[ia]`), para que locais mais urgentes sejam preferidos quando a
    capacidade do período não bastar para todos.

    `variaveis`: lista explícita de tuplas (a, c, d) a criar como variável
    de decisão. Por padrão é o produto cartesiano completo `A × C × D`; o
    modo de horizonte completo passa uma lista já filtrada pelo prazo de
    cada local (ver `rodar_modelo_horoprognosis_com_prazos`)."""
    variaveis = variaveis if variaveis is not None else list(product(a, c, d))
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
        {"callable": aplicar_balanceamento_de_carga, "argumentos": [prob, a, c, d, dict_variaveis, custos]},
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


def rodar_modelo_horoprognosis_com_prazos(locais, quantidade_equipes,
                                           capacidade_diaria=CAPACIDADE_DIARIA,
                                           pesos_prioridade=None, custos_dificuldade=None):
    """Variante de `rodar_modelo_horoprognosis` para o cronograma completo:
    em vez de um mês fixo, os dias úteis (`D`) cobrem do prazo mais
    próximo ao mais distante entre todos os locais do lote, e cada local
    só pode ser alocado num dia até o seu próprio prazo (`dataAlvo`) — R3,
    ver MODELO_MATEMATICO.md. Isso é o que permite gerar um cronograma
    único cobrindo todo o horizonte de previsão, sem escolher mês.

    `locais`: list[dict] com as mesmas chaves de `rodar_modelo_horoprognosis`
    mais `dataAlvo` (string ISO 'AAAA-MM-DD') — o prazo daquele local.

    Retorna (prob, locais, equipes, dias), igual a `rodar_modelo_horoprognosis`.
    """
    pesos_prioridade = pesos_prioridade or PESOS_PRIORIDADE
    custos_dificuldade = custos_dificuldade or CUSTOS_DIFICULDADE

    equipes = gerar_equipes(quantidade_equipes)
    data_inicio = min(loc["dataAlvo"] for loc in locais)
    data_fim = max(loc["dataAlvo"] for loc in locais)
    dias = gerar_dias_uteis_intervalo(data_inicio, data_fim)

    a, c, d = range(len(locais)), range(len(equipes)), range(len(dias))
    pesos = [pesos_prioridade[loc["prioridade"]] for loc in locais]
    custos = [custos_dificuldade[loc["dificuldade"]] for loc in locais]

    # R3: um local só pode ser podado num dia até o seu próprio prazo —
    # dias depois do prazo simplesmente não viram variável de decisão.
    variaveis = [
        (ia, ic, id_)
        for ia in a
        for ic in c
        for id_ in d
        if dias[id_] <= locais[ia]["dataAlvo"]
    ]

    prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos, variaveis=variaveis)
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
        # `prob` também carrega as variáveis auxiliares de R4
        # (carga_maxima/carga_minima, ver aplicar_balanceamento_de_carga) —
        # só as H_(a,c,d) representam uma alocação.
        if not var.name.startswith("H_("):
            continue
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
                                custos_dificuldade=None, capacidade_diaria=CAPACIDADE_DIARIA,
                                rotulo_periodo="mês"):
    """Se a demanda total do lote (soma dos custos de dificuldade) exceder
    a capacidade total do período (equipes × dias úteis × capacidade
    diária), devolve um dict com o déficit e o número sugerido de equipes
    extras. Devolve None quando a capacidade é suficiente.

    É uma aproximação agregada (capacidade total vs. demanda total do
    período inteiro), não uma checagem exata dia a dia — no modo de
    horizonte completo (com prazo por local), a lista `naoAlocados` da
    resposta do solver é que reflete o resultado real; este alerta só
    explica a causa provável e sugere quantas equipes extras ajudariam.

    `rotulo_periodo`: como chamar o período na mensagem ("mês" para o
    endpoint manual de mês fixo, "período" para o cronograma completo)."""
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
            f"Capacidade insuficiente para cobrir todos os locais deste {rotulo_periodo}. "
            f"Faltam {deficit:g} pontos de capacidade — considere aumentar em "
            f"cerca de {equipes_extras_sugeridas} equipe(s)."
        ),
    }
