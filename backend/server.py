"""
Servidor FastAPI — Horoprognosis (alocação de equipes de poda)
=================================================================
Dois jeitos de gerar uma alocação, resolvendo o modelo PuLP/CBC de
horoprognosis.py (ver MODELO_MATEMATICO.md para a formulação completa):

POST /gerar-alocacao            → lote de locais informado manualmente,
                                   preso a um mês fixo (ano/mês no payload).
POST /previsoes/gerar-alocacao  → locais derivados das previsões da IA;
                                   gera o cronograma completo cobrindo todo
                                   o horizonte de previsão de uma vez (sem
                                   mês fixo; o número de semanas vem do CSV
                                   carregado), cada local até o seu prazo.
GET  /health                     → liveness check.
GET  /parametros                 → constantes de calibração do backend
                                   (limiar de poda, capacidade diária), para
                                   as telas não cravarem os mesmos números.
GET  /clusterizacao              → agrupa as regiões por rota, altura atual e
                                   tendência de crescimento (k-means). Camada
                                   de análise, separada do solver — ver
                                   clusterizacao.py.
POST /grama/analisar             → recebe uma foto avulsa de grama (upload) e
                                   estima a altura por segmentação HSV — ver
                                   analise_grama.py. Sem calibração de câmera,
                                   a altura sai em % da imagem, não em cm.

Sem autenticação: qualquer chamada aos dois endpoints acima é
autocontida. A única persistência do backend é a alocação publicada para
o site dos podadores (ver persistencia.py e os endpoints /alocacao/*).

Desenvolvimento:
    uvicorn server:app --port 8002 --reload
"""
import base64
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from horoprognosis import (
    CAPACIDADE_DIARIA,
    calcular_alerta_capacidade,
    gerar_alocacao,
    rodar_modelo_horoprognosis,
    rodar_modelo_horoprognosis_com_prazos,
)
from analise_grama import FAIXA_BAIXA_PCT, FAIXA_MEDIA_PCT, analisar_imagem
from clusterizacao import clusterizar_do_csv
from persistencia import marcar_conclusao, obter_alocacao_atual, publicar_alocacao
from fonte_previsoes import garantir_previsoes_atuais
from previsoes import LIMIAR_PODA_CM, carregar_previsoes, derivar_locais_de_poda

MAX_UPLOAD_IMAGEM_BYTES = 10 * 1024 * 1024  # 10MB

app = FastAPI(title="Horoprognosis API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Modelos Pydantic ─────────────────────────────────────────────────────────

class LocalPoda(BaseModel):
    id: str
    prioridade: Literal["baixa", "media", "alta"]
    dificuldade: Literal["facil", "media", "dificil"]


class AlocacaoRequest(BaseModel):
    locais: list[LocalPoda]
    quantidadeEquipes: int = Field(ge=1)
    ano: int = Field(ge=2000, le=2100)
    mes: int = Field(ge=1, le=12)
    capacidadeDiaria: float = Field(default=CAPACIDADE_DIARIA, gt=0)


class LocalAlocado(BaseModel):
    localId: str
    prioridade: str
    dificuldade: str


class AlocacaoDia(BaseModel):
    equipeId: str
    dia: str
    locais: list[LocalAlocado]


class AlertaCapacidade(BaseModel):
    capacidadeTotalMes: float
    demandaTotal: float
    deficit: float
    equipesDiaAdicionais: int
    equipesExtrasSugeridas: int
    mensagem: str


class AlocacaoResponse(BaseModel):
    alocacoes: list[AlocacaoDia]
    naoAlocados: list[LocalAlocado]
    alerta: AlertaCapacidade | None = None


class RegiaoClusterizada(BaseModel):
    idRegiao: str
    rota: str
    rotaSimulada: bool
    alturaAtualCm: float
    tendenciaCmPorSemana: float
    semanasDesdeUltimaPoda: int
    clusterId: int


class Cluster(BaseModel):
    clusterId: int
    rotulo: str
    regioes: list[str]
    rotas: list[str]
    alturaMediaCm: float
    tendenciaMediaCmPorSemana: float


class ClusterizacaoResponse(BaseModel):
    avisoRota: str
    clusters: list[Cluster]
    regioes: list[RegiaoClusterizada]


class Parametros(BaseModel):
    limiarPodaCm: float
    capacidadeDiaria: float


class AnaliseGramaColuna(BaseModel):
    fracaoX: float
    alturaPct: float | None
    nivel: int
    categoria: str


class AnaliseGramaResponse(BaseModel):
    nivel: int
    categoria: str
    alturaMedianaPct: float | None
    margemErroPct: float | None
    coberturaVerdePct: float
    porColuna: list[AnaliseGramaColuna]
    larguraPx: int
    alturaPx: int
    imagemAnotadaBase64: str


class SemanaPrevisao(BaseModel):
    data: str
    alturaPrevistaCm: float
    nivelAlerta: str


class PrevisaoRegiao(BaseModel):
    idRegiao: str
    inclinacaoGraus: float
    areaDeRisco: str
    semanas: list[SemanaPrevisao]


class GerarAlocacaoDePrevisoesRequest(BaseModel):
    quantidadeEquipes: int = Field(ge=1)
    capacidadeDiaria: float = Field(default=CAPACIDADE_DIARIA, gt=0)
    limiarPodaCm: float = Field(default=LIMIAR_PODA_CM, gt=0)


class LocalDerivado(BaseModel):
    id: str
    prioridade: str
    dificuldade: str
    dataAlvo: str
    alturaPrevistaCm: float


class PeriodoReferencia(BaseModel):
    inicio: str
    fim: str


class GerarAlocacaoDePrevisoesResponse(BaseModel):
    periodo: PeriodoReferencia
    locaisDerivados: list[LocalDerivado]
    alocacoes: list[AlocacaoDia]
    naoAlocados: list[LocalAlocado]
    alerta: AlertaCapacidade | None = None
    semAlertaNoHorizonte: list[str]


# ── Alocação publicada (site dos podadores) ────────────────────────────────────

class PublicarAlocacaoRequest(BaseModel):
    periodo: PeriodoReferencia
    alocacoes: list[AlocacaoDia]
    naoAlocados: list[LocalAlocado] = []


class LocalAlocadoComStatus(BaseModel):
    localId: str
    prioridade: str
    dificuldade: str
    concluido: bool


class AlocacaoDiaComStatus(BaseModel):
    equipeId: str
    dia: str
    locais: list[LocalAlocadoComStatus]


class AlocacaoPublicadaResponse(BaseModel):
    publicadoEm: str
    periodo: PeriodoReferencia
    alocacoes: list[AlocacaoDiaComStatus]
    naoAlocados: list[LocalAlocado]


class ConcluirLocalRequest(BaseModel):
    equipeId: str
    dia: str
    localId: str
    concluido: bool


# ── Alocação ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/parametros", response_model=Parametros)
def parametros_endpoint():
    """Fonte única dos números de calibração. Existe para o frontend não
    duplicar `LIMIAR_PODA_CM` (a linha de limiar do gráfico de Previsões IA
    saía dessincronizada quando o valor mudava aqui)."""
    return Parametros(limiarPodaCm=LIMIAR_PODA_CM, capacidadeDiaria=CAPACIDADE_DIARIA)


@app.get("/clusterizacao", response_model=ClusterizacaoResponse)
def clusterizacao_endpoint(k: int | None = Query(default=None, ge=1)):
    """Agrupa as regiões por perfil de crescimento. `k` opcional força o
    número de grupos; sem ele o número sai do tamanho do lote."""
    garantir_previsoes_atuais()
    return clusterizar_do_csv(k=k)


@app.post("/grama/analisar", response_model=AnaliseGramaResponse)
async def analisar_grama_endpoint(
    arquivo: UploadFile = File(...),
    faixaBaixaPct: float = Query(default=FAIXA_BAIXA_PCT, gt=0),
    faixaMediaPct: float = Query(default=FAIXA_MEDIA_PCT, gt=0),
):
    """Analisa uma foto avulsa de grama (upload) via segmentação HSV.

    Sem câmera fixa calibrada não há `px_por_cm`/`y_chao` reais — a altura
    sai como % da altura da imagem, não em centímetros. Ver analise_grama.py.
    """
    if faixaMediaPct <= faixaBaixaPct:
        raise HTTPException(status_code=422, detail="faixaMediaPct deve ser maior que faixaBaixaPct.")

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if len(conteudo) > MAX_UPLOAD_IMAGEM_BYTES:
        raise HTTPException(status_code=413, detail="Imagem maior que 10MB.")

    try:
        resultado = analisar_imagem(conteudo, faixaBaixaPct, faixaMediaPct)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    imagem_png = resultado.pop("imagemAnotadaPng")
    imagem_b64 = base64.b64encode(imagem_png).decode("ascii")

    return AnaliseGramaResponse(
        **resultado,
        imagemAnotadaBase64=f"data:image/png;base64,{imagem_b64}",
    )


@app.post("/gerar-alocacao", response_model=AlocacaoResponse)
def gerar_alocacao_endpoint(req: AlocacaoRequest):
    if not req.locais:
        raise HTTPException(status_code=422, detail="Lista de locais vazia.")

    ids = [local.id for local in req.locais]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="IDs de local duplicados no lote.")

    locais = [local.model_dump() for local in req.locais]

    prob, locais, equipes, dias = rodar_modelo_horoprognosis(
        locais, req.quantidadeEquipes, req.ano, req.mes,
        capacidade_diaria=req.capacidadeDiaria,
    )

    if prob.status != 1:
        raise HTTPException(status_code=422, detail="Sem solução viável com os dados fornecidos.")

    alocacao_map, nao_alocados_ids = gerar_alocacao(prob, locais, equipes, dias)
    locais_por_id = {local["id"]: local for local in locais}

    def _local_alocado(local_id: str) -> LocalAlocado:
        local = locais_por_id[local_id]
        return LocalAlocado(localId=local_id, prioridade=local["prioridade"], dificuldade=local["dificuldade"])

    alocacoes = [
        AlocacaoDia(
            equipeId=equipe,
            dia=dia,
            locais=[_local_alocado(local_id) for local_id in alocacao_map[equipe][dia]],
        )
        for equipe in equipes
        for dia in dias
        if alocacao_map[equipe][dia]
    ]

    nao_alocados = [_local_alocado(local_id) for local_id in nao_alocados_ids]

    alerta = calcular_alerta_capacidade(
        locais, req.quantidadeEquipes, dias, capacidade_diaria=req.capacidadeDiaria,
    )

    return AlocacaoResponse(
        alocacoes=alocacoes,
        naoAlocados=nao_alocados,
        alerta=AlertaCapacidade(**alerta) if alerta else None,
    )


# ── Previsões da IA ──────────────────────────────────────────────────────────

@app.get("/previsoes", response_model=list[PrevisaoRegiao])
def previsoes_endpoint():
    garantir_previsoes_atuais()
    return carregar_previsoes()


@app.post("/previsoes/gerar-alocacao", response_model=GerarAlocacaoDePrevisoesResponse)
def gerar_alocacao_de_previsoes_endpoint(req: GerarAlocacaoDePrevisoesRequest):
    garantir_previsoes_atuais()
    previsoes = carregar_previsoes()
    derivado = derivar_locais_de_poda(previsoes, limiar=req.limiarPodaCm)

    if not derivado["locais"]:
        raise HTTPException(
            status_code=422,
            detail="Nenhuma região atinge o limiar de poda no horizonte de previsão.",
        )

    prob, locais, equipes, dias = rodar_modelo_horoprognosis_com_prazos(
        derivado["locais"], req.quantidadeEquipes,
        capacidade_diaria=req.capacidadeDiaria,
    )

    if prob.status != 1:
        raise HTTPException(status_code=422, detail="Sem solução viável com os dados fornecidos.")

    alocacao_map, nao_alocados_ids = gerar_alocacao(prob, locais, equipes, dias)
    locais_por_id = {local["id"]: local for local in locais}

    def _local_alocado(local_id: str) -> LocalAlocado:
        local = locais_por_id[local_id]
        return LocalAlocado(localId=local_id, prioridade=local["prioridade"], dificuldade=local["dificuldade"])

    alocacoes = [
        AlocacaoDia(
            equipeId=equipe,
            dia=dia,
            locais=[_local_alocado(local_id) for local_id in alocacao_map[equipe][dia]],
        )
        for equipe in equipes
        for dia in dias
        if alocacao_map[equipe][dia]
    ]

    nao_alocados = [_local_alocado(local_id) for local_id in nao_alocados_ids]

    alerta = calcular_alerta_capacidade(
        locais, req.quantidadeEquipes, dias, capacidade_diaria=req.capacidadeDiaria,
        rotulo_periodo="período",
    )

    return GerarAlocacaoDePrevisoesResponse(
        periodo=PeriodoReferencia(inicio=dias[0], fim=dias[-1]),
        locaisDerivados=derivado["locais"],
        alocacoes=alocacoes,
        naoAlocados=nao_alocados,
        alerta=AlertaCapacidade(**alerta) if alerta else None,
        semAlertaNoHorizonte=derivado["semAlertaNoHorizonte"],
    )


# ── Alocação publicada (site dos podadores) ────────────────────────────────────

@app.post("/alocacao/publicar", response_model=AlocacaoPublicadaResponse)
def publicar_alocacao_endpoint(req: PublicarAlocacaoRequest):
    publicar_alocacao(
        periodo=req.periodo.model_dump(),
        alocacoes=[a.model_dump() for a in req.alocacoes],
        nao_alocados=[l.model_dump() for l in req.naoAlocados],
    )
    return obter_alocacao_atual()


@app.get("/alocacao/atual", response_model=AlocacaoPublicadaResponse)
def obter_alocacao_atual_endpoint():
    atual = obter_alocacao_atual()
    if atual is None:
        raise HTTPException(status_code=404, detail="Nenhuma alocação foi publicada ainda.")
    return atual


@app.post("/alocacao/locais/concluir", response_model=AlocacaoPublicadaResponse)
def concluir_local_endpoint(req: ConcluirLocalRequest):
    atual = obter_alocacao_atual()
    if atual is None:
        raise HTTPException(status_code=404, detail="Nenhuma alocação foi publicada ainda.")

    local_existe = any(
        aloc["equipeId"] == req.equipeId
        and aloc["dia"] == req.dia
        and any(local["localId"] == req.localId for local in aloc["locais"])
        for aloc in atual["alocacoes"]
    )
    if not local_existe:
        raise HTTPException(status_code=404, detail="Local não encontrado na alocação publicada.")

    marcar_conclusao(req.equipeId, req.dia, req.localId, req.concluido)
    return obter_alocacao_atual()


# ── Ponto de entrada (dev) ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="warning")
