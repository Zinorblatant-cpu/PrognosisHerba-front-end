"""
Fonte externa de previsões — ingestão da planilha da IA
=========================================================
A IA de crescimento publica as previsões como planilha `.xlsx` numa API
externa (projeto Grama Webcam). Este módulo baixa essa planilha, extrai a
aba de 52 semanas e reescreve `data/previsoes_v3_52_semanas.csv` — o
mesmo arquivo que `previsoes.py` já lia.

Por que reescrever o CSV em vez de servir a planilha direto:

- **O CSV vira cache em disco.** A API externa roda no Render free, que
  hiberna após ~15min e leva ~50s pra acordar. Sem o arquivo local, toda
  tela de Previsões dependeria dessa latência (e cairia junto com a API).
- **Nada mais no backend precisa mudar.** `previsoes.py` e
  `clusterizacao.py` continuam lendo CSV do disco, sem saber que existe
  uma API no meio.

Sem dependência nova: `.xlsx` é um zip de XML, lido aqui com `zipfile` +
`ElementTree`.

Configuração (variáveis de ambiente, ou `backend/.env`):

    GRAMA_API_URL       endpoint da planilha  (default: produção)
    GRAMA_API_KEY       X-API-Key de leitura  — SEM ELA A SINCRONIZAÇÃO
                        FICA DESLIGADA e o backend só usa o CSV local
    GRAMA_SYNC_TTL_S    intervalo mínimo entre buscas (default 900s)
    GRAMA_SYNC_TIMEOUT_S  timeout da chamada HTTP (default 30s)
"""
import csv
import datetime
import io
import logging
import os
import re
import tempfile
import threading
import time
import xml.etree.ElementTree as ET
import zipfile
from urllib.error import URLError
from urllib.request import Request, urlopen

log = logging.getLogger(__name__)

CAMINHO_BASE = os.path.dirname(__file__)
CAMINHO_CSV_DESTINO = os.path.join(CAMINHO_BASE, "data", "previsoes_v3_52_semanas.csv")

URL_PADRAO = "https://api-grama-webcam.onrender.com/previsoes"
ABA_PREVISAO = "previsao_52_semanas_podas"
TTL_PADRAO_S = 900
TIMEOUT_PADRAO_S = 30

# Ordem das colunas do CSV — é contrato com `previsoes.py`, que lê por nome
# mas cujo arquivo versionado tem esta ordem.
COLUNAS_CSV = [
    "data",
    "altura_prevista_cm",
    "nivel_alerta",
    "houve_poda",
    "id_regiao",
    "inclinacao_graus",
    "area_de_risco",
]

# A aba de 52 semanas traz só altura/alerta/poda por região — não traz
# inclinação nem área de risco. A aba `simulacao_todas_regioes` até traz,
# mas hoje com valor constante (6° e "medio" para todas as regiões), o que
# achataria `faixa_dificuldade()` em "facil" para todo mundo e tiraria do
# solver a dimensão de dificuldade. Até a IA passar a mandar o dado real
# variado, a topografia fica aqui — são os mesmos valores do CSV
# originalmente versionado.
TOPOGRAFIA_POR_REGIAO = {
    "RA-01": (4.5, "baixo"),
    "RA-02": (9.2, "medio"),
    "RA-03": (11.8, "medio"),
    "RA-04": (22.3, "alto"),
}
TOPOGRAFIA_PADRAO = (9.2, "medio")

# Serial de data do Excel: dia 1 é 1900-01-01, mas a planilha herda o bug
# histórico de considerar 1900 bissexto — a origem efetiva é 1899-12-30.
ORIGEM_SERIAL_EXCEL = datetime.date(1899, 12, 30)

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_PKG_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"

_lock = threading.Lock()
_ultimo_sync_em = 0.0


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

def _carregar_dotenv(caminho=None):
    """Lê `backend/.env` para dentro de `os.environ` (sem sobrescrever o que
    já veio do ambiente). Evita a dependência de python-dotenv para um
    arquivo de 4 linhas."""
    caminho = caminho or os.path.join(CAMINHO_BASE, ".env")
    if not os.path.exists(caminho):
        return
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, _, valor = linha.partition("=")
            os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def _config():
    _carregar_dotenv()
    return {
        "url": os.environ.get("GRAMA_API_URL", URL_PADRAO),
        "chave": os.environ.get("GRAMA_API_KEY", ""),
        "ttl": float(os.environ.get("GRAMA_SYNC_TTL_S", TTL_PADRAO_S)),
        "timeout": float(os.environ.get("GRAMA_SYNC_TIMEOUT_S", TIMEOUT_PADRAO_S)),
    }


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

# O Render free hiberna após ~15min; a requisição que acorda a instância
# costuma voltar 5xx ou estourar o timeout, e a seguinte funciona. Uma
# tentativa extra transforma esse caso (o mais comum de todos) em sucesso.
TENTATIVAS = 2
ESPERA_ENTRE_TENTATIVAS_S = 3


def baixar_planilha(url, chave, timeout):
    """Baixa a planilha da API externa. Devolve os bytes do .xlsx."""
    req = Request(url, headers={"X-API-Key": chave})
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            with urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (URLError, OSError) as e:
            if tentativa == TENTATIVAS:
                raise
            log.info("Tentativa %d de baixar as previsões falhou (%s) — repetindo.",
                     tentativa, e)
            time.sleep(ESPERA_ENTRE_TENTATIVAS_S)


# ---------------------------------------------------------------------------
# Leitura do .xlsx (zip de XML — sem openpyxl/pandas)
# ---------------------------------------------------------------------------

def _coluna_de(referencia):
    """"B12" -> "B". Cabeçalho e células são casados pela letra da coluna,
    não pela posição: célula vazia some do XML e desalinharia a ordem."""
    return re.match(r"[A-Z]+", referencia or "").group(0) if referencia else ""


def _texto_da_celula(celula, textos_compartilhados):
    tipo = celula.get("t")
    if tipo == "inlineStr":
        return "".join(t.text or "" for t in celula.iter(NS + "t"))
    v = celula.find(NS + "v")
    if v is None or v.text is None:
        return ""
    if tipo == "s":
        indice = int(v.text)
        return textos_compartilhados[indice] if indice < len(textos_compartilhados) else ""
    return v.text


def _caminho_da_aba(zf, nome_aba):
    """Resolve nome da aba -> `xl/worksheets/sheetN.xml` via workbook.xml.rels.
    A ordem das abas no workbook não é a mesma da numeração dos arquivos."""
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    alvo_por_id = {r.get("Id"): r.get("Target") for r in rels.iter(NS_PKG_REL + "Relationship")}

    disponiveis = []
    for aba in workbook.iter(NS + "sheet"):
        disponiveis.append(aba.get("name"))
        if aba.get("name") == nome_aba:
            # O Target vem relativo a xl/ ("worksheets/sheet2.xml") ou
            # absoluto no pacote ("/xl/worksheets/sheet2.xml") — a planilha
            # real usa a segunda forma.
            alvo = alvo_por_id.get(aba.get(NS_REL + "id"), "").lstrip("/")
            return alvo if alvo.startswith("xl/") else "xl/" + alvo

    raise ValueError(f"Aba {nome_aba!r} não existe na planilha. Abas: {disponiveis}")


def ler_aba(conteudo_xlsx, nome_aba=ABA_PREVISAO):
    """Extrai uma aba do .xlsx como list[dict] com as chaves vindas do
    cabeçalho (primeira linha)."""
    with zipfile.ZipFile(io.BytesIO(conteudo_xlsx)) as zf:
        try:
            raiz_sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            textos = ["".join(t.text or "" for t in si.iter(NS + "t")) for si in raiz_sst]
        except KeyError:
            textos = []

        planilha = ET.fromstring(zf.read(_caminho_da_aba(zf, nome_aba)))

    linhas = list(planilha.find(NS + "sheetData") or [])
    if not linhas:
        raise ValueError(f"Aba {nome_aba!r} está vazia.")

    cabecalho = {
        _coluna_de(c.get("r")): _texto_da_celula(c, textos).strip()
        for c in linhas[0]
    }

    registros = []
    for linha in linhas[1:]:
        valores = {_coluna_de(c.get("r")): _texto_da_celula(c, textos) for c in linha}
        registro = {nome: valores.get(col, "") for col, nome in cabecalho.items() if nome}
        if any(v != "" for v in registro.values()):
            registros.append(registro)
    return registros


# ---------------------------------------------------------------------------
# Normalização planilha -> CSV
# ---------------------------------------------------------------------------

def _data_para_iso(valor):
    """A coluna `data` vem como serial numérico do Excel (46251) ou já como
    texto de data. Devolve sempre "YYYY-MM-DD"."""
    texto = str(valor).strip()
    if not texto:
        raise ValueError("Linha sem data.")
    try:
        serial = float(texto)
    except ValueError:
        iso = texto.split("T")[0].split(" ")[0]
        datetime.date.fromisoformat(iso)  # valida
        return iso
    return (ORIGEM_SERIAL_EXCEL + datetime.timedelta(days=int(serial))).isoformat()


def _bool_para_texto(valor):
    """`houve_poda` vem como 0/1 na planilha; o CSV usa True/False."""
    return "True" if str(valor).strip().lower() in {"1", "true", "sim", "1.0"} else "False"


def normalizar(registros):
    """Converte as linhas cruas da aba no formato exato do CSV, injetando a
    topografia por região. Levanta ValueError se a planilha não tiver as
    colunas esperadas — melhor falhar e manter o CSV antigo do que gravar
    um arquivo quebrado."""
    if not registros:
        raise ValueError("Planilha sem linhas de previsão.")

    obrigatorias = {"data", "altura_prevista_cm", "nivel_alerta", "id_regiao"}
    faltando = obrigatorias - set(registros[0])
    if faltando:
        raise ValueError(f"Planilha sem as colunas {sorted(faltando)}.")

    desconhecidas = set()
    linhas = []
    for registro in registros:
        id_regiao = registro["id_regiao"].strip()
        if not id_regiao:
            continue
        if id_regiao not in TOPOGRAFIA_POR_REGIAO:
            desconhecidas.add(id_regiao)
        inclinacao, area_risco = TOPOGRAFIA_POR_REGIAO.get(id_regiao, TOPOGRAFIA_PADRAO)
        linhas.append({
            "data": _data_para_iso(registro["data"]),
            # `str(round(...))` em vez de f"{:.2f}": reproduz o formato que a
            # IA já usa (8.6, não 8.60), então um sync sem novidade deixa o
            # CSV byte a byte igual e o diff do git só aparece quando a
            # previsão realmente mudou.
            "altura_prevista_cm": str(round(float(registro["altura_prevista_cm"]), 2)),
            "nivel_alerta": registro["nivel_alerta"].strip(),
            "houve_poda": _bool_para_texto(registro.get("houve_poda", "")),
            "id_regiao": id_regiao,
            "inclinacao_graus": inclinacao,
            "area_de_risco": area_risco,
        })

    if desconhecidas:
        log.warning(
            "Regiões sem topografia mapeada em TOPOGRAFIA_POR_REGIAO: %s — usando %s.",
            sorted(desconhecidas), TOPOGRAFIA_PADRAO,
        )
    if not linhas:
        raise ValueError("Planilha sem nenhuma linha com id_regiao.")
    return linhas


def escrever_csv(linhas, caminho=None):
    """Grava o CSV de forma atômica: escreve num temporário no mesmo
    diretório e só então troca. Um download interrompido no meio nunca
    deixa o CSV pela metade."""
    caminho = caminho or CAMINHO_CSV_DESTINO
    diretorio = os.path.dirname(caminho)
    os.makedirs(diretorio, exist_ok=True)

    fd, temporario = tempfile.mkstemp(dir=diretorio, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            escritor = csv.DictWriter(f, fieldnames=COLUNAS_CSV)
            escritor.writeheader()
            escritor.writerows(linhas)
        os.replace(temporario, caminho)
    except BaseException:
        if os.path.exists(temporario):
            os.remove(temporario)
        raise
    return caminho


# ---------------------------------------------------------------------------
# Orquestração
# ---------------------------------------------------------------------------

def sincronizar(caminho=None, aba=ABA_PREVISAO):
    """Baixa, converte e substitui o CSV. Levanta exceção em qualquer falha
    — quem chama decide se isso é fatal. Devolve o número de linhas."""
    cfg = _config()
    if not cfg["chave"]:
        raise RuntimeError("GRAMA_API_KEY não configurada.")

    conteudo = baixar_planilha(cfg["url"], cfg["chave"], cfg["timeout"])
    linhas = normalizar(ler_aba(conteudo, aba))
    escrever_csv(linhas, caminho)
    return len(linhas)


def garantir_previsoes_atuais(forcar=False):
    """Chamado pelos endpoints antes de ler o CSV. Nunca levanta exceção: se
    a API externa estiver fora, lenta ou sem chave configurada, o backend
    segue servindo o último CSV bom.

    Respeita `GRAMA_SYNC_TTL_S` para não bater na API a cada request — o
    conteúdo muda no ritmo de uma ingestão em batch, não a cada page view.

    Devolve True se o CSV foi atualizado agora.
    """
    global _ultimo_sync_em

    cfg = _config()
    if not cfg["chave"]:
        return False

    with _lock:
        agora = time.monotonic()
        recente = (agora - _ultimo_sync_em) < cfg["ttl"]
        if not forcar and recente and os.path.exists(CAMINHO_CSV_DESTINO):
            return False

        try:
            total = sincronizar()
        except (URLError, OSError, ValueError, KeyError, RuntimeError, zipfile.BadZipFile) as e:
            # Falhar aqui é esperado (Render free hibernando, rede caindo).
            # O CSV anterior continua no disco e as telas seguem de pé.
            log.warning("Sincronização de previsões falhou (%s: %s) — usando o CSV local.",
                        type(e).__name__, e)
            _ultimo_sync_em = agora  # não retenta a cada request
            return False

        _ultimo_sync_em = agora
        log.info("Previsões sincronizadas da API externa: %d linhas.", total)
        return True
