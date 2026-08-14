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
    calcular_alerta_capacidade,
    gerar_alocacao,
    gerar_dias_uteis,
    gerar_equipes,
    gerar_prob_horoprognosis,
    monta_lista_restricoes,
    restricao_dois,
    restricao_um,
    rodar_modelo_horoprognosis,
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

    def test_monta_lista_restricoes_tem_r1_e_r2(self):
        a, c, d = range(2), range(1), range(1)
        prob, dvars = gerar_prob_horoprognosis(a, c, d, pesos=[1, 1])
        restricoes = monta_lista_restricoes(prob, a, c, d, dvars, custos=[1, 1])
        assert len(restricoes) == 2


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
