"""
Testes da ingestão da planilha da IA (fonte_previsoes.py).

Nenhum teste bate na API externa: a planilha .xlsx é montada aqui, célula
a célula, e o download é substituído por monkeypatch. O que se testa é
justamente o que quebra em produção — serial de data do Excel, célula
vazia omitida do XML, aba escolhida pelo nome, e a garantia de que um
download ruim nunca substitui um CSV bom.

Rodar: pytest tests/test_fonte_previsoes.py -v
"""
import csv
import io
import os
import zipfile

import pytest

import fonte_previsoes as fp


# ── planilha sintética ───────────────────────────────────────────────────────

def _montar_xlsx(abas, target_absoluto=False):
    """Monta um .xlsx mínimo (mas válido) a partir de {nome_aba: [linhas]}.

    As células são escritas como `inlineStr` para texto e valor cru para
    número — exatamente as duas formas que a planilha real usa.
    """
    def celula(ref, valor):
        if valor is None:
            return ""
        if isinstance(valor, (int, float)):
            return f'<c r="{ref}"><v>{valor}</v></c>'
        return f'<c r="{ref}" t="inlineStr"><is><t>{valor}</t></is></c>'

    def planilha(linhas):
        xml = []
        for i, linha in enumerate(linhas, start=1):
            celulas = "".join(
                celula(f"{chr(65 + j)}{i}", v) for j, v in enumerate(linha) if v is not None
            )
            xml.append(f'<row r="{i}">{celulas}</row>')
        return (
            '<?xml version="1.0"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData>{"".join(xml)}</sheetData></worksheet>'
        )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        entradas = []
        rels = []
        for i, (nome, linhas) in enumerate(abas.items(), start=1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", planilha(linhas))
            entradas.append(f'<sheet name="{nome}" sheetId="{i}" r:id="rId{i}"/>')
            alvo = f"/xl/worksheets/sheet{i}.xml" if target_absoluto else f"worksheets/sheet{i}.xml"
            rels.append(
                f'<Relationship Id="rId{i}" Target="{alvo}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/'
                'relationships/worksheet"/>'
            )
        zf.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets>{"".join(entradas)}</sheets></workbook>',
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
            f'relationships">{"".join(rels)}</Relationships>',
        )
    return buffer.getvalue()


CABECALHO = ["data", "altura_prevista_cm", "nivel_alerta", "houve_poda", "id_regiao"]

PLANILHA_OK = {
    "avaliacao_holdout": [["regiao", "mae"], ["RA-01", 0.18]],
    "previsao_52_semanas_podas": [
        CABECALHO,
        [46251, 4.29, "baixo", 0, "RA-01"],
        [46258, 9.55, "alto", 1, "RA-01"],
        [46251, 6.10, "medio", 0, "RA-04"],
    ],
}


# ── leitura da aba ───────────────────────────────────────────────────────────

class TestLerAba:
    def test_le_a_aba_pelo_nome_e_nao_pela_ordem(self):
        # a aba alvo é a segunda do workbook — pegar sheet1.xml traria holdout
        registros = fp.ler_aba(_montar_xlsx(PLANILHA_OK))
        assert len(registros) == 3
        assert registros[0]["id_regiao"] == "RA-01"
        assert registros[0]["altura_prevista_cm"] == "4.29"

    def test_le_aba_com_target_absoluto_no_pacote(self):
        """A planilha real referencia as abas como "/xl/worksheets/sheetN.xml".
        Tratar isso como caminho relativo gerava "xl/xl/worksheets/..."."""
        registros = fp.ler_aba(_montar_xlsx(PLANILHA_OK, target_absoluto=True))
        assert len(registros) == 3
        assert registros[0]["id_regiao"] == "RA-01"

    def test_aba_inexistente_levanta_com_a_lista_de_abas(self):
        with pytest.raises(ValueError, match="previsao_99_semanas"):
            fp.ler_aba(_montar_xlsx(PLANILHA_OK), "previsao_99_semanas")

    def test_celula_vazia_omitida_do_xml_nao_desloca_colunas(self):
        # `nivel_alerta` ausente na 1a linha: o XML pula a célula C.
        # Casando por letra de coluna, `houve_poda` continua em D.
        xlsx = _montar_xlsx({
            "previsao_52_semanas_podas": [
                CABECALHO,
                [46251, 4.29, None, 1, "RA-01"],
            ],
        })
        registro = fp.ler_aba(xlsx)[0]
        assert registro["nivel_alerta"] == ""
        assert registro["houve_poda"] == "1"
        assert registro["id_regiao"] == "RA-01"


# ── normalização ─────────────────────────────────────────────────────────────

class TestNormalizar:
    def test_converte_serial_do_excel_para_iso(self):
        linhas = fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK)))
        assert linhas[0]["data"] == "2026-08-17"
        assert linhas[1]["data"] == "2026-08-24"

    def test_aceita_data_ja_em_texto(self):
        xlsx = _montar_xlsx({
            "previsao_52_semanas_podas": [CABECALHO, ["2026-08-17", 4.29, "baixo", 0, "RA-01"]],
        })
        assert fp.normalizar(fp.ler_aba(xlsx))[0]["data"] == "2026-08-17"

    def test_houve_poda_vira_texto_do_csv(self):
        linhas = fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK)))
        assert [l["houve_poda"] for l in linhas] == ["False", "True", "False"]

    def test_injeta_topografia_local_por_regiao(self):
        linhas = fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK)))
        assert (linhas[0]["inclinacao_graus"], linhas[0]["area_de_risco"]) == (4.5, "baixo")
        assert (linhas[2]["inclinacao_graus"], linhas[2]["area_de_risco"]) == (22.3, "alto")

    def test_regiao_desconhecida_usa_o_padrao_sem_quebrar(self, caplog):
        xlsx = _montar_xlsx({
            "previsao_52_semanas_podas": [CABECALHO, [46251, 4.29, "baixo", 0, "RA-99"]],
        })
        linha = fp.normalizar(fp.ler_aba(xlsx))[0]
        assert (linha["inclinacao_graus"], linha["area_de_risco"]) == fp.TOPOGRAFIA_PADRAO
        assert "RA-99" in caplog.text

    def test_planilha_sem_coluna_obrigatoria_levanta(self):
        xlsx = _montar_xlsx({
            "previsao_52_semanas_podas": [["data", "altura_prevista_cm"], [46251, 4.29]],
        })
        with pytest.raises(ValueError, match="id_regiao"):
            fp.normalizar(fp.ler_aba(xlsx))

    def test_planilha_so_com_cabecalho_levanta(self):
        xlsx = _montar_xlsx({"previsao_52_semanas_podas": [CABECALHO]})
        with pytest.raises(ValueError):
            fp.normalizar(fp.ler_aba(xlsx))


# ── escrita do CSV ───────────────────────────────────────────────────────────

class TestEscreverCsv:
    def test_gera_csv_no_formato_que_previsoes_py_le(self, tmp_path):
        destino = tmp_path / "previsoes.csv"
        linhas = fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK)))
        fp.escrever_csv(linhas, str(destino))

        lidas = list(csv.DictReader(destino.open(encoding="utf-8")))
        assert list(lidas[0]) == fp.COLUNAS_CSV
        assert lidas[0]["data"] == "2026-08-17"
        assert lidas[0]["altura_prevista_cm"] == "4.29"

    def test_csv_gerado_alimenta_carregar_previsoes(self, tmp_path):
        """O teste que importa: o arquivo produzido aqui tem que ser
        consumível pelo módulo que já existia, sem adaptação."""
        from previsoes import carregar_previsoes, derivar_locais_de_poda

        destino = tmp_path / "previsoes.csv"
        fp.escrever_csv(fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK))), str(destino))

        regioes = carregar_previsoes(str(destino))
        assert [r["idRegiao"] for r in regioes] == ["RA-01", "RA-04"]
        assert regioes[0]["inclinacaoGraus"] == 4.5

        derivado = derivar_locais_de_poda(regioes, limiar=9.0)
        assert derivado["locais"][0]["id"] == "RA-01"
        assert derivado["locais"][0]["dataAlvo"] == "2026-08-24"
        assert derivado["locais"][0]["dificuldade"] == "facil"
        assert derivado["semAlertaNoHorizonte"] == ["RA-04"]

    def test_nao_deixa_arquivo_temporario_para_tras(self, tmp_path):
        destino = tmp_path / "previsoes.csv"
        fp.escrever_csv(fp.normalizar(fp.ler_aba(_montar_xlsx(PLANILHA_OK))), str(destino))
        assert [p.name for p in tmp_path.iterdir()] == ["previsoes.csv"]


# ── orquestração ─────────────────────────────────────────────────────────────

@pytest.fixture
def _sync_configurado(monkeypatch, tmp_path):
    """Aponta a sincronização para um CSV descartável e com a chave setada."""
    monkeypatch.setenv("GRAMA_API_KEY", "chave-de-teste")
    monkeypatch.setenv("GRAMA_SYNC_TTL_S", "0")
    destino = tmp_path / "previsoes.csv"
    monkeypatch.setattr(fp, "CAMINHO_CSV_DESTINO", str(destino))
    monkeypatch.setattr(fp, "_ultimo_sync_em", 0.0)
    return destino


class TestSincronizar:
    def test_substitui_o_csv_com_o_conteudo_baixado(self, monkeypatch, _sync_configurado):
        monkeypatch.setattr(fp, "baixar_planilha", lambda *a, **k: _montar_xlsx(PLANILHA_OK))
        assert fp.sincronizar(str(_sync_configurado)) == 3
        assert "RA-01" in _sync_configurado.read_text(encoding="utf-8")

    def test_sem_chave_configurada_levanta(self, monkeypatch):
        monkeypatch.setenv("GRAMA_API_KEY", "")
        with pytest.raises(RuntimeError, match="GRAMA_API_KEY"):
            fp.sincronizar()


class TestGarantirPrevisoesAtuais:
    def test_sem_chave_nao_sincroniza(self, monkeypatch):
        monkeypatch.setenv("GRAMA_API_KEY", "")
        chamou = []
        monkeypatch.setattr(fp, "baixar_planilha", lambda *a, **k: chamou.append(1))
        assert fp.garantir_previsoes_atuais() is False
        assert chamou == []

    def test_api_fora_do_ar_preserva_o_csv_anterior(self, monkeypatch, _sync_configurado):
        _sync_configurado.write_text("csv,anterior\n", encoding="utf-8")

        def _explode(*a, **k):
            raise OSError("connection refused")

        monkeypatch.setattr(fp, "baixar_planilha", _explode)
        assert fp.garantir_previsoes_atuais() is False
        assert _sync_configurado.read_text(encoding="utf-8") == "csv,anterior\n"

    def test_planilha_corrompida_preserva_o_csv_anterior(self, monkeypatch, _sync_configurado):
        _sync_configurado.write_text("csv,anterior\n", encoding="utf-8")
        monkeypatch.setattr(fp, "baixar_planilha", lambda *a, **k: b"nao sou um zip")
        assert fp.garantir_previsoes_atuais() is False
        assert _sync_configurado.read_text(encoding="utf-8") == "csv,anterior\n"

    def test_planilha_sem_a_aba_esperada_preserva_o_csv_anterior(self, monkeypatch, _sync_configurado):
        _sync_configurado.write_text("csv,anterior\n", encoding="utf-8")
        outra = _montar_xlsx({"outra_aba": [["a"], ["b"]]})
        monkeypatch.setattr(fp, "baixar_planilha", lambda *a, **k: outra)
        assert fp.garantir_previsoes_atuais() is False
        assert _sync_configurado.read_text(encoding="utf-8") == "csv,anterior\n"

    def test_ttl_evita_bater_na_api_a_cada_chamada(self, monkeypatch, _sync_configurado):
        monkeypatch.setenv("GRAMA_SYNC_TTL_S", "3600")
        chamadas = []

        def _baixar(*a, **k):
            chamadas.append(1)
            return _montar_xlsx(PLANILHA_OK)

        monkeypatch.setattr(fp, "baixar_planilha", _baixar)
        assert fp.garantir_previsoes_atuais() is True
        assert fp.garantir_previsoes_atuais() is False
        assert fp.garantir_previsoes_atuais() is False
        assert len(chamadas) == 1

    def test_forcar_ignora_o_ttl(self, monkeypatch, _sync_configurado):
        monkeypatch.setenv("GRAMA_SYNC_TTL_S", "3600")
        chamadas = []

        def _baixar(*a, **k):
            chamadas.append(1)
            return _montar_xlsx(PLANILHA_OK)

        monkeypatch.setattr(fp, "baixar_planilha", _baixar)
        fp.garantir_previsoes_atuais()
        fp.garantir_previsoes_atuais(forcar=True)
        assert len(chamadas) == 2

    def test_falha_tambem_respeita_o_ttl(self, monkeypatch, _sync_configurado):
        """API fora do ar não pode virar uma tentativa por request."""
        monkeypatch.setenv("GRAMA_SYNC_TTL_S", "3600")
        _sync_configurado.write_text("csv,anterior\n", encoding="utf-8")
        chamadas = []

        def _explode(*a, **k):
            chamadas.append(1)
            raise OSError("timeout")

        monkeypatch.setattr(fp, "baixar_planilha", _explode)
        fp.garantir_previsoes_atuais()
        fp.garantir_previsoes_atuais()
        assert len(chamadas) == 1


class _RespostaFake:
    """`baixar_planilha` usa `with urlopen(...) as resp`, então o dublê
    precisa ser context manager, não só devolver bytes."""

    def __init__(self, conteudo):
        self._conteudo = conteudo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self._conteudo


class TestRetry:
    def test_repete_uma_vez_quando_a_primeira_falha(self, monkeypatch):
        """Cold start do Render free: a 1a chamada acorda a instância e
        falha, a 2a entrega."""
        monkeypatch.setattr(fp, "ESPERA_ENTRE_TENTATIVAS_S", 0)
        tentativas = []

        def _instavel(req, timeout):
            tentativas.append(1)
            if len(tentativas) == 1:
                raise OSError("cold start")
            return _RespostaFake(b"conteudo")

        monkeypatch.setattr(fp, "urlopen", _instavel)
        assert fp.baixar_planilha("https://x", "k", 1) == b"conteudo"
        assert len(tentativas) == 2

    def test_desiste_depois_do_limite(self, monkeypatch):
        monkeypatch.setattr(fp, "ESPERA_ENTRE_TENTATIVAS_S", 0)
        tentativas = []

        def _sempre_falha(req, timeout):
            tentativas.append(1)
            raise OSError("fora do ar")

        monkeypatch.setattr(fp, "urlopen", _sempre_falha)
        with pytest.raises(OSError):
            fp.baixar_planilha("https://x", "k", 1)
        assert len(tentativas) == fp.TENTATIVAS


class TestDotenv:
    def test_env_do_processo_tem_precedencia_sobre_o_arquivo(self, monkeypatch, tmp_path):
        arquivo = tmp_path / ".env"
        arquivo.write_text('GRAMA_API_KEY="do-arquivo"\n', encoding="utf-8")
        monkeypatch.setenv("GRAMA_API_KEY", "do-ambiente")
        fp._carregar_dotenv(str(arquivo))
        assert os.environ["GRAMA_API_KEY"] == "do-ambiente"

    def test_le_valor_entre_aspas_e_ignora_comentario(self, monkeypatch, tmp_path):
        arquivo = tmp_path / ".env"
        arquivo.write_text('# comentario\nGRAMA_API_URL="https://exemplo/x"\n\n', encoding="utf-8")
        monkeypatch.delenv("GRAMA_API_URL", raising=False)
        fp._carregar_dotenv(str(arquivo))
        assert os.environ["GRAMA_API_URL"] == "https://exemplo/x"
