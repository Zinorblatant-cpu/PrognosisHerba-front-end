"""
Testes unitários e de integração para horoprognosis.py.

Rodar: pytest tests/test_horoprognosis.py -v
"""
import calendar
import datetime

import pulp as plp
import pytest

from horoprognosis import (
    CAPACIDADE_DIARIA,
    CUSTOS_DIFICULDADE,
    PESOS_PRIORIDADE,
    aplicar_balanceamento_de_carga,
    calcular_alerta_capacidade,
    gerar_alocacao,
    gerar_dias_uteis,
    gerar_dias_uteis_intervalo,
    gerar_equipes,
    gerar_prob_horoprognosis,
    monta_lista_restricoes,
    restricao_dois,
    restricao_um,
    rodar_modelo_horoprognosis,
    rodar_modelo_horoprognosis_com_prazos,
)


def _locais(especificacoes):
    """Constrói uma lista de locais a partir de tuplas (id, prioridade, dificuldade)."""
    return [{"id": lid, "prioridade": p, "dificuldade": dif} for lid, p, dif in especificacoes]


# ── gerar_equipes / gerar_dias_uteis ────────────────────────────────────────

class TestGerarEquipes:
    def test_gera_ids_sequenciais(self):
        assert gerar_equipes(3) == ["equipe_1", "equipe_2", "equipe_3"]

    def test_quantidade_zero_retorna_lista_vazia(self):
        assert gerar_equipes(0) == []


class TestGerarDiasUteis:
    def test_conta_bate_com_calendar(self):
        ano, mes = 2026, 9
        dias = gerar_dias_uteis(ano, mes)
        _, ultimo_dia = calendar.monthrange(ano, mes)
        esperado = sum(
            1 for dia in range(1, ultimo_dia + 1)
            if datetime.date(ano, mes, dia).weekday() < 5
        )
        assert len(dias) == esperado

    def test_so_contem_dias_de_semana(self):
        for dia_iso in gerar_dias_uteis(2026, 9):
            data = datetime.date.fromisoformat(dia_iso)
            assert data.weekday() < 5  # 0=segunda ... 4=sexta

    def test_ordem_cronologica(self):
        dias = gerar_dias_uteis(2026, 9)
        assert dias == sorted(dias)

    def test_fevereiro_bissexto(self):
        # 2028 é bissexto (29 dias em fevereiro)
        dias = gerar_dias_uteis(2028, 2)
        assert datetime.date.fromisoformat(dias[-1]) <= datetime.date(2028, 2, 29)


class TestGerarDiasUteisIntervalo:
    def test_intervalo_de_um_dia_util(self):
        assert gerar_dias_uteis_intervalo("2026-09-14", "2026-09-14") == ["2026-09-14"]

    def test_extremos_incluidos(self):
        dias = gerar_dias_uteis_intervalo("2026-09-14", "2026-09-18")
        assert dias[0] == "2026-09-14"
        assert dias[-1] == "2026-09-18"

    def test_exclui_fins_de_semana(self):
        # 2026-09-14 (seg) a 2026-09-20 (dom): só os 5 dias úteis
        dias = gerar_dias_uteis_intervalo("2026-09-14", "2026-09-20")
        assert len(dias) == 5
        for dia_iso in dias:
            assert datetime.date.fromisoformat(dia_iso).weekday() < 5

    def test_ordem_cronologica(self):
        dias = gerar_dias_uteis_intervalo("2026-09-01", "2026-11-02")
        assert dias == sorted(dias)

    def test_atravessa_varios_meses(self):
        dias = gerar_dias_uteis_intervalo("2026-09-14", "2026-11-02")
        assert dias[0] == "2026-09-14"
        assert dias[-1] == "2026-11-02"  # 2026-11-02 é segunda-feira, incluída

    def test_intervalo_de_fim_de_semana_para_ele_mesmo_e_vazio(self):
        # 2026-09-19 e 2026-09-20 são sábado/domingo
        assert gerar_dias_uteis_intervalo("2026-09-19", "2026-09-20") == []


# ── gerar_prob_horoprognosis ─────────────────────────────────────────────────

class TestGerarProb:
    def test_numero_de_variaveis(self):
        a, c, d = range(4), range(2), range(3)
        _, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1, 1, 1])
        assert len(dvars) == 4 * 2 * 3

    def test_variaveis_sao_binarias(self):
        a, c, d = range(2), range(1), range(1)
        _, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1])
        for var in dvars.values():
            assert var.cat in ("Binary", "Integer")

    def test_lista_de_variaveis_explicita_restringe_o_conjunto(self):
        # Só (0,0,0) e (1,0,1) são criadas, mesmo com a=range(2), d=range(2)
        a, c, d = range(2), range(1), range(2)
        variaveis = [(0, 0, 0), (1, 0, 1)]
        _, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1], variaveis=variaveis)
        assert set(dvars.keys()) == set(variaveis)


# ── Restrições (modelo pequeno) ──────────────────────────────────────────────

class TestRestricoes:
    def test_r1_uma_constraint_por_local(self):
        a, c, d = range(3), range(2), range(2)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1, 1])
        restricao_um(prob, a, c, d, dvars)
        assert sum(1 for k in prob.constraints if k.startswith("r1_")) == len(a)

    def test_r2_uma_constraint_por_equipe_dia(self):
        a, c, d = range(3), range(2), range(2)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1, 1])
        restricao_dois(prob, a, c, d, dvars, custos=[1, 1, 1])
        assert sum(1 for k in prob.constraints if k.startswith("r2_")) == len(c) * len(d)

    def test_monta_lista_restricoes_tem_r1_r2_e_balanceamento(self):
        a, c, d = range(2), range(1), range(1)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1])
        restricoes = monta_lista_restricoes(prob, a, c, d, dvars, custos=[1, 1])
        assert len(restricoes) == 3

    def test_r1_e_r2_toleram_variaveis_ausentes(self):
        # R3 (prazo por local) funciona não criando a variável do dia
        # depois do prazo — r1/r2 precisam continuar montando uma
        # constraint por local/equipe-dia mesmo assim, só sem essa parcela.
        a, c, d = range(2), range(1), range(2)
        variaveis = [(0, 0, 0), (0, 0, 1), (1, 0, 0)]  # falta (1, 0, 1)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1], variaveis=variaveis)
        restricao_um(prob, a, c, d, dvars)
        restricao_dois(prob, a, c, d, dvars, custos=[1, 1])
        assert sum(1 for k in prob.constraints if k.startswith("r1_")) == len(a)
        assert sum(1 for k in prob.constraints if k.startswith("r2_")) == len(c) * len(d)


class TestAplicarBalanceamentoDeCarga:
    def test_cria_duas_constraints_r4_por_equipe(self):
        a, c, d = range(4), range(3), range(2)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1, 1, 1])
        aplicar_balanceamento_de_carga(prob, a, c, d, dvars, custos=[1, 1, 1, 1])
        assert sum(1 for k in prob.constraints if k.startswith("r4_")) == 2 * len(c)

    def test_reduz_a_funcao_objetivo(self):
        a, c, d = range(2), range(1), range(1)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1])
        objetivo_antes = prob.objective.copy()
        aplicar_balanceamento_de_carga(prob, a, c, d, dvars, custos=[1, 1])
        assert prob.objective != objetivo_antes

    def test_nao_muda_quais_locais_sao_selecionados(self):
        # 4 locais fáceis, pesos crescentes, 2 equipes com orçamento 1 cada
        # (capacidade total do dia = 2) -> só cabem os 2 de maior peso
        # (índices 2 e 3), com ou sem balanceamento: R4 só desempata entre
        # soluções de mesma prioridade, nunca muda quem é selecionado.
        a, c, d = range(4), range(2), range(1)
        custos = [1, 1, 1, 1]
        pesos = [1, 2, 3, 4]
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
        restricao_um(prob, a, c, d, dvars)
        restricao_dois(prob, a, c, d, dvars, custos, capacidade_diaria=1)
        aplicar_balanceamento_de_carga(prob, a, c, d, dvars, custos)
        prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))

        assert prob.status == 1
        selecionados = {ia for ia in a if any(dvars[(ia, ic, 0)].varValue == 1 for ic in c)}
        assert selecionados == {2, 3}

    def test_espalha_a_carga_entre_equipes_em_vez_de_concentrar(self):
        # 4 locais fáceis, 2 equipes, capacidade de sobra (orçamento 4 cada)
        # -> sem R4 o solver pode concentrar tudo numa equipe só (o
        # objetivo não se importa); com R4, cada equipe fica com metade.
        a, c, d = range(4), range(2), range(1)
        custos = [1, 1, 1, 1]
        pesos = [1, 1, 1, 1]
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
        restricao_um(prob, a, c, d, dvars)
        restricao_dois(prob, a, c, d, dvars, custos, capacidade_diaria=4)
        aplicar_balanceamento_de_carga(prob, a, c, d, dvars, custos)
        prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))

        assert prob.status == 1
        carga_por_equipe = [
            sum(dvars[(ia, ic, 0)].varValue for ia in a if (ia, ic, 0) in dvars) for ic in c
        ]
        assert carga_por_equipe == [2, 2]


# ── Solução completa (integração com CBC) ────────────────────────────────────

class TestSolucaoPequena:
    """Modelo pequeno e controlado: 1 equipe, 1 dia, para testar orçamento
    de capacidade e preferência por prioridade sem depender do calendário."""

    def _resolver(self, custos, pesos):
        a, c, d = range(len(custos)), range(1), range(1)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
        for rest in monta_lista_restricoes(prob, a, c, d, dvars, custos):
            rest["callable"](*rest["argumentos"])
        prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))
        return prob, dvars, a, c, d

    def test_orcamento_respeitado_so_facil(self):
        # 4 locais fáceis (custo 1), orçamento 3 -> no máximo 3 alocados
        prob, dvars, a, c, d = self._resolver(custos=[1, 1, 1, 1], pesos=[1, 1, 1, 1])
        assert prob.status == 1
        total_alocado = sum(dvars[(ia, 0, 0)].varValue for ia in a)
        assert total_alocado == 3

    def test_prioridade_alta_preferida_quando_falta_capacidade(self):
        # 4 locais fáceis, pesos crescentes -> o de menor peso (índice 0) fica de fora
        prob, dvars, a, c, d = self._resolver(custos=[1, 1, 1, 1], pesos=[1, 2, 3, 4])
        assert prob.status == 1
        assert dvars[(0, 0, 0)].varValue == 0
        for ia in range(1, 4):
            assert dvars[(ia, 0, 0)].varValue == 1

    def test_mistura_de_dificuldades_no_mesmo_dia(self):
        # 1 fácil (1) + 1 médio (1.5) = 2.5 <= 3: cabem os dois; um difícil (3) sozinho já usa tudo
        prob, dvars, a, c, d = self._resolver(custos=[1, 1.5, 3], pesos=[1, 1, 1])
        assert prob.status == 1
        # a melhor combinação para maximizar contagem com pesos iguais é pegar fácil+médio (2 itens) em vez de só o difícil (1 item)
        assert dvars[(0, 0, 0)].varValue == 1
        assert dvars[(1, 0, 0)].varValue == 1
        assert dvars[(2, 0, 0)].varValue == 0


class TestRodarModeloHoroprognosis:
    @pytest.fixture(scope="class")
    def resultado(self):
        locais = _locais([
            ("local_1", "alta", "facil"),
            ("local_2", "media", "media"),
            ("local_3", "baixa", "dificil"),
        ])
        return rodar_modelo_horoprognosis(locais, quantidade_equipes=2, ano=2026, mes=9)

    def test_status_otimo(self, resultado):
        prob, *_ = resultado
        assert prob.status == 1

    def test_r1_cada_local_no_maximo_uma_vez(self, resultado):
        prob, locais, equipes, dias = resultado
        alocacao, _ = gerar_alocacao(prob, locais, equipes, dias)
        contagem = {loc["id"]: 0 for loc in locais}
        for equipe in equipes:
            for dia in dias:
                for local_id in alocacao[equipe][dia]:
                    contagem[local_id] += 1
        assert all(qtd <= 1 for qtd in contagem.values())

    def test_r2_capacidade_diaria_respeitada(self, resultado):
        prob, locais, equipes, dias = resultado
        alocacao, _ = gerar_alocacao(prob, locais, equipes, dias)
        custos_por_id = {loc["id"]: CUSTOS_DIFICULDADE[loc["dificuldade"]] for loc in locais}
        for equipe in equipes:
            for dia in dias:
                custo_dia = sum(custos_por_id[lid] for lid in alocacao[equipe][dia])
                assert custo_dia <= CAPACIDADE_DIARIA

    def test_todos_alocados_quando_ha_capacidade_de_sobra(self, resultado):
        prob, locais, equipes, dias = resultado
        _, nao_alocados = gerar_alocacao(prob, locais, equipes, dias)
        assert nao_alocados == []

    def test_dias_uteis_do_mes_pedido(self, resultado):
        _, _, _, dias = resultado
        for dia_iso in dias:
            assert dia_iso.startswith("2026-09")


def _locais_com_prazo(especificacoes):
    """Constrói uma lista de locais a partir de tuplas (id, prioridade, dificuldade, dataAlvo)."""
    return [
        {"id": lid, "prioridade": p, "dificuldade": dif, "dataAlvo": prazo}
        for lid, p, dif, prazo in especificacoes
    ]


class TestRodarModeloHoroprognosisComPrazos:
    """Modelo de horizonte completo: sem mês fixo, um prazo (dataAlvo) por
    local. Os locais aqui têm prazos em meses diferentes de propósito,
    para provar que o cronograma cobre o horizonte inteiro, não só um mês."""

    @pytest.fixture(scope="class")
    def resultado(self):
        locais = _locais_com_prazo([
            ("local_1", "alta", "facil", "2026-09-14"),
            ("local_2", "media", "media", "2026-10-05"),
            ("local_3", "baixa", "dificil", "2026-11-02"),
        ])
        return rodar_modelo_horoprognosis_com_prazos(locais, quantidade_equipes=2)

    def test_status_otimo(self, resultado):
        prob, *_ = resultado
        assert prob.status == 1

    def test_dias_cobrem_do_prazo_mais_proximo_ao_mais_distante(self, resultado):
        _, _, _, dias = resultado
        assert dias[0] == "2026-09-14"
        assert dias[-1] == "2026-11-02"

    def test_nenhum_local_alocado_depois_do_proprio_prazo(self, resultado):
        prob, locais, equipes, dias = resultado
        alocacao, _ = gerar_alocacao(prob, locais, equipes, dias)
        prazo_por_id = {loc["id"]: loc["dataAlvo"] for loc in locais}
        for equipe in equipes:
            for dia in dias:
                for local_id in alocacao[equipe][dia]:
                    assert dia <= prazo_por_id[local_id]

    def test_todos_alocados_quando_ha_capacidade_de_sobra(self, resultado):
        prob, locais, equipes, dias = resultado
        _, nao_alocados = gerar_alocacao(prob, locais, equipes, dias)
        assert nao_alocados == []

    def test_carga_e_distribuida_entre_as_equipes_configuradas(self):
        # Cenário reportado em produção: 4 regiões (3 delas com prazo no
        # mesmo dia) e 4 equipes configuradas — antes de R4, o solver
        # concentrava tudo em 2 equipes e deixava 2 ociosas, mesmo sem
        # nenhuma restrição de capacidade/prazo forçando isso.
        locais = _locais_com_prazo([
            ("RA-01", "alta", "facil", "2026-10-05"),
            ("RA-02", "alta", "media", "2026-10-05"),
            ("RA-03", "alta", "media", "2026-09-28"),
            ("RA-04", "alta", "dificil", "2026-10-05"),
        ])
        prob, locais, equipes, dias = rodar_modelo_horoprognosis_com_prazos(locais, quantidade_equipes=4)
        assert prob.status == 1

        alocacao, nao_alocados = gerar_alocacao(prob, locais, equipes, dias)
        assert nao_alocados == []

        equipes_usadas = {
            equipe for equipe in equipes for dia in dias if alocacao[equipe][dia]
        }
        assert len(equipes_usadas) == 4

    def test_dois_locais_no_mesmo_prazo_disputam_a_mesma_capacidade(self):
        # Ambos com prazo no mesmo dia único do horizonte (1 equipe, cap 1
        # local fácil/dia) -> só um cabe; o de prioridade maior vence.
        locais = _locais_com_prazo([
            ("local_1", "baixa", "facil", "2026-09-14"),
            ("local_2", "alta", "facil", "2026-09-14"),
        ])
        prob, locais, equipes, dias = rodar_modelo_horoprognosis_com_prazos(
            locais, quantidade_equipes=1, capacidade_diaria=1,
        )
        assert prob.status == 1
        assert dias == ["2026-09-14"]
        _, nao_alocados = gerar_alocacao(prob, locais, equipes, dias)
        assert nao_alocados == ["local_1"]

    def test_local_nao_pode_ser_adiado_para_depois_do_proprio_prazo(self):
        # Os 3 locais têm o mesmo prazo (2026-09-14); com capacidade 3 e
        # custo 3 cada (difícil), só 1 cabe nesse dia. R3 impede que os
        # outros 2 sejam empurrados para um dia depois do próprio prazo —
        # o único dia do horizonte é justamente esse, então ficam de fora
        # em vez de aparecerem num dia inexistente/posterior.
        locais = _locais_com_prazo([
            ("local_1", "alta", "dificil", "2026-09-14"),
            ("local_2", "alta", "dificil", "2026-09-14"),
            ("local_3", "alta", "dificil", "2026-09-14"),
        ])
        prob, locais, equipes, dias = rodar_modelo_horoprognosis_com_prazos(
            locais, quantidade_equipes=1, capacidade_diaria=3,
        )
        assert prob.status == 1
        assert dias == ["2026-09-14"]
        _, nao_alocados = gerar_alocacao(prob, locais, equipes, dias)
        assert len(nao_alocados) == 2


# ── gerar_alocacao ────────────────────────────────────────────────────────────

class TestGerarAlocacao:
    def test_local_nao_alocado_aparece_na_lista(self):
        # 3 locais fáceis, orçamento 2 -> 1 fica de fora
        locais = _locais([
            ("local_1", "alta", "facil"),
            ("local_2", "media", "facil"),
            ("local_3", "baixa", "facil"),
        ])
        a, c, d = range(3), range(1), range(1)
        pesos = [PESOS_PRIORIDADE[loc["prioridade"]] for loc in locais]
        custos = [CUSTOS_DIFICULDADE[loc["dificuldade"]] for loc in locais]
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
        restricao_um(prob, a, c, d, dvars)
        restricao_dois(prob, a, c, d, dvars, custos, capacidade_diaria=2)
        prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))

        alocacao, nao_alocados = gerar_alocacao(prob, locais, ["equipe_1"], ["2026-09-01"])
        assert nao_alocados == ["local_3"]  # menor prioridade, único empate possível
        assert set(alocacao["equipe_1"]["2026-09-01"]) == {"local_1", "local_2"}

    def test_ignora_as_variaveis_auxiliares_de_r4(self):
        # gerar_alocacao só entende variáveis H_(a,c,d) — carga_maxima e
        # carga_minima (de aplicar_balanceamento_de_carga) não podem ser
        # confundidas com uma alocação, mesmo quando seu valor resolvido é
        # exatamente 1 (o que quebrava o parse antes desse teste existir).
        locais = _locais([("local_1", "alta", "facil"), ("local_2", "media", "facil")])
        a, c, d = range(2), range(1), range(1)
        pesos = [PESOS_PRIORIDADE[loc["prioridade"]] for loc in locais]
        custos = [CUSTOS_DIFICULDADE[loc["dificuldade"]] for loc in locais]
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos)
        restricao_um(prob, a, c, d, dvars)
        restricao_dois(prob, a, c, d, dvars, custos, capacidade_diaria=1)
        aplicar_balanceamento_de_carga(prob, a, c, d, dvars, custos)
        prob.solve(plp.getSolver("PULP_CBC_CMD", msg=0))

        alocacao, nao_alocados = gerar_alocacao(prob, locais, ["equipe_1"], ["2026-09-01"])
        assert set(alocacao["equipe_1"]["2026-09-01"]) | set(nao_alocados) == {"local_1", "local_2"}


# ── calcular_alerta_capacidade ────────────────────────────────────────────────

class TestCalcularAlertaCapacidade:
    def test_capacidade_suficiente_retorna_none(self):
        locais = _locais([("local_1", "alta", "facil")])
        alerta = calcular_alerta_capacidade(locais, quantidade_equipes=1, dias=["2026-09-01"])
        assert alerta is None

    def test_capacidade_insuficiente_calcula_deficit(self):
        # 4 locais fáceis (custo 1 cada) = demanda 4; 1 equipe x 1 dia x cap 3 = capacidade 3
        locais = _locais([
            ("local_1", "alta", "facil"), ("local_2", "media", "facil"),
            ("local_3", "baixa", "facil"), ("local_4", "baixa", "facil"),
        ])
        alerta = calcular_alerta_capacidade(locais, quantidade_equipes=1, dias=["2026-09-01"])
        assert alerta is not None
        assert alerta["capacidadeTotalMes"] == 3
        assert alerta["demandaTotal"] == 4
        assert alerta["deficit"] == 1
        assert alerta["equipesDiaAdicionais"] == 1
        assert alerta["equipesExtrasSugeridas"] == 1
        assert "deste mês" in alerta["mensagem"]

    def test_rotulo_periodo_customizado_aparece_na_mensagem(self):
        locais = _locais([("local_1", "alta", "facil"), ("local_2", "media", "facil")])
        alerta = calcular_alerta_capacidade(
            locais, quantidade_equipes=1, dias=[], capacidade_diaria=1, rotulo_periodo="período",
        )
        assert alerta is not None
        assert "deste período" in alerta["mensagem"]

    def test_exemplo_do_documento(self):
        # 4 equipes x 21 dias x 3 = 252 de capacidade; demanda 300 -> déficit 48
        dias = [f"2026-09-{i:02d}" for i in range(1, 22)]  # 21 dias fictícios
        locais = _locais([(f"local_{i}", "alta", "dificil") for i in range(100)])  # 100 x custo 3 = 300
        alerta = calcular_alerta_capacidade(locais, quantidade_equipes=4, dias=dias)
        assert alerta["capacidadeTotalMes"] == 252
        assert alerta["demandaTotal"] == 300
        assert alerta["deficit"] == 48
        assert alerta["equipesDiaAdicionais"] == 16
        assert alerta["equipesExtrasSugeridas"] == 1
