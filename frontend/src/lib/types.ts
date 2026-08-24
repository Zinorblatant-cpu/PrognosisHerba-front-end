export interface SemanaPrevisao {
  data: string;
  alturaPrevistaCm: number;
  nivelAlerta: "baixo" | "medio" | "alto";
}

export interface PrevisaoRegiao {
  idRegiao: string;
  inclinacaoGraus: number;
  areaDeRisco: "baixo" | "medio" | "alto";
  semanas: SemanaPrevisao[];
}

export interface LocalAlocado {
  localId: string;
  prioridade: string;
  dificuldade: string;
}

export interface AlocacaoDia {
  equipeId: string;
  dia: string;
  locais: LocalAlocado[];
}

export interface AlertaCapacidade {
  capacidadeTotalMes: number;
  demandaTotal: number;
  deficit: number;
  equipesDiaAdicionais: number;
  equipesExtrasSugeridas: number;
  mensagem: string;
}

export interface LocalDerivado {
  id: string;
  prioridade: string;
  dificuldade: string;
  dataAlvo: string;
  alturaPrevistaCm: number;
}

export interface PeriodoReferencia {
  inicio: string;
  fim: string;
}

export interface GerarAlocacaoDePrevisoesRequest {
  quantidadeEquipes: number;
  capacidadeDiaria?: number;
  limiarPodaCm?: number;
}

export interface GerarAlocacaoDePrevisoesResponse {
  periodo: PeriodoReferencia;
  locaisDerivados: LocalDerivado[];
  alocacoes: AlocacaoDia[];
  naoAlocados: LocalAlocado[];
  alerta: AlertaCapacidade | null;
  semAlertaNoHorizonte: string[];
}

export interface PublicarAlocacaoRequest {
  periodo: PeriodoReferencia;
  alocacoes: AlocacaoDia[];
  naoAlocados: LocalAlocado[];
}

export interface LocalAlocadoComStatus extends LocalAlocado {
  concluido: boolean;
}

export interface AlocacaoDiaComStatus {
  equipeId: string;
  dia: string;
  locais: LocalAlocadoComStatus[];
}

export interface AlocacaoPublicada {
  publicadoEm: string;
  periodo: PeriodoReferencia;
  alocacoes: AlocacaoDiaComStatus[];
  naoAlocados: LocalAlocado[];
}
