"""
Persistência — alocação publicada para o site dos podadores
=================================================================
O resto do backend é sem persistência e sem autenticação (cada chamada a
/gerar-alocacao é autocontida — ver server.py). O site dos podadores
precisa enxergar a última alocação gerada pela Otimização mesmo depois
de fechar a aba, e marcar locais como concluídos — por isso este módulo
guarda dois pedaços de estado em SQLite (arquivo único, sem servidor de
banco à parte; volume baixo, não há necessidade de concorrência pesada):

  alocacao_publicada  — a alocação mais recente publicada pela Otimização
                         (uma linha só; publicar substitui a anterior).
  conclusoes          — quais locais (equipe, dia, local) já foram
                         marcados como concluídos pelos podadores.

publicar_alocacao()    -> substitui a alocação publicada atual e limpa as
                           conclusões antigas (pertencem a uma alocação
                           anterior, não fazem mais sentido).
obter_alocacao_atual() -> alocação publicada + conclusões mescladas, ou
                           None se nada foi publicado ainda.
marcar_conclusao()     -> marca/desmarca um local como concluído.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone

CAMINHO_DB_PADRAO = os.path.join(os.path.dirname(__file__), "data", "podadores.db")


def _conectar(caminho_db):
    os.makedirs(os.path.dirname(caminho_db), exist_ok=True)
    conn = sqlite3.connect(caminho_db)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alocacao_publicada (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            publicado_em TEXT NOT NULL,
            mes_referencia_ano INTEGER NOT NULL,
            mes_referencia_mes INTEGER NOT NULL,
            alocacoes_json TEXT NOT NULL,
            nao_alocados_json TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS conclusoes (
            equipe_id TEXT NOT NULL,
            dia TEXT NOT NULL,
            local_id TEXT NOT NULL,
            concluido_em TEXT NOT NULL,
            PRIMARY KEY (equipe_id, dia, local_id)
        )
        """
    )
    conn.commit()
    return conn


def publicar_alocacao(mes_referencia, alocacoes, nao_alocados, caminho_db=None):
    """Substitui a alocação publicada e limpa as conclusões antigas."""
    conn = _conectar(caminho_db or CAMINHO_DB_PADRAO)
    try:
        conn.execute("DELETE FROM conclusoes")
        conn.execute(
            """
            INSERT INTO alocacao_publicada
                (id, publicado_em, mes_referencia_ano, mes_referencia_mes, alocacoes_json, nao_alocados_json)
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                publicado_em=excluded.publicado_em,
                mes_referencia_ano=excluded.mes_referencia_ano,
                mes_referencia_mes=excluded.mes_referencia_mes,
                alocacoes_json=excluded.alocacoes_json,
                nao_alocados_json=excluded.nao_alocados_json
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                mes_referencia["ano"],
                mes_referencia["mes"],
                json.dumps(alocacoes),
                json.dumps(nao_alocados),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def obter_alocacao_atual(caminho_db=None):
    """Alocação publicada + conclusões mescladas, ou None se nada foi publicado."""
    conn = _conectar(caminho_db or CAMINHO_DB_PADRAO)
    try:
        linha = conn.execute(
            """
            SELECT publicado_em, mes_referencia_ano, mes_referencia_mes, alocacoes_json, nao_alocados_json
            FROM alocacao_publicada WHERE id = 1
            """
        ).fetchone()
        if linha is None:
            return None

        publicado_em, ano, mes, alocacoes_json, nao_alocados_json = linha
        alocacoes = json.loads(alocacoes_json)
        nao_alocados = json.loads(nao_alocados_json)

        concluidos = {
            (equipe_id, dia, local_id)
            for equipe_id, dia, local_id in conn.execute("SELECT equipe_id, dia, local_id FROM conclusoes")
        }

        for aloc in alocacoes:
            for local in aloc["locais"]:
                local["concluido"] = (aloc["equipeId"], aloc["dia"], local["localId"]) in concluidos

        return {
            "publicadoEm": publicado_em,
            "mesReferencia": {"ano": ano, "mes": mes},
            "alocacoes": alocacoes,
            "naoAlocados": nao_alocados,
        }
    finally:
        conn.close()


def marcar_conclusao(equipe_id, dia, local_id, concluido, caminho_db=None):
    """Marca (concluido=True) ou desmarca (concluido=False) um local."""
    conn = _conectar(caminho_db or CAMINHO_DB_PADRAO)
    try:
        if concluido:
            conn.execute(
                """
                INSERT INTO conclusoes (equipe_id, dia, local_id, concluido_em)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(equipe_id, dia, local_id) DO UPDATE SET concluido_em=excluded.concluido_em
                """,
                (equipe_id, dia, local_id, datetime.now(timezone.utc).isoformat()),
            )
        else:
            conn.execute(
                "DELETE FROM conclusoes WHERE equipe_id = ? AND dia = ? AND local_id = ?",
                (equipe_id, dia, local_id),
            )
        conn.commit()
    finally:
        conn.close()
