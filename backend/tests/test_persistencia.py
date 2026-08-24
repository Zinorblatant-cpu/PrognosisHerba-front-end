"""
Testes para persistencia.py (alocação publicada + conclusões dos podadores).

Cada teste usa um arquivo SQLite temporário (tmp_path) para não sujar nem
depender do banco real.
"""
import os

import pytest

import persistencia


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "podadores.db")


PERIODO = {"inicio": "2026-09-14", "fim": "2026-09-14"}

ALOCACOES = [
    {
        "equipeId": "equipe_1",
        "dia": "2026-09-14",
        "locais": [
            {"localId": "local_1", "prioridade": "alta", "dificuldade": "facil"},
            {"localId": "local_2", "prioridade": "media", "dificuldade": "media"},
        ],
    },
    {
        "equipeId": "equipe_2",
        "dia": "2026-09-14",
        "locais": [{"localId": "local_3", "prioridade": "baixa", "dificuldade": "dificil"}],
    },
]

NAO_ALOCADOS = [{"localId": "local_4", "prioridade": "baixa", "dificuldade": "facil"}]


class TestObterAlocacaoAtualSemPublicacao:
    def test_retorna_none_quando_nada_foi_publicado(self, db_path):
        assert persistencia.obter_alocacao_atual(caminho_db=db_path) is None


class TestPublicarAlocacao:
    def test_cria_o_arquivo_do_banco(self, db_path):
        assert not os.path.exists(db_path)
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        assert os.path.exists(db_path)

    def test_alocacao_atual_reflete_o_que_foi_publicado(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)

        assert atual["periodo"] == PERIODO
        assert atual["naoAlocados"] == NAO_ALOCADOS
        assert len(atual["alocacoes"]) == 2
        assert "publicadoEm" in atual and atual["publicadoEm"]

    def test_locais_comecam_nao_concluidos(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)

        for aloc in atual["alocacoes"]:
            for local in aloc["locais"]:
                assert local["concluido"] is False

    def test_publicar_de_novo_substitui_a_alocacao_anterior(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)

        nova_alocacao = [
            {
                "equipeId": "equipe_1",
                "dia": "2026-10-01",
                "locais": [{"localId": "local_9", "prioridade": "alta", "dificuldade": "facil"}],
            }
        ]
        novo_periodo = {"inicio": "2026-10-01", "fim": "2026-10-01"}
        persistencia.publicar_alocacao(novo_periodo, nova_alocacao, [], caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        assert atual["periodo"] == novo_periodo
        assert len(atual["alocacoes"]) == 1
        assert atual["alocacoes"][0]["locais"][0]["localId"] == "local_9"

    def test_publicar_de_novo_limpa_conclusoes_antigas(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)

        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_1 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is False


class TestMarcarConclusao:
    def test_marca_um_local_como_concluido(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_1 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is True

    def test_nao_afeta_outros_locais(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_2 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_2"
        )
        assert local_2["concluido"] is False

    def test_desmarcar_um_local_ja_concluido(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", False, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_1 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is False

    def test_marcar_o_mesmo_local_duas_vezes_nao_gera_erro(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_1", "2026-09-14", "local_1", True, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_1 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_1"
        )
        assert local_1["concluido"] is True

    def test_desmarcar_local_nunca_marcado_nao_gera_erro(self, db_path):
        persistencia.publicar_alocacao(PERIODO, ALOCACOES, NAO_ALOCADOS, caminho_db=db_path)
        persistencia.marcar_conclusao("equipe_2", "2026-09-14", "local_3", False, caminho_db=db_path)

        atual = persistencia.obter_alocacao_atual(caminho_db=db_path)
        local_3 = next(
            local
            for aloc in atual["alocacoes"]
            for local in aloc["locais"]
            if local["localId"] == "local_3"
        )
        assert local_3["concluido"] is False
