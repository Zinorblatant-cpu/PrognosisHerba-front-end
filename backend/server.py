"""
Servidor FastAPI — Horoprognosis (alocação de equipes de poda)
=================================================================
Recebe um lote de locais de poda (id, prioridade, dificuldade) — enviado
por um sistema externo (IA) — e devolve a alocação ótima de equipes por
dia dentro do mês informado, resolvendo o modelo PuLP/CBC de
horoprognosis.py. Ver MODELO_MATEMATICO.md para a formulação completa.

Sem persistência e sem autenticação: cada chamada a /gerar-alocacao é
autocontida (todo o lote de locais vem no próprio payload).

POST /gerar-alocacao → roda o solver e devolve a alocação + alerta de
                        capacidade (quando a demanda excede a capacidade
                        do mês).
GET  /health          → liveness check.

Desenvolvimento:
    uvicorn server:app --port 8002 --reload
"""
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from horoprognosis import (
    CAPACIDADE_DIARIA,
    calcular_alerta_capacidade,
    gerar_alocacao,
    rodar_modelo_horoprognosis,
)
from previsoes import LIMIAR_PODA_CM, carregar_previsoes, derivar_locais_de_poda

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
    ano: int | None = Field(default=None, ge=2000, le=2100)
    mes: int | None = Field(default=None, ge=1, le=12)
    limiarPodaCm: float = Field(default=LIMIAR_PODA_CM, gt=0)


class LocalDerivado(BaseModel):
    id: str
    prioridade: str
    dificuldade: str
    dataAlvo: str
    alturaPrevistaCm: float


class MesReferencia(BaseModel):
    ano: int
    mes: int


class GerarAlocacaoDePrevisoesResponse(BaseModel):
    mesReferencia: MesReferencia
    locaisDerivados: list[LocalDerivado]
    alocacoes: list[AlocacaoDia]
    naoAlocados: list[LocalAlocado]
    alerta: AlertaCapacidade | None = None
    foraDoMes: list[LocalDerivado]
    semAlertaNoHorizonte: list[str]


# ── Alocação ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


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
    return carregar_previsoes()


@app.post("/previsoes/gerar-alocacao", response_model=GerarAlocacaoDePrevisoesResponse)
def gerar_alocacao_de_previsoes_endpoint(req: GerarAlocacaoDePrevisoesRequest):
    previsoes = carregar_previsoes()
    derivado = derivar_locais_de_poda(previsoes, ano=req.ano, mes=req.mes, limiar=req.limiarPodaCm)

    if not derivado["locais"]:
        raise HTTPException(
            status_code=422,
            detail="Nenhuma região atinge o limiar de poda no mês solicitado.",
        )

    ano, mes = derivado["anoUsado"], derivado["mesUsado"]
    locais = [
        {"id": loc["id"], "prioridade": loc["prioridade"], "dificuldade": loc["dificuldade"]}
        for loc in derivado["locais"]
    ]

    prob, locais, equipes, dias = rodar_modelo_horoprognosis(
        locais, req.quantidadeEquipes, ano, mes,
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

    return GerarAlocacaoDePrevisoesResponse(
        mesReferencia=MesReferencia(ano=ano, mes=mes),
        locaisDerivados=derivado["locais"],
        alocacoes=alocacoes,
        naoAlocados=nao_alocados,
        alerta=AlertaCapacidade(**alerta) if alerta else None,
        foraDoMes=derivado["foraDoMes"],
        semAlertaNoHorizonte=derivado["semAlertaNoHorizonte"],
    )


# ── Ponto de entrada (dev) ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="warning")
